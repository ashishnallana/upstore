import Form from "next/form";
import { Pagination, ProductGrid } from "@/components/store/product-grid";
import { EmptyState } from "@/components/ui/display";
import { getProducts, type ProductQuery, type SortKey } from "@/lib/data/catalog";
import { toMinor } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;
const PER_PAGE = 24;
const SORTS: Record<SortKey, string> = {
  new: "Newest",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  rating: "Top rated",
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

/** Normalised filter values from the URL (prices typed in major units). */
export function parseListing(sp: SearchParams) {
  const sort = one(sp.sort);
  return {
    q: one(sp.q)?.slice(0, 100),
    sort: (sort && sort in SORTS ? sort : "new") as SortKey,
    page: Math.max(1, Number(one(sp.page)) || 1),
    min: one(sp.min),
    max: one(sp.max),
    stock: one(sp.stock),
  };
}

export async function Listing({ sp, categoryIds }: { sp: SearchParams; categoryIds?: string[] }) {
  const f = parseListing(sp);
  const query: ProductQuery = {
    categoryIds,
    q: f.q,
    sort: f.sort,
    page: f.page,
    perPage: PER_PAGE,
    min: toMinor(f.min ?? null) ?? undefined,
    max: toMinor(f.max ?? null) ?? undefined,
    inStock: f.stock === "1",
  };
  const { items, total } = await getProducts(query);

  return (
    <>
      <Form action="" className="mb-6 flex flex-wrap items-end gap-3 rounded-xl bg-zinc-50 p-3">
        {f.q && <input type="hidden" name="q" value={f.q} />}
        <label className="text-sm">
          <span className="label">Sort</span>
          <select name="sort" defaultValue={f.sort} className="input">
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="w-24 text-sm">
          <span className="label">Min</span>
          <input name="min" type="number" min={0} step="any" defaultValue={f.min} className="input" />
        </label>
        <label className="w-24 text-sm">
          <span className="label">Max</span>
          <input name="max" type="number" min={0} step="any" defaultValue={f.max} className="input" />
        </label>
        <label className="flex items-center gap-2 py-2 text-sm">
          <input type="checkbox" name="stock" value="1" defaultChecked={f.stock === "1"} className="size-4 accent-brand-600" />
          In stock only
        </label>
        <button className="btn-secondary">Apply</button>
        <span className="ml-auto self-center text-sm text-zinc-500">{total} products</span>
      </Form>

      {items.length ? (
        <ProductGrid products={items} />
      ) : (
        <EmptyState title="No products found">
          <p className="text-sm text-zinc-500">Try a different search or remove some filters.</p>
        </EmptyState>
      )}
      <Pagination page={f.page} total={total} perPage={PER_PAGE} params={{ q: f.q, sort: f.sort, min: f.min, max: f.max, stock: f.stock }} />
    </>
  );
}
