"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { uploadImage } from "@/components/image-upload";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { saveProduct } from "@/lib/actions/admin";
import type { Product, ProductOption } from "@/lib/types";
import { comboTitle, fromMinor, slugify, variantCombos } from "@/lib/utils";

interface Row {
  id?: string;
  title: string;
  option_values: Record<string, string>;
  sku: string;
  price: string;
  compare_at_price: string;
  stock: string;
  is_active: boolean;
}

type Draft = { name: string; values: string };

const parseOptions = (drafts: Draft[]): ProductOption[] =>
  drafts
    .map((d) => ({ name: d.name.trim(), values: [...new Set(d.values.split(",").map((v) => v.trim()).filter(Boolean))] }))
    .filter((o) => o.name && o.values.length);

/** Rebuild the variant grid for new options, keeping data for combos that still exist. */
function regenerate(options: ProductOption[], rows: Row[]): Row[] {
  const byTitle = new Map(rows.map((r) => [comboTitle(options, r.option_values), r]));
  const fallback = rows[0];
  return variantCombos(options).map((combo) => {
    const title = comboTitle(options, combo);
    const prev = byTitle.get(title) ?? (options.length === 0 ? fallback : undefined);
    return prev
      ? { ...prev, title, option_values: combo }
      : { title, option_values: combo, sku: "", price: fallback?.price ?? "", compare_at_price: fallback?.compare_at_price ?? "", stock: "0", is_active: true };
  });
}

