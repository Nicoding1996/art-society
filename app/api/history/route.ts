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
        .select("id, display_name, games_played, wins, last_played_at");
      if (!pErr) {
        players = pData ?? [];
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
        if (!pl?.playerId || typeof pl?.finalScore !== "number") continue;
        const rec = sums.get(pl.playerId) ?? { total: 0, count: 0, high: 0 };
        rec.total += pl.finalScore ?? 0;
        rec.count += 1;
        rec.high = Math.max(rec.high, pl.finalScore ?? 0);
        sums.set(pl.playerId, rec);
      }
    }

    // Build leaderboard from union of players table and snapshot-derived sums.
    // Also derive wins and lastPlayedAt from history when players table rows are missing.
    const winsFromHistory = new Map<string, number>();
    const lastNameById = new Map<string, string>();
    const lastPlayedAtById = new Map<string, string>();

    // Derive winners and last-seen names/timestamps from history
    for (const g of history as any[]) {
      const participants = (g.players as any[]).filter((pl) => !!pl?.playerId);
      // Track last seen name and timestamp
      for (const pl of participants) {
        lastNameById.set(pl.playerId, pl.name || lastNameById.get(pl.playerId) || "Unknown");
        lastPlayedAtById.set(pl.playerId, g.createdAt || lastPlayedAtById.get(pl.playerId) || null);
      }
      // Compute winner for this game (by score desc, decor desc, name asc)
      // Determine winner with manual tie-breaker consideration:
      // - Highest finalScore
      // - If multiple tied at top, prefer tieBreakerWinner === true
      // - Otherwise fall back to decorCount desc, then name asc
      const scored = participants
        .slice()
        .filter((pl) => typeof pl.finalScore === "number");
      let wId: string | undefined;
      if (scored.length > 0) {
        const maxScore = Math.max(...scored.map((pl) => pl.finalScore ?? 0));
        const top = scored.filter((pl) => (pl.finalScore ?? 0) === maxScore);
        const manual = top.find((pl: any) => (pl as any).tieBreakerWinner === true && !!pl.playerId);
        if (manual) {
          wId = manual.playerId;
        } else {
          const sortedTop = top.slice().sort((a, b) => {
            const d2 = (b.decorCount ?? 0) - (a.decorCount ?? 0);
            if (d2 !== 0) return d2;
            return (a.name || "").localeCompare(b.name || "");
          });
          wId = sortedTop[0]?.playerId;
        }
      }
      if (wId) winsFromHistory.set(wId, (winsFromHistory.get(wId) ?? 0) + 1);
    }

    const playersMap = new Map<string, any>((players ?? []).map((p: any) => [p.id, p]));
    const allIds = new Set<string>([
      ...Array.from(sums.keys()),
      ...(players ?? []).map((p: any) => p.id),
    ]);

    const leaderboard = Array.from(allIds).map((id) => {
      const pRow = playersMap.get(id);
      const rec = sums.get(id);
      const avg = rec && rec.count > 0 ? Math.round((rec.total / rec.count) * 10) / 10 : 0;
      const high = rec ? rec.high : 0;
      const wins = pRow?.wins ?? winsFromHistory.get(id) ?? 0;
      const games = pRow?.games_played ?? (rec?.count ?? 0);
      const name = pRow?.display_name ?? lastNameById.get(id) ?? "Unknown";
      const lastPlayedAt = pRow?.last_played_at ?? lastPlayedAtById.get(id) ?? null;
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