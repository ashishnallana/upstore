import "server-only";
import type { PaymentProvider } from "./index";

/** Development provider: the customer chooses the outcome on /checkout/pay/[id]. */
export const fakeProvider: PaymentProvider = {
  id: "fake",
  async createPayment(order) {
    return { redirectUrl: `/checkout/pay/${order.id}` };
  },
  async verifyPayment(input) {
    const success = input.outcome === "success";
    return {
      orderId: input.orderId,
      success,
      reference: `FAKE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      raw: { simulated: true, outcome: input.outcome },
    };
  },
};
