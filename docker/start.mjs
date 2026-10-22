// Container entrypoint: runs the YouPI gateway and the UpStore Next.js server
// side by side, wires them together, and stops both if either one dies (so the
// container restart policy brings everything back cleanly).
//
//   /app/youpi   YouPI (built from upstream), data + generated secrets in /app/youpi/data (volume)
//   /app/store   Next.js standalone server
//
// Only the store (3000) and the hosted checkout (7000) need to be public. The
// store talks to the gateway API over loopback (127.0.0.1:6100) and the gateway
// delivers webhooks to the store over loopback too.

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { configureMerchant, waitForGateway } from "./youpi-admin.mjs";

const env = process.env;
const STORE_PORT = env.PORT || "3000";
const GATEWAY_API = "http://127.0.0.1:6100";
const DATA = "/app/youpi/data";
const SECRETS = `${DATA}/.secrets`;
const useYoupi = (env.PAYMENT_PROVIDER || "youpi") === "youpi";

const log = (...a) => console.log("[upstore]", ...a);
const children = new Set();
let stopping = false;

/** A secret from the environment, else one persisted in the data volume (created once). */
function persistentSecret(envName, file) {
  if (env[envName]) return env[envName];
  mkdirSync(SECRETS, { recursive: true });
  const path = `${SECRETS}/${file}`;
  if (!existsSync(path)) writeFileSync(path, randomBytes(32).toString("hex"), { mode: 0o600 });
  return readFileSync(path, "utf8").trim();
}

function without(obj, ...keys) {
  const copy = { ...obj };
  for (const k of keys) delete copy[k];
  return copy;
}

function run(name, cmd, args, opts) {
  const child = spawn(cmd, args, { stdio: "inherit", ...opts });
  children.add(child);
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (stopping) return;
    log(`${name} exited (${signal ?? code}); stopping the container so it can restart cleanly.`);
    shutdown(typeof code === "number" && code !== 0 ? code : 1);
  });
  return child;
}

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const c of children) c.kill("SIGTERM");
  setTimeout(() => process.exit(code), 8000).unref();
  const done = () => children.size === 0 && process.exit(code);
  for (const c of children) c.on("exit", done);
  done();
}
process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));

const storeEnv = { ...env, PORT: STORE_PORT, HOSTNAME: "0.0.0.0", PAYMENT_PROVIDER: useYoupi ? "youpi" : env.PAYMENT_PROVIDER };

if (useYoupi) {
  // Same secrets YouPI would generate itself; resolving them here lets us use the admin token.
  const adminToken = persistentSecret("ADMIN_API_TOKEN", "admin_api_token");
  const webhookSecret = persistentSecret("YOUPI_WEBHOOK_SECRET", "upstore_webhook_secret");

  const domain = env.CLOUDFLARE_DOMAIN;
  run("YouPI gateway", "node", ["scripts/start.js"], {
    cwd: "/app/youpi",
    env: {
      ...without(env, "PORT", "HOSTNAME"),
      NODE_ENV: "production",
      ADMIN_API_TOKEN: adminToken,
      // Production mode needs a Cloudflare domain (YouPI tunnel); otherwise run
      // in localhost mode and let YOUPI_PUBLIC_CHECKOUT_URL fix customer links.
      YOUPI_MODE: domain ? "production" : "localhost",
      YOUPI_ALLOW_LOCALHOST_MODE: domain ? "false" : "true",
      YOUPI_BIND_HOST: "0.0.0.0",
      // Webhooks go to the store over loopback.
      YOUPI_ALLOW_PRIVATE_WEBHOOKS: "true",
      USE_SQLITE_FALLBACK: "true",
      SQLITE_DB_PATH: `${DATA}/youpi_pg.sqlite`,
    },
  });

  try {
    await waitForGateway(GATEWAY_API, { attempts: 90 });
    const { merchantId, activeUpi } = await configureMerchant({
      apiUrl: GATEWAY_API,
      adminToken,
      webhookUrl: `http://127.0.0.1:${STORE_PORT}/api/payments/youpi`,
      webhookSecret,
      name: env.STORE_NAME,
      upi: env.YOUPI_UPI_ID,
      payee: env.YOUPI_PAYEE_NAME,
      log,
    });
    if (!activeUpi.length) log("! No active UPI receiving account. Set YOUPI_UPI_ID (and YOUPI_PAYEE_NAME) and restart.");
    Object.assign(storeEnv, {
      YOUPI_API_URL: GATEWAY_API,
      YOUPI_MERCHANT_ID: merchantId,
      YOUPI_WEBHOOK_SECRET: webhookSecret,
      YOUPI_PUBLIC_CHECKOUT_URL: env.YOUPI_PUBLIC_CHECKOUT_URL || (domain ? "" : "http://localhost:7000"),
    });
  } catch (err) {
    // Keep the shop up (browsing, accounts, admin); checkout will show the error.
    log(`! Could not configure the payment gateway: ${err.message}`);
    Object.assign(storeEnv, { YOUPI_API_URL: GATEWAY_API, YOUPI_WEBHOOK_SECRET: webhookSecret });
  }
  log(`Merchant Admin: port 6001 (admin token in ${SECRETS}/admin_api_token, or ADMIN_API_TOKEN).`);
}

if (!stopping) {
  run("Store", "node", ["server.js"], { cwd: "/app/store", env: storeEnv });
  log(`Store listening on :${STORE_PORT}${useYoupi ? ", checkout on :7000" : ""}`);
}
