import { apiClient } from '../client';
import type {
  AdminMetrics,
  AdminDossierListResponse,
  AdminDossier,
  AdminDossierFilter,
  DocumentReviewPayload,
  ConsularDecisionPayload,
} from '@/shared/types/admin.types';

export const adminService = {
  // 1. Dashboard Metrics
  getMetrics: () => 
    apiClient.get<{ success: boolean; data: { metrics: AdminMetrics } }>('/admin/metrics'),

  // 2. Dossiers List with Filter and Pagination
  getAllDossiers: (params?: AdminDossierFilter) => {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'ALL') query.append('status', params.status);
    if (params?.portalType && params.portalType !== 'ALL') query.append('portalType', params.portalType);
    if (params?.search) query.append('search', params.search);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));

    const qs = query.toString();
    return apiClient.get<{ success: boolean; data: AdminDossierListResponse }>(
      `/admin/dossiers${qs ? `?${qs}` : ''}`
    );
  },

  // 3. Single Dossier Details
  getDossierById: (dossierId: string) =>
    apiClient.get<{ success: boolean; data: { dossier: AdminDossier } }>(`/dossiers/${dossierId}`),

  // 4. Document Review & Operator Decision
  reviewDocument: (documentId: string, payload: DocumentReviewPayload) =>
    apiClient.patch(`/documents/${documentId}/review`, payload),

  // 5. Send Correction Feedback Email
  sendFeedback: (dossierId: string, notes?: string) =>
    apiClient.post(`/documents/dossier/${dossierId}/send-feedback`, { notes }),

  // 6. Final Consular Decision on Dossier
  updateDossierDecision: (dossierId: string, payload: ConsularDecisionPayload) =>
    apiClient.patch(`/admin/dossier/${dossierId}/decision`, payload),

  // 7. Signed URL for Document Download/View
  getDocumentSignedUrl: (documentId: string) =>
    apiClient.get(`/documents/${documentId}/signed-url`),

  // 8. Export Checklist
  exportChecklist: (dossierId: string) =>
    apiClient.get(`/documents/dossier/${dossierId}/export-checklist`),

  // 9. Get Dossier Summary PDF
  getSummaryPdf: (dossierId: string) =>
    apiClient.get(`/dossiers/${dossierId}/summary-pdf`),

  // 10. Get Countries for Settings
  getCountries: () =>
    apiClient.get('/templates/countries'),

  // 11. Get Visa Categories for Settings
  getVisaCategories: (countryId?: string) =>
    apiClient.get(`/templates/visa-categories${countryId ? `?countryId=${countryId}` : ''}`),

  // 12. Security & Compliance Audit Logs
  getAuditLogs: (params?: { page?: number; limit?: number; action?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.action && params.action !== 'ALL') query.append('action', params.action);
    if (params?.search) query.append('search', params.search);
    const qs = query.toString();
    return apiClient.get(`/admin/audit-logs${qs ? `?${qs}` : ''}`);
  },

  // 13. System Settings Configuration
  getSettings: () => apiClient.get('/admin/settings'),
  updateSettings: (payload: Record<string, any>) => apiClient.patch('/admin/settings', payload),

  // 14. Master Data CRUD
  saveCountry: (payload: any) => apiClient.post('/admin/countries', payload),
  saveVisaCategory: (payload: any) => apiClient.post('/admin/categories', payload),
  saveTimeSlot: (payload: any) => apiClient.post('/admin/slots', payload),

  // 15. Integrations & Live Health Diagnostics
  getIntegrationsHealth: () => apiClient.get('/admin/integrations/health'),

  // 16. Financial Approvals: Bank Payment Receipts
  getBankSlips: () => apiClient.get('/admin/bank-slips'),
  reviewBankSlip: (receiptId: string, payload: { status: 'APPROVED' | 'REJECTED'; notes?: string }) =>
    apiClient.patch(`/admin/bank-slips/${receiptId}/review`, payload),

  // 17. Financial Approvals: Agent Payout Requests
  getAgentPayouts: () => apiClient.get('/admin/agent-payouts'),
  updateAgentPayoutStatus: (payoutId: string, status: 'PROCESSED' | 'REJECTED') =>
    apiClient.patch(`/admin/agent-payouts/${payoutId}`, { status }),

  // 18. Cron Monitor Diagnostics
  getCronMonitorStatus: () => apiClient.get('/admin/cron-monitor'),

  // 19. Dossier Archive ZIP
  getArchiveZip: (dossierId: string) => apiClient.get(`/dossiers/${dossierId}/archive-zip`),

  // 20. User Wallets & Balances Oversight
  getUserWallets: (params?: { role?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.role && params.role !== 'ALL') query.append('role', params.role);
    if (params?.search) query.append('search', params.search);
    const qs = query.toString();
    return apiClient.get(`/admin/wallets${qs ? `?${qs}` : ''}`);
  },
  adjustUserWallet: (
    userId: string,
    payload: { amount: number; type: 'CREDIT' | 'DEBIT'; reason: string }
  ) => apiClient.post(`/admin/wallets/${userId}/adjust`, payload),
};
