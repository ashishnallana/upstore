"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({ href, children, exact }: { href: string; children: React.ReactNode; exact?: boolean }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={cn(
        "block whitespace-nowrap rounded-lg px-3 py-2 text-sm",
        active ? "bg-brand-50 font-medium text-brand-700" : "text-zinc-600 hover:bg-zinc-100",
      )}
    >
      {children}
    </Link>
  );
}
