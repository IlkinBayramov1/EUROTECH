import React, { useState, useEffect } from 'react';
import type { IndividualApplicant } from './Step3Applicant';
import { paymentService } from '@/shared/api/services';

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
        visaCenter?: string;
        appointmentDate: string;
        appointmentTime: string;
        gdprConsent?: boolean;
        paymentMethod?: 'INVOICE' | 'WALLET' | 'CARD';
    };
    updateData?: (field: string, value: any) => void;
}

const COUNTRY_DATA: Record<string, { name: string; flag: string }> = {
    HU: { name: 'Hungary', flag: '🇭🇺' },
    AT: { name: 'Austria', flag: '🇦🇹' },
    DE: { name: 'Germany', flag: '🇩🇪' },
    IT: { name: 'Italy', flag: '🇮🇹' },
    FR: { name: 'France', flag: '🇫🇷' },
    PL: { name: 'Poland', flag: '🇵🇱' },
    ES: { name: 'Spain', flag: '🇪🇸' },
};

const NATIONALITY_NAMES: Record<string, string> = {
    AZ: 'Azerbaijan (AZE)',
    TR: 'Turkey (TUR)',
    GE: 'Georgia (GEO)',
    GB: 'United Kingdom (GBR)',
    US: 'United States (USA)',
    KZ: 'Kazakhstan (KAZ)',
    UZ: 'Uzbekistan (UZB)',
};

const SERVICE_CATALOG = [
    { key: 'lounge', name: 'VIP Consular Lounge Access', eur: 81, azn: 145.8 },
    { key: 'filePrep', name: 'Comprehensive File Audit & Prep', eur: 55, azn: 99 },
    { key: 'insurance', name: 'Schengen Travel Medical Insurance', eur: 35, azn: 63 },
    { key: 'hotelFlight', name: 'Verifiable Hotel & Flight Reservations', eur: 30, azn: 54 },
    { key: 'formAssist', name: 'Consular Visa Application Form Assistance', eur: 24, azn: 43.2 },
    { key: 'courier', name: 'Secure Courier Passport Return', eur: 20, azn: 36 },
    { key: 'photo', name: 'ICAO Biometric Passport Photo', eur: 12, azn: 21.6 },
];

