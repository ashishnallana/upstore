import { Suspense } from "react";
import { NavLink } from "@/components/nav-link";
import { BlockSkeleton } from "@/components/ui/display";
import { signOut } from "@/lib/actions/auth";

// Private, per-user pages: allowed to block on the session.
export const instant = false;

export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <div className="container-x grid gap-8 py-8 md:grid-cols-[200px_1fr]">
      <nav className="flex gap-1 overflow-x-auto md:flex-col" aria-label="Account">
        <NavLink href="/account" exact>
          Profile
        </NavLink>
        <NavLink href="/account/orders">Orders</NavLink>
        <NavLink href="/account/addresses">Addresses</NavLink>
        <NavLink href="/account/wishlist">Wishlist</NavLink>
        <form action={signOut}>
          <button className="block w-full whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-100">Sign out</button>
        </form>
      </nav>
      <div className="min-w-0">
        <Suspense fallback={<BlockSkeleton className="h-96" />}>{children}</Suspense>
      </div>
    </div>
  );
}
