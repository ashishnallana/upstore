import type { Metadata } from "next";
import { PageTitle } from "@/components/ui/display";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { saveSettings, sendTestEmail } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { mailConfigured } from "@/lib/email/mailer";
import type { SellerSettings } from "@/lib/types";
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
  const me = await requireAdmin();
  // Read fresh (not the cached copy) so the form always shows what's saved.
  const supabase = await createClient();
  const { data } = await supabase.from("store_settings").select("*").single();
  const s = data as SellerSettings;
  const smtp = mailConfigured();

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

          <h2 className="border-t border-zinc-200 pt-5 font-semibold">Invoices &amp; emails</h2>
          <p className="text-sm text-zinc-500">Printed on PDF invoices and in the footer of order emails.</p>
          <label className="block">
            <span className="label">Legal business name</span>
            <input name="legal_name" defaultValue={s.legal_name ?? ""} placeholder={s.store_name} className="input" />
          </label>
          <label className="block">
            <span className="label">Business address</span>
            <textarea name="address" rows={3} defaultValue={s.address ?? ""} className="input" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label">GSTIN (optional)</span>
              <input name="gstin" defaultValue={s.gstin ?? ""} maxLength={15} className="input uppercase" />
            </label>
            <label className="block">
              <span className="label">Support email (reply-to)</span>
              <input name="support_email" type="email" defaultValue={s.support_email ?? ""} className="input" />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label">Invoice number prefix</span>
              <input name="invoice_prefix" defaultValue={s.invoice_prefix} maxLength={12} className="input" />
            </label>
          </div>
          <label className="block">
            <span className="label">Invoice notes</span>
            <textarea name="invoice_notes" rows={2} defaultValue={s.invoice_notes ?? ""} className="input" />
          </label>
          <p className="text-xs text-zinc-500">The prefix applies to new invoices; issued invoice numbers never change.</p>
          <SubmitButton>Save settings</SubmitButton>
        </ActionForm>
      </div>

      <div className="card mt-6 max-w-xl p-6">
        <h2 className="font-semibold">Email delivery</h2>
        <p className={`mt-1 text-sm ${smtp ? "text-green-700" : "text-amber-700"}`}>
          {smtp
            ? `SMTP is configured (${process.env.SMTP_HOST || "smtp.gmail.com"}). Order emails are sent automatically.`
            : "SMTP isn't configured: order emails are logged as skipped. Set SMTP_USER and SMTP_PASS (see README)."}
        </p>
        <ActionForm action={sendTestEmail} className="mt-4 flex flex-wrap items-end gap-2">
          <label className="block flex-1">
            <span className="label">Send a test email to</span>
            <input name="to" type="email" required defaultValue={me.email ?? ""} className="input" />
          </label>
          <SubmitButton className="btn-secondary">Send test</SubmitButton>
        </ActionForm>
      </div>
    </>
  );
}
