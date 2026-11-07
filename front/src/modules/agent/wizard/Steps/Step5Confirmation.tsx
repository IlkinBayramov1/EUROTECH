import React from 'react';

interface Step5Props {
    data: {
        country: string;
        duration: string;
        travelDate: string;
        groupName: string;
        applicants: any[];
        services: { activePackage: string };
        appointmentDate: string;
        appointmentTime: string;
    };
    walletBalance?: number;
    agentTier?: string;
    ratePerPax?: number;
    settlementOption?: 'WALLET_NOW' | 'INVOICE_LATER';
    onChangeSettlementOption?: (opt: 'WALLET_NOW' | 'INVOICE_LATER') => void;
}

export default function Step5Confirmation({
    data,
    walletBalance = 0,
    agentTier = 'BRONZE',
    ratePerPax = 20,
    settlementOption = 'INVOICE_LATER',
    onChangeSettlementOption,
}: Step5Props) {
    const groupSize = Math.max(data.applicants.length, 1);
    const consularFeePP = 145.0; // €80 Gov + €65 B2B Consular Processing

    let serviceFeePP = 0;
    let packageName = 'Standard Processing';

    if (data.services.activePackage === 'premium') {
        serviceFeePP = 126.0;
        packageName = 'Premium Bundle';
    } else if (data.services.activePackage === 'vip') {
        serviceFeePP = 257.0;
        packageName = 'VIP Platinum';
    }

    const totalConsular = consularFeePP * groupSize;
    const totalServices = serviceFeePP * groupSize;
    const grandTotal = totalConsular + totalServices;
    const grandTotalAzn = grandTotal * 1.85;
    const estimatedCommission = ratePerPax * groupSize;
    const canPayFromWallet = walletBalance >= grandTotal;

    return (
        <div className="step-content fade-in">
            {/* Header Section */}
            <div className="confirmation-header-alt">
                <div className="success-icon-alt" style={{ backgroundColor: '#EFF6FF', color: '#2563EB', boxShadow: '0 0 0 8px rgba(37, 99, 235, 0.1)' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <h1 className="step-title">Review & B2B Settlement</h1>
                <p className="step-subtitle">Review your delegation details and select whether to settle immediately from your Agency Wallet or generate a B2B group invoice.</p>
            </div>

            {/* Application & Appointment Summary Grid */}
            <div className="summary-cards-grid">
                <div className="summary-block">
                    <div className="summary-block-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        <h3>Group Overview</h3>
                    </div>
                    <div className="summary-block-content">
                        <div className="summary-row"><span>Group Reference</span> <strong>{data.groupName || 'N/A'}</strong></div>
                        <div className="summary-row"><span>Total Travelers</span> <strong>{groupSize} Applicant(s)</strong></div>
                        <div className="summary-row"><span>Destination</span> <strong>{data.country || 'N/A'}</strong></div>
                        <div className="summary-row"><span>Departure Date</span> <strong>{data.travelDate || 'N/A'}</strong></div>
                    </div>
                </div>

                <div className="summary-block">
                    <div className="summary-block-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <h3>Appointment Schedule</h3>
                    </div>
                    <div className="summary-block-content">
                        <div className="summary-row"><span>Date</span> <strong>{data.appointmentDate || 'Pending'}</strong></div>
                        <div className="summary-row"><span>Time Slot</span> <strong>{data.appointmentTime || 'Pending'}</strong></div>
                        <div className="summary-row"><span>Location</span> <strong>EuroTech Visa Center</strong></div>
                        <div className="summary-row">
                            <span>Status</span>
                            <strong style={{ color: settlementOption === 'WALLET_NOW' && canPayFromWallet ? '#059669' : '#D97706' }}>
                                {settlementOption === 'WALLET_NOW' && canPayFromWallet ? 'Instant Confirmation' : 'Awaiting Payment'}
                            </strong>
                        </div>
                    </div>
                </div>
            </div>

            {/* B2B Proforma Invoice */}
            <div className="financial-summary-box">
                <div className="finance-box-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>B2B Proforma Invoice (EUR)</h3>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#059669', background: '#ECFDF5', padding: '4px 10px', borderRadius: '999px' }}>
                        {agentTier} Reward: +€ {estimatedCommission.toFixed(2)} Commission
                    </span>
                </div>
                <div className="finance-box-body">
                    <div className="finance-row">
                        <span>Base Consular & B2B Fee (€ {consularFeePP.toFixed(2)} × {groupSize})</span>
                        <strong>€ {totalConsular.toFixed(2)}</strong>
                    </div>

                    <div className="finance-row">
                        <span>{packageName} (€ {serviceFeePP.toFixed(2)} × {groupSize})</span>
                        <strong>€ {totalServices.toFixed(2)}</strong>
                    </div>

                    <div className="finance-row" style={{ color: '#059669' }}>
                        <span>Partner Commission Credit ({agentTier} @ € {ratePerPax.toFixed(2)} × {groupSize})</span>
                        <strong>+€ {estimatedCommission.toFixed(2)} (upon settlement)</strong>
                    </div>

                    <div className="finance-row total">
                        <span>Total B2B Group Payable</span>
                        <div style={{ textAlign: 'right' }}>
                            <span className="total-amount">€ {grandTotal.toFixed(2)}</span>
                            <div style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 500 }}>
                                ≈ {grandTotalAzn.toFixed(2)} AZN
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Settlement Choice */}
            <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div
                    onClick={() => canPayFromWallet && onChangeSettlementOption?.('WALLET_NOW')}
                    style={{
                        padding: '16px 18px',
                        borderRadius: '12px',
                        border: settlementOption === 'WALLET_NOW' ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
                        background: !canPayFromWallet ? '#F8FAFC' : settlementOption === 'WALLET_NOW' ? '#EFF6FF' : '#FFFFFF',
                        opacity: canPayFromWallet ? 1 : 0.65,
                        cursor: canPayFromWallet ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s ease',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <strong style={{ color: '#0F1E36', fontSize: '0.95rem' }}>⚡ Pay Now from Agency Wallet</strong>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: canPayFromWallet ? '#059669' : '#DC2626' }}>
                            Balance: € {walletBalance.toFixed(2)}
                        </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748B' }}>
                        {canPayFromWallet
                            ? `Deducts € ${grandTotal.toFixed(2)} immediately, confirms consular slot, and credits € ${estimatedCommission.toFixed(2)} commission.`
                            : `Insufficient balance (need € ${grandTotal.toFixed(2)}). Select Group Invoice below to top up or pay by Card / Bank Slip.`}
                    </p>
                </div>

                <div
                    onClick={() => onChangeSettlementOption?.('INVOICE_LATER')}
                    style={{
                        padding: '16px 18px',
                        borderRadius: '12px',
                        border: settlementOption === 'INVOICE_LATER' ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
                        background: settlementOption === 'INVOICE_LATER' ? '#EFF6FF' : '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <strong style={{ color: '#0F1E36', fontSize: '0.95rem' }}>🧾 Generate Invoice & Pay in Finance</strong>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#2563EB' }}>Card / Wire / Wallet</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748B' }}>
                        Registers the group, records € {estimatedCommission.toFixed(2)} in Pending Clearing, and opens Group Invoices for settlement.
                    </p>
                </div>
            </div>
        </div>
    );
}
