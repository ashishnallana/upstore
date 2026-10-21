import type { Metadata } from "next";
import { ProductForm } from "@/components/admin/product-form";
import { PageTitle } from "@/components/ui/display";
import { requireAdmin } from "@/lib/auth";
import { flattenTree, getAdminCategoryTree } from "@/lib/data/admin";
import { getSettings } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  await requireAdmin();
  const [tree, settings] = await Promise.all([getAdminCategoryTree(), getSettings()]);
  return (
    <>
      <PageTitle>New product</PageTitle>
      <ProductForm categories={flattenTree(tree).map(({ id, label }) => ({ id, label }))} currency={settings.currency} />
    </>
  );
}
