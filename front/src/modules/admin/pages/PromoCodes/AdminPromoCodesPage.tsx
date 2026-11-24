import React, { useState, useEffect, useCallback } from 'react';
import {
  promoService,
  type PromoCodeItem,
  type PromoAnalyticsSummary,
  type PromoRedemptionItem,
  type PromoDiscountType,
  type PromoApplyTarget,
  type PromoScope,
  type PromoPortalType,
} from '@/shared/api/services/promo.service';
import { vcmsApi } from '@/modules/admin/api/vcmsApi';
import { useToast } from '@/shared/context/ToastContext';
import './AdminPromoCodesPage.css';

interface CountryOption {
  id: string;
  code: string;
  nameEn: string;
}

const PORTAL_OPTIONS: Array<{ value: PromoPortalType; label: string }> = [
  { value: 'INDIVIDUAL', label: 'Individual Portal' },
  { value: 'GROUP_AGENT', label: 'Tour Operator Portal' },
  { value: 'CORPORATE', label: 'Corporate Partner Portal' },
];

const SCOPE_LABELS: Record<PromoScope, string> = {
  ALL: 'All Payments',
  DOSSIER_PAYMENT: 'Individual Dossiers',
  GROUP_BATCH_PAYMENT: 'Group & Corporate Invoices',
  ADDITIONAL_SERVICES: 'Value-Added Services',
};

function generateRandomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `EURO-${suffix}`;
}

