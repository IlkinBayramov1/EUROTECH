import React, { useState, useEffect, useCallback } from 'react';
import { adminService } from '@/shared/api/services/admin.service';
import { useToast } from '@/shared/context/ToastContext';
import { getFileUrl } from '@/shared/utils/file.util';
import { storage } from '@/shared/utils/storage';
import { downloadFileFromApi } from '@/shared/utils/download.util';
import './AdminFinancials.css';

interface BankSlipItem {
  id: string;
  dossierId?: string | null;
  groupBatchId?: string | null;
  dossierNumber?: string | null;
  groupBatchCode?: string | null;
  applicantName?: string;
  email?: string;
  amount: number;
  currency: string;
  referenceCode: string;
  fileUrl: string;
  fileName: string;
  bankName?: string;
  senderName?: string;
  purpose?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'VERIFIED' | 'PENDING_REVIEW' | string;
  notes?: string;
  createdAt: string;
  reviewedAt?: string;
}

function formatSlipCurrency(amount?: number, currency?: string): string {
  const cur = (currency || 'EUR').toUpperCase();
  const sym = cur === 'AZN' ? '₼' : cur === 'USD' ? '$' : '€';
  return `${sym}${Number(amount || 0).toFixed(2)} ${cur}`;
}

interface UserWalletItem {
  userId: string;
  fullName: string;
  email: string;
  phone?: string;
  role: string;
  companyName?: string;
  agentTier?: string;
  walletId?: string;
  balance: number;
  pendingBalance: number;
  currency: string;
  dossiersCount: number;
  batchesCount: number;
  updatedAt?: string;
}

interface AgentPayoutItem {
  id: string;
  walletId: string;
  agentName: string;
  companyName: string;
  email?: string;
  phone?: string;
  amount: number;
  bankName: string;
  iban: string;
  swiftBic?: string;
  status: 'PENDING' | 'PROCESSED' | 'REJECTED';
  createdAt: string;
  processedAt?: string;
}

interface CronJobItem {
  id: string;
  name: string;
  schedule: string;
  status: string;
  lastRunStatus: string;
  description: string;
}

