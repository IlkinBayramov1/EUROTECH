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
}

export default function Step5Confirmation({ data }: Step5Props) {
    // Qrupdakı sərnişinlərin sayı (Ən azı 1 nəfər kimi hesablanır)
    const groupSize = Math.max(data.applicants.length, 1);
    
    // Konsulluq rüsumu
    const consularFeePP = 145.00;
    
    // Seçilmiş paketə əsasən 1 nəfər üçün xidmət haqqı
    let serviceFeePP = 0;
    let packageName = 'Standard Processing';
    
    if (data.services.activePackage === 'premium') {
        serviceFeePP = 126.00;
        packageName = 'Premium Bundle';
    } else if (data.services.activePackage === 'vip') {
        serviceFeePP = 257.00;
        packageName = 'VIP Platinum';
    }

    // Toplu (Bulk) hesablamalar
    const totalConsular = consularFeePP * groupSize;
    const totalServices = serviceFeePP * groupSize;
    const grandTotal = totalConsular + totalServices;

    return (
        <div className="step-content fade-in">
            {/* Header Section */}
            <div className="confirmation-header-alt">
                <div className="success-icon-alt" style={{ backgroundColor: '#FFFBEB', color: '#F59E0B', boxShadow: '0 0 0 8px rgba(245, 158, 11, 0.1)' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <h1 className="step-title">Pending Corporate Payment</h1>
                <p className="step-subtitle">Your group dossier is ready. Review the summary below. A secure B2B payment link will be generated to secure the appointment slot.</p>
            </div>

            {/* Application & Appointment Summary Grid */}
            <div className="summary-cards-grid">
                {/* Sol Tərəf: Qrup Məlumatları */}
                <div className="summary-block">
                    <div className="summary-block-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        <h3>Group Overview</h3>
                    </div>
                    <div className="summary-block-content">
                        <div className="summary-row"><span>Group Reference</span> <strong>{data.groupName || 'N/A'}</strong></div>
                        <div className="summary-row"><span>Total Members</span> <strong>{groupSize} Applicant(s)</strong></div>
                        <div className="summary-row"><span>Destination</span> <strong>{data.country || 'N/A'}</strong></div>
                        <div className="summary-row"><span>Departure Date</span> <strong>{data.travelDate || 'N/A'}</strong></div>
                    </div>
                </div>

                {/* Sağ Tərəf: Randevu Məlumatları */}
                <div className="summary-block">
                    <div className="summary-block-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <h3>Appointment Schedule</h3>
                    </div>
                    <div className="summary-block-content">
                        <div className="summary-row"><span>Date</span> <strong>{data.appointmentDate || 'Pending'}</strong></div>
                        <div className="summary-row"><span>Time Slot</span> <strong>{data.appointmentTime || 'Pending'}</strong></div>
                        <div className="summary-row"><span>Location</span> <strong>EuroTech Visa Center</strong></div>
                        <div className="summary-row"><span>Status</span> <strong style={{ color: '#D97706' }}>Awaiting Payment</strong></div>
                    </div>
                </div>
            </div>

            {/* B2B Maliyyə Qəbzi (Proforma Invoice) */}
            <div className="financial-summary-box">
                <div className="finance-box-header">
                    <h3>B2B Proforma Invoice</h3>
                </div>
                <div className="finance-box-body">
                    <div className="finance-row">
                        <span>Base Consular Fee ({consularFeePP.toFixed(2)} AZN × {groupSize})</span>
                        <strong>{totalConsular.toFixed(2)} AZN</strong>
                    </div>
                    
                    <div className="finance-row">
                        <span>{packageName} ({serviceFeePP.toFixed(2)} AZN × {groupSize})</span>
                        <strong>{totalServices.toFixed(2)} AZN</strong>
                    </div>

                    <div className="finance-row total">
                        <span>Total Corporate Payable</span>
                        <span className="total-amount">{grandTotal.toFixed(2)} AZN</span>
                    </div>
                </div>
            </div>
            
            {/* Məlumatlandırıcı Xəbərdarlıq */}
            <div className="info-alert" style={{ marginTop: '32px' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <span>Click <strong>"Submit Group Application"</strong> to finalize. The invoice will be sent to your agency's billing email. The selected time slot will be temporarily reserved for 2 hours pending payment.</span>
            </div>
        </div>
    );
}