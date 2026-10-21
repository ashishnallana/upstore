/** Join class names, skipping falsy values. */
export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/** Format integer minor units (amount * 100) in the given currency. */
export function formatMoney(minor: number, currency = "INR", locale = "en-IN") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(minor / 100);
}

/** Parse a user-entered major amount ("499.50") into minor units. */
export function toMinor(value: FormDataEntryValue | null): number | null {
  const n = Number(String(value ?? "").trim());
  return value === null || String(value).trim() === "" || !Number.isFinite(n) || n < 0 ? null : Math.round(n * 100);
}

export function fromMinor(minor: number | null | undefined) {
  return minor == null ? "" : (minor / 100).toFixed(2);
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatDate(iso: string, locale = "en-IN") {
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

/** Only allow same-site relative redirects. */
export function safeNext(next: FormDataEntryValue | string | null | undefined, fallback = "/account") {
  const s = String(next ?? "");
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
}

export function str(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

export function discountPercent(price: number, compareAt: number | null) {
  return compareAt && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : 0;
}

/** Every combination of option values, in option order. */
export function variantCombos(options: { name: string; values: string[] }[]): Record<string, string>[] {
  return options.reduce<Record<string, string>[]>(
    (acc, opt) => acc.flatMap((combo) => opt.values.map((v) => ({ ...combo, [opt.name]: v }))),
    [{}],
  );
}

export function comboTitle(options: { name: string }[], combo: Record<string, string>) {
  return options.map((o) => combo[o.name]).join(" / ") || "Default";
}

export const ORDER_STATUSES = ["pending", "paid", "processing", "shipped", "delivered", "cancelled"] as const;
