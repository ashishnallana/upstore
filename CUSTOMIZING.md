# Customizing the storefront

This app is meant to be forked and re-skinned. You can change the look, copy, layout and page structure as much as you like. The backend (Supabase schema, security rules, checkout logic, Server Actions) stays as it is, and your frontend talks to it through a small, stable contract.

This guide covers:

1. [The 5-minute rebrand](#1-the-5-minute-rebrand)
2. [Where every page lives](#2-where-every-page-lives)
3. [What you can change freely](#3-what-you-can-change-freely)
4. [The backend contract (don't break these)](#4-the-backend-contract-dont-break-these)
5. [Recipes](#5-recipes)
6. [Before you ship](#6-before-you-ship)

---

## 1. The 5-minute rebrand

| What | Where |
|---|---|
| Store name, tagline, hero text, home section titles, footer links | `site.config.ts` |
| Store name in the header, currency, number format, shipping fee and free-shipping threshold | **Admin → Settings** (stored in the database, no code) |
| Brand color | `app/globals.css` → `@theme { --color-brand-* }` |
| Font | `app/layout.tsx` (any `next/font/google` font) + `--font-sans` in `app/globals.css` |
| Favicon / app icon | Replace `app/favicon.ico`, or add `app/icon.png` / `app/apple-icon.png` |
| Social share image | Add `app/opengraph-image.png` (1200×630) |
| Button / input / card styles | `app/globals.css` → the `@utility` blocks |
| Auth emails (confirm, reset password) | Supabase dashboard → Authentication → Email Templates |

**Example: rename the store and make it green.**

```ts
// site.config.ts
export const site = {
  name: "Leaf & Co",
  description: "Plants and pots, delivered.",
  hero: { eyebrow: "Spring sale", title: "Bring the outdoors in.", /* … */ },
  // …
};
```

```css
/* app/globals.css */
@theme {
  --color-brand-50: oklch(0.97 0.03 150);
  --color-brand-100: oklch(0.93 0.06 150);
  --color-brand-500: oklch(0.6 0.15 150);
  --color-brand-600: oklch(0.52 0.15 150);
  --color-brand-700: oklch(0.45 0.13 150);
}
```

All components use `brand-*` classes, so the whole UI follows the new color.

---

## 2. Where every page lives

| URL | File | Notes |
|---|---|---|
| `/` | `app/page.tsx` | Hero + category tiles + featured + new arrivals |
| `/c/<category>/<sub>/…` | `app/c/[...slug]/page.tsx` | Category with subcategory chips, filters, grid |
| `/search?q=` | `app/search/page.tsx` | Search + filters (shares `components/store/listing.tsx`) |
| `/p/<slug>` | `app/p/[slug]/page.tsx` | Product: gallery, variant picker, wishlist, reviews, related |
| `/cart` | `app/cart/page.tsx` | |
| `/checkout` | `app/checkout/page.tsx` | Address picker, coupon, totals (`components/store/checkout-form.tsx`) |
| `/checkout/pay/<orderId>` | `app/checkout/pay/[orderId]/page.tsx` | Test payment page, replaced when a real gateway is added |
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | `app/(auth)/*` | Forms in `components/auth-forms.tsx` |
| `/account`, `/account/orders`, `/account/orders/<id>`, `/account/addresses`, `/account/wishlist` | `app/account/*` | Sidebar in `app/account/layout.tsx` |
| `/admin/*` | `app/admin/*` | Admin panel (customizable too, same rules) |
| 404 / error | `app/not-found.tsx`, `app/error.tsx` | |

Shared pieces:

| Component | File |
|---|---|
| Header (logo, category menu, search, account and cart buttons) | `components/store/header.tsx` |
| Footer | `app/layout.tsx` (content from `site.config.ts`) |
| Product card, grid, pagination | `components/store/product-grid.tsx` |
| Filters and sorting bar | `components/store/listing.tsx` |
| Variant picker + add to cart | `components/store/buy-box.tsx` |
| Cart line items, quantity stepper | `components/store/cart-lines.tsx`, `qty-stepper.tsx` |
| Order details and timeline | `components/order-detail.tsx` |
| Address form | `components/address-fields.tsx` |
| Buttons and form helpers | `components/ui/form.tsx` |
| Badges, stars, skeletons, empty states | `components/ui/display.tsx` |
| Price formatting | `components/money.tsx` |

---

## 3. What you can change freely

- **All markup, Tailwind classes and layout.** Restructure pages, move sections around, change the grid, add sections.
- **All text and copy**, including error messages shown in the UI.
- **Components.** Replace them, split them or delete unused ones. You can also pull in a UI library if you want one. The core project avoids dependencies to stay small, but that's a choice, not a requirement.
- **New pages** (About, FAQ, Contact, policies). These are plain files in `app/`.
- **Header and footer navigation.**
- **Which data each page shows.** Use the read functions in [§4.3](#43-read-functions-you-can-use) to build any page.
- **Images.** `next/image` is used everywhere. To load images from a new host, add it to `images.remotePatterns` in `next.config.ts`.

---

## 4. The backend contract (don't break these)

The frontend talks to the backend only through **Server Actions** (writes) and **read functions** (reads). Keep the names, arguments and form field names below the same, and everything keeps working however the UI looks.

### 4.1 Form-based actions

These take a `FormData`. Your `<input>`, `<select>` and `<textarea>` elements must use these exact `name`s. Wrap the form with `<ActionForm action={…}>` from `components/ui/form.tsx` to get pending state and the success/error message, or use React's `useActionState` directly.

| Action (`lib/actions/…`) | Field names | Notes |
|---|---|---|
| `auth.signIn` | `email`, `password`, `next` | `next` = where to go after login |
| `auth.signUp` | `full_name`, `email`, `password`, `next` | Password ≥ 8 chars |
| `auth.signInWithGoogle` | `next` | Plain `<form action>`; redirects to Google |
| `auth.forgotPassword` | `email` | |
| `auth.resetPassword` | `password`, `confirm` | |
| `account.updateProfile` | `full_name`, `phone`, `avatar_url` | `avatar_url` comes from `<ImageField>` |
| `account.saveAddress` | `id` (edit only), `label`, `full_name`, `phone`, `line1`, `line2`, `city`, `state`, `postal_code`, `country`, `is_default` (checkbox) | Use `<AddressFields>` or match the names |
| `store.placeOrder` | `address_id`, `coupon`, `notes` | Redirects to the payment page |
| `store.startPayment` | `order_id` | "Pay now" / retry: sends the customer to the payment gateway |
| `store.payOrder` | `order_id`, `outcome` (`success` \| `failure`) | Test payment page only (`PAYMENT_PROVIDER=fake`) |
| `store.submitReview` | `product_id`, `slug`, `rating` (1–5), `title`, `body` | |

### 4.2 Function-call actions

Call these directly from Client Components, or bind them for buttons: `<ActionButton action={fn.bind(null, …args)}>`.

| Action | Signature |
|---|---|
| `store.addToCart` | `(variantId, quantity = 1) → { ok \| error }` |
| `store.updateCartQuantity` | `(variantId, quantity)`; `0` removes the line |
| `store.toggleWishlist` | `(productId, slug)` |
| `store.deleteMyReview` | `(productId, slug)` |
| `store.previewCoupon` | `(code, subtotalMinor) → { discount } \| { error }` |
| `store.cancelOrder` | `(orderId)` |
| `account.deleteAddress`, `account.setDefaultAddress` | `(addressId)` |
| `auth.signOut` | `()`; use as `<form action={signOut}>` |

Admin actions (`lib/actions/admin.ts`) follow the same pattern. Their field names are visible in the existing admin forms; keep them if you restyle the admin.

### 4.3 Read functions you can use

Use these in Server Components:

| Function | Returns |
|---|---|
| `getSettings()` | Store name, currency, locale, shipping rules (cached) |
| `getCategoryTree()` | Nested categories with `children` and `path` (cached) |
| `findByPath(tree, slugs)`, `descendantIds(node)` | Resolve a category URL; IDs for "this category + all subs" |
| `getProducts({ categoryIds, q, sort, page, perPage, min, max, inStock, featured, excludeId })` | `{ items, total }` (cached) |
| `getProduct(slug)` | Product with images and active variants, or `null` (cached) |
| `getReviews(productId)` | Published reviews (cached) |
| `getCartLines()`, `getCartCount()` | Current cart (guest or signed-in) |
| `getUser()`, `getProfile()` | Current user or `null` |
| `requireUser(next)`, `requireAdmin()` | Redirect / 404 if not allowed |
| `loadOrder(id)` | Order with items, timeline and payments (only the owner or an admin gets it) |

The first group lives in `lib/data/catalog.ts`, the cart functions in `lib/cart.ts`, the user functions in `lib/auth.ts`, and `loadOrder` in `components/order-detail.tsx`. Types are in `lib/types.ts`.

### 4.4 URLs the backend redirects to

Server code and Supabase send users to these paths. **If you rename a route, update every reference** (search the repo for the old path):

- `/login?next=…`, `/account`, `/reset-password`: auth flow (`lib/actions/auth.ts`, `proxy.ts`)
- `/auth/callback`: OAuth and email links. Also registered in the Supabase dashboard, so don't rename it.
- `/checkout/pay/<id>`: payment and retry page; after placing an order with the fake provider, or after a failed gateway payment
- `/checkout/return?order=<id>`: where the payment gateway sends customers after paying. It's registered with the gateway, so don't rename it.
- `/order-failed`: fixed path the YouPI checkout redirects to on failure. Don't rename it.
- `/api/payments/youpi`: webhook endpoint configured in the gateway. Don't rename it.
- `/account/orders/<id>/invoice`: PDF invoice (add `?download` to force a download). Linked from the customer and admin order pages; also attached to the confirmation email.
- `/account/orders/<id>?placed=1`: after payment (`lib/actions/store.ts`)
- `/p/<slug>`: product links, also used in some redirects
- `/account`, `/checkout`, `/admin`: prefixes protected in `proxy.ts`

Query parameters the pages read:
- Listings: `q`, `sort` (`new` \| `price_asc` \| `price_desc` \| `rating`), `page`, `min`, `max`, `stock=1`
- Login: `next`, `error`
- Order page: `placed`

### 4.5 Rules your UI code must follow

1. **Prices are integers in minor units** (₹499.00 = `49900`). Display them with `<Money amount={…} />` in Server Components, or `formatMoney(amount, currency, locale)` in Client Components, never `amount / 100` by hand. This keeps the admin's currency setting working.
2. **Anything that reads the user, cart, cookies, `params` or `searchParams` must sit inside `<Suspense>`.** The build fails otherwise. The pattern used throughout is a sync `Page` that renders `<Suspense fallback={…}><AsyncView {...props} /></Suspense>`.
3. **Add `"use client"` only to interactive leaf components** (buttons, pickers, forms with local state). Keep pages and layouts as Server Components.
4. **Never import `lib/supabase/admin.ts` or use the secret key in UI code.**
5. **Don't compute order totals in the UI for anything but display.** The database recalculates them at checkout.

---

## 5. Recipes

**Change the home page.** Edit `app/page.tsx`. Each section is independent. To add a "Top rated" row:

```tsx
<Suspense fallback={<GridSkeleton />}>
  <Products sort="rating" />
</Suspense>
```

Then pass `sort` through to `getProducts({ sort, perPage: 8 })` in the `Products` helper at the bottom of the file.

**Show a category's products anywhere.**

```tsx
const tree = await getCategoryTree();
const shoes = findByPath(tree, ["fashion", "shoes"]);
const { items } = await getProducts({ categoryIds: shoes ? descendantIds(shoes.node) : [], perPage: 4 });
return <ProductGrid products={items} />;
```

**Restyle the product card.** Edit `ProductCard` in `components/store/product-grid.tsx`. It receives a `ProductCard` object (`name`, `slug`, `brand`, `price`, `compare_at_price`, `in_stock`, `rating_avg`, `rating_count`, `image`).

**Add a static page.** Create `app/about/page.tsx`:

```tsx
export const metadata = { title: "About" };
export default function About() {
  return <div className="container-x py-12">…</div>;
}
```

Then link it from `site.config.ts → footer.links`.

**Change the header menu.** Edit `components/store/header.tsx`. `CategoryNav` builds the menu from your categories (manage them in Admin → Categories). Add fixed links next to it if you need them.

**Rename `/p/…` to `/product/…`.** Rename the folder `app/p` to `app/product`, then search the repo for `` `/p/ `` and `"/p/` and update each match (product card, cart lines, order details, wishlist, review redirects, admin links).

**Use a different font.** In `app/layout.tsx`:

```tsx
import { Outfit } from "next/font/google";
const font = Outfit({ variable: "--font-inter", subsets: ["latin"] });
```

Keeping the same `variable` name means no CSS changes are needed.

**Dark mode.** Add `dark:` variants to the `@utility` blocks in `app/globals.css` and to the body base style. Components that use the utilities (`card`, `input`, `btn-*`) pick them up automatically.

**Restyle emails and invoices.** Email HTML is in `lib/email/templates.ts`: the shared `layout()` wrapper, a `BRAND` color constant and one case per email. Keep the `esc()` calls around every database value. The invoice layout is in `lib/invoice/pdf.ts`. Seller details, invoice prefix and footer notes are edited in **Admin → Settings** with no code changes.

**Translate the UI.** All copy is either in `site.config.ts` or inline in the page and component files. For multiple languages, see the Next.js i18n guide in `node_modules/next/dist/docs/01-app/02-guides/internationalization.md`.

---

## 6. Before you ship

```bash
npx next typegen && npx tsc --noEmit   # types
npm run lint
npm run build                          # catches missing <Suspense> and other caching mistakes
```

Then click through the main flow: browse → add to cart → sign in (the cart is kept) → checkout with a coupon → pay → see the order in the account area → mark it delivered in admin → leave a review.

If you changed something under `supabase/`, `lib/actions/`, `lib/data/` or `proxy.ts`, you changed the backend. That's fine for your fork, but read **AGENTS.md** first: it explains the security model those files depend on.
