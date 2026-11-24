import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '@/shared/api/services/admin.service';
import type {
  AdminDashboardAnalytics,
  AdminDossier,
  DashboardRange,
  DossierStatusType,
} from '@/shared/types/admin.types';
import TrendAreaChart, { type TrendChartMode } from '@/modules/admin/components/DashboardCharts/TrendAreaChart';
import DonutChart, { type DonutSegment } from '@/modules/admin/components/DashboardCharts/DonutChart';
import HorizontalBarChart, { type DestinationMetricMode } from '@/modules/admin/components/DashboardCharts/HorizontalBarChart';
import PipelineFunnelChart from '@/modules/admin/components/DashboardCharts/PipelineFunnelChart';
import SlotCapacityChart from '@/modules/admin/components/DashboardCharts/SlotCapacityChart';
import './AdminDashboard.css';

const RANGE_OPTIONS: Array<{ value: DashboardRange; label: string }> = [
  { value: '7D', label: '7D' },
  { value: '30D', label: '30D' },
  { value: '90D', label: '90D' },
  { value: '12M', label: '12M' },
  { value: 'ALL', label: 'ALL' },
];

const PORTAL_OPTIONS = [
  { value: 'ALL', label: 'All Channels' },
  { value: 'INDIVIDUAL', label: 'Individual (B2C)' },
  { value: 'GROUP_AGENT', label: 'Tour Operator (B2B)' },
  { value: 'CORPORATE', label: 'Corporate Partner' },
];

const PORTAL_COLORS: Record<string, string> = {
  INDIVIDUAL: '#2563EB',
  GROUP_AGENT: '#059669',
  CORPORATE: '#7C3AED',
};

const PROVIDER_COLORS: Record<string, string> = {
  WALLET: '#2563EB',
  STRIPE: '#0F1E36',
  BANK_TRANSFER: '#D97706',
  LOCAL_BANK: '#059669',
  PROMO_FULL_COVERAGE: '#7C3AED',
};

function formatCurrencyEur(amount: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(amount || 0));
}

