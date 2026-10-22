"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { TAGS } from "@/lib/data/catalog";
import { createClient } from "@/lib/supabase/server";
import type { ActionState, OrderStatus, ProductOption, Role } from "@/lib/types";
import { slugify, str, toMinor } from "@/lib/utils";
import { site } from "@/site.config";

// Every action re-checks the admin role (RLS enforces it again in the DB)
// and expires the cache tags its change affects.

const bool = (form: FormData, key: string) => form.get(key) === "on";

// ───────── Settings ─────────

export async function saveSettings(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const currency = str(form, "currency").toUpperCase();
  const locale = str(form, "locale");
  try {
    new Intl.NumberFormat(locale, { style: "currency", currency });
  } catch {
    return { error: "Invalid currency code or locale." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("store_settings")
    .update({
      store_name: str(form, "store_name") || site.name,
      currency,
      locale,
      shipping_fee: toMinor(form.get("shipping_fee")) ?? 0,
      free_shipping_threshold: toMinor(form.get("free_shipping_threshold")) ?? 0,
    })
    .eq("id", true);
  if (error) return { error: error.message };
  updateTag(TAGS.settings);
  refresh();
  return { ok: "Settings saved" };
}

// ───────── Categories ─────────

export async function saveCategory(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = str(form, "id");
  const name = str(form, "name");
  if (!name) return { error: "Name is required." };
  const category = {
    name,
    slug: slugify(str(form, "slug") || name),
    parent_id: str(form, "parent_id") || null,
    description: str(form, "description") || null,
    image_url: str(form, "image_url") || null,
    sort_order: Number(form.get("sort_order")) || 0,
    is_active: bool(form, "is_active"),
  };
  if (id && category.parent_id === id) return { error: "A category cannot be its own parent." };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("categories").update(category).eq("id", id)
    : await supabase.from("categories").insert(category);
  if (error) return { error: error.code === "23505" ? "That slug is already taken." : error.message };
  updateTag(TAGS.categories);
  refresh();
  return { ok: "Category saved" };
}

export async function deleteCategory(id: string): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { error: error.code === "23503" ? "Move or delete its subcategories first." : error.message };
  updateTag(TAGS.categories);
  refresh();
  return { ok: "Deleted" };
}

// ───────── Products ─────────

interface VariantInput {
  id?: string;
  title: string;
  option_values: Record<string, string>;
  sku: string;
  price: string;
  compare_at_price: string;
  stock: string;
  is_active: boolean;
}

export async function saveProduct(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = str(form, "id");
  const name = str(form, "name");
  if (!name) return { error: "Name is required." };

  let options: ProductOption[], variants: VariantInput[], images: { url: string; alt: string }[];
  try {
    options = JSON.parse(String(form.get("options") || "[]"));
    variants = JSON.parse(String(form.get("variants") || "[]"));
    images = JSON.parse(String(form.get("images") || "[]"));
  } catch {
    return { error: "Invalid form data." };
  }
  if (!variants.length) return { error: "Add at least one variant." };

  const rows = [];
  for (const [i, v] of variants.entries()) {
    const price = toMinor(v.price);
    if (price === null) return { error: `Enter a valid price for "${v.title}".` };
    rows.push({
      ...(v.id && { id: v.id }),
      title: v.title || "Default",
      option_values: v.option_values,
      sku: v.sku?.trim() || null,
      price,
      compare_at_price: toMinor(v.compare_at_price),
      stock: Math.max(0, Math.floor(Number(v.stock) || 0)),
      is_active: v.is_active,
      position: i,
    });
  }

  const product = {
    name,
    slug: slugify(str(form, "slug") || name),
    brand: str(form, "brand") || null,
    description: str(form, "description") || null,
    category_id: str(form, "category_id") || null,
    options: options.filter((o) => o.name && o.values.length),
    is_active: bool(form, "is_active"),
    is_featured: bool(form, "is_featured"),
  };

  const supabase = await createClient();
  let productId = id;
  let oldSlug: string | undefined;
  if (id) {
    const { data: old } = await supabase.from("products").select("slug").eq("id", id).single();
    oldSlug = old?.slug;
    const { error } = await supabase.from("products").update(product).eq("id", id);
    if (error) return { error: error.code === "23505" ? "That slug is already taken." : error.message };
  } else {
    const { data, error } = await supabase.from("products").insert(product).select("id").single();
    if (error) return { error: error.code === "23505" ? "That slug is already taken." : error.message };
    productId = data.id;
  }

  // Variants: drop removed ones, upsert the rest (keeping ids so carts/orders stay linked).
  const keep = rows.flatMap((r) => (r.id ? [r.id] : []));
  let del = supabase.from("product_variants").delete().eq("product_id", productId);
  if (keep.length) del = del.not("id", "in", `(${keep.join(",")})`);
  const { error: delErr } = await del;
  if (delErr) return { error: delErr.message };

  const existing = rows.filter((r) => r.id).map((r) => ({ ...r, product_id: productId }));
  const fresh = rows.filter((r) => !r.id).map((r) => ({ ...r, product_id: productId }));
  if (existing.length) {
    const { error } = await supabase.from("product_variants").upsert(existing);
    if (error) return { error: error.code === "23505" ? "Duplicate SKU." : error.message };
  }
  if (fresh.length) {
    const { error } = await supabase.from("product_variants").insert(fresh);
    if (error) return { error: error.code === "23505" ? "Duplicate SKU." : error.message };
  }

  await supabase.from("product_images").delete().eq("product_id", productId);
  if (images.length) {
    await supabase
      .from("product_images")
      .insert(images.map((img, i) => ({ product_id: productId, url: img.url, alt: img.alt || name, sort_order: i })));
  }

  updateTag(TAGS.products);
  updateTag(TAGS.product(product.slug));
  if (oldSlug && oldSlug !== product.slug) updateTag(TAGS.product(oldSlug));
  redirect(`/admin/products/${productId}?${id ? "saved" : "created"}=1`);
}

export async function deleteProduct(id: string, slug: string): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return { error: error.message };
  updateTag(TAGS.products);
  updateTag(TAGS.product(slug));
  redirect("/admin/products");
}