export default function AdminFinancials() {
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState<'slips' | 'wallets' | 'payouts' | 'crons'>('slips');
  const [loading, setLoading] = useState(true);

  // Bank Slips State
  const [bankSlips, setBankSlips] = useState<BankSlipItem[]>([]);
  const [slipFilter, setSlipFilter] = useState<string>('ALL');
  const [selectedSlip, setSelectedSlip] = useState<BankSlipItem | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmittingSlip, setIsSubmittingSlip] = useState(false);
  const [openingSlipId, setOpeningSlipId] = useState<string | null>(null);
  const [downloadingSlipId, setDownloadingSlipId] = useState<string | null>(null);

  // User Wallets State
  const [wallets, setWallets] = useState<UserWalletItem[]>([]);
  const [walletRoleFilter, setWalletRoleFilter] = useState<string>('ALL');
  const [walletSearch, setWalletSearch] = useState<string>('');
  const [selectedWalletUser, setSelectedWalletUser] = useState<UserWalletItem | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('50.00');
  const [adjustType, setAdjustType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [adjustReason, setAdjustReason] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Agent Payouts State
  const [agentPayouts, setAgentPayouts] = useState<AgentPayoutItem[]>([]);
  const [payoutFilter, setPayoutFilter] = useState<string>('ALL');
  const [isProcessingPayout, setIsProcessingPayout] = useState(false);

  // Cron Monitor State
  const [cronJobs, setCronJobs] = useState<CronJobItem[]>([]);
  const [cronTimestamp, setCronTimestamp] = useState<string>('');

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [slipsRes, walletsRes, payoutsRes, cronsRes] = await Promise.allSettled([
        adminService.getBankSlips(),
        adminService.getUserWallets({ role: walletRoleFilter, search: walletSearch }),
        adminService.getAgentPayouts(),
        adminService.getCronMonitorStatus(),
      ]);

      if (slipsRes.status === 'fulfilled') {
        const raw = slipsRes.value?.data?.data || slipsRes.value?.data?.slips || slipsRes.value?.data;
        setBankSlips(Array.isArray(raw) ? raw : []);
      }
      if (walletsRes.status === 'fulfilled') {
        const raw = walletsRes.value?.data?.data?.wallets || walletsRes.value?.data?.wallets || walletsRes.value?.data;
        setWallets(Array.isArray(raw) ? raw : []);
      }
      if (payoutsRes.status === 'fulfilled') {
        const raw = payoutsRes.value?.data?.data || payoutsRes.value?.data;
        setAgentPayouts(Array.isArray(raw) ? raw : []);
      }
      if (cronsRes.status === 'fulfilled') {
        const d = cronsRes.value?.data?.data || cronsRes.value?.data;
        setCronJobs(d?.jobs || []);
        setCronTimestamp(d?.timestamp || '');
      }
    } catch (err: any) {
      console.warn('Failed to load financials data:', err);
      showError('Failed to load financial operations data.');
    } finally {
      setLoading(false);
    }
  }, [walletRoleFilter, walletSearch, showError]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Bank Slip Actions
  const handleOpenSlipFile = async (slip: BankSlipItem, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!slip) return;
    setOpeningSlipId(slip.id);
    try {
      const token = storage.getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const apiEndpoint = getFileUrl(`/api/v1/admin/bank-slips/${slip.id}/file?inline=true`);
      let res = await fetch(apiEndpoint, { method: 'GET', headers });

      if (!res.ok && slip.fileUrl) {
        const fallbackUrl = getFileUrl(slip.fileUrl);
        if (fallbackUrl) {
          res = await fetch(fallbackUrl, { method: 'GET', headers });
        }
      }

      if (!res.ok) {
        throw new Error(`Receipt file could not be loaded (Status: ${res.status})`);
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const opened = window.open(blobUrl, '_blank');
      if (!opened) {
        const a = window.document.createElement('a');
        a.href = blobUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        window.document.body.appendChild(a);
        a.click();
        window.document.body.removeChild(a);
      }
    } catch (err: any) {
      console.error('Failed to open bank receipt file:', err);
      showError(err.message || 'Failed to open bank receipt file.');
    } finally {
      setOpeningSlipId(null);
    }
  };

  const handleDownloadSlipFile = async (slip: BankSlipItem, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!slip) return;
    setDownloadingSlipId(slip.id);
    try {
      const safeName =
        slip.fileName && !slip.fileName.includes('placeholder')
          ? slip.fileName
          : `bank_voucher_${slip.referenceCode || slip.id.substring(0, 8)}.pdf`;
      await downloadFileFromApi(`/api/v1/admin/bank-slips/${slip.id}/file`, safeName);
    } catch (err: any) {
      console.error('Failed to download bank receipt file:', err);
      showError(err.message || 'Failed to download bank receipt file.');
    } finally {
      setDownloadingSlipId(null);
    }
  };

  const handleReviewSlip = async (action: 'APPROVED' | 'REJECTED') => {
    if (!selectedSlip) return;
    setIsSubmittingSlip(true);
    try {
      await adminService.reviewBankSlip(selectedSlip.id, {
        status: action,
        notes: reviewNotes,
      });
      showSuccess(`Bank receipt successfully marked as ${action}.`);
      setSelectedSlip(null);
      setReviewNotes('');
      loadAllData();
    } catch (err: any) {
      showError(err.response?.data?.message || err.message || 'Failed to review bank receipt.');
    } finally {
      setIsSubmittingSlip(false);
    }
  };

  // Agent Payout Actions
  const handleUpdatePayout = async (payoutId: string, status: 'PROCESSED' | 'REJECTED') => {
    if (!confirm(`Are you sure you want to mark this payout as ${status}?`)) return;
    setIsProcessingPayout(true);
    try {
      await adminService.updateAgentPayoutStatus(payoutId, status);
      showSuccess(`Payout request successfully marked as ${status}.`);
      loadAllData();
    } catch (err: any) {
      showError(err.response?.data?.message || err.message || 'Failed to update payout request.');
    } finally {
      setIsProcessingPayout(false);
    }
  };

  // Wallet Adjustment Action
  const handleExecuteWalletAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWalletUser) return;
    const amt = parseFloat(adjustAmount);
    if (isNaN(amt) || amt <= 0) {
      showError('Please enter a valid adjustment amount.');
      return;
    }
    if (!adjustReason.trim()) {
      showError('Please state an official reason for the balance adjustment.');
      return;
    }

    setIsAdjusting(true);
    try {
      await adminService.adjustUserWallet(selectedWalletUser.userId, {
        amount: amt,
        type: adjustType,
        reason: adjustReason.trim(),
      });
      showSuccess(`Successfully adjusted ${selectedWalletUser.fullName}'s wallet (${adjustType === 'CREDIT' ? '+' : '-'}€${amt.toFixed(2)}).`);
      setSelectedWalletUser(null);
      setAdjustReason('');
      loadAllData();
    } catch (err: any) {
      showError(err.response?.data?.message || err.message || 'Wallet adjustment failed.');
    } finally {
      setIsAdjusting(false);
    }
  };

  const filteredSlips = bankSlips.filter((s) => {
    if (slipFilter === 'ALL') return true;
    const st = (s.status === 'VERIFIED' ? 'APPROVED' : s.status);
    return st === slipFilter;
  });

  const filteredPayouts = agentPayouts.filter((p) => {
    if (payoutFilter === 'ALL') return true;
    return p.status === payoutFilter;
  });

  const pendingSlipsCount = bankSlips.filter((s) => s.status === 'PENDING' || s.status === 'PENDING_REVIEW').length;
  const pendingPayoutsCount = agentPayouts.filter((p) => p.status === 'PENDING').length;

  return (
    <div className="admin-financials-view">
      {/* Top Header */}
      <div className="financials-header">
        <div>
          <h1 className="financials-title">Financial Oversight &amp; Balances Center</h1>
          <p className="financials-subtitle">
            Manage user and corporate pre-funded wallets, review manual bank wire transfer slips, and supervise agency commission payouts.
          </p>
        </div>
        <div className="financials-actions">
          <button className="btn-refresh-fin" onClick={loadAllData} disabled={loading}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh Data
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="financials-tabs-bar">
        <button
          className={`fin-tab-btn ${activeTab === 'slips' ? 'active' : ''}`}
          onClick={() => setActiveTab('slips')}
        >
          Bank Transfer Slips
          {pendingSlipsCount > 0 && <span className="tab-pill pill-amber">{pendingSlipsCount}</span>}
        </button>

        <button
          className={`fin-tab-btn ${activeTab === 'wallets' ? 'active' : ''}`}
          onClick={() => setActiveTab('wallets')}
        >
          User Wallets &amp; Balances ({wallets.length})
        </button>

        <button
          className={`fin-tab-btn ${activeTab === 'payouts' ? 'active' : ''}`}
          onClick={() => setActiveTab('payouts')}
        >
          Agent Commission Payouts
          {pendingPayoutsCount > 0 && <span className="tab-pill pill-purple">{pendingPayoutsCount}</span>}
        </button>

        <button
          className={`fin-tab-btn ${activeTab === 'crons' ? 'active' : ''}`}
          onClick={() => setActiveTab('crons')}
        >
          Cron Background Workers
          <span className="tab-pill pill-green">5 Active</span>
        </button>
      </div>

      {/* TAB 1: BANK SLIPS */}
      {activeTab === 'slips' && (
        <div className="financials-tab-pane">
          <div className="table-controls-bar">
            <div className="filter-pill-group">
              <button
                className={`filter-btn ${slipFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setSlipFilter('ALL')}
              >
                All Slips ({bankSlips.length})
              </button>
              <button
                className={`filter-btn ${slipFilter === 'PENDING' ? 'active' : ''}`}
                onClick={() => setSlipFilter('PENDING')}
              >
                Pending Review ({pendingSlipsCount})
              </button>
              <button
                className={`filter-btn ${slipFilter === 'APPROVED' ? 'active' : ''}`}
                onClick={() => setSlipFilter('APPROVED')}
              >
                Approved ({bankSlips.filter((s) => s.status === 'APPROVED' || s.status === 'VERIFIED').length})
              </button>
              <button
                className={`filter-btn ${slipFilter === 'REJECTED' ? 'active' : ''}`}
                onClick={() => setSlipFilter('REJECTED')}
              >
                Rejected ({bankSlips.filter((s) => s.status === 'REJECTED').length})
              </button>
            </div>
          </div>

          {loading ? (
            <div className="fin-loading">
              <div className="spinner"></div>
              <span>Loading bank transfer receipts...</span>
            </div>
          ) : filteredSlips.length === 0 ? (
            <div className="fin-empty">
              <p>No bank receipts found matching the selected filter.</p>
            </div>
          ) : (
            <div className="fin-table-card">
              <table className="fin-table">
                <thead>
                  <tr>
                    <th>Target / Purpose</th>
                    <th>Applicant / Sender</th>
                    <th>Amount &amp; Currency</th>
                    <th>Reference Code</th>
                    <th>Receipt Document</th>
                    <th>Date Uploaded</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSlips.map((slip) => {
                    const isApproved = slip.status === 'APPROVED' || slip.status === 'VERIFIED';
                    const isPending = slip.status === 'PENDING' || slip.status === 'PENDING_REVIEW';
                    const targetCode = slip.dossierNumber || slip.groupBatchCode || 'WALLET';
                    const purposeLabel = slip.purpose
                      ? slip.purpose.replace(/_/g, ' ')
                      : slip.dossierNumber
                        ? `Dossier ${slip.dossierNumber}`
                        : slip.groupBatchCode
                          ? `Group ${slip.groupBatchCode}`
                          : 'Wallet Top-Up';

                    return (
                      <tr key={slip.id}>
                        <td>
                          <span className="code-badge">{targetCode}</span>
                          <span style={{ display: 'block', fontSize: '0.74rem', color: '#64748B', marginTop: 2 }}>
                            {purposeLabel}
                          </span>
                        </td>
                        <td>
                          <div className="user-info-cell">
                            <strong>{slip.senderName || slip.applicantName || 'Applicant'}</strong>
                            <span>{slip.email || slip.bankName || 'Wire Transfer'}</span>
                          </div>
                        </td>
                        <td>
                          <strong className="amount-cell">
                            {formatSlipCurrency(slip.amount, slip.currency)}
                          </strong>
                        </td>
                        <td>
                          <code className="ref-code">{slip.referenceCode || slip.id.substring(0, 8)}</code>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={(e) => handleOpenSlipFile(slip, e)}
                            disabled={openingSlipId === slip.id}
                            className="doc-link-btn"
                            title="Open Official Bank Transfer Receipt in New Tab"
                          >
                            {openingSlipId === slip.id
                              ? 'Opening...'
                              : `${slip.fileName && !slip.fileName.includes('placeholder') ? slip.fileName : 'View Receipt.pdf'} ↗`}
                          </button>
                        </td>
                        <td>{slip.createdAt ? new Date(slip.createdAt).toLocaleDateString('en-GB') : '—'}</td>
                        <td>
                          <span className={`status-pill status-${isApproved ? 'approved' : isPending ? 'pending' : 'rejected'}`}>
                            {isApproved ? 'APPROVED' : isPending ? 'PENDING' : 'REJECTED'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn-examine-slip"
                            onClick={() => {
                              setSelectedSlip(slip);
                              setReviewNotes(slip.notes || '');
                            }}
                          >
                            Review &amp; Decide →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: USER WALLETS & BALANCES */}
      {activeTab === 'wallets' && (
        <div className="financials-tab-pane">
          <div className="table-controls-bar" style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div className="filter-pill-group">
              <button
                className={`filter-btn ${walletRoleFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setWalletRoleFilter('ALL')}
              >
                All Profiles ({wallets.length})
              </button>
              <button
                className={`filter-btn ${walletRoleFilter === 'INDIVIDUAL' ? 'active' : ''}`}
                onClick={() => setWalletRoleFilter('INDIVIDUAL')}
              >
                Individual Clients ({wallets.filter(w => w.role === 'INDIVIDUAL').length})
              </button>
              <button
                className={`filter-btn ${walletRoleFilter === 'AGENT_TUR_OPERATOR' ? 'active' : ''}`}
                onClick={() => setWalletRoleFilter('AGENT_TUR_OPERATOR')}
              >
                Tour Operators ({wallets.filter(w => w.role === 'AGENT_TUR_OPERATOR' || w.role === 'AGENT').length})
              </button>
              <button
                className={`filter-btn ${walletRoleFilter === 'CORPORATE_HR' ? 'active' : ''}`}
                onClick={() => setWalletRoleFilter('CORPORATE_HR')}
              >
                Corporate HR ({wallets.filter(w => w.role === 'CORPORATE_HR' || w.role === 'CORPORATE').length})
              </button>
            </div>

            <div style={{ minWidth: 260 }}>
              <input 
                type="text"
                placeholder="Search user, email, company..."
                value={walletSearch}
                onChange={(e) => setWalletSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1.5px solid #CBD5E1',
                  fontSize: '0.88rem'
                }}
              />
            </div>
          </div>

          {loading ? (
            <div className="fin-loading">
              <div className="spinner"></div>
              <span>Loading user wallets and multi-currency balances...</span>
            </div>
          ) : wallets.length === 0 ? (
            <div className="fin-empty">
              <p>No user wallets found matching the selected filter criteria.</p>
            </div>
          ) : (
            <div className="fin-table-card">
              <table className="fin-table">
                <thead>
                  <tr>
                    <th>User &amp; Organization</th>
                    <th>Profile Role</th>
                    <th>Available Balance</th>
                    <th>Pending Clearing</th>
                    <th>Managed Applications</th>
                    <th>Last Activity</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {wallets.map((w) => {
                    const balEur = Number(w.balance || 0);
                    const balAzn = balEur * 1.80;
                    const roleLabel = w.role === 'AGENT_TUR_OPERATOR' || w.role === 'AGENT' 
                      ? 'TOUR OPERATOR' 
                      : w.role === 'CORPORATE_HR' || w.role === 'CORPORATE' 
                        ? 'CORPORATE HR' 
                        : 'INDIVIDUAL CLIENT';

                    return (
                      <tr key={w.userId}>
                        <td>
                          <div className="user-info-cell">
                            <strong>{w.fullName || 'User'}</strong>
                            <span>{w.email}</span>
                            {w.companyName && <span style={{ color: '#2563EB', fontWeight: 600 }}>{w.companyName}</span>}
                          </div>
                        </td>
                        <td>
                          <span className={`status-pill ${
                            w.role.includes('AGENT') ? 'status-approved' : w.role.includes('CORPORATE') ? 'status-pending' : 'status-neutral'
                          }`}>
                            {roleLabel}
                          </span>
                        </td>
                        <td>
                          <strong className="amount-cell" style={{ color: balEur > 0 ? '#15803D' : '#0F1E36' }}>
                            €{balEur.toFixed(2)}
                          </strong>
                          <span style={{ display: 'block', fontSize: '0.78rem', color: '#64748B' }}>
                            ≈ {balAzn.toFixed(2)} AZN
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.85rem', color: Number(w.pendingBalance || 0) > 0 ? '#B45309' : '#64748B', fontWeight: 600 }}>
                            €{Number(w.pendingBalance || 0).toFixed(2)}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.85rem', color: '#334155' }}>
                            {w.dossiersCount > 0 && `${w.dossiersCount} Dossier(s) `}
                            {w.batchesCount > 0 && `• ${w.batchesCount} Batch(es)`}
                            {w.dossiersCount === 0 && w.batchesCount === 0 && '0'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.82rem', color: '#64748B' }}>
                            {w.updatedAt ? new Date(w.updatedAt).toLocaleDateString('en-GB') : '—'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn-examine-slip"
                            onClick={() => {
                              setSelectedWalletUser(w);
                              setAdjustAmount('50.00');
                              setAdjustType('CREDIT');
                              setAdjustReason('');
                            }}
                            title="Adjust EuroTech Wallet Balance with Admin Audit Trail"
                          >
                            Adjust Balance
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AGENT PAYOUTS */}
      {activeTab === 'payouts' && (
        <div className="financials-tab-pane">
          <div className="table-controls-bar">
            <div className="filter-pill-group">
              <button
                className={`filter-btn ${payoutFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setPayoutFilter('ALL')}
              >
                All Requests ({agentPayouts.length})
              </button>
              <button
                className={`filter-btn ${payoutFilter === 'PENDING' ? 'active' : ''}`}
                onClick={() => setPayoutFilter('PENDING')}
              >
                Pending ({pendingPayoutsCount})
              </button>
              <button
                className={`filter-btn ${payoutFilter === 'PROCESSED' ? 'active' : ''}`}
                onClick={() => setPayoutFilter('PROCESSED')}
              >
                Settled ({agentPayouts.filter((p) => p.status === 'PROCESSED').length})
              </button>
              <button
                className={`filter-btn ${payoutFilter === 'REJECTED' ? 'active' : ''}`}
                onClick={() => setPayoutFilter('REJECTED')}
              >
                Rejected / Refunded ({agentPayouts.filter((p) => p.status === 'REJECTED').length})
              </button>
            </div>
          </div>

          {loading ? (
            <div className="fin-loading">
              <div className="spinner"></div>
              <span>Loading agent withdrawal requests...</span>
            </div>
          ) : filteredPayouts.length === 0 ? (
            <div className="fin-empty">
              <p>No payout requests found matching the selected filter.</p>
            </div>
          ) : (
            <div className="fin-table-card">
              <table className="fin-table">
                <thead>
                  <tr>
                    <th>Agency &amp; Agent</th>
                    <th>Amount (€)</th>
                    <th>Banking Coordinates (IBAN)</th>
                    <th>Submission Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayouts.map((payout) => (
                    <tr key={payout.id}>
                      <td>
                        <div className="user-info-cell">
                          <strong>{payout.companyName || payout.agentName}</strong>
                          <span>{payout.agentName} • {payout.email || 'Agent Partner'}</span>
                        </div>
                      </td>
                      <td>
                        <strong className="amount-cell text-emerald">
                          €{Number(payout.amount || 0).toFixed(2)}
                        </strong>
                      </td>
                      <td>
                        <div className="iban-cell">
                          <code className="ref-code">{payout.iban}</code>
                          <span>{payout.bankName} {payout.swiftBic ? `(${payout.swiftBic})` : ''}</span>
                        </div>
                      </td>
                      <td>{payout.createdAt ? new Date(payout.createdAt).toLocaleDateString('en-GB') : '—'}</td>
                      <td>
                        <span className={`status-pill status-${payout.status.toLowerCase()}`}>
                          {payout.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {payout.status === 'PENDING' ? (
                          <div className="payout-action-btns">
                            <button
                              className="btn-approve-payout"
                              disabled={isProcessingPayout}
                              onClick={() => handleUpdatePayout(payout.id, 'PROCESSED')}
                            >
                              Approve
                            </button>
                            <button
                              className="btn-reject-payout"
                              disabled={isProcessingPayout}
                              onClick={() => handleUpdatePayout(payout.id, 'REJECTED')}
                            >
                              Reject &amp; Refund
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted text-sm">
                            {payout.status === 'PROCESSED' ? 'Funds Dispatched' : 'Refunded to Wallet'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CRON MONITOR */}
      {activeTab === 'crons' && (
        <div className="financials-tab-pane">
          <div className="cron-header-box">
            <div>
              <h3>Scheduled System Cron Workers</h3>
              <p>EuroTech Visa Engine automated daemon jobs for archival, notifications, payment expiries, and tier upgrades.</p>
            </div>
            {cronTimestamp && (
              <span className="cron-ping">
                Last Heartbeat: {new Date(cronTimestamp).toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="cron-grid">
            {cronJobs.map((job) => (
              <div key={job.id} className="cron-card">
                <div className="cron-card-top">
                  <span className="cron-id-pill">{job.id}</span>
                  <span className="status-pill status-approved">● {job.status}</span>
                </div>
                <h4>{job.name}</h4>
                <p className="cron-desc">{job.description}</p>
                <div className="cron-meta">
                  <div className="cron-schedule">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>{job.schedule}</span>
                  </div>
                  <div className="cron-health">
                    <span className="health-dot"></span>
                    <span>Last Run: {job.lastRunStatus}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: REVIEW BANK SLIP */}
      {selectedSlip && (
        <div className="modal-backdrop">
          <div className="review-modal-card">
            <div className="modal-header">
              <h3>Examine Bank Transfer Receipt</h3>
              <button className="btn-close" onClick={() => setSelectedSlip(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="modal-summary-grid">
                <div>
                  <label>Purpose / Target</label>
                  <strong>{selectedSlip.dossierNumber || selectedSlip.groupBatchCode || (selectedSlip.purpose ? selectedSlip.purpose.replace(/_/g, ' ') : 'Wallet Top-Up')}</strong>
                </div>
                <div>
                  <label>Applicant / Sender</label>
                  <strong>{selectedSlip.senderName || selectedSlip.applicantName || 'Applicant'}</strong>
                </div>
                <div>
                  <label>Transfer Amount</label>
                  <strong className="text-emerald">{formatSlipCurrency(selectedSlip.amount, selectedSlip.currency)}</strong>
                </div>
                <div>
                  <label>Payment Reference Code</label>
                  <code>{selectedSlip.referenceCode}</code>
                </div>
              </div>

              <div className="receipt-preview-box">
                <label>Submitted Receipt Document</label>
                <div className="receipt-link-card">
                  <span>
                    {selectedSlip.fileName && !selectedSlip.fileName.includes('placeholder')
                      ? selectedSlip.fileName
                      : `bank_voucher_${selectedSlip.referenceCode || selectedSlip.id.substring(0, 8)}.pdf`}
                  </span>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={(e) => handleOpenSlipFile(selectedSlip, e)}
                      disabled={openingSlipId === selectedSlip.id}
                      className="btn-download-slip"
                    >
                      {openingSlipId === selectedSlip.id ? 'Opening...' : 'Open File in New Tab ↗'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDownloadSlipFile(selectedSlip, e)}
                      disabled={downloadingSlipId === selectedSlip.id}
                      className="btn-download-slip"
                      style={{ color: '#0F172A' }}
                    >
                      {downloadingSlipId === selectedSlip.id ? 'Downloading...' : 'Download ↓'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="notes-input-box">
                <label>Consular Officer Notes / Verification Remarks</label>
                <textarea
                  placeholder="Record verification notes, bank reference confirmation, or rejection reason..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-cancel"
                onClick={() => setSelectedSlip(null)}
                disabled={isSubmittingSlip}
              >
                Cancel
              </button>
              <button
                className="btn-reject"
                disabled={
                  isSubmittingSlip ||
                  selectedSlip.status === 'APPROVED' ||
                  selectedSlip.status === 'VERIFIED' ||
                  selectedSlip.status === 'REJECTED'
                }
                onClick={() => handleReviewSlip('REJECTED')}
              >
                {selectedSlip.status === 'REJECTED' ? 'Already Rejected' : 'Reject Receipt'}
              </button>
              <button
                className="btn-approve"
                disabled={
                  isSubmittingSlip ||
                  selectedSlip.status === 'APPROVED' ||
                  selectedSlip.status === 'VERIFIED'
                }
                onClick={() => handleReviewSlip('APPROVED')}
              >
                {selectedSlip.status === 'APPROVED' || selectedSlip.status === 'VERIFIED'
                  ? 'Already Approved'
                  : 'Approve & Settle Funds'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADJUST USER WALLET */}
      {selectedWalletUser && (
        <div className="modal-backdrop">
          <div className="review-modal-card">
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>Adjust EuroTech Wallet Balance</h3>
                <span style={{ fontSize: '0.82rem', color: '#64748B' }}>
                  User: <strong>{selectedWalletUser.fullName}</strong> ({selectedWalletUser.email})
                </span>
              </div>
              <button className="btn-close" onClick={() => setSelectedWalletUser(null)}>&times;</button>
            </div>

            <form onSubmit={handleExecuteWalletAdjustment}>
              <div className="modal-body">
                <div className="modal-summary-grid" style={{ marginBottom: 16 }}>
                  <div>
                    <label>Current Available Balance</label>
                    <strong style={{ color: '#2563EB', fontSize: '1.2rem' }}>
                      €{Number(selectedWalletUser.balance || 0).toFixed(2)}
                    </strong>
                  </div>
                  <div>
                    <label>Profile Role</label>
                    <strong>{selectedWalletUser.role}</strong>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  <button
                    type="button"
                    onClick={() => setAdjustType('CREDIT')}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: adjustType === 'CREDIT' ? '2px solid #16A34A' : '1px solid #CBD5E1',
                      background: adjustType === 'CREDIT' ? '#DCFCE7' : '#FFFFFF',
                      fontWeight: 700,
                      color: adjustType === 'CREDIT' ? '#15803D' : '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    + Credit (Add Funds)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('DEBIT')}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: adjustType === 'DEBIT' ? '2px solid #DC2626' : '1px solid #CBD5E1',
                      background: adjustType === 'DEBIT' ? '#FEE2E2' : '#FFFFFF',
                      fontWeight: 700,
                      color: adjustType === 'DEBIT' ? '#DC2626' : '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    - Debit (Deduct Funds)
                  </button>
                </div>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Adjustment Amount (EUR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1.5px solid #CBD5E1',
                      borderRadius: '8px',
                      fontSize: '1.1rem',
                      fontWeight: 700
                    }}
                    required
                  />
                </div>

                <div className="notes-input-box">
                  <label>Audit Reason / Administrative Note *</label>
                  <textarea
                    placeholder="Provide justification for finance audit log (e.g. Approved bank wire reconciliation, billing correction, loyalty incentive)..."
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    rows={3}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setSelectedWalletUser(null)}
                  disabled={isAdjusting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-approve"
                  disabled={isAdjusting}
                  style={{
                    background: adjustType === 'CREDIT' ? '#16A34A' : '#DC2626',
                    borderColor: adjustType === 'CREDIT' ? '#16A34A' : '#DC2626'
                  }}
                >
                  {isAdjusting ? 'Processing...' : `Confirm ${adjustType} €${parseFloat(adjustAmount || '0').toFixed(2)}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
