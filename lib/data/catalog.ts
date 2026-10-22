import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { publicClient } from "@/lib/supabase/public";
import type { Category, CategoryNode, Product, ProductCard, Review, StoreSettings } from "@/lib/types";
import { site } from "@/site.config";

// Public catalog reads. Everything here is cached across requests and
// invalidated by tag from admin Server Actions (see lib/actions/admin.ts).
// On a DB error we cache for seconds only, so a blip never sticks for hours.

export const TAGS = {
  settings: "settings",
  categories: "categories",
  products: "products",
  product: (slug: string) => `product:${slug}`,
  reviews: (productId: string) => `reviews:${productId}`,
};

const DEFAULT_SETTINGS: StoreSettings = {
  store_name: site.name,
  currency: "INR",
  locale: "en-IN",
  shipping_fee: 4900,
  free_shipping_threshold: 49900,
};

export async function getSettings(): Promise<StoreSettings> {
  "use cache";
  cacheTag(TAGS.settings);
  const { data, error } = await publicClient()
    .from("store_settings")
    .select("store_name,currency,locale,shipping_fee,free_shipping_threshold")
    .single();
  if (error) cacheLife("seconds");
  else cacheLife("days");
  return data ?? DEFAULT_SETTINGS;
}

export async function getCategoryTree(): Promise<CategoryNode[]> {
  "use cache";
  cacheTag(TAGS.categories);
  const { data, error } = await publicClient()
    .from("categories")
    .select("id,parent_id,name,slug,description,image_url,sort_order,is_active")
    .order("sort_order")
    .order("name");
  if (error) cacheLife("seconds");
  else cacheLife("days");
  return buildTree((data ?? []) as Category[]);
}

export function buildTree(rows: Category[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>(rows.map((c) => [c.id, { ...c, children: [], path: [] }]));
  const roots: CategoryNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parent_id ? nodes.get(node.parent_id) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  const setPath = (list: CategoryNode[], prefix: string[]) =>
    list.forEach((n) => {
      n.path = [...prefix, n.slug];
      setPath(n.children, n.path);
    });
  setPath(roots, []);
  return roots;
}

/** Resolve /c/a/b/c to its node plus breadcrumb trail. */
export function findByPath(tree: CategoryNode[], slugs: string[]) {
  const trail: CategoryNode[] = [];
  let level = tree;
  for (const slug of slugs) {
    const node = level.find((n) => n.slug === slug);
    if (!node) return null;
    trail.push(node);
    level = node.children;
  }
  return trail.length ? { node: trail[trail.length - 1], trail } : null;
}

export function descendantIds(node: CategoryNode): string[] {
  return [node.id, ...node.children.flatMap(descendantIds)];
}

export type SortKey = "new" | "price_asc" | "price_desc" | "rating";

export interface ProductQuery {
  categoryIds?: string[];
  q?: string;
  sort?: SortKey;
  page?: number;
  perPage?: number;
  min?: number;
  max?: number;
  inStock?: boolean;
  featured?: boolean;
  excludeId?: string;
}

const CARD_FIELDS =
  "id,name,slug,brand,price,compare_at_price,in_stock,rating_avg,rating_count,product_images(url,sort_order)";

type CardRow = Omit<ProductCard, "image"> & { product_images: { url: string }[] };
const toCard = ({ product_images, ...p }: CardRow): ProductCard => ({ ...p, image: product_images[0]?.url ?? null });

export async function getProducts(query: ProductQuery): Promise<{ items: ProductCard[]; total: number }> {
  "use cache";
  cacheTag(TAGS.products);
  const { categoryIds, q, sort = "new", page = 1, perPage = 24, min, max, inStock, featured, excludeId } = query;

  let req = publicClient()
    .from("products")
    .select(CARD_FIELDS, { count: "exact" })
    .eq("is_active", true)
    .order("sort_order", { referencedTable: "product_images" })
    .limit(1, { referencedTable: "product_images" });

  if (categoryIds?.length) req = req.in("category_id", categoryIds);
  if (q) req = req.textSearch("search", q, { type: "websearch", config: "english" });
  if (min != null) req = req.gte("price", min);
  if (max != null) req = req.lte("price", max);
  if (inStock) req = req.eq("in_stock", true);
  if (featured) req = req.eq("is_featured", true);
  if (excludeId) req = req.neq("id", excludeId);

  req =
    sort === "price_asc"
      ? req.order("price")
      : sort === "price_desc"
        ? req.order("price", { ascending: false })
        : sort === "rating"
          ? req.order("rating_avg", { ascending: false }).order("rating_count", { ascending: false })
          : req.order("created_at", { ascending: false });

  const from = (page - 1) * perPage;
  const { data, count, error } = await req.range(from, from + perPage - 1);
  if (error) cacheLife("seconds");
  else cacheLife("hours");
  return { items: ((data ?? []) as unknown as CardRow[]).map(toCard), total: count ?? 0 };
}

export async function getProduct(slug: string): Promise<Product | null> {
  "use cache";
  cacheTag(TAGS.products, TAGS.product(slug));
  const { data, error } = await publicClient()
    .from("products")
    .select(
      "id,name,slug,brand,description,category_id,options,price,compare_at_price,in_stock,rating_avg,rating_count,is_active,is_featured," +
        "images:product_images(id,url,alt,sort_order),variants:product_variants(*)",
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .order("sort_order", { referencedTable: "images" })
    .order("position", { referencedTable: "variants" })
    .maybeSingle();
  // Stock changes with every order, so keep product pages fairly fresh.
  if (error) cacheLife("seconds");
  else cacheLife("minutes");
  if (!data) return null;
  const product = data as unknown as Product;
  return { ...product, variants: product.variants.filter((v) => v.is_active) };
}

export async function getReviews(productId: string): Promise<Review[]> {
  "use cache";
  cacheTag(TAGS.reviews(productId));
  const { data, error } = await publicClient()
    .from("reviews")
    .select("id,user_id,author_name,rating,title,body,is_published,created_at")
    .eq("product_id", productId)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) cacheLife("seconds");
  else cacheLife("hours");
  return (data ?? []) as Review[];
}
