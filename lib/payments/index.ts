import "server-only";
import { fakeProvider } from "./fake";
import { youpiProvider } from "./youpi";

export interface PaymentOrder {
  id: string;
  order_number: number;
  total: number;
  currency: string;
}

/** A provider-reported outcome for one of our orders. Amount is in minor units. */
export interface PaymentResult {
  orderId: string;
  success: boolean;
  reference: string;
  amount: number;
  currency: string;
  raw?: Record<string, unknown>;
}

/**
 * The only surface checkout code talks to. Select one with PAYMENT_PROVIDER.
 *
 * Results are never trusted from the browser: providers report them from the
 * server (webhook route or lookup()), and lib/payments/settle.ts checks the
 * amount and order state before calling record_payment.
 */
export interface PaymentProvider {
  id: string;
  /** Start a payment; returns where to send the customer. */
  createPayment(order: PaymentOrder): Promise<{ redirectUrl: string }>;
  /** Ask the provider, server-to-server, for an order's final result. null = not finished / unknown. */
  lookup(orderId: string): Promise<PaymentResult | null>;
}

const PROVIDERS: Record<string, PaymentProvider> = {
  fake: fakeProvider,
  youpi: youpiProvider,
};

export function getPaymentProvider(): PaymentProvider {
  const id = process.env.PAYMENT_PROVIDER || "fake";
  const provider = PROVIDERS[id];
  if (!provider) throw new Error(`Unknown PAYMENT_PROVIDER "${id}". Use one of: ${Object.keys(PROVIDERS).join(", ")}`);
  return provider;
}
