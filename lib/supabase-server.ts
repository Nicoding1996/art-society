import { createClient, SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase admin client.
 * Reads and sanitizes env vars to avoid accidental whitespace/newline issues.
 * Requires:
 * - NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
 * - SUPABASE_SERVICE_ROLE_KEY (server-only)
 */
export function getSupabaseAdmin(): SupabaseClient {
  const urlRaw =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "";

  const serviceKeyRaw = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  const url = urlRaw.trim().replace(/\/+$/, ""); // trim and remove trailing slash(es)
  const serviceKey = serviceKeyRaw.trim();

  if (!url || !serviceKey) {
    throw new Error(
      "Missing Supabase env vars (url or service key). Ensure SUPABASE_URL (preferred) or NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY are set."
    );
  }

  // Validate URL shape early for clearer error than "Invalid URL"
  try {
    // eslint-disable-next-line no-new
    new URL(url);
  } catch {
    throw new Error(
      `Invalid Supabase URL format: "${url}". Expected https://<project>.supabase.co`
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