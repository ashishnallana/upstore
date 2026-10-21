import type { Metadata } from "next";
import { PageTitle } from "@/components/ui/display";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { saveSettings } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { StoreSettings } from "@/lib/types";
import { formatMoney, fromMinor } from "@/lib/utils";

export const metadata: Metadata = { title: "Settings" };

const CURRENCIES = [
  ["INR", "Indian Rupee", "en-IN"],
  ["USD", "US Dollar", "en-US"],
  ["EUR", "Euro", "de-DE"],
  ["GBP", "British Pound", "en-GB"],
  ["AED", "UAE Dirham", "en-AE"],
  ["AUD", "Australian Dollar", "en-AU"],
  ["CAD", "Canadian Dollar", "en-CA"],
  ["SGD", "Singapore Dollar", "en-SG"],
  ["JPY", "Japanese Yen", "ja-JP"],
] as const;

export default async function AdminSettings() {
  await requireAdmin();
  // Read fresh (not the cached copy) so the form always shows what's saved.
  const supabase = await createClient();
  const { data } = await supabase.from("store_settings").select("*").single();
  const s = data as StoreSettings;

  return (
    <>
      <PageTitle>Store settings</PageTitle>
      <div className="card max-w-xl p-6">
        <ActionForm action={saveSettings} className="space-y-4">
          <label className="block">
            <span className="label">Store name</span>
            <input name="store_name" defaultValue={s.store_name} className="input" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label">Currency</span>
              <select name="currency" defaultValue={s.currency} className="input">
                {CURRENCIES.map(([code, name]) => (
                  <option key={code} value={code}>
                    {code} — {name}
                  </option>
                ))}
                {!CURRENCIES.some(([c]) => c === s.currency) && <option value={s.currency}>{s.currency}</option>}
              </select>
            </label>
            <label className="block">
              <span className="label">Number format (locale)</span>
              <input name="locale" defaultValue={s.locale} list="locales" className="input" />
              <datalist id="locales">
                {CURRENCIES.map(([code, , locale]) => (
                  <option key={code} value={locale} />
                ))}
              </datalist>
            </label>
          </div>
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Changing currency relabels all prices; it does not convert them. Past orders keep the currency they were placed in.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label">Shipping fee</span>
              <input name="shipping_fee" inputMode="decimal" defaultValue={fromMinor(s.shipping_fee)} className="input" />
            </label>
            <label className="block">
              <span className="label">Free shipping from</span>
              <input name="free_shipping_threshold" inputMode="decimal" defaultValue={fromMinor(s.free_shipping_threshold)} className="input" />
            </label>
          </div>
          <p className="text-sm text-zinc-500">Preview: {formatMoney(123456, s.currency, s.locale)}</p>
          <SubmitButton>Save settings</SubmitButton>
        </ActionForm>
      </div>
    </>
  );
}
