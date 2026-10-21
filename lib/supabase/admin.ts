import "server-only";
import { createClient as create } from "@supabase/supabase-js";

/**
 * Service-role client: bypasses RLS. Only use after the caller has been
 * authorized in code (e.g. confirming a payment for an order the user owns).
 */
export function adminClient() {
  return create(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
