export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase-server";

function envDiagnostics() {
  return {
    url: (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim(),
    urlHasHttps: (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().startsWith("https://"),
    serviceKeyLen: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim().length,
  };
}

// Server-side copy of canonicalizeName to enforce constraints at write-time
function canonicalizeName(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  const collapsed = trimmed.replace(/\s+/g, " ");
  const nfkd = collapsed.normalize("NFKD");
  const stripped = nfkd.replace(/[\u0300-\u036f]/g, "");
  const cleaned = stripped.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  return cleaned.toLowerCase();
}

// Generate a compact unique id (not cryptographically strong, sufficient for row keys here)
function ulidLike(): string {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10).toUpperCase();
}

// Resolve player identities by canonical name when playerId is missing.
// - Looks up existing players by canonical
// - Creates missing identities in bulk
// - Returns the original players array with playerId filled where possible
async function resolvePlayerIdentities(
  admin: any,
  players: Array<{ playerId?: string; name: string } & any>
): Promise<typeof players> {
  // Collect players that need resolution and their canonicals
  const need = players
    .map((p) => ({ p, canonical: canonicalizeName(p?.name || "") }))
    .filter((x) => !x.p.playerId && !!x.canonical);

  if (need.length === 0) return players;

  const uniqueCanonicals = Array.from(new Set(need.map((n) => n.canonical)));

  // Fetch existing players by canonical
  const { data: existing, error: selErr } = await admin
    .from("players")
    .select("id, canonical, display_name")
    .in("canonical", uniqueCanonicals);

  if (selErr) {
    throw new Error(`Lookup players by canonical failed: ${selErr.message}`);
  }

  const canonMap = new Map<string, { id: string; display_name: string }>();
  (existing ?? []).forEach((row: any) => {
    canonMap.set(row.canonical, { id: row.id, display_name: row.display_name });
  });

  // Determine which canonicals need creation
  const toCreateCanonicals = uniqueCanonicals.filter((c) => !canonMap.has(c));

  if (toCreateCanonicals.length > 0) {
    const now = new Date().toISOString();
    const createRows = toCreateCanonicals.map((c) => {
      const sample = need.find((n) => n.canonical === c)?.p;
      const display = (sample?.name || c);
      return {
        id: "pid-" + ulidLike(),
        canonical: c,
        display_name: display,
        created_at: now,
        games_played: 0,
        wins: 0,
      };
    });

    // Try bulk insert; on conflict/race, re-select
    const { data: inserted, error: insErr } = await admin
      .from("players")
      .insert(createRows)
      .select("id, canonical, display_name");

    if (insErr) {
      const { data: retry, error: retryErr } = await admin
        .from("players")
        .select("id, canonical, display_name")
        .in("canonical", toCreateCanonicals);

      if (retryErr) {
        throw new Error(
          `Insert players failed: ${insErr.message}; Retry lookup failed: ${retryErr.message}`
        );
      }
      (retry ?? []).forEach((row: any) => {
        canonMap.set(row.canonical, { id: row.id, display_name: row.display_name });
      });
    } else {
      (inserted ?? []).forEach((row: any) => {
        canonMap.set(row.canonical, { id: row.id, display_name: row.display_name });
      });
    }
  }

  // Fill in playerId for players missing it
  const resolved = players.map((p) => {
    if (p.playerId) return p;
    const c = canonicalizeName(p?.name || "");
    const found = c ? canonMap.get(c) : undefined;
    return found ? { ...p, playerId: found.id } : p;
  });

  return resolved as typeof players;
}

type GamePayload = {
  id: string;
  createdAt: string;
  prestigeOrder: any;
  players: Array<{
    playerId?: string;
    name: string;
    finalScore?: number;
    decorCount: number;
  }>;
  version: number;
};

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();

    const { game } = (await req.json()) as { game: GamePayload };
    if (!game?.id || !Array.isArray(game.players)) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }

    // 0) Resolve identities (attach playerId based on typed names)
    const resolvedPlayers = await resolvePlayerIdentities(admin, game.players);
    const resolvedGame = { ...game, players: resolvedPlayers };

    // 1) Upsert game snapshot with resolved players
    {
      const { error } = await admin.from("games").upsert(
        {
          id: resolvedGame.id,
          created_at: resolvedGame.createdAt,
          prestige_order: resolvedGame.prestigeOrder,
          players: resolvedGame.players,
          version: resolvedGame.version ?? 1,
        },
        { onConflict: "id" }
      );
      if (error) {
        return NextResponse.json({ ok: false, error: `Upsert game failed: ${error.message}`, env: envDiagnostics() }, { status: 500 });
      }
    }

    // Derive stats inputs
    const idsUsed = resolvedPlayers.map((p) => p.playerId).filter(Boolean) as string[];
    const now = new Date().toISOString();

    // Determine winner: finalScore desc, tiebreak decor desc, then name asc
    let winnerId: string | undefined;
    try {
      const sorted = resolvedPlayers
        .slice()
        .filter((p) => typeof p.finalScore === "number" && !!p.playerId)
        .sort((a, b) => {
          const d = (b.finalScore ?? 0) - (a.finalScore ?? 0);
          if (d !== 0) return d;
          const d2 = (b.decorCount ?? 0) - (a.decorCount ?? 0);
          if (d2 !== 0) return d2;
          return (a.name || "").localeCompare(b.name || "");
        });
      winnerId = sorted[0]?.playerId;
    } catch {
      // ignore
    }

    // 2) Upsert players stats (increment games_played and possibly wins)
    if (idsUsed.length > 0) {
      const { data: existing, error: selErr } = await admin
        .from("players")
        .select("*")
        .in("id", idsUsed);
      if (selErr) {
        return NextResponse.json({ ok: false, error: `Select players failed: ${selErr.message}`, env: envDiagnostics() }, { status: 500 });
      }
      const existMap = new Map<string, any>((existing ?? []).map((r) => [r.id, r]));

      const upserts = idsUsed.map((id) => {
        const sample = resolvedPlayers.find((p) => p.playerId === id);
        const display = sample?.name || "Player";
        const canonical = canonicalizeName(display);
        const prev = existMap.get(id);
        const prevGames = (prev?.games_played ?? 0) as number;
        const prevWins = (prev?.wins ?? 0) as number;
        return {
          id,
          canonical,
          display_name: display,
          last_played_at: now,
          games_played: prevGames + 1,
          wins: prevWins + (winnerId === id ? 1 : 0),
        };
      });

      const { error: upErr } = await admin.from("players").upsert(upserts, { onConflict: "id" });
      if (upErr) {
        return NextResponse.json({ ok: false, error: `Upsert players failed: ${upErr.message}`, env: envDiagnostics() }, { status: 500 });
      }
    }

    // 3) Upsert lineup usage if all assigned
    if (idsUsed.length === resolvedPlayers.length && idsUsed.length > 0) {
      const signature = idsUsed.join("|");
      const lineupId = `lu-${signature}`;
      // Try fetch then update/insert
      const { data: found, error: findErr } = await admin
        .from("lineups")
        .select("*")
        .eq("id", lineupId)
        .maybeSingle();

      if (findErr) {
        return NextResponse.json({ ok: false, error: `Select lineup failed: ${findErr.message}`, env: envDiagnostics() }, { status: 500 });
      }

      if (found) {
        const { error: updErr } = await admin
          .from("lineups")
          .update({ uses: (found.uses ?? 0) + 1, last_used_at: now })
          .eq("id", lineupId);
        if (updErr) {
          return NextResponse.json({ ok: false, error: `Update lineup failed: ${updErr.message}`, env: envDiagnostics() }, { status: 500 });
        }
      } else {
        const { error: insErr } = await admin.from("lineups").insert({
          id: lineupId,
          size: idsUsed.length,
          player_ids: idsUsed,
          last_used_at: now,
          uses: 1,
        });
        if (insErr) {
          return NextResponse.json({ ok: false, error: `Insert lineup failed: ${insErr.message}`, env: envDiagnostics() }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const msg = err?.message || String(err);
    return NextResponse.json({ ok: false, error: msg, env: envDiagnostics() }, { status: 500 });
  }
}