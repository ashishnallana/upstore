import { getSettings } from "@/lib/data/catalog";
import { formatMoney } from "@/lib/utils";

/** Formats minor units in the store currency (or an explicit one, e.g. a past order's). */
export async function Money({ amount, currency }: { amount: number; currency?: string }) {
  const s = await getSettings();
  return <>{formatMoney(amount, currency ?? s.currency, s.locale)}</>;
}

/** Bound formatter for passing pre-formatted strings into Client Components. */
export async function getFormatter() {
  const s = await getSettings();
  return (amount: number) => formatMoney(amount, s.currency, s.locale);
}
