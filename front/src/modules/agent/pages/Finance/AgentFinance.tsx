import React, { useState, useEffect } from 'react';
import { agentService } from '@/shared/api/services';
import { useToast } from '@/shared/context/ToastContext';
import './AgentFinance.css';

interface Transaction {
    id: string;
    date: string;
    reference: string;
    description: string;
    amount: number;
    status: 'paid' | 'pending' | 'processing';
}

export default function AgentFinance() {
    const { showSuccess, showError } = useToast();
    
    // Modal State
    const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
    const [isRequestPayoutOpen, setIsRequestPayoutOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [wallet, setWallet] = useState<any>(null);

    // Form inputs for bank details
    const [accountHolder, setAccountHolder] = useState('');
    const [bankName, setBankName] = useState('');
    const [swiftBic, setSwiftBic] = useState('');
    const [iban, setIban] = useState('');

    // Filter & Payout Amount
    const [filterType, setFilterType] = useState<'all' | 'commissions' | 'payouts'>('all');
    const [payoutAmount, setPayoutAmount] = useState<number>(50);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isExporting, setIsExporting] = useState<boolean>(false);

    const loadWalletData = async () => {
        setLoading(true);
        try {
            const res = await agentService.getWallet();
            if (res.data?.wallet) {
                const w = res.data.wallet;
                setWallet(w);
                
                // Pre-fill real bank details if configured in DB
                if (w.bankName) setBankName(w.bankName);
                if (w.swiftBic) setSwiftBic(w.swiftBic);
                if (w.iban) setIban(w.iban);
                if (w.accountHolder) setAccountHolder(w.accountHolder);

                const txList = w.transactions || [];
                const mapped: Transaction[] = txList.map((tx: any) => ({
                    id: tx.id?.substring(0, 8) || 'TRX-101',
                    date: new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    reference: tx.referenceId || tx.referenceType || 'COMMISSION',
                    description: tx.description || 'Agent Commission',
                    amount: tx.type === 'DEBIT' ? -Math.abs(tx.amount) : Math.abs(tx.amount),
                    status: tx.status === 'COMPLETED' || tx.status === 'PAID' ? 'paid' : tx.status === 'PENDING' ? 'pending' : 'processing',
                }));
                setTransactions(mapped);
            }
        } catch (err: any) {
            console.error('Error loading wallet:', err);
            showError('Maliyyə balansı yüklənərkən xəta baş verdi.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadWalletData();
    }, []);

    const renderStatusBadge = (status: Transaction['status']) => {
        switch (status) {
            case 'paid': return <span className="finance-badge paid">Completed</span>;
            case 'processing': return <span className="finance-badge processing">Processing</span>;
            case 'pending': default: return <span className="finance-badge pending">Pending</span>;
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
            showSuccess('Bank rekvizitləri databazada uğurla yadda saxlanıldı!');
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

    // Filter transactions
    const filteredTransactions = transactions.filter(tx => {
        if (filterType === 'commissions') return tx.amount > 0;
        if (filterType === 'payouts') return tx.amount < 0;
        return true;
    });

    const currentBalance = Number(wallet?.balance || 0);
    const pendingBalance = Number(wallet?.pendingBalance || 0);
    const totalEarnedYtd = Number(wallet?.totalEarnedYtd || 0);

    return (
        <div className="agent-finance-content fade-in">
            {/* Header Section */}
            <div className="agent-finance-header">
                <div className="header-titles">
                    <h1 className="dash-title">Finance & Commissions</h1>
                    <p className="dash-subtitle">Track your agency earnings, and manage wallet balances.</p>
                </div>
                <div className="header-actions">
                    <button className="btn-outline-secondary" onClick={handleExportCsv} disabled={isExporting} title="Download CSV report">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        {isExporting ? 'Endirilir...' : 'Export CSV'}
                    </button>
                    <button className="btn-outline-secondary" onClick={() => setIsPayoutModalOpen(true)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        Payout Method
                    </button>
                    <button className="btn-primary" onClick={() => setIsRequestPayoutOpen(true)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        Request Payout
                    </button>
                </div>
            </div>

            {/* Top 3 Statistic Cards */}
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

            {/* Main Content Layout */}
            <div className="finance-grid-main">
                {/* LEFT COLUMN: Transaction Table */}
                <div className="finance-column-left">
                    <div className="finance-card">
                        <div className="card-header-premium">
                            <h3>Transaction History</h3>
                            <div className="filter-select-wrapper compact">
                                <select 
                                    className="finance-select"
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value as any)}
                                >
                                    <option value="all">All Transactions</option>
                                    <option value="commissions">Commissions Only</option>
                                    <option value="payouts">Payouts Only</option>
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
                                        filteredTransactions.map(trx => (
                                            <tr key={trx.id}>
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
                                                <p style={{ margin: 0, fontSize: '0.88rem' }}>Commissions are automatically credited when you register and submit tour groups for processing.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="finance-column-right">
                </div>
            </div>

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
                                            <input 
                                                type="text" 
                                                className="client-input" 
                                                placeholder="e.g. Travel Partner MMC" 
                                                value={accountHolder}
                                                onChange={(e) => setAccountHolder(e.target.value)}
                                                required 
                                            />
                                        </div>
                                        <div className="client-input-group">
                                            <label>Bank Name</label>
                                            <input 
                                                type="text" 
                                                className="client-input" 
                                                placeholder="e.g. International Bank of Azerbaijan (ABB)" 
                                                value={bankName}
                                                onChange={(e) => setBankName(e.target.value)}
                                                required 
                                            />
                                        </div>
                                        <div className="client-input-group">
                                            <label>SWIFT / BIC Code</label>
                                            <input 
                                                type="text" 
                                                className="client-input" 
                                                placeholder="e.g. IBAZAZ2X" 
                                                value={swiftBic}
                                                onChange={(e) => setSwiftBic(e.target.value)}
                                                required 
                                            />
                                        </div>
                                        <div className="client-input-group full-width">
                                            <label>IBAN (International Bank Account Number)</label>
                                            <input 
                                                type="text" 
                                                className="client-input" 
                                                placeholder="AZ00 IBAZ 0000 0000 0000 0000 00" 
                                                value={iban}
                                                onChange={(e) => setIban(e.target.value)}
                                                required 
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="info-alert" style={{ marginTop: '24px' }}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                    <span>Payouts are processed directly to your verified corporate bank account. Ensure your IBAN and SWIFT codes are accurate.</span>
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
                                                onChange={(e) => setPayoutAmount(Number(e.target.value))} 
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
                                            <input 
                                                type="text" 
                                                className="client-input" 
                                                placeholder="Enter bank name" 
                                                value={bankName} 
                                                onChange={(e) => setBankName(e.target.value)} 
                                                required 
                                            />
                                        </div>
                                        <div className="client-input-group">
                                            <label>SWIFT / BIC</label>
                                            <input 
                                                type="text" 
                                                className="client-input" 
                                                placeholder="Enter SWIFT code" 
                                                value={swiftBic} 
                                                onChange={(e) => setSwiftBic(e.target.value)} 
                                                required 
                                            />
                                        </div>
                                        <div className="client-input-group full-width">
                                            <label>IBAN</label>
                                            <input 
                                                type="text" 
                                                className="client-input" 
                                                placeholder="Enter IBAN" 
                                                value={iban} 
                                                onChange={(e) => setIban(e.target.value)} 
                                                required 
                                            />
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
                                {isSaving ? 'Göndərilir...' : `Withdraw € ${payoutAmount.toFixed(2)}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}