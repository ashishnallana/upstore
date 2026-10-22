import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { BlockSkeleton } from "@/components/ui/display";
import { reconcilePayment } from "@/lib/payments/reconcile";

export const metadata: Metadata = { title: "Confirming payment" };

/** Where the payment gateway sends the customer back after a successful payment. */
export default function ReturnPage({ searchParams }: PageProps<"/checkout/return">) {
  return (
    <div className="container-x max-w-lg py-12">
      <Suspense fallback={<BlockSkeleton />}>
        <ReturnView searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ReturnView({ searchParams }: Pick<PageProps<"/checkout/return">, "searchParams">) {
  const orderId = String((await searchParams).order ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) redirect("/account/orders");

  const status = await reconcilePayment(orderId);
  if (!status) redirect("/account/orders");
  if (status === "cancelled") redirect(`/account/orders/${orderId}`);
  if (status !== "pending") redirect(`/account/orders/${orderId}?placed=1`);

  return (
    <div className="card p-8 text-center">
      <AutoRefresh />
      <div className="mx-auto size-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
      <h1 className="mt-6 text-2xl font-bold">Confirming your payment…</h1>
      <p className="mt-2 text-zinc-600">This usually takes a few seconds. You can keep this page open; it updates by itself.</p>
      <Link href={`/account/orders/${orderId}`} className="btn-secondary mt-8">
        View order
      </Link>
    </div>
  );
}
