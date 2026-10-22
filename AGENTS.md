<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# UpStore: agent guide

A small, fast e-commerce store. **Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind v4 + Supabase** (Postgres, Auth, Storage, RLS). Runtime dependencies are only `next`, `react`, `react-dom`, `@supabase/ssr`, `@supabase/supabase-js` and `server-only`. **Do not add libraries** (UI kits, state managers, form libs, ORMs, date libs) unless the user asks.

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Type-check | `npx next typegen && npx tsc --noEmit` (typegen creates `PageProps`/`LayoutProps` route types) |
| Lint | `npm run lint` |
| Production build | `npm run build` (must pass; it validates Cache Components rules) |

Before finishing a change, run type-check, lint and build.

## Layout

```
app/                     Routes. Store pages at the root, (auth)/, account/, admin/, auth/callback (route handler)
components/ui/           form.tsx (client: SubmitButton, ActionForm, ActionButton), display.tsx (server: badges, skeletons)
components/store/        Header, product grid, listing/filters, buy box, cart, checkout form
components/admin/        product-form.tsx (options → variant grid editor, image upload)
lib/supabase/            server.ts (user session, RLS) · public.ts (anon, cookie-less, for "use cache")
                         admin.ts (service role, bypasses RLS) · browser.ts (storage uploads only)
lib/data/catalog.ts      Cached public reads + TAGS. lib/data/admin.ts: uncached admin reads
lib/actions/*.ts         Every mutation ("use server"): auth, store (cart/checkout/reviews), account, admin
lib/payments/            PaymentProvider interface (index.ts), providers (fake.ts, youpi.ts), settle.ts (the only
                         path to record_payment), reconcile.ts (return-page status lookup)
lib/auth.ts              getUser / getProfile / requireUser / requireAdmin (React cache, per request)
lib/cart.ts              Guest cookie cart ↔ cart_items table, mergeGuestCart on login
lib/types.ts             Row types (hand-written, mirror the SQL)
proxy.ts                 Session refresh + redirects for /account, /checkout, /admin
site.config.ts           Storefront branding/copy (name, hero, home section titles, footer links)
supabase/migrations/     Schema, RLS, SQL functions, storage buckets. supabase/seed.sql: demo data
```

## Frontend vs. backend

The frontend is meant to be re-skinned by forks. **CUSTOMIZING.md** is the guide for that, and its §4 "backend contract" lists the Server Action names and signatures, form field names, read functions and redirect URLs the UI relies on. When you change the backend, keep that contract or update CUSTOMIZING.md in the same change. When you change the UI, don't touch `supabase/`, `lib/actions/`, `lib/data/`, `lib/payments/` or `proxy.ts` unless the task requires it. Put user-facing brand copy in `site.config.ts`, not inline.

## Core rules

**Money.** Every amount is an integer in minor units (`amount * 100`), in DB, code and forms-after-parsing. Convert user input with `toMinor()` and display with `<Money amount={…} />` (server) or `formatMoney(n, currency, locale)` (client, with settings passed as props). Currency and locale come from the `store_settings` singleton (admin → Settings, default INR / en-IN). Orders snapshot `currency`; render past orders with `<Money currency={order.currency} />`.

**Security lives in Postgres.** RLS is on for every table. Users can only touch their own profile, addresses, cart, wishlist, orders and reviews. Catalog writes require `is_admin()`. Things that must be atomic or tamper-proof are `SECURITY DEFINER` SQL functions:
- `place_order` locks variant rows, recomputes prices, applies the coupon, decrements stock and clears the cart. Never compute order totals in TypeScript.
- `record_payment` is executable **only by service_role**. Never call it directly: use `recordPaymentResult()` in `lib/payments/settle.ts`, which is idempotent, ignores non-pending orders, and refuses a success whose amount or currency differs from the order.
- `cancel_order`, `admin_update_order_status` (both release stock and coupons on cancel), `admin_set_role`, `admin_stats`, `preview_coupon`.
- Column grants: users may update only `profiles(full_name, phone, avatar_url)` and `reviews(rating, title, body, is_published)`, and a trigger blocks non-admins from changing `is_published`. A PostgREST **upsert** sets every column, so on those tables use update/insert, not upsert.

Server Actions still re-check auth (`requireUser` / `requireAdmin`) as defense in depth. Use `adminClient()` only after authorizing the caller in code.

