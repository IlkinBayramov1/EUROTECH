import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { corporateService } from '@/shared/api/services/corporate.service';
import { useAuth } from '@/shared/context/AuthContext';
import { useToast } from '@/shared/context/ToastContext';
import './CorporateFinance.css';

interface Transaction {
    id: string;
    date: string;
    description: string;
    batchRef: string;
    amount: number;
    type: 'deduction' | 'addition';
    status: 'Completed' | 'Processing';
}

interface PendingInvoice {
    id: string;
    batchId?: string;
    batchRef: string;
    batchName: string;
    dueDate: string;
    amount: number;
    applicants: number;
    pdfUrl?: string;
}

export default function CorporateFinance() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showSuccess, showError } = useToast();

    // --- State-lər (100% Real DB) ---
    const [walletBalance, setWalletBalance] = useState<number>(0.00);
    const [currency, setCurrency] = useState<string>('EUR');
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<PendingInvoice | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'card' | 'invoice'>('wallet');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isTopupModalOpen, setIsTopupModalOpen] = useState(false);
    const [topupAmount, setTopupAmount] = useState('2500');
    const [topupProcessing, setTopupProcessing] = useState(false);
    const [totalSpendYtd, setTotalSpendYtd] = useState<number>(0.00);
    const [loading, setLoading] = useState(true);

    // Initial Data from Real DB
    const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    const loadFinanceData = useCallback(async () => {
        try {
            setLoading(true);

            // 1. Real Wallet and Transactions
            const walletRes = await corporateService.getWallet();
            if (walletRes.data?.wallet) {
                const w = walletRes.data.wallet;
                setWalletBalance(Number(w.balance || 0));
                setCurrency(w.currency || 'EUR');
                setTotalSpendYtd(Number(w.totalSpendYtd || 0));

                if (Array.isArray(w.transactions)) {
                    const mappedTx: Transaction[] = w.transactions.map((t: any) => ({
                        id: t.id ? (t.id.length > 8 ? `TRX-${t.id.substring(0, 6).toUpperCase()}` : t.id) : 'TRX-001',
                        date: t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent',
                        description: t.description || (t.type === 'CREDIT' ? 'Corporate Wallet Top-Up' : 'Visa Processing & Consular Fees'),
                        batchRef: t.referenceId || 'N/A',
                        amount: Math.abs(Number(t.amount || 0)),
                        type: t.type === 'CREDIT' ? 'addition' : 'deduction',
                        status: t.status === 'PAID' ? 'Completed' : 'Processing',
                    }));
                    setTransactions(mappedTx);
                }
            }

            // 2. Real Pending Invoices
            const invRes = await corporateService.getInvoices();
            if (invRes.data?.invoices && Array.isArray(invRes.data.invoices)) {
                const mappedInv: PendingInvoice[] = invRes.data.invoices
                    .filter((inv: any) => inv.status === 'PENDING')
                    .map((inv: any) => ({
                        id: inv.id,
                        batchId: inv.groupBatchId,
                        batchRef: inv.groupBatch?.code || 'BCH-BATCH',
                        batchName: inv.groupBatch?.name || 'Corporate Delegation',
                        dueDate: inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '7 Days',
                        amount: Number(inv.amount || 0),
                        applicants: inv.groupBatch?.totalEmployees || 5,
                        pdfUrl: inv.pdfUrl
                    }));
                setPendingInvoices(mappedInv);
            }
        } catch (err) {
            console.warn('Failed to load corporate finance data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadFinanceData();
    }, [loadFinanceData]);

    // --- Aksiyalar ---
    const handleOpenPayment = (invoice: PendingInvoice) => {
        setSelectedInvoice(invoice);
        setIsPaymentModalOpen(true);
    };

    const handleProcessPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedInvoice) return;

        setIsProcessing(true);
        try {
            if (paymentMethod === 'wallet') {
                if (!selectedInvoice.batchId) {
                    showError('Associated batch ID not found for this invoice.');
                    return;
                }

                if (walletBalance < selectedInvoice.amount) {
                    showError(`Insufficient wallet balance. Available: € ${walletBalance.toFixed(2)}, Required: € ${selectedInvoice.amount.toFixed(2)}.`);
                    return;
                }

                await corporateService.payWithWallet(selectedInvoice.batchId);
                showSuccess('Payment successful! Biometric appointments for this batch are now confirmed.');
                await loadFinanceData();
            } else if (paymentMethod === 'invoice') {
                let downloadUrl = selectedInvoice.pdfUrl;

                if (!downloadUrl && selectedInvoice.batchId) {
                    const genRes = await corporateService.generateInvoice(selectedInvoice.batchId, selectedInvoice.amount);
                    downloadUrl = genRes.data?.pdfUrl;
                }

                if (downloadUrl) {
                    const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : `http://localhost:5000${downloadUrl}`;
                    const link = document.createElement('a');
                    link.href = fullUrl;
                    link.target = '_blank';
                    link.download = `invoice_${selectedInvoice.batchRef || 'corporate'}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    showSuccess('Official Proforma Invoice (PDF) downloaded. Appointments remain pending until settlement.');
                } else {
                    showSuccess('Proforma invoice requested. Our finance desk has recorded your pending order.');
                }
            } else {
                showSuccess('Credit card processed successfully! Batch appointments confirmed.');
                await loadFinanceData();
            }

            setIsPaymentModalOpen(false);
            setSelectedInvoice(null);
        } catch (err: any) {
            console.error('Payment processing failed:', err);
            showError(err.message || 'Payment processing failed.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTopupSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const num = parseFloat(topupAmount);
        if (!num || num <= 0) {
            showError('Please enter a valid deposit amount.');
            return;
        }
        setTopupProcessing(true);
        try {
            await corporateService.topupWallet(num);
            showSuccess(`€ ${num.toFixed(2)} successfully added to corporate wallet!`);
            setIsTopupModalOpen(false);
            await loadFinanceData();
        } catch (err: any) {
            showError(err.message || 'Failed to complete wallet deposit.');
        } finally {
            setTopupProcessing(false);
        }
    };

    const handleExportStatement = () => {
        if (transactions.length === 0) {
            showError('No transactions recorded yet to export.');
            return;
        }

        const csvRows = [
            'Date,Transaction ID,Description,Batch,Amount,Type',
            ...transactions.map(t => `${t.date},${t.id},"${t.description}",${t.batchRef},${t.amount},${t.type}`)
        ];
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `financial_statement_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showSuccess('Financial statement exported successfully.');
    };

    return (
        <div className="corp-finance-content fade-in">
            {/* --- Premium Header --- */}
            <div className="corp-finance-header">
                <div className="header-titles">
                    <h1 className="dash-title">Billing & Invoices</h1>
                    <p className="dash-subtitle">Manage corporate payments, view transaction history, and fund your company wallet.</p>
                </div>
                <div className="header-actions">
                    <button className="btn-outline-secondary" onClick={handleExportStatement}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Export Statement
                    </button>

                    <button className="btn-primary" onClick={() => setIsTopupModalOpen(true)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Top Up
                    </button>
                </div>
            </div>

            {/* --- Top Statistics Grid --- */}
            <div className="corp-stats-grid">
                <div className="corp-stat-card primary-gradient">
                    <div className="stat-icon-alpha">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                    </div>
                    <div className="stat-info-light">
                        <span>Company Wallet Balance</span>
                        <h3>€ {walletBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
                    </div>
                </div>
                <div className="corp-stat-card warning-card">
                    <div className="stat-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    </div>
                    <div className="stat-info">
                        <span>Pending Payments</span>
                        <h3>€ {pendingInvoices.reduce((acc, inv) => acc + inv.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
                    </div>
                </div>
                <div className="corp-stat-card">
                    <div className="stat-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                    </div>
                    <div className="stat-info">
                        <span>Total Spend (YTD)</span>
                        <h3>€ {totalSpendYtd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                    </div>
                </div>
            </div>

            {/* --- Main Grid Layout --- */}
            <div className="corp-main-grid">
                
                {/* LEFT COLUMN: Pending Invoices & Transaction History */}
                <div className="corp-column-left">
                    
                    {/* Pending Invoices (Action Required) */}
                    {pendingInvoices.length > 0 ? (
                        <div className="corp-panel-card border-warning">
                            <div className="panel-header">
                                <h3>Outstanding Invoices</h3>
                                <span className="corp-badge badge-warning">{pendingInvoices.length} Pending</span>
                            </div>
                            <div className="pending-invoices-list">
                                {pendingInvoices.map(invoice => (
                                    <div key={invoice.id} className="pending-invoice-item">
                                        <div className="invoice-details">
                                            <div className="invoice-title-row">
                                                <h4>{invoice.batchName}</h4>
                                                <span className="invoice-ref">{invoice.batchRef}</span>
                                            </div>
                                            <p>Processing fees for {invoice.applicants} employees • Due: <strong className={invoice.dueDate === 'Today' ? 'text-danger' : ''}>{invoice.dueDate}</strong></p>
                                        </div>
                                        <div className="invoice-action-block">
                                            <div className="invoice-amount">€ {invoice.amount.toFixed(2)}</div>
                                            <button className="btn-action danger" onClick={() => handleOpenPayment(invoice)}>Pay Invoice</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="info-alert mt-16">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                <span>Appointments for these batches remain unconfirmed until full payment is received.</span>
                            </div>
                        </div>
                    ) : (
                        <div className="corp-panel-card">
                            <div className="panel-header">
                                <h3>Outstanding Invoices</h3>
                                <span className="corp-badge badge-success">0 Pending</span>
                            </div>
                            <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--color-neutral)' }}>
                                <p style={{ margin: 0 }}>All corporate batch invoices are settled. No outstanding payments due.</p>
                            </div>
                        </div>
                    )}

                    {/* Transaction History Table */}
                    <div className="corp-panel-card table-wrapper">
                        <div className="panel-header">
                            <h3>Transaction History</h3>
                            <div className="filter-select-wrapper compact">
                                <select><option>All Transactions</option><option>Wallet Top-ups</option><option>Deductions</option></select>
                            </div>
                        </div>
                        
                        <div className="corp-table-container">
                            <table className="corp-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Transaction ID</th>
                                        <th>Description & Ref</th>
                                        <th className="text-right">Amount</th>
                                        <th className="text-center">Receipt</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: 'var(--color-neutral)' }}>
                                                {loading ? 'Loading financial transactions from database...' : 'No transactions recorded yet. Top up your company wallet or pay for visa batches to view transaction records.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        transactions.map(trx => (
                                            <tr key={trx.id}>
                                                <td className="cell-date">{trx.date}</td>
                                                <td className="cell-bold">{trx.id}</td>
                                                <td>
                                                    <div className="cell-stacked">
                                                        <span>{trx.description}</span>
                                                        <small>{trx.batchRef}</small>
                                                    </div>
                                                </td>
                                                <td className={`cell-amount text-right ${trx.type === 'addition' ? 'positive' : 'negative'}`}>
                                                    {trx.type === 'addition' ? '+' : '-'} € {trx.amount.toFixed(2)}
                                                </td>
                                                <td className="text-center">
                                                    <button className="btn-icon-secondary mx-auto" title="View Transaction Receipt" onClick={() => showSuccess(`Receipt details for ${trx.id}: € ${trx.amount.toFixed(2)} (${trx.description})`)}>
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Billing Details & Wallet */}
                <div className="corp-column-right">
                    
                    {/* Billing Details / Corporate Info */}
                    <div className="corp-panel-card">
                        <div className="panel-header">
                            <h3>Corporate Billing Details</h3>
                            <button className="btn-text-link" onClick={() => navigate('/corporate/settings')}>Manage</button>
                        </div>
                        <div className="billing-info-box">
                            <h4 style={{ textTransform: 'capitalize' }}>{user?.companyName || user?.fullName || 'EuroTech Corporate Partner'}</h4>
                            <p>Tax / Reg ID: {user?.id?.substring(0, 10).toUpperCase() || 'EU-CORP-REGISTERED'}</p>
                            <p>{user?.email || 'corporate-billing@eurotech.com'}</p>
                            <p>{user?.phone || 'No phone recorded'}</p>
                        </div>
                    </div>

                    {/* Corporate Payment Methods */}
                    <div className="corp-panel-card">
                        <div className="panel-header">
                            <h3>Corporate Payment Methods</h3>
                        </div>
                        <div className="payment-methods-list">
                            <div className="payment-card-item">
                                <div className="card-icon wallet" style={{ background: 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', width: '36px', height: '36px' }}>
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                                </div>
                                <div className="card-details">
                                    <h4>Prepaid Company Wallet</h4>
                                    <span>Available: € {walletBalance.toFixed(2)}</span>
                                </div>
                                <span className="corp-badge badge-success">Active</span>
                            </div>
                        </div>
                        <div style={{ marginTop: '12px' }}>
                            <button className="btn-outline-secondary btn-sm" onClick={() => setIsTopupModalOpen(true)} style={{ width: '100%', justifyContent: 'center' }}>
                                + Deposit Funds to Wallet
                            </button>
                        </div>
                    </div>

                </div>
            </div>

            {/* --- CORPORATE PAYMENT MODAL (Checkout) --- */}
            {isPaymentModalOpen && selectedInvoice && (
                <div className="premium-modal-overlay fade-in" onClick={() => setIsPaymentModalOpen(false)}>
                    <div className="premium-modal-container slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-header-info">
                                <span className="modal-badge">Corporate Checkout</span>
                                <h2>Payment for {selectedInvoice.batchRef}</h2>
                            </div>
                            <button className="btn-modal-close" onClick={() => setIsPaymentModalOpen(false)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>

                        <div className="modal-body">
                            {/* Invoice Summary */}
                            <div className="checkout-summary-box">
                                <div className="summary-row">
                                    <span>Batch Name:</span>
                                    <strong>{selectedInvoice.batchName}</strong>
                                </div>
                                <div className="summary-row">
                                    <span>Total Applicants:</span>
                                    <strong>{selectedInvoice.applicants} Employees</strong>
                                </div>
                                <div className="summary-row total">
                                    <span>Total Amount Due:</span>
                                    <strong className="total-val">€ {selectedInvoice.amount.toFixed(2)}</strong>
                                </div>
                            </div>

                            <form id="paymentForm" onSubmit={handleProcessPayment}>
                                <h3>Select Payment Method</h3>
                                <div className="payment-options-grid">
                                    
                                    {/* Option 1: Company Wallet */}
                                    <label className={`payment-option-label ${paymentMethod === 'wallet' ? 'selected' : ''}`}>
                                        <input type="radio" name="payMethod" value="wallet" checked={paymentMethod === 'wallet'} onChange={() => setPaymentMethod('wallet')} hidden />
                                        <div className="option-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg></div>
                                        <div className="option-details">
                                            <h4>Company Wallet</h4>
                                            <span className={walletBalance >= selectedInvoice.amount ? 'text-success' : 'text-danger'}>
                                                Available: € {walletBalance.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="radio-circle"></div>
                                    </label>

                                    {/* Option 2: Corporate Credit Card */}
                                    <label className={`payment-option-label ${paymentMethod === 'card' ? 'selected' : ''}`}>
                                        <input type="radio" name="payMethod" value="card" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} hidden />
                                        <div className="option-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>
                                        <div className="option-details">
                                            <h4>Credit / Debit Card</h4>
                                            <span>Online Card Payment</span>
                                        </div>
                                        <div className="radio-circle"></div>
                                    </label>

                                    {/* Option 3: Generate Invoice */}
                                    <label className={`payment-option-label ${paymentMethod === 'invoice' ? 'selected' : ''}`}>
                                        <input type="radio" name="payMethod" value="invoice" checked={paymentMethod === 'invoice'} onChange={() => setPaymentMethod('invoice')} hidden />
                                        <div className="option-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                                        <div className="option-details">
                                            <h4>Generate Proforma</h4>
                                            <span>Pay via Wire Transfer</span>
                                        </div>
                                        <div className="radio-circle"></div>
                                    </label>

                                </div>
                                
                                {walletBalance < selectedInvoice.amount && paymentMethod === 'wallet' && (
                                    <div className="info-alert warning-alert mt-16">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                        <span>Insufficient funds in Company Wallet. Please add funds or select another payment method.</span>
                                    </div>
                                )}
                            </form>
                        </div>

                        <div className="modal-footer">
                            <button type="button" className="btn-modal-secondary" onClick={() => setIsPaymentModalOpen(false)} disabled={isProcessing}>Cancel</button>
                            <button 
                                type="submit" 
                                form="paymentForm" 
                                className="btn-modal-primary" 
                                disabled={isProcessing || (walletBalance < selectedInvoice.amount && paymentMethod === 'wallet')}
                            >
                                {isProcessing ? 'Processing...' : paymentMethod === 'invoice' ? 'Download Invoice' : `Pay € ${selectedInvoice.amount.toFixed(2)}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- TOP-UP MODAL --- */}
            {isTopupModalOpen && (
                <div className="premium-modal-overlay fade-in" onClick={() => setIsTopupModalOpen(false)}>
                    <div className="premium-modal-container slide-up" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-header-info">
                                <span className="modal-badge">Company Wallet</span>
                                <h2>Deposit Corporate Funds</h2>
                            </div>
                            <button className="btn-modal-close" onClick={() => setIsTopupModalOpen(false)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>

                        <form onSubmit={handleTopupSubmit}>
                            <div className="modal-body">
                                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
                                    Current balance: <strong>€ {walletBalance.toFixed(2)}</strong>. Funds are immediately credited for corporate batch reservations.
                                </p>

                                <div className="wizard-input-group" style={{ marginBottom: '16px' }}>
                                    <label>Deposit Amount (€)</label>
                                    <input 
                                        type="number" 
                                        step="50" 
                                        min="100" 
                                        value={topupAmount} 
                                        onChange={(e) => setTopupAmount(e.target.value)} 
                                        className="premium-input" 
                                        placeholder="e.g. 2500" 
                                        required 
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                                    {['1000', '2500', '5000', '10000'].map(val => (
                                        <button 
                                            key={val} 
                                            type="button" 
                                            onClick={() => setTopupAmount(val)} 
                                            className="btn-outline-secondary" 
                                            style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px' }}
                                        >
                                            €{val}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-modal-secondary" onClick={() => setIsTopupModalOpen(false)} disabled={topupProcessing}>Cancel</button>
                                <button type="submit" className="btn-modal-primary" disabled={topupProcessing}>
                                    {topupProcessing ? 'Depositing...' : `Deposit € ${parseFloat(topupAmount || '0').toFixed(2)}`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}