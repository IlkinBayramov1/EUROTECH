import { apiClient } from '../client';

export interface UploadDocPayload {
  dossierId: string;
  applicantId: string;
  requiredDocumentType: string;
  isMandatory?: boolean;
  isSharedWithFamily?: boolean;
  file: File;
}

export const documentService = {
  uploadDocument: (payload: UploadDocPayload) => {
    const formData = new FormData();
    formData.append('dossierId', payload.dossierId);
    formData.append('applicantId', payload.applicantId);
    formData.append('requiredDocumentType', payload.requiredDocumentType);
    if (payload.isMandatory !== undefined) {
      formData.append('isMandatory', String(payload.isMandatory));
    }
    if (payload.isSharedWithFamily !== undefined) {
      formData.append('isSharedWithFamily', String(payload.isSharedWithFamily));
    }
    formData.append('file', payload.file);

    return apiClient.post('/documents/upload', formData);
  },

  getSignedUrl: (documentId: string) =>
    apiClient.get(`/documents/${documentId}/signed-url`),

  toggleFamilySharing: (documentId: string, isSharedWithFamily: boolean) =>
    apiClient.patch(`/documents/${documentId}/family-sharing`, { isSharedWithFamily }),

  deleteDocument: (documentId: string) =>
    apiClient.delete(`/documents/${documentId}`),

  exportChecklist: (dossierId: string, format: 'pdf' | 'excel' = 'pdf') =>
    apiClient.get(`/documents/dossier/${dossierId}/export-checklist?format=${format}`),
};

