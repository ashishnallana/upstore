import "server-only";
import { createClient as create, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/**
 * Cookie-less anonymous client for public catalog reads. Safe to use inside
 * `"use cache"` functions because it never touches request data.
 */
export function publicClient() {
  client ??= create(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
