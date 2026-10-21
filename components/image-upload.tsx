"use client";

import Image from "next/image";
import { useState } from "react";
import { browserClient } from "@/lib/supabase/browser";

/** Uploads one image straight to Supabase Storage and returns its public URL. */
export async function uploadImage(bucket: "products" | "avatars", folder: string, file: File) {
  const supabase = browserClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: "31536000", upsert: false });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Single-image field (avatar, category image) that posts the URL as `name`. */
export function ImageField({
  name,
  bucket,
  folder,
  defaultUrl,
  round,
}: {
  name: string;
  bucket: "products" | "avatars";
  folder: string;
  defaultUrl?: string | null;
  round?: boolean;
}) {
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  return (
    <div className="flex items-center gap-4">
      <div className={`relative size-16 shrink-0 overflow-hidden bg-zinc-100 ${round ? "rounded-full" : "rounded-lg"}`}>
        {url && <Image src={url} alt="" fill sizes="64px" className="object-cover" />}
      </div>
      <div className="space-y-1">
        <label className="btn-secondary cursor-pointer">
          {busy ? "Uploading…" : url ? "Change image" : "Upload image"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setBusy(true);
              setError(undefined);
              try {
                setUrl(await uploadImage(bucket, folder, file));
              } catch (err) {
                setError(err instanceof Error ? err.message : "Upload failed");
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        {url && (
          <button type="button" className="ml-2 text-sm text-zinc-500 hover:text-red-600" onClick={() => setUrl("")}>
            Remove
          </button>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      <input type="hidden" name={name} value={url} />
    </div>
  );
}
