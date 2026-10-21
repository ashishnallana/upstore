import type { Metadata } from "next";
import Link from "next/link";
import { Money } from "@/components/money";
import { EmptyState, PageTitle, StatusBadge } from "@/components/ui/display";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "My orders" };

type Row = Pick<Order, "id" | "order_number" | "status" | "total" | "currency" | "created_at"> & {
  order_items: { product_name: string; quantity: number }[];
};

export default async function OrdersPage() {
  await requireUser("/account/orders");
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id,order_number,status,total,currency,created_at,order_items(product_name,quantity)")
    .order("created_at", { ascending: false })
    .limit(100);
  const orders = (data ?? []) as Row[];

  return (
    <>
      <PageTitle>Orders</PageTitle>
      {orders.length ? (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/account/orders/${o.id}`} className="card flex flex-wrap items-center justify-between gap-4 p-5 transition hover:border-brand-500">
                <div className="min-w-0">
                  <p className="font-medium">
                    Order #{o.order_number} <span className="ml-1 text-sm font-normal text-zinc-500">· {formatDate(o.created_at)}</span>
                  </p>
                  <p className="mt-1 truncate text-sm text-zinc-600">
                    {o.order_items.map((i) => `${i.product_name}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`).join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <StatusBadge status={o.status} />
                  <span className="font-semibold">
                    <Money amount={o.total} currency={o.currency} />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No orders yet">
          <Link href="/search" className="btn-primary">
            Start shopping
          </Link>
        </EmptyState>
      )}
    </>
  );
}
