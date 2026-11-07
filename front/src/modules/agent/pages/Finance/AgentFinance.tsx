import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { agentService, paymentService } from '@/shared/api/services';
import { useToast } from '@/shared/context/ToastContext';
import './AgentFinance.css';

interface Transaction {
    id: string;
    date: string;
    reference: string;
    referenceType: string;
    description: string;
    amount: number;
    status: 'paid' | 'pending' | 'processing';
}

interface GroupInvoice {
    groupId: string;
    dossierId?: string | null;
    groupCode: string;
    groupName: string;
    destination: string;
    package?: string;
    paxCount: number;
    governmentFee: number;
    serviceFee: number;
    totalAmount: number;
    estimatedCommissionEur?: number;
    currency: string;
    paymentStatus: string;
    groupStatus: string;
    createdDate: string;
    travelDate: string;
}

export default function AgentFinance() {
    const { showSuccess, showError } = useToast();
    const [searchParams, setSearchParams] = useSearchParams();

    // Tab State (supports ?tab=invoices deep-link from AgentWizard Step 5)
    const initialTab = searchParams.get('tab') === 'invoices' ? 'invoices' : 'commissions';
    const [activeTab, setActiveTab] = useState<'commissions' | 'invoices'>(initialTab);

    useEffect(() => {
        if (searchParams.get('tab') === 'invoices' && activeTab !== 'invoices') {
            setActiveTab('invoices');
        }
    }, [searchParams]);

    const handleSwitchTab = (tab: 'commissions' | 'invoices') => {
        setActiveTab(tab);
        if (tab === 'invoices') setSearchParams({ tab: 'invoices' }, { replace: true });
        else setSearchParams({}, { replace: true });
    };

    // Modal State
    const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
    const [isRequestPayoutOpen, setIsRequestPayoutOpen] = useState(false);
    const [isTopupModalOpen, setIsTopupModalOpen] = useState(false);
    const [payingInvoice, setPayingInvoice] = useState<GroupInvoice | null>(null);

    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [wallet, setWallet] = useState<any>(null);

    // Bank details state
    const [accountHolder, setAccountHolder] = useState('');
    const [bankName, setBankName] = useState('');
    const [swiftBic, setSwiftBic] = useState('');
    const [iban, setIban] = useState('');

    // Top-Up Modal State
    const [topupAmount, setTopupAmount] = useState<number>(500);
    const [topupMethod, setTopupMethod] = useState<'CARD' | 'BANK_SLIP'>('CARD');
    const [topupBankName, setTopupBankName] = useState('ABB (International Bank of Azerbaijan)');
    const [topupReference, setTopupReference] = useState('');
    const [topupSlipFile, setTopupSlipFile] = useState<File | null>(null);

    // Pay Group Fees Modal State
    const [payMethod, setPayMethod] = useState<'WALLET' | 'CARD' | 'BANK_SLIP'>('WALLET');
    const [payBankName, setPayBankName] = useState('ABB (International Bank of Azerbaijan)');
    const [paySenderName, setPaySenderName] = useState('');
    const [payReceiptNumber, setPayReceiptNumber] = useState('');
    const [paySlipFile, setPaySlipFile] = useState<File | null>(null);

    // Filter & Payout Amount
    const [filterType, setFilterType] = useState<'all' | 'commissions' | 'topups' | 'payouts'>('all');
    const [payoutAmount, setPayoutAmount] = useState<number>(50);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [groupInvoices, setGroupInvoices] = useState<GroupInvoice[]>([]);
    const [pendingBankSlips, setPendingBankSlips] = useState<any[]>([]);
    const [isExporting, setIsExporting] = useState<boolean>(false);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    const loadWalletData = async () => {
        setLoading(true);
        try {
            const res: any = await agentService.getWallet();
            const w = res?.data?.wallet || res?.wallet || res?.data;
            if (w) {
                setWallet(w);

                if (w.bankName) setBankName(w.bankName);
                if (w.swiftBic) setSwiftBic(w.swiftBic);
                if (w.iban) setIban(w.iban);
                if (w.accountHolder) setAccountHolder(w.accountHolder);

                const txList = Array.isArray(w.transactions) ? w.transactions : [];
                const mapped: Transaction[] = txList.map((tx: any) => ({
                    id: tx.id && typeof tx.id === 'string' ? tx.id.substring(0, 8) : 'TRX-101',
                    date: tx.createdAt
                        ? new Date(tx.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                        : 'Recent',
                    reference: tx.referenceId || tx.referenceType || 'WALLET',
                    referenceType: tx.referenceType || 'WALLET',
                    description: tx.description || 'Agency Wallet Transaction',
                    amount: tx.type === 'DEBIT' ? -Math.abs(Number(tx.amount || 0)) : Math.abs(Number(tx.amount || 0)),
                    status: tx.status === 'COMPLETED' || tx.status === 'PAID' ? 'paid' : tx.status === 'PENDING' ? 'pending' : 'processing',
                }));
                setTransactions(mapped);

                setGroupInvoices(Array.isArray(w.groupInvoices) ? w.groupInvoices : []);
                setPendingBankSlips(Array.isArray(w.pendingBankSlips) ? w.pendingBankSlips : []);
            } else {
                setWallet({
                    balance: 0,
                    pendingBalance: 0,
                    totalEarnedYtd: 0,
                    unpaidGroupFeesTotal: 0,
                    agentTier: 'BRONZE',
                    ratePerPax: 20,
                    totalPaxLifetime: 0,
                    totalPaxDraft: 0,
                    transactions: [],
                    groupInvoices: [],
                });
            }
        } catch (err: any) {
            console.error('Error loading wallet:', err);
            showError(err.message || 'Maliyyə balansı yüklənərkən xəta baş verdi.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadWalletData();
    }, []);

    const renderStatusBadge = (status: Transaction['status']) => {
        switch (status) {
            case 'paid':
                return <span className="finance-badge paid">Completed</span>;
            case 'processing':
                return <span className="finance-badge processing">Processing</span>;
            case 'pending':
            default:
                return <span className="finance-badge pending">Pending</span>;
        }
    };

    const renderPaymentStatusBadge = (status: string) => {
        const s = (status || 'PENDING').toUpperCase();
        switch (s) {
            case 'PAID':
                return <span className="finance-badge paid">Paid</span>;
            case 'PARTIALLY_PAID':
                return <span className="finance-badge processing">Partial</span>;
            case 'PENDING':
            default:
                return <span className="finance-badge pending">Unpaid</span>;
        }
    };

    const handleTopupSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!topupAmount || topupAmount <= 0) {
            showError('Zəhmət olmasa düzgün məbləğ daxil edin.');
            return;
        }
        setIsSaving(true);
        try {
            if (topupMethod === 'CARD') {
                await agentService.topupWallet({
                    amount: Number(topupAmount),
                    currency: 'EUR',
                    paymentMethod: 'CARD',
                    referenceCode: topupReference || `AG-TOPUP-${Date.now().toString().slice(-6)}`,
                });
                showSuccess(`€ ${Number(topupAmount).toFixed(2)} Agency Wallet balansınıza uğurla əlavə edildi!`);
            } else {
                const fd = new FormData();
                fd.append('amount', String(topupAmount));
                fd.append('currency', 'EUR');
                fd.append('purpose', 'WALLET_TOPUP');
                fd.append('bankName', topupBankName);
                fd.append('senderName', accountHolder || 'Travel Agency Partner');
                fd.append('receiptNumber', topupReference || `AG-WIRE-${Date.now().toString().slice(-6)}`);
                if (topupSlipFile) {
                    fd.append('slip', topupSlipFile);
                }
                await paymentService.submitBankSlip(fd);
                showSuccess(`€ ${Number(topupAmount).toFixed(2)} bank köçürmə qəbzi təqdim edildi! Admin təsdiqindən sonra balans artırılacaq.`);
            }
            setIsTopupModalOpen(false);
            setTopupSlipFile(null);
            setTopupReference('');
            await loadWalletData();
        } catch (err: any) {
            console.error('Top-up error:', err);
            showError(err.message || 'Balans artırma əməliyyatı uğursuz oldu.');
        } finally {
            setIsSaving(false);
        }
    };

    const openPayInvoiceModal = (inv: GroupInvoice) => {
        const currentBal = Number(wallet?.balance || 0);
        setPayingInvoice(inv);
        setPayMethod(currentBal >= inv.totalAmount ? 'WALLET' : 'CARD');
        setPayReceiptNumber(`INV-${inv.groupCode}`);
        setPaySlipFile(null);
    };

    const handleSettleGroupInvoice = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!payingInvoice) return;

        setIsSaving(true);
        try {
            if (payMethod === 'WALLET') {
                await agentService.payGroupWithWallet(payingInvoice.groupId);
                showSuccess(
                    `${payingInvoice.groupCode} rüsumları (€ ${payingInvoice.totalAmount.toFixed(2)}) cüzdandan ödənildi və komissiya balansınıza köçürüldü!`
                );
            } else if (payMethod === 'CARD') {
                const intent = await paymentService.createPaymentIntent({
                    groupBatchId: payingInvoice.groupId,
                    amount: payingInvoice.totalAmount,
                    currency: 'EUR',
                    purpose: 'GROUP_BATCH_PAYMENT',
                });
                await paymentService.confirmPaymentMock({
                    paymentIntentId: intent.paymentIntentId,
                    bankReference: `AG-CARD-${Date.now().toString().slice(-6)}`,
                });
                showSuccess(
                    `${payingInvoice.groupCode} rüsumları (€ ${payingInvoice.totalAmount.toFixed(2)}) B2B kartla ödənildi və komissiya balansınıza köçürüldü!`
                );
            } else {
                const fd = new FormData();
                fd.append('groupBatchId', payingInvoice.groupId);
                if (payingInvoice.dossierId) {
                    fd.append('dossierId', payingInvoice.dossierId);
                }
                fd.append('amount', String(payingInvoice.totalAmount));
                fd.append('currency', 'EUR');
                fd.append('purpose', `GROUP_BATCH_PAYMENT (${payingInvoice.groupCode})`);
                fd.append('bankName', payBankName);
                fd.append('senderName', paySenderName || accountHolder || 'Travel Agency Partner');
                fd.append('receiptNumber', payReceiptNumber || `GRP-WIRE-${Date.now().toString().slice(-6)}`);
                if (paySlipFile) {
                    fd.append('slip', paySlipFile);
                }
                await paymentService.submitBankSlip(fd);
                showSuccess(
                    `${payingInvoice.groupCode} üzrə bank qəbzi göndərildi! Mühasibatlıq təsdiqindən sonra faktura bağlanacaq və komissiya aktivləşəcək.`
                );
            }
            setPayingInvoice(null);
            await loadWalletData();
        } catch (err: any) {
            console.error('Settle group invoice error:', err);
            showError(err.message || 'Qrup ödənişi zamanı xəta baş verdi.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSavePayoutMethod = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await agentService.saveBankDetails({
                bankName,
                iban,
                swiftBic,
                accountHolder: accountHolder || 'Beneficiary',
            });
            showSuccess('Bank rekvizitləri bazada uğurla yadda saxlanıldı!');
            setIsPayoutModalOpen(false);
            await loadWalletData();
        } catch (err: any) {
            console.error('Bank details save error:', err);
            showError(err.message || 'Bank məlumatları saxlanılarkən xəta baş verdi.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleExecutePayout = async (e: React.FormEvent) => {
        e.preventDefault();
        if (payoutAmount <= 0) {
            showError('Zəhmət olmasa düzgün məbləğ daxil edin.');
            return;
        }
        if ((wallet?.balance || 0) < payoutAmount) {
            showError('Cüzdanınızda kifayət qədər balans yoxdur.');
            return;
        }

        setIsSaving(true);
        try {
            await agentService.requestPayout({
                amount: Number(payoutAmount),
                bankName: bankName || 'EuroTech Partner Bank',
                iban: iban || 'AZ00BANK00000000000000',
                swiftBic: swiftBic || 'EUROAZ22',
            });
            showSuccess(`€ ${Number(payoutAmount).toFixed(2)} məbləğində çıxarış sorğusu göndərildi!`);
            setIsRequestPayoutOpen(false);
            await loadWalletData();
        } catch (err: any) {
            console.error('Payout error:', err);
            showError(err.message || 'Çıxarış sorğusu uğursuz oldu.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleExportCsv = async () => {
        try {
            setIsExporting(true);
            const blob = await agentService.exportCsv();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `agent_transactions_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
            showSuccess('CSV hesabatı uğurla endirildi.');
        } catch (err: any) {
            console.error('Export CSV error:', err);
            showError(err.message || 'CSV faylını yükləmək mümkün olmadı.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleSubmitDraftGroup = async (groupId: string, code: string) => {
        setActionLoadingId(groupId);
        try {
            const res: any = await agentService.submitGroup(groupId);
            const credited = Number(res?.data?.commissionCredited || 0);
            const pending = Number(res?.data?.commissionPending || 0);
            if (credited > 0) {
                showSuccess(`"${code}" qrupu emala göndərildi və €${credited.toFixed(2)} komissiya balansınıza köçürüldü!`);
            } else {
                showSuccess(`"${code}" qrupu emala göndərildi (€${pending.toFixed(2)} gözləmədədir — komissiyanın açılması üçün qrup rüsumunu ödəyin).`);
            }
            await loadWalletData();
        } catch (err: any) {
            console.error('Submit group error:', err);
            showError(err.message || 'Qrupu emala göndərmək mümkün olmadı.');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleDownloadGroupInvoice = async (groupId: string, code: string) => {
        setActionLoadingId(groupId);
        try {
            showSuccess(`"${code}" üçün rəsmi B2B faktura (PDF) hazırlanır...`);
            const res = await agentService.getGroupInvoicePdf(groupId);
            const fileUrl = res.data?.fileUrl;
            if (fileUrl) {
                const fullUrl = fileUrl.startsWith('http') ? fileUrl : `http://localhost:5000${fileUrl}`;
                const fileRes = await fetch(fullUrl);
                const blob = await fileRes.blob();
                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = res.data?.fileName || `group_invoice_${code}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
                showSuccess('Rəsmi Qrup Fakturası (PDF) uğurla endirildi!');
            }
        } catch (err: any) {
            console.error('Invoice download error:', err);
            showError(err.message || 'Faktura faylını endirmək mümkün olmadı.');
        } finally {
            setActionLoadingId(null);
        }
    };

    const filteredTransactions = transactions.filter((tx) => {
        if (filterType === 'commissions') return tx.referenceType === 'COMMISSION';
        if (filterType === 'topups') return tx.referenceType === 'TOPUP';
        if (filterType === 'payouts') return tx.amount < 0;
        return true;
    });

    const currentBalance = Number(wallet?.balance || 0);
    const pendingBalance = Number(wallet?.pendingBalance || 0);
    const totalEarnedYtd = Number(wallet?.totalEarnedYtd || 0);
    const unpaidGroupFees = Number(
        wallet?.unpaidGroupFeesTotal ??
            groupInvoices
                .filter((i) => i.paymentStatus !== 'PAID')
                .reduce((acc, i) => acc + Number(i.totalAmount || 0), 0)
    );
    const tier = wallet?.agentTier || 'BRONZE';
    const ratePerPax = Number(wallet?.ratePerPax || 20);
    const processedPax = Number(wallet?.totalPaxLifetime || 0);
    const draftPax = Number(wallet?.totalPaxDraft || 0);

    return (
        <div className="agent-finance-content fade-in">
            {/* Header Section */}
            <div className="agent-finance-header">
                <div className="header-titles">
                    <h1 className="dash-title">Finance & Commissions</h1>
                    <p className="dash-subtitle">Manage your B2B Agency Wallet, settle group consular fees, and withdraw partner commissions.</p>
                </div>
                <div className="header-actions" style={{ flexWrap: 'wrap' }}>
                    <button className="btn-outline-secondary" onClick={handleExportCsv} disabled={isExporting} title="Download CSV report">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        {isExporting ? 'Endirilir...' : 'Export CSV'}
                    </button>
                    <button className="btn-outline-secondary" onClick={() => setIsPayoutModalOpen(true)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        Payout Method
                    </button>
                    <button className="btn-outline-secondary" onClick={() => setIsRequestPayoutOpen(true)} style={{ borderColor: '#0F1E36', color: '#0F1E36' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        Request Payout
                    </button>
                    <button className="btn-primary" onClick={() => setIsTopupModalOpen(true)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        + Top Up Wallet
                    </button>
                </div>
            </div>

            {/* Top 4 Statistic Cards */}
            <div className="finance-stats-grid">
                <div className="finance-stat-card primary-gradient">
                    <div className="stat-content">
                        <span>Available Wallet Balance</span>
                        <h3>€ {currentBalance.toFixed(2)}</h3>
                    </div>
                    <div className="stat-icon-wrapper light-alpha">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                    </div>
                </div>
                <div className="finance-stat-card">
                    <div className="stat-content">
                        <span>Pending Clearing</span>
                        <h3>€ {pendingBalance.toFixed(2)}</h3>
                    </div>
                    <div className="stat-icon-wrapper orange-tint">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                </div>
                <div
                    className="finance-stat-card"
                    onClick={() => handleSwitchTab('invoices')}
                    style={{ cursor: 'pointer' }}
                    title="Click to inspect and pay group consular fees"
                >
                    <div className="stat-content">
                        <span>Unpaid Group Fees</span>
                        <h3 style={{ color: unpaidGroupFees > 0 ? '#DC2626' : '#059669' }}>€ {unpaidGroupFees.toFixed(2)}</h3>
                    </div>
                    <div className="stat-icon-wrapper red-tint">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                    </div>
                </div>
                <div className="finance-stat-card">
                    <div className="stat-content">
                        <span>Total Earned (YTD)</span>
                        <h3>€ {totalEarnedYtd.toFixed(2)}</h3>
                    </div>
                    <div className="stat-icon-wrapper green-tint">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    </div>
                </div>
            </div>

            {pendingBankSlips.length > 0 && (
                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '12px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.9rem', color: '#92400E' }}>
                        <strong>⏳ {pendingBankSlips.length} Bank Wire Transfer(s) Pending Review:</strong> Admin Finance Desk təsdiqindən sonra balans və ya qrup fakturası avtomatik yenilənəcək.
                    </div>
                </div>
            )}

            {/* B2B Partner Tier Progress Card */}
            <div style={{
                background: 'linear-gradient(135deg, #0F1E36 0%, #1E3A8A 100%)',
                color: '#FFFFFF',
                borderRadius: '14px',
                padding: '24px 28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: '0 4px 20px -2px rgba(15, 30, 54, 0.15)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{
                                background: tier === 'PLATINUM' ? '#E0E7FF' : tier === 'GOLD' ? '#FEF08A' : tier === 'SILVER' ? '#E2E8F0' : '#FED7AA',
                                color: tier === 'PLATINUM' ? '#3730A3' : tier === 'GOLD' ? '#854D0E' : tier === 'SILVER' ? '#1E293B' : '#9A3412',
                                padding: '4px 12px',
                                borderRadius: '20px',
                                fontWeight: 800,
                                fontSize: '0.8rem',
                                letterSpacing: '0.5px'
                            }}>
                                {tier} PARTNER TIER
                            </span>
                            <span style={{ fontSize: '0.9rem', color: '#93C5FD' }}>
                                Commission Rate: <strong>€{ratePerPax.toFixed(2)} / passenger</strong>
                            </span>
                        </div>
                        <h3 style={{ margin: '8px 0 0 0', fontSize: '1.25rem', fontWeight: 700, color: '#FFFFFF' }}>
                            Agency Volume & Reward Progression
                        </h3>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.8rem', color: '#93C5FD', display: 'block' }}>Processed Volume</span>
                        <strong style={{ fontSize: '1.4rem', color: '#FDE047' }}>
                            {processedPax} Completed {draftPax > 0 ? `(${draftPax} Pending Payment)` : ''}
                        </strong>
                    </div>
                </div>

                {/* Tier Milestones Progress Bar */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#BFDBFE', marginBottom: '6px' }}>
                        <span>Bronze (€20)</span>
                        <span>Silver (€25) - 25+ Pax</span>
                        <span>Gold (€28) - 60+ Pax</span>
                        <span>Platinum (€32) - 120+ Pax</span>
                    </div>
                    <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.2)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, Math.max(8, (processedPax / 120) * 100))}%`, height: '100%', background: '#FACC15', borderRadius: '4px', transition: 'width 0.5s ease' }}></div>
                    </div>
                </div>
            </div>

            {/* TAB NAVIGATION: Commissions vs Group Invoices */}
            <div className="finance-tabs-nav">
                <button
                    className={`finance-tab-btn ${activeTab === 'commissions' ? 'active' : ''}`}
                    onClick={() => handleSwitchTab('commissions')}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>
                    Commissions & Wallet Ledger
                    <span className="finance-tab-badge">{transactions.length}</span>
                </button>
                <button
                    className={`finance-tab-btn ${activeTab === 'invoices' ? 'active' : ''}`}
                    onClick={() => handleSwitchTab('invoices')}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 14h.01"/></svg>
                    Group Invoices & Consular Fees
                    <span className="finance-tab-badge">{groupInvoices.length}</span>
                </button>
            </div>

            {/* Main Content Layout */}
            <div className="finance-grid-main">
                {/* LEFT COLUMN */}
                <div className="finance-column-left">
                    {activeTab === 'commissions' ? (
                        <div className="finance-card">
                            <div className="card-header-premium">
                                <h3>Wallet, Commission & Payout Ledger</h3>
                                <div className="filter-select-wrapper compact">
                                    <select
                                        className="finance-select"
                                        value={filterType}
                                        onChange={(e) => setFilterType(e.target.value as any)}
                                    >
                                        <option value="all">All Transactions</option>
                                        <option value="commissions">Commissions Only</option>
                                        <option value="topups">Wallet Top-Ups</option>
                                        <option value="payouts">Debits & Payouts</option>
                                    </select>
                                </div>
                            </div>

                            <div className="premium-table-container">
                                <table className="premium-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Reference ID</th>
                                            <th>Description</th>
                                            <th className="text-right">Amount</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr>
                                                <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: 'var(--color-neutral)' }}>
                                                    Maliyyə əməliyyatları bazadan yüklənir...
                                                </td>
                                            </tr>
                                        ) : filteredTransactions.length > 0 ? (
                                            filteredTransactions.map((trx, idx) => (
                                                <tr key={`${trx.id}-${idx}`}>
                                                    <td className="cell-date">{trx.date}</td>
                                                    <td className="cell-bold">{trx.reference}</td>
                                                    <td className="cell-desc" title={trx.description}>{trx.description}</td>
                                                    <td className={`cell-amount text-right ${trx.amount > 0 ? 'positive' : 'negative'}`}>
                                                        {trx.amount > 0 ? '+' : '-'}€ {Math.abs(trx.amount).toFixed(2)}
                                                    </td>
                                                    <td>{renderStatusBadge(trx.status)}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={5} style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--color-neutral)' }}>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 36, height: 36, margin: '0 auto 12px', opacity: 0.4 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                                    <p style={{ margin: '0 0 4px 0', fontWeight: 600, color: 'var(--color-primary)' }}>No financial transactions recorded yet</p>
                                                    <p style={{ margin: 0, fontSize: '0.88rem' }}>Top up your Agency Wallet or register tour groups to view live commissions and settlements.</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        /* TAB 2: Group Invoices & Consular Fees */
                        <div className="finance-card">
                            <div className="card-header-premium">
                                <h3>Delegation Invoices & Consular Fees</h3>
                                <span style={{ fontSize: '0.85rem', color: 'var(--color-neutral)' }}>Settle group fees to confirm consular appointments & unlock commissions</span>
                            </div>

                            <div className="premium-table-container">
                                <table className="premium-table">
                                    <thead>
                                        <tr>
                                            <th>Group Name</th>
                                            <th>Code</th>
                                            <th>Travelers</th>
                                            <th>Total Fees</th>
                                            <th>Payment Status</th>
                                            <th style={{ textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr>
                                                <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--color-neutral)' }}>
                                                    Qrup faktura məlumatları yüklənir...
                                                </td>
                                            </tr>
                                        ) : groupInvoices.length > 0 ? (
                                            groupInvoices.map((inv) => (
                                                <tr key={inv.groupId}>
                                                    <td>
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <strong style={{ color: 'var(--color-primary)' }}>{inv.groupName}</strong>
                                                            <span style={{ fontSize: '0.78rem', color: 'var(--color-neutral)' }}>
                                                                {inv.destination} • {inv.createdDate}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="cell-bold">{inv.groupCode}</td>
                                                    <td>
                                                        <span style={{ fontWeight: 600 }}>{inv.paxCount} Pax</span>
                                                        {inv.estimatedCommissionEur ? (
                                                            <span style={{ display: 'block', fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>
                                                                +€{inv.estimatedCommissionEur.toFixed(2)} Comm.
                                                            </span>
                                                        ) : null}
                                                    </td>
                                                    <td className="cell-bold">
                                                        € {inv.totalAmount.toFixed(2)}
                                                        <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 400, color: 'var(--color-neutral)' }}>
                                                            Gov: €{inv.governmentFee.toFixed(0)} | Srv: €{inv.serviceFee.toFixed(0)}
                                                        </span>
                                                    </td>
                                                    <td>{renderPaymentStatusBadge(inv.paymentStatus)}</td>
                                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                                                            {inv.paymentStatus !== 'PAID' && (
                                                                <button
                                                                    className="btn-table-action primary"
                                                                    onClick={() => openPayInvoiceModal(inv)}
                                                                    disabled={actionLoadingId === inv.groupId}
                                                                    title="Pay consular & package fees via Wallet, Card or Bank Slip"
                                                                >
                                                                    💳 Pay Fees
                                                                </button>
                                                            )}
                                                            {inv.groupStatus === 'DRAFT' && inv.paymentStatus === 'PAID' && (
                                                                <button
                                                                    className="btn-table-action primary"
                                                                    onClick={() => handleSubmitDraftGroup(inv.groupId, inv.groupCode)}
                                                                    disabled={actionLoadingId === inv.groupId}
                                                                >
                                                                    Submit Group
                                                                </button>
                                                            )}
                                                            <button
                                                                className="btn-table-action"
                                                                onClick={() => handleDownloadGroupInvoice(inv.groupId, inv.groupCode)}
                                                                disabled={actionLoadingId === inv.groupId}
                                                                title="Official B2B Tax Invoice (PDF) endir"
                                                            >
                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                                                Invoice PDF
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={6} style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--color-neutral)' }}>
                                                    <p style={{ margin: '0 0 4px 0', fontWeight: 600, color: 'var(--color-primary)' }}>Heç bir qrup fakturası tapılmadı</p>
                                                    <p style={{ margin: 0, fontSize: '0.88rem' }}>Qrup qeydiyyatdan keçirdikdə avtomatik hesab-faktura formalaşacaq.</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: Bank Account Info & Tier Breakdown */}
                <div className="finance-column-right" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className="finance-widget-card">
                        <h4>
                            <span>Verified Payout Account</span>
                            {wallet?.iban && (
                                <span className="verified-badge">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ width: 12, height: 12 }}><polyline points="20 6 9 17 4 12"/></svg>
                                    Active
                                </span>
                            )}
                        </h4>

                        {wallet?.iban ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div className="bank-detail-item">
                                    <span className="label">Beneficiary</span>
                                    <span className="val" style={{ fontFamily: 'inherit' }}>{wallet.accountHolder || 'Agency Partner'}</span>
                                </div>
                                <div className="bank-detail-item">
                                    <span className="label">Bank Name</span>
                                    <span className="val" style={{ fontFamily: 'inherit' }}>{wallet.bankName || 'Partner Bank'}</span>
                                </div>
                                <div className="bank-detail-item">
                                    <span className="label">IBAN</span>
                                    <span className="val">{wallet.iban}</span>
                                </div>
                                <div className="bank-detail-item">
                                    <span className="label">SWIFT / BIC</span>
                                    <span className="val">{wallet.swiftBic || 'N/A'}</span>
                                </div>
                                <button
                                    className="btn-outline-secondary"
                                    style={{ marginTop: '8px', justifyContent: 'center' }}
                                    onClick={() => setIsPayoutModalOpen(true)}
                                >
                                    ✎ Rekvizitləri Yenilə
                                </button>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '16px 8px' }}>
                                <p style={{ fontSize: '0.88rem', color: 'var(--color-neutral)', margin: '0 0 16px 0' }}>
                                    Bank rekvizitlərinizi daxil edin ki, qazandığınız komissiyaları birbaşa bank hesabınıza çıxara biləsiniz.
                                </p>
                                <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setIsPayoutModalOpen(true)}>
                                    + Bank Hesabı Əlavə Et
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="finance-widget-card">
                        <h4>B2B Commission Matrix</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: tier === 'BRONZE' ? '#FEF3C7' : '#F8FAFC', borderRadius: '6px', fontWeight: tier === 'BRONZE' ? 700 : 500 }}>
                                <span>Bronze (0 - 24 Pax)</span>
                                <strong>€ 20.00 / pax</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: tier === 'SILVER' ? '#E0E7FF' : '#F8FAFC', borderRadius: '6px', fontWeight: tier === 'SILVER' ? 700 : 500 }}>
                                <span>Silver (25 - 59 Pax)</span>
                                <strong>€ 25.00 / pax</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: tier === 'GOLD' ? '#FEF08A' : '#F8FAFC', borderRadius: '6px', fontWeight: tier === 'GOLD' ? 700 : 500 }}>
                                <span>Gold (60 - 119 Pax)</span>
                                <strong>€ 28.00 / pax</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: tier === 'PLATINUM' ? '#EDE9FE' : '#F8FAFC', borderRadius: '6px', fontWeight: tier === 'PLATINUM' ? 700 : 500 }}>
                                <span>Platinum (120+ Pax)</span>
                                <strong>€ 32.00 / pax</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- TOP-UP WALLET MODAL --- */}
            {isTopupModalOpen && (
                <div className="premium-modal-overlay fade-in" onClick={() => setIsTopupModalOpen(false)}>
                    <div className="premium-modal-container slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-header-info">
                                <span className="modal-badge">Agency Wallet</span>
                                <h2>Top Up Prepaid Balance</h2>
                            </div>
                            <button className="btn-modal-close" onClick={() => setIsTopupModalOpen(false)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>

                        <div className="modal-body">
                            <form id="agentTopupForm" onSubmit={handleTopupSubmit}>
                                <div className="settings-section">
                                    <h3>1. Deposit Amount (EUR)</h3>
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                        {[250, 500, 1000, 2500].map((preset) => (
                                            <button
                                                key={preset}
                                                type="button"
                                                onClick={() => setTopupAmount(preset)}
                                                style={{
                                                    padding: '8px 14px',
                                                    borderRadius: '8px',
                                                    border: topupAmount === preset ? '2px solid #2563EB' : '1px solid #CBD5E1',
                                                    background: topupAmount === preset ? '#EFF6FF' : '#FFFFFF',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                € {preset}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="client-input-group full-width">
                                        <label>Custom Amount (EUR)</label>
                                        <input
                                            type="number"
                                            className="client-input"
                                            min="10"
                                            step="0.01"
                                            value={topupAmount}
                                            onChange={(e) => setTopupAmount(Number(e.target.value) || 0)}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="settings-section">
                                    <h3>2. Funding Method</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                                        <button
                                            type="button"
                                            onClick={() => setTopupMethod('CARD')}
                                            style={{
                                                padding: '12px',
                                                borderRadius: '10px',
                                                border: topupMethod === 'CARD' ? '2px solid #2563EB' : '1px solid #CBD5E1',
                                                background: topupMethod === 'CARD' ? '#EFF6FF' : '#FFFFFF',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            💳 Online B2B Card (Instant)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTopupMethod('BANK_SLIP')}
                                            style={{
                                                padding: '12px',
                                                borderRadius: '10px',
                                                border: topupMethod === 'BANK_SLIP' ? '2px solid #2563EB' : '1px solid #CBD5E1',
                                                background: topupMethod === 'BANK_SLIP' ? '#EFF6FF' : '#FFFFFF',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            🏦 Bank Wire Slip
                                        </button>
                                    </div>

                                    {topupMethod === 'BANK_SLIP' && (
                                        <div className="client-form-grid">
                                            <div className="client-input-group">
                                                <label>Sending Bank</label>
                                                <input
                                                    type="text"
                                                    className="client-input"
                                                    value={topupBankName}
                                                    onChange={(e) => setTopupBankName(e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Wire Reference / Receipt No</label>
                                                <input
                                                    type="text"
                                                    className="client-input"
                                                    placeholder="e.g. WIRE-89124"
                                                    value={topupReference}
                                                    onChange={(e) => setTopupReference(e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div className="client-input-group full-width">
                                                <label>Attach Payment Slip (PDF / Image)</label>
                                                <input
                                                    type="file"
                                                    accept=".pdf,.jpg,.jpeg,.png"
                                                    className="client-input"
                                                    onChange={(e) => setTopupSlipFile(e.target.files?.[0] || null)}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </form>
                        </div>

                        <div className="modal-footer">
                            <button type="button" className="btn-modal-secondary" onClick={() => setIsTopupModalOpen(false)} disabled={isSaving}>Cancel</button>
                            <button type="submit" form="agentTopupForm" className="btn-modal-primary" disabled={isSaving || topupAmount <= 0}>
                                {isSaving ? 'Emal olunur...' : topupMethod === 'CARD' ? `Deposit € ${topupAmount.toFixed(2)} Now` : 'Submit Wire Slip'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- PAY GROUP INVOICE MODAL --- */}
            {payingInvoice && (
                <div className="premium-modal-overlay fade-in" onClick={() => setPayingInvoice(null)}>
                    <div className="premium-modal-container slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-header-info">
                                <span className="modal-badge">Group Settlement</span>
                                <h2>Pay Fees: {payingInvoice.groupName} ({payingInvoice.groupCode})</h2>
                            </div>
                            <button className="btn-modal-close" onClick={() => setPayingInvoice(null)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>

                        <div className="modal-body">
                            <form id="settleGroupInvoiceForm" onSubmit={handleSettleGroupInvoice}>
                                <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 600, color: '#475569' }}>Total Consular & Package Fees ({payingInvoice.paxCount} Pax):</span>
                                        <strong style={{ fontSize: '1.35rem', color: '#0F1E36' }}>€ {payingInvoice.totalAmount.toFixed(2)}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.84rem', color: '#059669', fontWeight: 600 }}>
                                        <span>Partner Commission Unlocked Upon Payment:</span>
                                        <span>+€ {(payingInvoice.estimatedCommissionEur || payingInvoice.paxCount * ratePerPax).toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="settings-section">
                                    <h3>Select Payment Method</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
                                        <button
                                            type="button"
                                            onClick={() => setPayMethod('WALLET')}
                                            style={{
                                                padding: '12px 10px',
                                                borderRadius: '10px',
                                                border: payMethod === 'WALLET' ? '2px solid #2563EB' : '1px solid #CBD5E1',
                                                background: payMethod === 'WALLET' ? '#EFF6FF' : '#FFFFFF',
                                                fontWeight: 700,
                                                fontSize: '0.84rem',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            👛 Agency Wallet
                                            <div style={{ fontSize: '0.74rem', color: currentBalance >= payingInvoice.totalAmount ? '#059669' : '#DC2626', marginTop: '4px' }}>
                                                € {currentBalance.toFixed(2)} avail.
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPayMethod('CARD')}
                                            style={{
                                                padding: '12px 10px',
                                                borderRadius: '10px',
                                                border: payMethod === 'CARD' ? '2px solid #2563EB' : '1px solid #CBD5E1',
                                                background: payMethod === 'CARD' ? '#EFF6FF' : '#FFFFFF',
                                                fontWeight: 700,
                                                fontSize: '0.84rem',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            💳 Online B2B Card
                                            <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '4px' }}>Instant 3D-Secure</div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPayMethod('BANK_SLIP')}
                                            style={{
                                                padding: '12px 10px',
                                                borderRadius: '10px',
                                                border: payMethod === 'BANK_SLIP' ? '2px solid #2563EB' : '1px solid #CBD5E1',
                                                background: payMethod === 'BANK_SLIP' ? '#EFF6FF' : '#FFFFFF',
                                                fontWeight: 700,
                                                fontSize: '0.84rem',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            🏦 Bank Wire Slip
                                            <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '4px' }}>Admin Verification</div>
                                        </button>
                                    </div>

                                    {payMethod === 'WALLET' && currentBalance < payingInvoice.totalAmount && (
                                        <div style={{ padding: '12px 14px', borderRadius: '8px', background: '#FEF2F2', color: '#991B1B', fontSize: '0.85rem' }}>
                                            Agency Wallet balansınız (€ {currentBalance.toFixed(2)}) bu faktura üçün kifayət deyil. Zəhmət olmasa əvvəlcə <strong>+ Top Up Wallet</strong> edin və ya <strong>Online B2B Card</strong> seçin.
                                        </div>
                                    )}

                                    {payMethod === 'BANK_SLIP' && (
                                        <div className="client-form-grid">
                                            <div className="client-input-group">
                                                <label>Bank Name</label>
                                                <input type="text" className="client-input" value={payBankName} onChange={(e) => setPayBankName(e.target.value)} required />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Receipt / Reference No</label>
                                                <input type="text" className="client-input" value={payReceiptNumber} onChange={(e) => setPayReceiptNumber(e.target.value)} required />
                                            </div>
                                            <div className="client-input-group full-width">
                                                <label>Sender Company Name</label>
                                                <input type="text" className="client-input" placeholder="e.g. Baku Travel Partner MMC" value={paySenderName} onChange={(e) => setPaySenderName(e.target.value)} />
                                            </div>
                                            <div className="client-input-group full-width">
                                                <label>Attach Official Payment Slip (PDF / Image)</label>
                                                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="client-input" onChange={(e) => setPaySlipFile(e.target.files?.[0] || null)} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </form>
                        </div>

                        <div className="modal-footer">
                            <button type="button" className="btn-modal-secondary" onClick={() => setPayingInvoice(null)} disabled={isSaving}>Cancel</button>
                            <button
                                type="submit"
                                form="settleGroupInvoiceForm"
                                className="btn-modal-primary"
                                disabled={isSaving || (payMethod === 'WALLET' && currentBalance < payingInvoice.totalAmount)}
                            >
                                {isSaving
                                    ? 'Ödənilir...'
                                    : payMethod === 'BANK_SLIP'
                                      ? 'Submit Wire Slip'
                                      : `Pay € ${payingInvoice.totalAmount.toFixed(2)}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- PAYOUT METHOD MODAL --- */}
            {isPayoutModalOpen && (
                <div className="premium-modal-overlay fade-in" onClick={() => setIsPayoutModalOpen(false)}>
                    <div className="premium-modal-container slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-header-info">
                                <span className="modal-badge">Finance Settings</span>
                                <h2>Bank Account Details</h2>
                            </div>
                            <button className="btn-modal-close" onClick={() => setIsPayoutModalOpen(false)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>

                        <div className="modal-body">
                            <form id="payoutForm" onSubmit={handleSavePayoutMethod}>
                                <div className="settings-section">
                                    <h3>Receiving Account Information</h3>
                                    <div className="client-form-grid">
                                        <div className="client-input-group full-width">
                                            <label>Company / Beneficiary Name</label>
                                            <input type="text" className="client-input" placeholder="e.g. Travel Partner MMC" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} required />
                                        </div>
                                        <div className="client-input-group">
                                            <label>Bank Name</label>
                                            <input type="text" className="client-input" placeholder="e.g. International Bank of Azerbaijan (ABB)" value={bankName} onChange={(e) => setBankName(e.target.value)} required />
                                        </div>
                                        <div className="client-input-group">
                                            <label>SWIFT / BIC Code</label>
                                            <input type="text" className="client-input" placeholder="e.g. IBAZAZ2X" value={swiftBic} onChange={(e) => setSwiftBic(e.target.value)} required />
                                        </div>
                                        <div className="client-input-group full-width">
                                            <label>IBAN (International Bank Account Number)</label>
                                            <input type="text" className="client-input" placeholder="AZ00 IBAZ 0000 0000 0000 0000 00" value={iban} onChange={(e) => setIban(e.target.value)} required />
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="modal-footer">
                            <button type="button" className="btn-modal-secondary" onClick={() => setIsPayoutModalOpen(false)} disabled={isSaving}>Cancel</button>
                            <button type="submit" form="payoutForm" className="btn-modal-primary" disabled={isSaving}>
                                {isSaving ? 'Yadda saxlanılır...' : 'Save Bank Details'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- REQUEST PAYOUT MODAL --- */}
            {isRequestPayoutOpen && (
                <div className="premium-modal-overlay fade-in" onClick={() => setIsRequestPayoutOpen(false)}>
                    <div className="premium-modal-container slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-header-info">
                                <span className="modal-badge">Withdraw Funds</span>
                                <h2>Request Agency Payout</h2>
                            </div>
                            <button className="btn-modal-close" onClick={() => setIsRequestPayoutOpen(false)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>

                        <div className="modal-body">
                            <form id="requestPayoutForm" onSubmit={handleExecutePayout}>
                                <div className="settings-section">
                                    <h3>Withdrawal Amount</h3>
                                    <div className="client-form-grid">
                                        <div className="client-input-group full-width">
                                            <label>Amount in EUR (Available: € {currentBalance.toFixed(2)})</label>
                                            <input
                                                type="number"
                                                className="client-input"
                                                min="10"
                                                step="0.01"
                                                max={currentBalance || 10000}
                                                value={payoutAmount}
                                                onChange={(e) => setPayoutAmount(Number(e.target.value) || 0)}
                                                required
                                            />
                                        </div>
                                    </div>
                                    {currentBalance < 10 && (
                                        <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#DC2626' }}>
                                            Minimum withdrawal amount is € 10.00.
                                        </div>
                                    )}
                                </div>

                                <div className="settings-section">
                                    <h3>Destination Bank Account</h3>
                                    <div className="client-form-grid">
                                        <div className="client-input-group">
                                            <label>Bank Name</label>
                                            <input type="text" className="client-input" placeholder="Enter bank name" value={bankName} onChange={(e) => setBankName(e.target.value)} required />
                                        </div>
                                        <div className="client-input-group">
                                            <label>SWIFT / BIC</label>
                                            <input type="text" className="client-input" placeholder="Enter SWIFT code" value={swiftBic} onChange={(e) => setSwiftBic(e.target.value)} required />
                                        </div>
                                        <div className="client-input-group full-width">
                                            <label>IBAN</label>
                                            <input type="text" className="client-input" placeholder="Enter IBAN" value={iban} onChange={(e) => setIban(e.target.value)} required />
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="modal-footer">
                            <button type="button" className="btn-modal-secondary" onClick={() => setIsRequestPayoutOpen(false)} disabled={isSaving}>Cancel</button>
                            <button
                                type="submit"
                                form="requestPayoutForm"
                                className="btn-modal-primary"
                                disabled={isSaving || currentBalance < 10 || currentBalance < payoutAmount}
                            >
                                {isSaving ? 'Göndərilir...' : `Withdraw € ${(Number(payoutAmount) || 0).toFixed(2)}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
