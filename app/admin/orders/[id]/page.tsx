import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOrder, OrderDetail } from "@/components/order-detail";
import { PageTitle } from "@/components/ui/display";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { updateOrderStatus } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, ORDER_STATUSES } from "@/lib/utils";

export const metadata: Metadata = { title: "Order" };

export default async function AdminOrder({ params }: PageProps<"/admin/orders/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const order = await loadOrder(id);
  if (!order) notFound();
  const supabase = await createClient();
  const { data: customer } = await supabase.from("profiles").select("email,full_name,phone").eq("id", order.user_id).single();

  return (
    <>
      <Link href="/admin/orders" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Orders
      </Link>
      <PageTitle>
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
    </>
  );
}