function toDatetimeLocalValue(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateShort(iso?: string | null): string {
  if (!iso) return 'No limit';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'No limit';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AdminPromoCodesPage() {
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [promoCodes, setPromoCodes] = useState<PromoCodeItem[]>([]);
  const [analytics, setAnalytics] = useState<PromoAnalyticsSummary | null>(null);
  const [countries, setCountries] = useState<CountryOption[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [portalFilter, setPortalFilter] = useState<string>('ALL');

  // Create/Edit modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCodeItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form fields
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<PromoDiscountType>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('15');
  const [maxDiscountEur, setMaxDiscountEur] = useState('');
  const [minOrderAmountEur, setMinOrderAmountEur] = useState('');
  const [applyTarget, setApplyTarget] = useState<PromoApplyTarget>('TOTAL_AMOUNT');
  const [allowAgentCommission, setAllowAgentCommission] = useState<boolean>(true);
  const [applicableScope, setApplicableScope] = useState<PromoScope>('ALL');
  const [allowedPortals, setAllowedPortals] = useState<PromoPortalType[]>(['INDIVIDUAL', 'GROUP_AGENT', 'CORPORATE']);
  const [countryId, setCountryId] = useState<string>('');
  const [maxUses, setMaxUses] = useState('');
  const [maxUsesPerUser, setMaxUsesPerUser] = useState('1');
  const [startsAt, setStartsAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

  // Redemptions Drawer
  const [redemptionsModalPromo, setRedemptionsModalPromo] = useState<{ id: string; code: string } | null>(null);
  const [redemptionsList, setRedemptionsList] = useState<PromoRedemptionItem[]>([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, analyticsRes] = await Promise.all([
        promoService.listAdmin({
          status: statusFilter,
          portal: portalFilter,
          search,
        }),
        promoService.getAnalytics(),
      ]);
      setPromoCodes(Array.isArray(listRes) ? listRes : []);
      setAnalytics(analyticsRes || null);
    } catch (err: any) {
      console.error('Failed to load promo codes:', err);
      showError(err?.response?.data?.message || err.message || 'Failed to load promo codes.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, portalFilter, search, showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    vcmsApi
      .listDestinations()
      .then((res: any) => {
        const list = res?.data?.countries || res?.data?.destinations || res?.countries || res?.destinations || [];
        setCountries(
          list.map((c: any) => ({
            id: c.id,
            code: c.code,
            nameEn: c.nameEn || c.nameAz || c.code,
          }))
        );
      })
      .catch(() => {});
  }, []);

  const openCreateModal = () => {
    setEditingPromo(null);
    setCode('');
    setTitle('');
    setDescription('');
    setDiscountType('PERCENTAGE');
    setDiscountValue('15');
    setMaxDiscountEur('');
    setMinOrderAmountEur('');
    setApplyTarget('TOTAL_AMOUNT');
    setAllowAgentCommission(true);
    setApplicableScope('ALL');
    setAllowedPortals(['INDIVIDUAL', 'GROUP_AGENT', 'CORPORATE']);
    setCountryId('');
    setMaxUses('');
    setMaxUsesPerUser('1');
    setStartsAt('');
    setExpiresAt('');
    setStatus('ACTIVE');
    setIsModalOpen(true);
  };

  const openEditModal = (item: PromoCodeItem) => {
    setEditingPromo(item);
    setCode(item.code);
    setTitle(item.title || '');
    setDescription(item.description || '');
    setDiscountType(item.discountType);
    setDiscountValue(String(item.discountValue));
    setMaxDiscountEur(item.maxDiscountEur !== null && item.maxDiscountEur !== undefined ? String(item.maxDiscountEur) : '');
    setMinOrderAmountEur(
      item.minOrderAmountEur !== null && item.minOrderAmountEur !== undefined ? String(item.minOrderAmountEur) : ''
    );
    setApplyTarget(item.applyTarget || 'TOTAL_AMOUNT');
    setAllowAgentCommission(item.allowAgentCommission !== false);
    setApplicableScope(item.applicableScope || 'ALL');
    setAllowedPortals(
      Array.isArray(item.allowedPortals) && item.allowedPortals.length > 0
        ? item.allowedPortals
        : ['INDIVIDUAL', 'GROUP_AGENT', 'CORPORATE']
    );
    setCountryId(item.countryId || '');
    setMaxUses(item.maxUses !== null && item.maxUses !== undefined ? String(item.maxUses) : '');
    setMaxUsesPerUser(item.maxUsesPerUser !== null && item.maxUsesPerUser !== undefined ? String(item.maxUsesPerUser) : '');
    setStartsAt(toDatetimeLocalValue(item.startsAt));
    setExpiresAt(toDatetimeLocalValue(item.expiresAt));
    setStatus(item.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE');
    setIsModalOpen(true);
  };

  const togglePortal = (portal: PromoPortalType) => {
    setAllowedPortals((prev) =>
      prev.includes(portal) ? prev.filter((p) => p !== portal) : [...prev, portal]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedCode = code.trim().toUpperCase();
    if (!cleanedCode) {
      showError('Please enter a promo code.');
      return;
    }
    const numVal = parseFloat(discountValue);
    if (isNaN(numVal) || numVal <= 0) {
      showError('Please enter a valid discount value greater than 0.');
      return;
    }
    if (discountType === 'PERCENTAGE' && numVal > 100) {
      showError('Percentage discount cannot exceed 100%.');
      return;
    }
    if (allowedPortals.length === 0) {
      showError('Select at least one allowed portal.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        code: cleanedCode,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        discountType,
        discountValue: numVal,
        maxDiscountEur: discountType === 'PERCENTAGE' && maxDiscountEur.trim() ? parseFloat(maxDiscountEur) : null,
        minOrderAmountEur: minOrderAmountEur.trim() ? parseFloat(minOrderAmountEur) : null,
        applyTarget,
        allowAgentCommission,
        applicableScope,
        allowedPortals,
        countryId: countryId || null,
        maxUses: maxUses.trim() ? parseInt(maxUses, 10) : null,
        maxUsesPerUser: maxUsesPerUser.trim() ? parseInt(maxUsesPerUser, 10) : null,
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        status,
      };

      if (editingPromo) {
        await promoService.update(editingPromo.id, payload);
        showSuccess(`Promo code "${cleanedCode}" updated successfully.`);
      } else {
        await promoService.create(payload);
        showSuccess(`Promo code "${cleanedCode}" created successfully.`);
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      showError(err?.response?.data?.message || err.message || 'Failed to save promo code.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (item: PromoCodeItem) => {
    const nextStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await promoService.toggleStatus(item.id, nextStatus);
      showSuccess(`Promo code "${item.code}" marked as ${nextStatus}.`);
      await loadData();
    } catch (err: any) {
      showError(err?.response?.data?.message || err.message || 'Failed to update status.');
    }
  };

  const handleDeleteOrArchive = async (item: PromoCodeItem) => {
    const hasHistory = (item.currentUses || 0) > 0;
    const msg = hasHistory
      ? `Promo code "${item.code}" has existing redemptions and will be safely ARCHIVED to preserve financial audit records. Continue?`
      : `Permanently delete unused promo code "${item.code}"?`;
    if (!window.confirm(msg)) return;

    try {
      const res = await promoService.remove(item.id);
      showSuccess(
        res.action === 'ARCHIVED'
          ? `Promo code "${item.code}" archived.`
          : `Promo code "${item.code}" deleted.`
      );
      await loadData();
    } catch (err: any) {
      showError(err?.response?.data?.message || err.message || 'Failed to remove promo code.');
    }
  };

  const handleOpenRedemptions = async (item: PromoCodeItem) => {
    setRedemptionsModalPromo({ id: item.id, code: item.code });
    setRedemptionsList([]);
    setLoadingRedemptions(true);
    try {
      const res = await promoService.getRedemptions(item.id);
      setRedemptionsList(Array.isArray(res.redemptions) ? res.redemptions : []);
    } catch (err: any) {
      showError(err?.response?.data?.message || err.message || 'Failed to load redemptions.');
    } finally {
      setLoadingRedemptions(false);
    }
  };

  const handleCopyCode = (val: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(val).catch(() => {});
    }
    showSuccess(`Copied promo code "${val}" to clipboard.`);
  };

  const renderStatusPill = (displayStatus: string) => {
    const key = String(displayStatus || 'INACTIVE').toLowerCase();
    return <span className={`promo-status-pill status-${key}`}>{displayStatus}</span>;
  };

  return (
    <div className="admin-promo-page">
      {/* Header */}
      <div className="promo-page-header">
        <div>
          <h1 className="promo-page-title">Promo Codes &amp; Discount Control</h1>
          <p className="promo-page-subtitle">
            Issue, monitor, and audit promotional discount codes across Individual, Tour Operator, and Corporate portal checkouts.
          </p>
        </div>
        <button className="promo-btn-primary" onClick={openCreateModal}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Create Promo Code
        </button>
      </div>

      {/* Policy Notice */}
      <div className="promo-policy-banner">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>
          <strong>Treasury Safeguard:</strong> Promo codes apply to dossier, group, corporate invoice, and value-added service payments (Wallet, Card, and Bank Wire). Promo codes are automatically disabled on 5-step application wizards and withdrawable wallet top-ups.
        </span>
      </div>

      {/* KPI Cards */}
      <div className="promo-kpi-grid">
        <div className="promo-kpi-card">
          <span className="promo-kpi-label">Active Promo Codes</span>
          <strong className="promo-kpi-value">{analytics?.activeCodes ?? 0}</strong>
          <span className="promo-kpi-meta">{analytics?.totalCodes ?? 0} total configured</span>
        </div>
        <div className="promo-kpi-card">
          <span className="promo-kpi-label">Total Redemptions</span>
          <strong className="promo-kpi-value">{analytics?.totalRedemptions ?? 0}</strong>
          <span className="promo-kpi-meta">
            {analytics?.confirmedRedemptions ?? 0} confirmed / {analytics?.reservedRedemptions ?? 0} reserved
          </span>
        </div>
        <div className="promo-kpi-card accent">
          <span className="promo-kpi-label">Total Discounts Granted</span>
          <strong className="promo-kpi-value">
            €{Number(analytics?.totalDiscountGrantedEur ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>
          <span className="promo-kpi-meta">
            Net collected: €{Number(analytics?.totalNetCollectedEur ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="promo-kpi-card">
          <span className="promo-kpi-label">Expired / Exhausted</span>
          <strong className="promo-kpi-value">{analytics?.expiredOrExhaustedCodes ?? 0}</strong>
          <span className="promo-kpi-meta">{analytics?.inactiveCodes ?? 0} inactive or archived</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="promo-filter-bar">
        <div className="promo-search-box">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by promo code or campaign title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="EXPIRED">Expired</option>
          <option value="EXHAUSTED">Exhausted</option>
          <option value="ARCHIVED">Archived</option>
        </select>

        <select value={portalFilter} onChange={(e) => setPortalFilter(e.target.value)}>
          <option value="ALL">All Portals</option>
          <option value="INDIVIDUAL">Individual Portal</option>
          <option value="GROUP_AGENT">Tour Operator Portal</option>
          <option value="CORPORATE">Corporate Portal</option>
        </select>
      </div>

      {/* Table */}
      <div className="promo-table-card">
        {loading ? (
          <div className="promo-empty-state">Loading promo codes...</div>
        ) : promoCodes.length === 0 ? (
          <div className="promo-empty-state">
            <p>No promo codes match the current filter.</p>
            <button className="promo-btn-secondary" onClick={openCreateModal}>
              Create First Promo Code
            </button>
          </div>
        ) : (
          <div className="promo-table-scroll">
            <table className="promo-table">
              <thead>
                <tr>
                  <th>Code &amp; Campaign</th>
                  <th>Discount Rule</th>
                  <th>Portals &amp; Scope</th>
                  <th>Usage Quota</th>
                  <th>Validity</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {promoCodes.map((item) => {
                  const usagePct =
                    item.maxUses && item.maxUses > 0
                      ? Math.min(100, Math.round((item.currentUses / item.maxUses) * 100))
                      : null;

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="promo-code-cell">
                          <button
                            type="button"
                            className="promo-code-badge"
                            onClick={() => handleCopyCode(item.code)}
                            title="Copy code"
                          >
                            {item.code}
                          </button>
                          {item.title && <span className="promo-code-title">{item.title}</span>}
                          {item.country && (
                            <span className="promo-meta-tag">Country: {item.country.code} ({item.country.nameEn})</span>
                          )}
                        </div>
                      </td>

                      <td>
                        <div className="promo-discount-cell">
                          <strong>
                            {item.discountType === 'PERCENTAGE'
                              ? `${item.discountValue}% OFF`
                              : `€${Number(item.discountValue).toFixed(2)} OFF`}
                          </strong>
                          <span className="promo-sub-meta">
                            {item.applyTarget === 'SERVICE_AND_EXTRAS_ONLY' ? 'Service & Extras Only' : 'Total Order Amount'}
                            {item.maxDiscountEur ? ` • Cap €${Number(item.maxDiscountEur).toFixed(2)}` : ''}
                            {item.minOrderAmountEur ? ` • Min €${Number(item.minOrderAmountEur).toFixed(2)}` : ''}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="promo-portals-cell">
                          <div className="promo-portal-tags">
                            {(item.allowedPortals || []).map((p) => (
                              <span key={p} className="promo-mini-pill">
                                {p === 'GROUP_AGENT' ? 'Agent' : p === 'CORPORATE' ? 'Corporate' : 'Individual'}
                              </span>
                            ))}
                          </div>
                          <span className="promo-sub-meta">
                            {SCOPE_LABELS[item.applicableScope] || item.applicableScope}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="promo-usage-cell">
                          <span className="promo-usage-text">
                            <strong>{item.currentUses}</strong> / {item.maxUses ?? 'Unlimited'}
                          </span>
                          {usagePct !== null && (
                            <div className="promo-progress-track">
                              <div className="promo-progress-fill" style={{ width: `${usagePct}%` }} />
                            </div>
                          )}
                          <span className="promo-sub-meta">
                            Per user: {item.maxUsesPerUser ?? 'Unlimited'} • Granted €{Number(item.totalDiscountGrantedEur || 0).toFixed(2)}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="promo-validity-cell">
                          <span>From: {formatDateShort(item.startsAt)}</span>
                          <span>Until: {formatDateShort(item.expiresAt)}</span>
                        </div>
                      </td>

                      <td>{renderStatusPill(item.displayStatus)}</td>

                      <td>
                        <div className="promo-row-actions">
                          <button
                            type="button"
                            className="promo-action-btn"
                            onClick={() => handleOpenRedemptions(item)}
                            title="View Redemptions Audit Log"
                          >
                            Audit ({item.currentUses})
                          </button>
                          <button
                            type="button"
                            className="promo-action-btn"
                            onClick={() => openEditModal(item)}
                          >
                            Edit
                          </button>
                          {item.status !== 'ARCHIVED' && (
                            <button
                              type="button"
                              className="promo-action-btn"
                              onClick={() => handleToggleStatus(item)}
                            >
                              {item.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                          {item.status !== 'ARCHIVED' && (
                            <button
                              type="button"
                              className="promo-action-btn danger"
                              onClick={() => handleDeleteOrArchive(item)}
                            >
                              {item.currentUses > 0 ? 'Archive' : 'Delete'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="promo-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="promo-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="promo-modal-header">
              <div>
                <h2>{editingPromo ? `Edit Promo Code: ${editingPromo.code}` : 'Create New Promo Code'}</h2>
                <p>Configure discount rules, portal eligibility, usage limits, and validity window.</p>
              </div>
              <button type="button" className="promo-modal-close" onClick={() => setIsModalOpen(false)}>
                &times;
              </button>
            </div>

            <form className="promo-modal-form" onSubmit={handleSave}>
              <div className="promo-form-grid">
                {/* Code */}
                <div className="promo-field full">
                  <label>Promo Code *</label>
                  <div className="promo-code-input-row">
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                      placeholder="e.g. EURO2026"
                      maxLength={32}
                      required
                    />
                    <button
                      type="button"
                      className="promo-btn-secondary"
                      onClick={() => setCode(generateRandomCode())}
                    >
                      Generate Code
                    </button>
                  </div>
                </div>

                {/* Title & Status */}
                <div className="promo-field">
                  <label>Campaign Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Q4 Partner Promotion"
                  />
                </div>

                <div className="promo-field">
                  <label>Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>

                {/* Discount Type & Value */}
                <div className="promo-field">
                  <label>Discount Type *</label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as PromoDiscountType)}
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED_EUR">Fixed Amount (EUR €)</option>
                  </select>
                </div>

                <div className="promo-field">
                  <label>{discountType === 'PERCENTAGE' ? 'Discount Percentage (1 - 100) *' : 'Discount Amount (EUR €) *'}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={discountType === 'PERCENTAGE' ? '100' : undefined}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    required
                  />
                </div>

                {discountType === 'PERCENTAGE' && (
                  <div className="promo-field">
                    <label>Max Discount Cap (EUR, optional)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={maxDiscountEur}
                      onChange={(e) => setMaxDiscountEur(e.target.value)}
                      placeholder="Unlimited"
                    />
                  </div>
                )}

                <div className="promo-field">
                  <label>Minimum Order Amount (EUR, optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={minOrderAmountEur}
                    onChange={(e) => setMinOrderAmountEur(e.target.value)}
                    placeholder="No minimum"
                  />
                </div>

                {/* Apply Target & Scope */}
                <div className="promo-field">
                  <label>Discount Calculation Base</label>
                  <select
                    value={applyTarget}
                    onChange={(e) => setApplyTarget(e.target.value as PromoApplyTarget)}
                  >
                    <option value="TOTAL_AMOUNT">Total Order Amount</option>
                    <option value="SERVICE_AND_EXTRAS_ONLY">Service &amp; Add-On Fees Only (Exclude Consular Fee)</option>
                  </select>
                </div>

                <div className="promo-field">
                  <label>Payment Scope</label>
                  <select
                    value={applicableScope}
                    onChange={(e) => setApplicableScope(e.target.value as PromoScope)}
                  >
                    <option value="ALL">All Eligible Portal Payments</option>
                    <option value="DOSSIER_PAYMENT">Individual Dossier Payments Only</option>
                    <option value="GROUP_BATCH_PAYMENT">Tour Group &amp; Corporate Invoices Only</option>
                    <option value="ADDITIONAL_SERVICES">Value-Added Services Only</option>
                  </select>
                </div>

                {/* Allowed Portals */}
                <div className="promo-field full">
                  <label>Allowed Portals *</label>
                  <div className="promo-checkbox-group">
                    {PORTAL_OPTIONS.map((opt) => (
                      <label key={opt.value} className="promo-checkbox-item">
                        <input
                          type="checkbox"
                          checked={allowedPortals.includes(opt.value)}
                          onChange={() => togglePortal(opt.value)}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Agent commission control */}
                {allowedPortals.includes('GROUP_AGENT') && (
                  <div className="promo-field full">
                    <label className="promo-checkbox-item standalone">
                      <input
                        type="checkbox"
                        checked={allowAgentCommission}
                        onChange={(e) => setAllowAgentCommission(e.target.checked)}
                      />
                      <span>
                        Allow Tour Operator commission on discounted orders (automatically capped to net collected service margin to prevent negative-margin payouts)
                      </span>
                    </label>
                  </div>
                )}

                {/* Country Restriction */}
                <div className="promo-field full">
                  <label>Destination Country Restriction (optional)</label>
                  <select value={countryId} onChange={(e) => setCountryId(e.target.value)}>
                    <option value="">All Destination Countries</option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Usage Limits */}
                <div className="promo-field">
                  <label>Max Global Uses (optional)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    placeholder="Unlimited"
                  />
                </div>

                <div className="promo-field">
                  <label>Max Uses Per User Account</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={maxUsesPerUser}
                    onChange={(e) => setMaxUsesPerUser(e.target.value)}
                    placeholder="Unlimited"
                  />
                </div>

                {/* Validity Dates */}
                <div className="promo-field">
                  <label>Valid From (optional)</label>
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                  />
                </div>

                <div className="promo-field">
                  <label>Valid Until (optional)</label>
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>

                {/* Description */}
                <div className="promo-field full">
                  <label>Internal Treasury Notes</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional campaign details or authorization notes..."
                  />
                </div>
              </div>

              <div className="promo-modal-footer">
                <button type="button" className="promo-btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="promo-btn-primary" disabled={isSaving}>
                  {isSaving ? 'Saving...' : editingPromo ? 'Save Changes' : 'Create Promo Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Redemptions Audit Modal */}
      {redemptionsModalPromo && (
        <div className="promo-modal-overlay" onClick={() => setRedemptionsModalPromo(null)}>
          <div className="promo-modal-dialog wide" onClick={(e) => e.stopPropagation()}>
            <div className="promo-modal-header">
              <div>
                <h2>Redemption Audit Log — {redemptionsModalPromo.code}</h2>
                <p>Complete financial ledger of reservations, confirmed applications, and released holds.</p>
              </div>
              <button
                type="button"
                className="promo-modal-close"
                onClick={() => setRedemptionsModalPromo(null)}
              >
                &times;
              </button>
            </div>

            <div className="promo-audit-body">
              {loadingRedemptions ? (
                <div className="promo-empty-state">Loading audit history...</div>
              ) : redemptionsList.length === 0 ? (
                <div className="promo-empty-state">No redemptions recorded for this promo code yet.</div>
              ) : (
                <div className="promo-table-scroll">
                  <table className="promo-table compact">
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th>Portal &amp; Target</th>
                        <th>Method</th>
                        <th>Original</th>
                        <th>Discount</th>
                        <th>Net Paid</th>
                        <th>Status</th>
                        <th>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {redemptionsList.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <div className="promo-code-cell">
                              <strong>{r.user?.companyName || r.user?.fullName || 'Account'}</strong>
                              <span className="promo-sub-meta">{r.user?.email}</span>
                            </div>
                          </td>
                          <td>
                            <div className="promo-code-cell">
                              <span className="promo-mini-pill">{r.portalType}</span>
                              <span className="promo-sub-meta">
                                {r.dossier?.dossierNumber ||
                                  r.groupBatch?.code ||
                                  r.corporateInvoice?.invoiceNumber ||
                                  r.scope}
                              </span>
                            </div>
                          </td>
                          <td>{r.paymentMethod}</td>
                          <td>€{Number(r.originalAmountEur || 0).toFixed(2)}</td>
                          <td className="promo-discount-neg">-€{Number(r.discountAmountEur || 0).toFixed(2)}</td>
                          <td>
                            <strong>€{Number(r.finalAmountEur || 0).toFixed(2)}</strong>
                          </td>
                          <td>
                            <span className={`promo-status-pill status-${String(r.status).toLowerCase()}`}>
                              {r.status}
                            </span>
                          </td>
                          <td>{new Date(r.confirmedAt || r.reservedAt).toLocaleString('en-GB')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
