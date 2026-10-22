import { NextResponse, type NextRequest } from "next/server";

const MESSAGES: Record<string, string> = {
  FAILED: "We couldn't confirm your payment. If money was debited, it will be matched shortly; otherwise please try again.",
  EXPIRED: "The payment window expired. Please try again.",
  CANCELLED: "Payment was cancelled.",
};

/**
 * Fixed path the YouPI checkout sends customers to after an unsuccessful
 * payment (`/order-failed?orderId=&reason=&paymentId=`). Don't rename it.
 */
export function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const orderId = searchParams.get("orderId") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return NextResponse.redirect(`${origin}/account/orders`);
  const message = MESSAGES[searchParams.get("reason") ?? ""] ?? MESSAGES.FAILED;
  return NextResponse.redirect(`${origin}/checkout/pay/${orderId}?error=${encodeURIComponent(message)}`);
}
