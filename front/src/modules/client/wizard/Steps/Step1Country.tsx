import React, { useState, useEffect } from 'react';
import { dossierService } from '@/shared/api/services';

interface Step1Props {
    data: {
        country: string;
        countryId?: string;
        duration: string; // 'short' | 'long' | ''
        visaCategoryId?: string;
        projectReason: string;
    };
    updateData: (field: string, value: any) => void;
}

interface DestinationCountry {
    id: string;
    code: string;
    nameEn: string;
    nameAz: string;
    flag: string;
    processingTime: string;
    consularFee: string;
}

const DEFAULT_COUNTRIES: DestinationCountry[] = [
    { id: 'cnt-hu', code: 'HU', nameEn: 'Hungary', nameAz: 'Macarıstan', flag: '🇭🇺', processingTime: '15 business days', consularFee: '€80' },
    { id: 'cnt-at', code: 'AT', nameEn: 'Austria', nameAz: 'Avstriya', flag: '🇦🇹', processingTime: '15 business days', consularFee: '€80' },
    { id: 'cnt-de', code: 'DE', nameEn: 'Germany', nameAz: 'Almaniya', flag: '🇩🇪', processingTime: '20 business days', consularFee: '€80' },
    { id: 'cnt-it', code: 'IT', nameEn: 'Italy', nameAz: 'İtaliya', flag: '🇮🇹', processingTime: '15 business days', consularFee: '€80' },
    { id: 'cnt-fr', code: 'FR', nameEn: 'France', nameAz: 'Fransa', flag: '🇫🇷', processingTime: '18 business days', consularFee: '€80' },
    { id: 'cnt-pl', code: 'PL', nameEn: 'Poland', nameAz: 'Polşa', flag: '🇵🇱', processingTime: '15 business days', consularFee: '€80' },
    { id: 'cnt-es', code: 'ES', nameEn: 'Spain', nameAz: 'İspaniya', flag: '🇪🇸', processingTime: '15 business days', consularFee: '€80' },
];

