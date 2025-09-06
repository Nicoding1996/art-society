export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase-server";

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

    // 1) Upsert game snapshot
    {
      const { error } = await admin.from("games").upsert(
        {
          id: game.id,
          created_at: game.createdAt,
          prestige_order: game.prestigeOrder,
          players: game.players,
          version: game.version ?? 1,
        },
        { onConflict: "id" }
      );
      if (error) {
        return NextResponse.json({ ok: false, error: `Upsert game failed: ${error.message}` }, { status: 500 });
      }
    }

    // Derive stats inputs
    const idsUsed = game.players.map((p) => p.playerId).filter(Boolean) as string[];
    const now = new Date().toISOString();

    // Determine winner: finalScore desc, tiebreak decor desc, then name asc
    let winnerId: string | undefined;
    try {
      const sorted = game.players
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
        return NextResponse.json({ ok: false, error: `Select players failed: ${selErr.message}` }, { status: 500 });
      }
      const existMap = new Map<string, any>((existing ?? []).map((r) => [r.id, r]));

      const upserts = idsUsed.map((id) => {
        const sample = game.players.find((p) => p.playerId === id);
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
        return NextResponse.json({ ok: false, error: `Upsert players failed: ${upErr.message}` }, { status: 500 });
      }
    }

    // 3) Upsert lineup usage if all assigned
    if (idsUsed.length === game.players.length && idsUsed.length > 0) {
      const signature = idsUsed.join("|");
      const lineupId = `lu-${signature}`;
      // Try fetch then update/insert
      const { data: found, error: findErr } = await admin
        .from("lineups")
        .select("*")
        .eq("id", lineupId)
        .maybeSingle();

      if (findErr) {
        return NextResponse.json({ ok: false, error: `Select lineup failed: ${findErr.message}` }, { status: 500 });
      }

      if (found) {
        const { error: updErr } = await admin
          .from("lineups")
          .update({ uses: (found.uses ?? 0) + 1, last_used_at: now })
          .eq("id", lineupId);
        if (updErr) {
          return NextResponse.json({ ok: false, error: `Update lineup failed: ${updErr.message}` }, { status: 500 });
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
          return NextResponse.json({ ok: false, error: `Insert lineup failed: ${insErr.message}` }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const msg = err?.message || String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}