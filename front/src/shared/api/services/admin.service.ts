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
};
