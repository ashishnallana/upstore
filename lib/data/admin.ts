import "server-only";
import { buildTree } from "@/lib/data/catalog";
import { createClient } from "@/lib/supabase/server";
import type { Category, CategoryNode, Product } from "@/lib/types";

// Admin reads go through the user's session (RLS lets admins see inactive rows)
// and are never cached.

export async function getAdminCategoryTree() {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").order("sort_order").order("name");
  return buildTree((data ?? []) as Category[]);
}

/** Flattened tree for <select>s, e.g. "Fashion › Men". */
export function flattenTree(tree: CategoryNode[], prefix = ""): { id: string; label: string; node: CategoryNode }[] {
  return tree.flatMap((n) => {
    const label = prefix ? `${prefix} › ${n.name}` : n.name;
    return [{ id: n.id, label, node: n }, ...flattenTree(n.children, label)];
  });
}

export async function getAdminProduct(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*,images:product_images(id,url,alt,sort_order),variants:product_variants(*)")
    .eq("id", id)
    .order("sort_order", { referencedTable: "images" })
    .order("position", { referencedTable: "variants" })
    .maybeSingle();
  return data as Product | null;
}
