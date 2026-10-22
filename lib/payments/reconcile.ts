import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getPaymentProvider } from "./index";
import { recordPaymentResult } from "./settle";

/**
 * Return-page fallback for when the customer gets back before the webhook does:
 * ask the provider (server-to-server) about an order the signed-in user owns.
 * Returns the order's status after reconciling, or null if it isn't theirs.
 */
export async function reconcilePayment(orderId: string) {
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("id,status").eq("id", orderId).maybeSingle();
  if (!order || order.status !== "pending") return (order?.status as string | undefined) ?? null;

  const provider = getPaymentProvider();
  const result = await provider.lookup(orderId).catch(() => null);
  if (result?.success && result.orderId === orderId && (await recordPaymentResult(provider.id, result)) === "paid") {
    return "paid";
  }
  return "pending";
}
