import React from 'react';

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
}

interface Step3Props {
    data: {
        applicants: IndividualApplicant[];
    };
    updateData: (field: string, value: any) => void;
}

export default function Step3Applicant({ data, updateData }: Step3Props) {
    
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
            expiryDate: ''
        };
        updateData('applicants', [...data.applicants, newApplicant]);
    };

    const handleRemoveApplicant = (id: string) => {
        if (data.applicants.length <= 1) return;
        updateData('applicants', data.applicants.filter(app => app.id !== id));
    };

    const handleApplicantChange = (id: string, field: keyof IndividualApplicant, value: string) => {
        const updated = data.applicants.map(app => {
            if (app.id === id) {
                return { ...app, [field]: value };
            }
            return app;
        });
        updateData('applicants', updated);
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

                            <div className="wizard-form-grid" style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                gap: '20px'
                            }}>
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