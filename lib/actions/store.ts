"use server";

import { refresh, revalidateTag, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getLineQuantity, setCartQuantity } from "@/lib/cart";
import { TAGS } from "@/lib/data/catalog";
import { getPaymentProvider } from "@/lib/payments";
import { recordPaymentResult } from "@/lib/payments/settle";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { str } from "@/lib/utils";

// ───────── Cart ─────────

export async function addToCart(variantId: string, quantity = 1): Promise<ActionState> {
  const supabase = await createClient();
  const { data: v } = await supabase.from("product_variants").select("stock,is_active").eq("id", variantId).single();
  if (!v?.is_active) return { error: "This item is unavailable." };
  const next = (await getLineQuantity(variantId)) + quantity;
  if (next > v.stock) return { error: v.stock ? `Only ${v.stock} in stock.` : "Out of stock." };
  await setCartQuantity(variantId, next);
  refresh();
  return { ok: "Added to cart" };
}

export async function updateCartQuantity(variantId: string, quantity: number) {
  await setCartQuantity(variantId, quantity);
  refresh();
}

// ───────── Wishlist ─────────

export async function toggleWishlist(productId: string, slug: string) {
  const user = await getUser();
  if (!user) redirect(`/login?next=/p/${slug}`);
  const supabase = await createClient();
  const { data } = await supabase.from("wishlists").delete().eq("product_id", productId).select("product_id");
  if (!data?.length) await supabase.from("wishlists").insert({ product_id: productId });
  refresh();
}

// ───────── Reviews ─────────

export async function submitReview(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { error: "Please sign in." };
  const productId = str(form, "product_id");
  const rating = Number(form.get("rating"));
  if (!(rating >= 1 && rating <= 5)) return { error: "Choose a rating from 1 to 5." };
  const fields = { rating, title: str(form, "title") || null, body: str(form, "body") || null };
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("product_id", productId)
    .eq("user_id", user.id)
    .maybeSingle();
  const { error } = existing
    ? await supabase.from("reviews").update(fields).eq("id", existing.id)
    : await supabase.from("reviews").insert({ ...fields, product_id: productId });
  if (error) return { error: error.code === "42501" ? "Only customers who received this product can review it." : error.message };
  updateTag(TAGS.reviews(productId));
  updateTag(TAGS.product(str(form, "slug")));
  return { ok: "Thanks for your review!" };
}

export async function deleteMyReview(productId: string, slug: string) {
  const user = await getUser();
  if (!user) return;
  const supabase = await createClient();
  await supabase.from("reviews").delete().eq("product_id", productId).eq("user_id", user.id);
  updateTag(TAGS.reviews(productId));
  updateTag(TAGS.product(slug));
}

// ───────── Checkout & payment ─────────

export async function previewCoupon(code: string, subtotal: number): Promise<{ discount?: number; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("preview_coupon", { p_code: code, p_subtotal: subtotal });
  return error ? { error: error.message } : { discount: data as number };
}

/** Stock changed for these products: let product pages pick it up. */
async function invalidateOrderProducts(orderId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("order_items").select("product_slug").eq("order_id", orderId);
  for (const { product_slug } of data ?? []) if (product_slug) revalidateTag(TAGS.product(product_slug), "max");
  revalidateTag(TAGS.products, "max");
}

export async function placeOrder(_: ActionState, form: FormData): Promise<ActionState> {
  const addressId = str(form, "address_id");
  if (!addressId) return { error: "Choose a shipping address." };
  const supabase = await createClient();
  const { data: orderId, error } = await supabase.rpc("place_order", {
    p_address_id: addressId,
    p_coupon_code: str(form, "coupon") || null,
    p_notes: str(form, "notes") || null,
  });
  if (error) return { error: error.message };

  await invalidateOrderProducts(orderId);
  redirect(await beginPayment(orderId));
}

/** Where to send the customer to pay for one of their pending orders. */
async function beginPayment(orderId: string): Promise<string> {
  // RLS: this only finds the order if it belongs to the signed-in user.
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("id,order_number,status,total,currency").eq("id", orderId).single();
  if (!order) return "/account/orders";
  if (order.status !== "pending") return `/account/orders/${orderId}`;
  try {
    return (await getPaymentProvider().createPayment(order)).redirectUrl;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start the payment.";
    return `/checkout/pay/${orderId}?error=${encodeURIComponent(message)}`;
  }
}

/** "Pay now" / retry button on the payment page. */
export async function startPayment(form: FormData) {
  redirect(await beginPayment(str(form, "order_id")));
}

/** Test payment page (PAYMENT_PROVIDER=fake only): the customer picks the outcome. */
export async function payOrder(form: FormData) {
  if (getPaymentProvider().id !== "fake") redirect("/account/orders");
  const orderId = str(form, "order_id");
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("id,status,total,currency").eq("id", orderId).single();
  if (!order) redirect("/account/orders");
  if (order.status !== "pending") redirect(`/account/orders/${orderId}`);

  const success = str(form, "outcome") === "success";
  const outcome = await recordPaymentResult("fake", {
    orderId,
    success,
    reference: `FAKE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    amount: order.total,
    currency: order.currency,
    raw: { simulated: true },
  });
  redirect(outcome === "paid" ? `/account/orders/${orderId}?placed=1` : `/checkout/pay/${orderId}?error=Payment+failed.+Please+try+again.`);
}

export async function cancelOrder(orderId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_order", { p_order_id: orderId });
  if (error) return { error: error.message };
  await invalidateOrderProducts(orderId);
  refresh();
  return { ok: "Order cancelled" };
}
