# UpStore

A lightweight, self-hostable e-commerce store built with **Next.js 16**, **TypeScript**, **Tailwind CSS v4** and **Supabase** (Postgres, Auth, Storage). It comes with UPI payments through a self-hosted gateway, emailed PDF invoices, and a full admin panel. The whole thing ships as **one Docker container**.

- **Storefront:** categories with unlimited subcategory levels, search, filters and sorting, product variants (size, color and so on), image galleries, verified-buyer reviews, wishlist, a guest cart that's kept on login, coupons, and checkout with saved addresses.
- **Payments:** UPI through the self-hosted [YouPI PG](https://github.com/youpi-pg/YouPI-PG) gateway, bundled in the container, or a built-in test payment page.
- **Emails & invoices:** order confirmation with a PDF invoice, shipped / delivered / cancelled updates, and new-order alerts, sent through Gmail SMTP or any SMTP server.
- **Account:** profile with avatar, addresses, order history with a status timeline, invoice downloads, cancel or retry payment.
- **Admin (`/admin`):**
  - dashboard: revenue, orders to fulfil, low stock;
  - products, with a variant grid and image upload;
  - category tree;
  - orders, with a status workflow and an email log;
  - customers and roles, coupons, review moderation;
  - settings: store name, **currency**, shipping rules, invoice details.

---

## Contents

1. [How it fits together](#1-how-it-fits-together)
2. [Set up Supabase](#2-set-up-supabase) (required for every setup)
3. [Deploy with Docker](#3-deploy-with-docker) (store + payment gateway in one container)
4. [Local development](#4-local-development)
5. [Payments (UPI)](#5-payments-upi)
6. [Emails & invoices](#6-emails--invoices)
7. [Try the full flow](#7-try-the-full-flow)
8. [Configuration reference](#8-configuration-reference)
9. [Make it yours & further docs](#9-make-it-yours--further-docs)

---

## 1. How it fits together

```
                         ┌───────────────────────── Docker container ─────────────────────────┐
 Customer ── :3000 ────► │  UpStore (Next.js)  ──127.0.0.1:6100──►  YouPI payment API          │
          ── :7000 ────► │                                          YouPI hosted UPI checkout  │
 You ───── :6001 (SSH) ─►│  ◄──── webhooks over loopback ────────   YouPI Merchant Admin       │
                         │                       data volume: gateway DB + generated secrets   │
                         └────────────────────────────────┬────────────────────────────────────┘
                                                          │ HTTPS
                                Supabase (Postgres, Auth, Storage)  ·  Gmail SMTP
```

- **Supabase** stores everything about the shop: products, customers, orders and images. You create a free project; nothing runs locally.
- **The container** runs the store and the YouPI gateway side by side. YouPI keeps its own small SQLite database in a Docker volume.
- Customers need two public addresses: the **store** (port 3000) and the **payment checkout** (port 7000). The gateway's admin panel (6001) stays private.

## 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com) (the free tier is fine).
2. In **SQL Editor**, run these files from this repo **in order** (open each one, paste it, click **Run**):
   1. `supabase/migrations/0001_init.sql`: tables, security policies, checkout functions, storage buckets
   2. `supabase/migrations/0002_invoices_emails.sql`: invoice numbers, seller details, email log
   3. `supabase/seed.sql`: *optional* demo catalog and coupons (`WELCOME10`, `FLAT200`)

   Run each file once. When you update an existing install, run only the new migrations.
3. In **Authentication → URL Configuration**:
   - **Site URL:** your store's URL (`http://localhost:3000` for local development);
   - **Redirect URLs:** add `<your store URL>/auth/callback`.
4. *(Optional)* **Google sign-in:** create an OAuth client in Google Cloud Console with the redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`. Then enable **Authentication → Providers → Google** and paste in the client ID and secret.
5. Copy your keys from **Project Settings → API Keys**: the project URL, the **publishable** key (or legacy *anon*) and the **secret** key (or legacy *service_role*). The secret key bypasses all security rules, so never put it in client code or commit it.

After the store is running, sign up and make yourself an admin by running this in the SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

From then on, promote other users from **Admin → Customers**.

## 3. Deploy with Docker

The image contains the store and the YouPI gateway. You need **Docker with Compose v2** on a Linux server (or Docker Desktop), plus the Supabase project from step 2.

### 3.1 Configure

```bash
git clone <this repo> upstore && cd upstore
cp .env.docker.example .env.docker
```

Edit `.env.docker`. The essentials:

| Setting | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | From Supabase (step 2.5) |
| `NEXT_PUBLIC_SITE_URL` | The public URL of the store, e.g. `https://shop.example.com` |
| `YOUPI_PUBLIC_CHECKOUT_URL` | The public URL of the payment checkout, e.g. `https://pay.example.com` |
| `YOUPI_UPI_ID`, `YOUPI_PAYEE_NAME` | Your UPI ID and the name on it: **where customers' money goes** |
| `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Gmail address and App Password (see [section 6](#6-emails--invoices)) |

### 3.2 Build and start

```bash
docker compose --env-file .env.docker up -d --build
docker compose logs -f        # watch startup; Ctrl+C to stop watching
```

The first build takes several minutes: it fetches YouPI from GitHub at a pinned commit and compiles the store. On every start, the container:

1. starts the YouPI gateway and waits until it's healthy;
2. configures it for this store: webhook to the store over loopback, a generated webhook secret, UPI only (cash on delivery off), your UPI ID active, YouPI's demo receiving account removed;
3. starts the store.

If either process dies, the container exits and Docker restarts it (`restart: unless-stopped`).

> `--env-file .env.docker` is required on `build`/`up`: the three `NEXT_PUBLIC_*` values are compiled into the app at build time. **Change them → rebuild** (`up -d --build`). Everything else is read at runtime: change it and run `docker compose --env-file .env.docker up -d`.

### 3.3 Put it on the internet (HTTPS)

Point two hostnames at the server and terminate HTTPS in a reverse proxy. A complete [Caddy](https://caddyserver.com) config, which gets certificates automatically:

```
shop.example.com {
    reverse_proxy localhost:3000
}
pay.example.com {
    reverse_proxy localhost:7000
}
```

With that, set `NEXT_PUBLIC_SITE_URL=https://shop.example.com` and `YOUPI_PUBLIC_CHECKOUT_URL=https://pay.example.com`, then rebuild. Also update the Site URL and redirect URL in Supabase (step 2.3). If you'd rather not run a proxy, `http://<server-ip>:3000` and `:7000` work for testing, but customers should only ever see HTTPS.

### 3.4 Finish the gateway setup (one time)

YouPI needs two things only you can provide. Do them in its **Merchant Admin**, which is published on the server's loopback only. Reach it through an SSH tunnel:

```bash
ssh -L 6001:localhost:6001 you@your-server     # then open http://localhost:6001
docker compose exec app cat /app/youpi/data/.secrets/admin_api_token    # the admin token it asks for
```

1. **Link WhatsApp** (scan the QR code). Customers get a one-time code on WhatsApp before paying.
2. **Connect a payment observer:** YouPI's Android app on a phone that receives your bank's SMS, or the Gmail observer for your bank's alert emails. This is how YouPI confirms money arrived.

Details: [docs/PAYMENTS.md](docs/PAYMENTS.md).

### 3.5 Operate

| Task | Command |
|---|---|
| Logs | `docker compose logs -f` |
| Restart | `docker compose restart` |
| Update after `git pull` | `docker compose --env-file .env.docker up -d --build`, then run any new `supabase/migrations/*.sql` |
| Stop | `docker compose down` (data is kept) |
| Back up gateway data | `docker run --rm -v upstore_upstore-data:/d -v "$PWD":/b alpine tar czf /b/upstore-data.tgz -C /d .` |

Store data (orders, customers, products) lives in Supabase; enable its backups too. The `upstore-data` volume holds the gateway's database and generated secrets. **Deleting it resets the gateway** (pairing, WhatsApp link, payment history).

> **Licensing:** YouPI has no open-source license, so its code isn't in this repo. The image build downloads it from upstream. Keep images you build **private**: don't push them to a public registry.

## 4. Local development

Requirements: **Node.js 22+**. Docker is only needed to run the payment gateway locally.

```bash
npm install
cp .env.example .env.local      # fill in the Supabase values (step 2.5)
npm run dev                     # http://localhost:3000
```

With `PAYMENT_PROVIDER=fake` (the template's default), checkout uses a built-in test page with **Pay** and **Fail** buttons. No gateway is needed.

To develop against the real gateway, run YouPI on its own in Docker:

```bash
npm run gateway:init            # generate gateway secrets (gateway/.env, gitignored)
npm run gateway:up              # build and start YouPI (API :6100, checkout :7000, admin :6001)
npm run gateway:configure -- --upi=yourname@okbank --payee="Your Name"
```

`gateway:configure` writes `PAYMENT_PROVIDER=youpi` and the `YOUPI_*` settings into `.env.local`. Other commands: `gateway:status`, `gateway:logs`, `gateway:down`.

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / server (`next start`) |
| `npm run lint` | ESLint |
| `npx next typegen && npx tsc --noEmit` | Type-check |

## 5. Payments (UPI)

Payments use [YouPI PG](https://github.com/youpi-pg/YouPI-PG), a self-hosted UPI gateway with no per-transaction fees:

1. The customer places an order and is sent to YouPI's hosted checkout (WhatsApp OTP, then a UPI QR code or app link).
2. YouPI detects the payment from your bank's alerts and sends the store a signed webhook.
3. The store checks the signature, asks YouPI directly for the payment's status, and marks the order **paid** only if YouPI reports a non-COD `SUCCESS` and the amount and currency match the order exactly.
4. If the payment fails, expires or is cancelled, the order stays **awaiting payment** and the customer can retry from their order page.

The store currency must be **INR** (Admin → Settings) when using YouPI.

> **Read before taking real money:** YouPI's authors describe it as an **experimental research project**, not a certified or bank-approved gateway. They suggest at most ~20 payments a day per receiving account. Reconcile orders against your bank statement.

Gateway setup, production options (including YouPI's own Cloudflare mode), upgrades and troubleshooting: **[docs/PAYMENTS.md](docs/PAYMENTS.md)**. To add Stripe, Razorpay or another provider, implement the `PaymentProvider` interface in `lib/payments/` (see AGENTS.md → Recipes).

## 6. Emails & invoices

Order emails go out through SMTP; the defaults are for Gmail.

1. On the Gmail account that will send mail, turn on **2-Step Verification**, then create an **App Password** (Google Account → Security → App passwords). Gmail doesn't accept your normal password for SMTP.
2. Set these in `.env.docker` (Docker) or `.env.local` (development), then restart:
   ```env
   SMTP_USER=yourstore@gmail.com
   SMTP_PASS=abcdefghijklmnop                # 16-character App Password, no spaces
   MAIL_FROM="Your Store <yourstore@gmail.com>"
   MAIL_ADMIN_TO=you@example.com             # optional: new-order alerts
   ```
   `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` default to Gmail (`smtp.gmail.com`, 465, SSL). Change them to use another provider.
3. In **Admin → Settings**, fill in your legal name, address, GSTIN (optional) and support email. These are printed on invoices, and the support email is the reply-to address. Click **Send test** to check delivery.

| When | Customer gets | Admin gets |
|---|---|---|
| Payment confirmed (or admin marks a pending order paid) | Order confirmation + **PDF invoice** | New-order alert (`MAIL_ADMIN_TO`) |
| Admin sets **shipped** | Shipped email with the note typed in (e.g. tracking number) | |
| Admin sets **delivered** | Delivered email with a review link | |
| Order cancelled (customer or admin) | Cancellation email (with a refund note if it was paid) | |

- **Invoices** are numbered when an order is first paid (`INV-000001`, …; prefix set in Settings) and never renumbered. Customers download them from their order page; admins from the admin order page.
- **No duplicates:** each email is sent at most once per order. The admin order page lists every email with a **Resend** button.
- **Without SMTP settings**, emails are logged as *skipped* and everything else keeps working.
- **Gmail limits:** about 500 recipients a day (2,000 on Google Workspace). For more, point `SMTP_*` at a provider such as Brevo, Mailgun or Amazon SES.
- **Sign-in emails** (confirm email, reset password) come from Supabase. To send them from the same Gmail account, enter the same SMTP details in Supabase → **Authentication → Emails → SMTP Settings**.

## 7. Try the full flow

1. Browse the catalog, add items to the cart as a guest, then sign in. The cart is kept.
2. At checkout, add an address and apply `WELCOME10` (from the seed data).
3. Pay through the YouPI checkout, or use the **Pay** button on the test page with `PAYMENT_PROVIDER=fake`. You'll receive the confirmation email with the invoice.
4. As admin, open the order and move it to **shipped** (add a tracking note), then **delivered**. The customer gets each email and can now review the product.

## 8. Configuration reference

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | both · **build-time in Docker** | Supabase project |
| `SUPABASE_SECRET_KEY` | both | Server-only Supabase key (payments, emails, invoices) |
| `NEXT_PUBLIC_SITE_URL` | both · **build-time in Docker** | Public store URL: emails, auth redirects, payment returns |
| `PAYMENT_PROVIDER` | both | `youpi` or `fake` (Docker default `youpi`, local template `fake`) |
| `YOUPI_PUBLIC_CHECKOUT_URL` | both | Public checkout URL customers are sent to |
| `YOUPI_UPI_ID`, `YOUPI_PAYEE_NAME`, `STORE_NAME` | Docker | Applied to the gateway on every start |
| `YOUPI_API_URL`, `YOUPI_MERCHANT_ID`, `YOUPI_WEBHOOK_SECRET` | local | Set by `npm run gateway:configure`; automatic in Docker |
| `ADMIN_API_TOKEN`, `YOUPI_WEBHOOK_SECRET` | Docker (optional) | Generated and stored in the data volume when empty |
| `CLOUDFLARE_DOMAIN`, `DEPLOYMENT_PREFIX` | Docker (optional) | YouPI's own production mode via its Cloudflare Tunnel |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `MAIL_ADMIN_TO` | both | Email |
| `STORE_PORT`, `CHECKOUT_PORT`, `ADMIN_PORT` | Docker (optional) | Host ports (default 3000 / 7000 / 6001) |

Templates: `.env.example` (local), `.env.docker.example` (Docker), `gateway/.env.example` (local gateway). Real env files are gitignored.

## 9. Make it yours & further docs

- **Rebrand / redesign:** start with `site.config.ts` (name, hero, home sections, footer), then read **[CUSTOMIZING.md](CUSTOMIZING.md)** for colors, fonts, page structure, email/invoice styling, and the backend contract your UI must keep.
- **Payments deep-dive:** [docs/PAYMENTS.md](docs/PAYMENTS.md)
- **Architecture, conventions, recipes:** [AGENTS.md](AGENTS.md), for contributors and AI coding agents.
- **Money** is stored as integer minor units (₹499.00 → `49900`). Changing the currency relabels prices but doesn't convert them; past orders keep their currency.
