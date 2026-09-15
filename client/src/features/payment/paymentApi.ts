import { apiClient } from '../../services/apiClient';
import type { Payment, PaymentMethod } from '../../types/payment';

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export const paymentApi = {
  async initiate(payload: { orderId: string; method: PaymentMethod }) {
    const res = await apiClient.post<Envelope<{ payment: Payment }>>('/payments', payload);
    return res.data.data.payment;
  },

  /** `simulate` only has any effect against the mock provider — see
   * mockPaymentProvider.js. A real provider integration would drop this
   * parameter entirely; the call shape (`POST /payments/:id/verify`)
   * would stay the same. */
  async verify(paymentId: string, simulate: 'success' | 'failure' = 'success') {
    const res = await apiClient.post<Envelope<{ payment: Payment }>>(`/payments/${paymentId}/verify`, { simulate });
    return res.data.data.payment;
  },

  async getOwn(paymentId: string) {
    const res = await apiClient.get<Envelope<{ payment: Payment }>>(`/payments/${paymentId}`);
    return res.data.data.payment;
  },
};
