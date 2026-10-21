import type { Metadata } from "next";
import { Suspense } from "react";
import { NavLink } from "@/components/nav-link";
import { BlockSkeleton } from "@/components/ui/display";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | Admin" }, robots: { index: false } };
export const instant = false;

const LINKS = [
  ["/admin", "Dashboard"],
  ["/admin/orders", "Orders"],
  ["/admin/products", "Products"],
  ["/admin/categories", "Categories"],
  ["/admin/customers", "Customers"],
  ["/admin/coupons", "Coupons"],
  ["/admin/reviews", "Reviews"],
  ["/admin/settings", "Settings"],
] as const;

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="container-x grid gap-8 py-8 md:grid-cols-[200px_1fr]">
      <nav className="flex gap-1 overflow-x-auto md:flex-col" aria-label="Admin">
        {LINKS.map(([href, label]) => (
          <NavLink key={href} href={href} exact={href === "/admin"}>
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="min-w-0">
        <Suspense fallback={<BlockSkeleton className="h-96" />}>
          <AdminGate>{children}</AdminGate>
        </Suspense>
      </div>
    </div>
  );
}

async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}
