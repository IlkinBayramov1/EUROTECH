import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/shared/context/AuthContext';
import { paymentService, dossierService } from '@/shared/api/services';
import { useToast } from '@/shared/context/ToastContext';
import { downloadFileFromApi } from '@/shared/utils/download.util';
import { getFileUrl } from '@/shared/utils/file.util';
import { storage } from '@/shared/utils/storage';
import './ClientWallet.css';

interface DossierItem {
    id: string;
    dossierNumber: string;
    portalType: string;
    status: string;
    paymentStatus: string;
    totalAmount: number;
    paidAmountEur?: number;
    dueAmountEur?: number;
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
    const [payoutRequests, setPayoutRequests] = useState<any[]>([]);
    const [exchangeRate, setExchangeRate] = useState<number>(1.80);
    const [activeTab, setActiveTab] = useState<'invoices' | 'transactions' | 'slips' | 'payouts'>('invoices');

    // Modals
    const [showTopUpModal, setShowTopUpModal] = useState(false);
    const [showPayModal, setShowPayModal] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [showBankDetailsModal, setShowBankDetailsModal] = useState(false);
    const [selectedDossier, setSelectedDossier] = useState<DossierItem | null>(null);
    const [openingSlipId, setOpeningSlipId] = useState<string | null>(null);
    const [downloadingDossierId, setDownloadingDossierId] = useState<string | null>(null);

