import { apiClient } from '../client';
import { storage } from '../../utils/storage';

export interface CreateGroupPayload {
  name: string;
  destination: string;
  travelDate: string;
  duration?: string;
  projectReason?: string;
  package?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  applicants?: Array<{
    firstName?: string;
    lastName?: string;
    passportNumber?: string;
    dob?: string;
    issueDate?: string;
    expiryDate?: string;
    [key: string]: any;
  }>;
}

export interface PayoutPayload {
  amount: number;
  bankName: string;
  iban: string;
  swiftBic: string;
}

const getAuthToken = (): string | null => {
  return (
    storage.getToken() ||
    sessionStorage.getItem('eurotech_access_token') ||
    localStorage.getItem('eurotech_access_token') ||
    sessionStorage.getItem('token') ||
    localStorage.getItem('token')
  );
};

export const agentService = {
  createGroup: (payload: CreateGroupPayload) => apiClient.post('/agent/groups', payload),

  getGroups: () => apiClient.get('/agent/groups'),

  getAgentAppointments: () => apiClient.get('/agent/appointments'),

  getGroupById: (groupId: string) => apiClient.get(`/agent/groups/${groupId}`),

  updateGroup: (groupId: string, payload: { name: string }) =>
    apiClient.patch(`/agent/groups/${groupId}`, payload),

  deleteGroup: (groupId: string) =>
    apiClient.delete(`/agent/groups/${groupId}`),

  submitGroup: (groupId: string) => apiClient.post(`/agent/groups/${groupId}/submit`),

  getWallet: () => apiClient.get('/agent/wallet'),

  requestPayout: (payload: PayoutPayload) => apiClient.post('/agent/payout-request', payload),

  saveBankDetails: (payload: { bankName: string; iban: string; swiftBic: string; accountHolder?: string }) =>
    apiClient.post('/agent/wallet/bank-details', payload),

  addApplicant: (groupId: string, payload: { firstName?: string; lastName?: string; passportNumber?: string; name?: string; passport?: string; formData?: any }) =>
    apiClient.post(`/agent/groups/${groupId}/applicants`, payload),

  removeApplicant: (groupId: string, applicantId: string) =>
    apiClient.delete(`/agent/groups/${groupId}/applicants/${applicantId}`),

  saveApplicantForm: (groupId: string, applicantId: string, formData: any) =>
    apiClient.patch(`/agent/groups/${groupId}/applicants/${applicantId}/form`, { formData }),

  exportCsv: async () => {
    const token = getAuthToken();
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
    const res = await fetch(`${API_URL}/agent/transactions/export-csv`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.message || 'CSV faylını yükləmək mümkün olmadı.');
    }
    return await res.blob();
  },

  getCsvUrl: () => {
    const token = getAuthToken();
    const baseUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'}/agent/transactions/export-csv`;
    return token ? `${baseUrl}?token=${encodeURIComponent(token)}` : baseUrl;
  },
};

