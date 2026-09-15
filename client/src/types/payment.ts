import type { PaymentStatus } from './order';

export type PaymentMethod = 'card' | 'upi';

export interface Payment {
  _id: string;
  order: string;
  customer: string;
  amount: number;
  method: PaymentMethod;
  provider: 'mock';
  status: PaymentStatus;
  transactionId: string;
  failureReason?: string;
  processingAt?: string;
  paidAt?: string;
  failedAt?: string;
  cancelledAt?: string;
  refundedAt?: string;
  createdAt: string;
  updatedAt: string;
}
