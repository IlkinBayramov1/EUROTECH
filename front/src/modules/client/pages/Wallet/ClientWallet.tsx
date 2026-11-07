import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/shared/context/AuthContext';
import { paymentService, dossierService } from '@/shared/api/services';
import { useToast } from '@/shared/context/ToastContext';
import './ClientWallet.css';

interface DossierItem {
    id: string;
    dossierNumber: string;
    portalType: string;
    status: string;
    paymentStatus: string;
    totalAmount: number;
    governmentFee: number;
    serviceFee: number;
    extraServicesFee: number;
    createdAt: string;
    country?: { nameEn: string; flag?: string };
    visaCategory?: { nameEn: string };
    applicants?: any[];
}

export default function ClientWallet() {
    const { user } = useAuth();
    const { showSuccess, showError } = useToast();

    // Data state
    const [loading, setLoading] = useState(true);
    const [walletData, setWalletData] = useState<any>(null);
    const [dossiers, setDossiers] = useState<DossierItem[]>([]);
    const [bankSlips, setBankSlips] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'invoices' | 'transactions' | 'slips'>('invoices');

    // Modals
    const [showTopUpModal, setShowTopUpModal] = useState(false);
    const [showPayModal, setShowPayModal] = useState(false);
    const [selectedDossier, setSelectedDossier] = useState<DossierItem | null>(null);

    // Top up form
    const [topupMethod, setTopupMethod] = useState<'CARD' | 'BANK_SLIP'>('CARD');
    const [topupAmount, setTopupAmount] = useState('150.00');
    const [topupCardNumber, setTopupCardNumber] = useState('');
    const [topupCardExpiry, setTopupCardExpiry] = useState('');
    const [topupCardCvc, setTopupCardCvc] = useState('');
    const [slipBankName, setSlipBankName] = useState('International Bank of Azerbaijan (ABB)');
    const [slipSenderName, setSlipSenderName] = useState(user?.fullName || '');
    const [slipRefCode, setSlipRefCode] = useState('');
    const [slipFile, setSlipFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Pay invoice form
    const [invoicePayMethod, setInvoicePayMethod] = useState<'WALLET' | 'CARD' | 'BANK_SLIP'>('WALLET');

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [walletRes, dossiersRes] = await Promise.all([
                paymentService.getUserWallet().catch(() => ({ data: null })),
                dossierService.getMyDossiers().catch(() => ({ data: { dossiers: [] } }))
            ]);

            const w = walletRes?.data?.wallet || walletRes?.data || null;
            const txs = walletRes?.data?.transactions || [];
            const slips = walletRes?.data?.bankSlips || [];

            setWalletData({
                ...w,
                transactions: txs,
                balanceEur: Number(w?.balanceEur ?? walletRes?.data?.balance ?? 0),
                balanceAzn: Number(w?.balanceAzn ?? walletRes?.data?.balanceAzn ?? 0),
                totalDepositedEur: Number(w?.totalDepositedEur ?? 0),
                totalSpentEur: Number(w?.totalSpentEur ?? 0),
            });
            setBankSlips(slips);
            setDossiers(dossiersRes?.data?.dossiers || []);
        } catch (err: any) {
            console.error('Wallet load err:', err);
            showError('Could not load financial data.');
        } finally {
            setLoading(false);
        }
    }, [showError]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const balanceEur = Number(walletData?.balanceEur || 0);
    const balanceAzn = Number(walletData?.balanceAzn || (balanceEur * 1.80));

    // Calculate unpaid fees
    const unpaidDossiers = dossiers.filter(d => d.paymentStatus !== 'PAID');
    const unpaidTotalEur = unpaidDossiers.reduce((sum, d) => sum + Number(d.totalAmount || 0), 0);
    const unpaidTotalAzn = unpaidTotalEur * 1.80;

    // Handle Top Up Submit
    const handleTopUpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(topupAmount);
        if (isNaN(amt) || amt <= 0) {
            showError('Please enter a valid top-up amount.');
            return;
        }

        setIsSubmitting(true);
        try {
            if (topupMethod === 'CARD') {
                await paymentService.topupWallet({
                    amount: amt,
                    currency: 'EUR',
                    method: 'CARD',
                    reference: `CARD-${Date.now().toString().slice(-6)}`,
                });
                showSuccess(`€${amt.toFixed(2)} added directly to your EuroTech Wallet!`);
                setShowTopUpModal(false);
                await loadData();
            } else {
                if (!slipFile) {
                    showError('Please select and upload your bank payment slip.');
                    setIsSubmitting(false);
                    return;
                }
                const fd = new FormData();
                fd.append('amount', amt.toFixed(2));
                fd.append('currency', 'EUR');
                fd.append('bankName', slipBankName);
                fd.append('senderName', slipSenderName || user?.fullName || 'Client');
                fd.append('referenceCode', slipRefCode || `WIRE-${Date.now().toString().slice(-6)}`);
                fd.append('purpose', 'WALLET_TOPUP');
                fd.append('slip', slipFile);

                await paymentService.submitBankSlip(fd);
                showSuccess('Bank transfer slip uploaded! Wallet balance will update upon consular banking review.');
                setShowTopUpModal(false);
                setSlipFile(null);
                await loadData();
            }
        } catch (err: any) {
            console.error('Topup err:', err);
            showError(err.response?.data?.message || err.message || 'Top-up failed.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle Pay Single Dossier
    const handleOpenPayModal = (dossier: DossierItem) => {
        setSelectedDossier(dossier);
        setInvoicePayMethod(balanceEur >= Number(dossier.totalAmount || 0) ? 'WALLET' : 'CARD');
        setShowPayModal(true);
    };

    const handleExecuteDossierPayment = async () => {
        if (!selectedDossier) return;
        const totalDue = Number(selectedDossier.totalAmount || 0);

        setIsSubmitting(true);
        try {
            if (invoicePayMethod === 'WALLET') {
                if (balanceEur < totalDue) {
                    showError(`Insufficient wallet balance (€${balanceEur.toFixed(2)} < €${totalDue.toFixed(2)}). Please top up first.`);
                    setIsSubmitting(false);
                    return;
                }
                await paymentService.payWithWallet({ dossierId: selectedDossier.id });
                showSuccess(`€${totalDue.toFixed(2)} successfully settled from your EuroTech Wallet!`);
                setShowPayModal(false);
                await loadData();
            } else if (invoicePayMethod === 'CARD') {
                // Online card settlement
                await paymentService.topupWallet({
                    amount: totalDue,
                    currency: 'EUR',
                    method: 'CARD',
                    reference: `INSTANT-${Date.now().toString().slice(-6)}`,
                });
                await paymentService.payWithWallet({ dossierId: selectedDossier.id });
                showSuccess(`Payment of €${totalDue.toFixed(2)} processed successfully via Card!`);
                setShowPayModal(false);
                await loadData();
            } else if (invoicePayMethod === 'BANK_SLIP') {
                if (!slipFile) {
                    showError('Please select and upload your bank payment slip.');
                    setIsSubmitting(false);
                    return;
                }
                const fd = new FormData();
                fd.append('dossierId', selectedDossier.id);
                fd.append('amount', totalDue.toFixed(2));
                fd.append('currency', 'EUR');
                fd.append('bankName', slipBankName);
                fd.append('senderName', slipSenderName || user?.fullName || 'Client');
                fd.append('referenceCode', slipRefCode || `DOS-${selectedDossier.dossierNumber}`);
                fd.append('purpose', `Dossier Settlement: ${selectedDossier.dossierNumber}`);
                fd.append('slip', slipFile);

                await paymentService.submitBankSlip(fd);
                showSuccess('Bank wire slip submitted! Dossier will update to PAID upon banking verification.');
                setShowPayModal(false);
                setSlipFile(null);
                await loadData();
            }
        } catch (err: any) {
            console.error('Invoice pay err:', err);
            showError(err.response?.data?.message || err.message || 'Payment settlement failed.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDownloadSummary = async (dossierId: string) => {
        try {
            await dossierService.downloadSummary(dossierId);
        } catch (err) {
            showError('Unable to generate official summary PDF.');
        }
    };

    if (loading) {
        return (
            <div className="client-wallet-container fade-in" style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div className="wallet-pulse-loader"></div>
                <p style={{ color: '#64748B', fontWeight: 600 }}>Loading EuroTech Wallet &amp; Consular Billing...</p>
            </div>
        );
    }

    return (
        <div className="client-wallet-container fade-in">
            {/* Header */}
            <div className="wallet-page-header">
                <div>
                    <div className="wallet-badge-pill">
                        <span className="dot-green"></span>
                        <span>Multi-Currency Consular Account • EUR / AZN</span>
                    </div>
                    <h1 className="wallet-page-title">Wallet &amp; Billing Center</h1>
                    <p className="wallet-page-subtitle">
                        Manage your pre-funded EuroTech balance, inspect official consular proforma invoices, and settle visa processing fees.
                    </p>
                </div>
                <div className="wallet-header-actions">
                    <button className="btn-topup-primary" onClick={() => setShowTopUpModal(true)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        + Top Up Wallet
                    </button>
                </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="wallet-kpi-grid">
                {/* 1. Available Balance */}
                <div className="wallet-kpi-card balance-card">
                    <div className="kpi-header">
                        <span className="kpi-label">Available Wallet Balance</span>
                        <div className="kpi-icon-wrap blue">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                                <line x1="1" y1="10" x2="23" y2="10" />
                            </svg>
                        </div>
                    </div>
                    <div className="kpi-value-block">
                        <h2 className="kpi-main-val">€{balanceEur.toFixed(2)}</h2>
                        <span className="kpi-sub-val">≈ {balanceAzn.toFixed(2)} AZN</span>
                    </div>
                    <div className="kpi-badge-row">
                        <span className="badge-tag success">● Active for Instant Settlement</span>
                    </div>
                </div>

                {/* 2. Outstanding Invoices */}
                <div className="wallet-kpi-card invoice-kpi-card">
                    <div className="kpi-header">
                        <span className="kpi-label">Pending Consular Fees</span>
                        <div className="kpi-icon-wrap amber">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                        </div>
                    </div>
                    <div className="kpi-value-block">
                        <h2 className="kpi-main-val" style={{ color: unpaidTotalEur > 0 ? '#DC2626' : '#059669' }}>
                            €{unpaidTotalEur.toFixed(2)}
                        </h2>
                        <span className="kpi-sub-val">≈ {unpaidTotalAzn.toFixed(2)} AZN</span>
                    </div>
                    <div className="kpi-badge-row">
                        <span className={`badge-tag ${unpaidDossiers.length > 0 ? 'warning' : 'success'}`}>
                            {unpaidDossiers.length > 0 ? `${unpaidDossiers.length} Unpaid Dossier(s)` : 'All Clear / Settled'}
                        </span>
                    </div>
                </div>

                {/* 3. Total Deposited */}
                <div className="wallet-kpi-card">
                    <div className="kpi-header">
                        <span className="kpi-label">Total Funded (YTD)</span>
                        <div className="kpi-icon-wrap emerald">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                                <polyline points="17 6 23 6 23 12" />
                            </svg>
                        </div>
                    </div>
                    <div className="kpi-value-block">
                        <h2 className="kpi-main-val">€{(walletData?.totalDepositedEur || 0).toFixed(2)}</h2>
                        <span className="kpi-sub-val">Pre-funded deposits</span>
                    </div>
                    <div className="kpi-badge-row">
                        <span className="badge-tag info">Verified Transferred</span>
                    </div>
                </div>

                {/* 4. Total Settled */}
                <div className="wallet-kpi-card">
                    <div className="kpi-header">
                        <span className="kpi-label">Total Paid (YTD)</span>
                        <div className="kpi-icon-wrap indigo">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                            </svg>
                        </div>
                    </div>
                    <div className="kpi-value-block">
                        <h2 className="kpi-main-val">€{(walletData?.totalSpentEur || 0).toFixed(2)}</h2>
                        <span className="kpi-sub-val">Consular &amp; add-on fees</span>
                    </div>
                    <div className="kpi-badge-row">
                        <span className="badge-tag info">Schengen Vouchers</span>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="wallet-tabs-bar">
                <button 
                    className={`tab-btn ${activeTab === 'invoices' ? 'active' : ''}`}
                    onClick={() => setActiveTab('invoices')}
                >
                    Consular Invoices &amp; Dossiers ({dossiers.length})
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'transactions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('transactions')}
                >
                    Wallet Transactions Ledger ({walletData?.transactions?.length || 0})
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'slips' ? 'active' : ''}`}
                    onClick={() => setActiveTab('slips')}
                >
                    Bank Wire Slips ({bankSlips.length})
                </button>
            </div>

            {/* TAB 1: INVOICES & DOSSIER FEES */}
            {activeTab === 'invoices' && (
                <div className="wallet-tab-content">
                    {dossiers.length === 0 ? (
                        <div className="empty-state-box">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="2" y="4" width="20" height="16" rx="2" />
                                <path d="M7 15h0M2 9.5h20" />
                            </svg>
                            <h3>No Consular Invoices Found</h3>
                            <p>You have not initialized any visa applications yet. Start an application to view proforma invoices.</p>
                        </div>
                    ) : (
                        <div className="invoices-table-card">
                            <table className="wallet-table">
                                <thead>
                                    <tr>
                                        <th>Dossier Ref</th>
                                        <th>Destination &amp; Visa</th>
                                        <th>Travelers</th>
                                        <th>Total Amount</th>
                                        <th>Payment Status</th>
                                        <th>Date</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dossiers.map(d => {
                                        const isPaid = d.paymentStatus === 'PAID';
                                        const paxCount = d.applicants?.length || 1;
                                        const amountEur = Number(d.totalAmount || 0);
                                        const amountAzn = amountEur * 1.80;

                                        return (
                                            <tr key={d.id} className={!isPaid ? 'unpaid-row' : ''}>
                                                <td>
                                                    <strong className="code-font">{d.dossierNumber || d.id.substring(0, 8)}</strong>
                                                    <span className="sub-tag">{d.portalType}</span>
                                                </td>
                                                <td>
                                                    <strong>{d.country?.nameEn || 'Schengen Destination'}</strong>
                                                    <span className="sub-tag">{d.visaCategory?.nameEn || 'Visa'}</span>
                                                </td>
                                                <td>
                                                    <span className="pax-badge">{paxCount} Traveler{paxCount > 1 ? 's' : ''}</span>
                                                </td>
                                                <td>
                                                    <strong className="amount-eur">€{amountEur.toFixed(2)}</strong>
                                                    <span className="amount-azn">≈ {amountAzn.toFixed(2)} AZN</span>
                                                </td>
                                                <td>
                                                    <span className={`status-pill ${isPaid ? 'paid' : 'pending'}`}>
                                                        {isPaid ? '✓ PAID & SETTLED' : '● UNPAID / PENDING'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="date-str">
                                                        {d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-GB') : '—'}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    {isPaid ? (
                                                        <button 
                                                            className="btn-action-outline"
                                                            onClick={() => handleDownloadSummary(d.id)}
                                                            title="Download Official Proforma / Summary PDF"
                                                        >
                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                                <polyline points="7 10 12 15 17 10" />
                                                                <line x1="12" y1="15" x2="12" y2="3" />
                                                            </svg>
                                                            Invoice PDF
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            className="btn-action-pay"
                                                            onClick={() => handleOpenPayModal(d)}
                                                        >
                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                <polyline points="20 6 9 17 4 12" />
                                                            </svg>
                                                            Pay Fees
                                                        </button>
                                                    )}
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

            {/* TAB 2: TRANSACTIONS LEDGER */}
            {activeTab === 'transactions' && (
                <div className="wallet-tab-content">
                    {(!walletData?.transactions || walletData.transactions.length === 0) ? (
                        <div className="empty-state-box">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 14 14" />
                            </svg>
                            <h3>No Wallet Transactions Yet</h3>
                            <p>Transactions from top-ups, visa payments, and service refunds will appear here.</p>
                        </div>
                    ) : (
                        <div className="invoices-table-card">
                            <table className="wallet-table">
                                <thead>
                                    <tr>
                                        <th>Ref / ID</th>
                                        <th>Type</th>
                                        <th>Description</th>
                                        <th>Amount</th>
                                        <th>Status</th>
                                        <th>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {walletData.transactions.map((tx: any) => {
                                        const isCredit = tx.type === 'CREDIT' || Number(tx.amount) > 0;
                                        const amt = Math.abs(Number(tx.amount || 0));

                                        return (
                                            <tr key={tx.id}>
                                                <td>
                                                    <span className="code-font">{tx.referenceId || tx.id.substring(0, 8)}</span>
                                                </td>
                                                <td>
                                                    <span className={`type-badge ${isCredit ? 'credit' : 'debit'}`}>
                                                        {tx.referenceType || tx.type}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span style={{ color: '#0F1E36', fontWeight: 500 }}>{tx.description}</span>
                                                </td>
                                                <td>
                                                    <strong style={{ color: isCredit ? '#15803D' : '#DC2626' }}>
                                                        {isCredit ? '+' : '-'}€{amt.toFixed(2)}
                                                    </strong>
                                                </td>
                                                <td>
                                                    <span className={`status-pill ${tx.status === 'PAID' ? 'paid' : 'pending'}`}>
                                                        {tx.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="date-str">
                                                        {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('en-GB') : '—'}
                                                    </span>
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

            {/* TAB 3: BANK WIRE SLIPS */}
            {activeTab === 'slips' && (
                <div className="wallet-tab-content">
                    {bankSlips.length === 0 ? (
                        <div className="empty-state-box">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                            </svg>
                            <h3>No Bank Slips Uploaded</h3>
                            <p>Upload bank deposit transfer receipts when funding your wallet or settling invoices via wire.</p>
                        </div>
                    ) : (
                        <div className="invoices-table-card">
                            <table className="wallet-table">
                                <thead>
                                    <tr>
                                        <th>Receipt Ref</th>
                                        <th>Bank Name</th>
                                        <th>Amount</th>
                                        <th>Purpose</th>
                                        <th>Review Status</th>
                                        <th>Upload Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bankSlips.map((slip: any) => (
                                        <tr key={slip.id}>
                                            <td>
                                                <strong className="code-font">{slip.referenceCode || slip.receiptNumber || slip.id.substring(0, 8)}</strong>
                                            </td>
                                            <td>
                                                <span>{slip.bankName || 'International Wire'}</span>
                                            </td>
                                            <td>
                                                <strong className="amount-eur">€{Number(slip.amount || 0).toFixed(2)}</strong>
                                            </td>
                                            <td>
                                                <span style={{ fontSize: '0.85rem', color: '#475569' }}>{slip.purpose || 'Consular Payment'}</span>
                                            </td>
                                            <td>
                                                <span className={`status-pill ${
                                                    slip.status === 'VERIFIED' ? 'paid' : slip.status === 'REJECTED' ? 'danger' : 'pending'
                                                }`}>
                                                    {slip.status === 'VERIFIED' ? '✓ VERIFIED' : slip.status === 'REJECTED' ? '✕ REJECTED' : '● UNDER REVIEW'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="date-str">
                                                    {slip.createdAt ? new Date(slip.createdAt).toLocaleDateString('en-GB') : '—'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* MODAL 1: TOP UP WALLET */}
            {showTopUpModal && (
                <div className="wallet-modal-overlay">
                    <div className="wallet-modal-card">
                        <div className="modal-header">
                            <div>
                                <h3 className="modal-title">Top Up EuroTech Wallet</h3>
                                <p className="modal-subtitle">Add funds for instant consular fee settlements and add-on services.</p>
                            </div>
                            <button className="modal-close-btn" onClick={() => setShowTopUpModal(false)}>✕</button>
                        </div>

                        <form onSubmit={handleTopUpSubmit}>
                            <div className="modal-body">
                                {/* Method Selector */}
                                <div className="payment-method-switch">
                                    <button 
                                        type="button" 
                                        className={`switch-btn ${topupMethod === 'CARD' ? 'active' : ''}`}
                                        onClick={() => setTopupMethod('CARD')}
                                    >
                                        💳 Instant Card (3DS)
                                    </button>
                                    <button 
                                        type="button" 
                                        className={`switch-btn ${topupMethod === 'BANK_SLIP' ? 'active' : ''}`}
                                        onClick={() => setTopupMethod('BANK_SLIP')}
                                    >
                                        🏛️ Bank Wire Transfer
                                    </button>
                                </div>

                                {/* Amount */}
                                <div className="form-group" style={{ marginTop: 16 }}>
                                    <label>Top-Up Amount (EUR) *</label>
                                    <div className="currency-input-wrap">
                                        <span className="cur-symbol">€</span>
                                        <input 
                                            type="number" 
                                            step="0.01" 
                                            min="10" 
                                            value={topupAmount} 
                                            onChange={(e) => setTopupAmount(e.target.value)} 
                                            required 
                                        />
                                    </div>
                                    <div className="amount-pills">
                                        {['80', '150', '250', '500'].map(val => (
                                            <button 
                                                key={val} 
                                                type="button" 
                                                className="amt-pill"
                                                onClick={() => setTopupAmount(val)}
                                            >
                                                €{val}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {topupMethod === 'CARD' ? (
                                    <div className="card-fields-grid">
                                        <div className="form-group">
                                            <label>Card Number</label>
                                            <input 
                                                type="text" 
                                                placeholder="4169 •••• •••• 4242" 
                                                value={topupCardNumber}
                                                onChange={(e) => setTopupCardNumber(e.target.value)}
                                            />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <div className="form-group">
                                                <label>Expiry (MM/YY)</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="12/28" 
                                                    value={topupCardExpiry}
                                                    onChange={(e) => setTopupCardExpiry(e.target.value)}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>CVC</label>
                                                <input 
                                                    type="password" 
                                                    placeholder="•••" 
                                                    maxLength={4}
                                                    value={topupCardCvc}
                                                    onChange={(e) => setTopupCardCvc(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="wire-instructions-block">
                                        <div className="wire-bank-details">
                                            <strong>EuroTech Consular Services LLC</strong>
                                            <span>IBAN: <code className="code-font">AZ88ABBB33010000000099887766</code></span>
                                            <span>Bank: International Bank of Azerbaijan (ABB)</span>
                                            <span>Swift: <code className="code-font">IBAZAZ2X</code></span>
                                        </div>

                                        <div className="form-group" style={{ marginTop: 12 }}>
                                            <label>Sending Bank Name *</label>
                                            <input 
                                                type="text" 
                                                value={slipBankName} 
                                                onChange={(e) => setSlipBankName(e.target.value)} 
                                                required 
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label>Sender Full Name *</label>
                                            <input 
                                                type="text" 
                                                value={slipSenderName} 
                                                onChange={(e) => setSlipSenderName(e.target.value)} 
                                                required 
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label>Upload Payment Receipt (PDF, PNG, JPG) *</label>
                                            <input 
                                                type="file" 
                                                accept=".pdf,.png,.jpg,.jpeg" 
                                                onChange={(e) => setSlipFile(e.target.files?.[0] || null)} 
                                                required 
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setShowTopUpModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                                    {isSubmitting ? 'Processing...' : topupMethod === 'CARD' ? `Pay €${topupAmount}` : 'Submit Slip for Review'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: PAY SINGLE DOSSIER */}
            {showPayModal && selectedDossier && (
                <div className="wallet-modal-overlay">
                    <div className="wallet-modal-card">
                        <div className="modal-header">
                            <div>
                                <h3 className="modal-title">Settle Consular Dossier Fees</h3>
                                <p className="modal-subtitle">
                                    Ref: <strong>{selectedDossier.dossierNumber}</strong> • Total Due: <strong style={{ color: '#2563EB' }}>€{Number(selectedDossier.totalAmount || 0).toFixed(2)}</strong>
                                </p>
                            </div>
                            <button className="modal-close-btn" onClick={() => setShowPayModal(false)}>✕</button>
                        </div>

                        <div className="modal-body">
                            {/* Method Selection */}
                            <div className="payment-options-list">
                                {/* Option 1: Wallet */}
                                <div 
                                    className={`payment-option-row ${invoicePayMethod === 'WALLET' ? 'selected' : ''}`}
                                    onClick={() => setInvoicePayMethod('WALLET')}
                                >
                                    <input 
                                        type="radio" 
                                        name="payMethodRadio" 
                                        checked={invoicePayMethod === 'WALLET'} 
                                        onChange={() => setInvoicePayMethod('WALLET')} 
                                    />
                                    <div className="option-info">
                                        <strong>EuroTech Wallet Balance</strong>
                                        <span>Available: €{balanceEur.toFixed(2)}</span>
                                        {balanceEur < Number(selectedDossier.totalAmount || 0) && (
                                            <span style={{ color: '#DC2626', fontSize: '0.78rem', display: 'block', marginTop: 2 }}>
                                                ⚠️ Insufficient balance. Top up or select Card / Wire.
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Option 2: Card */}
                                <div 
                                    className={`payment-option-row ${invoicePayMethod === 'CARD' ? 'selected' : ''}`}
                                    onClick={() => setInvoicePayMethod('CARD')}
                                >
                                    <input 
                                        type="radio" 
                                        name="payMethodRadio" 
                                        checked={invoicePayMethod === 'CARD'} 
                                        onChange={() => setInvoicePayMethod('CARD')} 
                                    />
                                    <div className="option-info">
                                        <strong>Direct Credit / Debit Card</strong>
                                        <span>Instant 3D-Secure payment gateway</span>
                                    </div>
                                </div>

                                {/* Option 3: Bank Slip */}
                                <div 
                                    className={`payment-option-row ${invoicePayMethod === 'BANK_SLIP' ? 'selected' : ''}`}
                                    onClick={() => setInvoicePayMethod('BANK_SLIP')}
                                >
                                    <input 
                                        type="radio" 
                                        name="payMethodRadio" 
                                        checked={invoicePayMethod === 'BANK_SLIP'} 
                                        onChange={() => setInvoicePayMethod('BANK_SLIP')} 
                                    />
                                    <div className="option-info">
                                        <strong>Bank Wire Deposit Slip</strong>
                                        <span>Upload stamped bank transfer receipt</span>
                                    </div>
                                </div>
                            </div>

                            {invoicePayMethod === 'BANK_SLIP' && (
                                <div className="bank-slip-upload-subform" style={{ marginTop: 14 }}>
                                    <div className="form-group">
                                        <label>Bank Name *</label>
                                        <input 
                                            type="text" 
                                            value={slipBankName} 
                                            onChange={(e) => setSlipBankName(e.target.value)} 
                                            required 
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Upload Receipt *</label>
                                        <input 
                                            type="file" 
                                            accept=".pdf,.png,.jpg,.jpeg" 
                                            onChange={(e) => setSlipFile(e.target.files?.[0] || null)} 
                                            required 
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="modal-footer">
                            <button type="button" className="btn-secondary" onClick={() => setShowPayModal(false)}>
                                Close
                            </button>
                            <button 
                                type="button" 
                                className="btn-primary" 
                                onClick={handleExecuteDossierPayment}
                                disabled={isSubmitting || (invoicePayMethod === 'WALLET' && balanceEur < Number(selectedDossier.totalAmount || 0))}
                            >
                                {isSubmitting ? 'Settling...' : `Confirm & Settle €${Number(selectedDossier.totalAmount || 0).toFixed(2)}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

