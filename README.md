# UpStore

A lightweight e-commerce store built with **Next.js 16**, **TypeScript**, **Tailwind CSS v4** and **Supabase** (Postgres, Auth, Storage).

**Storefront:** categories with unlimited subcategory levels, search, filters and sorting, product variants (size, color and so on), image galleries, reviews (verified buyers only), wishlist, guest cart that merges into the account cart on login, coupons, checkout with saved addresses, and a fake payment step.

**Account:** profile with avatar, addresses, order history with a status timeline, cancel or retry payment, wishlist.

**Admin (`/admin`):** dashboard (revenue, orders to fulfil, low stock), products with a variant grid and image upload, category tree, orders with status workflow, customers and roles, coupons, review moderation, and store settings (name, **currency**, number format, shipping rules).

## Setup

### 1. Install

```bash
npm install
```

### 2. Create a Supabase project and add the keys

Fill in `.env.local` using the values in Supabase → **Project Settings → API Keys**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # or the legacy anon key
SUPABASE_SECRET_KEY=sb_secret_...                         # or the legacy service_role key (server only!)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Create the database

In Supabase → **SQL Editor**, run these in order:

1. `supabase/migrations/0001_init.sql`: tables, RLS policies, functions, storage buckets
2. `supabase/seed.sql`: optional demo categories, products and coupons (`WELCOME10`, `FLAT200`)

If you use the Supabase CLI, `supabase link` followed by `supabase db push` does the same as step 1.

### 4. Configure Auth

In Supabase → **Authentication → URL Configuration**:
- **Site URL:** `http://localhost:3000` (your production URL later)
- **Redirect URLs:** add `http://localhost:3000/auth/callback` (and the production equivalent)

**Google login (optional):** create an OAuth client in Google Cloud Console with the authorized redirect URI `https://<ref>.supabase.co/auth/v1/callback`. Then enable **Authentication → Providers → Google** and paste in the client ID and secret.

**Email confirmation:** if it's turned on (the default), new users confirm by email before signing in. Turn it off under **Authentication → Providers → Email** for faster local testing.

### 5. Make yourself an admin

Sign up in the app, then run this in the SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

From then on you can promote other users from **Admin → Customers**.

### 6. Run

```bash
npm run dev
```

## Trying the full flow

1. Add items to the cart as a guest, then sign in. The cart is kept.
2. At checkout, add an address and apply `WELCOME10`.
3. On the test payment page, choose **Pay now** or **Simulate failed payment**.
4. As admin, open the order and move it to **delivered**. The customer can now review the product.

## Notes

- **Money** is stored as integer minor units (₹499.00 → `49900`). Changing the currency in Settings relabels prices but does not convert them. Past orders keep their original currency.
- **Payments** go through `lib/payments`. To replace the fake provider with Stripe, Razorpay or another gateway, implement the `PaymentProvider` interface (see `AGENTS.md → Recipes`).
- **Images:** the seed data uses picsum.photos. Uploaded images go to the `products` and `avatars` buckets.

See **AGENTS.md** for architecture, conventions and recipes (used by AI coding agents and humans).