**Caching (Cache Components is on).**
- Public catalog reads are `"use cache"` functions in `lib/data/catalog.ts` using `publicClient()` (never cookies). Each one calls `cacheTag(...)`, then `cacheLife("seconds")` when the query errored, otherwise its normal profile, so a DB blip is never cached for long.
- Anything that reads cookies, session, `params` or `searchParams` must sit under a `<Suspense>` boundary. Pages follow this pattern: a sync `Page` renders a shell plus `<Suspense><AsyncView {...props} /></Suspense>`.
- `account/` and `admin/` layouts set `export const instant = false` and wrap children in Suspense (private, per-user pages).
- After a mutation, call `updateTag(TAGS.x)` in Server Actions (read-your-writes), or `revalidateTag(tag, "max")` for background refresh. Use `refresh()` to re-render the current route for uncached data (cart, account, admin tables).
- Don't call `Date.now()`, `new Date()` (no args) or `Math.random()` in prerendered server code.

**Supabase query gotchas.**
- `referencedTable` in `.order()` / `.limit()` must use the embed **alias** (`images`, `variants`, `product.product_images`).
- Embedded results are typed loosely. Cast through `unknown` to a local `Row` type.
- `lib/types.ts` is hand-maintained. Update it when you change the schema (or switch to `supabase gen types`).

**Next.js 16 specifics.** Middleware is `proxy.ts` (`export function proxy`). `revalidateTag` needs a second arg (`"max"`). `updateTag` and `refresh` only work in Server Actions. `PageProps<"/route">` / `LayoutProps<"/route">` are global generated types. Check `node_modules/next/dist/docs/` before using an API you're unsure of.

**Tailwind v4.** Config lives in `app/globals.css` (`@theme`, brand color `brand-*`). Reusable classes are `@utility` blocks (`btn-primary`, `btn-secondary`, `btn-ghost`, `btn-danger`, `input`, `label`, `card`, `container-x`, `skeleton`, `data-table`). `@apply` works only with utilities, not plain CSS classes.

## Data model (short)

`store_settings` (singleton) · `profiles` (role customer|admin, created by trigger on signup) · `addresses` (one default per user, trigger-managed) · `categories` (self-referencing `parent_id`, unlimited depth, URLs `/c/a/b`) · `products` (`options` jsonb `[{name, values[]}]`; `price`, `compare_at_price`, `in_stock`, `rating_avg`, `rating_count` are **denormalized by triggers**, so never write them) · `product_variants` (`option_values` jsonb, price, stock, sku; every product has ≥1 variant, "Default" when there are no options) · `product_images` · `wishlists` · `cart_items` (variant_id, qty) · `coupons` + `coupon_redemptions` · `orders` (status pending→paid→processing→shipped→delivered | cancelled; `order_number` for display; address snapshot) · `order_items` (name/price snapshot) · `order_events` (status timeline, trigger-written) · `payments` · `reviews` (insert needs a delivered order with the product).

Storage buckets: `products` (public read, admin write) and `avatars` (public read, users write `avatars/<uid>/…`). Uploads go **browser → Storage directly** (`uploadImage` in `components/image-upload.tsx`); only URLs reach Server Actions.

## Recipes

- **New public page:** sync page plus `<Suspense>` around an async view. Read data through a cached function in `lib/data/catalog.ts` with a tag. Add the tag to `TAGS` and expire it from the admin action that changes the data.
- **New mutation:** add to the relevant `lib/actions/*.ts` with `"use server"`. Signature `(prev: ActionState, form: FormData) => Promise<ActionState>` for forms (`<ActionForm>`), or a bound function for buttons (`<ActionButton action={fn.bind(null, id)}>`). Check auth first, then expire tags or call `refresh()`.
- **Schema change:** add a **new** file `supabase/migrations/000N_*.sql` (never edit applied migrations). Enable RLS and add policies in the same file. Update `lib/types.ts`.
- **Payment gateway:** the provider is chosen by `PAYMENT_PROVIDER` (`fake` | `youpi`). To add one, implement `PaymentProvider` (`createPayment`, `lookup`) in `lib/payments/<name>.ts` and register it in `PROVIDERS` in `index.ts`. Add `app/api/payments/<name>/route.ts` for webhooks: verify the signature over the **raw** body (`request.text()`), re-fetch the result from the gateway API, then call `recordPaymentResult()`. Return non-2xx on transient errors so the gateway retries. Never mark an order paid from browser input or redirect query params. Secrets go in env vars without the `NEXT_PUBLIC_` prefix.
- **YouPI specifics** (`lib/payments/youpi.ts`): `/order-failed` and `/checkout/return` are fixed paths the gateway redirects to. The webhook secret doubles as the `X-Merchant-Key` API key. Only `SUCCESS` with `method !== "COD"` is a payment. Suspicious payments are held by the gateway and never reported as `SUCCESS`. Source of truth for its API: `apps/payment-api/src/routes/payments.routes.js` and `packages/core/src/webhook-engine.js` in the YouPI repo.
- **New admin section:** a page under `app/admin/` (starts with `await requireAdmin()`) and a link in `LINKS` in `app/admin/layout.tsx`.