// ───────── Orders ─────────

export async function updateOrderStatus(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_order_status", {
    p_order_id: str(form, "order_id"),
    p_status: str(form, "status") as OrderStatus,
    p_note: str(form, "note") || null,
  });
  if (error) return { error: error.message };
  if (str(form, "status") === "cancelled") updateTag(TAGS.products);
  refresh();
  return { ok: "Order updated" };
}

// ───────── Customers ─────────

export async function setUserRole(userId: string, role: Role): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_role", { p_user: userId, p_role: role });
  if (error) return { error: error.message };
  refresh();
  return { ok: "Role updated" };
}

// ───────── Coupons ─────────

export async function saveCoupon(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = str(form, "id");
  const type = str(form, "discount_type") === "fixed" ? "fixed" : "percent";
  const rawValue = Number(form.get("value"));
  const value = type === "percent" ? Math.round(rawValue) : toMinor(form.get("value"));
  if (!value || value <= 0 || (type === "percent" && value > 100)) return { error: "Enter a valid discount value." };
  // Date inputs (YYYY-MM-DD), interpreted in UTC; the end date is inclusive.
  const date = (k: string, end = false) => (str(form, k) ? `${str(form, k)}T${end ? "23:59:59" : "00:00:00"}Z` : null);
  const coupon = {
    code: str(form, "code").toUpperCase().replace(/\s+/g, ""),
    description: str(form, "description") || null,
    discount_type: type,
    value,
    min_order: toMinor(form.get("min_order")) ?? 0,
    max_discount: toMinor(form.get("max_discount")),
    usage_limit: Number(form.get("usage_limit")) || null,
    per_user_limit: Math.max(1, Number(form.get("per_user_limit")) || 1),
    starts_at: date("starts_at"),
    ends_at: date("ends_at", true),
    is_active: bool(form, "is_active"),
  };
  if (!coupon.code) return { error: "Code is required." };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("coupons").update(coupon).eq("id", id)
    : await supabase.from("coupons").insert(coupon);
  if (error) return { error: error.code === "23505" ? "That code already exists." : error.message };
  refresh();
  return { ok: "Coupon saved" };
}

export async function deleteCoupon(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("coupons").delete().eq("id", id);
  refresh();
}

// ───────── Reviews ─────────

export async function setReviewPublished(id: string, productId: string, published: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("reviews").update({ is_published: published }).eq("id", id);
  updateTag(TAGS.reviews(productId));
  updateTag(TAGS.products);
  refresh();
}

export async function deleteReview(id: string, productId: string) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("reviews").delete().eq("id", id);
  updateTag(TAGS.reviews(productId));
  updateTag(TAGS.products);
  refresh();
}
