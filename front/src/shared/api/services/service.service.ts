import { apiClient } from '../client';

export interface AddServicePayload {
  dossierId: string;
  applicantId?: string;
  serviceType: string;
}

export const additionalService = {
  addService: (payload: AddServicePayload) => apiClient.post('/services/add', payload),
  removeService: (serviceId: string) => apiClient.delete(`/services/${serviceId}`),
};

export const serviceService = additionalService;
