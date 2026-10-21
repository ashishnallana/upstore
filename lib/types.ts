// Row shapes mirroring supabase/migrations. Money fields are integer minor units.

export type Role = "customer" | "admin";
export type OrderStatus = "pending" | "paid" | "processing" | "shipped" | "delivered" | "cancelled";
export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";

export interface StoreSettings {
  store_name: string;
  currency: string;
  locale: string;
  shipping_fee: number;
  free_shipping_threshold: number;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: Role;
  created_at: string;
}

export interface Address {
  id: string;
  label: string | null;
  full_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
}

export interface Category {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface CategoryNode extends Category {
  children: CategoryNode[];
  /** Slug path from the root, e.g. ["electronics", "phones"]. */
  path: string[];
}

export interface ProductOption {
  name: string;
  values: string[];
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string | null;
  sort_order: number;
}

export interface Variant {
  id: string;
  product_id: string;
  title: string;
  option_values: Record<string, string>;
  sku: string | null;
  price: number;
  compare_at_price: number | null;
  stock: number;
  is_active: boolean;
  position: number;
}

export interface ProductCard {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  price: number;
  compare_at_price: number | null;
  in_stock: boolean;
  rating_avg: number;
  rating_count: number;
  image: string | null;
}

export interface Product extends Omit<ProductCard, "image"> {
  description: string | null;
  category_id: string | null;
  options: ProductOption[];
  is_active: boolean;
  is_featured: boolean;
  images: ProductImage[];
  variants: Variant[];
  updated_at?: string;
}

export interface Review {
  id: string;
  user_id: string;
  author_name: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  is_published: boolean;
  created_at: string;
}

export interface CartLine {
  variantId: string;
  quantity: number;
  productId: string;
  productName: string;
  slug: string;
  variantTitle: string | null;
  price: number;
  stock: number;
  image: string | null;
  available: boolean;
}

export interface ShippingAddress {
  full_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface Order {
  id: string;
  order_number: number;
  user_id: string;
  status: OrderStatus;
  currency: string;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  coupon_code: string | null;
  shipping_address: ShippingAddress;
  notes: string | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  product_id: string | null;
  product_name: string;
  product_slug: string | null;
  variant_title: string | null;
  image_url: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface OrderEvent {
  id: number;
  status: OrderStatus;
  note: string | null;
  created_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  value: number;
  min_order: number;
  max_discount: number | null;
  usage_limit: number | null;
  per_user_limit: number;
  used_count: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
}

/** Return shape for form Server Actions used with useActionState. */
export type ActionState = { error?: string; ok?: string } | undefined;
