import React from 'react';
import type { EmployeeData } from '../CorporateWizard';

interface Step5Props {
    data: {
        batchName: string;
        destination: string;
        travelDate: string;
        projectReason: string;
        employees: EmployeeData[];
        services: { activePackage: string };
        appointmentDate: string;
        appointmentTime: string;
    };
}

export default function Step5Confirmation({ data }: Step5Props) {
    const batchSize = Math.max(data.employees.length, 1);
    
    const consularFeePP = 145.00;
    let serviceFeePP = 0;
    let packageName = 'Standard Corporate Processing';
    
    if (data.services.activePackage === 'premium') {
        serviceFeePP = 126.00;
        packageName = 'Premium Business Bundle';
    } else if (data.services.activePackage === 'vip') {
        serviceFeePP = 257.00;
        packageName = 'VIP Executive Fast-Track';
    }

    const totalConsular = consularFeePP * batchSize;
    const totalServices = serviceFeePP * batchSize;
    const grandTotal = totalConsular + totalServices;

    return (
        <div className="step-content fade-in">
            <div className="confirmation-header-alt" style={{ textAlign: 'center', marginBottom: '32px' }}>
                <div className="success-icon-alt" style={{ backgroundColor: '#EFF6FF', color: '#1E3A8A', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', boxShadow: '0 0 0 8px rgba(30, 58, 138, 0.1)' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '32px', height: '32px' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <h1 className="step-title" style={{ color: 'var(--color-primary)', fontSize: '1.8rem', marginBottom: '8px' }}>Batch Initialization Complete</h1>
                <p className="step-subtitle" style={{ color: 'var(--color-neutral)' }}>Review the corporate dossier details below. A Proforma Invoice will be generated upon submission.</p>
            </div>

            <div className="summary-cards-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                {/* Left: Batch Info */}
                <div className="summary-block" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '24px' }}>
                    <div className="summary-block-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--color-border)', paddingBottom: '16px', marginBottom: '16px' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '20px', height: '20px', color: 'var(--color-secondary)' }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-primary)' }}>Batch Overview</h3>
                    </div>
                    <div className="summary-block-content" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-neutral)', fontSize: '0.9rem' }}>Batch Name</span> <strong style={{ color: 'var(--color-primary)' }}>{data.batchName || 'N/A'}</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-neutral)', fontSize: '0.9rem' }}>Destination</span> <strong style={{ color: 'var(--color-primary)' }}>{data.destination || 'N/A'}</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-neutral)', fontSize: '0.9rem' }}>Total Employees</span> <strong style={{ color: 'var(--color-primary)' }}>{batchSize}</strong></div>
                    </div>
                </div>

                {/* Right: Appointment Info */}
                <div className="summary-block" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '24px' }}>
                    <div className="summary-block-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--color-border)', paddingBottom: '16px', marginBottom: '16px' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '20px', height: '20px', color: 'var(--color-secondary)' }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-primary)' }}>Consular Schedule</h3>
                    </div>
                    <div className="summary-block-content" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-neutral)', fontSize: '0.9rem' }}>Date</span> <strong style={{ color: 'var(--color-primary)' }}>{data.appointmentDate || 'Pending'}</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-neutral)', fontSize: '0.9rem' }}>Time Slot</span> <strong style={{ color: 'var(--color-primary)' }}>{data.appointmentTime || 'Pending'}</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-neutral)', fontSize: '0.9rem' }}>Status</span> <strong style={{ color: '#D97706', backgroundColor: '#FFFBEB', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>Unconfirmed</strong></div>
                    </div>
                </div>
            </div>

            {/* Corporate Billing Estimate */}
            <div className="financial-summary-box" style={{ backgroundColor: '#F8FAFC', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '24px' }}>
                <div className="finance-box-header" style={{ marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '1.15rem' }}>Corporate Billing Estimate</h3>
                </div>
                <div className="finance-box-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-neutral)', fontSize: '0.95rem' }}>
                        <span>Base Consular Fee (€ {consularFeePP.toFixed(2)} × {batchSize})</span>
                        <strong style={{ color: 'var(--color-primary)' }}>€ {totalConsular.toFixed(2)}</strong>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-neutral)', fontSize: '0.95rem' }}>
                        <span>{packageName} (€ {serviceFeePP.toFixed(2)} × {batchSize})</span>
                        <strong style={{ color: 'var(--color-primary)' }}>€ {totalServices.toFixed(2)}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--color-border)', paddingTop: '16px', marginTop: '8px', fontSize: '1.1rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>Total Corporate Payable</span>
                        <span style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: '1.25rem' }}>€ {grandTotal.toFixed(2)}</span>
                    </div>
                </div>
            </div>
            
            <div className="info-alert" style={{ marginTop: '24px', display: 'flex', gap: '12px', backgroundColor: '#EFF6FF', padding: '16px', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '20px', height: '20px', color: 'var(--color-secondary)', flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <span style={{ fontSize: '0.9rem', color: '#1E3A8A', lineHeight: 1.5 }}>
                    Click <strong>"Submit & Generate Invoice"</strong> to finalize. You will be redirected to the Billing page to pay via Company Wallet or Corporate Credit Card to confirm the appointment.
                </span>
            </div>
        </div>
    );
}