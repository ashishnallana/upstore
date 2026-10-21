import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AddressFields } from "@/components/address-fields";
import { CartLines } from "@/components/store/cart-lines";
import { CheckoutForm } from "@/components/store/checkout-form";
import { BlockSkeleton } from "@/components/ui/display";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { saveAddress } from "@/lib/actions/account";
import { requireUser } from "@/lib/auth";
import { getCartLines } from "@/lib/cart";
import { getSettings } from "@/lib/data/catalog";
import { createClient } from "@/lib/supabase/server";
import type { Address } from "@/lib/types";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return (
    <div className="container-x py-8">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Checkout</h1>
      <Suspense fallback={<BlockSkeleton className="h-96" />}>
        <CheckoutView />
      </Suspense>
    </div>
  );
}

async function CheckoutView() {
  await requireUser("/checkout");
  const supabase = await createClient();
  const [lines, settings, { data }] = await Promise.all([
    getCartLines(),
    getSettings(),
    supabase.from("addresses").select("*").order("is_default", { ascending: false }).order("created_at"),
  ]);
  if (!lines.length || lines.some((l) => !l.available)) redirect("/cart");
  const addresses = (data ?? []) as Address[];
  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);

  return (
    <div className="grid gap-8 lg:grid-cols-5">
      <div className="lg:col-span-3">
        {addresses.length ? (
          <CheckoutForm addresses={addresses} subtotal={subtotal} settings={settings} />
        ) : (
          <div className="card p-5">
            <h2 className="mb-4 font-semibold">Add a shipping address</h2>
            <ActionForm action={saveAddress} className="space-y-4">
              <AddressFields address={{ is_default: true }} />
              <SubmitButton>Save address</SubmitButton>
            </ActionForm>
          </div>
        )}
      </div>
      <aside className="lg:col-span-2">
        <div className="card p-5">
          <h2 className="font-semibold">Items</h2>
          <CartLines lines={lines} editable={false} />
        </div>
      </aside>
    </div>
  );
}
