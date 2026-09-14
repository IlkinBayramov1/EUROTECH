import React, { useState } from 'react';
import './ClientApplication.css';

interface ApplicantData {
    id: string;
    type: 'Primary' | 'Co-Applicant';
    firstName: string;
    lastName: string;
    status: 'completed' | 'in-progress' | 'not-started';
    progress: number;
}

export default function ClientApplication() {
    const [view, setView] = useState<'list' | 'edit'>('list');
    const [activeApplicant, setActiveApplicant] = useState<ApplicantData | null>(null);
    const [currentFormStep, setCurrentFormStep] = useState(1);
    const [isSaving, setIsSaving] = useState(false);

    const [applicants] = useState<ApplicantData[]>([
        { id: 'app-1', type: 'Primary', firstName: 'Ali', lastName: 'Mammadov', status: 'in-progress', progress: 40 },
        { id: 'app-2', type: 'Co-Applicant', firstName: 'Leyla', lastName: 'Mammadova', status: 'not-started', progress: 0 }
    ]);

    const handleEditApplicant = (app: ApplicantData) => {
        setActiveApplicant(app);
        setCurrentFormStep(1);
        setView('edit');
    };

    const handleBackToList = () => {
        setView('list');
        setActiveApplicant(null);
    };

    const handleSaveAndNext = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setTimeout(() => {
            setIsSaving(false);
            if (currentFormStep < 5) {
                setCurrentFormStep(prev => prev + 1);
            } else {
                handleBackToList();
            }
        }, 800);
    };

    if (view === 'list') {
        return (
            <div className="app-form-content fade-in">
                <div className="app-form-header">
                    <div className="header-text">
                        <h1 className="docs-title">Applications</h1>
                        <p className="docs-subtitle">Select an applicant below to complete their official consular application form.</p>
                    </div>
                    <button className="btn-primary">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        New Applicant
                    </button>
                </div>

                <div className="applicants-grid-view">
                    {applicants.map(app => (
                        <div key={app.id} className="applicant-profile-card">
                            <div className="profile-card-header">
                                <div className="profile-avatar">
                                    {app.firstName.charAt(0)}{app.lastName.charAt(0)}
                                </div>
                                <div className="profile-info">
                                    <h3>{app.firstName} {app.lastName}</h3>
                                    <span className="profile-type">{app.type}</span>
                                </div>
                                <div className={`profile-status ${app.status}`}>
                                    {app.status === 'completed' ? 'Completed' : app.status === 'in-progress' ? 'In Progress' : 'Not Started'}
                                </div>
                            </div>
                            
                            <div className="profile-progress-bar">
                                <div className="progress-fill" style={{ width: `${app.progress}%` }}></div>
                            </div>
                            
                            <div className="profile-card-actions">
                                <div className="progress-text">{app.progress}% Complete</div>
                                <div className="action-buttons">
                                    <button className="btn-icon-action" title="Edit Form" onClick={() => handleEditApplicant(app)}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                    </button>
                                    <button className="btn-icon-action" title="Download Draft" disabled={app.progress === 0}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                    </button>
                                    {app.type !== 'Primary' && (
                                        <button className="btn-icon-action danger" title="Remove Applicant">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // 2. Edit Form View (Horizontal Line Stepper)
    const formSteps = [
        { id: 1, title: 'Your plans' },
        { id: 2, title: 'Your information' },
        { id: 3, title: 'Your last visa' },
        { id: 4, title: 'Your stay' },
        { id: 5, title: 'Your contacts' }
    ];

    return (
        <div className="app-form-content fade-in">
            {/* Header: Back Button & Applicant Name */}
            <div className="edit-form-header">
                <button className="btn-back-link" onClick={handleBackToList}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                    Back to Applicants
                </button>
                <div className="active-applicant-badge">
                    Editing: <strong>{activeApplicant?.firstName} {activeApplicant?.lastName}</strong>
                </div>
            </div>

            {/* Horizontal Line Stepper */}
            <div className="horizontal-stepper-wrapper">
                {formSteps.map(step => (
                    <div 
                        key={step.id} 
                        className={`stepper-item-horiz ${currentFormStep === step.id ? 'active' : ''} ${currentFormStep > step.id ? 'completed' : ''}`}
                        onClick={() => setCurrentFormStep(step.id)}
                    >
                        <span className="stepper-label">{step.title}</span>
                        <div className="stepper-line"></div>
                    </div>
                ))}
            </div>

            {/* Form Content Area (Centered) */}
            <div className="form-centered-container">
                <form className="step-form-card fade-in" onSubmit={handleSaveAndNext}>
                    
                    {currentFormStep === 1 && (
                        <div className="step-content-block">
                            <h2>Your plans</h2>
                            <p className="step-desc">Provide information regarding the purpose and duration of your intended stay.</p>
                            <div className="client-form-grid">
                                <div className="client-input-group full-width">
                                    <label>Main purpose of journey</label>
                                    <select className="client-input"><option>Tourism</option><option>Business</option></select>
                                </div>
                                <div className="client-input-group">
                                    <label>Intended date of arrival</label>
                                    <input type="date" className="client-input" />
                                </div>
                                <div className="client-input-group">
                                    <label>Intended date of departure</label>
                                    <input type="date" className="client-input" />
                                </div>
                            </div>
                        </div>
                    )}

                    {currentFormStep === 2 && (
                        <div className="step-content-block">
                            <h2>Your information</h2>
                            <p className="step-desc">Enter your personal details exactly as they appear on your travel document.</p>
                            <div className="client-form-grid">
                                <div className="client-input-group">
                                    <label>First Name (Given Name)</label>
                                    <input type="text" className="client-input" defaultValue={activeApplicant?.firstName} />
                                </div>
                                <div className="client-input-group">
                                    <label>Last Name (Surname)</label>
                                    <input type="text" className="client-input" defaultValue={activeApplicant?.lastName} />
                                </div>
                                <div className="client-input-group">
                                    <label>Date of Birth</label>
                                    <input type="date" className="client-input" />
                                </div>
                                <div className="client-input-group">
                                    <label>Current Nationality</label>
                                    <select className="client-input"><option>Azerbaijan</option></select>
                                </div>
                            </div>
                        </div>
                    )}

                    {(currentFormStep === 3 || currentFormStep === 4 || currentFormStep === 5) && (
                        <div className="step-content-block">
                            <h2>{formSteps.find(s => s.id === currentFormStep)?.title}</h2>
                            <p className="step-desc">Please complete the required fields for this section.</p>
                            <div className="client-form-grid">
                                <div className="client-input-group full-width">
                                    <label>Example Field</label>
                                    <input type="text" className="client-input" placeholder="Data entry..." />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="step-form-footer">
                        <button 
                            type="button" 
                            className="btn-secondary" 
                            onClick={() => setCurrentFormStep(prev => prev - 1)}
                            disabled={currentFormStep === 1}
                        >
                            Previous
                        </button>
                        
                        <button type="submit" className="btn-primary" disabled={isSaving}>
                            {isSaving ? (
                                <>
                                    <svg className="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
                                    Saving...
                                </>
                            ) : (
                                <>{currentFormStep === 5 ? 'Save & Finish' : 'Next'}</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}