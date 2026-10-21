import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Listing } from "@/components/store/listing";
import { GridSkeleton } from "@/components/ui/display";
import { descendantIds, findByPath, getCategoryTree } from "@/lib/data/catalog";

export async function generateMetadata({ params }: PageProps<"/c/[...slug]">): Promise<Metadata> {
  const { slug } = await params;
  const found = findByPath(await getCategoryTree(), slug);
  return { title: found?.node.name ?? "Category", description: found?.node.description ?? undefined };
}

export default function CategoryPage(props: PageProps<"/c/[...slug]">) {
  return (
    <div className="container-x py-8">
      <Suspense fallback={<GridSkeleton />}>
        <CategoryView {...props} />
      </Suspense>
    </div>
  );
}

async function CategoryView({ params, searchParams }: PageProps<"/c/[...slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const found = findByPath(await getCategoryTree(), slug);
  if (!found) notFound();
  const { node, trail } = found;

  return (
    <>
      <nav className="mb-2 text-sm text-zinc-500" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-zinc-900">
          Home
        </Link>
        {trail.map((c) => (
          <span key={c.id}>
            {" / "}
            <Link href={`/c/${c.path.join("/")}`} className="hover:text-zinc-900">
              {c.name}
            </Link>
          </span>
        ))}
      </nav>
      <h1 className="text-3xl font-bold tracking-tight">{node.name}</h1>
      {node.description && <p className="mt-2 text-zinc-600">{node.description}</p>}

      {node.children.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {node.children.map((c) => (
            <Link key={c.id} href={`/c/${c.path.join("/")}`} className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm hover:border-brand-500 hover:text-brand-600">
              {c.name}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8">
        <Listing sp={sp} categoryIds={descendantIds(node)} />
      </div>
    </>
  );
}
