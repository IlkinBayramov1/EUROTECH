import { apiClient } from '../client';

export interface PaymentIntentResponse {
  paymentIntentId: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
}

export interface BankOrderResponse {
  orderId: string;
  redirectUrl: string;
  amount: number;
  currency: string;
}

export interface BankReceipt {
  id: string;
  dossierId?: string;
  groupBatchId?: string;
  receiptNumber?: string;
  bankName?: string;
  amount: number;
  currency: string;
  depositDate?: string;
  senderName?: string;
  purpose?: string;
  fileUrl: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  createdAt: string;
}

export const paymentService = {
  createPaymentIntent: async (data: {
    dossierId?: string;
    groupBatchId?: string;
    invoiceId?: string;
    purpose?: string;
    amount?: number;
    currency?: string;
  }): Promise<PaymentIntentResponse> => {
    const res = await apiClient.post<any>('/payments/create-intent', data);
    return res?.data || res;
  },

  confirmPaymentMock: async (data: {
    paymentIntentId: string;
    bankReference?: string;
  }): Promise<{ success: boolean; transaction: any }> => {
    const res = await apiClient.post<any>('/payments/confirm-mock', data);
    return res?.data || res;
  },

  createLocalBankOrder: async (data: {
    dossierId?: string;
    groupBatchId?: string;
    amount: number;
    orderDescription?: string;
  }): Promise<BankOrderResponse> => {
    const res = await apiClient.post<any>('/payments/local-bank/create-order', data);
    return res?.data || res;
  },

  submitBankSlip: async (formData: FormData): Promise<BankReceipt> => {
    const res = await apiClient.post<any>('/payments/bank-slip', formData);
    return res?.data?.receipt || res?.data || res;
  },

  getAllBankSlips: async (status?: string): Promise<BankReceipt[]> => {
    const endpoint = status ? `/payments/bank-slips?status=${encodeURIComponent(status)}` : '/payments/bank-slips';
    const res = await apiClient.get<any>(endpoint);
    return res?.data?.slips || res?.data || [];
  },

  reviewBankSlip: async (
    receiptId: string,
    data: { action: 'APPROVED' | 'REJECTED'; adminNotes?: string }
  ): Promise<any> => {
    const res = await apiClient.patch<any>(`/payments/bank-slip/${receiptId}/review`, data);
    return res?.data || res;
  },

  // EuroTech Pre-Funded Multi-Currency Wallet Engine
  getUserWallet: async (): Promise<any> => {
    const res = await apiClient.get<any>('/payments/wallet/overview');
    return res;
  },

  topupWallet: async (data: {
    amount: number;
    currency?: string;
    method?: string;
    reference?: string;
  }): Promise<any> => {
    const res = await apiClient.post<any>('/payments/wallet/topup', data);
    return res;
  },

  payWithWallet: async (data: {
    dossierId?: string | null;
    groupBatchId?: string | null;
    invoiceId?: string | null;
  }): Promise<any> => {
    const res = await apiClient.post<any>('/payments/wallet/pay', data);
    return res;
  },
};
