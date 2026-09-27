import React, { useState } from 'react';
import { extractMrzFromText } from '@/shared/utils/mrzParser';

export interface IndividualApplicant {
    id: string;
    firstName: string;
    lastName: string;
    dob: string;
    gender?: 'MALE' | 'FEMALE';
    nationality?: string;
    passportNumber: string;
    issueDate: string;
    expiryDate: string;
    familyRole?: 'PRIMARY' | 'SPOUSE' | 'CHILD' | 'DEPENDENT' | 'OTHER';
}

interface Step3Props {
    data: {
        applicants: IndividualApplicant[];
    };
    updateData: (field: string, value: any) => void;
}

export default function Step3Applicant({ data, updateData }: Step3Props) {
    const [openMrzId, setOpenMrzId] = useState<string | null>(null);
    const [mrzInputs, setMrzInputs] = useState<Record<string, string>>({});
    const [mrzErrors, setMrzErrors] = useState<Record<string, string>>({});
    const [mrzSuccess, setMrzSuccess] = useState<Record<string, boolean>>({});
    
    const handleAddApplicant = () => {
        const newApplicant: IndividualApplicant = {
            id: `app-${Date.now()}`,
            firstName: '',
            lastName: '',
            dob: '',
            gender: 'MALE',
            nationality: 'AZ',
            passportNumber: '',
            issueDate: '',
            expiryDate: '',
            familyRole: 'SPOUSE'
        };
        updateData('applicants', [...data.applicants, newApplicant]);
    };

    const handleRemoveApplicant = (id: string) => {
        if (data.applicants.length <= 1) return;
        updateData('applicants', data.applicants.filter(app => app.id !== id));
    };

    const handleApplicantChange = (id: string, field: keyof IndividualApplicant, value: any) => {
        const updated = data.applicants.map(app => {
            if (app.id === id) {
                return { ...app, [field]: value };
            }
            return app;
        });
        updateData('applicants', updated);
    };

    const handleApplyMrz = (appId: string) => {
        const raw = mrzInputs[appId] || '';
        if (!raw.trim()) {
            setMrzErrors(prev => ({ ...prev, [appId]: 'Please paste the 2-line MRZ from the passport.' }));
            return;
        }

        const parsed = extractMrzFromText(raw);
        if (!parsed || !parsed.passportNumber) {
            setMrzErrors(prev => ({
                ...prev,
                [appId]: 'Could not recognize standard TD3 passport MRZ. Please ensure both 44-character lines are included.'
            }));
            return;
        }

        const updated = data.applicants.map(app => {
            if (app.id === appId) {
                let natCode = 'AZ';
                if (parsed.nationality === 'Azerbaijan' || parsed.nationality === 'AZE') natCode = 'AZ';
                else if (parsed.nationality === 'TUR' || parsed.nationality === 'TR') natCode = 'TR';
                else if (parsed.nationality === 'GEO' || parsed.nationality === 'GE') natCode = 'GE';
                else if (parsed.nationality === 'GBR' || parsed.nationality === 'GB') natCode = 'GB';
                else if (parsed.nationality === 'USA' || parsed.nationality === 'US') natCode = 'US';
                else if (parsed.nationality === 'KAZ' || parsed.nationality === 'KZ') natCode = 'KZ';
                else if (parsed.nationality === 'UZB' || parsed.nationality === 'UZ') natCode = 'UZ';

                return {
                    ...app,
                    firstName: parsed.firstName || app.firstName,
                    lastName: parsed.lastName || app.lastName,
                    passportNumber: parsed.passportNumber || app.passportNumber,
                    dob: parsed.birthDate || app.dob,
                    expiryDate: parsed.expiryDate || app.expiryDate,
                    gender: parsed.gender === 'F' ? ('FEMALE' as const) : ('MALE' as const),
                    nationality: natCode
                };
            }
            return app;
        });

        updateData('applicants', updated);
        setMrzErrors(prev => ({ ...prev, [appId]: '' }));
        setMrzSuccess(prev => ({ ...prev, [appId]: true }));
        setTimeout(() => {
            setOpenMrzId(null);
        }, 1200);
    };

    const handleFillSampleMrz = (appId: string) => {
        const sample = "P<AZEALIYEV<<ILKIN<<<<<<<<<<<<<<<<<<<<<<<<<<<\nC123456784AZE9001011M3001018<<<<<<<<<<<<<<02";
        setMrzInputs(prev => ({ ...prev, [appId]: sample }));
        setMrzErrors(prev => ({ ...prev, [appId]: '' }));
    };

    // Calculate if passport has less than 6 months validity
    const isPassportExpiringSoon = (expiryDate: string) => {
        if (!expiryDate) return false;
        const exp = new Date(expiryDate);
        const sixMonthsAhead = new Date();
        sixMonthsAhead.setMonth(sixMonthsAhead.getMonth() + 6);
        return exp < sixMonthsAhead;
    };

    return (
        <div className="step-content fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
                <div>
                    <h1 className="step-title">Applicant Identity & Passport Information</h1>
                    <p className="step-subtitle">Provide verified travel document details for all travelers included in this consular dossier.</p>
                </div>
                <button 
                    type="button"
                    onClick={handleAddApplicant}
                    style={{
                        background: '#EFF6FF',
                        border: '1px solid #BFDBFE',
                        color: '#1D4ED8',
                        borderRadius: '8px',
                        padding: '10px 18px',
                        fontWeight: 600,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 1px 2px rgba(29, 78, 216, 0.05)'
                    }}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 16, height: 16 }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add Co-Applicant / Family Member
                </button>
            </div>
            
            <div className="applicants-wrapper">
                {data.applicants.map((app, index) => {
                    const expiringSoon = isPassportExpiringSoon(app.expiryDate);
                    const isPrimary = index === 0;

                    return (
                        <div key={app.id} className="applicant-block fade-in" style={{
                            background: '#FFFFFF',
                            border: isPrimary ? '2px solid #CBD5E1' : '1px solid #E2E8F0',
                            borderRadius: '14px',
                            padding: '28px',
                            marginBottom: '24px',
                            boxShadow: isPrimary ? '0 4px 16px -2px rgba(15, 23, 42, 0.06)' : '0 2px 8px rgba(15, 23, 42, 0.03)'
                        }}>
                            <div className="applicant-block-header" style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderBottom: '1px solid #F1F5F9',
                                paddingBottom: '16px',
                                marginBottom: '20px'
                            }}>
                                <div className="applicant-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div className="applicant-icon" style={{
                                        width: '38px',
                                        height: '38px',
                                        borderRadius: '8px',
                                        background: isPrimary ? '#EFF6FF' : '#F8FAFC',
                                        color: isPrimary ? '#2563EB' : '#64748B',
                                        border: '1px solid #E2E8F0',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                    </div>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0F1E36', fontWeight: 700 }}>
                                        {isPrimary ? 'Primary Applicant (Main Dossier Holder)' : `Co-Applicant #${index} (Accompanying Traveler)`}
                                    </h3>
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setOpenMrzId(openMrzId === app.id ? null : app.id)}
                                        style={{
                                            background: openMrzId === app.id ? '#0F1E36' : '#EFF6FF',
                                            color: openMrzId === app.id ? '#FFFFFF' : '#1D4ED8',
                                            border: '1px solid #BFDBFE',
                                            borderRadius: '6px',
                                            padding: '6px 12px',
                                            fontSize: '0.82rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                        title="Auto-fill passport data by pasting MRZ lines"
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="16" x2="13" y2="16"/></svg>
                                        {openMrzId === app.id ? 'Close MRZ' : '⚡ MRZ Auto-fill'}
                                    </button>

                                    {!isPrimary && (
                                        <button 
                                            type="button"
                                            className="btn-remove-applicant-alt" 
                                            onClick={() => handleRemoveApplicant(app.id)} 
                                            title="Remove Co-Applicant"
                                            style={{
                                                background: '#FEF2F2',
                                                border: '1px solid #FECACA',
                                                color: '#DC2626',
                                                borderRadius: '6px',
                                                padding: '6px 14px',
                                                fontSize: '0.82rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                            Remove
                                        </button>
                                    )}
                                </div>
                            </div>

                            {openMrzId === app.id && (
                                <div style={{
                                    background: '#F8FAFC',
                                    border: '1px dashed #3B82F6',
                                    borderRadius: '10px',
                                    padding: '16px',
                                    marginBottom: '20px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1E3A8A' }}>
                                            Paste ICAO 9303 TD3 Passport MRZ (2 Lines)
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleFillSampleMrz(app.id)}
                                            style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '0.78rem', textDecoration: 'underline', cursor: 'pointer' }}
                                        >
                                            Load Sample AZ MRZ
                                        </button>
                                    </div>
                                    <textarea
                                        rows={3}
                                        value={mrzInputs[app.id] || ''}
                                        onChange={(e) => setMrzInputs(prev => ({ ...prev, [app.id]: e.target.value }))}
                                        placeholder={`P<AZEALIYEV<<ILKIN<<<<<<<<<<<<<<<<<<<<<<<<<<<\nC123456784AZE9001011M3001018<<<<<<<<<<<<<<02`}
                                        style={{
                                            width: '100%',
                                            fontFamily: 'monospace',
                                            fontSize: '0.85rem',
                                            letterSpacing: '1px',
                                            padding: '10px',
                                            borderRadius: '6px',
                                            border: '1px solid #CBD5E1',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                    {mrzErrors[app.id] && (
                                        <p style={{ color: '#DC2626', fontSize: '0.8rem', marginTop: '6px', marginBottom: 0 }}>
                                            ⚠️ {mrzErrors[app.id]}
                                        </p>
                                    )}
                                    {mrzSuccess[app.id] && (
                                        <p style={{ color: '#16A34A', fontSize: '0.8rem', marginTop: '6px', marginBottom: 0, fontWeight: 600 }}>
                                            ✓ Passport data recognized and filled automatically!
                                        </p>
                                    )}
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                                        <button
                                            type="button"
                                            onClick={() => handleApplyMrz(app.id)}
                                            style={{
                                                background: '#2563EB',
                                                color: '#FFFFFF',
                                                border: 'none',
                                                borderRadius: '6px',
                                                padding: '8px 16px',
                                                fontSize: '0.82rem',
                                                fontWeight: 600,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Parse & Auto-fill Fields
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="wizard-form-grid" style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                gap: '20px'
                            }}>
                                {!isPrimary && (
                                    <div className="wizard-input-group">
                                        <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', marginBottom: '6px', display: 'block' }}>
                                            Family Relationship *
                                        </label>
                                        <select 
                                            className="premium-input"
                                            value={app.familyRole || 'SPOUSE'}
                                            onChange={(e) => handleApplicantChange(app.id, 'familyRole', e.target.value)}
                                            style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                                        >
                                            <option value="SPOUSE">Spouse (Həyat yoldaşı)</option>
                                            <option value="CHILD">Child (Övlad)</option>
                                            <option value="DEPENDENT">Dependent (Ailə üzvü / Himayədə olan)</option>
                                            <option value="OTHER">Other Co-Applicant (Digər)</option>
                                        </select>
                                    </div>
                                )}
                                <div className="wizard-input-group">
                                    <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', marginBottom: '6px', display: 'block' }}>
                                        First Name (Given Name) *
                                    </label>
                                    <input 
                                        type="text" 
                                        className="premium-input" 
                                        value={app.firstName}
                                        onChange={(e) => handleApplicantChange(app.id, 'firstName', e.target.value)}
                                        placeholder="e.g. Orkhan"
                                        style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                                        required
                                    />
                                </div>

                                <div className="wizard-input-group">
                                    <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', marginBottom: '6px', display: 'block' }}>
                                        Last Name (Surname) *
                                    </label>
                                    <input 
                                        type="text" 
                                        className="premium-input" 
                                        value={app.lastName}
                                        onChange={(e) => handleApplicantChange(app.id, 'lastName', e.target.value)}
                                        placeholder="e.g. Mammadov"
                                        style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                                        required
                                    />
                                </div>

                                <div className="wizard-input-group">
                                    <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', marginBottom: '6px', display: 'block' }}>
                                        Date of Birth *
                                    </label>
                                    <input 
                                        type="date" 
                                        className="premium-input" 
                                        value={app.dob}
                                        onChange={(e) => handleApplicantChange(app.id, 'dob', e.target.value)}
                                        style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                                        required
                                    />
                                </div>

                                <div className="wizard-input-group">
                                    <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', marginBottom: '6px', display: 'block' }}>
                                        Gender
                                    </label>
                                    <select 
                                        className="premium-input"
                                        value={app.gender || 'MALE'}
                                        onChange={(e) => handleApplicantChange(app.id, 'gender', e.target.value as any)}
                                        style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                                    >
                                        <option value="MALE">Male (Kişi)</option>
                                        <option value="FEMALE">Female (Qadın)</option>
                                    </select>
                                </div>

                                <div className="wizard-input-group">
                                    <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', marginBottom: '6px', display: 'block' }}>
                                        Nationality
                                    </label>
                                    <select 
                                        className="premium-input"
                                        value={app.nationality || 'AZ'}
                                        onChange={(e) => handleApplicantChange(app.id, 'nationality', e.target.value)}
                                        style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                                    >
                                        <option value="AZ">Azerbaijan (AZ)</option>
                                        <option value="TR">Turkey (TR)</option>
                                        <option value="GE">Georgia (GE)</option>
                                        <option value="GB">United Kingdom (GB)</option>
                                        <option value="US">United States (US)</option>
                                        <option value="KZ">Kazakhstan (KZ)</option>
                                        <option value="UZ">Uzbekistan (UZ)</option>
                                    </select>
                                </div>

                                <div className="wizard-input-group">
                                    <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', marginBottom: '6px', display: 'block' }}>
                                        Passport Number *
                                    </label>
                                    <input 
                                        type="text" 
                                        className="premium-input" 
                                        value={app.passportNumber}
                                        onChange={(e) => handleApplicantChange(app.id, 'passportNumber', e.target.value.toUpperCase())}
                                        placeholder="e.g. C11223344"
                                        style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', fontFamily: 'monospace' }}
                                        required
                                    />
                                </div>

                                <div className="wizard-input-group">
                                    <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', marginBottom: '6px', display: 'block' }}>
                                        Passport Issue Date *
                                    </label>
                                    <input 
                                        type="date" 
                                        className="premium-input" 
                                        value={app.issueDate}
                                        onChange={(e) => handleApplicantChange(app.id, 'issueDate', e.target.value)}
                                        style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                                        required
                                    />
                                </div>

                                <div className="wizard-input-group">
                                    <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', marginBottom: '6px', display: 'block' }}>
                                        Passport Expiry Date *
                                    </label>
                                    <input 
                                        type="date" 
                                        className="premium-input" 
                                        value={app.expiryDate}
                                        onChange={(e) => handleApplicantChange(app.id, 'expiryDate', e.target.value)}
                                        style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                                        required
                                    />
                                    {expiringSoon && (
                                        <span style={{ fontSize: '0.78rem', color: '#DC2626', fontWeight: 600, display: 'block', marginTop: '4px' }}>
                                            ⚠️ Warning: Passport has less than 6 months validity remaining.
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}