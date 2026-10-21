"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { addToCart } from "@/lib/actions/store";
import type { ActionState, ProductOption } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface BuyVariant {
  id: string;
  option_values: Record<string, string>;
  stock: number;
  price: string;
  compareAt: string | null;
}

export function BuyBox({ options, variants }: { options: ProductOption[]; variants: BuyVariant[] }) {
  const initial = variants.find((v) => v.stock > 0) ?? variants[0];
  const [selected, setSelected] = useState<Record<string, string>>(initial?.option_values ?? {});
  const [qty, setQty] = useState(1);
  const [result, setResult] = useState<ActionState>();
  const [pending, start] = useTransition();

  const variant = useMemo(
    () => variants.find((v) => options.every((o) => v.option_values[o.name] === selected[o.name])),
    [variants, options, selected],
  );

  // A value is available if some in-stock variant has it alongside the other current choices.
  const available = (name: string, value: string) =>
    variants.some(
      (v) => v.stock > 0 && v.option_values[name] === value && options.every((o) => o.name === name || v.option_values[o.name] === selected[o.name]),
    );

  const max = Math.min(variant?.stock ?? 0, 99);

  return (
    <div className="space-y-6">
      <p className="flex items-baseline gap-3">
        <span className="text-3xl font-bold">{variant?.price ?? "—"}</span>
        {variant?.compareAt && <span className="text-lg text-zinc-400 line-through">{variant.compareAt}</span>}
      </p>

      {options.map((o) => (
        <fieldset key={o.name}>
          <legend className="label">
            {o.name}: <span className="font-normal text-zinc-600">{selected[o.name]}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {o.values.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setSelected((s) => ({ ...s, [o.name]: value }));
                  setResult(undefined);
                  setQty(1);
                }}
                className={cn(
                  "min-w-12 rounded-lg border px-3 py-2 text-sm transition",
                  selected[o.name] === value ? "border-brand-600 bg-brand-50 text-brand-700" : "border-zinc-300 hover:border-zinc-500",
                  !available(o.name, value) && "text-zinc-400 line-through",
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </fieldset>
      ))}

      <p className={cn("text-sm font-medium", max > 0 ? "text-green-700" : "text-red-600")}>
        {!variant ? "Unavailable" : max <= 0 ? "Out of stock" : variant.stock <= 5 ? `Only ${variant.stock} left` : "In stock"}
      </p>

      <div className="flex gap-3">
        <div className="flex items-center rounded-lg border border-zinc-300">
          <button type="button" className="px-3 py-2.5" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
            −
          </button>
          <span className="w-8 text-center text-sm" aria-live="polite">
            {qty}
          </span>
          <button type="button" className="px-3 py-2.5" onClick={() => setQty((q) => Math.min(max, q + 1))} aria-label="Increase quantity">
            +
          </button>
        </div>
        <button
          type="button"
          className="btn-primary flex-1"
          disabled={!variant || max <= 0 || pending}
          onClick={() => start(async () => setResult(await addToCart(variant!.id, qty)))}
        >
          {pending ? "Adding…" : "Add to cart"}
        </button>
      </div>

      {result && (
        <p className={cn("text-sm", result.error ? "text-red-600" : "text-green-700")}>
          {result.error ?? result.ok}
          {result.ok && (
            <Link href="/cart" className="ml-2 font-medium underline">
              View cart
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
