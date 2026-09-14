import React, { useState } from 'react';
import './ClientTracking.css';

export default function ClientTracking() {
    // Sərnişin Seçimi
    const [selectedApplicant, setSelectedApplicant] = useState('app-1');
    const applicants = [
        { id: 'app-1', name: 'Ali Mammadov (Primary)' },
        { id: 'app-2', name: 'Leyla Mammadova (Co-Applicant)' }
    ];

    // Viza Dəstək Şirkəti üçün məntiqi izləmə mərhələləri
    const currentStep = 3; // Simulyasiya: 3-cü mərhələ (Submitted at VAC)

    const stages = [
        { id: 1, title: 'File Preparation', desc: 'Dossier compilation' },
        { id: 2, title: 'Ready for Appt.', desc: 'Awaiting submission' },
        { id: 3, title: 'Submitted at VAC', desc: 'Biometrics provided' },
        { id: 4, title: 'Consular Review', desc: 'Embassy processing' },
        { id: 5, title: 'Passport Returned', desc: 'Ready for collection' }
    ];

    // Proqress çubuğunun dolma faizi
    const progressPercentage = ((currentStep - 1) / (stages.length - 1)) * 100;

    return (
        <div className="tracking-page-content fade-in">
            {/* Header & Applicant Selector */}
            <div className="tracking-header-premium">
                <div className="header-titles">
                    <h1 className="docs-title">Live Application Tracking</h1>
                    <p className="docs-subtitle">Monitor the real-time status of your visa dossier. Reference: <strong>#ET-2026-8904</strong></p>
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
                    {/* Arxa fon xətti və dolan xətt */}
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
                            {/* Mərhələ 3: Viza mərkəzində təhvil verildi */}
                            <div className="timeline-item active">
                                <div className="timeline-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                </div>
                                <div className="timeline-content">
                                    <h4>Application Submitted at VAC</h4>
                                    <p>The applicant successfully attended the appointment at the official Visa Application Center (VAC). Biometrics were collected and the physical dossier was handed over. The application is now en route to the Embassy.</p>
                                    <span className="timeline-date">Sep 6, 2026 • 10:45 AM</span>
                                </div>
                            </div>

                            {/* Mərhələ 2: Randevu gözlənilir */}
                            <div className="timeline-item">
                                <div className="timeline-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                </div>
                                <div className="timeline-content">
                                    <h4>Ready for Appointment</h4>
                                    <p>The dossier has been perfectly compiled by our experts. The applicant is scheduled to visit the Visa Application Center on Sep 6, 2026.</p>
                                    <span className="timeline-date">Sep 2, 2026 • 15:30 PM</span>
                                </div>
                            </div>

                            {/* Mərhələ 1: Sənədlərin hazırlanması */}
                            <div className="timeline-item">
                                <div className="timeline-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                </div>
                                <div className="timeline-content">
                                    <h4>File Preparation Initiated</h4>
                                    <p>All required documents have been successfully verified by EuroTech. Our visa experts are compiling the final dossier and booking the embassy appointment.</p>
                                    <span className="timeline-date">Aug 28, 2026 • 09:15 AM</span>
                                </div>
                            </div>

                            {/* Mərhələ 0: İlkin ödəniş */}
                            <div className="timeline-item">
                                <div className="timeline-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                                </div>
                                <div className="timeline-content">
                                    <h4>Service Request Confirmed</h4>
                                    <p>Initial application wizard completed and premium services paid successfully.</p>
                                    <span className="timeline-date">Aug 26, 2026 • 16:20 PM</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sağ Tərəf: ETA və Dəstək */}
                <aside className="tracking-sidebar-column">

                    <div className="tracking-card support-card">
                        <h3>Need Assistance?</h3>
                        <p>If you have any questions regarding your appointment or application status, your dedicated visa expert is ready to assist.</p>
                        <button className="btn-secondary support-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            Contact Support
                        </button>
                    </div>
                </aside>
            </div>
        </div>
    );
}