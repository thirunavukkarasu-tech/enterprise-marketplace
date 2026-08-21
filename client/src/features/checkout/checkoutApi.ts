import { apiClient } from '../../services/apiClient';
import type { CheckoutSummary, ShippingMethod } from '../../types/cart';

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export const checkoutApi = {
  async review(payload: { shippingAddressId: string; billingAddressId?: string; shippingMethod?: ShippingMethod }) {
    const res = await apiClient.post<Envelope<{ checkout: CheckoutSummary }>>('/checkout/review', payload);
    return res.data.data.checkout;
  },
};
