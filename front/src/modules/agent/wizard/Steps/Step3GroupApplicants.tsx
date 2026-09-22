import React, { useRef } from 'react';
import type { ApplicantData } from '../AgentWizard';
import { useToast } from '@/shared/context/ToastContext';

interface Step3Props {
    data: {
        groupName: string;
        applicants: ApplicantData[];
    };
    updateData: (field: string, value: any) => void;
}

export default function Step3GroupApplicants({ data, updateData }: Step3Props) {
    const { showSuccess, showError } = useToast();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    
    // Function to add a new empty applicant
    const handleAddApplicant = () => {
        const newApplicant: ApplicantData = {
            id: `app-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            firstName: '',
            lastName: '',
            dob: '',
            passportNumber: '',
            issueDate: '',  // <-- ADDED
            expiryDate: '', // <-- ADDED
            documents: { passport: false, photo: false }
        };
        updateData('applicants', [...data.applicants, newApplicant]);
    };

    // Function to remove an applicant
    const handleRemoveApplicant = (id: string) => {
        updateData('applicants', data.applicants.filter(app => app.id !== id));
    };

    // Function to update specific applicant data
    const handleApplicantChange = (id: string, field: keyof ApplicantData, value: string) => {
        const updated = data.applicants.map(app => {
            if (app.id === id) {
                return { ...app, [field]: value };
            }
            return app;
        });
        updateData('applicants', updated);
    };

    // CSV File Upload Parser for Tour Groups
    const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                if (lines.length < 2) {
                    showError('CSV file is empty or missing header row.');
                    return;
                }

                const newApplicants: ApplicantData[] = [];
                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                    if (cols.length >= 2) {
                        newApplicants.push({
                            id: `app-csv-${Date.now()}-${i}`,
                            firstName: cols[0] || 'Traveler',
                            lastName: cols[1] || '',
                            dob: cols[2] || '1995-05-15',
                            passportNumber: (cols[3] || `C${Math.floor(1000000 + Math.random() * 9000000)}`).toUpperCase(),
                            issueDate: cols[4] || '2021-01-01',
                            expiryDate: cols[5] || '2031-01-01',
                            documents: { passport: false, photo: false }
                        });
                    }
                }

                if (newApplicants.length > 0) {
                    updateData('applicants', [...data.applicants, ...newApplicants]);
                    showSuccess(`Successfully imported ${newApplicants.length} applicant(s) from CSV!`);
                } else {
                    showError('No valid applicant rows found in CSV.');
                }
            } catch (err) {
                showError('Failed to parse CSV file.');
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="step-content fade-in">
            <h1 className="step-title">Group & Applicants Form</h1>
            <p className="step-subtitle">Define your group name and add the core details for each applicant.</p>
            
            {/* 1. Group Name */}
            <div className="wizard-form-grid" style={{ marginBottom: '10px' }}>
                <div className="wizard-input-group full-width">
                    <label>Group Name (Internal Reference)</label>
                    <input 
                        type="text" 
                        value={data.groupName} 
                        onChange={(e) => updateData('groupName', e.target.value)} 
                        className="premium-input" 
                        placeholder="e.g. Summer Tech Delegation 2026"
                    />
                </div>
            </div>

            {/* Section Divider */}
            <div className="section-divider" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>Group Members ({data.applicants.length})</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleCsvUpload} 
                        style={{ display: 'none' }} 
                        accept=".csv" 
                    />
                    <button className="btn-add-applicant" onClick={() => fileInputRef.current?.click()} type="button" style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-main)' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        Upload CSV
                    </button>
                    <button className="btn-add-applicant" onClick={handleAddApplicant} type="button">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Add Applicant
                    </button>
                </div>
            </div>

            {/* 2. Applicant List */}
            <div className="applicants-container">
                {data.applicants.length === 0 ? (
                    <div className="empty-applicants-box fade-in">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        <p>No applicants added yet. Click the button above to start adding members to this group.</p>
                    </div>
                ) : (
                    data.applicants.map((app, index) => (
                        <div key={app.id} className="applicant-card fade-in">
                            <div className="applicant-card-header">
                                <h4>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                    Applicant #{index + 1}
                                </h4>
                                <button className="btn-remove-applicant" onClick={() => handleRemoveApplicant(app.id)} type="button">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                    Remove
                                </button>
                            </div>
                            
                            {/* Updated Form Grid with 6 Fields */}
                            <div className="wizard-form-grid">
                                <div className="wizard-input-group">
                                    <label>First Name (Given Name)</label>
                                    <input 
                                        type="text" 
                                        value={app.firstName} 
                                        onChange={(e) => handleApplicantChange(app.id, 'firstName', e.target.value)} 
                                        className="premium-input" 
                                        placeholder="e.g. Ali"
                                    />
                                </div>
                                <div className="wizard-input-group">
                                    <label>Last Name (Surname)</label>
                                    <input 
                                        type="text" 
                                        value={app.lastName} 
                                        onChange={(e) => handleApplicantChange(app.id, 'lastName', e.target.value)} 
                                        className="premium-input" 
                                        placeholder="e.g. Mammadov"
                                    />
                                </div>
                                <div className="wizard-input-group">
                                    <label>Date of Birth</label>
                                    <input 
                                        type="date" 
                                        value={app.dob} 
                                        onChange={(e) => handleApplicantChange(app.id, 'dob', e.target.value)} 
                                        className="premium-input" 
                                    />
                                </div>
                                <div className="wizard-input-group">
                                    <label>Passport Number</label>
                                    <input 
                                        type="text" 
                                        value={app.passportNumber} 
                                        onChange={(e) => handleApplicantChange(app.id, 'passportNumber', e.target.value.toUpperCase())} 
                                        className="premium-input" 
                                        placeholder="e.g. C1234567"
                                    />
                                </div>
                                <div className="wizard-input-group">
                                    <label>Passport Issue Date</label>
                                    <input 
                                        type="date" 
                                        value={app.issueDate} 
                                        onChange={(e) => handleApplicantChange(app.id, 'issueDate', e.target.value)} 
                                        className="premium-input" 
                                    />
                                </div>
                                <div className="wizard-input-group">
                                    <label>Passport Expiry Date</label>
                                    <input 
                                        type="date" 
                                        value={app.expiryDate} 
                                        onChange={(e) => handleApplicantChange(app.id, 'expiryDate', e.target.value)} 
                                        className="premium-input" 
                                    />
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}