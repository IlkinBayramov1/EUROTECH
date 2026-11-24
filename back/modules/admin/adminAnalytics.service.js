const prisma = require('../../config/db');
const { DEFAULT_EUR_TO_AZN_RATE, convertEurToAzn, convertToEur } = require('../../config/constants');

const VALID_RANGES = ['7D', '30D', '90D', '12M', 'ALL'];
const VALID_PORTALS = ['ALL', 'INDIVIDUAL', 'GROUP_AGENT', 'CORPORATE'];

const DOSSIER_PIPELINE_STAGES = [
  { status: 'RECEIVED', label: 'Received' },
  { status: 'UNDER_REVIEW', label: 'Under Review' },
  { status: 'NEEDS_CORRECTION', label: 'Needs Correction' },
  { status: 'SUBMITTED_TO_CONSULATE', label: 'At Consulate' },
  { status: 'APPROVED', label: 'Approved' },
  { status: 'REJECTED', label: 'Rejected' },
];

const PORTAL_LABELS = {
  INDIVIDUAL: 'Individual (B2C)',
  GROUP_AGENT: 'Tour Operator (B2B)',
  CORPORATE: 'Corporate Partner',
};

const PROVIDER_LABELS = {
  WALLET: 'EuroTech Wallet',
  STRIPE: 'Online Card',
  BANK_TRANSFER: 'Bank Wire Transfer',
  LOCAL_BANK: 'Local Bank Gateway',
  PROMO_FULL_COVERAGE: '100% Promo Covered',
};

function mapRoleToPortal(role) {
  const r = String(role || '').toUpperCase();
  if (r === 'AGENT_TUR_OPERATOR' || r === 'AGENT') return 'GROUP_AGENT';
  if (r === 'CORPORATE_HR' || r === 'CORPORATE') return 'CORPORATE';
  return 'INDIVIDUAL';
}

function normalizeProvider(rawProvider) {
  const p = String(rawProvider || 'STRIPE').toUpperCase();
  if (p === 'STRIPE_CARD' || p === 'CARD') return 'STRIPE';
  if (p === 'WALLET' || p === 'BANK_TRANSFER' || p === 'LOCAL_BANK' || p === 'PROMO_FULL_COVERAGE') {
    return p;
  }
  return 'STRIPE';
}

function isWalletTopupTransaction(tx) {
  if (!tx) return false;
  const prov = String(tx.paymentProvider || '').toUpperCase();
  if (prov === 'WALLET_TOPUP') return true;
  const meta = tx.metadataJson && typeof tx.metadataJson === 'object' ? tx.metadataJson : {};
  if (String(meta.purpose || '').toUpperCase().includes('TOPUP')) return true;
  if (String(tx.orderReference || '').toUpperCase().includes('TOPUP')) return true;
  return false;
}

function resolveTxPortalType(tx) {
  if (tx.dossier?.portalType) return tx.dossier.portalType;
  const meta = tx.metadataJson && typeof tx.metadataJson === 'object' ? tx.metadataJson : {};
  if (meta.portalType && ['INDIVIDUAL', 'GROUP_AGENT', 'CORPORATE'].includes(String(meta.portalType).toUpperCase())) {
    return String(meta.portalType).toUpperCase();
  }
  return mapRoleToPortal(tx.user?.role);
}

function computeNetEarnedRevenueEur(transactions, eurToAznRate) {
  let net = 0.0;
  for (const tx of transactions) {
    if (isWalletTopupTransaction(tx)) continue;
    const amtEur = convertToEur(Math.abs(Number(tx.amount || 0)), tx.currency || 'EUR', eurToAznRate);
    if (tx.status === 'PAID') {
      net += amtEur;
    } else if (tx.status === 'REFUNDED') {
      net -= amtEur;
    }
  }
  return Number(Math.max(0, net).toFixed(2));
}

function calcDeltaPct(current, previous) {
  const cur = Number(current || 0);
  const prev = Number(previous || 0);
  if (prev <= 0) {
    return cur > 0 ? 100.0 : 0.0;
  }
  return Number((((cur - prev) / prev) * 100).toFixed(1));
}

function startOfUtcDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function formatDayKey(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatMonthKey(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatDayLabel(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function formatMonthLabel(d) {
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
}

function resolveDateWindows(rawRange) {
  const range = VALID_RANGES.includes(String(rawRange || '30D').toUpperCase())
    ? String(rawRange || '30D').toUpperCase()
    : '30D';
  const now = new Date();
  const todayStart = startOfUtcDay(now);

  if (range === '7D') {
    const startDate = new Date(todayStart.getTime() - 6 * 86400 * 1000);
    const prevStartDate = new Date(startDate.getTime() - 7 * 86400 * 1000);
    return { range, granularity: 'DAY', startDate, endDate: now, prevStartDate, prevEndDate: startDate };
  }
  if (range === '30D') {
    const startDate = new Date(todayStart.getTime() - 29 * 86400 * 1000);
    const prevStartDate = new Date(startDate.getTime() - 30 * 86400 * 1000);
    return { range, granularity: 'DAY', startDate, endDate: now, prevStartDate, prevEndDate: startDate };
  }
  if (range === '90D') {
    const startDate = new Date(todayStart.getTime() - 89 * 86400 * 1000);
    const prevStartDate = new Date(startDate.getTime() - 90 * 86400 * 1000);
    return { range, granularity: 'WEEK', startDate, endDate: now, prevStartDate, prevEndDate: startDate };
  }
  if (range === '12M') {
    const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1, 0, 0, 0, 0));
    const prevStartDate = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth() - 11, 1, 0, 0, 0, 0));
    return { range, granularity: 'MONTH', startDate, endDate: now, prevStartDate, prevEndDate: startDate };
  }
  // ALL
  return { range: 'ALL', granularity: 'MONTH', startDate: null, endDate: now, prevStartDate: null, prevEndDate: null };
}

function buildEmptyTimeSeriesBuckets({ range, granularity, startDate, endDate, earliestDate = null }) {
  const buckets = [];
  const map = new Map();

  if (granularity === 'DAY') {
    const days = range === '7D' ? 7 : 30;
    const base = startOfUtcDay(startDate);
    for (let i = 0; i < days; i++) {
      const d = new Date(base.getTime() + i * 86400 * 1000);
      const key = formatDayKey(d);
      const entry = {
        key,
        label: formatDayLabel(d),
        applications: 0,
        applicants: 0,
        approved: 0,
        revenueEur: 0,
        revenueAzn: 0,
      };
      buckets.push(entry);
      map.set(key, entry);
    }
    return { buckets, map, getBucketKey: (dt) => formatDayKey(new Date(dt)) };
  }

  if (granularity === 'WEEK') {
    // 13 sequential 7-day buckets covering the 90-day window
    const base = startOfUtcDay(startDate);
    const totalWeeks = 13;
    for (let i = 0; i < totalWeeks; i++) {
      const wStart = new Date(base.getTime() + i * 7 * 86400 * 1000);
      const key = `W${String(i + 1).padStart(2, '0')}`;
      const entry = {
        key,
        label: formatDayLabel(wStart),
        applications: 0,
        applicants: 0,
        approved: 0,
        revenueEur: 0,
        revenueAzn: 0,
      };
      buckets.push(entry);
      map.set(key, entry);
    }
    const baseMs = base.getTime();
    return {
      buckets,
      map,
      getBucketKey: (dt) => {
        const diffDays = Math.floor((startOfUtcDay(new Date(dt)).getTime() - baseMs) / 86400000);
        const idx = Math.max(0, Math.min(totalWeeks - 1, Math.floor(diffDays / 7)));
        return `W${String(idx + 1).padStart(2, '0')}`;
      },
    };
  }

  // MONTH granularity (12M or ALL)
  const now = new Date(endDate);
  let cursor;
  if (range === '12M') {
    cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  } else {
    const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    if (earliestDate) {
      const e = new Date(earliestDate);
      const eMonth = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), 1));
      cursor = eMonth < sixMonthsAgo ? eMonth : sixMonthsAgo;
    } else {
      cursor = sixMonthsAgo;
    }
    // Cap ALL timeline at 24 months max to keep chart readable
    const max24 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 23, 1));
    if (cursor < max24) cursor = max24;
  }

  const endMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  while (cursor <= endMonth) {
    const key = formatMonthKey(cursor);
    const entry = {
      key,
      label: formatMonthLabel(cursor),
      applications: 0,
      applicants: 0,
      approved: 0,
      revenueEur: 0,
      revenueAzn: 0,
    };
    buckets.push(entry);
    map.set(key, entry);
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }

  return { buckets, map, getBucketKey: (dt) => formatMonthKey(new Date(dt)) };
}

async function getEurToAznRate() {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'EUR_TO_AZN_RATE' } });
    return Number(setting?.value || DEFAULT_EUR_TO_AZN_RATE) || 1.85;
  } catch {
    return DEFAULT_EUR_TO_AZN_RATE || 1.85;
  }
}

/**
 * Computes accurate all-time & monthly metrics (fixes legacy EUR/AZN & WALLET_TOPUP double-counting)
 */
