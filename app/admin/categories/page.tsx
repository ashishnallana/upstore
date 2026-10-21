import type { Metadata } from "next";
import { ImageField } from "@/components/image-upload";
import { Badge, PageTitle } from "@/components/ui/display";
import { ActionButton, ActionForm, SubmitButton } from "@/components/ui/form";
import { deleteCategory, saveCategory } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { flattenTree, getAdminCategoryTree } from "@/lib/data/admin";
import { descendantIds } from "@/lib/data/catalog";
import type { CategoryNode } from "@/lib/types";

export const metadata: Metadata = { title: "Categories" };

type Option = { id: string; label: string };

export default async function AdminCategories() {
  await requireAdmin();
  const flat = flattenTree(await getAdminCategoryTree());
  const all: Option[] = flat.map(({ id, label }) => ({ id, label }));

  return (
    <>
      <PageTitle>Categories</PageTitle>
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="card divide-y divide-zinc-100">
          {flat.map(({ node, label }) => {
            // A category can't move under itself or its own descendants.
            const blocked = new Set(descendantIds(node));
            return (
              <details key={node.id} className="group p-4" style={{ paddingLeft: `${1 + (node.path.length - 1) * 1.5}rem` }}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span className="font-medium">
                    {node.name} <span className="text-sm font-normal text-zinc-400">/{node.path.join("/")}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {!node.is_active && <Badge className="bg-zinc-100 text-zinc-600">Hidden</Badge>}
                    <span className="text-sm text-brand-600 group-open:hidden">Edit</span>
                  </span>
                </summary>
                <div className="mt-4 space-y-4">
                  <CategoryForm category={node} parents={all.filter((o) => !blocked.has(o.id))} />
                  <ActionButton action={deleteCategory.bind(null, node.id)} className="btn-ghost text-sm text-red-600" confirm={`Delete “${label}”?`}>
                    Delete category
                  </ActionButton>
                </div>
              </details>
            );
          })}
          {!flat.length && <p className="p-6 text-zinc-500">No categories yet.</p>}
        </div>
        <div className="card h-fit p-5">
          <h2 className="mb-4 font-semibold">New category</h2>
          <CategoryForm parents={all} />
        </div>
      </div>
    </>
  );
}

function CategoryForm({ category, parents }: { category?: CategoryNode; parents: Option[] }) {
  return (
    <ActionForm action={saveCategory} className="grid gap-3">
      {category && <input type="hidden" name="id" value={category.id} />}
      <label className="block">
        <span className="label">Name</span>
        <input name="name" required defaultValue={category?.name} className="input" />
      </label>
      <label className="block">
        <span className="label">Slug</span>
        <input name="slug" defaultValue={category?.slug} placeholder="auto from name" className="input" />
      </label>
      <label className="block">
        <span className="label">Parent</span>
        <select name="parent_id" defaultValue={category?.parent_id ?? ""} className="input">
          <option value="">— Top level —</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="label">Description</span>
        <textarea name="description" rows={2} defaultValue={category?.description ?? ""} className="input" />
      </label>
      <ImageField name="image_url" bucket="products" folder="categories" defaultUrl={category?.image_url} />
      <div className="flex items-center gap-4">
        <label className="block w-24">
          <span className="label">Sort</span>
          <input name="sort_order" type="number" defaultValue={category?.sort_order ?? 0} className="input" />
        </label>
        <label className="mt-5 flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_active" defaultChecked={category?.is_active ?? true} className="size-4 accent-brand-600" /> Active
        </label>
      </div>
      <SubmitButton className="btn-primary w-fit">{category ? "Save" : "Create category"}</SubmitButton>
    </ActionForm>
  );
}
