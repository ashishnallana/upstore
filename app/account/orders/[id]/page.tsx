import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOrder, OrderDetail } from "@/components/order-detail";
import { PageTitle } from "@/components/ui/display";
import { ActionButton } from "@/components/ui/form";
import { cancelOrder } from "@/lib/actions/store";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Order details" };

export default async function OrderPage({ params, searchParams }: PageProps<"/account/orders/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const order = await loadOrder(id);
  if (!order) notFound();

  return (
    <>
      <Link href="/account/orders" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← All orders
      </Link>
      {sp.placed && (
        <div className="my-4 rounded-xl bg-green-50 p-4 text-green-800">
          <p className="font-semibold">Thank you! Your order is confirmed.</p>
          <p className="text-sm">We&apos;ll keep this page updated as it ships.</p>
        </div>
      )}
      <PageTitle
        action={
          <div className="flex gap-2">
            {order.status === "pending" && (
              <Link href={`/checkout/pay/${order.id}`} className="btn-primary">
                Complete payment
              </Link>
            )}
            {(order.status === "pending" || order.status === "paid") && (
              <ActionButton action={cancelOrder.bind(null, order.id)} confirm="Cancel this order?" className="btn-secondary text-red-600">
                Cancel order
              </ActionButton>
            )}
          </div>
        }
      >
        Order #{order.order_number}
        <span className="ml-2 text-base font-normal text-zinc-500">{formatDate(order.created_at)}</span>
      </PageTitle>
      <OrderDetail order={order} />
    </>
  );
}
