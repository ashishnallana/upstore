import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import type { Order, OrderItem, SellerSettings } from "@/lib/types";

export interface OrderDocument {
  order: Order;
  items: OrderItem[];
  seller: SellerSettings;
  customer: { email: string | null; name: string | null };
  /** Reference of the successful payment (UTR / gateway id), if any. */
  paymentRef: string | null;
}

/**
 * Everything an invoice or order email needs, read with the service role.
 * Callers must authorize first (RLS read of the order, or a server-side trigger).
 */
export async function loadOrderDocument(orderId: string): Promise<OrderDocument | null> {
  const db = adminClient();
  const [{ data: order }, { data: seller }] = await Promise.all([
    db
      .from("orders")
      .select("*,order_items(*),payments(provider_ref,status,created_at),profiles(email,full_name)")
      .eq("id", orderId)
      .maybeSingle(),
    db.from("store_settings").select("*").single(),
  ]);
  if (!order || !seller) return null;

  const { order_items, payments, profiles, ...rest } = order as Order & {
    order_items: OrderItem[];
    payments: { provider_ref: string | null; status: string }[];
    profiles: { email: string | null; full_name: string | null } | null;
  };
  return {
    order: rest as Order,
    items: order_items,
    seller: seller as SellerSettings,
    customer: { email: profiles?.email ?? null, name: profiles?.full_name ?? rest.shipping_address.full_name },
    paymentRef: payments.find((p) => p.status === "succeeded")?.provider_ref ?? null,
  };
}