function escapeCsvCell(val: string | number | null | undefined): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  // Global Executive Filters
  const [range, setRange] = useState<DashboardRange>('30D');
  const [portalFilter, setPortalFilter] = useState<string>('ALL');

  // Interactive Chart Mode Toggles
  const [trendMode, setTrendMode] = useState<TrendChartMode>('dual');
  const [portalMetric, setPortalMetric] = useState<'dossiers' | 'revenue'>('dossiers');
  const [destMetric, setDestMetric] = useState<DestinationMetricMode>('dossiers');

  // Data State
  const [analytics, setAnalytics] = useState<AdminDashboardAnalytics | null>(null);
  const [recentDossiers, setRecentDossiers] = useState<AdminDossier[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadDashboardData = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setErrorMsg(null);

      try {
        const [analyticsRes, dossiersRes] = await Promise.allSettled([
          adminService.getAnalytics({ range, portalType: portalFilter }),
          adminService.getAllDossiers({
            limit: 8,
            portalType: portalFilter !== 'ALL' ? portalFilter : undefined,
          }),
        ]);

        if (analyticsRes.status === 'fulfilled' && analyticsRes.value?.data?.analytics) {
          setAnalytics(analyticsRes.value.data.analytics);
        } else {
          // Graceful fallback to legacy summary metrics if analytics endpoint is temporarily unreachable
          const fallbackRes = await adminService.getMetrics().catch(() => null);
          if (!fallbackRes?.data?.metrics) {
            setErrorMsg('Unable to load live executive analytics. Please verify backend connectivity.');
          }
        }

        if (dossiersRes.status === 'fulfilled' && dossiersRes.value?.data?.dossiers) {
          setRecentDossiers(dossiersRes.value.data.dossiers);
        }
      } catch (err) {
        console.warn('Failed to load admin executive dashboard:', err);
        setErrorMsg('Unable to load dashboard analytics.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [range, portalFilter]
  );

  useEffect(() => {
    loadDashboardData(false);
  }, [loadDashboardData]);

  // CSV Executive Report Export
  const handleExportCsv = () => {
    if (!analytics) return;
    const rows: Array<Array<string | number>> = [];

    rows.push(['EuroTech Consular Executive Analytics Report']);
    rows.push(['Range', analytics.meta.range, 'Portal Filter', analytics.meta.portalType, 'Generated At', analytics.meta.generatedAt]);
    rows.push([]);

    rows.push(['EXECUTIVE KPI SUMMARY']);
    rows.push(['Metric', 'Value', 'Delta / Context']);
    rows.push(['Total Applications (Range)', analytics.kpis.totalApplications, `${analytics.kpis.totalApplicationsDeltaPct}% vs prev`]);
    rows.push(['Active Dossiers (Live)', analytics.kpis.activeDossiers, `${analytics.kpis.totalApplicantsInRange} travelers in range`]);
    rows.push(['Awaiting Officer Review', analytics.kpis.awaitingReviewCount, `${analytics.kpis.pendingDocumentsCount} pending docs`]);
    rows.push(['Approval Rate (%)', `${analytics.kpis.approvalRatePct}%`, `${analytics.kpis.approvedCount} approved / ${analytics.kpis.rejectedCount} rejected`]);
    rows.push(['Avg Consular Turnaround (Days)', analytics.kpis.avgTurnaroundDays, 'Decided dossiers']);
    rows.push(['Net Settled Revenue (EUR)', analytics.kpis.netRevenueEur, `${analytics.kpis.netRevenueDeltaPct}% vs prev`]);
    rows.push(['Net Settled Revenue (AZN)', analytics.kpis.netRevenueAzn, `Rate: 1 EUR = ${analytics.meta.eurToAznRate} AZN`]);
    rows.push(['Average Order Value (EUR)', analytics.kpis.avgOrderValueEur, 'Paid orders']);
    rows.push(['Upcoming Confirmed Appointments', analytics.kpis.upcomingAppointmentsCount, `${analytics.kpis.slotOccupancyPct}% 14d occupancy`]);
    rows.push(['Wallet Float Balance (EUR)', analytics.treasury.totalWalletFloatEur, `Pending Bank Slips: EUR ${analytics.treasury.pendingBankSlipsEur}`]);
    rows.push(['Promo Discounts Applied (EUR)', analytics.promoImpact.totalDiscountEur, `${analytics.promoImpact.redemptionsCount} redemptions`]);
    rows.push([]);

    rows.push(['TIME SERIES']);
    rows.push(['Bucket', 'Label', 'Applications', 'Applicants (Pax)', 'Approved', 'Net Revenue (EUR)', 'Net Revenue (AZN)']);
    for (const pt of analytics.timeSeries) {
      rows.push([pt.key, pt.label, pt.applications, pt.applicants, pt.approved, pt.revenueEur, pt.revenueAzn]);
    }
    rows.push([]);

    rows.push(['PORTAL CHANNEL BREAKDOWN']);
    rows.push(['Portal', 'Dossiers', 'Applicants', 'Share (%)', 'Net Revenue (EUR)', 'Revenue Share (%)']);
    for (const p of analytics.portalBreakdown) {
      rows.push([p.label, p.dossiers, p.applicants, p.sharePct, p.revenueEur, p.revenueSharePct]);
    }
    rows.push([]);

    rows.push(['TOP DESTINATION COUNTRIES']);
    rows.push(['ISO Code', 'Country', 'Dossiers', 'Applicants', 'Approved', 'Rejected', 'Approval Rate (%)', 'Revenue (EUR)']);
    for (const d of analytics.topDestinations) {
      rows.push([d.code, d.name, d.dossiers, d.applicants, d.approved, d.rejected, d.approvalRatePct, d.revenueEur]);
    }
    rows.push([]);

    rows.push(['PAYMENT METHODS']);
    rows.push(['Provider', 'Paid Count', 'Volume (EUR)', 'Share (%)']);
    for (const pm of analytics.paymentMethods) {
      rows.push([pm.label, pm.count, pm.amountEur, pm.sharePct]);
    }

    const csvText = rows.map((r) => r.map(escapeCsvCell).join(',')).join('\r\n');
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `eurotech_executive_analytics_${range}_${portalFilter}_${dateStamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Build Donut Segments for Portal Channels
  const portalDonutSegments: DonutSegment[] = useMemo(() => {
    if (!analytics) return [];
    return analytics.portalBreakdown.map((row) => ({
      id: row.portalType,
      label: row.label,
      value: portalMetric === 'revenue' ? row.revenueEur : row.dossiers,
      secondaryText:
        portalMetric === 'revenue'
          ? `${row.dossiers} dossiers • ${row.applicants} pax`
          : `${formatCurrencyEur(row.revenueEur, 0)} • ${row.applicants} pax`,
      color: PORTAL_COLORS[row.portalType] || '#64748B',
      sharePct: portalMetric === 'revenue' ? row.revenueSharePct : row.sharePct,
    }));
  }, [analytics, portalMetric]);

  // Build Donut Segments for Payment Methods
  const paymentDonutSegments: DonutSegment[] = useMemo(() => {
    if (!analytics) return [];
    return analytics.paymentMethods.map((row) => ({
      id: row.provider,
      label: row.label,
      value: row.amountEur,
      secondaryText: `${row.count} settled payments`,
      color: PROVIDER_COLORS[row.provider] || '#64748B',
      sharePct: row.sharePct,
    }));
  }, [analytics]);

  const navigateWithPortal = (basePath: string, extraParams: Record<string, string> = {}) => {
    const params = new URLSearchParams();
    Object.entries(extraParams).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    if (portalFilter !== 'ALL' && !params.has('portalType')) {
      params.set('portalType', portalFilter);
    }
    const qs = params.toString();
    navigate(qs ? `${basePath}?${qs}` : basePath);
  };

  const renderDeltaPill = (deltaPct: number) => {
    if (range === 'ALL') {
      return <span className="kpi-delta delta-neutral">All-Time</span>;
    }
    const isPos = deltaPct > 0;
    const isNeg = deltaPct < 0;
    const cls = isPos ? 'delta-pos' : isNeg ? 'delta-neg' : 'delta-neutral';
    const prefix = isPos ? '+' : '';
    return (
      <span className={`kpi-delta ${cls}`} title="Change vs immediately preceding equivalent period">
        {prefix}
        {deltaPct.toFixed(1)}%
      </span>
    );
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'badge-approved';
      case 'REJECTED':
        return 'badge-rejected';
      case 'UNDER_REVIEW':
        return 'badge-review';
      case 'NEEDS_CORRECTION':
        return 'badge-warning';
      case 'SUBMITTED_TO_CONSULATE':
        return 'badge-consulate';
      default:
        return 'badge-received';
    }
  };

  const getPaymentBadgeClass = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'pay-badge-paid';
      case 'REFUNDED':
        return 'pay-badge-refunded';
      default:
        return 'pay-badge-pending';
    }
  };

  const getPortalBadge = (portalType: string) => {
    switch (portalType) {
      case 'GROUP_AGENT':
        return <span className="admin-tag tag-agent">Tour Operator</span>;
      case 'CORPORATE':
        return <span className="admin-tag tag-corp">Corporate</span>;
      default:
        return <span className="admin-tag tag-client">Individual</span>;
    }
  };

  const kpis = analytics?.kpis;
  const triage = analytics?.triage;
  const treasury = analytics?.treasury;
  const appointments = analytics?.appointments;
  const promoImpact = analytics?.promoImpact;
  const userGrowth = analytics?.userGrowth;

  const totalPortalUsersSafe = Math.max(1, userGrowth?.totalUsers || 0);
  const lastUpdatedStr = analytics?.meta.generatedAt
    ? new Date(analytics.meta.generatedAt).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
    : '—';

  const granularityLabel =
    analytics?.meta.granularity === 'DAY'
      ? 'Daily breakdown'
      : analytics?.meta.granularity === 'WEEK'
        ? 'Weekly cohorts'
        : 'Monthly totals';

  return (
    <div className="admin-dashboard-view">
      {/* --- 1. TOP EXECUTIVE HEADER & CONTROLS --- */}
      <div className="admin-dash-header">
        <div>
          <h1 className="admin-dash-title">Consular Operations &amp; Executive Analytics</h1>
          <p className="admin-dash-subtitle">
            Real-time consular throughput, net settled treasury, slot utilization, and multi-portal performance.
            <span className="dash-sync-meta">Updated {lastUpdatedStr}</span>
          </p>
        </div>

        <div className="admin-header-actions">
          <button
            className="btn-refresh"
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            title="Refresh live analytics"
          >
            <svg
              className={refreshing ? 'spin-icon' : ''}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh
          </button>

          <button
            className="btn-export-csv"
            onClick={handleExportCsv}
            disabled={!analytics || loading}
            title="Download full CSV analytics report"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>

          <button
            className="btn-action-primary"
            onClick={() => navigateWithPortal('/admin/dossiers', { status: 'UNDER_REVIEW' })}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Start Review Queue
          </button>
        </div>
      </div>

      {/* --- FILTER TOOLBAR (TIME RANGE + PORTAL CHANNEL) --- */}
      <div className="admin-filter-toolbar">
        <div className="toolbar-group">
          <span className="toolbar-label">Timeframe</span>
          <div className="segmented-control" role="tablist" aria-label="Analytics Timeframe">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={range === opt.value}
                className={`seg-btn ${range === opt.value ? 'active' : ''}`}
                onClick={() => setRange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="toolbar-group">
          <span className="toolbar-label">Portal Channel</span>
          <div className="segmented-control" role="tablist" aria-label="Portal Filter">
            {PORTAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={portalFilter === opt.value}
                className={`seg-btn ${portalFilter === opt.value ? 'active' : ''}`}
                onClick={() => setPortalFilter(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {analytics && (
          <div className="toolbar-rate-chip" title="Live EUR to AZN conversion rate from System Settings">
            FX Rate: <strong>1 EUR = {analytics.meta.eurToAznRate.toFixed(2)} AZN</strong>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="dash-error-banner">
          <span>{errorMsg}</span>
          <button onClick={() => loadDashboardData(true)}>Retry</button>
        </div>
      )}

      {/* --- 2. 6 EXECUTIVE KPI CARDS --- */}
      <div className="admin-kpi-grid">
        {/* KPI 1: Total Applications */}
        <div className="admin-stat-card" onClick={() => navigateWithPortal('/admin/dossiers')}>
          <div className="stat-card-header">
            <span className="stat-title">Applications ({range})</span>
            <div className="stat-icon icon-blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
          </div>
          <div className="stat-value-row">
            <span className="stat-value">{loading ? '—' : kpis?.totalApplications ?? 0}</span>
            {!loading && kpis && renderDeltaPill(kpis.totalApplicationsDeltaPct)}
          </div>
          <div className="stat-meta text-slate">
            <strong>{kpis?.activeDossiers ?? 0}</strong> active in workflow &bull;{' '}
            <strong>{kpis?.totalApplicantsInRange ?? 0}</strong> travelers
          </div>
        </div>

        {/* KPI 2: Awaiting Consular Review */}
        <div
          className={`admin-stat-card ${(kpis?.awaitingReviewCount || 0) > 0 ? 'card-urgent' : ''}`}
          onClick={() => navigateWithPortal('/admin/dossiers', { status: 'UNDER_REVIEW' })}
        >
          <div className="stat-card-header">
            <span className="stat-title">Awaiting Officer Review</span>
            <div className="stat-icon icon-amber">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>
          <div className="stat-value-row">
            <span className="stat-value">{loading ? '—' : kpis?.awaitingReviewCount ?? 0}</span>
            {!loading && kpis && (
              <span className="kpi-sub-pill pill-amber">
                {kpis.underReviewCount} review &bull; {kpis.needsCorrectionCount} corr.
              </span>
            )}
          </div>
          <div className="stat-meta text-amber">
            <strong>{kpis?.pendingDocumentsCount ?? 0}</strong> applicant documents pending verification
          </div>
        </div>

        {/* KPI 3: Approval Rate & Consular Decisions */}
        <div
          className="admin-stat-card"
          onClick={() => navigateWithPortal('/admin/dossiers', { status: 'APPROVED' })}
        >
          <div className="stat-card-header">
            <span className="stat-title">Approval Rate ({range})</span>
            <div className="stat-icon icon-emerald">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
          </div>
          <div className="stat-value-row">
            <span className="stat-value">
              {loading ? '—' : `${(kpis?.approvalRatePct ?? 0).toFixed(1)}%`}
            </span>
            {!loading && kpis && (
              <span className="kpi-sub-pill pill-emerald">
                Avg {kpis.avgTurnaroundDays > 0 ? `${kpis.avgTurnaroundDays.toFixed(1)}d` : 'N/A'}
              </span>
            )}
          </div>
          <div className="stat-meta text-emerald">
            <strong>{kpis?.approvedCount ?? 0}</strong> approved / <strong>{kpis?.rejectedCount ?? 0}</strong> rejected &bull;{' '}
            {kpis?.approvedThisMonth ?? 0} this mo.
          </div>
        </div>

        {/* KPI 4: Net Settled Revenue (EUR) */}
        <div className="admin-stat-card" onClick={() => navigate('/admin/financials')}>
          <div className="stat-card-header">
            <span className="stat-title">Net Settled Revenue ({range})</span>
            <div className="stat-icon icon-navy">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" ry="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </div>
          </div>
          <div className="stat-value-row">
            <span className="stat-value">
              {loading ? '—' : formatCurrencyEur(kpis?.netRevenueEur ?? 0, 2)}
            </span>
            {!loading && kpis && renderDeltaPill(kpis.netRevenueDeltaPct)}
          </div>
          <div className="stat-meta text-slate">
            <strong>{(kpis?.netRevenueAzn ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AZN</strong>{' '}
            &bull; Avg Order {formatCurrencyEur(kpis?.avgOrderValueEur ?? 0, 2)}
          </div>
        </div>

        {/* KPI 5: Biometric Appointments & Occupancy */}
        <div className="admin-stat-card" onClick={() => navigate('/admin/appointments')}>
          <div className="stat-card-header">
            <span className="stat-title">Biometric Appointments</span>
            <div className="stat-icon icon-purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
          </div>
          <div className="stat-value-row">
            <span className="stat-value">{loading ? '—' : kpis?.upcomingAppointmentsCount ?? 0}</span>
            {!loading && kpis && (
              <span className="kpi-sub-pill pill-purple">{kpis.slotOccupancyPct.toFixed(1)}% filled</span>
            )}
          </div>
          <div className="stat-meta text-purple">
            <strong>{kpis?.slotBookedNext14d ?? 0} / {kpis?.slotCapacityNext14d ?? 0}</strong> seats booked (next 14 days)
          </div>
        </div>

        {/* KPI 6: Treasury Float & Pending Approvals */}
        <div className="admin-stat-card" onClick={() => navigate('/admin/financials')}>
          <div className="stat-card-header">
            <span className="stat-title">Treasury &amp; Pending Actions</span>
            <div className="stat-icon icon-slate">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
          </div>
          <div className="stat-value-row">
            <span className="stat-value">
              {loading ? '—' : formatCurrencyEur(kpis?.walletFloatEur ?? 0, 0)}
            </span>
            {!loading && kpis && (
              <span className={`kpi-sub-pill ${kpis.pendingActionsTotal > 0 ? 'pill-amber' : 'pill-slate'}`}>
                {kpis.pendingActionsTotal} pending
              </span>
            )}
          </div>
          <div className="stat-meta text-slate">
            Pre-funded wallet float &bull; Promo savings{' '}
            <strong>{formatCurrencyEur(kpis?.promoDiscountsEur ?? 0, 2)}</strong>
          </div>
        </div>
      </div>

      {/* --- 3. LIVE OPERATIONAL TRIAGE BAR --- */}
      <div className="admin-triage-bar">
        <div
          className="triage-item"
          onClick={() => navigateWithPortal('/admin/dossiers', { status: 'RECEIVED' })}
        >
          <div className="triage-dot dot-blue" />
          <div className="triage-text">
            <span>New Submissions</span>
            <small>Intake queue</small>
          </div>
          <span className="triage-count-badge">{triage?.newSubmissionsCount ?? 0}</span>
          <span className="triage-arrow">&rarr;</span>
        </div>

        <div
          className="triage-item"
          onClick={() => navigateWithPortal('/admin/dossiers', { status: 'NEEDS_CORRECTION' })}
        >
          <div className="triage-dot dot-amber" />
          <div className="triage-text">
            <span>Pending Corrections</span>
            <small>Awaiting applicant resubmission</small>
          </div>
          <span className={`triage-count-badge ${(triage?.needsCorrectionCount || 0) > 0 ? 'badge-warn' : ''}`}>
            {triage?.needsCorrectionCount ?? 0}
          </span>
          <span className="triage-arrow">&rarr;</span>
        </div>

        <div className="triage-item" onClick={() => navigate('/admin/financials')}>
          <div className="triage-dot dot-purple" />
          <div className="triage-text">
            <span>Pending Bank Slips</span>
            <small>{formatCurrencyEur(triage?.pendingBankSlipsEur ?? 0, 2)} awaiting approval</small>
          </div>
          <span className={`triage-count-badge ${(triage?.pendingBankSlipsCount || 0) > 0 ? 'badge-warn' : ''}`}>
            {triage?.pendingBankSlipsCount ?? 0}
          </span>
          <span className="triage-arrow">&rarr;</span>
        </div>

        <div className="triage-item" onClick={() => navigate('/admin/financials')}>
          <div className="triage-dot dot-slate" />
          <div className="triage-text">
            <span>Payouts &amp; Embassy Files</span>
            <small>
              {triage?.pendingPayoutsCount ?? 0} payouts ({formatCurrencyEur(triage?.pendingPayoutsEur ?? 0, 0)}) &bull;{' '}
              {triage?.submittedToConsulateCount ?? 0} at embassy
            </small>
          </div>
          <span className="triage-count-badge">{triage?.pendingPayoutsCount ?? 0}</span>
          <span className="triage-arrow">&rarr;</span>
        </div>
      </div>

      {/* --- 4. ROW 3: PRIMARY ANALYTICS (8FR TIME SERIES + 4FR CHANNEL DONUT) --- */}
      <div className="dash-row-8-4">
        <div className="admin-panel">
          <div className="panel-header compact">
            <div className="panel-title-area">
              <h3>Revenue &amp; Application Volume Trend</h3>
              <p>
                {granularityLabel} &bull; Excludes pre-funded wallet top-ups &amp; deducts refunds for exact net earnings.
              </p>
            </div>
            <div className="mini-toggle-group">
              <button
                type="button"
                className={`mini-toggle-btn ${trendMode === 'revenue' ? 'active' : ''}`}
                onClick={() => setTrendMode('revenue')}
              >
                Revenue (€)
              </button>
              <button
                type="button"
                className={`mini-toggle-btn ${trendMode === 'applications' ? 'active' : ''}`}
                onClick={() => setTrendMode('applications')}
              >
                Applications
              </button>
              <button
                type="button"
                className={`mini-toggle-btn ${trendMode === 'dual' ? 'active' : ''}`}
                onClick={() => setTrendMode('dual')}
              >
                Combined
              </button>
            </div>
          </div>

          {loading ? (
            <div className="admin-loading-state compact">
              <div className="spinner" />
              <span>Calculating continuous time-series...</span>
            </div>
          ) : (
            <TrendAreaChart
              data={analytics?.timeSeries || []}
              mode={trendMode}
              eurToAznRate={analytics?.meta.eurToAznRate || 1.85}
            />
          )}
        </div>

        <div className="admin-panel">
          <div className="panel-header compact">
            <div className="panel-title-area">
              <h3>Portal Channel Mix</h3>
              <p>Click a segment to cross-filter dashboard.</p>
            </div>
            <div className="mini-toggle-group">
              <button
                type="button"
                className={`mini-toggle-btn ${portalMetric === 'dossiers' ? 'active' : ''}`}
                onClick={() => setPortalMetric('dossiers')}
              >
                Dossiers
              </button>
              <button
                type="button"
                className={`mini-toggle-btn ${portalMetric === 'revenue' ? 'active' : ''}`}
                onClick={() => setPortalMetric('revenue')}
              >
                Revenue
              </button>
            </div>
          </div>

          {loading ? (
            <div className="admin-loading-state compact">
              <div className="spinner" />
              <span>Aggregating portal channels...</span>
            </div>
          ) : (
            <>
              <DonutChart
                segments={portalDonutSegments}
                centerLabel={portalMetric === 'revenue' ? 'Net Revenue' : 'Total Dossiers'}
                centerValue={
                  portalMetric === 'revenue'
                    ? formatCurrencyEur(kpis?.netRevenueEur ?? 0, 0)
                    : String(kpis?.totalApplications ?? 0)
                }
                formatValue={(v) =>
                  portalMetric === 'revenue' ? formatCurrencyEur(v, 2) : `${v}`
                }
                onSegmentClick={(seg) => {
                  setPortalFilter((prev) => (prev === seg.id ? 'ALL' : seg.id));
                }}
              />
              {portalFilter !== 'ALL' && (
                <button
                  type="button"
                  className="reset-filter-link"
                  onClick={() => setPortalFilter('ALL')}
                >
                  Clear channel filter ({portalFilter.replace('_', ' ')})
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* --- 5. ROW 4: PIPELINE FUNNEL + TOP DESTINATION COUNTRIES (6FR / 6FR) --- */}
      <div className="dash-row-6-6">
        <div className="admin-panel">
          <div className="panel-header compact">
            <div className="panel-title-area">
              <h3>Consular Status Pipeline &amp; Document Health</h3>
              <p>Period stage volume with live backlog pills. Click any stage to inspect dossiers.</p>
            </div>
            <button
              className="panel-link-btn"
              onClick={() => navigateWithPortal('/admin/dossiers')}
            >
              Open Registry &rarr;
            </button>
          </div>

          {loading || !analytics ? (
            <div className="admin-loading-state compact">
              <div className="spinner" />
              <span>Building consular pipeline...</span>
            </div>
          ) : (
            <PipelineFunnelChart
              stages={analytics.statusPipeline}
              documentHealth={analytics.documentHealth}
              avgTurnaroundDays={analytics.kpis.avgTurnaroundDays}
              onStageClick={(status: DossierStatusType) =>
                navigateWithPortal('/admin/dossiers', { status })
              }
            />
          )}
        </div>

        <div className="admin-panel">
          <div className="panel-header compact">
            <div className="panel-title-area">
              <h3>Top Destination Jurisdictions</h3>
              <p>Ranked by demand, net revenue, or consular approval ratio (Top 8).</p>
            </div>
            <div className="mini-toggle-group">
              <button
                type="button"
                className={`mini-toggle-btn ${destMetric === 'dossiers' ? 'active' : ''}`}
                onClick={() => setDestMetric('dossiers')}
              >
                Volume
              </button>
              <button
                type="button"
                className={`mini-toggle-btn ${destMetric === 'revenue' ? 'active' : ''}`}
                onClick={() => setDestMetric('revenue')}
              >
                Revenue
              </button>
              <button
                type="button"
                className={`mini-toggle-btn ${destMetric === 'approvalRate' ? 'active' : ''}`}
                onClick={() => setDestMetric('approvalRate')}
              >
                Approval %
              </button>
            </div>
          </div>

          {loading ? (
            <div className="admin-loading-state compact">
              <div className="spinner" />
              <span>Ranking destination countries...</span>
            </div>
          ) : (
            <HorizontalBarChart
              rows={analytics?.topDestinations || []}
              metric={destMetric}
              onRowClick={(row) =>
                navigateWithPortal('/admin/dossiers', { search: row.name })
              }
            />
          )}
        </div>
      </div>

      {/* --- 6. ROW 5: 3-COLUMN FINANCIALS, APPOINTMENTS & PROMOS/USERS --- */}
      <div className="dash-row-4-4-4">
        {/* Col 1: Payment Methods & Treasury */}
        <div className="admin-panel">
          <div className="panel-header compact">
            <div className="panel-title-area">
              <h3>Payment Methods &amp; Treasury</h3>
              <p>Settled payment channels &amp; client wallet liability.</p>
            </div>
            <button className="panel-link-btn" onClick={() => navigate('/admin/financials')}>
              Treasury &rarr;
            </button>
          </div>

          {loading || !treasury ? (
            <div className="admin-loading-state compact">
              <div className="spinner" />
              <span>Reconciling ledger...</span>
            </div>
          ) : (
            <div className="treasury-panel-body">
              <DonutChart
                segments={paymentDonutSegments}
                centerLabel="Paid Volume"
                centerValue={formatCurrencyEur(
                  paymentDonutSegments.reduce((s, r) => s + r.value, 0),
                  0
                )}
                formatValue={(v) => formatCurrencyEur(v, 2)}
                emptyMessage="No settled payments in this timeframe."
              />

              <div className="treasury-summary-box">
                <div className="treasury-row-main">
                  <span>Total Wallet Float (Liability)</span>
                  <strong>{formatCurrencyEur(treasury.totalWalletFloatEur, 2)}</strong>
                </div>
                <div className="treasury-mini-grid">
                  <div>
                    <span>Individual</span>
                    <strong>{formatCurrencyEur(treasury.walletFloatByPortal.INDIVIDUAL, 0)}</strong>
                  </div>
                  <div>
                    <span>Tour Agent</span>
                    <strong>{formatCurrencyEur(treasury.walletFloatByPortal.GROUP_AGENT, 0)}</strong>
                  </div>
                  <div>
                    <span>Corporate</span>
                    <strong>{formatCurrencyEur(treasury.walletFloatByPortal.CORPORATE, 0)}</strong>
                  </div>
                </div>
                <div className="treasury-pending-strip">
                  <span>
                    Bank Slips: <strong>{treasury.pendingBankSlipsCount}</strong> (
                    {formatCurrencyEur(treasury.pendingBankSlipsEur, 0)})
                  </span>
                  <span>
                    Payouts: <strong>{treasury.pendingPayoutsCount}</strong> (
                    {formatCurrencyEur(treasury.pendingPayoutsEur, 0)})
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Col 2: Biometric Appointments & 14-Day Capacity */}
        <div className="admin-panel">
          <div className="panel-header compact">
            <div className="panel-title-area">
              <h3>Appointments &amp; Slot Capacity</h3>
              <p>14-day published schedule occupancy &amp; status mix.</p>
            </div>
            <button className="panel-link-btn" onClick={() => navigate('/admin/appointments')}>
              Schedule &rarr;
            </button>
          </div>

          {loading || !appointments ? (
            <div className="admin-loading-state compact">
              <div className="spinner" />
              <span>Checking biometric schedule...</span>
            </div>
          ) : (
            <SlotCapacityChart
              dailyCapacity={appointments.dailyCapacity}
              byStatus={appointments.byStatus}
              totalBookedNext14d={appointments.totalBookedNext14d}
              totalCapacityNext14d={appointments.totalCapacityNext14d}
              occupancyPct={appointments.occupancyPct}
            />
          )}
        </div>

        {/* Col 3: Promo Codes Impact & User Base Growth */}
        <div className="admin-panel">
          <div className="panel-header compact">
            <div className="panel-title-area">
              <h3>Promo Impact &amp; User Growth</h3>
              <p>Discount campaign ROI and registered portal accounts.</p>
            </div>
            <button className="panel-link-btn" onClick={() => navigate('/admin/promo-codes')}>
              Promos &rarr;
            </button>
          </div>

          {loading || !promoImpact || !userGrowth ? (
            <div className="admin-loading-state compact">
              <div className="spinner" />
              <span>Loading campaign &amp; user stats...</span>
            </div>
          ) : (
            <div className="promo-user-stack">
              {/* Promo Impact Block */}
              <div className="sub-analytics-block">
                <div className="sub-block-kpis">
                  <div className="mini-stat-box">
                    <span>Active Codes</span>
                    <strong>{promoImpact.activeCodesCount}</strong>
                  </div>
                  <div className="mini-stat-box">
                    <span>Applied ({range})</span>
                    <strong>{promoImpact.redemptionsCount}</strong>
                  </div>
                  <div className="mini-stat-box">
                    <span>Savings ({promoImpact.avgDiscountPct.toFixed(0)}%)</span>
                    <strong className="text-emerald">
                      {formatCurrencyEur(promoImpact.totalDiscountEur, 2)}
                    </strong>
                  </div>
                </div>

                {promoImpact.topCodes.length === 0 ? (
                  <div className="mini-empty-note">No confirmed promo redemptions in this period.</div>
                ) : (
                  <div className="promo-leaderboard">
                    {promoImpact.topCodes.map((pc) => (
                      <div
                        key={pc.id}
                        className="promo-leader-row"
                        onClick={() => navigate('/admin/promo-codes')}
                      >
                        <span className="promo-code-chip">{pc.code}</span>
                        <span className="promo-uses">{pc.redemptions} uses</span>
                        <strong className="promo-disc">-{formatCurrencyEur(pc.discountEur, 2)}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* User Base & Growth Block */}
              <div className="sub-analytics-block user-growth-block">
                <div className="user-growth-header">
                  <div>
                    <span className="user-growth-title">Portal User Base</span>
                    <div className="user-growth-numbers">
                      <strong>{userGrowth.totalUsers}</strong>
                      <span>total accounts</span>
                      <span className="new-users-chip">+{userGrowth.newUsersInRange} new ({range})</span>
                      {renderDeltaPill(userGrowth.newUsersDeltaPct)}
                    </div>
                  </div>
                  <button className="inline-text-link" onClick={() => navigate('/admin/users')}>
                    Users &rarr;
                  </button>
                </div>

                <div className="role-bars-list">
                  {[
                    {
                      label: 'Individual Citizens',
                      count: userGrowth.byRole.INDIVIDUAL,
                      color: '#2563EB',
                    },
                    {
                      label: 'Tour Operators (B2B)',
                      count: userGrowth.byRole.AGENT_TUR_OPERATOR,
                      color: '#059669',
                    },
                    {
                      label: 'Corporate HR Partners',
                      count: userGrowth.byRole.CORPORATE_HR,
                      color: '#7C3AED',
                    },
                  ].map((r) => {
                    const pct = userGrowth.totalUsers > 0 ? (r.count / totalPortalUsersSafe) * 100 : 0;
                    return (
                      <div key={r.label} className="role-bar-item">
                        <div className="role-bar-meta">
                          <span>{r.label}</span>
                          <strong>
                            {r.count} <small>({pct.toFixed(0)}%)</small>
                          </strong>
                        </div>
                        <div className="role-bar-track">
                          <div
                            className="role-bar-fill"
                            style={{ width: `${Math.max(r.count > 0 ? 4 : 0, pct)}%`, background: r.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- 7. RECENT APPLICATIONS QUEUE TABLE --- */}
      <div className="admin-panel">
        <div className="panel-header">
          <div className="panel-title-area">
            <h3>Recent Applications Queue</h3>
            <p>
              Latest incoming dossiers{portalFilter !== 'ALL' ? ` filtered by ${portalFilter.replace('_', ' ')}` : ' across all portals'}.
            </p>
          </div>
          <div className="panel-header-right">
            <button className="panel-link-btn muted-link" onClick={() => navigate('/admin/audit-logs')}>
              Audit Logs
            </button>
            <button
              className="panel-link-btn"
              onClick={() => navigateWithPortal('/admin/dossiers')}
            >
              View All Dossiers ({kpis?.activeDossiers ?? 0} active) &rarr;
            </button>
          </div>
        </div>

        {loading ? (
          <div className="admin-loading-state">
            <div className="spinner" />
            <span>Loading live queue records...</span>
          </div>
        ) : recentDossiers.length === 0 ? (
          <div className="admin-empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p>No dossiers found for the selected portal filter.</p>
          </div>
        ) : (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Dossier Code</th>
                  <th>Primary Applicant / User</th>
                  <th>Destination &amp; Category</th>
                  <th>Channel</th>
                  <th>Fee &amp; Promo</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentDossiers.map((d) => (
                  <tr
                    key={d.id}
                    className="table-row-hover"
                    onClick={() => navigate(`/admin/dossiers/${d.id}`)}
                  >
                    <td>
                      <div className="dossier-code-cell">
                        <span className="code-text">{d.dossierNumber}</span>
                        <span className="code-date">
                          {new Date(d.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: '2-digit',
                          })}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="user-cell">
                        <strong>{d.user?.fullName || 'Applicant'}</strong>
                        <span>{d.user?.email || '—'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="destination-cell">
                        <span className="dest-name">
                          {d.country?.code ? `[${d.country.code}] ` : ''}
                          {d.country?.nameEn || d.country?.nameAz || 'Schengen'}
                        </span>
                        <span className="dest-category">
                          {d.visaCategory?.nameEn || d.visaCategory?.nameAz || 'Visa'}
                        </span>
                      </div>
                    </td>
                    <td>{getPortalBadge(d.portalType)}</td>
                    <td>
                      <div className="fee-promo-cell">
                        <span className="fee-cell">{formatCurrencyEur(d.totalAmount || 0, 2)}</span>
                        {d.appliedPromoCode && (d.discountAmount || 0) > 0 && (
                          <span className="table-promo-tag">
                            {d.appliedPromoCode} (-{formatCurrencyEur(d.discountAmount || 0, 2)})
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`pay-status-pill ${getPaymentBadgeClass(d.paymentStatus)}`}>
                        {d.paymentStatus}
                      </span>
                    </td>
                    <td>
                      <span className={`admin-badge ${getStatusBadgeClass(d.status)}`}>
                        {d.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn-examine"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/dossiers/${d.id}`);
                        }}
                      >
                        Examine &rarr;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