export default function Step1Country({ data, updateData }: Step1Props) {
    const [countries, setCountries] = useState<DestinationCountry[]>(DEFAULT_COUNTRIES);
    const [loadingCountries, setLoadingCountries] = useState(false);

    useEffect(() => {
        let isMounted = true;
        setLoadingCountries(true);
        dossierService.getCountries()
            .then(res => {
                if (isMounted && res.data?.countries && res.data.countries.length > 0) {
                    const mapped: DestinationCountry[] = res.data.countries.map((c: any) => {
                        const fallback = DEFAULT_COUNTRIES.find(dc => dc.code === c.code || dc.nameEn.toLowerCase() === c.nameEn?.toLowerCase());
                        return {
                            id: c.id,
                            code: c.code || fallback?.code || 'EU',
                            nameEn: c.nameEn || fallback?.nameEn || 'Schengen State',
                            nameAz: c.nameAz || fallback?.nameAz || c.nameEn || 'Şengen Dövləti',
                            flag: fallback?.flag || '🇪🇺',
                            processingTime: fallback?.processingTime || '15 business days',
                            consularFee: fallback?.consularFee || '€80'
                        };
                    });
                    setCountries(mapped);
                }
            })
            .catch(() => {
                // Keep default countries
            })
            .finally(() => {
                if (isMounted) setLoadingCountries(false);
            });

        return () => { isMounted = false; };
    }, []);

    // Short Stay (Schengen C) purposes
    const shortStayOptions = [
        "Tourism & Leisure Travel",
        "Business & Commercial Delegation",
        "Official Visit & Diplomatic Mission",
        "Family or Private Visit",
        "Medical Treatment",
        "Short-term Studies / Cultural Exchange",
        "Transit & Airport Layover"
    ];

    // Long Stay (National D) purposes
    const longStayOptions = [
        "Employment / Work Authorization",
        "Higher Education / University Studies",
        "Family Reunification & Settlement",
        "EU Blue Card & Talent Relocation",
        "Scientific Research & Academia",
        "Long-term Resident / Guest Worker"
    ];

    const currentProjectOptions = data.duration === 'long' ? longStayOptions : shortStayOptions;

    const handleCountrySelect = (c: DestinationCountry) => {
        updateData('country', c.nameEn);
        updateData('countryId', c.id);
    };

    const handleDurationSelect = (duration: 'short' | 'long') => {
        updateData('duration', duration);
        updateData('projectReason', '');
    };

    return (
        <div className="step-content fade-in">
            <h1 className="step-title">Destination & Visa Category</h1>
            <p className="step-subtitle">Select your European destination country and specify the duration and purpose of your travel.</p>
            
            {/* --- COUNTRY CARDS GRID --- */}
            <div className="wizard-input-group" style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <label style={{ margin: 0, fontWeight: 700 }}>Destination Country (Schengen / EU)</label>
                    <span style={{ fontSize: '0.85rem', color: '#94A3B8' }}>Select your primary entry country</span>
                </div>

                <div className="country-cards-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                    gap: '14px',
                    marginBottom: '16px'
                }}>
                    {countries.map(c => {
                        const isSelected = data.country.toLowerCase() === c.nameEn.toLowerCase();
                        return (
                            <div 
                                key={c.id} 
                                onClick={() => handleCountrySelect(c)}
                                style={{
                                    background: isSelected ? '#EFF6FF' : '#FFFFFF',
                                    border: isSelected ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
                                    borderRadius: '12px',
                                    padding: '16px 14px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    textAlign: 'center',
                                    boxShadow: isSelected ? '0 4px 14px rgba(37, 99, 235, 0.15)' : '0 2px 6px rgba(15, 23, 42, 0.04)',
                                }}
                            >
                                <span style={{ fontSize: '2.4rem', marginBottom: '8px', lineHeight: 1 }}>{c.flag}</span>
                                <strong style={{ color: isSelected ? '#1E3A8A' : '#0F1E36', fontSize: '1rem', marginBottom: '4px', fontWeight: 700 }}>{c.nameEn}</strong>
                                <span style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '8px' }}>{c.nameAz}</span>
                                <span style={{ 
                                    fontSize: '0.75rem', 
                                    padding: '3px 10px', 
                                    borderRadius: '12px', 
                                    background: isSelected ? '#2563EB' : '#F1F5F9',
                                    color: isSelected ? '#FFFFFF' : '#475569',
                                    fontWeight: 600
                                }}>
                                    {c.processingTime}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* --- DURATION OF STAY --- */}
            <div className="wizard-input-group" style={{ marginBottom: '32px' }}>
                <label style={{ fontWeight: 700, marginBottom: '12px', display: 'block' }}>Duration of Stay</label>
                <div className="duration-cards-grid">
                    {/* Short Stay Card */}
                    <div 
                        className={`duration-card ${data.duration === 'short' ? 'selected' : ''}`}
                        onClick={() => handleDurationSelect('short')}
                    >
                        <div className="duration-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        </div>
                        <div className="duration-content">
                            <h3>Short Stay (≤ 90 days)</h3>
                            <p>Up to 90 days within any 180-day period across Schengen zone.</p>
                            <span className="visa-badge">Schengen C Visa</span>
                        </div>
                        <div className="duration-check">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                    </div>

                    {/* Long Stay Card */}
                    <div 
                        className={`duration-card ${data.duration === 'long' ? 'selected' : ''}`}
                        onClick={() => handleDurationSelect('long')}
                    >
                        <div className="duration-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        </div>
                        <div className="duration-content">
                            <h3>Long Stay (&gt; 90 days)</h3>
                            <p>Extended residence, work authorization, or university study.</p>
                            <span className="visa-badge">National D Visa</span>
                        </div>
                        <div className="duration-check">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- TRAVEL PROJECT / PURPOSE --- */}
            <div className="wizard-input-group">
                <label style={{ fontWeight: 700 }}>Primary Travel Purpose</label>
                <p className="wizard-helper-text" style={{ marginTop: '-4px', marginBottom: '8px' }}>Select the specific consular classification matching your intent.</p>
                <div className="premium-select-wrapper">
                    <select 
                        value={data.projectReason} 
                        onChange={(e) => updateData('projectReason', e.target.value)}
                        className={data.projectReason ? 'selected' : ''}
                        disabled={!data.duration}
                    >
                        <option value="" disabled>Choose the category that applies to your travel</option>
                        {currentProjectOptions.map(option => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                </div>
                {!data.duration && <span className="wizard-helper-text" style={{ color: '#F59E0B' }}>⚠️ Please choose your duration of stay first to unlock travel categories.</span>}
            </div>
        </div>
    );
}