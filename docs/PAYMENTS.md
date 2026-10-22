# Payments: deploying YouPI PG

UpStore takes UPI payments through [YouPI PG](https://github.com/youpi-pg/YouPI-PG), a gateway you host yourself. This guide covers running it next to the store, locally and in production.

> **Read this first.** YouPI's authors describe it as an **experimental research project**, not a certified, bank-approved or production-ready gateway. They suggest at most **20 payments a day per receiving account** and independent reconciliation against your bank statement. Read the safety section of their README before accepting real money.
>
> **Licensing:** YouPI has no open-source license (its `package.json` says `"license": "Commercial"`). This repo therefore **does not contain YouPI's code**. `gateway/docker-compose.yml` builds it from the upstream repository at a pinned commit when you deploy. Check that your use is permitted by its authors.

## How the pieces fit

```
 Customer ──► Store (Next.js) ──place order──► YouPI API :6100  (server-to-server, X-Merchant-Key)
    │                                              │
    └──────── redirected to hosted checkout ──► YouPI Checkout :7000  (WhatsApp OTP → UPI QR / app)
                                                   │
         bank alert (SMS / app notification / Gmail) ──► YouPI observer ──► payment matched
                                                   │
 Store /api/payments/youpi ◄── signed webhook ─────┘   store re-fetches the status from the API,
 Store /checkout/return    ◄── customer redirected      then marks the order paid
 Store /order-failed       ◄── on failure / expiry      (order stays "awaiting payment", retry possible)
```

An order is marked paid only when **the gateway API itself** reports `SUCCESS` for a non-COD payment whose amount and currency match the order exactly. Webhook signatures are checked, but never trusted on their own. See `lib/payments/youpi.ts` and `app/api/payments/youpi/route.ts`.

## Deployment with the all-in-one container (recommended)

The repo's `Dockerfile` bundles YouPI with the store in one image, and `docker/start.mjs` configures the gateway on every start. You only set `YOUPI_UPI_ID`, `YOUPI_PAYEE_NAME` and `YOUPI_PUBLIC_CHECKOUT_URL` in `.env.docker`. Setup, HTTPS and operations are in the README, section 3. The rest of this page covers running the gateway separately for local development, and gateway details that apply to both.

In the container:
- the store calls the gateway at `127.0.0.1:6100` (not published);
- webhooks go to `http://127.0.0.1:3000/api/payments/youpi`;
- the admin token and webhook secret are generated into the data volume unless you set `ADMIN_API_TOKEN` / `YOUPI_WEBHOOK_SECRET`.

Read the admin token with `docker compose exec app cat /app/youpi/data/.secrets/admin_api_token`.

## Local setup (gateway on its own)

Requirements: Docker Desktop (or Docker Engine with Compose v2).

```bash
npm run gateway:init        # creates gateway/.env with fresh random secrets (gitignored)
npm run gateway:up          # builds YouPI from GitHub (first time: several minutes) and starts it
npm run gateway:configure -- --upi=yourname@okbank --payee="Your Name" --name="UpStore"
npm run dev                 # restart the store so it picks up PAYMENT_PROVIDER=youpi
```

`gateway:configure` talks to the gateway's admin API and:
- points the merchant's webhook at `http://host.docker.internal:3000/api/payments/youpi`, the store on your machine as seen from the container;
- sets a webhook secret and turns cash on delivery off (prepaid UPI only);
- adds your UPI receiving account;
- writes `PAYMENT_PROVIDER=youpi`, `YOUPI_API_URL`, `YOUPI_MERCHANT_ID` and `YOUPI_WEBHOOK_SECRET` into `.env.local`.

It's safe to run again, and `gateway:up` runs it automatically after starting the gateway. YouPI re-creates its demo receiving account (`merchant@upi`) whenever a merchant has no UPI account, and this step removes it again. Use `npm run gateway:status` to check the connection.

| Service | URL | Who uses it |
|---|---|---|
| Payment API | http://localhost:6100 | The store's server |
| Hosted checkout | http://localhost:7000 | Customers' browsers |
| Merchant Admin | http://localhost:6001 (loopback only) | You. When it asks for the admin token, paste `ADMIN_API_TOKEN` from `gateway/.env` |

### Two things only you can set up

The gateway needs these to complete a real payment. Both involve your own phone and bank, so the script can't do them. Do them in **Merchant Admin**:

1. **WhatsApp:** link a WhatsApp account by scanning the QR code. The hosted checkout sends each new customer a one-time code over WhatsApp before they can pay.
2. **A payment observer.** This is how the gateway learns money arrived. Pick at least one:
   - the **Android observer app**, installed on a phone that receives your bank's SMS/notifications, paired by QR;
   - the **Gmail observer**, connected to the inbox that receives your bank's credit alerts.

   See YouPI's `docs/OBSERVERS_SETUP.md` and `docs/ANDROID_MOBILE_APP.md`.

Without an observer, customers can pay but the gateway never confirms it. The payment ends as `FAILED` after its 30-second verification window, and the order stays "awaiting payment".

### Testing without WhatsApp or a bank

In `gateway/.env` (localhost mode only), set:

```env
NODE_ENV=development
YOUPI_EXPOSE_DEV_OTP=true      # checkout shows the OTP instead of sending it
YOUPI_ALLOW_DEV_TOOLS=true     # Merchant Admin developer simulator can inject a fake bank alert
```

Then run `npm run gateway:up`. Place an order in the store, go through the hosted checkout, and use the simulator in Merchant Admin to "receive" the payment. Production mode forces these switches off.

### Switching back to the test page

Set `PAYMENT_PROVIDER=fake` in `.env.local` and restart the store. Leave the gateway running or stop it with `npm run gateway:down`. Gateway data persists in the `youpi-data` Docker volume.

## Production

1. **Host:** a small VM, or the same one as the store, with Docker. Copy `gateway/` there and run `npm run gateway:init` (or copy `gateway/.env.example` to `gateway/.env` and fill in the secrets yourself).
2. **Domain:** YouPI's production mode serves the checkout at `https://<prefix>.<domain>` and the API at `https://<prefix>-api.<domain>` through a Cloudflare Tunnel. In `gateway/.env`:
   ```env
   YOUPI_MODE=production
   CLOUDFLARE_DOMAIN=yourstore.com
   DEPLOYMENT_PREFIX=pay
   # Remove YOUPI_ALLOW_PRIVATE_WEBHOOKS: the store's public https URL doesn't need it.
   ```
   Set up the tunnel from Merchant Admin (Settings → domain / tunnel). See YouPI's `docs/DEPLOYMENT.md` and `docs/WHITE_LABEL.md`.
3. **Store:** in the store's production environment, set `NEXT_PUBLIC_SITE_URL` to its public URL. Then run:
   ```bash
   npm run gateway:configure -- --api-url=https://pay-api.yourstore.com --webhook-url=https://yourstore.com/api/payments/youpi --upi=… --payee=…
   ```
   Or set `PAYMENT_PROVIDER`, `YOUPI_API_URL`, `YOUPI_MERCHANT_ID` and `YOUPI_WEBHOOK_SECRET` directly in your host's environment, for example Vercel project settings.
4. **Ports:** expose only the checkout (7000) and API (6100), through the tunnel or a reverse proxy with TLS. Merchant Admin (6001), the observers (6002/6003) and the supervisor (8090) are bound to loopback in the compose file. Keep them that way, or put them behind authentication.
5. **Store currency** must stay **INR** (Admin → Settings). The YouPI provider refuses other currencies.
6. **Back up** the `youpi-data` volume (SQLite). Reconcile paid orders against your bank statement regularly.

## Upgrading YouPI

The pinned commit is the `YOUPI_REF` default in `gateway/docker-compose.yml`. To upgrade:
1. Review the upstream changes, especially `apps/payment-api/src/routes/payments.routes.js`, `packages/core/src/webhook-engine.js` and the checkout redirects.
2. Run `YOUPI_REF=<new full commit sha> npm run gateway:up`, or change the default in the compose file.
3. Place a test order end to end.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Pay page: "YouPI is not configured" | `.env.local` missing `YOUPI_*`. Run `npm run gateway:configure`, then restart the store |
| Pay page: "No active UPI receiving account configured" | Run `gateway:configure -- --upi=…`, or activate an account in Merchant Admin |
| Pay page: "Merchant API key is required" / "Invalid merchant key" | `YOUPI_WEBHOOK_SECRET` doesn't match the gateway. Re-run `gateway:configure` |
| Customer paid but the order stays "awaiting payment" | No observer connected or alert not matched. Check Merchant Admin → payments/observers |
| Webhooks failing in Merchant Admin | Store unreachable from the container. Locally, keep `YOUPI_ALLOW_PRIVATE_WEBHOOKS=true` and use the `host.docker.internal` URL. Payments are still confirmed when the customer returns to the store |
| "YouPI only supports INR" | Store currency changed in Admin → Settings |
