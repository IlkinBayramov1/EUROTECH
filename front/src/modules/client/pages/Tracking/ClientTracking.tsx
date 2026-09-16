import React, { useState, useEffect } from 'react';
import { dossierService } from '@/shared/api/services';
import './ClientTracking.css';

export default function ClientTracking() {
    const [dossier, setDossier] = useState<any>(null);
    const [selectedApplicant, setSelectedApplicant] = useState('app-1');
    const [applicants, setApplicants] = useState([
        { id: 'app-1', name: 'Primary Applicant' },
    ]);

    useEffect(() => {
        dossierService.getMyDossiers()
            .then(res => {
                if (res.data?.dossiers && res.data.dossiers.length > 0) {
                    const active = res.data.dossiers[0];
                    setDossier(active);
                    if (active.applicants && active.applicants.length > 0) {
                        const mapped = active.applicants.map((a: any, idx: number) => ({
                            id: a.id,
                            name: `${a.firstName} ${a.lastName} (${idx === 0 ? 'Primary' : 'Co-Applicant'})`,
                        }));
                        setApplicants(mapped);
                        setSelectedApplicant(mapped[0].id);
                    }
                }
            })
            .catch(() => {});
    }, []);

    // Map backend status to 1-5 steps
    const currentStep = (() => {
        switch (dossier?.status) {
            case 'RECEIVED': return 1;
            case 'UNDER_REVIEW': return 2;
            case 'SUBMITTED_TO_CONSULATE': return 3;
            case 'APPROVED': case 'REJECTED': return 5;
            default: return 2;
        }
    })();

    const stages = [
        { id: 1, title: 'File Preparation', desc: 'Dossier compilation' },
        { id: 2, title: 'Ready for Appt.', desc: 'Awaiting submission' },
        { id: 3, title: 'Submitted at VAC', desc: 'Biometrics provided' },
        { id: 4, title: 'Consular Review', desc: 'Embassy processing' },
        { id: 5, title: 'Passport Returned', desc: 'Ready for collection' }
    ];

    const progressPercentage = ((currentStep - 1) / (stages.length - 1)) * 100;
    const dossierRef = dossier?.dossierNumber || '#ET-2026-8904';

    return (
        <div className="tracking-page-content fade-in">
            {/* Header & Applicant Selector */}
            <div className="tracking-header-premium">
                <div className="header-titles">
                    <h1 className="docs-title">Live Application Tracking</h1>
                    <p className="docs-subtitle">Monitor the real-time status of your visa dossier. Reference: <strong>{dossierRef}</strong></p>
                </div>
                
                <div className="header-actions-row">
                    <div className="applicant-selector-box tracking-selector">
                        <label>Tracking Status For:</label>
                        <div className="premium-select-wrapper compact">
                            <select 
                                value={selectedApplicant} 
                                onChange={(e) => setSelectedApplicant(e.target.value)}
                            >
                                {applicants.map(app => (
                                    <option key={app.id} value={app.id}>{app.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Stepper (Premium Horizontal Timeline) */}
            <div className="tracking-stepper-card">
                <div className="stepper-wrapper">
                    <div className="stepper-track-bg"></div>
                    <div className="stepper-track-fill" style={{ width: `${progressPercentage}%` }}></div>

                    {stages.map((stage) => {
                        const isActive = currentStep === stage.id;
                        const isCompleted = currentStep > stage.id;
                        const isPending = currentStep < stage.id;

                        return (
                            <div key={stage.id} className={`stepper-node ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isPending ? 'pending' : ''}`}>
                                <div className="node-icon-circle">
                                    {isCompleted ? (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    ) : isActive ? (
                                        <div className="pulse-dot"></div>
                                    ) : (
                                        <span>{stage.id}</span>
                                    )}
                                </div>
                                <div className="node-text">
                                    <h4>{stage.title}</h4>
                                    <p>{stage.desc}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="tracking-layout-grid">
                {/* Sol Tərəf: Detallı Tarixçə (Timeline) */}
                <div className="tracking-history-column">
                    <div className="tracking-card">
                        <h3>Detailed Tracking History</h3>
                        
                        <div className="vertical-timeline">
                            {currentStep >= 3 && (
                                <div className="timeline-item active">
                                    <div className="timeline-icon">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                    </div>
                                    <div className="timeline-content">
                                        <h4>Application Submitted at VAC</h4>
                                        <p>The applicant successfully attended the appointment at the official Visa Application Center (VAC). Biometrics were collected and the physical dossier was handed over. The application is now en route to the Embassy.</p>
                                        <span className="timeline-date">Active Milestone</span>
                                    </div>
                                </div>
                            )}

                            {currentStep >= 2 && (
                                <div className={`timeline-item ${currentStep === 2 ? 'active' : 'completed'}`}>
                                    <div className="timeline-icon">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                    </div>
                                    <div className="timeline-content">
                                        <h4>Appointment Slot Reserved</h4>
                                        <p>Biometric appointment confirmed at EuroTech Visa Center. Dossier files compiled and ready for review.</p>
                                        <span className="timeline-date">Confirmed Schedule</span>
                                    </div>
                                </div>
                            )}

                            <div className="timeline-item completed">
                                <div className="timeline-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                </div>
                                <div className="timeline-content">
                                    <h4>Dossier Initialized & Received</h4>
                                    <p>Your online application was successfully registered in the EuroTech consular network. Reference code assigned.</p>
                                    <span className="timeline-date">{dossierRef}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sağ Tərəf: Xülasə Kartı */}
                <div className="tracking-summary-column">
                    <div className="tracking-card">
                        <h3>Dossier Metadata</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1E293B', paddingBottom: '10px' }}>
                                <span style={{ color: '#94A3B8', fontSize: '13px' }}>Reference:</span>
                                <strong style={{ color: '#F1F5F9', fontSize: '13px' }}>{dossierRef}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1E293B', paddingBottom: '10px' }}>
                                <span style={{ color: '#94A3B8', fontSize: '13px' }}>Destination:</span>
                                <strong style={{ color: '#F1F5F9', fontSize: '13px' }}>{dossier?.country?.nameEn || 'Hungary'}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1E293B', paddingBottom: '10px' }}>
                                <span style={{ color: '#94A3B8', fontSize: '13px' }}>Status:</span>
                                <strong style={{ color: '#3B82F6', fontSize: '13px' }}>{dossier?.status || 'UNDER_REVIEW'}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#94A3B8', fontSize: '13px' }}>Travelers:</span>
                                <strong style={{ color: '#F1F5F9', fontSize: '13px' }}>{applicants.length} Applicant(s)</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}