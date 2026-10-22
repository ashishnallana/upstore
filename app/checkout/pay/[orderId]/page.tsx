import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Money } from "@/components/money";
import { BlockSkeleton } from "@/components/ui/display";
import { SubmitButton } from "@/components/ui/form";
import { payOrder, startPayment } from "@/lib/actions/store";
import { getPaymentProvider } from "@/lib/payments";
import { reconcilePayment } from "@/lib/payments/reconcile";
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

/** Pay (or retry paying) for a pending order with the configured provider. */
async function PayView({ params, searchParams }: PageProps<"/checkout/pay/[orderId]">) {
  const [{ orderId }, sp] = await Promise.all([params, searchParams]);
  // Catches payments that succeeded while the customer was away (e.g. closed the gateway tab).
  const status = await reconcilePayment(orderId);
  if (!status) notFound();
  if (status !== "pending") redirect(`/account/orders/${orderId}`);

  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("id,order_number,total,currency").eq("id", orderId).single();
  if (!order) notFound();
  const error = typeof sp.error === "string" ? sp.error : null;
  const isFake = getPaymentProvider().id === "fake";

  return (
    <div className="card p-8 text-center">
      {isFake && (
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">Test payment</span>
      )}
      <h1 className="mt-4 text-2xl font-bold">Order #{order.order_number}</h1>
      <p className="mt-2 text-zinc-600">Amount due</p>
      <p className="text-4xl font-bold">
        <Money amount={order.total} currency={order.currency} />
      </p>
      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {isFake ? (
        <>
          <form action={payOrder} className="mt-8 grid gap-3">
            <input type="hidden" name="order_id" value={order.id} />
            <SubmitButton name="outcome" value="success" className="btn-primary py-3">
              Pay now (simulate success)
            </SubmitButton>
            <SubmitButton name="outcome" value="failure" className="btn-secondary">
              Simulate failed payment
            </SubmitButton>
          </form>
          <p className="mt-6 text-xs text-zinc-500">No real money is charged. Set PAYMENT_PROVIDER to use a real gateway.</p>
        </>
      ) : (
        <>
          <form action={startPayment} className="mt-8 grid">
            <input type="hidden" name="order_id" value={order.id} />
            <SubmitButton className="btn-primary py-3" pendingText="Opening secure checkout…">
              {error ? "Try again" : "Pay now"}
            </SubmitButton>
          </form>
          <p className="mt-6 text-xs text-zinc-500">You&apos;ll be taken to our secure UPI checkout and brought back here afterwards.</p>
        </>
      )}
    </div>
  );
}
