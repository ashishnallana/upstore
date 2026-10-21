import type { Metadata } from "next";
import { Suspense } from "react";
import { Listing } from "@/components/store/listing";
import { GridSkeleton } from "@/components/ui/display";

export const metadata: Metadata = { title: "Shop" };

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="container-x py-8">
      <Suspense fallback={<GridSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/search">, "searchParams">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  return (
    <>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">{q ? `Results for “${q}”` : "All products"}</h1>
      <Listing sp={sp} />
    </>
  );
}
