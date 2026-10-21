import Image from "next/image";
import Link from "next/link";
import { Money } from "@/components/money";
import { Stars } from "@/components/ui/display";
import type { ProductCard as Card } from "@/lib/types";
import { discountPercent } from "@/lib/utils";

export function ProductCard({ product, priority }: { product: Card; priority?: boolean }) {
  const off = discountPercent(product.price, product.compare_at_price);
  return (
    <Link href={`/p/${product.slug}`} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-zinc-100">
        {product.image && (
          <Image
            src={product.image}
            alt={product.name}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
        {off > 0 && <span className="absolute left-2 top-2 rounded-md bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">-{off}%</span>}
        {!product.in_stock && (
          <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center text-xs font-medium text-white">Out of stock</span>
        )}
      </div>
      <div className="mt-3 space-y-1">
        {product.brand && <p className="text-xs uppercase tracking-wide text-zinc-500">{product.brand}</p>}
        <h3 className="line-clamp-2 text-sm font-medium group-hover:text-brand-600">{product.name}</h3>
        {product.rating_count > 0 && (
          <p className="flex items-center gap-1 text-xs text-zinc-500">
            <Stars value={Number(product.rating_avg)} /> ({product.rating_count})
          </p>
        )}
        <p className="flex items-baseline gap-2">
          <span className="font-semibold">
            <Money amount={product.price} />
          </span>
          {off > 0 && (
            <span className="text-xs text-zinc-400 line-through">
              <Money amount={product.compare_at_price!} />
            </span>
          )}
        </p>
      </div>
    </Link>
  );
}

export function ProductGrid({ products }: { products: Card[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < 4} />
      ))}
    </div>
  );
}

export function Pagination({
  page,
  total,
  perPage,
  params,
}: {
  page: number;
  total: number;
  perPage: number;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams(Object.entries({ ...params, page: String(p) }).filter((e): e is [string, string] => !!e[1]));
    return `?${sp}`;
  };
  return (
    <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pagination">
      {page > 1 && (
        <Link href={href(page - 1)} className="btn-secondary">
          Previous
        </Link>
      )}
      <span className="px-3 text-sm text-zinc-600">
        Page {page} of {pages}
      </span>
      {page < pages && (
        <Link href={href(page + 1)} className="btn-secondary">
          Next
        </Link>
      )}
    </nav>
  );
}
