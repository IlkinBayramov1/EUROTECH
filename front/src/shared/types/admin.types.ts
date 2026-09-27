export interface AdminMetrics {
  activeDossiers: number;
  underReviewCount: number;
  approvedThisMonth: number;
  totalRevenue: number;
}

export type DossierStatusType = 
  | 'RECEIVED'
  | 'UNDER_REVIEW'
  | 'NEEDS_CORRECTION'
  | 'SUBMITTED_TO_CONSULATE'
  | 'APPROVED'
  | 'REJECTED';

export type DocumentStatusType =
  | 'PENDING'
  | 'VERIFIED'
  | 'NEEDS_CORRECTION'
  | 'REJECTED';

export interface AdminApplicantDocument {
  id: string;
  dossierId: string;
  applicantId: string;
  requiredDocumentType: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  isMandatory: boolean;
  status: DocumentStatusType;
  operatorNotes?: string | null;
  reviewedByUserId?: string | null;
  reviewedAt?: string | null;
  applicant?: {
    id: string;
    firstName: string;
    lastName: string;
    passportNumber: string;
  };
}

export interface AdminApplicant {
  id: string;
  dossierId: string;
  firstName: string;
  lastName: string;
  passportNumber: string;
  birthDate?: string | null;
  nationality?: string | null;
  gender?: string | null;
  formDataJson?: Record<string, any> | null;
  documents?: AdminApplicantDocument[];
}

export interface AdminDossier {
  id: string;
  dossierNumber: string;
  portalType: 'INDIVIDUAL' | 'GROUP_AGENT' | 'CORPORATE';
  userId: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    phone?: string | null;
    companyName?: string | null;
  };
  countryId: string;
  country: {
    id: string;
    code: string;
    nameAz: string;
    nameEn: string;
    flagUrl?: string | null;
  };
  visaCategoryId: string;
  visaCategory: {
    id: string;
    code: string;
    nameAz: string;
    nameEn: string;
    baseFee: number;
  };
  status: DossierStatusType;
  currentStep: number;
  appointmentDate?: string | null;
  appointmentLocation?: string | null;
  governmentFee: number;
  serviceFee: number;
  extraServicesFee: number;
  totalAmount: number;
  paymentStatus: 'PENDING' | 'PAID' | 'REFUNDED';
  archivedZipUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  applicants: AdminApplicant[];
  documents?: AdminApplicantDocument[];
  appointments?: Array<{
    id: string;
    status: string;
    location?: string | null;
    timeSlot?: {
      date: string;
      startTime: string;
      location: string;
    };
  }>;
  statusHistory?: Array<{
    id: string;
    fromStatus: DossierStatusType;
    toStatus: DossierStatusType;
    changedByUserId: string;
    notes?: string | null;
    createdAt: string;
  }>;
}

export interface AdminDossierListResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  dossiers: AdminDossier[];
}

export interface AdminDossierFilter {
  status?: string;
  portalType?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface DocumentReviewPayload {
  status: DocumentStatusType;
  operatorNotes?: string;
}

export interface ConsularDecisionPayload {
  nextStatus: DossierStatusType;
  notes?: string;
}

export interface AuditLogItem {
  id: string;
  userId?: string | null;
  user?: {
    fullName: string;
    email: string;
    role: string;
  } | null;
  action: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, any> | null;
  createdAt: string;
}
