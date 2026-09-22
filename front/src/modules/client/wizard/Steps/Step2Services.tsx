import React from 'react';

interface Step2Props {
    data: {
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
        applicants?: any[];
    };
    updateData: (field: string, value: any) => void;
}

export default function Step2Services({ data, updateData }: Step2Props) {
    const s = data.services;
    const applicantCount = data.applicants?.length || 1;

    // Currency rate EUR to AZN ~ 1.80
    const EUR_TO_AZN = 1.80;

    const handleSelectPackage = (pkg: 'standard' | 'premium' | 'vip') => {
        if (pkg === 'standard') {
            updateData('services', { 
                activePackage: 'standard', 
                filePrep: false, insurance: false, formAssist: false, photo: false, lounge: false, courier: false, hotelFlight: false 
            });
        } else if (pkg === 'premium') {
            updateData('services', { 
                activePackage: 'premium', 
                filePrep: true, insurance: true, formAssist: true, photo: true, lounge: false, courier: false, hotelFlight: false 
            });
        } else if (pkg === 'vip') {
            updateData('services', { 
                activePackage: 'vip', 
                filePrep: true, insurance: true, formAssist: true, photo: true, lounge: true, courier: true, hotelFlight: true 
            });
        }
    };

    const toggleService = (serviceId: keyof typeof data.services) => {
        if (serviceId === 'activePackage') return;
        updateData('services', { 
            ...s, 
            activePackage: 'custom',
            [serviceId]: !s[serviceId] 
        });
    };

    const individualServices = [
        { id: 'lounge' as const, title: 'Premium Lounge Access', desc: 'Dedicated quiet diplomatic lounge, prime slot bookings, and complimentary refreshments.', priceEur: 81.00 },
        { id: 'filePrep' as const, title: 'File Preparation & Legal Check', desc: 'Rigorous consular compliance check to maximize visa approval odds.', priceEur: 55.00 },
        { id: 'insurance' as const, title: 'Schengen Travel Medical Insurance', desc: 'Full €30,000 medical coverage policy recognized by all European embassies.', priceEur: 35.00 },
        { id: 'hotelFlight' as const, title: 'Hotel & Flight Itinerary Bookings', desc: 'Verifiable travel reservations meeting strict embassy filing criteria.', priceEur: 30.00 },
        { id: 'formAssist' as const, title: 'Consular Form Completion Assistance', desc: 'Expert completion of complex multilingual Schengen application questionnaires.', priceEur: 24.00 },
        { id: 'courier' as const, title: 'Secure Passport Courier Delivery', desc: 'Direct tracked doorstep courier delivery of your passport upon decision.', priceEur: 20.00 },
        { id: 'photo' as const, title: 'Biometric ICAO Photo on-site', desc: '100% compliant biometric photographic capture at the visa center.', priceEur: 12.00 },
    ];

    // Calculate subtotal
    let currentEurTotal = 0;
    individualServices.forEach(svc => {
        if (s[svc.id]) {
            currentEurTotal += svc.priceEur;
        }
    });

    const totalServiceCost = currentEurTotal * applicantCount;
    const totalServiceAzn = totalServiceCost * EUR_TO_AZN;

    return (
        <div className="step-content fade-in">
            <h1 className="step-title">Consular Value-Added Services</h1>
            <p className="step-subtitle">Select an all-inclusive concierge bundle, or customize tailored services for a seamless visa processing journey.</p>

            {/* --- LIVE SELECTION SUMMARY CHIP --- */}
            <div style={{
                background: 'rgba(30, 58, 138, 0.25)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '12px',
                padding: '14px 20px',
                marginBottom: '28px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
            }}>
                <div>
                    <span style={{ fontSize: '0.85rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700 }}>
                        Active Package: <strong style={{ color: '#38BDF8' }}>{s.activePackage.toUpperCase()}</strong>
                    </span>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.9rem', color: '#E2E8F0' }}>
                        Applied for {applicantCount} applicant(s)
                    </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38BDF8' }}>
                        €{totalServiceCost.toFixed(2)}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: '#94A3B8', marginLeft: '6px' }}>
                        (~{totalServiceAzn.toFixed(2)} AZN)
                    </span>
                </div>
            </div>

            {/* --- PREMIUM PACKAGES GRID --- */}
            <div className="packages-grid">
                {/* 1. Standard Package */}
                <div className={`package-card basic ${s.activePackage === 'standard' ? 'active' : ''}`} onClick={() => handleSelectPackage('standard')}>
                    <div className="package-header">
                        <h3>Standard</h3>
                        <div className="package-price">€0 <span>(0 AZN)</span></div>
                        <p>Self-service filing with standard timelines.</p>
                    </div>
                    <ul className="package-features">
                        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> Standard appointment scheduling</li>
                        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> Self-service form completion</li>
                        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> General visa center hall access</li>
                    </ul>
                    <div className="package-action">
                        <button className={`btn-package ${s.activePackage === 'standard' ? 'selected' : ''}`}>
                            {s.activePackage === 'standard' ? 'Selected' : 'Choose Standard'}
                        </button>
                    </div>
                </div>

                {/* 2. Premium Concierge (Most Popular) */}
                <div className={`package-card premium ${s.activePackage === 'premium' ? 'active' : ''}`} onClick={() => handleSelectPackage('premium')}>
                    <div className="package-badge">Most Popular</div>
                    <div className="package-header">
                        <h3>Premium Concierge</h3>
                        <div className="package-price">€126 <span>(~226 AZN)</span></div>
                        <p>Complete document prep & Schengen travel insurance.</p>
                    </div>
                    <ul className="package-features">
                        <li className="highlight"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> <strong>File Preparation & Verification</strong></li>
                        <li className="highlight"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> €30,000 Schengen Medical Insurance</li>
                        <li className="highlight"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> Professional Form Completion</li>
                        <li className="highlight"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> On-site Biometric Photos</li>
                    </ul>
                    <div className="package-action">
                        <button className={`btn-package ${s.activePackage === 'premium' ? 'selected' : ''}`}>
                            {s.activePackage === 'premium' ? 'Selected' : 'Choose Premium'}
                        </button>
                    </div>
                </div>

                {/* 3. VIP Platinum Lounge */}
                <div className={`package-card vip ${s.activePackage === 'vip' ? 'active' : ''}`} onClick={() => handleSelectPackage('vip')}>
                    <div className="package-badge luxury">Diplomatic VIP</div>
                    <div className="package-header">
                        <h3>VIP Platinum</h3>
                        <div className="package-price">€257 <span>(~462 AZN)</span></div>
                        <p>Luxury lounge access, doorstep courier & full concierge.</p>
                    </div>
                    <ul className="package-features">
                        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> Everything in Premium Concierge</li>
                        <li className="highlight-gold"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> <strong>Premium Diplomatic Lounge</strong></li>
                        <li className="highlight-gold"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> Hotel & Flight Itinerary Bookings</li>
                        <li className="highlight-gold"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> Secure Courier Doorstep Delivery</li>
                    </ul>
                    <div className="package-action">
                        <button className={`btn-package ${s.activePackage === 'vip' ? 'selected' : ''}`}>
                            {s.activePackage === 'vip' ? 'Selected' : 'Choose VIP Platinum'}
                        </button>
                    </div>
                </div>
            </div>

            {/* --- INDIVIDUAL ADD-ONS --- */}
            <div className="individual-services-section">
                <div className="divider-line">
                    <span>Or customize with individual consular add-ons</span>
                </div>
                
                <div className="addons-grid">
                    {individualServices.map(svc => {
                        const isSelected = s[svc.id] as boolean;
                        const aznEquiv = svc.priceEur * EUR_TO_AZN;
                        return (
                            <div 
                                key={svc.id} 
                                className={`addon-card ${isSelected ? 'selected' : ''}`}
                                onClick={() => toggleService(svc.id)}
                            >
                                <div className="addon-info">
                                    <div className="premium-checkbox">
                                        <input type="checkbox" checked={isSelected} readOnly />
                                        <span className="checkmark"></span>
                                    </div>
                                    <div className="addon-text">
                                        <span className="addon-title">{svc.title}</span>
                                        <span className="addon-desc-small">{svc.desc}</span>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span className="addon-price">+€{svc.priceEur.toFixed(2)}</span>
                                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#94A3B8' }}>~{aznEquiv.toFixed(0)} AZN</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}