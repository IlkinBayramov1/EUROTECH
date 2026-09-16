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
    const [isSaving, setIsSaving] = useState(false);
    const [wallet, setWallet] = useState<any>(null);

    // Form inputs for payout
    const [bankName, setBankName] = useState('Bank of Baku');
    const [swiftBic, setSwiftBic] = useState('BBAKAZ22');
    const [iban, setIban] = useState('AZ43 BBAK 0000 0000 1234 5678 90');

    const [transactions, setTransactions] = useState<Transaction[]>([
        { id: 'TRX-9980', date: 'Sep 05, 2026', reference: 'GRP-8821', description: 'Commission: Budapest Delegation (24 App)', amount: 480.00, status: 'pending' },
        { id: 'TRX-9975', date: 'Aug 28, 2026', reference: 'Payout #402', description: 'Monthly Wallet Payout to Bank Account', amount: -1250.00, status: 'processing' },
        { id: 'TRX-9962', date: 'Aug 15, 2026', reference: 'GRP-8704', description: 'Commission: Summer Camp Group (15 App)', amount: 300.00, status: 'paid' },
        { id: 'TRX-9951', date: 'Aug 02, 2026', reference: 'GRP-8699', description: 'Commission: Business Expo (5 App)', amount: 100.00, status: 'paid' },
        { id: 'TRX-9940', date: 'Jul 28, 2026', reference: 'Payout #401', description: 'Monthly Wallet Payout to Bank Account', amount: -950.00, status: 'paid' },
    ]);

    useEffect(() => {
        agentService.getWallet()
            .then(res => {
                if (res.data?.wallet) {
                    setWallet(res.data.wallet);
                    if (res.data.wallet.transactions && res.data.wallet.transactions.length > 0) {
                        const mapped = res.data.wallet.transactions.map((tx: any) => ({
                            id: tx.id?.substring(0, 8) || 'TRX-101',
                            date: new Date(tx.createdAt).toLocaleDateString(),
                            reference: tx.referenceType || 'COMMISSION',
                            description: tx.description || 'Agent Commission',
                            amount: tx.type === 'DEBIT' ? -tx.amount : tx.amount,
                            status: tx.status === 'COMPLETED' ? 'paid' : 'pending',
                        }));
                        setTransactions(mapped);
                    }
                }
            })
            .catch(() => {});
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
            await agentService.requestPayout({
                amount: wallet?.balance > 0 ? wallet.balance : 100,
                bankName,
                iban,
                swiftBic,
            });
            showSuccess('Payout request submitted to bank successfully!');
            setIsPayoutModalOpen(false);
        } catch (err: any) {
            showError(err.message || 'Bank details saved for scheduled payouts.');
            setIsPayoutModalOpen(false);
        } finally {
            setIsSaving(false);
        }
    };

    const handleExportCsv = () => {
        window.open(agentService.getCsvUrl(), '_blank');
    };

    return (
        <div className="agent-finance-content fade-in">
            {/* Header Section */}
            <div className="agent-finance-header">
                <div className="header-titles">
                    <h1 className="dash-title">Finance & Commissions</h1>
                    <p className="dash-subtitle">Track your agency earnings, and manage wallet balances.</p>
                </div>
                <div className="header-actions">
                    <button className="btn-outline-secondary" onClick={handleExportCsv}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Export CSV
                    </button>
                    {/* YENİ DÜYMƏ */}
                    <button className="btn-outline-secondary" onClick={() => setIsPayoutModalOpen(true)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        Payout Method
                    </button>
                </div>
            </div>

            {/* Top 3 Statistic Cards */}
            <div className="finance-stats-grid">
                <div className="finance-stat-card primary-gradient">
                    <div className="stat-content">
                        <span>Available Wallet Balance</span>
                        <h3>€ {wallet?.balance !== undefined ? Number(wallet.balance).toFixed(2) : '480.00'}</h3>
                    </div>
                    <div className="stat-icon-wrapper light-alpha">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                    </div>
                </div>
                <div className="finance-stat-card">
                    <div className="stat-content">
                        <span>Pending Clearing</span>
                        <h3>€ {wallet?.pendingBalance !== undefined ? Number(wallet.pendingBalance).toFixed(2) : '1,250.00'}</h3>
                    </div>
                    <div className="stat-icon-wrapper orange-tint">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                </div>
                <div className="finance-stat-card">
                    <div className="stat-content">
                        <span>Total Earned (YTD)</span>
                        <h3>€ 8,450.00</h3>
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
                                <select className="finance-select">
                                    <option value="all">All Transactions</option>
                                    <option value="commissions">Commissions</option>
                                    <option value="payouts">Payouts</option>
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
                                    {transactions.map(trx => (
                                        <tr key={trx.id}>
                                            <td className="cell-date">{trx.date}</td>
                                            <td className="cell-bold">{trx.reference}</td>
                                            <td className="cell-desc" title={trx.description}>{trx.description}</td>
                                            <td className={`cell-amount text-right ${trx.amount > 0 ? 'positive' : 'negative'}`}>
                                                {trx.amount > 0 ? '+' : '-'}€ {Math.abs(trx.amount).toFixed(2)}
                                            </td>
                                            <td>{renderStatusBadge(trx.status)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        
                        <div className="table-footer-alt">
                            <button className="btn-text-primary">Load More Transactions</button>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Agency Tier (Bank Card Removed) */}
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
                                            <input type="text" className="client-input" defaultValue="TechTrade Agency MMC" required />
                                        </div>
                                        <div className="client-input-group">
                                            <label>Bank Name</label>
                                            <input type="text" className="client-input" defaultValue="Bank of Baku" required />
                                        </div>
                                        <div className="client-input-group">
                                            <label>SWIFT / BIC Code</label>
                                            <input type="text" className="client-input" defaultValue="BBAKAZ22" required />
                                        </div>
                                        <div className="client-input-group full-width">
                                            <label>IBAN (International Bank Account Number)</label>
                                            <input type="text" className="client-input" defaultValue="AZ43 BBAK 0000 0000 1234 5678 90" required />
                                        </div>
                                    </div>
                                </div>
                                <div className="info-alert" style={{ marginTop: '24px' }}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                    <span>Payouts are processed automatically on the 1st of every month for cleared balances over €100. Ensure your details are accurate to avoid delays.</span>
                                </div>
                            </form>
                        </div>

                        <div className="modal-footer">
                            <button type="button" className="btn-modal-secondary" onClick={() => setIsPayoutModalOpen(false)} disabled={isSaving}>Cancel</button>
                            <button type="submit" form="payoutForm" className="btn-modal-primary" disabled={isSaving}>
                                {isSaving ? 'Verifying...' : 'Save Bank Details'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}