import React, { useEffect } from 'react';

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
    };
    updateData: (field: string, value: any) => void;
}

export default function Step2Services({ data, updateData }: Step2Props) {
    const s = data.services;

    // Paket seçildikdə alt xidmətləri avtomatik aktiv/deaktiv edən funksiya
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

    // Tək-tək xidmət seçildikdə paketi "custom" (fərdi) vəziyyətinə salır
    const toggleService = (serviceId: keyof typeof data.services) => {
        if (serviceId === 'activePackage') return;
        updateData('services', { 
            ...s, 
            activePackage: 'custom',
            [serviceId]: !s[serviceId] 
        });
    };

    const individualServices = [
        { id: 'lounge' as const, title: 'Premium Lounge Access', desc: 'Dedicated quiet space, prime time slots, and personal support.', price: 81.00 },
        { id: 'filePrep' as const, title: 'File Preparation', desc: 'Verification of documents to maximize acceptance chances.', price: 55.00 },
        { id: 'insurance' as const, title: 'Travel Medical Insurance', desc: 'Schengen-compliant coverage up to €30,000.', price: 35.00 },
        { id: 'hotelFlight' as const, title: 'Hotel & Flight Reservations', desc: 'Verifiable dummy bookings required for the embassy.', price: 30.00 },
        { id: 'formAssist' as const, title: 'Form Completion', desc: 'Assistance to avoid errors on your application form.', price: 24.00 },
        { id: 'courier' as const, title: 'Courier Return', desc: 'Secure home delivery of your passport after decision.', price: 20.00 },
        { id: 'photo' as const, title: 'Compliant ID Photo', desc: '100% compliant biometric photos taken on-site.', price: 12.00 },
    ];

    return (
        <div className="step-content fade-in">
            <h1 className="step-title">Select Your Experience</h1>
            <p className="step-subtitle">Choose a comprehensive bundle for a seamless visa application, or customize with individual add-ons.</p>

            {/* --- PREMIUM PACKAGES GRID --- */}
            <div className="packages-grid">
                {/* 1. Basic / Standard Package */}
                <div className={`package-card basic ${s.activePackage === 'standard' ? 'active' : ''}`} onClick={() => handleSelectPackage('standard')}>
                    <div className="package-header">
                        <h3>Standard</h3>
                        <div className="package-price">0,00 <span>AZN</span></div>
                        <p>Essential processing with standard timelines.</p>
                    </div>
                    <ul className="package-features">
                        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> Standard appointment scheduling</li>
                        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> Self-service form completion</li>
                        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> Standard waiting area</li>
                    </ul>
                    <div className="package-action">
                        <button className={`btn-package ${s.activePackage === 'standard' ? 'selected' : ''}`}>
                            {s.activePackage === 'standard' ? 'Current Selection' : 'Select Standard'}
                        </button>
                    </div>
                </div>

                {/* 2. Premium Package (Recommended) */}
                <div className={`package-card premium ${s.activePackage === 'premium' ? 'active' : ''}`} onClick={() => handleSelectPackage('premium')}>
                    <div className="package-badge">Most Popular</div>
                    <div className="package-header">
                        <h3>Premium Bundle</h3>
                        <div className="package-price">126,00 <span>AZN</span></div>
                        <p>Stress-free preparation with full assistance.</p>
                    </div>
                    <ul className="package-features">
                        <li className="highlight"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> <strong>File Preparation</strong></li>
                        <li className="highlight"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> Travel Medical Insurance</li>
                        <li className="highlight"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> Form Completion Assistance</li>
                        <li className="highlight"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> Compliant ID Photo on-site</li>
                    </ul>
                    <div className="package-action">
                        <button className={`btn-package ${s.activePackage === 'premium' ? 'selected' : ''}`}>
                            {s.activePackage === 'premium' ? 'Current Selection' : 'Select Premium'}
                        </button>
                    </div>
                </div>

                {/* 3. VIP Platinum Package */}
                <div className={`package-card vip ${s.activePackage === 'vip' ? 'active' : ''}`} onClick={() => handleSelectPackage('vip')}>
                    <div className="package-badge luxury">Ultimate Comfort</div>
                    <div className="package-header">
                        <h3>VIP Platinum</h3>
                        <div className="package-price">257,00 <span>AZN</span></div>
                        <p>The all-inclusive, zero-stress visa experience.</p>
                    </div>
                    <ul className="package-features">
                        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> Everything in Premium Bundle</li>
                        <li className="highlight-gold"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> <strong>Premium Lounge Access</strong></li>
                        <li className="highlight-gold"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> Hotel & Flight Reservations</li>
                        <li className="highlight-gold"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> Secure Courier Home Delivery</li>
                    </ul>
                    <div className="package-action">
                        <button className={`btn-package ${s.activePackage === 'vip' ? 'selected' : ''}`}>
                            {s.activePackage === 'vip' ? 'Current Selection' : 'Select VIP Platinum'}
                        </button>
                    </div>
                </div>
            </div>

            {/* --- INDIVIDUAL ADD-ONS --- */}
            <div className="individual-services-section">
                <div className="divider-line">
                    <span>Or customize with individual add-ons</span>
                </div>
                
                <div className="addons-grid">
                    {individualServices.map(svc => {
                        const isSelected = s[svc.id] as boolean;
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
                                <span className="addon-price">+{svc.price.toFixed(2)} AZN</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}