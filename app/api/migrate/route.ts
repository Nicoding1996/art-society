import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase-server";

// Mirror of client canonicalization to enforce server-side consistency
function canonicalizeName(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  const collapsed = trimmed.replace(/\s+/g, " ");
  const nfkd = collapsed.normalize("NFKD");
  const stripped = nfkd.replace(/[\u0300-\u036f]/g, "");
  const cleaned = stripped.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  return cleaned.toLowerCase();
}

type PlayerIdentity = {
  id: string;
  canonical: string;
  displayName: string;
  avatarKey?: string;
  colorHint?: string;
  createdAt?: string;
  lastPlayedAt?: string;
  gamesPlayed?: number;
  wins?: number;
};

type GameSnapshot = {
  id: string;
  createdAt: string;
  prestigeOrder: any;
  players: any[];
  version: number;
};

type Lineup = {
  id: string;
  size: number;
  playerIds: string[];
  lastUsedAt: string;
  uses: number;
};

type MigratePayload = {
  players?: PlayerIdentity[];
  history?: GameSnapshot[];
  lineups?: Lineup[];
};

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();

    const payload = (await req.json()) as MigratePayload;
    const players = payload.players ?? [];
    const history = payload.history ?? [];
    const lineups = payload.lineups ?? [];

    // Upsert players
    if (players.length > 0) {
      const playerRows = players.map((p) => ({
        id: p.id,
        canonical: canonicalizeName(p.displayName || p.canonical || ""),
        display_name: p.displayName || "",
        avatar_key: p.avatarKey ?? null,
        color_hint: p.colorHint ?? null,
        created_at: p.createdAt ?? null,
        last_played_at: p.lastPlayedAt ?? null,
        games_played: p.gamesPlayed ?? 0,
        wins: p.wins ?? 0,
      }));

      // Chunk if very large (optional). For now single upsert.
      const { error: pErr } = await admin.from("players").upsert(playerRows, { onConflict: "id" });
      if (pErr) {
        return NextResponse.json(
          { ok: false, step: "players", error: pErr.message },
          { status: 500 }
        );
      }
    }

    // Upsert games (history)
    if (history.length > 0) {
      const gameRows = history.map((g) => ({
        id: g.id,
        created_at: g.createdAt,
        prestige_order: g.prestigeOrder,
        players: g.players,
        version: g.version ?? 1,
      }));

      const { error: gErr } = await admin.from("games").upsert(gameRows, { onConflict: "id" });
      if (gErr) {
        return NextResponse.json(
          { ok: false, step: "games", error: gErr.message },
          { status: 500 }
        );
      }
    }

    // Upsert lineups
    if (lineups.length > 0) {
      const lineupRows = lineups.map((l) => ({
        id: l.id || `lu-${(l.playerIds || []).join("|")}`,
        size: l.size,
        player_ids: l.playerIds,
        last_used_at: l.lastUsedAt,
        uses: l.uses ?? 1,
      }));

      const { error: lErr } = await admin.from("lineups").upsert(lineupRows, { onConflict: "id" });
      if (lErr) {
        return NextResponse.json(
          { ok: false, step: "lineups", error: lErr.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      counts: { players: players.length, games: history.length, lineups: lineups.length },
    });
  } catch (err: any) {
    const msg = err?.message || String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}