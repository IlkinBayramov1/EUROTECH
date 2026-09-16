import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { corporateService } from '@/shared/api/services/corporate.service';
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

    // --- State-lər ---
    const [walletBalance, setWalletBalance] = useState(12500.00);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<PendingInvoice | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'card' | 'invoice'>('wallet');
    const [isProcessing, setIsProcessing] = useState(false);

    // Initial Data
    const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([
        { id: 'INV-2026-9012', batchRef: 'BCH-2026-101', batchName: 'Vienna Summit Delegation', dueDate: 'Today', amount: 1450.00, applicants: 12 },
        { id: 'INV-2026-9015', batchRef: 'BCH-2026-102', batchName: 'Executive Retreat Paris', dueDate: 'Sep 10, 2026', amount: 480.00, applicants: 4 }
    ]);

    const [transactions, setTransactions] = useState<Transaction[]>([
        { id: 'TRX-1102', date: 'Sep 05, 2026', description: 'Wallet Top-Up (Wire Transfer)', batchRef: 'N/A', amount: 5000.00, type: 'addition', status: 'Completed' },
        { id: 'TRX-1101', date: 'Sep 02, 2026', description: 'Visa Processing & Consular Fees', batchRef: 'BCH-2026-098', amount: 360.00, type: 'deduction', status: 'Completed' },
        { id: 'TRX-1095', date: 'Aug 28, 2026', description: 'Visa Processing & Consular Fees', batchRef: 'BCH-2026-095', amount: 600.00, type: 'deduction', status: 'Completed' },
    ]);

    useEffect(() => {
        async function loadInvoices() {
            try {
                const res = await corporateService.getInvoices();
                if (res.data?.invoices && res.data.invoices.length > 0) {
                    const mapped: PendingInvoice[] = res.data.invoices
                        .filter((inv: any) => inv.status === 'PENDING')
                        .map((inv: any) => ({
                            id: inv.id,
                            batchId: inv.groupBatchId,
                            batchRef: inv.groupBatch?.code || 'BCH-BATCH',
                            batchName: inv.groupBatch?.name || 'Corporate Delegation',
                            dueDate: inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '7 Days',
                            amount: Number(inv.amount || 1450),
                            applicants: inv.groupBatch?.totalEmployees || 5,
                            pdfUrl: inv.pdfUrl
                        }));
                    if (mapped.length > 0) {
                        setPendingInvoices(mapped);
                    }
                }
            } catch (err) {
                console.warn('Failed to load corporate invoices:', err);
            }
        }
        loadInvoices();
    }, []);

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
                if (selectedInvoice.batchId) {
                    const res = await corporateService.payWithWallet(selectedInvoice.batchId);
                    if (res.data?.newWalletBalance !== undefined) {
                        setWalletBalance(res.data.newWalletBalance);
                    } else {
                        setWalletBalance(prev => prev - selectedInvoice.amount);
                    }
                } else {
                    setWalletBalance(prev => prev - selectedInvoice.amount);
                }

                setTransactions(prev => [{
                    id: `TRX-${Math.floor(1000 + Math.random() * 9000)}`,
                    date: 'Today',
                    description: `Visa Processing & Consular Fees: ${selectedInvoice.batchName}`,
                    batchRef: selectedInvoice.batchRef,
                    amount: selectedInvoice.amount,
                    type: 'deduction',
                    status: 'Completed'
                }, ...prev]);

                setPendingInvoices(prev => prev.filter(inv => inv.id !== selectedInvoice.id));
                alert('Payment successful! Appointments for this batch have been confirmed.');
            } else if (paymentMethod === 'invoice') {
                if (selectedInvoice.pdfUrl) {
                    const downloadUrl = selectedInvoice.pdfUrl.startsWith('http')
                        ? selectedInvoice.pdfUrl
                        : `http://localhost:5000${selectedInvoice.pdfUrl}`;
                    window.open(downloadUrl, '_blank');
                } else {
                    const invoiceData = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n5 0 obj\n<< /Length 320 >>\nstream\nBT /F1 11 Tf 40 760 Td 15 TL (EUROTECH CORPORATE PROFORMA INVOICE) Tj T* (=============================================) Tj T* (Invoice Ref: ${selectedInvoice.id}) Tj T* (Batch: ${selectedInvoice.batchRef} - ${selectedInvoice.batchName}) Tj T* (Applicants: ${selectedInvoice.applicants}) Tj T* (Total Amount Due: EUR ${selectedInvoice.amount.toFixed(2)}) Tj T* (Due Date: ${selectedInvoice.dueDate}) Tj T* (Status: PENDING PAYMENT) Tj ET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000227 00000 n \n0000000300 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n670\n%%EOF`;
                    const blob = new Blob([invoiceData], { type: 'application/pdf' });
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = `invoice_${selectedInvoice.id}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                }
                alert('Proforma Invoice (PDF) downloaded. Appointments remain pending until wire transfer clears.');
            } else {
                setPendingInvoices(prev => prev.filter(inv => inv.id !== selectedInvoice.id));
                alert('Payment successful! Appointments for this batch have been confirmed.');
            }

            setIsPaymentModalOpen(false);
            setSelectedInvoice(null);
        } catch (err: any) {
            console.error('Payment processing failed:', err);
            alert(err.message || 'Payment processing failed. Check wallet balance.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleExportStatement = () => {
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

                    <button className="btn-primary" onClick={() => {
                        const topUp = prompt('Enter top-up deposit amount (€):', '2500');
                        if (topUp && !isNaN(Number(topUp))) {
                            setWalletBalance(prev => prev + Number(topUp));
                            alert(`€ ${Number(topUp).toFixed(2)} added to corporate wallet.`);
                        }
                    }}>
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
                        <h3>€ 14,850.00</h3>
                    </div>
                </div>
            </div>

            {/* --- Main Grid Layout --- */}
            <div className="corp-main-grid">
                
                {/* LEFT COLUMN: Pending Invoices & Transaction History */}
                <div className="corp-column-left">
                    
                    {/* Pending Invoices (Action Required) */}
                    {pendingInvoices.length > 0 && (
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
                                    {transactions.map(trx => (
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
                                                <button className="btn-icon-secondary mx-auto" title="View Transaction Receipt" onClick={() => alert(`Receipt details for ${trx.id}: € ${trx.amount.toFixed(2)} (${trx.description})`)}>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
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
                            <button className="btn-text-link">Edit</button>
                        </div>
                        <div className="billing-info-box">
                            <h4>Tech Innovators LLC</h4>
                            <p>VAT: ATU12345678</p>
                            <p>123 Innovation Drive, Tech Park<br/>1010 Vienna, Austria</p>
                            <p>billing@techinnovators.com</p>
                        </div>
                    </div>

                    {/* Saved Payment Methods */}
                    <div className="corp-panel-card">
                        <div className="panel-header">
                            <h3>Saved Payment Methods</h3>
                            <button className="btn-text-link">Add Card</button>
                        </div>
                        <div className="payment-methods-list">
                            <div className="payment-card-item">
                                <div className="card-icon visa">
                                    {/* Simulated Visa Icon */}
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                                </div>
                                <div className="card-details">
                                    <h4>Corporate Visa</h4>
                                    <span>**** **** **** 4242</span>
                                </div>
                                <span className="corp-badge badge-success">Primary</span>
                            </div>
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
                                            <h4>Corporate Visa</h4>
                                            <span>Ending in 4242</span>
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
        </div>
    );
}