export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase-server";

function envDiagnostics() {
  return {
    url: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").trim(),
    urlHasHttps: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").trim().startsWith("https://"),
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

    // Load players for leaderboard base
    const { data: players, error: pErr } = await admin
      .from("players")
      .select("id, display_name, games_played, wins, last_played_at");

    if (pErr) {
      return NextResponse.json({ ok: false, error: `Select players failed: ${pErr.message}`, env: envDiagnostics() }, { status: 500 });
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

    const leaderboard = (players ?? []).map((p: any) => {
      const rec = sums.get(p.id);
      const avg = rec && rec.count > 0 ? Math.round((rec.total / rec.count) * 10) / 10 : 0;
      const high = rec ? rec.high : 0;
      return {
        id: p.id,
        name: p.display_name,
        wins: p.wins ?? 0,
        games: p.games_played ?? 0,
        avg,
        high,
        lastPlayedAt: p.last_played_at ?? null,
      };
    });

    leaderboard.sort((a, b) => {
      const d = b.wins - a.wins;
      if (d !== 0) return d;
      const d2 = b.games - a.games;
      if (d2 !== 0) return d2;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ ok: true, history, leaderboard });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err), env: envDiagnostics() }, { status: 500 });
  }
}