import type { Metadata } from "next";
import Form from "next/form";
import Image from "next/image";
import Link from "next/link";
import { Money } from "@/components/money";
import { Pagination } from "@/components/store/product-grid";
import { Badge, PageTitle } from "@/components/ui/display";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Products" };
const PER_PAGE = 30;

type Row = {
  id: string;
  name: string;
  slug: string;
  price: number;
  is_active: boolean;
  is_featured: boolean;
  categories: { name: string } | null;
  product_images: { url: string }[];
  product_variants: { stock: number }[];
};

export default async function AdminProducts({ searchParams }: PageProps<"/admin/products">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("id,name,slug,price,is_active,is_featured,categories(name),product_images(url,sort_order),product_variants(stock)", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("sort_order", { referencedTable: "product_images" })
    .limit(1, { referencedTable: "product_images" })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  if (q) query = query.ilike("name", `%${q.replace(/[%_]/g, "")}%`);
  const { data, count } = await query;
  const products = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageTitle
        action={
          <Link href="/admin/products/new" className="btn-primary">
            + New product
          </Link>
        }
      >
        Products
      </PageTitle>
      <Form action="" className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search by name" className="input max-w-xs" />
        <button className="btn-secondary">Search</button>
      </Form>
      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Price from</th>
              <th>Stock</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const stock = p.product_variants.reduce((s, v) => s + v.stock, 0);
              return (
                <tr key={p.id} className="hover:bg-zinc-50">
                  <td>
                    <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 font-medium hover:text-brand-600">
                      <span className="relative size-10 shrink-0 overflow-hidden rounded-md bg-zinc-100">
                        {p.product_images[0] && <Image src={p.product_images[0].url} alt="" fill sizes="40px" className="object-cover" />}
                      </span>
                      {p.name}
                    </Link>
                  </td>
                  <td className="text-zinc-600">{p.categories?.name ?? "—"}</td>
                  <td>
                    <Money amount={p.price} />
                  </td>
                  <td className={stock === 0 ? "text-red-600" : ""}>
                    {stock} <span className="text-xs text-zinc-400">({p.product_variants.length} var.)</span>
                  </td>
                  <td className="space-x-1">
                    <Badge className={p.is_active ? "bg-green-50 text-green-700" : "bg-zinc-100 text-zinc-600"}>{p.is_active ? "Active" : "Hidden"}</Badge>
                    {p.is_featured && <Badge className="bg-amber-50 text-amber-700">Featured</Badge>}
                  </td>
                </tr>
              );
            })}
            {!products.length && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-zinc-500">
                  No products found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={count ?? 0} perPage={PER_PAGE} params={{ q }} />
    </>
  );
}
