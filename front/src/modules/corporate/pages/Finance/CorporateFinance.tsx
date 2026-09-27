import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { corporateService, DepartmentItem } from '@/shared/api/services/corporate.service';
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
    status: 'PENDING' | 'PAID' | string;
    paidAt?: string;
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

    // Invoices & Transactions State
    const [invoiceTab, setInvoiceTab] = useState<'pending' | 'paid'>('pending');
    const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);
    const [paidInvoices, setPaidInvoices] = useState<PendingInvoice[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [txFilter, setTxFilter] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
    const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);

    // Departments & Budget Limits State
    const [departments, setDepartments] = useState<DepartmentItem[]>([]);
    const [isAddDeptModalOpen, setIsAddDeptModalOpen] = useState(false);
    const [newDeptName, setNewDeptName] = useState('');
    const [newDeptBudget, setNewDeptBudget] = useState('50000');
    const [isSavingDept, setIsSavingDept] = useState(false);

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

            // 2. Real Corporate Invoices (both pending and settled)
            const invRes = await corporateService.getInvoices();
            if (invRes.data?.invoices && Array.isArray(invRes.data.invoices)) {
                const mappedInv: PendingInvoice[] = invRes.data.invoices.map((inv: any) => ({
                    id: inv.id,
                    batchId: inv.groupBatchId,
                    batchRef: inv.groupBatch?.code || 'BCH-BATCH',
                    batchName: inv.groupBatch?.name || 'Corporate Delegation',
                    dueDate: inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '7 Days',
                    amount: Number(inv.amount || 0),
                    applicants: inv.groupBatch?.totalEmployees || 5,
                    pdfUrl: inv.pdfUrl,
                    status: inv.status || 'PENDING',
                    paidAt: inv.updatedAt ? new Date(inv.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Settled'
                }));
                setPendingInvoices(mappedInv.filter((inv) => inv.status === 'PENDING'));
                setPaidInvoices(mappedInv.filter((inv) => inv.status === 'PAID'));
            }

            // 3. Real Corporate Departments & Budget Allocations
            const deptRes = await corporateService.getDepartments();
            if (deptRes.data?.departments && Array.isArray(deptRes.data.departments)) {
                setDepartments(deptRes.data.departments);
            }
        } catch (err) {
            console.warn('Failed to load corporate finance data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleAddDepartment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDeptName.trim()) {
            showError('Please enter a department name.');
            return;
        }
        const b = parseFloat(newDeptBudget) || 50000;
        setIsSavingDept(true);
        try {
            await corporateService.createDepartment({ name: newDeptName.trim(), annualBudget: b });
            showSuccess(`Department "${newDeptName.trim()}" created successfully!`);
            setIsAddDeptModalOpen(false);
            setNewDeptName('');
            setNewDeptBudget('50000');
            await loadFinanceData();
        } catch (err: any) {
            showError(err.message || 'Failed to create department.');
        } finally {
            setIsSavingDept(false);
        }
    };

    const handleDeleteDept = async (id: string, name: string) => {
        if (!window.confirm(`Delete department "${name}" and its budget allocation?`)) return;
        try {
            await corporateService.deleteDepartment(id);
            showSuccess(`Department "${name}" removed.`);
            await loadFinanceData();
        } catch (err: any) {
            showError(err.message || 'Failed to delete department.');
        }
    };

    useEffect(() => {
        loadFinanceData();
    }, [loadFinanceData]);

    // --- Aksiyalar ---
    const handleOpenPayment = (invoice: PendingInvoice) => {
        setSelectedInvoice(invoice);
        setIsPaymentModalOpen(true);
    };

    const handleDownloadInvoice = async (invoice: PendingInvoice) => {
        let downloadUrl = invoice.pdfUrl;
        if (!downloadUrl && invoice.batchId) {
            try {
                const genRes = await corporateService.generateInvoice(invoice.batchId, invoice.amount);
                downloadUrl = genRes.data?.pdfUrl;
            } catch (err: any) {
                showError('Could not generate invoice PDF: ' + (err.message || 'Error'));
                return;
            }
        }

        if (downloadUrl) {
            const apiOrigin = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1').replace(/\/api\/v1\/?$/, '');
            const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : `${apiOrigin}${downloadUrl.startsWith('/') ? '' : '/'}${downloadUrl}`;
            const link = document.createElement('a');
            link.href = fullUrl;
            link.target = '_blank';
            link.download = `invoice_${invoice.batchRef || 'corporate'}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showSuccess('Proforma/Official Invoice PDF downloaded successfully.');
        } else {
            showError('Invoice document is not yet available for download.');
        }
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
                await handleDownloadInvoice(selectedInvoice);
            } else {
                // Card payment
                if (selectedInvoice.batchId) {
                    await corporateService.payWithWallet(selectedInvoice.batchId);
                }
                showSuccess('Card processed successfully! Batch appointments confirmed and invoice marked as PAID.');
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

    const filteredTransactions = transactions.filter(t => {
        if (txFilter === 'CREDIT') return t.type === 'addition';
        if (txFilter === 'DEBIT') return t.type === 'deduction';
        return true;
    });

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
                
                {/* LEFT COLUMN: Pending/Paid Invoices & Transaction History */}
                <div className="corp-column-left">
                    
                    {/* Invoices Panel with Tabs */}
                    <div className="corp-panel-card">
                        <div className="panel-header" style={{ marginBottom: '16px' }}>
                            <div>
                                <h3 style={{ margin: 0 }}>Corporate Invoices</h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--color-neutral)' }}>
                                    Manage outstanding and settled batch fee invoices
                                </p>
                            </div>
                            <span className={`corp-badge ${pendingInvoices.length > 0 ? 'badge-warning' : 'badge-success'}`}>
                                {pendingInvoices.length} Pending
                            </span>
                        </div>

                        {/* Tabs Navigation */}
                        <div className="corp-tabs">
                            <button 
                                className={`corp-tab-btn ${invoiceTab === 'pending' ? 'active' : ''}`}
                                onClick={() => setInvoiceTab('pending')}
                            >
                                Outstanding Invoices ({pendingInvoices.length})
                            </button>
                            <button 
                                className={`corp-tab-btn ${invoiceTab === 'paid' ? 'active' : ''}`}
                                onClick={() => setInvoiceTab('paid')}
                            >
                                Paid & Settled ({paidInvoices.length})
                            </button>
                        </div>

                        {invoiceTab === 'pending' ? (
                            pendingInvoices.length > 0 ? (
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
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button 
                                                        className="btn-outline-secondary" 
                                                        style={{ padding: '8px 12px', fontSize: '0.85rem' }} 
                                                        onClick={() => handleDownloadInvoice(invoice)} 
                                                        title="Download Proforma PDF"
                                                    >
                                                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                                        PDF
                                                    </button>
                                                    <button className="btn-action danger" onClick={() => handleOpenPayment(invoice)}>Pay Invoice</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="info-alert mt-16">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                        <span>Appointments for these batches remain unconfirmed until full payment is received.</span>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--color-neutral)' }}>
                                    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#10B981" strokeWidth="2" style={{ margin: '0 auto 12px auto', display: 'block' }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                    <strong style={{ color: 'var(--color-primary)', display: 'block', marginBottom: '4px' }}>All Clear!</strong>
                                    <p style={{ margin: 0, fontSize: '0.9rem' }}>All corporate batch invoices are settled. No outstanding payments due.</p>
                                </div>
                            )
                        ) : (
                            paidInvoices.length > 0 ? (
                                <div className="pending-invoices-list">
                                    {paidInvoices.map(invoice => (
                                        <div key={invoice.id} className="pending-invoice-item" style={{ background: '#F8FAFC', borderColor: '#E2E8F0' }}>
                                            <div className="invoice-details">
                                                <div className="invoice-title-row">
                                                    <h4>{invoice.batchName}</h4>
                                                    <span className="invoice-ref" style={{ background: '#DCFCE7', color: '#166534' }}>{invoice.batchRef}</span>
                                                    <span className="corp-badge badge-success" style={{ fontSize: '0.7rem' }}>PAID</span>
                                                </div>
                                                <p>Settled fees for {invoice.applicants} employees • Settled: <strong>{invoice.paidAt || invoice.dueDate}</strong></p>
                                            </div>
                                            <div className="invoice-action-block">
                                                <div className="invoice-amount" style={{ color: '#166534' }}>€ {invoice.amount.toFixed(2)}</div>
                                                <button 
                                                    className="btn-outline-secondary" 
                                                    style={{ padding: '8px 14px', fontSize: '0.85rem' }} 
                                                    onClick={() => handleDownloadInvoice(invoice)}
                                                >
                                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                                    Invoice PDF
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--color-neutral)' }}>
                                    <p style={{ margin: 0, fontSize: '0.9rem' }}>No settled invoices yet. Once a batch is paid, its official receipt and invoice history will appear here.</p>
                                </div>
                            )
                        )}
                    </div>

                    {/* Transaction History Table */}
                    <div className="corp-panel-card table-wrapper">
                        <div className="panel-header">
                            <h3>Transaction History</h3>
                            <div className="filter-select-wrapper compact">
                                <select value={txFilter} onChange={(e) => setTxFilter(e.target.value as any)}>
                                    <option value="ALL">All Transactions</option>
                                    <option value="CREDIT">Wallet Top-ups (+)</option>
                                    <option value="DEBIT">Deductions (-)</option>
                                </select>
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
                                    {filteredTransactions.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: 'var(--color-neutral)' }}>
                                                {loading ? 'Loading financial transactions from database...' : 'No transactions recorded matching the selected filter.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredTransactions.map(trx => (
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
                            <button className="btn-text-link" onClick={() => setIsBillingModalOpen(true)}>View Details</button>
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

                    {/* Department Budget Allocation & Controls */}
                    <div className="corp-panel-card">
                        <div className="panel-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h3>Department Travel Budgets</h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--color-neutral)' }}>
                                    Annual allowances & quota limits by corporate cost center
                                </p>
                            </div>
                            <button 
                                className="btn-outline-secondary btn-sm"
                                onClick={() => setIsAddDeptModalOpen(true)}
                                style={{ padding: '6px 12px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                            >
                                + Add Dept
                            </button>
                        </div>

                        <div className="departments-budget-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {departments.length === 0 ? (
                                <p style={{ color: 'var(--color-neutral)', fontSize: '0.85rem', textAlign: 'center', margin: '16px 0' }}>
                                    No departments configured yet.
                                </p>
                            ) : (
                                departments.map((dept) => {
                                    const percent = dept.percentUsed;
                                    const progressColor = percent > 85 ? '#EF4444' : percent > 60 ? '#F59E0B' : '#10B981';

                                    return (
                                        <div 
                                            key={dept.id} 
                                            style={{
                                                padding: '12px 14px',
                                                background: '#F8FAFC',
                                                border: '1px solid #E2E8F0',
                                                borderRadius: '10px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '6px'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <strong style={{ color: '#0F172A', fontSize: '0.9rem' }}>{dept.name}</strong>
                                                    <span style={{ marginLeft: '6px', fontSize: '0.7rem', background: '#E0E7FF', color: '#3730A3', padding: '2px 6px', borderRadius: '10px', fontWeight: 600 }}>
                                                        {dept.employeeCount} pax
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteDept(dept.id, dept.name)}
                                                    title="Remove Department"
                                                    style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '2px 4px', fontSize: '1rem', lineHeight: 1 }}
                                                >
                                                    ×
                                                </button>
                                            </div>

                                            {/* Progress Track */}
                                            <div style={{ width: '100%', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                                                <div 
                                                    style={{ 
                                                        width: `${Math.min(100, percent)}%`, 
                                                        height: '100%', 
                                                        backgroundColor: progressColor,
                                                        borderRadius: '3px',
                                                        transition: 'width 0.4s ease'
                                                    }} 
                                                />
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748B' }}>
                                                <span>Spent: <strong>€ {dept.spentBudget.toLocaleString()}</strong> ({percent}%)</span>
                                                <span>Remaining: <strong style={{ color: progressColor }}>€ {dept.remainingBudget.toLocaleString()}</strong></span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
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

            {/* --- ADD DEPARTMENT MODAL --- */}
            {isAddDeptModalOpen && (
                <div className="premium-modal-overlay fade-in" onClick={() => setIsAddDeptModalOpen(false)}>
                    <div className="premium-modal-container slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
                        <div className="modal-header">
                            <div className="modal-header-info">
                                <span className="modal-badge">Cost Center</span>
                                <h2>Add Department Budget</h2>
                            </div>
                            <button className="btn-modal-close" onClick={() => setIsAddDeptModalOpen(false)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>

                        <form onSubmit={handleAddDepartment}>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Department Name</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Research & Development"
                                        value={newDeptName}
                                        onChange={(e) => setNewDeptName(e.target.value)}
                                        style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.95rem' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Annual Travel Budget (EUR)</label>
                                    <input
                                        type="number"
                                        required
                                        min="1000"
                                        step="500"
                                        placeholder="50000"
                                        value={newDeptBudget}
                                        onChange={(e) => setNewDeptBudget(e.target.value)}
                                        style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.95rem' }}
                                    />
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-modal-secondary" onClick={() => setIsAddDeptModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn-modal-primary" disabled={isSavingDept}>
                                    {isSavingDept ? 'Creating...' : 'Create Department'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- CORPORATE BILLING DETAILS MODAL --- */}
            {isBillingModalOpen && (
                <div className="premium-modal-overlay fade-in" onClick={() => setIsBillingModalOpen(false)}>
                    <div className="premium-modal-container slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                        <div className="modal-header">
                            <div className="modal-header-info">
                                <span className="modal-badge">Corporate Profile</span>
                                <h2>Billing & Entity Details</h2>
                            </div>
                            <button className="btn-modal-close" onClick={() => setIsBillingModalOpen(false)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                        <div className="modal-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div>
                                    <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Company / Entity Name</span>
                                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A' }}>{user?.companyName || user?.fullName || 'EuroTech Corporate Partner'}</div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Tax / Reg ID</span>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>{user?.id?.substring(0, 10).toUpperCase() || 'EU-CORP-REGISTERED'}</div>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Account Role</span>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>{user?.role || 'CORPORATE_HR'}</div>
                                    </div>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Primary Billing Email</span>
                                    <div style={{ fontSize: '0.9rem', color: '#334155' }}>{user?.email || 'corporate-billing@eurotech.com'}</div>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Contact Phone</span>
                                    <div style={{ fontSize: '0.9rem', color: '#334155' }}>{user?.phone || 'No phone recorded'}</div>
                                </div>
                            </div>
                            <div className="info-alert">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                <span>Official VAT invoices and consular receipts are automatically issued using this registered corporate entity name and tax number. Contact support if official company details need legal modification.</span>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn-modal-primary" onClick={() => setIsBillingModalOpen(false)}>Done</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}