export default function Step5Confirm({ data, updateData }: Step5Props) {
    const s = data.services;
    const applicantCount = Math.max(data.applicants.length, 1);
    const countryMeta = COUNTRY_DATA[data.country.toUpperCase()] || { name: data.country || 'Schengen Area', flag: '🇪🇺' };

    // Wallet balance state
    const [walletBalanceEur, setWalletBalanceEur] = useState<number>(0);
    const [walletLoading, setWalletLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        paymentService.getUserWallet()
            .then((res: any) => {
                if (isMounted) {
                    const bal = Number(res.data?.wallet?.balanceEur ?? res.data?.balance ?? 0);
                    setWalletBalanceEur(bal);
                }
            })
            .catch(() => {
                if (isMounted) setWalletBalanceEur(0);
            })
            .finally(() => {
                if (isMounted) setWalletLoading(false);
            });
        return () => { isMounted = false; };
    }, []);

    // Consular fee: €80 per applicant (~144 AZN)
    const consularFeePerPersonEur = 80;
    const consularFeePerPersonAzn = 144;
    const totalConsularEur = consularFeePerPersonEur * applicantCount;
    const totalConsularAzn = consularFeePerPersonAzn * applicantCount;

    // Services breakdown
    let activeServices: { name: string; eur: number; azn: number }[] = [];
    let packageTotalEur = 0;
    let packageTotalAzn = 0;

    if (s.activePackage === 'premium') {
        packageTotalEur = 126;
        packageTotalAzn = 226.8;
        activeServices.push({ name: 'Premium Service Package (Audit €55, Insurance €35, Form €24, Photo €12)', eur: 126, azn: 226.8 });
    } else if (s.activePackage === 'vip') {
        packageTotalEur = 257;
        packageTotalAzn = 462.6;
        activeServices.push({ name: 'VIP Concierge Package (Lounge €81, Courier €20, Itinerary €30 + Premium Bundle)', eur: 257, azn: 462.6 });
    } else if (s.activePackage === 'standard') {
        activeServices.push({ name: 'Standard Consular Processing Package', eur: 0, azn: 0 });
    }

    // Add standalone add-ons if selected individually
    SERVICE_CATALOG.forEach(item => {
        if ((s as any)[item.key]) {
            const alreadyInPackage = (s.activePackage === 'vip' && ['lounge', 'courier', 'filePrep', 'insurance', 'formAssist', 'photo', 'hotelFlight'].includes(item.key)) ||
                                     (s.activePackage === 'premium' && ['filePrep', 'insurance', 'formAssist', 'photo'].includes(item.key));
            if (!alreadyInPackage) {
                packageTotalEur += item.eur;
                packageTotalAzn += item.azn;
                activeServices.push(item);
            }
        }
    });

    const totalServicesEur = packageTotalEur * applicantCount;
    const totalServicesAzn = packageTotalAzn * applicantCount;

    const grandTotalEur = totalConsularEur + totalServicesEur;
    const grandTotalAzn = totalConsularAzn + totalServicesAzn;

    const centerLabel = data.visaCenter === 'ganja'
        ? 'EuroTech Regional Hub — Ganja (Heydar Aliyev Ave. 45)'
        : 'EuroTech Main Center — Baku (Nizami St. 140, Landmark III)';

    const selectedMethod = data.paymentMethod || 'WALLET';
    const canPayWithWallet = walletBalanceEur >= grandTotalEur;

    const handleMethodChange = (m: 'WALLET' | 'CARD' | 'INVOICE') => {
        if (updateData) {
            updateData('paymentMethod', m);
        }
    };

    return (
        <div className="step-content fade-in">
            {/* Header Section */}
            <div className="confirmation-header-v2">
                <div className="status-icon-pending" style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', boxShadow: '0 0 0 8px rgba(37, 99, 235, 0.08)' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 36, height: 36 }}>
                        <path d="M9 11l3 3L22 4"/>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                </div>
                <h1 className="step-title">Review & Final Consular Submission</h1>
                <p className="step-subtitle" style={{ maxWidth: 640 }}>
                    Please review your travel itinerary, consular appointment reservation, and applicant documents before final authorization.
                </p>
            </div>

            {/* Summary Cards */}
            <div className="summary-grid-v2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '24px' }}>
                {/* 1. Destination & Visa Details */}
                <div className="info-block" style={{ background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
                    <div className="info-block-header" style={{ background: '#F8FAFC', padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.3rem' }}>{countryMeta.flag}</span>
                        <h3 style={{ margin: 0, fontSize: '1rem', color: '#0F1E36', fontWeight: 700 }}>Destination & Visa Scope</h3>
                    </div>
                    <div className="info-block-content" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div className="info-row">
                            <span style={{ color: '#64748B' }}>Target Embassy / Country</span>
                            <strong style={{ color: '#0F1E36' }}>{countryMeta.flag} {countryMeta.name}</strong>
                        </div>
                        <div className="info-row">
                            <span style={{ color: '#64748B' }}>Visa Classification</span>
                            <strong style={{ color: '#1D4ED8' }}>
                                {data.duration === 'long' ? 'National D Visa (Long-Term >90 Days)' : 'Schengen C Visa (Short-Stay ≤90 Days)'}
                            </strong>
                        </div>
                        <div className="info-row">
                            <span style={{ color: '#64748B' }}>Travel Purpose</span>
                            <strong style={{ color: '#0F1E36', textTransform: 'capitalize' }}>{data.projectReason || 'General'}</strong>
                        </div>
                        <div className="info-row">
                            <span style={{ color: '#64748B' }}>Selected Service Tier</span>
                            <strong style={{ color: '#D97706', textTransform: 'capitalize' }}>{data.services?.activePackage || 'Standard'}</strong>
                        </div>
                    </div>
                </div>

                {/* 2. Consular Biometrics Appointment */}
                <div className="info-block" style={{ background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
                    <div className="info-block-header" style={{ background: '#F8FAFC', padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.2rem' }}>🏛️</span>
                        <h3 style={{ margin: 0, fontSize: '1rem', color: '#0F1E36', fontWeight: 700 }}>Consular Biometrics Appointment</h3>
                    </div>
                    <div className="info-block-content" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div className="info-row">
                            <span style={{ color: '#64748B' }}>Collection Center</span>
                            <strong style={{ color: '#0F1E36', fontSize: '0.9rem' }}>{centerLabel}</strong>
                        </div>
                        <div className="info-row">
                            <span style={{ color: '#64748B' }}>Appointment Date</span>
                            <strong style={{ color: '#1D4ED8' }}>{data.appointmentDate || 'Not specified'}</strong>
                        </div>
                        <div className="info-row">
                            <span style={{ color: '#64748B' }}>Time Window</span>
                            <strong style={{ color: '#059669' }}>{data.appointmentTime || 'Not specified'}</strong>
                        </div>
                        <div className="info-row">
                            <span style={{ color: '#64748B' }}>Booking Status</span>
                            <strong style={{ color: '#D97706' }}>● Slot Held (Awaiting Submission)</strong>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Applicants Overview */}
            <div style={{
                background: '#FFFFFF',
                border: '1.5px solid #E2E8F0',
                borderRadius: '12px',
                marginBottom: '24px',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)'
            }}>
                <div style={{
                    background: '#F8FAFC',
                    padding: '16px 20px',
                    borderBottom: '1px solid #E2E8F0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.2rem' }}>👥</span>
                        <h3 style={{ margin: 0, fontSize: '1rem', color: '#0F1E36', fontWeight: 700 }}>Registered Applicants ({applicantCount})</h3>
                    </div>
                    <span style={{ fontSize: '0.82rem', color: '#1D4ED8', fontWeight: 600, background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '3px 10px', borderRadius: '12px' }}>
                        {applicantCount === 1 ? 'Individual Dossier' : `Group Dossier (${applicantCount} Travelers)`}
                    </span>
                </div>

                <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {data.applicants.map((app, idx) => (
                        <div key={app.id || idx} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '12px',
                            padding: '14px 18px',
                            background: idx === 0 ? '#F8FAFC' : '#FFFFFF',
                            border: idx === 0 ? '1.5px solid #CBD5E1' : '1px solid #E2E8F0',
                            borderRadius: '8px'
                        }}>
                            <div>
                                <strong style={{ color: '#0F1E36', display: 'block', fontSize: '0.98rem' }}>
                                    {app.firstName} {app.lastName} {idx === 0 && <span style={{ fontSize: '0.78rem', color: '#1D4ED8', marginLeft: '6px', fontWeight: 600 }}>(Primary Applicant)</span>}
                                </strong>
                                <span style={{ fontSize: '0.84rem', color: '#64748B' }}>
                                    Passport: <span style={{ color: '#0F1E36', fontFamily: 'monospace', fontWeight: 700 }}>{app.passportNumber}</span> | Nationality: {NATIONALITY_NAMES[app.nationality || 'AZ'] || app.nationality || 'AZ'} | DOB: {app.dob || 'N/A'}
                                </span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '0.78rem', color: '#64748B', display: 'block' }}>Passport Valid Until:</span>
                                <strong style={{ fontSize: '0.9rem', color: '#059669' }}>{app.expiryDate || 'N/A'}</strong>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 4. Itemized Proforma Financial Invoice */}
            <div className="invoice-card" style={{
                background: '#FFFFFF',
                border: '1.5px solid #E2E8F0',
                borderRadius: '14px',
                marginBottom: '24px',
                overflow: 'hidden',
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.05)'
            }}>
                <div className="invoice-header" style={{
                    background: '#EFF6FF',
                    padding: '18px 24px',
                    borderBottom: '1px solid #BFDBFE',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <h3 style={{ margin: 0, color: '#1E3A8A', fontSize: '1.1rem', fontWeight: 700 }}>Official Consular Proforma Invoice</h3>
                        <span style={{ fontSize: '0.82rem', color: '#64748B' }}>Automated Itemized Calculation (EUR Base with Live AZN Conversion)</span>
                    </div>
                    <span className="invoice-badge" style={{ background: '#FFFFFF', color: '#1D4ED8', border: '1px solid #BFDBFE', padding: '6px 14px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 700 }}>
                        INV-{Date.now().toString().slice(-6)}
                    </span>
                </div>

                <div className="invoice-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    {/* Base Consular Fee */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '16px', borderBottom: '1px dashed #CBD5E1' }}>
                        <div>
                            <h4 style={{ margin: '0 0 4px 0', color: '#0F1E36', fontSize: '1rem', fontWeight: 700 }}>Statutory Embassy Consular Processing Fee</h4>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748B' }}>
                                Standard Schengen / National Visa government charge (€{consularFeePerPersonEur} ≈ {consularFeePerPersonAzn} AZN × {applicantCount} applicant{applicantCount > 1 ? 's' : ''})
                            </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <strong style={{ color: '#0F1E36', fontSize: '1.1rem', display: 'block' }}>€{totalConsularEur.toFixed(2)}</strong>
                            <span style={{ fontSize: '0.85rem', color: '#64748B' }}>≈ {totalConsularAzn.toFixed(2)} AZN</span>
                        </div>
                    </div>

                    {/* Value Added Services */}
                    {activeServices.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '16px', borderBottom: '1px dashed #CBD5E1' }}>
                            <div>
                                <h4 style={{ margin: '0 0 6px 0', color: '#0F1E36', fontSize: '1rem', fontWeight: 700 }}>Consular Value-Added Services</h4>
                                <ul style={{ margin: 0, paddingLeft: '18px', color: '#334155', fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    {activeServices.map((svc, idx) => (
                                        <li key={idx}>
                                            {svc.name} — <strong style={{ color: '#1D4ED8' }}>€{svc.eur}</strong> <span style={{ color: '#64748B' }}>({svc.azn} AZN)</span>
                                        </li>
                                    ))}
                                </ul>
                                {applicantCount > 1 && (
                                    <p style={{ margin: '6px 0 0 0', fontSize: '0.8rem', color: '#64748B' }}>
                                        * Applied per individual applicant in dossier
                                    </p>
                                )}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <strong style={{ color: '#0F1E36', fontSize: '1.1rem', display: 'block' }}>€{totalServicesEur.toFixed(2)}</strong>
                                <span style={{ fontSize: '0.85rem', color: '#64748B' }}>≈ {totalServicesAzn.toFixed(2)} AZN</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="invoice-footer" style={{
                    background: '#F8FAFC',
                    padding: '20px 24px',
                    borderTop: '1px solid #E2E8F0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <span style={{ fontSize: '0.92rem', color: '#475569', display: 'block', fontWeight: 500 }}>Grand Total Payable (Consular + Services)</span>
                        <span style={{ fontSize: '0.78rem', color: '#64748B' }}>Official exchange conversion: 1.00 EUR ≈ 1.80 AZN</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1D4ED8', lineHeight: 1.1 }}>
                            €{grandTotalEur.toFixed(2)}
                        </div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F1E36' }}>
                            ≈ {grandTotalAzn.toFixed(2)} AZN
                        </div>
                    </div>
                </div>
            </div>

            {/* 5. Settlement & Payment Options Card */}
            <div style={{
                background: '#FFFFFF',
                border: '1.5px solid #E2E8F0',
                borderRadius: '14px',
                padding: '24px',
                marginBottom: '24px',
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.05)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0F1E36', fontWeight: 700 }}>
                        Select Settlement & Payment Method
                    </h3>
                    <div style={{ fontSize: '0.85rem', color: '#475569', background: '#F1F5F9', padding: '4px 12px', borderRadius: '16px' }}>
                        Wallet Balance: <strong style={{ color: walletBalanceEur >= grandTotalEur ? '#059669' : '#D97706' }}>
                            {walletLoading ? 'Checking...' : `€${walletBalanceEur.toFixed(2)}`}
                        </strong>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                    {/* Option 1: Pay from EuroTech Wallet */}
                    <div 
                        onClick={() => handleMethodChange('WALLET')}
                        style={{
                            border: selectedMethod === 'WALLET' ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
                            borderRadius: '10px',
                            padding: '16px',
                            background: selectedMethod === 'WALLET' ? '#EFF6FF' : '#FFFFFF',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            position: 'relative'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <input 
                                type="radio" 
                                name="clientPaymentMethod" 
                                checked={selectedMethod === 'WALLET'} 
                                onChange={() => handleMethodChange('WALLET')} 
                                style={{ accentColor: '#2563EB' }}
                            />
                            <strong style={{ color: '#0F1E36', fontSize: '0.95rem' }}>EuroTech Wallet</strong>
                            <span style={{ fontSize: '0.72rem', background: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                                Instant
                            </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748B' }}>
                            Deduct directly from your available pre-funded balance (€{walletBalanceEur.toFixed(2)}).
                        </p>
                        {!canPayWithWallet && (
                            <span style={{ display: 'block', marginTop: '6px', fontSize: '0.76rem', color: '#D97706', fontWeight: 600 }}>
                                ⚠️ Insufficient balance (€{walletBalanceEur.toFixed(2)} &lt; €{grandTotalEur.toFixed(2)}). You can pay via Card or settle later in Wallet &amp; Billing.
                            </span>
                        )}
                    </div>

                    {/* Option 2: Pay Online with Card */}
                    <div 
                        onClick={() => handleMethodChange('CARD')}
                        style={{
                            border: selectedMethod === 'CARD' ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
                            borderRadius: '10px',
                            padding: '16px',
                            background: selectedMethod === 'CARD' ? '#EFF6FF' : '#FFFFFF',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <input 
                                type="radio" 
                                name="clientPaymentMethod" 
                                checked={selectedMethod === 'CARD'} 
                                onChange={() => handleMethodChange('CARD')} 
                                style={{ accentColor: '#2563EB' }}
                            />
                            <strong style={{ color: '#0F1E36', fontSize: '0.95rem' }}>Credit / Debit Card</strong>
                            <span style={{ fontSize: '0.72rem', background: '#DBEAFE', color: '#1D4ED8', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                                Visa / MC
                            </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748B' }}>
                            Pay immediately online using Visa, MasterCard, or European 3D-Secure cards.
                        </p>
                    </div>

                    {/* Option 3: Proforma Invoice & Settle Later in Wallet */}
                    <div 
                        onClick={() => handleMethodChange('INVOICE')}
                        style={{
                            border: selectedMethod === 'INVOICE' ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
                            borderRadius: '10px',
                            padding: '16px',
                            background: selectedMethod === 'INVOICE' ? '#EFF6FF' : '#FFFFFF',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <input 
                                type="radio" 
                                name="clientPaymentMethod" 
                                checked={selectedMethod === 'INVOICE'} 
                                onChange={() => handleMethodChange('INVOICE')} 
                                style={{ accentColor: '#2563EB' }}
                            />
                            <strong style={{ color: '#0F1E36', fontSize: '0.95rem' }}>Wallet &amp; Billing (Later)</strong>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748B' }}>
                            Register dossier, generate official Proforma Invoice, and settle via Bank Wire Slip or Wallet Top-Up.
                        </p>
                    </div>
                </div>
            </div>

            {/* 6. Mandatory GDPR & Consular Compliance Consent */}
            <div style={{
                background: data.gdprConsent ? '#ECFDF5' : '#F8FAFC',
                border: data.gdprConsent ? '1.5px solid #A7F3D0' : '1.5px solid #CBD5E1',
                borderRadius: '12px',
                padding: '20px 24px',
                marginBottom: '20px',
                transition: 'all 0.2s ease'
            }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', cursor: 'pointer' }}>
                    <input 
                        type="checkbox"
                        checked={!!data.gdprConsent}
                        onChange={(e) => updateData && updateData('gdprConsent', e.target.checked)}
                        style={{
                            width: '20px',
                            height: '20px',
                            marginTop: '3px',
                            cursor: 'pointer',
                            accentColor: '#0F1E36'
                        }}
                    />
                    <div style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.5 }}>
                        <strong style={{ color: '#0F1E36', display: 'block', marginBottom: '4px', fontSize: '0.95rem' }}>
                            Consular Declaration &amp; European GDPR Compliance Consent *
                        </strong>
                        I solemnly declare that all travel document numbers, biographical entries, and submitted information are accurate, authentic, and valid. I grant explicit consent to EuroTech Consular Services to process, store, and transmit my biometric and personal data in strict compliance with the European Union General Data Protection Regulation (GDPR) and the Law of the Republic of Azerbaijan on Personal Data.
                    </div>
                </label>
            </div>
        </div>
    );
}
