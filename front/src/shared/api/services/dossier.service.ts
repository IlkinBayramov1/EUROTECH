import { apiClient } from '../client';

export interface DossierCreatePayload {
  portalType: 'INDIVIDUAL' | 'GROUP_AGENT' | 'CORPORATE';
  countryId: string;
  visaCategoryId: string;
  groupBatchId?: string;
}

export interface ApplicantPayload {
  firstName: string;
  lastName: string;
  passportNumber: string;
  gender?: string;
  nationality?: string;
  birthDate?: string;
  passportExpiry?: string;
  formDataJson?: any;
}

export const dossierService = {
  getMyDossiers: () => apiClient.get('/dossiers/my-dossiers'),
  
  getDossier: (dossierId: string) => apiClient.get(`/dossiers/${dossierId}`),

  createDossier: (payload: DossierCreatePayload) => apiClient.post('/dossiers', payload),

  addApplicants: (dossierId: string, applicants: ApplicantPayload[]) =>
    apiClient.post(`/dossiers/${dossierId}/applicants`, { applicants }),

  updateStep: (dossierId: string, step: number) =>
    apiClient.patch(`/dossiers/${dossierId}/step`, { step }),

  getCountries: () => apiClient.get('/templates/countries'),

  getVisaCategories: (countryId: string) =>
    apiClient.get(`/templates/visa-categories/${countryId}`),

  updateApplicantForm: (dossierId: string, applicantId: string, formData: any) =>
    apiClient.patch(`/dossiers/${dossierId}/applicants/${applicantId}/form`, { formData }),

  deleteApplicant: (dossierId: string, applicantId: string) =>
    apiClient.delete(`/dossiers/${dossierId}/applicants/${applicantId}`),

  getApplicationFormPdf: (dossierId: string, applicantId: string, customData?: any) =>
    apiClient.post(`/dossiers/${dossierId}/applicants/${applicantId}/application-pdf`, customData || {}),

  getDossierSummaryPdf: (dossierId: string) =>
    apiClient.get(`/dossiers/${dossierId}/summary-pdf`),

  getTracking: (dossierIdOrRef: string) =>
    apiClient.get(`/dossiers/track/${dossierIdOrRef}`),
};

