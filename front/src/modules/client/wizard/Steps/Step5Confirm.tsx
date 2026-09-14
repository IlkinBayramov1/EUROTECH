import React from 'react';
import type { IndividualApplicant } from './Step3Applicant';

interface Step5Props {
    data: {
        country: string;
        duration: string;
        projectReason: string;
        applicants: IndividualApplicant[];
        services: {
            activePackage: string;
            filePrep: boolean;
            insurance: boolean;
            formAssist: boolean;
            photo: boolean;
            lounge: boolean;
            courier: boolean;
            hotelFlight: boolean;
        };
        appointmentDate: string;
        appointmentTime: string;
    };
}

export default function Step5Confirm({ data }: Step5Props) {
    const s = data.services;
    const applicantCount = Math.max(data.applicants.length, 1);
    const primaryApplicant = data.applicants[0];

    // Konsulluq rüsumu (Təqribi 80 EUR = 145 AZN)
    const baseConsularFee = 145.00;
    const totalConsularFee = baseConsularFee * applicantCount;

    // Xidmət xərclərinin hesablanması (AZN)
    let perPersonServiceCost = 0;
    const activeServicesList: { name: string; price: number }[] = [];

    if (s.lounge) { perPersonServiceCost += 81; activeServicesList.push({ name: 'Premium Lounge Access', price: 81 }); }
    if (s.filePrep) { perPersonServiceCost += 55; activeServicesList.push({ name: 'File Preparation', price: 55 }); }
    if (s.insurance) { perPersonServiceCost += 35; activeServicesList.push({ name: 'Travel Medical Insurance', price: 35 }); }
    if (s.hotelFlight) { perPersonServiceCost += 30; activeServicesList.push({ name: 'Hotel & Flight Reservations', price: 30 }); }
    if (s.formAssist) { perPersonServiceCost += 24; activeServicesList.push({ name: 'Form Completion Assistance', price: 24 }); }
    if (s.courier) { perPersonServiceCost += 20; activeServicesList.push({ name: 'Courier Return', price: 20 }); }
    if (s.photo) { perPersonServiceCost += 12; activeServicesList.push({ name: 'Compliant ID Photo', price: 12 }); }

    const totalServiceCost = perPersonServiceCost * applicantCount;
    const grandTotal = totalConsularFee + totalServiceCost;

    return (
        <div className="step-content fade-in">
            {/* Header Section */}
            <div className="confirmation-header-v2">
                <div className="status-icon-pending">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <h1 className="step-title">Application Under Review</h1>
                <p className="step-subtitle">Your visa application data has been successfully compiled. To secure your appointment slot, please complete the pending payment via the secure link sent to your email.</p>
            </div>

            <div className="summary-grid-v2">
                {/* 1. Application Xülasəsi */}
                <div className="info-block">
                    <div className="info-block-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        <h3>Application Details</h3>
                    </div>
                    <div className="info-block-content">
                        <div className="info-row"><span>Primary Applicant</span> <strong>{primaryApplicant.firstName} {primaryApplicant.lastName}</strong></div>
                        <div className="info-row"><span>Co-Applicants</span> <strong>{applicantCount - 1 > 0 ? `${applicantCount - 1} Person(s)` : 'None'}</strong></div>
                        <div className="info-row"><span>Destination</span> <strong>{data.country || 'N/A'}</strong></div>
                        <div className="info-row"><span>Visa Category</span> <strong>{data.duration === 'long' ? 'National D Visa' : 'Schengen C Visa'}</strong></div>
                        <div className="info-row"><span>Travel Purpose</span> <strong>{data.projectReason || 'N/A'}</strong></div>
                    </div>
                </div>

                {/* 2. Randevu Xülasəsi */}
                <div className="info-block">
                    <div className="info-block-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <h3>Appointment Schedule</h3>
                    </div>
                    <div className="info-block-content">
                        <div className="info-row"><span>Date</span> <strong>{data.appointmentDate || 'Pending'}</strong></div>
                        <div className="info-row"><span>Time Slot</span> <strong>{data.appointmentTime || 'Pending'}</strong></div>
                        <div className="info-row"><span>Location</span> <strong>EuroTech Visa Center, Baku</strong></div>
                        <div className="info-row"><span>Status</span> <strong className="text-warning">Awaiting Payment</strong></div>
                    </div>
                </div>
            </div>

            {/* 3. Detallı Maliyyə Qəbzi (Invoice) */}
            <div className="invoice-card">
                <div className="invoice-header">
                    <h3>Financial Breakdown</h3>
                    <span className="invoice-badge">Invoice #INV-{Math.floor(Math.random() * 100000)}</span>
                </div>
                <div className="invoice-body">
                    {/* Konsulluq Rüsumu */}
                    <div className="invoice-item">
                        <div className="item-details">
                            <h4>Base Consular Fee</h4>
                            <p>Standard embassy processing fee ({baseConsularFee.toFixed(2)} AZN x {applicantCount} applicant)</p>
                        </div>
                        <div className="item-price">{totalConsularFee.toFixed(2)} AZN</div>
                    </div>

                    {/* Xidmətlər */}
                    {activeServicesList.length > 0 && (
                        <div className="invoice-item">
                            <div className="item-details">
                                <h4>Value-Added Services</h4>
                                <ul className="services-bullet-list">
                                    {activeServicesList.map((svc, idx) => (
                                        <li key={idx}>{svc.name} ({svc.price.toFixed(2)} AZN)</li>
                                    ))}
                                </ul>
                                <p style={{ marginTop: '8px' }}>Total service cost multiplied by {applicantCount} applicant(s)</p>
                            </div>
                            <div className="item-price">{totalServiceCost.toFixed(2)} AZN</div>
                        </div>
                    )}
                </div>
                
                <div className="invoice-footer">
                    <div className="invoice-total">
                        <span>Total Payable Amount</span>
                        <strong>{grandTotal.toFixed(2)} AZN</strong>
                    </div>
                </div>
            </div>

            <div className="terms-box-v2">
                <div className="terms-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                </div>
                <div className="terms-content">
                    <h4>Next Steps</h4>
                    <p>Please check the inbox and spam folder of your registered email for the official payment invoice. Your selected appointment date (<strong>{data.appointmentDate}</strong>) will be held for <strong>24 hours</strong>. If the payment is not completed within this timeframe, the slot will be released automatically.</p>
                </div>
            </div>
        </div>
    );
}