import { createClient, SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase admin client.
 * Requires:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY (server-only)
 */
export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  if (!admin) {
    admin = createClient(url, serviceKey, {
      auth: { persistSession: false },
      global: { headers: { "X-Client-Info": "art-society-scorer/1.0" } },
    });
  }
  return admin;
}