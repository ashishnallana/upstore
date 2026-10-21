import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getFormatter } from "@/components/money";
import { BuyBox } from "@/components/store/buy-box";
import { Gallery } from "@/components/store/gallery";
import { ProductGrid } from "@/components/store/product-grid";
import { ActionForm, ActionButton, SubmitButton } from "@/components/ui/form";
import { BlockSkeleton, Stars } from "@/components/ui/display";
import { deleteMyReview, submitReview, toggleWishlist } from "@/lib/actions/store";
import { getUser } from "@/lib/auth";
import { getProduct, getProducts, getReviews } from "@/lib/data/catalog";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  if (!product) return { title: "Product not found" };
  return {
    title: product.name,
    description: product.description?.slice(0, 160),
    openGraph: { images: product.images.slice(0, 1).map((i) => i.url) },
  };
}

export default function ProductPage({ params }: PageProps<"/p/[slug]">) {
  return (
    <div className="container-x py-8">
      <Suspense fallback={<ProductSkeleton />}>
        <ProductView params={params} />
      </Suspense>
    </div>
  );
}

async function ProductView({ params }: Pick<PageProps<"/p/[slug]">, "params">) {
  const product = await getProduct((await params).slug);
  if (!product) notFound();
  const fmt = await getFormatter();

  return (
    <>
      <div className="grid gap-10 lg:grid-cols-2">
        <Gallery images={product.images} name={product.name} />
        <div>
          {product.brand && <p className="text-sm uppercase tracking-wide text-zinc-500">{product.brand}</p>}
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{product.name}</h1>
          {product.rating_count > 0 && (
            <a href="#reviews" className="mt-2 flex items-center gap-2 text-sm text-zinc-600">
              <Stars value={Number(product.rating_avg)} /> {Number(product.rating_avg).toFixed(1)} · {product.rating_count} reviews
            </a>
          )}
          <div className="mt-6">
            <BuyBox
              options={product.options}
              variants={product.variants.map((v) => ({
                id: v.id,
                option_values: v.option_values,
                stock: v.stock,
                price: fmt(v.price),
                compareAt: v.compare_at_price && v.compare_at_price > v.price ? fmt(v.compare_at_price) : null,
              }))}
            />
          </div>
          <div className="mt-4">
            <Suspense fallback={<div className="skeleton h-10 w-40" />}>
              <WishlistButton product={product} />
            </Suspense>
          </div>
          {product.description && (
            <div className="mt-8 border-t border-zinc-200 pt-6">
              <h2 className="mb-2 font-semibold">Description</h2>
              <p className="whitespace-pre-line text-zinc-700">{product.description}</p>
            </div>
          )}
        </div>
      </div>

      <section id="reviews" className="mt-16 grid gap-10 lg:grid-cols-3">
        <div>
          <h2 className="text-xl font-semibold">Customer reviews</h2>
          <p className="mt-2 flex items-center gap-2 text-sm text-zinc-600">
            <Stars value={Number(product.rating_avg)} /> {product.rating_count} reviews
          </p>
          <div className="mt-6">
            <Suspense fallback={<BlockSkeleton className="h-40" />}>
              <ReviewComposer product={product} />
            </Suspense>
          </div>
        </div>
        <div className="lg:col-span-2">
          <ReviewList productId={product.id} />
        </div>
      </section>

      <Related product={product} />
    </>
  );
}

async function WishlistButton({ product }: { product: Product }) {
  const user = await getUser();
  let saved = false;
  if (user) {
    const supabase = await createClient();
    const { count } = await supabase.from("wishlists").select("product_id", { count: "exact", head: true }).eq("product_id", product.id);
    saved = !!count;
  }
  return (
    <form action={toggleWishlist.bind(null, product.id, product.slug)}>
      <SubmitButton className="btn-ghost px-0 text-zinc-700" pendingText="Saving…">
        <span className={saved ? "text-red-500" : ""}>{saved ? "♥" : "♡"}</span>
        {saved ? "Saved to wishlist" : "Add to wishlist"}
      </SubmitButton>
    </form>
  );
}

async function ReviewList({ productId }: { productId: string }) {
  const reviews = await getReviews(productId);
  if (!reviews.length) return <p className="text-zinc-500">No reviews yet.</p>;
  return (
    <ul className="divide-y divide-zinc-200">
      {reviews.map((r) => (
        <li key={r.id} className="py-5 first:pt-0">
          <div className="flex items-center gap-3">
            <Stars value={r.rating} />
            {r.title && <p className="font-medium">{r.title}</p>}
          </div>
          {r.body && <p className="mt-2 text-zinc-700">{r.body}</p>}
          <p className="mt-2 text-xs text-zinc-500">
            {r.author_name ?? "Customer"} · {formatDate(r.created_at)} · Verified purchase
          </p>
        </li>
      ))}
    </ul>
  );
}

async function ReviewComposer({ product }: { product: Product }) {
  const user = await getUser();
  if (!user) {
    return (
      <p className="text-sm text-zinc-600">
        <Link href={`/login?next=/p/${product.slug}`} className="font-medium text-brand-600 underline">
          Sign in
        </Link>{" "}
        to review products you&apos;ve purchased.
      </p>
    );
  }
  const supabase = await createClient();
  const [{ data: purchased }, { data: mine }] = await Promise.all([
    supabase.rpc("has_purchased", { p_product: product.id }),
    supabase.from("reviews").select("rating,title,body").eq("product_id", product.id).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!purchased) return <p className="text-sm text-zinc-600">You can review this product once your order is delivered.</p>;

  return (
    <div className="card p-4">
      <h3 className="mb-3 font-medium">{mine ? "Edit your review" : "Write a review"}</h3>
      <ActionForm action={submitReview} className="space-y-3">
        <input type="hidden" name="product_id" value={product.id} />
        <input type="hidden" name="slug" value={product.slug} />
        <select name="rating" defaultValue={mine?.rating ?? 5} className="input" aria-label="Rating">
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {"★".repeat(n)} ({n})
            </option>
          ))}
        </select>
        <input name="title" placeholder="Title" defaultValue={mine?.title ?? ""} className="input" maxLength={120} />
        <textarea name="body" placeholder="What did you think?" defaultValue={mine?.body ?? ""} className="input" rows={4} maxLength={2000} />
        <div className="flex items-center gap-2">
          <SubmitButton>{mine ? "Update review" : "Submit review"}</SubmitButton>
          {mine && (
            <ActionButton action={deleteMyReview.bind(null, product.id, product.slug)} className="btn-ghost text-red-600" confirm="Delete your review?">
              Delete
            </ActionButton>
          )}
        </div>
      </ActionForm>
    </div>
  );
}

async function Related({ product }: { product: Product }) {
  if (!product.category_id) return null;
  const { items } = await getProducts({ categoryIds: [product.category_id], perPage: 4, excludeId: product.id, sort: "rating" });
  if (!items.length) return null;
  return (
    <section className="mt-16">
      <h2 className="mb-6 text-xl font-semibold">You may also like</h2>
      <ProductGrid products={items} />
    </section>
  );
}

function ProductSkeleton() {
  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="skeleton aspect-square" />
      <div className="space-y-4">
        <div className="skeleton h-8 w-2/3" />
        <div className="skeleton h-6 w-1/4" />
        <div className="skeleton h-32" />
        <div className="skeleton h-12" />
      </div>
    </div>
  );
}
