import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { getProfile } from "@/lib/auth";
import { getCartCount } from "@/lib/cart";
import { getCategoryTree, getSettings } from "@/lib/data/catalog";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="container-x flex h-16 items-center gap-3 lg:gap-6">
        <Suspense fallback={<span className="w-6 lg:hidden" />}>
          <MobileMenu />
        </Suspense>
        <Link href="/" className="text-xl font-bold tracking-tight text-brand-600">
          <Suspense fallback="UpStore">
            <StoreName />
          </Suspense>
        </Link>
        <nav className="hidden lg:block">
          <Suspense fallback={null}>
            <CategoryNav />
          </Suspense>
        </nav>
        <SearchBox className="ml-auto hidden w-full max-w-xs md:block" />
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <Suspense fallback={<div className="skeleton h-9 w-28" />}>
            <HeaderActions />
          </Suspense>
        </div>
      </div>
      <div className="container-x pb-3 md:hidden">
        <SearchBox />
      </div>
    </header>
  );
}

async function StoreName() {
  return (await getSettings()).store_name;
}

function SearchBox({ className }: { className?: string }) {
  return (
    <Form action="/search" className={className} role="search">
      <input name="q" type="search" placeholder="Search products…" aria-label="Search products" className="input" />
    </Form>
  );
}

async function CategoryNav() {
  const tree = await getCategoryTree();
  return (
    <ul className="flex items-center gap-1">
      {tree.map((cat) => (
        <li key={cat.id} className="group relative">
          <Link href={`/c/${cat.slug}`} className="btn-ghost px-3">
            {cat.name}
          </Link>
          {cat.children.length > 0 && (
            <div className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <ul className="card min-w-48 p-2 shadow-lg">
                {cat.children.map((sub) => (
                  <li key={sub.id}>
                    <Link href={`/c/${sub.path.join("/")}`} className="block rounded-md px-3 py-2 text-sm hover:bg-zinc-50">
                      {sub.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** No-JS mobile menu using <details>. */
async function MobileMenu() {
  const tree = await getCategoryTree();
  return (
    <details className="group relative lg:hidden">
      <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-lg hover:bg-zinc-100" aria-label="Menu">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </summary>
      <div className="card absolute left-0 top-11 z-50 max-h-[70vh] w-64 overflow-y-auto p-2 shadow-lg">
        {tree.map((cat) => (
          <div key={cat.id} className="py-1">
            <Link href={`/c/${cat.slug}`} className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-zinc-50">
              {cat.name}
            </Link>
            {cat.children.map((sub) => (
              <Link key={sub.id} href={`/c/${sub.path.join("/")}`} className="block rounded-md px-6 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50">
                {sub.name}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </details>
  );
}

async function HeaderActions() {
  const [profile, count] = await Promise.all([getProfile(), getCartCount()]);
  return (
    <>
      {profile?.role === "admin" && (
        <Link href="/admin" className="btn-ghost hidden px-3 sm:inline-flex">
          Admin
        </Link>
      )}
      <Link href={profile ? "/account" : "/login"} className="btn-ghost px-3">
        {profile ? "Account" : "Sign in"}
      </Link>
      <Link href="/cart" className="btn-ghost relative px-3" aria-label={`Cart, ${count} items`}>
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3h2l2.4 12.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6" />
          <circle cx="10" cy="20" r="1" />
          <circle cx="18" cy="20" r="1" />
        </svg>
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-semibold text-white">
            {count}
          </span>
        )}
      </Link>
    </>
  );
}
