import { apiClient } from '../client';

export interface CreateBatchPayload {
  name: string;
  destination: string;
  travelDate: string;
  duration?: string;
  projectReason?: string;
  package?: string;
  packagePrice?: number;
  appointmentDate?: string;
  appointmentTime?: string;
  employees?: any[];
  totalAmount?: number;
}

export interface EmployeePayload {
  firstName: string;
  lastName: string;
  jobTitle?: string;
  department?: string;
  nationality?: string;
  passportNumber?: string;
  passportExpiry?: string;
  dob?: string;
  email?: string;
  phone?: string;
}

export interface DepartmentPayload {
  name: string;
  annualBudget?: number;
  spentBudget?: number;
  currency?: string;
}

export interface DepartmentItem {
  id: string;
  name: string;
  annualBudget: number;
  spentBudget: number;
  currency: string;
  employeeCount: number;
  remainingBudget: number;
  percentUsed: number;
  createdAt?: string;
}

export interface ExpiryRadarItem {
  id: string;
  name: string;
  passportNumber: string;
  passportExpiry: string | null;
  daysRemaining: number | null;
  status: 'CRITICAL' | 'WARNING' | 'VALID' | 'EXPIRED' | 'UNKNOWN';
  alertMessage: string;
  department: string;
  jobTitle: string;
  email: string;
}

export interface ExpiryRadarResponse {
  summary: {
    totalEmployees: number;
    criticalCount: number;
    warningCount: number;
    validCount: number;
    expiredCount: number;
  };
  critical: ExpiryRadarItem[];
  warning: ExpiryRadarItem[];
  valid: ExpiryRadarItem[];
  expired: ExpiryRadarItem[];
  items: ExpiryRadarItem[];
}

export const corporateService = {
  getDelegationProfile: (token: string) =>
    apiClient.get(`/corporate/delegation/profile?token=${token}`),

  getBatches: () => apiClient.get('/corporate/batches'),

  createBatch: (payload: CreateBatchPayload) => apiClient.post('/corporate/batches', payload),

  getEmployees: () => apiClient.get('/corporate/employees'),

  addEmployee: (payload: EmployeePayload) => apiClient.post('/corporate/employees', payload),

  updateEmployee: (employeeId: string, payload: Partial<EmployeePayload>) =>
    apiClient.patch(`/corporate/employees/${employeeId}`, payload),

  deleteEmployee: (employeeId: string) =>
    apiClient.delete(`/corporate/employees/${employeeId}`),

  generateDelegationLink: (employeeId: string, batchId?: string) =>
    apiClient.post(`/corporate/employees/${employeeId}/delegation-link`, { batchId }),

  generateInvoice: (batchId: string, amount?: number) =>
    apiClient.post(`/corporate/batches/${batchId}/invoice`, amount !== undefined ? { amount } : {}),

  payWithWallet: (batchId: string) =>
    apiClient.post(`/corporate/batches/${batchId}/pay-wallet`),

  getInvoices: () => apiClient.get('/corporate/invoices'),

  remindEmployee: (employeeId: string) =>
    apiClient.post(`/corporate/employees/${employeeId}/remind`),

  submitBatch: (batchId: string) =>
    apiClient.post(`/corporate/batches/${batchId}/submit`),

  updateBatch: (batchId: string, payload: { name: string }) =>
    apiClient.patch(`/corporate/batches/${batchId}`, payload),

  deleteBatch: (batchId: string) =>
    apiClient.delete(`/corporate/batches/${batchId}`),

  saveEmployeeForm: (batchId: string, employeeId: string, formData: any) =>
    apiClient.patch(`/corporate/batches/${batchId}/employees/${employeeId}/form`, { formData }),

  topupWallet: (amount: number) =>
    apiClient.post('/corporate/wallet/topup', { amount }),

  getWallet: () =>
    apiClient.get('/corporate/wallet'),

  getDashboardStats: () =>
    apiClient.get('/corporate/dashboard/stats'),

  submitDelegationForm: (payload: {
    token: string;
    passportNumber?: string;
    dob?: string;
    passportExpiry?: string;
    phone?: string;
  }) => apiClient.post('/corporate/delegation/submit', payload),

  getInvoicePdf: (invoiceId: string) =>
    apiClient.get(`/corporate/invoices/${invoiceId}/pdf`),

  getDepartments: () =>
    apiClient.get('/corporate/departments'),

  createDepartment: (payload: DepartmentPayload) =>
    apiClient.post('/corporate/departments', payload),

  updateDepartment: (departmentId: string, payload: Partial<DepartmentPayload>) =>
    apiClient.patch(`/corporate/departments/${departmentId}`, payload),

  deleteDepartment: (departmentId: string) =>
    apiClient.delete(`/corporate/departments/${departmentId}`),

  getExpiryRadar: () =>
    apiClient.get('/corporate/expiry-radar'),

  getGuaranteeLetterPdf: (employeeId: string) =>
    apiClient.get(`/corporate/employees/${employeeId}/guarantee-letter-pdf`),
};

