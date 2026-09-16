import { apiClient } from '../client';

export interface CreateBatchPayload {
  name: string;
  destination: string;
  travelDate: string;
  duration?: string;
  projectReason?: string;
}

export interface EmployeePayload {
  firstName: string;
  lastName: string;
  jobTitle?: string;
  department?: string;
  nationality?: string;
  passportNumber?: string;
  email?: string;
  phone?: string;
}

export const corporateService = {
  getDelegationProfile: (token: string) =>
    apiClient.get(`/corporate/delegation/profile?token=${token}`),

  getBatches: () => apiClient.get('/corporate/batches'),

  createBatch: (payload: CreateBatchPayload) => apiClient.post('/corporate/batches', payload),

  getEmployees: () => apiClient.get('/corporate/employees'),

  addEmployee: (payload: EmployeePayload) => apiClient.post('/corporate/employees', payload),

  generateDelegationLink: (employeeId: string, batchId?: string) =>
    apiClient.post(`/corporate/employees/${employeeId}/delegation-link`, { batchId }),

  generateInvoice: (batchId: string) =>
    apiClient.post(`/corporate/batches/${batchId}/invoice`),

  payWithWallet: (batchId: string) =>
    apiClient.post(`/corporate/batches/${batchId}/pay-wallet`),

  getInvoices: () => apiClient.get('/corporate/invoices'),
};