export function ProductForm({
  product,
  categories,
  currency,
}: {
  product?: Product;
  categories: { id: string; label: string }[];
  currency: string;
}) {
  const [state, action] = useActionState(saveProduct, undefined);
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [drafts, setDrafts] = useState<Draft[]>((product?.options ?? []).map((o) => ({ name: o.name, values: o.values.join(", ") })));
  const [options, setOptions] = useState<ProductOption[]>(product?.options ?? []);
  const [rows, setRows] = useState<Row[]>(
    product?.variants.length
      ? product.variants.map((v) => ({
          id: v.id,
          title: v.title,
          option_values: v.option_values,
          sku: v.sku ?? "",
          price: fromMinor(v.price),
          compare_at_price: fromMinor(v.compare_at_price),
          stock: String(v.stock),
          is_active: v.is_active,
        }))
      : regenerate([], []),
  );
  const [images, setImages] = useState(product?.images.map((i) => ({ url: i.url, alt: i.alt ?? "" })) ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>();

  const commitOptions = (next: Draft[]) => {
    setDrafts(next);
    const parsed = parseOptions(next);
    setOptions(parsed);
    setRows((r) => regenerate(parsed, r));
  };
  const updateRow = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  return (
    <form action={action} className="space-y-6">
      {product && <input type="hidden" name="id" value={product.id} />}
      <input type="hidden" name="options" value={JSON.stringify(options)} />
      <input type="hidden" name="variants" value={JSON.stringify(rows)} />
      <input type="hidden" name="images" value={JSON.stringify(images)} />

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="label">Name</span>
          <input
            name="name"
            required
            value={name}
            onChange={(e) => {
              if (!product && slug === slugify(name)) setSlug(slugify(e.target.value));
              setName(e.target.value);
            }}
            className="input"
          />
        </label>
        <label className="block">
          <span className="label">URL slug</span>
          <input name="slug" value={slug} onChange={(e) => setSlug(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="label">Brand</span>
          <input name="brand" defaultValue={product?.brand ?? ""} className="input" />
        </label>
        <label className="block sm:col-span-2">
          <span className="label">Category</span>
          <select name="category_id" defaultValue={product?.category_id ?? ""} className="input">
            <option value="">— None —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="label">Description</span>
          <textarea name="description" rows={5} defaultValue={product?.description ?? ""} className="input" />
        </label>
        <div className="flex gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="is_active" defaultChecked={product?.is_active ?? true} className="size-4 accent-brand-600" /> Active (visible)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="is_featured" defaultChecked={product?.is_featured} className="size-4 accent-brand-600" /> Featured
          </label>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Images</h2>
        <div className="flex flex-wrap gap-3">
          {images.map((img, i) => (
            <div key={img.url} className="group relative size-28 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
              <Image src={img.url} alt="" fill sizes="112px" className="object-cover" />
              {i === 0 && <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-[10px] text-white">Cover</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 p-1 opacity-0 transition group-hover:opacity-100">
                <button
                  type="button"
                  className="px-1 text-xs text-white disabled:opacity-30"
                  disabled={i === 0}
                  onClick={() => setImages((im) => [im[i], ...im.filter((_, j) => j !== i)])}
                >
                  Make cover
                </button>
                <button type="button" className="px-1 text-xs text-red-300" onClick={() => setImages((im) => im.filter((_, j) => j !== i))}>
                  ✕
                </button>
              </div>
            </div>
          ))}
          <label className="flex size-28 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 text-center text-xs text-zinc-500 hover:border-brand-500">
            {uploading ? "Uploading…" : "+ Add images"}
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
              disabled={uploading}
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (!files.length) return;
                setUploading(true);
                setUploadError(undefined);
                try {
                  const urls = await Promise.all(files.map((f) => uploadImage("products", "products", f)));
                  setImages((im) => [...im, ...urls.map((url) => ({ url, alt: "" }))]);
                } catch (err) {
                  setUploadError(err instanceof Error ? err.message : "Upload failed");
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
        </div>
        {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Options</h2>
          <p className="text-sm text-zinc-500">e.g. Size → S, M, L. Leave empty for a single-variant product.</p>
        </div>
        {drafts.map((d, i) => (
          <div key={i} className="flex flex-wrap gap-2">
            <input
              placeholder="Option name"
              value={d.name}
              onChange={(e) => setDrafts((ds) => ds.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              onBlur={() => commitOptions(drafts)}
              className="input w-40"
            />
            <input
              placeholder="Values, comma separated"
              value={d.values}
              onChange={(e) => setDrafts((ds) => ds.map((x, j) => (j === i ? { ...x, values: e.target.value } : x)))}
              onBlur={() => commitOptions(drafts)}
              className="input flex-1"
            />
            <button type="button" className="btn-ghost text-red-600" onClick={() => commitOptions(drafts.filter((_, j) => j !== i))}>
              Remove
            </button>
          </div>
        ))}
        {drafts.length < 3 && (
          <button type="button" className="btn-secondary" onClick={() => setDrafts((d) => [...d, { name: "", values: "" }])}>
            + Add option
          </button>
        )}
      </section>

      <section className="card overflow-x-auto">
        <h2 className="p-5 pb-0 font-semibold">Variants ({rows.length})</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Variant</th>
              <th>Price ({currency})</th>
              <th>Compare at</th>
              <th>Stock</th>
              <th>SKU</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.title}>
                <td className="whitespace-nowrap font-medium">{r.title}</td>
                <td>
                  <input value={r.price} onChange={(e) => updateRow(i, { price: e.target.value })} inputMode="decimal" required className="input w-28" />
                </td>
                <td>
                  <input value={r.compare_at_price} onChange={(e) => updateRow(i, { compare_at_price: e.target.value })} inputMode="decimal" className="input w-28" />
                </td>
                <td>
                  <input value={r.stock} onChange={(e) => updateRow(i, { stock: e.target.value })} inputMode="numeric" className="input w-20" />
                </td>
                <td>
                  <input value={r.sku} onChange={(e) => updateRow(i, { sku: e.target.value })} className="input w-32" />
                </td>
                <td>
                  <input type="checkbox" checked={r.is_active} onChange={(e) => updateRow(i, { is_active: e.target.checked })} className="size-4 accent-brand-600" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="flex items-center gap-4">
        <SubmitButton disabled={uploading}>{product ? "Save product" : "Create product"}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
