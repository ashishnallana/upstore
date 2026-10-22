"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the current route every `seconds`, up to `times` times. */
export function AutoRefresh({ seconds = 3, times = 40 }: { seconds?: number; times?: number }) {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      if (++n > times) return clearInterval(id);
      router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds, times]);
  return null;
}
