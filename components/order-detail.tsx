import Image from "next/image";
import Link from "next/link";
import { AddressText } from "@/components/address-fields";
import { Money } from "@/components/money";
import { StatusBadge } from "@/components/ui/display";
import { createClient } from "@/lib/supabase/server";
import type { Order, OrderEvent, OrderItem, PaymentStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export type FullOrder = Order & {
  order_items: OrderItem[];
  order_events: OrderEvent[];
  payments: { id: string; provider: string; provider_ref: string | null; status: PaymentStatus; amount: number; created_at: string }[];
};

/** Loads an order with items, events and payments. RLS decides visibility. */
export async function loadOrder(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("*,order_items(*),order_events(id,status,note,created_at),payments(id,provider,provider_ref,status,amount,created_at)")
    .eq("id", id)
    .order("created_at", { referencedTable: "order_events" })
    .order("created_at", { referencedTable: "payments" })
    .maybeSingle();
  return data as FullOrder | null;
}

export function OrderDetail({ order, productLinks = true }: { order: FullOrder; productLinks?: boolean }) {
  const money = (n: number) => <Money amount={n} currency={order.currency} />;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Items</h2>
            <StatusBadge status={order.status} />
          </div>
          <ul className="divide-y divide-zinc-200">
            {order.order_items.map((i) => (
              <li key={i.id} className="flex gap-4 py-3">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                  {i.image_url && <Image src={i.image_url} alt="" fill sizes="64px" className="object-cover" />}
                </div>
                <div className="flex-1 text-sm">
                  {productLinks && i.product_slug ? (
                    <Link href={`/p/${i.product_slug}`} className="font-medium hover:text-brand-600">
                      {i.product_name}
                    </Link>
                  ) : (
                    <p className="font-medium">{i.product_name}</p>
                  )}
                  {i.variant_title && <p className="text-zinc-500">{i.variant_title}</p>}
                  <p className="text-zinc-500">
                    {money(i.unit_price)} × {i.quantity}
                  </p>
                </div>
                <p className="text-sm font-medium">{money(i.line_total)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 border-t border-zinc-200 pt-4 text-sm">
            <Line label="Subtotal">{money(order.subtotal)}</Line>
            {order.discount > 0 && <Line label={`Discount${order.coupon_code ? ` (${order.coupon_code})` : ""}`}>−{money(order.discount)}</Line>}
            <Line label="Shipping">{order.shipping ? money(order.shipping) : "Free"}</Line>
            <div className="flex justify-between pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd>{money(order.total)}</dd>
            </div>
          </dl>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Timeline</h2>
          <ol className="space-y-3 border-l-2 border-zinc-200 pl-5">
            {order.order_events.map((e) => (
              <li key={e.id} className="relative text-sm">
                <span className="absolute -left-[27px] top-1 size-3 rounded-full border-2 border-white bg-brand-500" />
                <p className="font-medium capitalize">{e.status === "pending" ? "Order placed" : e.status}</p>
                {e.note && <p className="text-zinc-600">{e.note}</p>}
                <p className="text-xs text-zinc-500">{new Date(e.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <aside className="space-y-6">
        <section className="card p-5">
          <h2 className="mb-2 font-semibold">Shipping address</h2>
          <AddressText a={order.shipping_address} />
        </section>
        <section className="card p-5">
          <h2 className="mb-2 font-semibold">Payment</h2>
          {order.payments.length ? (
            <ul className="space-y-2 text-sm">
              {order.payments.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span className="text-zinc-600">
                    {p.provider_ref ?? p.provider} · {formatDate(p.created_at)}
                  </span>
                  <span className={p.status === "succeeded" ? "text-green-700" : p.status === "failed" ? "text-red-600" : "text-zinc-600"}>
                    {p.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No payment yet.</p>
          )}
        </section>
        {order.notes && (
          <section className="card p-5">
            <h2 className="mb-2 font-semibold">Notes</h2>
            <p className="text-sm text-zinc-600">{order.notes}</p>
          </section>
        )}
      </aside>
    </div>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <dt className="text-zinc-600">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
