import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentProvider, PaymentResult } from "./index";

// YouPI PG (https://github.com/youpi-pg/YouPI-PG): self-hosted UPI gateway.
// Flow: we create a payment server-side → customer pays on the hosted checkout →
// the gateway sends a signed webhook (app/api/payments/youpi/route.ts) and
// redirects the customer to /checkout/return (success) or /order-failed.
// We never trust either alone: every result is re-fetched from the gateway API.

type GatewaySession = {
  paymentId: string;
  orderId: string;
  amountPaise: string | number;
  currency: string;
  status: string;
  method?: string;
};

function config() {
  const apiUrl = process.env.YOUPI_API_URL?.replace(/\/+$/, "");
  const merchantId = process.env.YOUPI_MERCHANT_ID;
  const secret = process.env.YOUPI_WEBHOOK_SECRET;
  if (!apiUrl || !merchantId || !secret) {
    throw new Error("YouPI is not configured: set YOUPI_API_URL, YOUPI_MERCHANT_ID and YOUPI_WEBHOOK_SECRET.");
  }
  return { apiUrl, merchantId, secret };
}

async function call<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const { apiUrl, merchantId, secret } = config();
  const res = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Merchant-Id": merchantId,
      // The merchant webhook secret doubles as the API key (merchant-private views).
      "X-Merchant-Key": secret,
      ...init?.headers,
    },
    signal: AbortSignal.timeout(10_000),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as T };
}

/** Only SUCCESS on a non-COD payment means money arrived; every other final status is a failure. */
function toResult(s: GatewaySession, utr?: string): PaymentResult | null {
  const terminal = ["SUCCESS", "FAILED", "EXPIRED", "CANCELLED"];
  if (!terminal.includes(s.status)) return null;
  const isCod = s.method === "COD";
  return {
    orderId: s.orderId,
    success: s.status === "SUCCESS" && !isCod,
    reference: (s.status === "SUCCESS" && utr) || s.paymentId,
    amount: Number(s.amountPaise),
    currency: s.currency,
    raw: {
      gateway: "youpi",
      paymentId: s.paymentId,
      status: s.status,
      method: s.method,
      ...(utr && { utr }),
      ...(isCod && { rejected: "Cash on delivery chosen at the gateway; this store only accepts prepaid UPI." }),
    },
  };
}

/** Constant-time check of `X-Gateway-Signature: sha256=<hex>` over the raw request body. */
export function verifyYoupiSignature(rawBody: string, header: string | null) {
  const expected = Buffer.from(`sha256=${createHmac("sha256", config().secret).update(rawBody, "utf8").digest("hex")}`);
  const given = Buffer.from(header ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Authoritative status of one gateway payment, straight from the gateway API. */
export async function fetchYoupiPayment(paymentId: string, utr?: string) {
  const { status, body } = await call<GatewaySession>(`/api/v1/payments/${encodeURIComponent(paymentId)}`);
  return status === 200 ? toResult(body, utr) : null;
}

export const youpiProvider: PaymentProvider = {
  id: "youpi",

  async createPayment(order) {
    // UPI settles in rupees only.
    if (order.currency !== "INR") throw new Error("YouPI only supports INR. Change the store currency in Admin → Settings.");
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const { status, body } = await call<{ checkoutUrl?: string; error?: string; message?: string }>("/api/v1/payments", {
      method: "POST",
      body: JSON.stringify({
        orderId: order.id,
        amount: (order.total / 100).toFixed(2),
        currency: order.currency,
        returnUrl: `${site}/checkout/return?order=${order.id}`,
        metadata: { orderNumber: order.order_number },
      }),
    });
    if (!body.checkoutUrl) throw new Error(body.message || body.error || `Payment gateway error (HTTP ${status}).`);
    return { redirectUrl: body.checkoutUrl };
  },

  async lookup(orderId) {
    // Latest gateway session for our order id (works for UPI and COD sessions).
    const { status, body } = await call<GatewaySession>(`/api/v1/orders/${encodeURIComponent(orderId)}/cod`);
    return status === 200 ? toResult(body) : null;
  },
};
