export interface AdminMetrics {
  activeDossiers: number;
  underReviewCount: number;
  approvedThisMonth: number;
  totalRevenue: number;
}

export type DashboardRange = '7D' | '30D' | '90D' | '12M' | 'ALL';

export interface TimeSeriesPoint {
  key: string;
  label: string;
  applications: number;
  applicants: number;
  approved: number;
  revenueEur: number;
  revenueAzn: number;
}

export interface PortalBreakdownRow {
  portalType: 'INDIVIDUAL' | 'GROUP_AGENT' | 'CORPORATE';
  label: string;
  dossiers: number;
  applicants: number;
  revenueEur: number;
  sharePct: number;
  revenueSharePct: number;
}

export interface PipelineStageRow {
  status: DossierStatusType;
  label: string;
  count: number;
  liveTotal: number;
  sharePct: number;
}

export interface DestinationStatRow {
  countryId: string;
  code: string;
  name: string;
  dossiers: number;
  applicants: number;
  approved: number;
  rejected: number;
  revenueEur: number;
  approvalRatePct: number;
}

export interface PaymentMethodRow {
  provider: string;
  label: string;
  count: number;
  amountEur: number;
  sharePct: number;
}

export interface DailySlotCapacityRow {
  date: string;
  label: string;
  booked: number;
  capacity: number;
  available: number;
  occupancyPct: number;
}

export interface AdminDashboardAnalytics {
  meta: {
    range: DashboardRange;
    portalType: string;
    granularity: 'DAY' | 'WEEK' | 'MONTH';
    eurToAznRate: number;
    generatedAt: string;
  };
  summary: AdminMetrics;
  kpis: {
    totalApplications: number;
    totalApplicationsDeltaPct: number;
    activeDossiers: number;
    totalApplicantsInRange: number;
    awaitingReviewCount: number;
    underReviewCount: number;
    needsCorrectionCount: number;
    pendingDocumentsCount: number;
    approvalRatePct: number;
    approvedCount: number;
    rejectedCount: number;
    approvedThisMonth: number;
    avgTurnaroundDays: number;
    netRevenueEur: number;
    netRevenueAzn: number;
    netRevenueDeltaPct: number;
    avgOrderValueEur: number;
    allTimeNetRevenueEur: number;
    upcomingAppointmentsCount: number;
    slotOccupancyPct: number;
    slotBookedNext14d: number;
    slotCapacityNext14d: number;
    pendingActionsTotal: number;
    walletFloatEur: number;
    promoDiscountsEur: number;
  };
  triage: {
    newSubmissionsCount: number;
    needsCorrectionCount: number;
    submittedToConsulateCount: number;
    pendingBankSlipsCount: number;
    pendingBankSlipsEur: number;
    pendingPayoutsCount: number;
    pendingPayoutsEur: number;
    pendingDocumentsCount: number;
  };
  timeSeries: TimeSeriesPoint[];
  portalBreakdown: PortalBreakdownRow[];
  statusPipeline: PipelineStageRow[];
  documentHealth: {
    total: number;
    verified: number;
    pending: number;
    needsCorrection: number;
    rejected: number;
    verificationRatePct: number;
  };
  topDestinations: DestinationStatRow[];
  paymentMethods: PaymentMethodRow[];
  treasury: {
    totalWalletFloatEur: number;
    totalWalletFloatAzn: number;
    pendingWalletBalanceEur: number;
    walletFloatByPortal: {
      INDIVIDUAL: number;
      GROUP_AGENT: number;
      CORPORATE: number;
    };
    pendingBankSlipsCount: number;
    pendingBankSlipsEur: number;
    pendingPayoutsCount: number;
    pendingPayoutsEur: number;
  };
  appointments: {
    upcomingConfirmedCount: number;
    occupancyPct: number;
    totalBookedNext14d: number;
    totalCapacityNext14d: number;
    byStatus: {
      CONFIRMED: number;
      COMPLETED: number;
      PENDING_PAYMENT: number;
      RESCHEDULED: number;
      CANCELLED: number;
      NO_SHOW: number;
    };
    dailyCapacity: DailySlotCapacityRow[];
  };
  promoImpact: {
    activeCodesCount: number;
    redemptionsCount: number;
    totalDiscountEur: number;
    avgDiscountPct: number;
    topCodes: Array<{
      id: string;
      code: string;
      redemptions: number;
      discountEur: number;
    }>;
  };
  userGrowth: {
    totalUsers: number;
    newUsersInRange: number;
    newUsersDeltaPct: number;
    byRole: {
      INDIVIDUAL: number;
      AGENT_TUR_OPERATOR: number;
      CORPORATE_HR: number;
      STAFF: number;
    };
  };
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
  discountAmount?: number;
  appliedPromoCode?: string | null;
  totalAmount: number;
  paymentStatus: 'PENDING' | 'PAID' | 'REFUNDED';
  archivedZipUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  applicants: AdminApplicant[];
  documents?: AdminApplicantDocument[];
  groupBatch?: {
    id: string;
    code: string;
    name: string;
    destination: string;
    travelDate?: string | null;
    projectReason?: string | null;
    status: string;
    packageTier?: string | null;
  } | null;
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
