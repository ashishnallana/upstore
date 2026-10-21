import "server-only";
import { fakeProvider } from "./fake";

export interface PaymentOrder {
  id: string;
  order_number: number;
  total: number;
  currency: string;
}

export interface PaymentResult {
  orderId: string;
  success: boolean;
  reference: string;
  raw?: Record<string, unknown>;
}

/**
 * The only surface checkout code talks to. To go live, implement this for a
 * real gateway (Stripe, Razorpay, ...) and return it from getPaymentProvider().
 * Gateways that confirm via webhook should call verifyPayment from a Route
 * Handler and then record_payment with the service-role client.
 */
export interface PaymentProvider {
  id: string;
  /** Start a payment; returns the URL to send the customer to. */
  createPayment(order: PaymentOrder): Promise<{ redirectUrl: string }>;
  /** Validate a provider callback / client confirmation. Never trust it unverified. */
  verifyPayment(input: Record<string, string>): Promise<PaymentResult>;
}

export function getPaymentProvider(): PaymentProvider {
  return fakeProvider;
}
