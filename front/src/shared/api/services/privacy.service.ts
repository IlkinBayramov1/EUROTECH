import { apiClient } from '../client';

export const privacyService = {
  exportData: () => apiClient.get('/privacy/export-data'),
  anonymize: () => apiClient.post('/privacy/anonymize'),
};
