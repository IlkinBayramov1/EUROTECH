import { apiClient } from '../client';

export interface CreateGroupPayload {
  name: string;
  destination: string;
  travelDate: string;
  duration?: string;
  projectReason?: string;
}

export interface PayoutPayload {
  amount: number;
  bankName: string;
  iban: string;
  swiftBic: string;
}

export const agentService = {
  createGroup: (payload: CreateGroupPayload) => apiClient.post('/agent/groups', payload),

  getGroups: () => apiClient.get('/agent/groups'),

  getGroupById: (groupId: string) => apiClient.get(`/agent/groups/${groupId}`),

  submitGroup: (groupId: string) => apiClient.post(`/agent/groups/${groupId}/submit`),

  getWallet: () => apiClient.get('/agent/wallet'),

  requestPayout: (payload: PayoutPayload) => apiClient.post('/agent/payout-request', payload),

  getCsvUrl: () => `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'}/agent/transactions/export-csv`,
};
