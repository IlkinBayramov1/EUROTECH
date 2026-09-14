import React from 'react';

export interface IndividualApplicant {
    id: string;
    firstName: string;
    lastName: string;
    dob: string;
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
            passportNumber: '',
            issueDate: '',
            expiryDate: ''
        };
        updateData('applicants', [...data.applicants, newApplicant]);
    };

    const handleRemoveApplicant = (id: string) => {
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

    return (
        <div className="step-content fade-in">
            <h1 className="step-title">Applicant Information</h1>
            <p className="step-subtitle">Provide passport details for yourself and any accompanying family members or co-applicants.</p>
            
            <div className="applicants-wrapper">
                {data.applicants.map((app, index) => (
                    <div key={app.id} className="applicant-block fade-in">
                        <div className="applicant-block-header">
                            <div className="applicant-title">
                                <div className="applicant-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                </div>
                                <h3>{index === 0 ? 'Primary Applicant' : `Co-Applicant #${index}`}</h3>
                            </div>
                            
                            {index > 0 && (
                                <button className="btn-remove-applicant-alt" onClick={() => handleRemoveApplicant(app.id)} title="Remove Applicant">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                    Remove
                                </button>
                            )}
                        </div>

                        <div className="wizard-form-grid">
                            <div className="wizard-input-group">
                                <label>First Name (Given Name)</label>
                                <input 
                                    type="text" 
                                    className="premium-input" 
                                    value={app.firstName}
                                    onChange={(e) => handleApplicantChange(app.id, 'firstName', e.target.value)}
                                    placeholder="e.g. Ali"
                                />
                            </div>

                            <div className="wizard-input-group">
                                <label>Last Name (Surname)</label>
                                <input 
                                    type="text" 
                                    className="premium-input" 
                                    value={app.lastName}
                                    onChange={(e) => handleApplicantChange(app.id, 'lastName', e.target.value)}
                                    placeholder="e.g. Mammadov"
                                />
                            </div>

                            <div className="wizard-input-group">
                                <label>Date of Birth</label>
                                <input 
                                    type="date" 
                                    className="premium-input" 
                                    value={app.dob}
                                    onChange={(e) => handleApplicantChange(app.id, 'dob', e.target.value)}
                                />
                            </div>

                            <div className="wizard-input-group">
                                <label>Passport Number</label>
                                <input 
                                    type="text" 
                                    className="premium-input" 
                                    value={app.passportNumber}
                                    onChange={(e) => handleApplicantChange(app.id, 'passportNumber', e.target.value.toUpperCase())}
                                    placeholder="e.g. C1234567"
                                />
                            </div>

                            <div className="wizard-input-group">
                                <label>Passport Issue Date</label>
                                <input 
                                    type="date" 
                                    className="premium-input" 
                                    value={app.issueDate}
                                    onChange={(e) => handleApplicantChange(app.id, 'issueDate', e.target.value)}
                                />
                            </div>

                            <div className="wizard-input-group">
                                <label>Passport Expiry Date</label>
                                <input 
                                    type="date" 
                                    className="premium-input" 
                                    value={app.expiryDate}
                                    onChange={(e) => handleApplicantChange(app.id, 'expiryDate', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <button className="btn-add-applicant-dashed" onClick={handleAddApplicant}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Another Applicant
            </button>
        </div>
    );
}