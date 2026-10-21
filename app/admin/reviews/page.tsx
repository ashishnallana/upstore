import type { Metadata } from "next";
import Link from "next/link";
import { Badge, PageTitle, Stars } from "@/components/ui/display";
import { ActionButton } from "@/components/ui/form";
import { deleteReview, setReviewPublished } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Review } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Reviews" };

export default async function AdminReviews() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("*,products(id,name,slug)")
    .order("created_at", { ascending: false })
    .limit(100);
  const reviews = (data ?? []) as (Review & { product_id: string; products: { id: string; name: string; slug: string } | null })[];

  return (
    <>
      <PageTitle>Reviews</PageTitle>
      <div className="card divide-y divide-zinc-100">
        {reviews.map((r) => (
          <div key={r.id} className="flex flex-wrap items-start justify-between gap-4 p-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-zinc-500">
                {r.products && (
                  <Link href={`/p/${r.products.slug}`} className="font-medium text-zinc-900 hover:text-brand-600">
                    {r.products.name}
                  </Link>
                )}{" "}
                · {r.author_name} · {formatDate(r.created_at)}
              </p>
              <p className="mt-1 flex items-center gap-2">
                <Stars value={r.rating} />
                {r.title && <span className="font-medium">{r.title}</span>}
                {!r.is_published && <Badge className="bg-zinc-100 text-zinc-600">Hidden</Badge>}
              </p>
              {r.body && <p className="mt-1 text-sm text-zinc-700">{r.body}</p>}
            </div>
            <div className="flex gap-2">
              <ActionButton action={setReviewPublished.bind(null, r.id, r.product_id, !r.is_published)} className="btn-secondary text-xs">
                {r.is_published ? "Hide" : "Publish"}
              </ActionButton>
              <ActionButton action={deleteReview.bind(null, r.id, r.product_id)} className="btn-ghost text-xs text-red-600" confirm="Delete this review?">
                Delete
              </ActionButton>
            </div>
          </div>
        ))}
        {!reviews.length && <p className="p-6 text-zinc-500">No reviews yet.</p>}
      </div>
    </>
  );
}
