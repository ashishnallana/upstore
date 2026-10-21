import Image from "next/image";
import Link from "next/link";
import { Money } from "@/components/money";
import { QtyStepper } from "@/components/store/qty-stepper";
import type { CartLine } from "@/lib/types";

export function CartLines({ lines, editable = true }: { lines: CartLine[]; editable?: boolean }) {
  return (
    <ul className="divide-y divide-zinc-200">
      {lines.map((l) => (
        <li key={l.variantId} className="flex gap-4 py-4">
          <Link href={`/p/${l.slug}`} className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-zinc-100 sm:size-24">
            {l.image && <Image src={l.image} alt={l.productName} fill sizes="96px" className="object-cover" />}
          </Link>
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex justify-between gap-4">
              <div>
                <Link href={`/p/${l.slug}`} className="font-medium hover:text-brand-600">
                  {l.productName}
                </Link>
                {l.variantTitle && <p className="text-sm text-zinc-500">{l.variantTitle}</p>}
              </div>
              <p className="font-medium">
                <Money amount={l.price * l.quantity} />
              </p>
            </div>
            {!l.available && (
              <p className="text-sm text-red-600">{l.stock > 0 ? `Only ${l.stock} available — reduce quantity` : "No longer available"}</p>
            )}
            {editable ? (
              <div className="mt-auto">
                <QtyStepper variantId={l.variantId} quantity={l.quantity} max={l.stock} />
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Qty {l.quantity}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
