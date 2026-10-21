import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Money } from "@/components/money";
import { Pagination } from "@/components/store/product-grid";
import { PageTitle, StatusBadge } from "@/components/ui/display";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Order, OrderStatus } from "@/lib/types";
import { formatDate, ORDER_STATUSES } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };
const PER_PAGE = 30;

export default async function AdminOrders({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdmin();
  const sp = await searchParams;
  const status = ORDER_STATUSES.includes(sp.status as OrderStatus) ? (sp.status as OrderStatus) : undefined;
  const q = typeof sp.q === "string" ? sp.q.replace(/\D/g, "") : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select("id,order_number,status,total,currency,created_at,profiles(email,full_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  if (status) query = query.eq("status", status);
  if (q) query = query.eq("order_number", Number(q));
  const { data, count } = await query;
  const orders = (data ?? []) as unknown as (Order & { profiles: { email: string; full_name: string | null } | null })[];

  return (
    <>
      <PageTitle>Orders</PageTitle>
      <Form action="" className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Order #" className="input w-32" inputMode="numeric" />
        <select name="status" defaultValue={status ?? ""} className="input w-44">
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button className="btn-secondary">Filter</button>
      </Form>
      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Status</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-zinc-50">
                <td>
                  <Link href={`/admin/orders/${o.id}`} className="font-medium text-brand-600 hover:underline">
                    #{o.order_number}
                  </Link>
                </td>
                <td>
                  <p>{o.profiles?.full_name || "—"}</p>
                  <p className="text-xs text-zinc-500">{o.profiles?.email}</p>
                </td>
                <td className="text-zinc-500">{formatDate(o.created_at)}</td>
                <td>
                  <StatusBadge status={o.status} />
                </td>
                <td className="text-right font-medium">
                  <Money amount={o.total} currency={o.currency} />
                </td>
              </tr>
            ))}
            {!orders.length && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-zinc-500">
                  No orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={count ?? 0} perPage={PER_PAGE} params={{ status, q }} />
    </>
  );
}
