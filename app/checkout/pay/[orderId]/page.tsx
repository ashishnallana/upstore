import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Money } from "@/components/money";
import { BlockSkeleton } from "@/components/ui/display";
import { SubmitButton } from "@/components/ui/form";
import { payOrder } from "@/lib/actions/store";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Payment" };

export default function PayPage(props: PageProps<"/checkout/pay/[orderId]">) {
  return (
    <div className="container-x max-w-lg py-12">
      <Suspense fallback={<BlockSkeleton />}>
        <PayView {...props} />
      </Suspense>
    </div>
  );
}

/** Stand-in for a hosted payment page. Replace via lib/payments when going live. */
async function PayView({ params, searchParams }: PageProps<"/checkout/pay/[orderId]">) {
  const [{ orderId }, sp] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("id,order_number,status,total,currency").eq("id", orderId).maybeSingle();
  if (!order) notFound();
  if (order.status !== "pending") redirect(`/account/orders/${order.id}`);
  const error = typeof sp.error === "string" ? sp.error : null;

  return (
    <div className="card p-8 text-center">
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">Test payment</span>
      <h1 className="mt-4 text-2xl font-bold">Order #{order.order_number}</h1>
      <p className="mt-2 text-zinc-600">Amount due</p>
      <p className="text-4xl font-bold">
        <Money amount={order.total} currency={order.currency} />
      </p>
      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <form action={payOrder} className="mt-8 grid gap-3">
        <input type="hidden" name="order_id" value={order.id} />
        <SubmitButton name="outcome" value="success" className="btn-primary py-3">
          Pay now (simulate success)
        </SubmitButton>
        <SubmitButton name="outcome" value="failure" className="btn-secondary">
          Simulate failed payment
        </SubmitButton>
      </form>
      <p className="mt-6 text-xs text-zinc-500">No real money is charged. This page is replaced when a real payment gateway is connected.</p>
    </div>
  );
}
