import type { Metadata } from "next";
import { Money } from "@/components/money";
import { Badge, PageTitle } from "@/components/ui/display";
import { ActionButton, ActionForm, SubmitButton } from "@/components/ui/form";
import { deleteCoupon, saveCoupon } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Coupon } from "@/lib/types";
import { fromMinor } from "@/lib/utils";

export const metadata: Metadata = { title: "Coupons" };

export default async function AdminCoupons() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
  const coupons = (data ?? []) as Coupon[];

  return (
    <>
      <PageTitle>Coupons</PageTitle>
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="card divide-y divide-zinc-100">
          {coupons.map((c) => (
            <details key={c.id} className="group p-4">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-mono font-semibold">{c.code}</span>
                  <span className="ml-2 text-sm text-zinc-600">
                    {c.discount_type === "percent" ? `${c.value}% off` : <Money amount={c.value} />}
                    {c.min_order > 0 && (
                      <>
                        {" "}
                        · min <Money amount={c.min_order} />
                      </>
                    )}
                  </span>
                </span>
                <span className="flex items-center gap-2 text-sm text-zinc-500">
                  Used {c.used_count}
                  {c.usage_limit ? `/${c.usage_limit}` : ""}
                  <Badge className={c.is_active ? "bg-green-50 text-green-700" : "bg-zinc-100 text-zinc-600"}>{c.is_active ? "Active" : "Off"}</Badge>
                </span>
              </summary>
              <div className="mt-4 space-y-3">
                <CouponForm coupon={c} />
                <ActionButton action={deleteCoupon.bind(null, c.id)} className="btn-ghost text-sm text-red-600" confirm="Delete this coupon?">
                  Delete
                </ActionButton>
              </div>
            </details>
          ))}
          {!coupons.length && <p className="p-6 text-zinc-500">No coupons yet.</p>}
        </div>
        <div className="card h-fit p-5">
          <h2 className="mb-4 font-semibold">New coupon</h2>
          <CouponForm />
        </div>
      </div>
    </>
  );
}

function CouponForm({ coupon }: { coupon?: Coupon }) {
  const day = (iso: string | null) => iso?.slice(0, 10) ?? "";
  return (
    <ActionForm action={saveCoupon} className="grid grid-cols-2 gap-3">
      {coupon && <input type="hidden" name="id" value={coupon.id} />}
      <label className="col-span-2 block">
        <span className="label">Code</span>
        <input name="code" required defaultValue={coupon?.code} className="input font-mono uppercase" />
      </label>
      <label className="col-span-2 block">
        <span className="label">Description</span>
        <input name="description" defaultValue={coupon?.description ?? ""} className="input" />
      </label>
      <label className="block">
        <span className="label">Type</span>
        <select name="discount_type" defaultValue={coupon?.discount_type ?? "percent"} className="input">
          <option value="percent">Percent</option>
          <option value="fixed">Fixed amount</option>
        </select>
      </label>
      <label className="block">
        <span className="label">Value (% or amount)</span>
        <input
          name="value"
          required
          inputMode="decimal"
          defaultValue={coupon ? (coupon.discount_type === "percent" ? coupon.value : fromMinor(coupon.value)) : ""}
          className="input"
        />
      </label>
      <label className="block">
        <span className="label">Min order</span>
        <input name="min_order" inputMode="decimal" defaultValue={fromMinor(coupon?.min_order)} className="input" />
      </label>
      <label className="block">
        <span className="label">Max discount</span>
        <input name="max_discount" inputMode="decimal" defaultValue={fromMinor(coupon?.max_discount)} className="input" />
      </label>
      <label className="block">
        <span className="label">Total uses</span>
        <input name="usage_limit" type="number" min={1} defaultValue={coupon?.usage_limit ?? ""} placeholder="Unlimited" className="input" />
      </label>
      <label className="block">
        <span className="label">Uses per customer</span>
        <input name="per_user_limit" type="number" min={1} defaultValue={coupon?.per_user_limit ?? 1} className="input" />
      </label>
      <label className="block">
        <span className="label">Starts (UTC)</span>
        <input name="starts_at" type="date" defaultValue={day(coupon?.starts_at ?? null)} className="input" />
      </label>
      <label className="block">
        <span className="label">Ends (UTC)</span>
        <input name="ends_at" type="date" defaultValue={day(coupon?.ends_at ?? null)} className="input" />
      </label>
      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_active" defaultChecked={coupon?.is_active ?? true} className="size-4 accent-brand-600" /> Active
      </label>
      <SubmitButton className="btn-primary col-span-2 w-fit">{coupon ? "Save" : "Create coupon"}</SubmitButton>
    </ActionForm>
  );
}
