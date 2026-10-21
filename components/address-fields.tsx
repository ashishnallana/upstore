import type { Address } from "@/lib/types";

export function AddressFields({ address }: { address?: Partial<Address> }) {
  const field = (name: keyof Address, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="label">{label}</span>
      <input name={name} defaultValue={(address?.[name] as string) ?? ""} className="input" {...props} />
    </label>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {address?.id && <input type="hidden" name="id" value={address.id} />}
      {field("full_name", "Full name", { required: true, autoComplete: "name" })}
      {field("phone", "Phone", { required: true, type: "tel", autoComplete: "tel" })}
      <div className="sm:col-span-2">{field("line1", "Address line 1", { required: true, autoComplete: "address-line1" })}</div>
      <div className="sm:col-span-2">{field("line2", "Address line 2 (optional)", { autoComplete: "address-line2" })}</div>
      {field("city", "City", { required: true, autoComplete: "address-level2" })}
      {field("state", "State", { required: true, autoComplete: "address-level1" })}
      {field("postal_code", "PIN / Postal code", { required: true, autoComplete: "postal-code" })}
      {field("country", "Country", { autoComplete: "country-name", placeholder: "India" })}
      {field("label", "Label (Home, Work…)")}
      <label className="flex items-center gap-2 self-end py-2 text-sm">
        <input type="checkbox" name="is_default" defaultChecked={address?.is_default} className="size-4 accent-brand-600" />
        Use as default address
      </label>
    </div>
  );
}

export function AddressText({ a }: { a: Omit<Address, "id" | "is_default" | "label"> }) {
  return (
    <p className="text-sm leading-relaxed text-zinc-600">
      <span className="font-medium text-zinc-900">{a.full_name}</span> · {a.phone}
      <br />
      {a.line1}
      {a.line2 && `, ${a.line2}`}
      <br />
      {a.city}, {a.state} {a.postal_code}, {a.country}
    </p>
  );
}
