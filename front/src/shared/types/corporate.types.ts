export interface CorporateEmployee {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle?: string;
  department?: string;
  email?: string;
  phone?: string;
  passportNumber?: string;
  delegationToken?: string;
  delegationUrl?: string;
  status?: string;
  createdAt: string;
}

export interface CorporateBatch {
  id: string;
  code: string;
  name: string;
  destination: string;
  duration?: string;
  projectReason?: string;
  status: string;
  totalAmount?: number;
  invoices?: CorporateInvoice[];
  createdAt: string;
}

export interface CorporateInvoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  pdfUrl?: string;
  createdAt: string;
}
