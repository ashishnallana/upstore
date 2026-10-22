import "server-only";
import type { PaymentProvider } from "./index";

/**
 * Development provider: the customer picks the outcome on /checkout/pay/[id]
 * and the payOrder action records it. Never enable in production.
 */
export const fakeProvider: PaymentProvider = {
  id: "fake",
  async createPayment(order) {
    return { redirectUrl: `/checkout/pay/${order.id}` };
  },
  async lookup() {
    return null;
  },
};
