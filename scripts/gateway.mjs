#!/usr/bin/env node
// Helper for the self-hosted YouPI gateway in gateway/. No dependencies.
//
//   node scripts/gateway.mjs init
//       Create gateway/.env from the template with fresh random secrets.
//   node scripts/gateway.mjs configure [--upi=you@bank] [--payee="Name"] [--webhook-url=URL]
//       Point the gateway's merchant at this store (webhook URL + secret, UPI only,
//       store name), optionally add a UPI receiving account, then write
//       PAYMENT_PROVIDER=youpi and the YOUPI_* settings into .env.local.
//   node scripts/gateway.mjs status
//       Check the gateway is up and show what the store is configured with.

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { configureMerchant, waitForGateway } from "./lib/youpi-admin.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const GATEWAY_ENV = join(root, "gateway", ".env");
const GATEWAY_TEMPLATE = join(root, "gateway", ".env.example");
const STORE_ENV = join(root, ".env.local");
const SECRET_KEYS = ["ADMIN_API_TOKEN", "OBSERVER_API_TOKEN", "ENCRYPTION_MASTER_KEY", "JWT_SECRET", "ANDROID_ENROLLMENT_SECRET", "INITIAL_ADMIN_PASSWORD"];

const [command, ...rest] = process.argv.slice(2);
const args = Object.fromEntries(
  rest.map((a) => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    return m ? [m[1], m[2] ?? "true"] : [a, "true"];
  }),
);

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function readEnv(file) {
  if (!existsSync(file)) return {};
  const env = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

/** Set KEY=value lines in an env file, replacing existing keys and appending new ones. */
function writeEnv(file, values) {
  let text = existsSync(file) ? readFileSync(file, "utf8") : "";
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^\\s*#?\\s*${key}\\s*=.*$`, "m");
    text = re.test(text) ? text.replace(re, line) : `${text.replace(/\s*$/, "")}\n${line}\n`;
  }
  writeFileSync(file, text);
}

const secret = () => randomBytes(32).toString("hex");

function init() {
  if (existsSync(GATEWAY_ENV)) {
    const env = readEnv(GATEWAY_ENV);
    const missing = SECRET_KEYS.filter((k) => !env[k]);
    if (!missing.length) return console.log("gateway/.env already exists with all secrets set. Nothing to do.");
    writeEnv(GATEWAY_ENV, Object.fromEntries(missing.map((k) => [k, secret()])));
    return console.log(`Filled missing secrets in gateway/.env: ${missing.join(", ")}`);
  }
  writeFileSync(GATEWAY_ENV, readFileSync(GATEWAY_TEMPLATE, "utf8"));
  writeEnv(GATEWAY_ENV, Object.fromEntries(SECRET_KEYS.map((k) => [k, secret()])));
  console.log("Created gateway/.env with fresh secrets.\nNext: npm run gateway:up");
}

async function configure() {
  const gw = readEnv(GATEWAY_ENV);
  const store = readEnv(STORE_ENV);
  if (!gw.ADMIN_API_TOKEN) fail("gateway/.env has no ADMIN_API_TOKEN. Run: npm run gateway:init");

  const apiUrl = (args["api-url"] ?? store.YOUPI_API_URL ?? "http://localhost:6100").replace(/\/+$/, "");
  const site = (store.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  // From inside the container, the host's localhost is host.docker.internal.
  const webhookUrl = args["webhook-url"] ?? `${site.replace(/\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/, "//host.docker.internal")}/api/payments/youpi`;
  const webhookSecret = store.YOUPI_WEBHOOK_SECRET || secret();

  let merchantId, activeUpi;
  try {
    process.stdout.write(`Waiting for the gateway at ${apiUrl} `);
    await waitForGateway(apiUrl, { onWait: () => process.stdout.write(".") });
    console.log(" ok");
    ({ merchantId, activeUpi } = await configureMerchant({
      apiUrl,
      adminToken: gw.ADMIN_API_TOKEN,
      webhookUrl,
      webhookSecret,
      name: args.name,
      upi: args.upi,
      payee: args.payee,
    }));
  } catch (err) {
    fail(`${err.message}
  Is the gateway running? (npm run gateway:up, then npm run gateway:logs)`);
  }
  if (!activeUpi.length) {
    console.warn("! No active UPI receiving account: checkout will fail until you run");
    console.warn('    npm run gateway:configure -- --upi=you@bank --payee="Your Name"');
  }

  writeEnv(STORE_ENV, {
    PAYMENT_PROVIDER: "youpi",
    YOUPI_API_URL: apiUrl,
    YOUPI_MERCHANT_ID: merchantId,
    YOUPI_WEBHOOK_SECRET: webhookSecret,
  });
  console.log("✓ .env.local updated: PAYMENT_PROVIDER=youpi. Restart the store (npm run dev) to apply.");
  console.log(`\nStill to do in Merchant Admin (http://localhost:6001): link WhatsApp for customer OTPs and set up a payment observer. See docs/PAYMENTS.md.`);
}

async function status() {
  const store = readEnv(STORE_ENV);
  const apiUrl = (store.YOUPI_API_URL ?? "http://localhost:6100").replace(/\/+$/, "");
  console.log(`Store: PAYMENT_PROVIDER=${store.PAYMENT_PROVIDER ?? "(unset → fake)"}  YOUPI_API_URL=${apiUrl}  merchant=${store.YOUPI_MERCHANT_ID || "(unset)"}`);
  try {
    const res = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(3000) });
    console.log(`Gateway: ${res.ok ? "up" : `HTTP ${res.status}`}`);
  } catch {
    console.log("Gateway: not reachable");
  }
}

const commands = { init, configure, status };
if (!commands[command]) fail("Usage: node scripts/gateway.mjs <init|configure|status> [--upi=you@bank --payee=Name --name=StoreName --webhook-url=URL --api-url=URL]");
await commands[command]();
