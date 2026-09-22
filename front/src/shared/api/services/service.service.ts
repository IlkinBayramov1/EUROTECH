import { apiClient } from '../client';

export interface AddServicePayload {
  dossierId: string;
  applicantId?: string;
  serviceType: string;
}

export interface CheckoutServicesPayload {
  dossierId: string;
  items: Array<{
    serviceType: string;
    applicantId?: string;
  }>;
}

export const additionalService = {
  getCatalog: () => apiClient.get('/services/catalog'),
  addService: (payload: AddServicePayload) => apiClient.post('/services/add', payload),
  checkout: (payload: CheckoutServicesPayload) => apiClient.post('/services/checkout', payload),
  removeService: (serviceId: string) => apiClient.delete(`/services/${serviceId}`),
};

export const serviceService = additionalService;
