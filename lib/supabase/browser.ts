import { createBrowserClient } from "@supabase/ssr";

/** Browser client, used only for direct-to-storage uploads (images, avatars). */
export function browserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
