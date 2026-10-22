// Configure a YouPI gateway for UpStore through its admin API. No dependencies.
// Used by scripts/gateway.mjs (local dev CLI) and docker/start.mjs (container startup).

// Receiving accounts seeded by the YouPI demo data. Customers must never be shown a QR for these.
const DEMO_VPAS = ["merchant@upi"];

async function call(apiUrl, token, path, init = {}) {
  const res = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init.headers },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → HTTP ${res.status}: ${body.error ?? JSON.stringify(body)}`);
  return body;
}

/** Resolve once GET /health answers OK; throws after `attempts` × 2s. */
export async function waitForGateway(apiUrl, { attempts = 60, onWait } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return;
    } catch {}
    onWait?.(i);
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Gateway not reachable at ${apiUrl}/health`);
}

/**
 * Point the default merchant at the store: webhook URL + secret, prepaid UPI only
 * (no COD), optional store name; remove the demo receiving account; optionally add
 * and activate the store's UPI ID. Idempotent.
 *
 * @returns {{ merchantId: string, activeUpi: string[] }}
 */
export async function configureMerchant({ apiUrl, adminToken, webhookUrl, webhookSecret, name, upi, payee, log = console.log }) {
  const merchant = await call(apiUrl, adminToken, "/api/v1/admin/merchant-settings", {
    method: "POST",
    body: JSON.stringify({
      ...(name && { businessName: name, branding: { appName: name } }),
      webhookUrl,
      webhookSecret,
      sellingMode: "ONLINE",
      codEnabled: false,
    }),
  });
  log(`✓ Merchant ${merchant.merchantId}: webhook → ${webhookUrl}, methods: ${merchant.enabledPaymentMethods?.join(", ")}`);

  const headers = { "X-Merchant-Id": merchant.merchantId };
  const accounts = async () =>
    (await call(apiUrl, adminToken, `/api/v1/admin/upi-accounts?merchantId=${merchant.merchantId}`, { headers })).accounts ?? [];

  for (const demo of (await accounts()).filter((a) => DEMO_VPAS.includes(a.upiId))) {
    const res = await fetch(`${apiUrl}/api/v1/admin/upi-accounts/${demo.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (res.ok) log(`✓ Removed the gateway's demo UPI account (${demo.upiId})`);
    else if (demo.isActive) {
      // Can't delete once payments reference it; deactivate instead.
      await call(apiUrl, adminToken, `/api/v1/admin/upi-accounts/${demo.id}/toggle`, { method: "POST" });
      log(`✓ Deactivated the gateway's demo UPI account (${demo.upiId})`);
    }
  }

  if (upi) {
    let account = (await accounts()).find((a) => a.upiId === upi);
    if (!account) {
      ({ account } = await call(apiUrl, adminToken, "/api/v1/admin/upi-accounts", {
        method: "POST",
        body: JSON.stringify({ merchantId: merchant.merchantId, upiId: upi, payeeName: payee, isActive: true }),
      }));
    }
    // Activating one account deactivates the merchant's others.
    await call(apiUrl, adminToken, `/api/v1/admin/upi-accounts/${account.id}/activate`, { method: "POST" });
    log(`✓ Payments go to ${upi}`);
  }

  const activeUpi = (await accounts()).filter((a) => a.isActive).map((a) => a.upiId);
  return { merchantId: merchant.merchantId, activeUpi };
}
