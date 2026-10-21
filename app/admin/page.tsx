import Link from "next/link";
import { Money } from "@/components/money";
import { PageTitle, StatusBadge } from "@/components/ui/display";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface Stats {
  revenue: number;
  revenue_30d: number;
  orders: number;
  to_fulfil: number;
  customers: number;
  products: number;
  low_stock: { id: string; product_id: string; name: string; title: string; stock: number }[];
}

export default async function AdminDashboard() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: stats }, { data: recent }] = await Promise.all([
    supabase.rpc("admin_stats"),
    supabase
      .from("orders")
      .select("id,order_number,status,total,currency,created_at,profiles(email,full_name)")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);
  const s: Stats = stats ?? { revenue: 0, revenue_30d: 0, orders: 0, to_fulfil: 0, customers: 0, products: 0, low_stock: [] };
  const orders = (recent ?? []) as unknown as (Order & { profiles: { email: string; full_name: string | null } | null })[];

  const tiles = [
    ["Revenue (all time)", <Money key="r" amount={s.revenue} />],
    ["Revenue (30 days)", <Money key="r30" amount={s.revenue_30d} />],
    ["Orders to fulfil", s.to_fulfil],
    ["Total orders", s.orders],
    ["Customers", s.customers],
    ["Products", s.products],
  ] as const;

  return (
    <>
      <PageTitle>Dashboard</PageTitle>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {tiles.map(([label, value]) => (
          <div key={label} className="card p-5">
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <section className="card overflow-x-auto xl:col-span-2">
          <div className="flex items-center justify-between p-5 pb-2">
            <h2 className="font-semibold">Recent orders</h2>
            <Link href="/admin/orders" className="text-sm text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          <table className="data-table">
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/admin/orders/${o.id}`} className="font-medium hover:text-brand-600">
                      #{o.order_number}
                    </Link>
                  </td>
                  <td className="text-zinc-600">{o.profiles?.full_name || o.profiles?.email}</td>
                  <td className="text-zinc-500">{formatDate(o.created_at)}</td>
                  <td>
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="text-right font-medium">
                    <Money amount={o.total} currency={o.currency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Low stock</h2>
          {s.low_stock.length ? (
            <ul className="space-y-2 text-sm">
              {s.low_stock.map((v) => (
                <li key={v.id} className="flex justify-between gap-2">
                  <Link href={`/admin/products/${v.product_id}`} className="truncate hover:text-brand-600">
                    {v.name}
                    {v.title !== "Default" && <span className="text-zinc-500"> · {v.title}</span>}
                  </Link>
                  <span className={v.stock === 0 ? "font-medium text-red-600" : "text-amber-600"}>{v.stock}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">All variants are well stocked.</p>
          )}
        </section>
      </div>
    </>
  );
}
