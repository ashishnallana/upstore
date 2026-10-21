import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/product-form";
import { PageTitle } from "@/components/ui/display";
import { ActionButton } from "@/components/ui/form";
import { deleteProduct } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { flattenTree, getAdminCategoryTree, getAdminProduct } from "@/lib/data/admin";
import { getSettings } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [product, tree, settings] = await Promise.all([getAdminProduct(id), getAdminCategoryTree(), getSettings()]);
  if (!product) notFound();

  return (
    <>
      <Link href="/admin/products" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Products
      </Link>
      <PageTitle
        action={
          <div className="flex gap-2">
            <Link href={`/p/${product.slug}`} className="btn-secondary" target="_blank">
              View in store
            </Link>
            <ActionButton
              action={deleteProduct.bind(null, product.id, product.slug)}
              className="btn-danger"
              confirm="Delete this product permanently? Past orders keep their line items."
            >
              Delete
            </ActionButton>
          </div>
        }
      >
        {product.name}
      </PageTitle>
      {(sp.created || sp.saved) && (
        <p className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">Product {sp.created ? "created" : "saved"}.</p>
      )}
      <ProductForm
        // Remount after each save so new variants pick up their DB ids.
        key={product.updated_at}
        product={product}
        categories={flattenTree(tree).map(({ id, label }) => ({ id, label }))}
        currency={settings.currency}
      />
    </>
  );
}
