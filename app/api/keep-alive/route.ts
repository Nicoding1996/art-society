import { getSupabaseAdmin } from "../../../lib/supabase-server";
import { NextResponse } from "next/server";

/**
 * Lightweight keep-alive endpoint.
 * Pinged on a schedule by Vercel Cron to prevent the Supabase
 * free-tier project from pausing after 1 week of inactivity.
 */
export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const { error } = await sb.rpc("ping", undefined);

    // If the ping RPC doesn't exist, fall back to a trivial query
    if (error) {
      const { error: fallbackError } = await sb
        .from("games")
        .select("id")
        .limit(1);

      if (fallbackError) {
        return NextResponse.json(
          { ok: false, error: fallbackError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true, ts: new Date().toISOString() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