async function getAccurateSummaryMetrics() {
  const eurToAznRate = await getEurToAznRate();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [activeDossiers, underReviewCount, approvedThisMonth, settledTxs] = await Promise.all([
    prisma.dossier.count({
      where: { status: { in: ['RECEIVED', 'UNDER_REVIEW', 'NEEDS_CORRECTION', 'SUBMITTED_TO_CONSULATE'] } },
    }),
    prisma.dossier.count({ where: { status: 'UNDER_REVIEW' } }),
    prisma.dossier.count({ where: { status: 'APPROVED', updatedAt: { gte: startOfMonth } } }),
    prisma.transaction.findMany({
      where: { status: { in: ['PAID', 'REFUNDED'] } },
      select: { amount: true, currency: true, status: true, paymentProvider: true, orderReference: true, metadataJson: true },
    }),
  ]);

  const totalRevenue = computeNetEarnedRevenueEur(settledTxs, eurToAznRate);

  return {
    activeDossiers,
    underReviewCount,
    approvedThisMonth,
    totalRevenue,
  };
}

/**
 * Full Executive Dashboard Analytics Endpoint backing GET /api/v1/admin/analytics
 */
async function getExecutiveAnalytics({ range: rawRange = '30D', portalType: rawPortal = 'ALL' } = {}) {
  const portalFilter = VALID_PORTALS.includes(String(rawPortal || 'ALL').toUpperCase())
    ? String(rawPortal || 'ALL').toUpperCase()
    : 'ALL';

  const window = resolveDateWindows(rawRange);
  const { range, granularity, startDate, endDate, prevStartDate, prevEndDate } = window;
  const eurToAznRate = await getEurToAznRate();

  const dossierPortalWhere = portalFilter !== 'ALL' ? { portalType: portalFilter } : {};
  const currentRangeWhere = startDate ? { createdAt: { gte: startDate, lte: endDate } } : {};
  const prevRangeWhere = prevStartDate && prevEndDate ? { createdAt: { gte: prevStartDate, lt: prevEndDate } } : null;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const todayUtc = startOfUtcDay(endDate);
  const next14dEnd = new Date(todayUtc.getTime() + 14 * 86400 * 1000);
  const todayKey = formatDayKey(todayUtc);
  const next14dKey = formatDayKey(new Date(todayUtc.getTime() + 13 * 86400 * 1000));

  const [
    allDossiersLite,
    currentDossiers,
    prevDossiersCount,
    allSettledTxs,
    docStatusGroups,
    pendingBankSlips,
    pendingPayouts,
    walletsWithRoles,
    allAppointments,
    upcomingSlots,
    activePromoCount,
    appliedRedemptions,
    allUsers,
  ] = await Promise.all([
    // 1. All-time live pipeline counts (filtered by portal if selected)
    prisma.dossier.findMany({
      where: dossierPortalWhere,
      select: { id: true, status: true, portalType: true, updatedAt: true },
    }),

    // 2. Dossiers created in selected date range
    prisma.dossier.findMany({
      where: { ...dossierPortalWhere, ...currentRangeWhere },
      select: {
        id: true,
        status: true,
        portalType: true,
        paymentStatus: true,
        totalAmount: true,
        discountAmount: true,
        countryId: true,
        createdAt: true,
        updatedAt: true,
        country: { select: { id: true, code: true, nameEn: true, nameAz: true } },
        _count: { select: { applicants: true } },
      },
    }),

    // 3. Previous period dossier count (for trend delta)
    prevRangeWhere
      ? prisma.dossier.count({ where: { ...dossierPortalWhere, ...prevRangeWhere } })
      : Promise.resolve(0),

    // 4. All PAID/REFUNDED transactions (lean selection for accurate EUR net revenue, time-series & channel breakdown)
    prisma.transaction.findMany({
      where: { status: { in: ['PAID', 'REFUNDED'] } },
      select: {
        id: true,
        dossierId: true,
        amount: true,
        currency: true,
        status: true,
        paymentProvider: true,
        orderReference: true,
        metadataJson: true,
        createdAt: true,
        dossier: { select: { id: true, portalType: true, countryId: true } },
        user: { select: { role: true } },
      },
    }),

    // 5. Document verification health
    prisma.applicantDocument.groupBy({
      by: ['status'],
      _count: { id: true },
    }),

    // 6. Pending Bank Slips
    prisma.bankPaymentReceipt.findMany({
      where: { status: 'PENDING' },
      select: { id: true, amount: true, currency: true },
    }),

    // 7. Pending Agent Payouts
    prisma.payoutRequest.findMany({
      where: { status: 'PENDING' },
      select: { id: true, amount: true },
    }),

    // 8. All User Wallets (Treasury float liability)
    prisma.wallet.findMany({
      select: {
        balance: true,
        pendingBalance: true,
        user: { select: { role: true } },
      },
    }),

    // 9. Appointments summary
    prisma.appointment.findMany({
      select: {
        id: true,
        status: true,
        groupSize: true,
        createdAt: true,
        timeSlot: { select: { date: true, slotDate: true } },
      },
    }),

    // 10. Published upcoming TimeSlots (next 14 days, excluding DRAFT)
    prisma.timeSlot.findMany({
      where: {
        isActive: true,
        slotStatus: { in: ['AVAILABLE', 'FULL'] },
        OR: [
          { slotDate: { gte: todayKey, lte: next14dKey } },
          { date: { gte: todayUtc, lt: next14dEnd } },
        ],
      },
      select: {
        id: true,
        date: true,
        slotDate: true,
        capacity: true,
        bookedCount: true,
        slotStatus: true,
      },
    }),

    // 11. Active promo codes count
    prisma.promoCode.count({ where: { status: 'ACTIVE' } }),

    // 12. Applied promo redemptions in selected range
    prisma.promoCodeRedemption.findMany({
      where: {
        status: 'APPLIED',
        ...(portalFilter !== 'ALL' ? { portalType: portalFilter } : {}),
        ...(startDate ? { confirmedAt: { gte: startDate, lte: endDate } } : {}),
      },
      select: {
        id: true,
        promoCodeId: true,
        promoCodeSnapshot: true,
        originalAmountEur: true,
        discountAmountEur: true,
        finalAmountEur: true,
        portalType: true,
      },
    }),

    // 13. Users breakdown & growth
    prisma.user.findMany({
      select: { id: true, role: true, createdAt: true },
    }),
  ]);

  // --- Filter non-topup transactions by portal & window ---
  const nonTopupTxs = allSettledTxs.filter((t) => {
    if (isWalletTopupTransaction(t)) return false;
    if (portalFilter !== 'ALL' && resolveTxPortalType(t) !== portalFilter) return false;
    return true;
  });

  const currentTxs = startDate
    ? nonTopupTxs.filter((t) => new Date(t.createdAt) >= startDate && new Date(t.createdAt) <= endDate)
    : nonTopupTxs;

  const prevTxs =
    prevStartDate && prevEndDate
      ? nonTopupTxs.filter((t) => new Date(t.createdAt) >= prevStartDate && new Date(t.createdAt) < prevEndDate)
      : [];

  const netRevenueEur = computeNetEarnedRevenueEur(currentTxs, eurToAznRate);
  const prevNetRevenueEur = computeNetEarnedRevenueEur(prevTxs, eurToAznRate);
  const allTimeNetRevenueEur = computeNetEarnedRevenueEur(nonTopupTxs, eurToAznRate);

  const paidOrdersCount = currentTxs.filter((t) => t.status === 'PAID').length;
  const avgOrderValueEur = paidOrdersCount > 0 ? Number((netRevenueEur / paidOrdersCount).toFixed(2)) : 0;

  // --- Live Workflow Counts & Status Pipeline ---
  const liveStatusCounts = {
    RECEIVED: 0,
    UNDER_REVIEW: 0,
    NEEDS_CORRECTION: 0,
    SUBMITTED_TO_CONSULATE: 0,
    APPROVED: 0,
    REJECTED: 0,
  };
  let approvedThisMonth = 0;

  for (const d of allDossiersLite) {
    if (liveStatusCounts[d.status] !== undefined) {
      liveStatusCounts[d.status] += 1;
    }
    if (d.status === 'APPROVED' && new Date(d.updatedAt) >= startOfMonth) {
      approvedThisMonth += 1;
    }
  }

  const activeDossiers =
    liveStatusCounts.RECEIVED +
    liveStatusCounts.UNDER_REVIEW +
    liveStatusCounts.NEEDS_CORRECTION +
    liveStatusCounts.SUBMITTED_TO_CONSULATE;

  const awaitingReviewCount = liveStatusCounts.UNDER_REVIEW + liveStatusCounts.NEEDS_CORRECTION;

  // Period status pipeline & turnaround
  const periodStatusCounts = {
    RECEIVED: 0,
    UNDER_REVIEW: 0,
    NEEDS_CORRECTION: 0,
    SUBMITTED_TO_CONSULATE: 0,
    APPROVED: 0,
    REJECTED: 0,
  };
  let totalApplicantsInRange = 0;
  let turnaroundDaysSum = 0;
  let decidedCount = 0;

  for (const d of currentDossiers) {
    if (periodStatusCounts[d.status] !== undefined) {
      periodStatusCounts[d.status] += 1;
    }
    totalApplicantsInRange += Math.max(1, Number(d._count?.applicants || 1));

    if (d.status === 'APPROVED' || d.status === 'REJECTED') {
      const diffMs = Math.max(0, new Date(d.updatedAt).getTime() - new Date(d.createdAt).getTime());
      turnaroundDaysSum += diffMs / 86400000;
      decidedCount += 1;
    }
  }

  const periodApproved = periodStatusCounts.APPROVED;
  const periodRejected = periodStatusCounts.REJECTED;
  const periodTotalDecided = periodApproved + periodRejected;
  const approvalRatePct =
    periodTotalDecided > 0 ? Number(((periodApproved / periodTotalDecided) * 100).toFixed(1)) : 0;
  const avgTurnaroundDays = decidedCount > 0 ? Number((turnaroundDaysSum / decidedCount).toFixed(1)) : 0;

  const pipelineDenominator = Math.max(1, currentDossiers.length);
  const statusPipeline = DOSSIER_PIPELINE_STAGES.map((stage) => {
    const count = periodStatusCounts[stage.status] || 0;
    return {
      status: stage.status,
      label: stage.label,
      count,
      liveTotal: liveStatusCounts[stage.status] || 0,
      sharePct: currentDossiers.length > 0 ? Number(((count / pipelineDenominator) * 100).toFixed(1)) : 0,
    };
  });

  // --- Zero-Gap Continuous Time-Series Buckets ---
  let earliestDate = null;
  if (range === 'ALL') {
    for (const d of currentDossiers) {
      if (!earliestDate || new Date(d.createdAt) < earliestDate) earliestDate = new Date(d.createdAt);
    }
    for (const t of currentTxs) {
      if (!earliestDate || new Date(t.createdAt) < earliestDate) earliestDate = new Date(t.createdAt);
    }
  }

  const { buckets: timeSeries, map: tsMap, getBucketKey } = buildEmptyTimeSeriesBuckets({
    range,
    granularity,
    startDate,
    endDate,
    earliestDate,
  });

  for (const d of currentDossiers) {
    const bucket = tsMap.get(getBucketKey(d.createdAt));
    if (!bucket) continue;
    bucket.applications += 1;
    bucket.applicants += Math.max(1, Number(d._count?.applicants || 1));
    if (d.status === 'APPROVED') bucket.approved += 1;
  }

  for (const t of currentTxs) {
    const bucket = tsMap.get(getBucketKey(t.createdAt));
    if (!bucket) continue;
    const amtEur = convertToEur(Math.abs(Number(t.amount || 0)), t.currency || 'EUR', eurToAznRate);
    if (t.status === 'PAID') {
      bucket.revenueEur += amtEur;
    } else if (t.status === 'REFUNDED') {
      bucket.revenueEur -= amtEur;
    }
  }

  for (const b of timeSeries) {
    b.revenueEur = Number(Math.max(0, b.revenueEur).toFixed(2));
    b.revenueAzn = convertEurToAzn(b.revenueEur, eurToAznRate);
  }

  // --- Portal Channel Breakdown ---
  const portalStatsMap = {
    INDIVIDUAL: { portalType: 'INDIVIDUAL', label: PORTAL_LABELS.INDIVIDUAL, dossiers: 0, applicants: 0, revenueEur: 0 },
    GROUP_AGENT: { portalType: 'GROUP_AGENT', label: PORTAL_LABELS.GROUP_AGENT, dossiers: 0, applicants: 0, revenueEur: 0 },
    CORPORATE: { portalType: 'CORPORATE', label: PORTAL_LABELS.CORPORATE, dossiers: 0, applicants: 0, revenueEur: 0 },
  };

  for (const d of currentDossiers) {
    const key = portalStatsMap[d.portalType] ? d.portalType : 'INDIVIDUAL';
    portalStatsMap[key].dossiers += 1;
    portalStatsMap[key].applicants += Math.max(1, Number(d._count?.applicants || 1));
  }

  for (const t of currentTxs) {
    const key = resolveTxPortalType(t);
    if (!portalStatsMap[key]) continue;
    const amtEur = convertToEur(Math.abs(Number(t.amount || 0)), t.currency || 'EUR', eurToAznRate);
    if (t.status === 'PAID') portalStatsMap[key].revenueEur += amtEur;
    else if (t.status === 'REFUNDED') portalStatsMap[key].revenueEur -= amtEur;
  }

  const totalPortalDossiers = Math.max(1, currentDossiers.length);
  const totalPortalRev = Math.max(1, netRevenueEur);
  const portalBreakdown = Object.values(portalStatsMap).map((row) => {
    const cleanRev = Number(Math.max(0, row.revenueEur).toFixed(2));
    return {
      ...row,
      revenueEur: cleanRev,
      sharePct: currentDossiers.length > 0 ? Number(((row.dossiers / totalPortalDossiers) * 100).toFixed(1)) : 0,
      revenueSharePct: netRevenueEur > 0 ? Number(((cleanRev / totalPortalRev) * 100).toFixed(1)) : 0,
    };
  });

  // --- Top Destination Countries ---
  const dossierCountryRevenue = new Map();
  for (const t of currentTxs) {
    const cid = t.dossier?.countryId;
    if (!cid) continue;
    const amtEur = convertToEur(Math.abs(Number(t.amount || 0)), t.currency || 'EUR', eurToAznRate);
    const delta = t.status === 'PAID' ? amtEur : -amtEur;
    dossierCountryRevenue.set(cid, (dossierCountryRevenue.get(cid) || 0) + delta);
  }

  const countryMap = new Map();
  for (const d of currentDossiers) {
    const cid = d.countryId || 'UNKNOWN';
    if (!countryMap.has(cid)) {
      countryMap.set(cid, {
        countryId: cid,
        code: d.country?.code || 'EU',
        name: d.country?.nameEn || d.country?.nameAz || 'Schengen',
        dossiers: 0,
        applicants: 0,
        approved: 0,
        rejected: 0,
        revenueEur: Number(Math.max(0, dossierCountryRevenue.get(cid) || 0).toFixed(2)),
      });
    }
    const c = countryMap.get(cid);
    c.dossiers += 1;
    c.applicants += Math.max(1, Number(d._count?.applicants || 1));
    if (d.status === 'APPROVED') c.approved += 1;
    if (d.status === 'REJECTED') c.rejected += 1;
  }

  const topDestinations = Array.from(countryMap.values())
    .map((c) => {
      const decided = c.approved + c.rejected;
      return {
        ...c,
        approvalRatePct: decided > 0 ? Number(((c.approved / decided) * 100).toFixed(1)) : 0,
      };
    })
    .sort((a, b) => b.dossiers - a.dossiers || b.revenueEur - a.revenueEur)
    .slice(0, 8);

  // --- Payment Methods Breakdown ---
  const providerMap = new Map();
  for (const t of currentTxs) {
    if (t.status !== 'PAID') continue;
    const key = normalizeProvider(t.paymentProvider);
    if (!providerMap.has(key)) {
      providerMap.set(key, {
        provider: key,
        label: PROVIDER_LABELS[key] || key,
        count: 0,
        amountEur: 0,
      });
    }
    const entry = providerMap.get(key);
    entry.count += 1;
    entry.amountEur = Number(
      (entry.amountEur + convertToEur(Math.abs(Number(t.amount || 0)), t.currency || 'EUR', eurToAznRate)).toFixed(2)
    );
  }

  const totalProviderVolume = Array.from(providerMap.values()).reduce((sum, r) => sum + r.amountEur, 0);
  const paymentMethods = Array.from(providerMap.values())
    .map((r) => ({
      ...r,
      sharePct: totalProviderVolume > 0 ? Number(((r.amountEur / totalProviderVolume) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.amountEur - a.amountEur || b.count - a.count);

  // --- Document Verification Health ---
  const docHealth = {
    total: 0,
    verified: 0,
    pending: 0,
    needsCorrection: 0,
    rejected: 0,
    verificationRatePct: 0,
  };
  for (const g of docStatusGroups) {
    const c = Number(g._count?.id || 0);
    docHealth.total += c;
    if (g.status === 'VERIFIED') docHealth.verified += c;
    else if (g.status === 'PENDING') docHealth.pending += c;
    else if (g.status === 'NEEDS_CORRECTION') docHealth.needsCorrection += c;
    else if (g.status === 'REJECTED') docHealth.rejected += c;
  }
  docHealth.verificationRatePct =
    docHealth.total > 0 ? Number(((docHealth.verified / docHealth.total) * 100).toFixed(1)) : 0;

  // --- Treasury (Wallet Float + Pending Bank Slips + Pending Payouts) ---
  let totalWalletFloatEur = 0;
  let pendingWalletBalanceEur = 0;
  const walletFloatByPortal = { INDIVIDUAL: 0, GROUP_AGENT: 0, CORPORATE: 0 };

  for (const w of walletsWithRoles) {
    const bal = Number(w.balance || 0);
    const pend = Number(w.pendingBalance || 0);
    totalWalletFloatEur += bal;
    pendingWalletBalanceEur += pend;
    const pType = mapRoleToPortal(w.user?.role);
    if (walletFloatByPortal[pType] !== undefined) {
      walletFloatByPortal[pType] = Number((walletFloatByPortal[pType] + bal).toFixed(2));
    }
  }
  totalWalletFloatEur = Number(totalWalletFloatEur.toFixed(2));
  pendingWalletBalanceEur = Number(pendingWalletBalanceEur.toFixed(2));

  const pendingBankSlipsCount = pendingBankSlips.length;
  const pendingBankSlipsEur = Number(
    pendingBankSlips
      .reduce((sum, s) => sum + convertToEur(Number(s.amount || 0), s.currency || 'EUR', eurToAznRate), 0)
      .toFixed(2)
  );

  const pendingPayoutsCount = pendingPayouts.length;
  const pendingPayoutsEur = Number(
    pendingPayouts.reduce((sum, p) => sum + Number(p.amount || 0), 0).toFixed(2)
  );

  // --- Appointments & Next-14-Day Slot Capacity ---
  const apptByStatus = {
    CONFIRMED: 0,
    COMPLETED: 0,
    PENDING_PAYMENT: 0,
    RESCHEDULED: 0,
    CANCELLED: 0,
    NO_SHOW: 0,
  };
  let upcomingConfirmedCount = 0;

  for (const a of allAppointments) {
    if (apptByStatus[a.status] !== undefined) {
      apptByStatus[a.status] += 1;
    }
    if (a.status === 'CONFIRMED' || a.status === 'RESCHEDULED') {
      const slotDay = a.timeSlot?.slotDate || (a.timeSlot?.date ? formatDayKey(new Date(a.timeSlot.date)) : null);
      if (slotDay && slotDay >= todayKey) {
        upcomingConfirmedCount += 1;
      }
    }
  }

  const dailyCapacityMap = new Map();
  for (let i = 0; i < 14; i++) {
    const d = new Date(todayUtc.getTime() + i * 86400 * 1000);
    const key = formatDayKey(d);
    dailyCapacityMap.set(key, {
      date: key,
      label: formatDayLabel(d),
      booked: 0,
      capacity: 0,
      available: 0,
      occupancyPct: 0,
    });
  }

  let totalBookedNext14d = 0;
  let totalCapacityNext14d = 0;

  for (const slot of upcomingSlots) {
    const key = slot.slotDate || formatDayKey(new Date(slot.date));
    const entry = dailyCapacityMap.get(key);
    const cap = Math.max(0, Number(slot.capacity || 0));
    const booked = Math.min(cap, Math.max(0, Number(slot.bookedCount || 0)));
    if (entry) {
      entry.capacity += cap;
      entry.booked += booked;
      entry.available = Math.max(0, entry.capacity - entry.booked);
      entry.occupancyPct = entry.capacity > 0 ? Number(((entry.booked / entry.capacity) * 100).toFixed(1)) : 0;
      totalCapacityNext14d += cap;
      totalBookedNext14d += booked;
    }
  }

  const slotOccupancyPct =
    totalCapacityNext14d > 0 ? Number(((totalBookedNext14d / totalCapacityNext14d) * 100).toFixed(1)) : 0;

  // --- Promo Codes Impact ---
  let totalPromoDiscountEur = 0;
  let totalPromoOriginalEur = 0;
  const promoCodeRankMap = new Map();

  for (const r of appliedRedemptions) {
    const disc = Number(r.discountAmountEur || 0);
    const orig = Number(r.originalAmountEur || 0);
    totalPromoDiscountEur += disc;
    totalPromoOriginalEur += orig;

    const k = r.promoCodeSnapshot || 'PROMO';
    if (!promoCodeRankMap.has(k)) {
      promoCodeRankMap.set(k, { id: r.promoCodeId, code: k, redemptions: 0, discountEur: 0 });
    }
    const item = promoCodeRankMap.get(k);
    item.redemptions += 1;
    item.discountEur = Number((item.discountEur + disc).toFixed(2));
  }

  totalPromoDiscountEur = Number(totalPromoDiscountEur.toFixed(2));
  const avgDiscountPct =
    totalPromoOriginalEur > 0 ? Number(((totalPromoDiscountEur / totalPromoOriginalEur) * 100).toFixed(1)) : 0;

  const topPromoCodes = Array.from(promoCodeRankMap.values())
    .sort((a, b) => b.discountEur - a.discountEur || b.redemptions - a.redemptions)
    .slice(0, 4);

  // --- User Base & Growth ---
  const usersByRole = { INDIVIDUAL: 0, AGENT_TUR_OPERATOR: 0, CORPORATE_HR: 0, STAFF: 0 };
  let newUsersInRange = 0;
  let prevNewUsers = 0;

  for (const u of allUsers) {
    if (u.role === 'INDIVIDUAL') usersByRole.INDIVIDUAL += 1;
    else if (u.role === 'AGENT_TUR_OPERATOR') usersByRole.AGENT_TUR_OPERATOR += 1;
    else if (u.role === 'CORPORATE_HR') usersByRole.CORPORATE_HR += 1;
    else usersByRole.STAFF += 1;

    const created = new Date(u.createdAt);
    if (!startDate || (created >= startDate && created <= endDate)) {
      if (['INDIVIDUAL', 'AGENT_TUR_OPERATOR', 'CORPORATE_HR'].includes(u.role)) {
        newUsersInRange += 1;
      }
    } else if (prevStartDate && prevEndDate && created >= prevStartDate && created < prevEndDate) {
      if (['INDIVIDUAL', 'AGENT_TUR_OPERATOR', 'CORPORATE_HR'].includes(u.role)) {
        prevNewUsers += 1;
      }
    }
  }

  const totalPortalUsers = usersByRole.INDIVIDUAL + usersByRole.AGENT_TUR_OPERATOR + usersByRole.CORPORATE_HR;

  return {
    meta: {
      range,
      portalType: portalFilter,
      granularity,
      eurToAznRate,
      generatedAt: endDate.toISOString(),
    },
    // Backward-compatible summary keys
    summary: {
      activeDossiers,
      underReviewCount: liveStatusCounts.UNDER_REVIEW,
      approvedThisMonth,
      totalRevenue: allTimeNetRevenueEur,
    },
    kpis: {
      totalApplications: currentDossiers.length,
      totalApplicationsDeltaPct: prevRangeWhere ? calcDeltaPct(currentDossiers.length, prevDossiersCount) : 0,
      activeDossiers,
      totalApplicantsInRange,
      awaitingReviewCount,
      underReviewCount: liveStatusCounts.UNDER_REVIEW,
      needsCorrectionCount: liveStatusCounts.NEEDS_CORRECTION,
      pendingDocumentsCount: docHealth.pending,
      approvalRatePct,
      approvedCount: periodApproved,
      rejectedCount: periodRejected,
      approvedThisMonth,
      avgTurnaroundDays,
      netRevenueEur,
      netRevenueAzn: convertEurToAzn(netRevenueEur, eurToAznRate),
      netRevenueDeltaPct: prevRangeWhere ? calcDeltaPct(netRevenueEur, prevNetRevenueEur) : 0,
      avgOrderValueEur,
      allTimeNetRevenueEur,
      upcomingAppointmentsCount: upcomingConfirmedCount,
      slotOccupancyPct,
      slotBookedNext14d: totalBookedNext14d,
      slotCapacityNext14d: totalCapacityNext14d,
      pendingActionsTotal: pendingBankSlipsCount + pendingPayoutsCount,
      walletFloatEur: totalWalletFloatEur,
      promoDiscountsEur: totalPromoDiscountEur,
    },
    triage: {
      newSubmissionsCount: liveStatusCounts.RECEIVED,
      needsCorrectionCount: liveStatusCounts.NEEDS_CORRECTION,
      submittedToConsulateCount: liveStatusCounts.SUBMITTED_TO_CONSULATE,
      pendingBankSlipsCount,
      pendingBankSlipsEur,
      pendingPayoutsCount,
      pendingPayoutsEur,
      pendingDocumentsCount: docHealth.pending,
    },
    timeSeries,
    portalBreakdown,
    statusPipeline,
    documentHealth: docHealth,
    topDestinations,
    paymentMethods,
    treasury: {
      totalWalletFloatEur,
      totalWalletFloatAzn: convertEurToAzn(totalWalletFloatEur, eurToAznRate),
      pendingWalletBalanceEur,
      walletFloatByPortal,
      pendingBankSlipsCount,
      pendingBankSlipsEur,
      pendingPayoutsCount,
      pendingPayoutsEur,
    },
    appointments: {
      upcomingConfirmedCount,
      occupancyPct: slotOccupancyPct,
      totalBookedNext14d,
      totalCapacityNext14d,
      byStatus: apptByStatus,
      dailyCapacity: Array.from(dailyCapacityMap.values()),
    },
    promoImpact: {
      activeCodesCount: activePromoCount,
      redemptionsCount: appliedRedemptions.length,
      totalDiscountEur: totalPromoDiscountEur,
      avgDiscountPct,
      topCodes: topPromoCodes,
    },
    userGrowth: {
      totalUsers: totalPortalUsers,
      newUsersInRange,
      newUsersDeltaPct: prevRangeWhere ? calcDeltaPct(newUsersInRange, prevNewUsers) : 0,
      byRole: usersByRole,
    },
  };
}

module.exports = {
  getAccurateSummaryMetrics,
  getExecutiveAnalytics,
  computeNetEarnedRevenueEur,
  isWalletTopupTransaction,
};
