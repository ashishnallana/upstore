import "server-only";
import { cookies } from "next/headers";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { CartLine } from "@/lib/types";

// Guests keep a small cookie cart ([[variantId, qty], ...]); signed-in users
// use the cart_items table. mergeGuestCart() moves one into the other on login.

const COOKIE = "cart";
const MAX_LINES = 50;
type Entry = [variantId: string, qty: number];

export async function readGuestCart(): Promise<Entry[]> {
  try {
    const raw = (await cookies()).get(COOKIE)?.value;
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((e): e is Entry => typeof e?.[0] === "string" && Number.isInteger(e?.[1]) && e[1] > 0)
      : [];
  } catch {
    return [];
  }
}

export async function writeGuestCart(entries: Entry[]) {
  const store = await cookies();
  if (!entries.length) return store.delete(COOKIE);
  store.set(COOKIE, JSON.stringify(entries.slice(0, MAX_LINES)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

async function readEntries(): Promise<Entry[]> {
  const user = await getUser();
  if (!user) return readGuestCart();
  const supabase = await createClient();
  const { data } = await supabase.from("cart_items").select("variant_id,quantity").order("created_at");
  return (data ?? []).map((r) => [r.variant_id, r.quantity]);
}

export async function getCartCount() {
  return (await readEntries()).reduce((n, [, q]) => n + q, 0);
}

type VariantRow = {
  id: string;
  title: string;
  price: number;
  stock: number;
  is_active: boolean;
  product: { id: string; name: string; slug: string; is_active: boolean; product_images: { url: string }[] };
};

export async function getCartLines(): Promise<CartLine[]> {
  const entries = await readEntries();
  if (!entries.length) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_variants")
    .select("id,title,price,stock,is_active,product:products!inner(id,name,slug,is_active,product_images(url,sort_order))")
    .in(
      "id",
      entries.map(([id]) => id),
    )
    .order("sort_order", { referencedTable: "product.product_images" })
    .limit(1, { referencedTable: "product.product_images" });

  const byId = new Map(((data ?? []) as unknown as VariantRow[]).map((v) => [v.id, v]));
  return entries.flatMap(([variantId, quantity]) => {
    const v = byId.get(variantId);
    if (!v) return [];
    return [
      {
        variantId,
        quantity,
        productId: v.product.id,
        productName: v.product.name,
        slug: v.product.slug,
        variantTitle: v.title === "Default" ? null : v.title,
        price: v.price,
        stock: v.stock,
        image: v.product.product_images[0]?.url ?? null,
        available: v.is_active && v.product.is_active && v.stock >= quantity,
      },
    ];
  });
}

/** Set (not add) a line's quantity; 0 removes it. */
export async function setCartQuantity(variantId: string, quantity: number) {
  const qty = Math.max(0, Math.min(99, Math.floor(quantity)));
  const user = await getUser();
  if (!user) {
    const entries = (await readGuestCart()).filter(([id]) => id !== variantId);
    if (qty > 0) entries.push([variantId, qty]);
    return writeGuestCart(entries);
  }
  const supabase = await createClient();
  const { error } = qty
    ? await supabase.from("cart_items").upsert({ user_id: user.id, variant_id: variantId, quantity: qty }, { onConflict: "user_id,variant_id" })
    : await supabase.from("cart_items").delete().eq("variant_id", variantId);
  if (error) throw new Error(error.message);
}

export async function getLineQuantity(variantId: string) {
  return (await readEntries()).find(([id]) => id === variantId)?.[1] ?? 0;
}

/** Called right after sign-in: move cookie cart lines into the user's DB cart. */
export async function mergeGuestCart(userId: string) {
  const guest = await readGuestCart();
  if (!guest.length) return;
  const supabase = await createClient();
  const { data: existing } = await supabase.from("cart_items").select("variant_id,quantity");
  const current = new Map((existing ?? []).map((r) => [r.variant_id as string, r.quantity as number]));
  await supabase.from("cart_items").upsert(
    guest.map(([variant_id, q]) => ({ user_id: userId, variant_id, quantity: Math.min(99, (current.get(variant_id) ?? 0) + q) })),
    { onConflict: "user_id,variant_id" },
  );
  await writeGuestCart([]);
}
