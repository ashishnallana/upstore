"use client";

import { useActionState, useState, useTransition } from "react";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { placeOrder, previewCoupon } from "@/lib/actions/store";
import type { Address, StoreSettings } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

export function CheckoutForm({ addresses, subtotal, settings }: { addresses: Address[]; subtotal: number; settings: StoreSettings }) {
  const [state, action] = useActionState(placeOrder, undefined);
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number }>();
  const [couponError, setCouponError] = useState<string>();
  const [checking, start] = useTransition();
  const fmt = (n: number) => formatMoney(n, settings.currency, settings.locale);

  const discount = coupon?.discount ?? 0;
  const shipping = subtotal - discount >= settings.free_shipping_threshold ? 0 : settings.shipping_fee;
  const total = subtotal - discount + shipping;

  const apply = () =>
    start(async () => {
      const res = await previewCoupon(code, subtotal);
      if (res.error) {
        setCoupon(undefined);
        setCouponError(res.error);
      } else {
        setCoupon({ code: code.trim().toUpperCase(), discount: res.discount ?? 0 });
        setCouponError(undefined);
      }
    });

  return (
    <form action={action} className="space-y-6">
      <fieldset className="card p-5">
        <legend className="px-1 font-semibold">Ship to</legend>
        <div className="mt-2 space-y-2">
          {addresses.map((a) => (
            <label key={a.id} className="flex cursor-pointer gap-3 rounded-lg border border-zinc-200 p-3 has-checked:border-brand-500 has-checked:bg-brand-50">
              <input type="radio" name="address_id" value={a.id} defaultChecked={a.is_default} required className="mt-1 accent-brand-600" />
              <span className="text-sm">
                <span className="font-medium">{a.label ? `${a.label} — ` : ""}{a.full_name}</span>
                <br />
                <span className="text-zinc-600">
                  {a.line1}, {a.city}, {a.state} {a.postal_code}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="card space-y-3 p-5">
        <label className="label" htmlFor="coupon-input">
          Coupon code
        </label>
        <div className="flex gap-2">
          <input
            id="coupon-input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), apply())}
            className="input uppercase"
            placeholder="WELCOME10"
          />
          <button type="button" onClick={apply} disabled={!code.trim() || checking} className="btn-secondary">
            {checking ? "Checking…" : "Apply"}
          </button>
        </div>
        {coupon && (
          <p className="flex items-center justify-between text-sm text-green-700">
            {coupon.code} applied
            <button type="button" className="text-zinc-500 underline" onClick={() => setCoupon(undefined)}>
              Remove
            </button>
          </p>
        )}
        {couponError && <p className="text-sm text-red-600">{couponError}</p>}
        <input type="hidden" name="coupon" value={coupon?.code ?? ""} />
        <label className="block">
          <span className="label">Order notes (optional)</span>
          <textarea name="notes" rows={2} maxLength={500} className="input" />
        </label>
      </div>

      <div className="card space-y-2 p-5 text-sm">
        <Row label="Subtotal" value={fmt(subtotal)} />
        {discount > 0 && <Row label="Discount" value={`−${fmt(discount)}`} />}
        <Row label="Shipping" value={shipping ? fmt(shipping) : "Free"} />
        <div className="flex justify-between border-t border-zinc-200 pt-3 text-base font-semibold">
          <span>Total</span>
          <span>{fmt(total)}</span>
        </div>
        <SubmitButton className="btn-primary mt-3 w-full py-3" pendingText="Placing order…">
          Place order &amp; pay
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-600">{label}</span>
      <span>{value}</span>
    </div>
  );
}
