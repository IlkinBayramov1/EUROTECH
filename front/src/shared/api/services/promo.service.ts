import { apiClient } from '../client';

export type PromoDiscountType = 'PERCENTAGE' | 'FIXED_EUR';
export type PromoApplyTarget = 'TOTAL_AMOUNT' | 'SERVICE_AND_EXTRAS_ONLY';
export type PromoScope = 'ALL' | 'DOSSIER_PAYMENT' | 'GROUP_BATCH_PAYMENT' | 'ADDITIONAL_SERVICES';
export type PromoPortalType = 'INDIVIDUAL' | 'GROUP_AGENT' | 'CORPORATE';
export type PromoStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type PromoDisplayStatus = 'ACTIVE' | 'INACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'EXHAUSTED' | 'ARCHIVED';

export interface PromoCodeItem {
  id: string;
  code: string;
  title?: string | null;
  description?: string | null;
  discountType: PromoDiscountType;
  discountValue: number;
  maxDiscountEur?: number | null;
  minOrderAmountEur?: number | null;
  applyTarget: PromoApplyTarget;
  allowAgentCommission: boolean;
  applicableScope: PromoScope;
  allowedPortals: PromoPortalType[];
  allowedPortalsJson?: PromoPortalType[] | null;
  countryId?: string | null;
  country?: { id: string; code: string; nameEn: string } | null;
  maxUses?: number | null;
  maxUsesPerUser?: number | null;
  currentUses: number;
  appliedCount?: number;
  reservedCount?: number;
  totalDiscountGrantedEur?: number;
  startsAt?: string | null;
  expiresAt?: string | null;
  status: PromoStatus;
  displayStatus: PromoDisplayStatus;
  createdBy?: { id: string; fullName: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface PromoAnalyticsSummary {
  totalCodes: number;
  activeCodes: number;
  expiredOrExhaustedCodes: number;
  inactiveCodes: number;
  confirmedRedemptions: number;
  reservedRedemptions: number;
  totalRedemptions: number;
  totalDiscountGrantedEur: number;
  totalGrossVolumeEur: number;
  totalNetCollectedEur: number;
}

export interface PromoRedemptionItem {
  id: string;
  promoCodeId: string;
  promoCodeSnapshot: string;
  discountTypeSnapshot: PromoDiscountType;
  discountValueSnapshot: number;
  userId: string;
  user?: { id: string; fullName: string; email: string; role: string; companyName?: string | null };
  portalType: PromoPortalType;
  scope: PromoScope;
  paymentMethod: string;
  dossierId?: string | null;
  dossier?: { id: string; dossierNumber: string } | null;
  groupBatchId?: string | null;
  groupBatch?: { id: string; code: string; name: string } | null;
  corporateInvoiceId?: string | null;
  corporateInvoice?: { id: string; invoiceNumber: string } | null;
  originalAmountEur: number;
  eligibleAmountEur: number;
  discountAmountEur: number;
  finalAmountEur: number;
  currency: string;
  status: 'RESERVED' | 'APPLIED' | 'RELEASED' | 'REFUNDED';
  reservedAt: string;
  confirmedAt?: string | null;
  releasedAt?: string | null;
  releaseReason?: string | null;
}

export interface PromoValidationResult {
  valid: boolean;
  promo: {
    id: string;
    code: string;
    title?: string | null;
    discountType: PromoDiscountType;
    discountValue: number;
    maxDiscountEur?: number | null;
    applyTarget: PromoApplyTarget;
    applicableScope: PromoScope;
    allowAgentCommission: boolean;
    country?: { id: string; code: string; nameEn: string } | null;
  };
  originalAmountEur: number;
  eligibleAmountEur: number;
  discountAmountEur: number;
  finalAmountEur: number;
  originalAmountAzn: number;
  discountAmountAzn: number;
  finalAmountAzn: number;
  existingDueEur: number;
  pendingCartEur: number;
  eurToAznRate: number;
  isFreeSettlement: boolean;
}

export interface CreatePromoPayload {
  code: string;
  title?: string;
  description?: string;
  discountType: PromoDiscountType;
  discountValue: number;
  maxDiscountEur?: number | null;
  minOrderAmountEur?: number | null;
  applyTarget?: PromoApplyTarget;
  allowAgentCommission?: boolean;
  applicableScope?: PromoScope;
  allowedPortals?: PromoPortalType[];
  countryId?: string | null;
  maxUses?: number | null;
  maxUsesPerUser?: number | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
}

export const promoService = {
  // Portal checkout live validation (non-mutating preview)
  validate: async (payload: {
    code: string;
    dossierId?: string | null;
    groupBatchId?: string | null;
    invoiceId?: string | null;
    scope?: PromoScope | string;
    purpose?: string;
    cartItems?: Array<{ serviceType: string; applicantId?: string }>;
  }): Promise<PromoValidationResult> => {
    const res = await apiClient.post<any>('/promocodes/validate', payload);
    return res?.data?.data || res?.data || res;
  },

  // Admin CRUD & Analytics
  listAdmin: async (params?: { status?: string; portal?: string; search?: string }): Promise<PromoCodeItem[]> => {
    const qs = new URLSearchParams();
    if (params?.status && params.status !== 'ALL') qs.set('status', params.status);
    if (params?.portal && params.portal !== 'ALL') qs.set('portal', params.portal);
    if (params?.search && params.search.trim()) qs.set('search', params.search.trim());
    const queryStr = qs.toString();
    const res = await apiClient.get<any>(`/admin/promocodes${queryStr ? `?${queryStr}` : ''}`);
    return res?.data?.promoCodes || res?.promoCodes || [];
  },

  getAnalytics: async (): Promise<PromoAnalyticsSummary> => {
    const res = await apiClient.get<any>('/admin/promocodes/analytics');
    return res?.data || res;
  },

  getDetail: async (id: string): Promise<PromoCodeItem & { redemptions?: PromoRedemptionItem[] }> => {
    const res = await apiClient.get<any>(`/admin/promocodes/${id}`);
    return res?.data?.promo || res?.promo || res;
  },

  getRedemptions: async (id: string): Promise<{ promo: { id: string; code: string }; redemptions: PromoRedemptionItem[] }> => {
    const res = await apiClient.get<any>(`/admin/promocodes/${id}/redemptions`);
    return res?.data || res;
  },

  create: async (payload: CreatePromoPayload): Promise<PromoCodeItem> => {
    const res = await apiClient.post<any>('/admin/promocodes', payload);
    return res?.data?.promo || res?.promo || res;
  },

  update: async (id: string, payload: Partial<CreatePromoPayload>): Promise<PromoCodeItem> => {
    const res = await apiClient.patch<any>(`/admin/promocodes/${id}`, payload);
    return res?.data?.promo || res?.promo || res;
  },

  toggleStatus: async (id: string, status?: PromoStatus): Promise<PromoCodeItem> => {
    const res = await apiClient.patch<any>(`/admin/promocodes/${id}/status`, status ? { status } : {});
    return res?.data?.promo || res?.promo || res;
  },

  remove: async (id: string): Promise<{ action: 'DELETED' | 'ARCHIVED' }> => {
    const res = await apiClient.delete<any>(`/admin/promocodes/${id}`);
    return res?.data || res;
  },
};
