import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { mergeGuestCart } from "@/lib/cart";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/utils";

/** Landing point for OAuth (?code=) and email links (?token_hash=&type=). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  const { data, error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { data: { user: null }, error: new Error("Missing auth code") };

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error?.message ?? "Sign-in link is invalid or expired")}`);
  }
  await mergeGuestCart(data.user.id);
  return NextResponse.redirect(`${origin}${type === "recovery" ? "/reset-password" : next}`);
}
