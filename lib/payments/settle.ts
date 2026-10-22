import "server-only";
import { queueOrderEmails } from "@/lib/orders/notify";
import { adminClient } from "@/lib/supabase/admin";
import type { PaymentResult } from "./index";

export type SettleOutcome = "paid" | "failed" | "ignored";

/**
 * Record a provider-verified result for an order. Safe to call repeatedly and
 * concurrently (webhook retries, return page, webhook racing the return page):
 * only a still-pending order is touched, and record_payment re-checks that
 * under a row lock.
 *
 * Callers must have verified the result with the provider first; this runs
 * with the service role.
 */
export async function recordPaymentResult(providerId: string, result: PaymentResult): Promise<SettleOutcome> {
  const db = adminClient();
  const { data: order } = await db.from("orders").select("id,status,total,currency").eq("id", result.orderId).maybeSingle();
  if (!order || order.status !== "pending") return "ignored";

  let success = result.success;
  let raw: Record<string, unknown> = result.raw ?? {};
  if (success && (result.amount !== order.total || result.currency !== order.currency)) {
    success = false;
    raw = {
      ...raw,
      rejected: `Amount mismatch: received ${result.amount} ${result.currency}, expected ${order.total} ${order.currency}`,
    };
  }

  // Failure events can be redelivered; keep one row per provider reference.
  if (!success) {
    const { count } = await db
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("order_id", order.id)
      .eq("provider_ref", result.reference);
    if (count) return "ignored";
  }

  const { error } = await db.rpc("record_payment", {
    p_order_id: order.id,
    p_provider: providerId,
    p_ref: result.reference,
    p_success: success,
    p_raw: raw,
  });
  if (error) {
    // Another delivery settled it first.
    if (error.message.includes("not awaiting payment")) return "ignored";
    throw new Error(error.message);
  }
  // Confirmation + invoice to the customer, new-order alert to the admin.
  if (success) queueOrderEmails(order.id, "paid");
  return success ? "paid" : "failed";
}
