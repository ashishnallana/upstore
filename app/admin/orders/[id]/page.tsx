import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOrder, OrderDetail } from "@/components/order-detail";
import { PageTitle } from "@/components/ui/display";
import { ActionButton, ActionForm, SubmitButton } from "@/components/ui/form";
import { resendEmail, updateOrderStatus } from "@/lib/actions/admin";
import type { OrderEmailKind } from "@/lib/email/templates";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDate, ORDER_STATUSES } from "@/lib/utils";

export const metadata: Metadata = { title: "Order" };

const EMAIL_LABELS: Record<string, string> = {
  paid: "Order confirmation + invoice",
  admin_new_order: "New order alert (admin)",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default async function AdminOrder({ params }: PageProps<"/admin/orders/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const order = await loadOrder(id);
  if (!order) notFound();
  const supabase = await createClient();
  const [{ data: customer }, { data: emails }] = await Promise.all([
    supabase.from("profiles").select("email,full_name,phone").eq("id", order.user_id).single(),
    supabase.from("email_log").select("id,kind,to_email,status,error,created_at").eq("order_id", order.id).order("created_at"),
  ]);

  return (
    <>
      <Link href="/admin/orders" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Orders
      </Link>
      <PageTitle
        action={
          order.invoice_number && (
            <a href={`/account/orders/${order.id}/invoice`} target="_blank" className="btn-secondary">
              Invoice {order.invoice_number}
            </a>
          )
        }
      >
        Order #{order.order_number}
        <span className="ml-2 text-base font-normal text-zinc-500">{formatDate(order.created_at)}</span>
      </PageTitle>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="card p-5 text-sm">
          <h2 className="mb-2 font-semibold">Customer</h2>
          <p>{customer?.full_name || "—"}</p>
          <p className="text-zinc-600">{customer?.email}</p>
          {customer?.phone && <p className="text-zinc-600">{customer.phone}</p>}
        </div>
        {order.status !== "cancelled" && (
          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Update status</h2>
            <ActionForm action={updateOrderStatus} className="space-y-3">
              <input type="hidden" name="order_id" value={order.id} />
              <select name="status" defaultValue={order.status} className="input">
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input name="note" placeholder="Note, e.g. tracking number (optional)" className="input" />
              <SubmitButton>Update</SubmitButton>
            </ActionForm>
          </div>
        )}
      </div>

      <OrderDetail order={order} productLinks={false} />

      <section className="card mt-6 p-5">
        <h2 className="mb-3 font-semibold">Emails</h2>
        {emails?.length ? (
          <ul className="divide-y divide-zinc-100 text-sm">
            {emails.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">{EMAIL_LABELS[e.kind] ?? e.kind}</span>
                  <span className="text-zinc-500"> → {e.to_email} · {formatDate(e.created_at)}</span>
                  {e.error && <span className="block text-xs text-red-600">{e.error}</span>}
                </span>
                <span className="flex items-center gap-3">
                  <span
                    className={cn(
                      "text-xs font-medium",
                      e.status === "sent" ? "text-green-700" : e.status === "failed" ? "text-red-600" : "text-zinc-500",
                    )}
                  >
                    {e.status}
                  </span>
                  <ActionButton action={resendEmail.bind(null, order.id, e.kind as OrderEmailKind)} className="text-xs text-brand-600 hover:underline">
                    Resend
                  </ActionButton>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">No emails sent for this order yet.</p>
        )}
      </section>
    </>
  );
}
