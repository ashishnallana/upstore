# UpStore

A lightweight e-commerce store built with **Next.js 16**, **TypeScript**, **Tailwind CSS v4** and **Supabase** (Postgres, Auth, Storage).

**Storefront:** categories with unlimited subcategory levels, search, filters and sorting, product variants (size, color and so on), image galleries, reviews (verified buyers only), wishlist, guest cart that merges into the account cart on login, coupons, checkout with saved addresses, and UPI payments through the self-hosted [YouPI PG](https://github.com/youpi-pg/YouPI-PG) gateway (or a built-in test payment page).

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

## Payments with YouPI PG (UPI)

[YouPI PG](https://github.com/youpi-pg/YouPI-PG) is a self-hosted UPI gateway with no per-transaction fees. **Its authors label it an experimental research project, not a certified or production-ready gateway**: read their README's safety section (including their suggested limit of 20 transactions a day per receiving account) before taking real money.

1. Install and start YouPI by following its README. Its payment API runs on port 6100 and its checkout on 7000.
2. In YouPI's **Merchant Admin** (port 6001):
   - Add your UPI receiving account.
   - Set the **webhook URL** to `<your site>/api/payments/youpi`.
   - Set a **webhook secret**.
   - Set the selling mode to **UPI only**. Cash on delivery isn't supported by this store; COD orders are never marked paid.
3. Add the gateway settings to `.env.local` and restart the app:
   ```env
   PAYMENT_PROVIDER=youpi
   YOUPI_API_URL=http://localhost:6100        # YouPI payment API
   YOUPI_MERCHANT_ID=<merchant id from YouPI>  # default merchant: 00000000-0000-0000-0000-000000000001
   YOUPI_WEBHOOK_SECRET=<same secret as in YouPI>
   ```
4. Keep the store currency as **INR** (Admin → Settings). UPI only settles in rupees.

**Local development:** YouPI refuses to send webhooks to `localhost` unless you start it with `YOUPI_ALLOW_PRIVATE_WEBHOOKS=true`. If webhooks can't reach you, payments are still confirmed when the customer comes back to the store: the return and payment pages ask the gateway directly.

**How a payment is confirmed:**
1. The customer places an order and is sent to YouPI's hosted UPI checkout.
2. YouPI sends a signed webhook. We check the signature, then ask the YouPI API for the payment's current status, and only mark the order paid if it says `SUCCESS`, isn't COD, and the amount and currency match the order exactly.
3. If the customer cancels or the payment fails or expires, the order stays **awaiting payment** and they can retry from the order page.

## Notes

- **Money** is stored as integer minor units (₹499.00 → `49900`). Changing the currency in Settings relabels prices but does not convert them. Past orders keep their original currency.
- **Payments** go through `lib/payments` and are chosen with `PAYMENT_PROVIDER` (`fake` or `youpi`). To add Stripe, Razorpay or another gateway, implement the `PaymentProvider` interface (see `AGENTS.md → Recipes`).
- **Images:** the seed data uses picsum.photos. Uploaded images go to the `products` and `avatars` buckets.

## Make it yours

Rebrand and redesign the storefront without touching the backend: start with `site.config.ts`, then read **[CUSTOMIZING.md](CUSTOMIZING.md)** for colors, fonts, page structure and the backend contract your UI has to keep.

See **AGENTS.md** for architecture, conventions and recipes (used by AI coding agents and humans).
