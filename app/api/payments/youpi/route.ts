import { NextResponse, type NextRequest } from "next/server";
import { recordPaymentResult } from "@/lib/payments/settle";
import { fetchYoupiPayment, verifyYoupiSignature } from "@/lib/payments/youpi";

/**
 * YouPI webhook. Configure in the gateway's Merchant Admin as
 * `<NEXT_PUBLIC_SITE_URL>/api/payments/youpi`, with the same secret as YOUPI_WEBHOOK_SECRET.
 *
 * The signature proves the message came from the gateway, but it doesn't cover
 * the timestamp, so we also re-fetch the payment from the gateway API and only
 * act on what it reports right now.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!verifyYoupiSignature(raw, request.headers.get("x-gateway-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { paymentId?: string; orderId?: string; utr?: string };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!event.paymentId || !event.orderId) return NextResponse.json({ error: "Missing paymentId/orderId" }, { status: 400 });

  // Non-2xx makes the gateway retry with backoff, so transient errors heal themselves.
  try {
    const result = await fetchYoupiPayment(event.paymentId, event.utr || undefined);
    if (!result || result.orderId !== event.orderId) return NextResponse.json({ received: true, ignored: true });
    const outcome = await recordPaymentResult("youpi", result);
    return NextResponse.json({ received: true, outcome });
  } catch (err) {
    console.error("YouPI webhook failed:", err);
    return NextResponse.json({ error: "Temporary failure" }, { status: 500 });
  }
}
