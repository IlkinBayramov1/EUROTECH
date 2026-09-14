import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
    batchRef: string;
    batchName: string;
    dueDate: string;
    amount: number;
    applicants: number;
}

export default function CorporateFinance() {
    const navigate = useNavigate();

    // --- State-lər ---
    const [walletBalance, setWalletBalance] = useState(12500.00);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<PendingInvoice | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'card' | 'invoice'>('wallet');
    const [isProcessing, setIsProcessing] = useState(false);

    // Mock Data
    const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([
        { id: 'INV-2026-9012', batchRef: 'BCH-2026-101', batchName: 'Vienna Summit Delegation', dueDate: 'Today', amount: 1450.00, applicants: 12 },
        { id: 'INV-2026-9015', batchRef: 'BCH-2026-102', batchName: 'Executive Retreat Paris', dueDate: 'Sep 10, 2026', amount: 480.00, applicants: 4 }
    ]);

    const [transactions, setTransactions] = useState<Transaction[]>([
        { id: 'TRX-1102', date: 'Sep 05, 2026', description: 'Wallet Top-Up (Wire Transfer)', batchRef: 'N/A', amount: 5000.00, type: 'addition', status: 'Completed' },
        { id: 'TRX-1101', date: 'Sep 02, 2026', description: 'Visa Processing & Consular Fees', batchRef: 'BCH-2026-098', amount: 360.00, type: 'deduction', status: 'Completed' },
        { id: 'TRX-1095', date: 'Aug 28, 2026', description: 'Visa Processing & Consular Fees', batchRef: 'BCH-2026-095', amount: 600.00, type: 'deduction', status: 'Completed' },
    ]);

    // --- Aksiyalar ---
    const handleOpenPayment = (invoice: PendingInvoice) => {
        setSelectedInvoice(invoice);
        setIsPaymentModalOpen(true);
    };

    const handleProcessPayment = (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        
        setTimeout(() => {
            if (selectedInvoice && paymentMethod === 'wallet') {
                setWalletBalance(prev => prev - selectedInvoice.amount);
                
                // Add to transactions
                setTransactions(prev => [{
                    id: `TRX-${Math.floor(Math.random() * 10000)}`,
                    date: 'Just Now',
                    description: 'Visa Processing & Consular Fees',
                    batchRef: selectedInvoice.batchRef,
                    amount: selectedInvoice.amount,
                    type: 'deduction',
                    status: 'Completed'
                }, ...prev]);

                // Remove from pending
                setPendingInvoices(prev => prev.filter(inv => inv.id !== selectedInvoice.id));
            }
            
            setIsProcessing(false);
            setIsPaymentModalOpen(false);
            setSelectedInvoice(null);
            
            // Payment success alerts that appointments are confirmed
            if (paymentMethod === 'invoice') {
                alert('Proforma Invoice generated and downloaded. Appointments remain pending until wire transfer clears.');
            } else {
                alert('Payment successful! Appointments for this batch have been confirmed.');
            }
        }, 1500);
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
                    <button className="btn-outline-secondary">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Export Statement
                    </button>
                    <button className="btn-primary">
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
                                                <button className="btn-icon-secondary mx-auto">
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