    // Top up form
    const [topupMethod, setTopupMethod] = useState<'CARD' | 'BANK_SLIP'>('CARD');
    const [topupCurrency, setTopupCurrency] = useState<'EUR' | 'AZN'>('EUR');
    const [topupAmount, setTopupAmount] = useState('150.00');
    const [topupCardNumber, setTopupCardNumber] = useState('');
    const [topupCardExpiry, setTopupCardExpiry] = useState('');
    const [topupCardCvc, setTopupCardCvc] = useState('');
    const [slipBankName, setSlipBankName] = useState('International Bank of Azerbaijan (ABB)');
    const [slipSenderName, setSlipSenderName] = useState(user?.fullName || '');
    const [slipRefCode, setSlipRefCode] = useState('');
    const [slipFile, setSlipFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Withdraw & Bank Details form
    const [withdrawCurrency, setWithdrawCurrency] = useState<'EUR' | 'AZN'>('EUR');
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [bankName, setBankName] = useState('');
    const [iban, setIban] = useState('');
    const [swiftBic, setSwiftBic] = useState('');
    const [accountHolder, setAccountHolder] = useState(user?.fullName || '');

    // Pay invoice form
    const [invoicePayMethod, setInvoicePayMethod] = useState<'WALLET' | 'CARD' | 'BANK_SLIP'>('WALLET');

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [walletRes, dossiersRes] = await Promise.all([
                paymentService.getUserWallet().catch(() => ({ data: null })),
                dossierService.getMyDossiers().catch(() => ({ data: { dossiers: [] } }))
            ]);

            const raw = walletRes?.data?.data || walletRes?.data || walletRes || {};
            const w = raw?.wallet || raw || {};
            const rate = Number(raw?.exchangeRate || 1.80);
            setExchangeRate(rate);

            const txs = w?.transactions || raw?.transactions || [];
            const slips = raw?.bankSlips || raw?.pendingBankSlips || [];
            const payouts = w?.payoutRequests || raw?.payoutRequests || [];
            const invoiceMap = new Map<string, any>();
            if (Array.isArray(raw?.dossierInvoices)) {
                raw.dossierInvoices.forEach((inv: any) => {
                    if (inv?.id) invoiceMap.set(inv.id, inv);
                });
            }

            const rawBalanceEur = Number(w?.balance ?? w?.balanceEur ?? raw?.balance ?? raw?.balanceEur ?? 0);
            const rawBalanceAzn = Number(w?.balanceAzn ?? raw?.balanceAzn ?? (rawBalanceEur * rate));
            const rawDepositedEur = Number(
                w?.totalTopups ?? w?.totalDepositedEur ?? raw?.totalTopups ?? raw?.totalDepositedEur ?? 0
            );
            const rawSpentEur = Number(
                w?.totalSpent ?? w?.totalSpentEur ?? raw?.totalSpent ?? raw?.totalSpentEur ?? 0
            );

            setWalletData({
                ...w,
                transactions: txs,
                balanceEur: rawBalanceEur,
                balanceAzn: rawBalanceAzn,
                totalDepositedEur: rawDepositedEur,
                totalSpentEur: rawSpentEur,
            });
            setBankSlips(slips);
            setPayoutRequests(payouts);

            if (w?.bankName) setBankName(w.bankName);
            if (w?.iban) setIban(w.iban);
            if (w?.swiftBic) setSwiftBic(w.swiftBic);
            if (w?.accountHolder) setAccountHolder(w.accountHolder);
            else if (user?.fullName && !accountHolder) setAccountHolder(user.fullName);

            const rawDossiers: DossierItem[] = dossiersRes?.data?.data?.dossiers || dossiersRes?.data?.dossiers || [];
            const enrichedDossiers = rawDossiers.map((d) => {
                const inv = invoiceMap.get(d.id);
                const total = Number(d.totalAmount || 0);
                const paid = inv ? Number(inv.paidAmountEur || 0) : (d.paymentStatus === 'PAID' ? total : 0);
                const due = inv ? Number(inv.dueAmountEur ?? Math.max(0, total - paid)) : (d.paymentStatus === 'PAID' ? 0 : total);
                return {
                    ...d,
                    paidAmountEur: paid,
                    dueAmountEur: due,
                };
            });
            setDossiers(enrichedDossiers);
        } catch (err: any) {
            console.error('Wallet load err:', err);
            showError('Could not load financial data.');
        } finally {
            setLoading(false);
        }
    }, [showError, user?.fullName]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const balanceEur = Number(walletData?.balanceEur || 0);
    const balanceAzn = Number(walletData?.balanceAzn || (balanceEur * exchangeRate));

    // Calculate unpaid fees using remaining dueAmountEur
    const unpaidDossiers = dossiers.filter(d => d.paymentStatus !== 'PAID' && Number(d.dueAmountEur ?? d.totalAmount ?? 0) > 0.01);
    const unpaidTotalEur = unpaidDossiers.reduce((sum, d) => sum + Number(d.dueAmountEur ?? d.totalAmount ?? 0), 0);
    const unpaidTotalAzn = unpaidTotalEur * exchangeRate;

    const getDossierDueEur = (d: DossierItem | null): number => {
        if (!d) return 0;
        if (d.paymentStatus === 'PAID') return 0;
        const due = Number(d.dueAmountEur ?? d.totalAmount ?? 0);
        return due > 0 ? Number(due.toFixed(2)) : Number(d.totalAmount || 0);
    };

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
                    currency: topupCurrency,
                    method: 'CARD',
                    reference: `CARD-${Date.now().toString().slice(-6)}`,
                });
                const creditedEur = topupCurrency === 'AZN' ? amt / exchangeRate : amt;
                showSuccess(
                    topupCurrency === 'AZN'
                        ? `${amt.toFixed(2)} AZN (€${creditedEur.toFixed(2)}) added directly to your EuroTech Wallet!`
                        : `€${amt.toFixed(2)} added directly to your EuroTech Wallet!`
                );
                setShowTopUpModal(false);
                await loadData();
            } else {
                const fd = new FormData();
                fd.append('amount', amt.toFixed(2));
                fd.append('currency', topupCurrency);
                fd.append('bankName', slipBankName || 'International Bank of Azerbaijan (ABB)');
                fd.append('senderName', slipSenderName || user?.fullName || 'Client');
                fd.append('referenceCode', slipRefCode.trim() || `WIRE-${Date.now().toString().slice(-6)}`);
                fd.append('purpose', 'WALLET_TOPUP');
                if (slipFile) {
                    fd.append('slip', slipFile);
                }

                await paymentService.submitBankSlip(fd);
                showSuccess('Bank transfer slip submitted! Wallet balance will update upon consular banking review.');
                setShowTopUpModal(false);
                setSlipFile(null);
                setSlipRefCode('');
                await loadData();
            }
        } catch (err: any) {
            console.error('Topup err:', err);
            showError(err.response?.data?.message || err.message || 'Top-up failed.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle Withdraw / Payout Request Submit
    const handleWithdrawSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(withdrawAmount);
        if (isNaN(amt) || amt <= 0) {
            showError('Please enter a valid withdrawal amount.');
            return;
        }
        const requestedEur = withdrawCurrency === 'AZN' ? amt / exchangeRate : amt;
        if (requestedEur > balanceEur + 0.005) {
            showError(`Insufficient wallet balance. Available: €${balanceEur.toFixed(2)} (${balanceAzn.toFixed(2)} AZN).`);
            return;
        }
        if (!bankName.trim() || !iban.trim()) {
            showError('Please provide both Bank Name and IBAN to receive your payout.');
            return;
        }

        setIsSubmitting(true);
        try {
            await paymentService.withdrawFromWallet({
                amount: amt,
                currency: withdrawCurrency,
                bankName: bankName.trim(),
                iban: iban.trim(),
                swiftBic: swiftBic.trim(),
                accountHolder: accountHolder.trim() || user?.fullName || 'Account Holder',
            });
            showSuccess(`Withdrawal request for €${requestedEur.toFixed(2)} submitted! Funds are reserved pending banking execution.`);
            setShowWithdrawModal(false);
            setWithdrawAmount('');
            setActiveTab('payouts');
            await loadData();
        } catch (err: any) {
            console.error('Withdraw err:', err);
            showError(err.response?.data?.message || err.message || 'Failed to submit withdrawal request.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle Save Bank Details
    const handleSaveBankDetails = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bankName.trim() || !iban.trim()) {
            showError('Bank Name and IBAN are required.');
            return;
        }
        setIsSubmitting(true);
        try {
            await paymentService.saveWalletBankDetails({
                bankName: bankName.trim(),
                iban: iban.trim(),
                swiftBic: swiftBic.trim(),
                accountHolder: accountHolder.trim() || user?.fullName || 'Account Holder',
            });
            showSuccess('Payout bank coordinates saved to your EuroTech Wallet.');
            setShowBankDetailsModal(false);
            await loadData();
        } catch (err: any) {
            console.error('Save bank details err:', err);
            showError(err.response?.data?.message || err.message || 'Failed to save bank details.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle Pay Single Dossier
    const handleOpenPayModal = (dossier: DossierItem) => {
        setSelectedDossier(dossier);
        const due = getDossierDueEur(dossier);
        setInvoicePayMethod(balanceEur >= due ? 'WALLET' : 'CARD');
        setShowPayModal(true);
    };

    const handleExecuteDossierPayment = async () => {
        if (!selectedDossier) return;
        const totalDue = getDossierDueEur(selectedDossier);

        setIsSubmitting(true);
        try {
            if (invoicePayMethod === 'WALLET') {
                if (balanceEur + 0.005 < totalDue) {
                    showError(`Insufficient wallet balance (€${balanceEur.toFixed(2)} < €${totalDue.toFixed(2)}). Please top up first.`);
                    setIsSubmitting(false);
                    return;
                }
                await paymentService.payWithWallet({ dossierId: selectedDossier.id });
                showSuccess(`€${totalDue.toFixed(2)} successfully settled from your EuroTech Wallet!`);
                setShowPayModal(false);
                await loadData();
            } else if (invoicePayMethod === 'CARD') {
                const intent = await paymentService.createPaymentIntent({
                    dossierId: selectedDossier.id,
                    amount: totalDue,
                    currency: 'EUR',
                    purpose: 'DOSSIER_PAYMENT',
                });
                const intentId = intent?.paymentIntentId || (intent as any)?.paymentId || (intent as any)?.id;
                if (intentId) {
                    await paymentService.confirmPaymentMock({
                        paymentIntentId: intentId,
                        bankReference: `CARD-${Date.now().toString().slice(-6)}`,
                    });
                } else {
                    await paymentService.topupWallet({
                        amount: totalDue,
                        currency: 'EUR',
                        method: 'CARD',
                        reference: `INSTANT-${Date.now().toString().slice(-6)}`,
                    });
                    await paymentService.payWithWallet({ dossierId: selectedDossier.id });
                }
                showSuccess(`Payment of €${totalDue.toFixed(2)} processed successfully via Card!`);
                setShowPayModal(false);
                await loadData();
            } else if (invoicePayMethod === 'BANK_SLIP') {
                const fd = new FormData();
                fd.append('dossierId', selectedDossier.id);
                fd.append('amount', totalDue.toFixed(2));
                fd.append('currency', 'EUR');
                fd.append('bankName', slipBankName || 'International Bank of Azerbaijan (ABB)');
                fd.append('senderName', slipSenderName || user?.fullName || 'Client');
                fd.append('referenceCode', slipRefCode.trim() || `DOS-${selectedDossier.dossierNumber}`);
                fd.append('purpose', `Dossier Settlement: ${selectedDossier.dossierNumber}`);
                if (slipFile) {
                    fd.append('slip', slipFile);
                }

                await paymentService.submitBankSlip(fd);
                showSuccess('Bank wire slip submitted! Dossier will update to PAID upon banking verification.');
                setShowPayModal(false);
                setSlipFile(null);
                setSlipRefCode('');
                await loadData();
            }
        } catch (err: any) {
            console.error('Invoice pay err:', err);
            showError(err.response?.data?.message || err.message || 'Payment settlement failed.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDownloadSummary = async (dossier: DossierItem) => {
        setDownloadingDossierId(dossier.id);
        try {
            const safeRef = (dossier.dossierNumber || dossier.id.substring(0, 8)).replace(/[^a-zA-Z0-9_-]/g, '_');
            await downloadFileFromApi(`/api/v1/dossiers/${dossier.id}/summary-pdf`, `Consular_Invoice_${safeRef}.pdf`);
            showSuccess(`Invoice PDF downloaded for ${dossier.dossierNumber || 'Dossier'}.`);
        } catch (err: any) {
            console.error('Download summary err:', err);
            showError(err.message || 'Unable to generate official summary PDF.');
        } finally {
            setDownloadingDossierId(null);
        }
    };

    const handleOpenSlipReceipt = async (slip: any) => {
        if (!slip?.id) return;
        setOpeningSlipId(slip.id);
        try {
            const token = storage.getToken();
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const endpointUrl = getFileUrl(`/api/v1/payments/bank-slip/${slip.id}/file?inline=true`);
            let res = await fetch(endpointUrl, { method: 'GET', headers });

            if (!res.ok && slip.fileUrl) {
                const fallbackUrl = getFileUrl(slip.fileUrl);
                if (fallbackUrl) {
                    res = await fetch(fallbackUrl, { method: 'GET', headers });
                }
            }

            if (!res.ok) {
                throw new Error(`Could not load bank receipt file (Status ${res.status})`);
            }

            const blob = await res.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const win = window.open(blobUrl, '_blank');
            if (!win) {
                const a = document.createElement('a');
                a.href = blobUrl;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        } catch (err: any) {
            console.error('Open slip receipt err:', err);
            showError(err.message || 'Failed to open bank receipt file.');
        } finally {
            setOpeningSlipId(null);
        }
    };

    const handleExportStatementCsv = () => {
        try {
            const rows: string[][] = [
                ['Category', 'Reference', 'Type / Purpose', 'Description / Bank', 'Amount (EUR)', 'Status', 'Date'],
            ];

            (walletData?.transactions || []).forEach((tx: any) => {
                const isCredit = tx.type === 'CREDIT' || Number(tx.amount) > 0;
                const amt = Math.abs(Number(tx.amount || 0));
                rows.push([
                    'WALLET_TX',
                    tx.referenceId || tx.id || '',
                    tx.referenceType || tx.type || '',
                    (tx.description || '').replace(/"/g, '""'),
                    `${isCredit ? '+' : '-'}${amt.toFixed(2)}`,
                    tx.status || 'PAID',
                    tx.createdAt ? new Date(tx.createdAt).toISOString() : '',
                ]);
            });

            bankSlips.forEach((s: any) => {
                rows.push([
                    'BANK_SLIP',
                    s.referenceCode || s.id || '',
                    s.purpose || 'WIRE_TRANSFER',
                    (s.bankName || 'Bank Wire').replace(/"/g, '""'),
                    Number(s.amount || 0).toFixed(2),
                    s.displayStatus || s.status || 'PENDING',
                    s.createdAt ? new Date(s.createdAt).toISOString() : '',
                ]);
            });

            payoutRequests.forEach((p: any) => {
                rows.push([
                    'PAYOUT_REQUEST',
                    p.id || '',
                    'WITHDRAWAL',
                    `${p.bankName || ''} (${p.iban || ''})`.replace(/"/g, '""'),
                    `-${Number(p.amount || 0).toFixed(2)}`,
                    p.status || 'PENDING',
                    p.createdAt ? new Date(p.createdAt).toISOString() : '',
                ]);
            });

            const csvContent = rows.map(r => r.map(field => `"${String(field ?? '')}"`).join(',')).join('\n');
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `EuroTech_Wallet_Statement_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1500);
            showSuccess('Wallet statement exported to CSV.');
        } catch (err) {
            showError('Could not export CSV statement.');
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

    const topupNumeric = parseFloat(topupAmount) || 0;
    const topupConvertedPreview = topupCurrency === 'EUR'
        ? `≈ ${(topupNumeric * exchangeRate).toFixed(2)} AZN`
        : `≈ €${(topupNumeric / exchangeRate).toFixed(2)} EUR (Credited to Wallet)`;

    const withdrawNumeric = parseFloat(withdrawAmount) || 0;
    const withdrawConvertedPreview = withdrawCurrency === 'EUR'
        ? `≈ ${(withdrawNumeric * exchangeRate).toFixed(2)} AZN`
        : `≈ €${(withdrawNumeric / exchangeRate).toFixed(2)} EUR (Deducted from Wallet)`;

    const selectedDossierDue = getDossierDueEur(selectedDossier);

    return (
        <div className="client-wallet-container fade-in">
            {/* Header */}
            <div className="wallet-page-header">
                <div>
                    <div className="wallet-badge-pill">
                        <span className="dot-green"></span>
                        <span>Multi-Currency Consular Account • EUR / AZN (1 EUR = {exchangeRate.toFixed(2)} AZN)</span>
                    </div>
                    <h1 className="wallet-page-title">Wallet &amp; Billing Center</h1>
                    <p className="wallet-page-subtitle">
                        Manage your pre-funded EuroTech balance, withdraw unused funds, inspect official consular proforma invoices, and settle visa processing fees.
                    </p>
                </div>
                <div className="wallet-header-actions">
                    <button className="btn-wallet-secondary" onClick={handleExportStatementCsv} title="Download CSV Ledger Statement">
                        📥 Export CSV
                    </button>
                    <button className="btn-wallet-secondary" onClick={() => setShowBankDetailsModal(true)} title="Configure IBAN & Bank Account for Withdrawals">
                        🏦 Payout IBAN
                    </button>
                    <button className="btn-wallet-withdraw" onClick={() => setShowWithdrawModal(true)}>
                        💸 Withdraw Funds
                    </button>
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
                        <span className="badge-tag success">● Active for Instant Settlement &amp; Withdrawal</span>
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
                        <span className="kpi-sub-val">≈ {((walletData?.totalDepositedEur || 0) * exchangeRate).toFixed(2)} AZN funded</span>
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
                        <span className="kpi-sub-val">≈ {((walletData?.totalSpentEur || 0) * exchangeRate).toFixed(2)} AZN settled</span>
                    </div>
                    <div className="kpi-badge-row">
                        <span className="badge-tag info">Schengen Vouchers &amp; Services</span>
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
                <button 
                    className={`tab-btn ${activeTab === 'payouts' ? 'active' : ''}`}
                    onClick={() => setActiveTab('payouts')}
                >
                    Withdrawals &amp; Payouts ({payoutRequests.length})
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
                                        <th>Total / Remaining</th>
                                        <th>Payment Status</th>
                                        <th>Date</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dossiers.map(d => {
                                        const isPaid = d.paymentStatus === 'PAID' || getDossierDueEur(d) <= 0.01;
                                        const paxCount = d.applicants?.length || 1;
                                        const amountEur = Number(d.totalAmount || 0);
                                        const dueEur = getDossierDueEur(d);
                                        const paidEur = Number(d.paidAmountEur || 0);
                                        const amountAzn = amountEur * exchangeRate;

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
                                                    {!isPaid && paidEur > 0 && (
                                                        <span className="sub-tag" style={{ color: '#D97706', fontWeight: 600 }}>
                                                            Paid: €{paidEur.toFixed(2)} • Due: €{dueEur.toFixed(2)}
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className={`status-pill ${isPaid ? 'paid' : 'pending'}`}>
                                                        {isPaid ? '✓ PAID & SETTLED' : dueEur < amountEur ? `● PARTIAL (€${dueEur.toFixed(2)} DUE)` : '● UNPAID / PENDING'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="date-str">
                                                        {d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-GB') : '—'}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
                                                        {!isPaid && (
                                                            <button 
                                                                className="btn-action-pay"
                                                                onClick={() => handleOpenPayModal(d)}
                                                            >
                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                    <polyline points="20 6 9 17 4 12" />
                                                                </svg>
                                                                Pay €{dueEur.toFixed(2)}
                                                            </button>
                                                        )}
                                                        <button 
                                                            className="btn-action-outline"
                                                            onClick={() => handleDownloadSummary(d)}
                                                            disabled={downloadingDossierId === d.id}
                                                            title="Download Official Proforma / Summary PDF"
                                                        >
                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                                <polyline points="7 10 12 15 17 10" />
                                                                <line x1="12" y1="15" x2="12" y2="3" />
                                                            </svg>
                                                            {downloadingDossierId === d.id ? 'PDF...' : 'Invoice PDF'}
                                                        </button>
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
                            <p>Transactions from top-ups, visa payments, withdrawals, and service refunds will appear here.</p>
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
                                        const isCredit = tx.type === 'CREDIT' || (tx.type !== 'DEBIT' && Number(tx.amount) > 0);
                                        const amt = Math.abs(Number(tx.amount || 0));
                                        const st = (tx.status || 'PAID').toUpperCase();
                                        const pillClass = st === 'PAID' || st === 'PROCESSED' ? 'paid' : st === 'REJECTED' || st === 'REFUNDED' ? 'danger' : 'pending';

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
                                                    <span className="amount-azn">≈ {(amt * exchangeRate).toFixed(2)} AZN</span>
                                                </td>
                                                <td>
                                                    <span className={`status-pill ${pillClass}`}>
                                                        {st}
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
                                        <th style={{ textAlign: 'right' }}>Receipt</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bankSlips.map((slip: any) => {
                                        const rawStatus = (slip.displayStatus || slip.status || 'PENDING').toUpperCase();
                                        const isApproved = rawStatus === 'VERIFIED' || rawStatus === 'PAID' || rawStatus === 'APPROVED';
                                        const isRejected = rawStatus === 'REJECTED' || rawStatus === 'REFUNDED';

                                        return (
                                            <tr key={slip.id}>
                                                <td>
                                                    <strong className="code-font">{slip.referenceCode || slip.receiptNumber || slip.id.substring(0, 8)}</strong>
                                                </td>
                                                <td>
                                                    <span>{slip.bankName || 'International Wire'}</span>
                                                </td>
                                                <td>
                                                    <strong className="amount-eur">€{Number(slip.amount || 0).toFixed(2)}</strong>
                                                    <span className="amount-azn">≈ {(Number(slip.amount || 0) * exchangeRate).toFixed(2)} AZN</span>
                                                </td>
                                                <td>
                                                    <span style={{ fontSize: '0.85rem', color: '#475569' }}>{slip.purpose || 'Consular Payment'}</span>
                                                </td>
                                                <td>
                                                    <span className={`status-pill ${
                                                        isApproved ? 'paid' : isRejected ? 'danger' : 'pending'
                                                    }`}>
                                                        {isApproved ? '✓ APPROVED' : isRejected ? '✕ REJECTED' : '● UNDER REVIEW'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="date-str">
                                                        {slip.createdAt ? new Date(slip.createdAt).toLocaleDateString('en-GB') : '—'}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button
                                                        type="button"
                                                        className="btn-action-outline"
                                                        onClick={() => handleOpenSlipReceipt(slip)}
                                                        disabled={openingSlipId === slip.id}
                                                    >
                                                        {openingSlipId === slip.id ? 'Opening...' : 'View Receipt ↗'}
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

            {/* TAB 4: WITHDRAWALS & PAYOUTS */}
            {activeTab === 'payouts' && (
                <div className="wallet-tab-content">
                    <div className="payout-bank-banner">
                        <div>
                            <strong>Saved Payout Bank Coordinates:</strong>{' '}
                            {iban ? (
                                <span>
                                    {bankName || 'Bank'} • IBAN: <code className="code-font">{iban}</code>
                                    {swiftBic ? ` • SWIFT: ${swiftBic}` : ''}
                                    {accountHolder ? ` • Holder: ${accountHolder}` : ''}
                                </span>
                            ) : (
                                <span style={{ color: '#64748B' }}>No default IBAN configured yet. Set your IBAN to withdraw funds.</span>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button type="button" className="btn-action-outline" onClick={() => setShowBankDetailsModal(true)}>
                                🏦 {iban ? 'Update IBAN' : 'Add IBAN'}
                            </button>
                            <button type="button" className="btn-action-pay" onClick={() => setShowWithdrawModal(true)}>
                                💸 Request Withdrawal
                            </button>
                        </div>
                    </div>

                    {payoutRequests.length === 0 ? (
                        <div className="empty-state-box">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="2" y="5" width="20" height="14" rx="2" />
                                <line x1="2" y1="10" x2="22" y2="10" />
                            </svg>
                            <h3>No Withdrawal Requests Yet</h3>
                            <p>You can withdraw any unused EuroTech Wallet balance directly to your bank account via IBAN.</p>
                        </div>
                    ) : (
                        <div className="invoices-table-card">
                            <table className="wallet-table">
                                <thead>
                                    <tr>
                                        <th>Payout Ref</th>
                                        <th>Destination Bank</th>
                                        <th>IBAN &amp; SWIFT</th>
                                        <th>Amount</th>
                                        <th>Status</th>
                                        <th>Requested Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payoutRequests.map((p: any) => {
                                        const st = (p.status || 'PENDING').toUpperCase();
                                        const isProcessed = st === 'PROCESSED';
                                        const isRejected = st === 'REJECTED';
                                        const amtEur = Number(p.amount || 0);

                                        return (
                                            <tr key={p.id}>
                                                <td>
                                                    <strong className="code-font">PO-{p.id.substring(0, 8).toUpperCase()}</strong>
                                                </td>
                                                <td>
                                                    <strong>{p.bankName || 'Bank Transfer'}</strong>
                                                    <span className="sub-tag">{accountHolder || user?.fullName || 'Account Holder'}</span>
                                                </td>
                                                <td>
                                                    <span className="code-font">{p.iban || '—'}</span>
                                                    {p.swiftBic && <span className="sub-tag">SWIFT: {p.swiftBic}</span>}
                                                </td>
                                                <td>
                                                    <strong className="amount-eur">€{amtEur.toFixed(2)}</strong>
                                                    <span className="amount-azn">≈ {(amtEur * exchangeRate).toFixed(2)} AZN</span>
                                                </td>
                                                <td>
                                                    <span className={`status-pill ${isProcessed ? 'paid' : isRejected ? 'danger' : 'pending'}`}>
                                                        {isProcessed ? '✓ PROCESSED' : isRejected ? '✕ REJECTED (REFUNDED)' : '● PENDING REVIEW'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="date-str">
                                                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-GB') : '—'}
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

            {/* MODAL 1: TOP UP WALLET */}
            {showTopUpModal && (
                <div className="wallet-modal-overlay">
                    <div className="wallet-modal-card">
                        <div className="modal-header">
                            <div>
                                <h3 className="modal-title">Top Up EuroTech Wallet</h3>
                                <p className="modal-subtitle">Add funds in EUR or AZN for instant consular fee settlements and add-on services.</p>
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

                                {/* Currency Selector */}
                                <div className="payment-method-switch" style={{ marginTop: 10 }}>
                                    <button
                                        type="button"
                                        className={`switch-btn ${topupCurrency === 'EUR' ? 'active' : ''}`}
                                        onClick={() => setTopupCurrency('EUR')}
                                    >
                                        € EUR (Euro)
                                    </button>
                                    <button
                                        type="button"
                                        className={`switch-btn ${topupCurrency === 'AZN' ? 'active' : ''}`}
                                        onClick={() => setTopupCurrency('AZN')}
                                    >
                                        ₼ AZN (Manat)
                                    </button>
                                </div>

                                {/* Amount */}
                                <div className="form-group" style={{ marginTop: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label style={{ marginBottom: 4 }}>Top-Up Amount ({topupCurrency}) *</label>
                                        <span style={{ fontSize: '0.8rem', color: '#2563EB', fontWeight: 600 }}>{topupConvertedPreview}</span>
                                    </div>
                                    <div className="currency-input-wrap">
                                        <span className="cur-symbol">{topupCurrency === 'EUR' ? '€' : '₼'}</span>
                                        <input 
                                            type="number" 
                                            step="0.01" 
                                            min="1" 
                                            value={topupAmount} 
                                            onChange={(e) => setTopupAmount(e.target.value)} 
                                            required 
                                        />
                                    </div>
                                    <div className="amount-pills">
                                        {(topupCurrency === 'EUR' ? ['80', '150', '250', '500'] : ['150', '270', '450', '900']).map(val => (
                                            <button 
                                                key={val} 
                                                type="button" 
                                                className="amt-pill"
                                                onClick={() => setTopupAmount(val)}
                                            >
                                                {topupCurrency === 'EUR' ? `€${val}` : `${val} ₼`}
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

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                                                <label>Wire Reference / Receipt #</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="e.g. ABB-948210"
                                                    value={slipRefCode} 
                                                    onChange={(e) => setSlipRefCode(e.target.value)} 
                                                />
                                            </div>
                                        </div>

                                        <div className="form-group">
                                            <label>Upload Payment Receipt (PDF, PNG, JPG — Optional if Reference # given)</label>
                                            <input 
                                                type="file" 
                                                accept=".pdf,.png,.jpg,.jpeg" 
                                                onChange={(e) => setSlipFile(e.target.files?.[0] || null)} 
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
                                    {isSubmitting
                                        ? 'Processing...'
                                        : topupMethod === 'CARD'
                                            ? `Pay ${topupCurrency === 'EUR' ? '€' : ''}${topupAmount}${topupCurrency === 'AZN' ? ' AZN' : ''}`
                                            : 'Submit Slip for Review'}
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
                                    Ref: <strong>{selectedDossier.dossierNumber}</strong> • Amount Due: <strong style={{ color: '#2563EB' }}>€{selectedDossierDue.toFixed(2)}</strong> (≈ {(selectedDossierDue * exchangeRate).toFixed(2)} AZN)
                                </p>
                            </div>
                            <button className="modal-close-btn" onClick={() => setShowPayModal(false)}>✕</button>
                        </div>

                        <div className="modal-body">
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
                                    <div className="option-info" style={{ flex: 1 }}>
                                        <strong>EuroTech Wallet Balance</strong>
                                        <span>Available: €{balanceEur.toFixed(2)} (≈ {balanceAzn.toFixed(2)} AZN)</span>
                                        {balanceEur + 0.005 < selectedDossierDue && (
                                            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                <span style={{ color: '#DC2626', fontSize: '0.78rem' }}>
                                                    ⚠️ Shortfall: €{(selectedDossierDue - balanceEur).toFixed(2)}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="btn-action-outline"
                                                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                                    onClick={(ev) => {
                                                        ev.stopPropagation();
                                                        setShowPayModal(false);
                                                        setTopupCurrency('EUR');
                                                        setTopupMethod('CARD');
                                                        setTopupAmount(Math.max(10, Number((selectedDossierDue - balanceEur).toFixed(2))).toFixed(2));
                                                        setShowTopUpModal(true);
                                                    }}
                                                >
                                                    + Top Up Difference
                                                </button>
                                            </div>
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
                                        <span>Upload stamped bank transfer receipt or wire reference</span>
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
                                        <label>Wire Reference Code</label>
                                        <input 
                                            type="text" 
                                            placeholder={`DOS-${selectedDossier.dossierNumber}`}
                                            value={slipRefCode} 
                                            onChange={(e) => setSlipRefCode(e.target.value)} 
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Upload Receipt (Optional if Reference given)</label>
                                        <input 
                                            type="file" 
                                            accept=".pdf,.png,.jpg,.jpeg" 
                                            onChange={(e) => setSlipFile(e.target.files?.[0] || null)} 
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
                                disabled={isSubmitting || (invoicePayMethod === 'WALLET' && balanceEur + 0.005 < selectedDossierDue)}
                            >
                                {isSubmitting ? 'Settling...' : `Confirm & Settle €${selectedDossierDue.toFixed(2)}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 3: WITHDRAW FUNDS */}
            {showWithdrawModal && (
                <div className="wallet-modal-overlay">
                    <div className="wallet-modal-card">
                        <div className="modal-header">
                            <div>
                                <h3 className="modal-title">Withdraw Wallet Funds</h3>
                                <p className="modal-subtitle">
                                    Available Balance: <strong style={{ color: '#059669' }}>€{balanceEur.toFixed(2)}</strong> (≈ {balanceAzn.toFixed(2)} AZN)
                                </p>
                            </div>
                            <button className="modal-close-btn" onClick={() => setShowWithdrawModal(false)}>✕</button>
                        </div>

                        <form onSubmit={handleWithdrawSubmit}>
                            <div className="modal-body">
                                <div className="payment-method-switch">
                                    <button
                                        type="button"
                                        className={`switch-btn ${withdrawCurrency === 'EUR' ? 'active' : ''}`}
                                        onClick={() => setWithdrawCurrency('EUR')}
                                    >
                                        € Withdraw in EUR
                                    </button>
                                    <button
                                        type="button"
                                        className={`switch-btn ${withdrawCurrency === 'AZN' ? 'active' : ''}`}
                                        onClick={() => setWithdrawCurrency('AZN')}
                                    >
                                        ₼ Withdraw in AZN
                                    </button>
                                </div>

                                <div className="form-group" style={{ marginTop: 14 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label style={{ marginBottom: 4 }}>Withdrawal Amount ({withdrawCurrency}) *</label>
                                        <span style={{ fontSize: '0.8rem', color: '#2563EB', fontWeight: 600 }}>{withdrawConvertedPreview}</span>
                                    </div>
                                    <div className="currency-input-wrap">
                                        <span className="cur-symbol">{withdrawCurrency === 'EUR' ? '€' : '₼'}</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="1"
                                            placeholder="0.00"
                                            value={withdrawAmount}
                                            onChange={(e) => setWithdrawAmount(e.target.value)}
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="amt-pill"
                                            style={{ position: 'absolute', right: 8, flex: 'none', padding: '4px 10px' }}
                                            onClick={() => setWithdrawAmount(
                                                withdrawCurrency === 'EUR' ? balanceEur.toFixed(2) : balanceAzn.toFixed(2)
                                            )}
                                        >
                                            MAX
                                        </button>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Beneficiary Bank Name *</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Kapital Bank / ABB / PASHA Bank"
                                        value={bankName}
                                        onChange={(e) => setBankName(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Account Holder Full Name *</label>
                                    <input
                                        type="text"
                                        placeholder="Full legal name matching bank account"
                                        value={accountHolder}
                                        onChange={(e) => setAccountHolder(e.target.value)}
                                        required
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                                    <div className="form-group">
                                        <label>IBAN (28 characters) *</label>
                                        <input
                                            type="text"
                                            placeholder="AZ21NABZ00000000137010001944"
                                            value={iban}
                                            onChange={(e) => setIban(e.target.value.toUpperCase())}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>SWIFT / BIC</label>
                                        <input
                                            type="text"
                                            placeholder="AIIBAZ2X"
                                            value={swiftBic}
                                            onChange={(e) => setSwiftBic(e.target.value.toUpperCase())}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setShowWithdrawModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" disabled={isSubmitting || balanceEur <= 0}>
                                    {isSubmitting ? 'Submitting...' : 'Submit Withdrawal Request'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 4: PAYOUT BANK COORDINATES */}
            {showBankDetailsModal && (
                <div className="wallet-modal-overlay">
                    <div className="wallet-modal-card">
                        <div className="modal-header">
                            <div>
                                <h3 className="modal-title">Payout Bank Coordinates (IBAN)</h3>
                                <p className="modal-subtitle">Save your default bank account for wallet withdrawals and consular fee refunds.</p>
                            </div>
                            <button className="modal-close-btn" onClick={() => setShowBankDetailsModal(false)}>✕</button>
                        </div>

                        <form onSubmit={handleSaveBankDetails}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Bank Name *</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. International Bank of Azerbaijan (ABB)"
                                        value={bankName}
                                        onChange={(e) => setBankName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Account Holder Full Name *</label>
                                    <input
                                        type="text"
                                        placeholder="Full legal name"
                                        value={accountHolder}
                                        onChange={(e) => setAccountHolder(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>IBAN *</label>
                                    <input
                                        type="text"
                                        placeholder="AZ00..."
                                        value={iban}
                                        onChange={(e) => setIban(e.target.value.toUpperCase())}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>SWIFT / BIC Code</label>
                                    <input
                                        type="text"
                                        placeholder="IBAZAZ2X"
                                        value={swiftBic}
                                        onChange={(e) => setSwiftBic(e.target.value.toUpperCase())}
                                    />
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setShowBankDetailsModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                                    {isSubmitting ? 'Saving...' : 'Save Bank Coordinates'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
