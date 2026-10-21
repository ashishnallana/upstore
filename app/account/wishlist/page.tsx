import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/store/product-grid";
import { EmptyState, PageTitle } from "@/components/ui/display";
import { ActionButton } from "@/components/ui/form";
import { toggleWishlist } from "@/lib/actions/store";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ProductCard as Card } from "@/lib/types";

export const metadata: Metadata = { title: "Wishlist" };

type Row = { product: Omit<Card, "image"> & { product_images: { url: string }[] } | null };

export default async function WishlistPage() {
  await requireUser("/account/wishlist");
  const supabase = await createClient();
  const { data } = await supabase
    .from("wishlists")
    .select("product:products(id,name,slug,brand,price,compare_at_price,in_stock,rating_avg,rating_count,product_images(url,sort_order))")
    .order("created_at", { ascending: false })
    .order("sort_order", { referencedTable: "product.product_images" })
    .limit(1, { referencedTable: "product.product_images" });

  const products: Card[] = ((data ?? []) as unknown as Row[]).flatMap(({ product }) => {
    if (!product) return [];
    const { product_images, ...rest } = product;
    return [{ ...rest, image: product_images[0]?.url ?? null }];
  });

  return (
    <>
      <PageTitle>Wishlist</PageTitle>
      {products.length ? (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
          {products.map((p) => (
            <div key={p.id}>
              <ProductCard product={p} />
              <ActionButton action={toggleWishlist.bind(null, p.id, p.slug)} className="btn-ghost mt-1 px-0 text-sm text-zinc-500">
                Remove
              </ActionButton>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Your wishlist is empty">
          <Link href="/search" className="btn-primary">
            Discover products
          </Link>
        </EmptyState>
      )}
    </>
  );
}
