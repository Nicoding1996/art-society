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

function canonicalizeName(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  const collapsed = trimmed.replace(/\s+/g, " ");
  const nfkd = collapsed.normalize("NFKD");
  const stripped = nfkd.replace(/[\u0300-\u036f]/g, "");
  const cleaned = stripped.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  return cleaned.toLowerCase();
}

type Color = "red" | "blue" | "yellow" | "green";

export async function GET() {
  try {
    const admin = getSupabaseAdmin();

    // Load games in reverse chronological order
    const { data: games, error: gErr } = await admin
      .from("games")
      .select("*")
      .order("created_at", { ascending: false });

    if (gErr) {
      return NextResponse.json({ ok: false, error: `Select games failed: ${gErr.message}`, env: envDiagnostics() }, { status: 500 });
    }

    // Load players for leaderboard base (non-fatal — continue if schema differs)
    let players: any[] = [];
    {
      const { data: pData, error: pErr } = await admin
        .from("players")
        .select("id, canonical, display_name, games_played, wins, last_played_at");
      if (!pErr) {
        // Aggregate multiple rows that share the same canonical into a single stats record
        const rows = (pData ?? []) as any[];
        const byCanonical = new Map<
          string,
          { id: string; canonical: string; display_name: string; games_played: number; wins: number; last_played_at: string | null }
        >();

        for (const r of rows) {
          const c = r?.canonical;
          if (!c) continue;
          const existing = byCanonical.get(c) ?? {
            id: r.id,
            canonical: c,
            display_name: r.display_name,
            games_played: 0,
            wins: 0,
            last_played_at: r.last_played_at ?? null,
          };
          existing.games_played = (existing.games_played ?? 0) + (r.games_played ?? 0);
          existing.wins = (existing.wins ?? 0) + (r.wins ?? 0);

          const exTs = existing.last_played_at ? Date.parse(existing.last_played_at) : 0;
          const rTs = r.last_played_at ? Date.parse(r.last_played_at) : 0;
          if (rTs >= exTs) {
            existing.last_played_at = r.last_played_at ?? existing.last_played_at;
            existing.display_name = r.display_name ?? existing.display_name;
            existing.id = r.id ?? existing.id; // keep some id for table row keys
          }
          byCanonical.set(c, existing);
        }

        players = Array.from(byCanonical.values());
      } else {
        // Gracefully continue when optional columns are missing to avoid client fallback to local cache
        console.warn("[/api/history] players select failed, continuing with history-only leaderboard:", pErr.message);
        players = [];
      }
    }

    // Normalize history shape for client (createdAt, prestigeOrder, players, version)
    const history = (games ?? []).map((g: any) => ({
      id: g.id,
      createdAt: g.created_at,
      prestigeOrder: g.prestige_order,
      players: g.players,
      version: g.version ?? 1,
    }));

    // Compute avg/high from saved snapshots
    const sums = new Map<string, { total: number; count: number; high: number }>();
    for (const g of history) {
      for (const pl of g.players as any[]) {
        const c = canonicalizeName(pl?.name || "");
        if (!c || typeof pl?.finalScore !== "number") continue;
        const rec = sums.get(c) ?? { total: 0, count: 0, high: 0 };
        rec.total += pl.finalScore ?? 0;
        rec.count += 1;
        rec.high = Math.max(rec.high, pl.finalScore ?? 0);
        sums.set(c, rec);
      }
    }

    // Build leaderboard from union of players table and snapshot-derived sums.
    // Also derive wins and lastPlayedAt from history when players table rows are missing.
    const winsFromHistory = new Map<string, number>();
    const lastNameByCanonical = new Map<string, string>();
    const lastPlayedAtByCanonical = new Map<string, string>();

    // Derive winners and last-seen names/timestamps from history
    for (const g of history as any[]) {
      const participants = (g.players as any[])
        .map((pl) => ({ ...pl, c: canonicalizeName(pl?.name || "") }))
        .filter((pl) => !!pl.c);

      // Track last seen name and timestamp
      for (const pl of participants) {
        lastNameByCanonical.set(pl.c, pl.name || lastNameByCanonical.get(pl.c) || "Unknown");
        lastPlayedAtByCanonical.set(pl.c, g.createdAt || lastPlayedAtByCanonical.get(pl.c) || null);
      }

      // Compute winner for this game (by score desc, decor desc, name asc)
      // Determine winner with manual tie-breaker consideration:
      // - Highest finalScore
      // - If multiple tied at top, prefer tieBreakerWinner === true
      // - Otherwise fall back to decorCount desc, then name asc
      const scored = participants.slice().filter((pl) => typeof pl.finalScore === "number");
      let wC: string | undefined;
      if (scored.length > 0) {
        const maxScore = Math.max(...scored.map((pl) => pl.finalScore ?? 0));
        const top = scored.filter((pl) => (pl.finalScore ?? 0) === maxScore);
        const manual = top.find((pl: any) => (pl as any).tieBreakerWinner === true);
        if (manual) {
          wC = manual.c;
        } else {
          const sortedTop = top.slice().sort((a, b) => {
            const d2 = (b.decorCount ?? 0) - (a.decorCount ?? 0);
            if (d2 !== 0) return d2;
            return (a.name || "").localeCompare(b.name || "");
          });
          wC = sortedTop[0]?.c;
        }
      }
      if (wC) winsFromHistory.set(wC, (winsFromHistory.get(wC) ?? 0) + 1);
    }

    const playersByCanonical = new Map<string, any>((players ?? []).map((p: any) => [p.canonical, p]));
    const allCanonicals = new Set<string>([
      ...Array.from(sums.keys()),
      ...(players ?? []).map((p: any) => p.canonical),
    ]);

    const leaderboard = Array.from(allCanonicals).map((canonical) => {
      const pRow = playersByCanonical.get(canonical);
      const rec = sums.get(canonical);
      const avg = rec && rec.count > 0 ? Math.round((rec.total / rec.count) * 10) / 10 : 0;
      const high = rec ? rec.high : 0;
      const wins = pRow?.wins ?? winsFromHistory.get(canonical) ?? 0;
      const games = pRow?.games_played ?? (rec?.count ?? 0);
      const name = pRow?.display_name ?? lastNameByCanonical.get(canonical) ?? "Unknown";
      const lastPlayedAt = pRow?.last_played_at ?? lastPlayedAtByCanonical.get(canonical) ?? null;
      const id = pRow?.id ?? `c:${canonical}`;
      return { id, name, wins, games, avg, high, lastPlayedAt };
    });

    // Remove any entries that have zero games and zero stats to avoid noise
    const filtered = leaderboard.filter((r) => r.games > 0 || r.wins > 0 || r.high > 0);

    filtered.sort((a, b) => {
      const d = b.wins - a.wins;
      if (d !== 0) return d;
      const d2 = b.games - a.games;
      if (d2 !== 0) return d2;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ ok: true, history, leaderboard: filtered, env: envDiagnostics() });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err), env: envDiagnostics() }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    const url = new URL(req.url);
    const keepPlayers = url.searchParams.get("keepPlayers") === "true";

    // Delete all games
    {
      const { error } = await admin.from("games").delete().neq("id", "");
      if (error) {
        return NextResponse.json({ ok: false, step: "delete_games", error: error.message }, { status: 500 });
      }
    }

    // Delete all lineups
    {
      const { error } = await admin.from("lineups").delete().neq("id", "");
      if (error) {
        return NextResponse.json({ ok: false, step: "delete_lineups", error: error.message }, { status: 500 });
      }
    }

    // Optionally delete all players as well
    if (!keepPlayers) {
      const { error } = await admin.from("players").delete().neq("id", "");
      if (error) {
        return NextResponse.json({ ok: false, step: "delete_players", error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, keepPlayers });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}