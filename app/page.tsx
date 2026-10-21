import Link from "next/link";
import { Suspense } from "react";
import { ProductGrid } from "@/components/store/product-grid";
import { GridSkeleton } from "@/components/ui/display";
import { getCategoryTree, getProducts } from "@/lib/data/catalog";

export default function HomePage() {
  return (
    <>
      <section className="bg-gradient-to-br from-brand-50 to-white">
        <div className="container-x py-16 sm:py-24">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">New season</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">Everything you need, delivered to your door.</h1>
          <p className="mt-4 max-w-xl text-lg text-zinc-600">Electronics, fashion and home essentials at honest prices. Free shipping on qualifying orders.</p>
          <div className="mt-8 flex gap-3">
            <Link href="/search" className="btn-primary px-6 py-3">
              Shop all
            </Link>
            <Link href="/search?sort=rating" className="btn-secondary px-6 py-3">
              Top rated
            </Link>
          </div>
        </div>
      </section>

      <section className="container-x mt-14">
        <h2 className="mb-6 text-xl font-semibold">Shop by category</h2>
        <Suspense fallback={<div className="skeleton h-28" />}>
          <CategoryTiles />
        </Suspense>
      </section>

      <section className="container-x mt-14">
        <h2 className="mb-6 text-xl font-semibold">Featured</h2>
        <Suspense fallback={<GridSkeleton />}>
          <Products featured />
        </Suspense>
      </section>

      <section className="container-x mt-14">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">New arrivals</h2>
          <Link href="/search?sort=new" className="text-sm font-medium text-brand-600 hover:underline">
            View all
          </Link>
        </div>
        <Suspense fallback={<GridSkeleton />}>
          <Products />
        </Suspense>
      </section>
    </>
  );
}

async function CategoryTiles() {
  const tree = await getCategoryTree();
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {tree.map((c) => (
        <Link key={c.id} href={`/c/${c.slug}`} className="card group p-6 transition hover:border-brand-500 hover:shadow-sm">
          <p className="font-semibold group-hover:text-brand-600">{c.name}</p>
          {c.description && <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{c.description}</p>}
          {c.children.length > 0 && <p className="mt-3 text-xs text-zinc-400">{c.children.map((s) => s.name).join(" · ")}</p>}
        </Link>
      ))}
    </div>
  );
}

async function Products({ featured }: { featured?: boolean }) {
  const { items } = await getProducts({ featured, perPage: 8 });
  return items.length ? <ProductGrid products={items} /> : <p className="text-zinc-500">No products yet.</p>;
}
