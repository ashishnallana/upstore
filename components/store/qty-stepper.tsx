"use client";

import { useTransition } from "react";
import { updateCartQuantity } from "@/lib/actions/store";
import { cn } from "@/lib/utils";

export function QtyStepper({ variantId, quantity, max }: { variantId: string; quantity: number; max: number }) {
  const [pending, start] = useTransition();
  const set = (q: number) => start(() => updateCartQuantity(variantId, q));
  return (
    <div className={cn("flex items-center gap-3", pending && "opacity-50")}>
      <div className="flex items-center rounded-lg border border-zinc-300">
        <button type="button" disabled={pending} onClick={() => set(quantity - 1)} className="px-2.5 py-1" aria-label="Decrease quantity">
          −
        </button>
        <span className="w-7 text-center text-sm">{quantity}</span>
        <button
          type="button"
          disabled={pending || quantity >= Math.min(max, 99)}
          onClick={() => set(quantity + 1)}
          className="px-2.5 py-1 disabled:opacity-30"
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>
      <button type="button" disabled={pending} onClick={() => set(0)} className="text-sm text-zinc-500 hover:text-red-600">
        Remove
      </button>
    </div>
  );
}
