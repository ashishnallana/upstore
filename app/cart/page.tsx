import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Money } from "@/components/money";
import { CartLines } from "@/components/store/cart-lines";
import { BlockSkeleton, EmptyState } from "@/components/ui/display";
import { getCartLines } from "@/lib/cart";
import { getSettings } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "Cart" };

export default function CartPage() {
  return (
    <div className="container-x py-8">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Your cart</h1>
      <Suspense fallback={<BlockSkeleton />}>
        <CartView />
      </Suspense>
    </div>
  );
}

async function CartView() {
  const [lines, settings] = await Promise.all([getCartLines(), getSettings()]);
  if (!lines.length) {
    return (
      <EmptyState title="Your cart is empty">
        <Link href="/search" className="btn-primary">
          Start shopping
        </Link>
      </EmptyState>
    );
  }

  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const shipping = subtotal >= settings.free_shipping_threshold ? 0 : settings.shipping_fee;
  const blocked = lines.some((l) => !l.available);

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <CartLines lines={lines} />
      </div>
      <aside className="card h-fit space-y-3 p-6">
        <h2 className="font-semibold">Order summary</h2>
        <Row label="Subtotal" value={<Money amount={subtotal} />} />
        <Row label="Shipping" value={shipping ? <Money amount={shipping} /> : "Free"} />
        {shipping > 0 && (
          <p className="text-xs text-zinc-500">
            Add <Money amount={settings.free_shipping_threshold - subtotal} /> more for free shipping.
          </p>
        )}
        <div className="border-t border-zinc-200 pt-3">
          <Row label="Estimated total" value={<Money amount={subtotal + shipping} />} strong />
        </div>
        <p className="text-xs text-zinc-500">Coupons can be applied at checkout.</p>
        {blocked ? (
          <p className="text-sm text-red-600">Fix the highlighted items to continue.</p>
        ) : (
          <Link href="/checkout" className="btn-primary w-full">
            Checkout
          </Link>
        )}
      </aside>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${strong ? "text-base font-semibold" : ""}`}>
      <span className={strong ? "" : "text-zinc-600"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
