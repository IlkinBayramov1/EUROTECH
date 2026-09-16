import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/context/AuthContext';
import { dossierService } from '@/shared/api/services';
import './ClientDashboard.css';

export default function ClientDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [dossier, setDossier] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState(false);

    useEffect(() => {
        let isMounted = true;
        dossierService.getMyDossiers()
            .then(res => {
                if (isMounted && res.data?.dossiers && res.data.dossiers.length > 0) {
                    setDossier(res.data.dossiers[0]);
                }
            })
            .catch(err => {
                console.warn('Dashboard dossier load error:', err);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => { isMounted = false; };
    }, []);

    // Format client name cleanly in Title Case
    const rawName = user?.fullName || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'İlkin Bayramov');
    const clientName = rawName
        .split(' ')
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ') || 'İlkin Bayramov';

    const clientId = user?.username || (user?.id ? `EUR${user.id.substring(0, 5).toUpperCase()}` : 'EUR64764');
    const dossierRef = dossier?.dossierNumber || 'HU-AZ-2026-91529';

    // Status & Progress calculation
    const statusText = dossier?.status ? dossier.status.replace(/_/g, ' ') : 'RECEIVED';
    const currentStepIndex = (() => {
        switch (dossier?.status) {
            case 'RECEIVED': return 1;
            case 'UNDER_REVIEW': return 2;
            case 'NEEDS_CORRECTION': return 3;
            case 'SUBMITTED_TO_CONSULATE': return 4;
            case 'APPROVED': return 5;
            default: return 1;
        }
    })();

    const statusPercentage = (currentStepIndex / 5) * 100;

    const applicantsCount = dossier?.applicants?.length || 1;
    const destinationCountry = dossier?.country?.nameEn || 'Hungary';
    const visaCategoryName = dossier?.visaCategory?.nameEn || 'Schengen C (Short Stay)';
    const appointment = dossier?.appointments?.[0];
    const appointmentText = appointment?.timeSlot 
        ? `${appointment.timeSlot.date?.substring(0, 10) || 'Upcoming'} at ${appointment.timeSlot.startTime || '10:30 AM'}`
        : 'Sep 10, 10:30 AM';

    const handleCopyClientId = () => {
        navigator.clipboard.writeText(clientId);
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
    };

    const handleDownloadDossierSummary = () => {
        const summaryData = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n5 0 obj\n<< /Length 400 >>\nstream\nBT /F1 11 Tf 40 760 Td 15 TL (EUROTECH CLIENT IMMIGRATION DOSSIER SUMMARY) Tj T* (======================================================) Tj T* (Client Name : ${clientName}) Tj T* (Client ID   : ${clientId}) Tj T* (Dossier Ref : ${dossierRef}) Tj T* (Destination : ${destinationCountry} - ${visaCategoryName}) Tj T* (Appointment : ${appointmentText}) Tj T* (Status      : ${statusText}) Tj T* (======================================================) Tj T* (EuroTech Immigration Systems - Verified Electronic Document) Tj ET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000227 00000 n \n0000000300 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n750\n%%EOF`;
        const blob = new Blob([summaryData], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dossier_summary_${clientId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const steps = [
        { num: 1, title: 'Received', desc: 'Dossier Created' },
        { num: 2, title: 'Preparation', desc: 'Document Verification' },
        { num: 3, title: 'Submission', desc: 'Consular Filing' },
        { num: 4, title: 'Consulate', desc: 'Biometrics Review' },
        { num: 5, title: 'Ready', desc: 'Passport Delivery' }
    ];

    return (
        <div className="dashboard-content fade-in">
            {/* --- Ultra-Premium Hero Header --- */}
            <div className="dash-hero-header">
                <div className="hero-titles-wrap">
                    <div className="hero-status-pill">
                        <span className="pulse-dot"></span>
                        <span>Dossier In Progress • {destinationCountry} (Schengen)</span>
                    </div>
                    <h1 className="hero-client-title">
                        Welcome back, <span className="highlight-name">{clientName}</span>!
                    </h1>
                    <p className="hero-client-subtitle">
                        Track your European visa progress, manage consular appointments, and complete required compliance items in real-time.
                    </p>
                </div>
                <div className="hero-actions-wrap">
                    <div className="client-badge-interactive" onClick={handleCopyClientId} title="Click to copy Client ID">
                        <span className="badge-lbl">Client ID</span>
                        <strong className="badge-code">{clientId}</strong>
                        <span className="badge-copy-icon">
                            {copiedId ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            )}
                        </span>
                        {copiedId && <span className="copied-tooltip">Copied!</span>}
                    </div>
                    <button className="btn-hero-primary" onClick={() => navigate('/client/documents')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        Upload Document
                    </button>
                </div>
            </div>

            {/* --- 4 Core Metric KPI Cards --- */}
            <div className="dash-metric-cards-grid">
                {/* 1. Current Status */}
                <div className="metric-kpi-card status-kpi">
                    <div className="kpi-icon-box blue-gradient">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    <div className="kpi-info-block">
                        <span className="kpi-label">Current Status</span>
                        <h3 className="kpi-value">{statusText}</h3>
                        <div className="kpi-pill success">● Step {currentStepIndex} of 5 Active</div>
                    </div>
                </div>

                {/* 2. Documents */}
                <div className="metric-kpi-card docs-kpi">
                    <div className="kpi-icon-box emerald-gradient">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    </div>
                    <div className="kpi-info-block">
                        <span className="kpi-label">Dossier Documents</span>
                        <h3 className="kpi-value">{dossier?.documents?.length || 2} Uploaded</h3>
                        <div className="kpi-pill info">50% Readiness</div>
                    </div>
                </div>

                {/* 3. Appointment */}
                <div className="metric-kpi-card appt-kpi">
                    <div className="kpi-icon-box indigo-gradient">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <div className="kpi-info-block">
                        <span className="kpi-label">Consular Biometrics</span>
                        <h3 className="kpi-value">{appointmentText}</h3>
                        <div className="kpi-pill purple">EuroTech Main Center</div>
                    </div>
                </div>

                {/* 4. Action Required */}
                <div className="metric-kpi-card warning-kpi">
                    <div className="kpi-icon-box amber-gradient">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    </div>
                    <div className="kpi-info-block">
                        <span className="kpi-label">Compliance Tasks</span>
                        <h3 className="kpi-value">1 Action Required</h3>
                        <div className="kpi-pill warning">Review Pending</div>
                    </div>
                </div>
            </div>

            {/* --- Main Dashboard Grid --- */}
            <div className="dash-grid-main">
                {/* LEFT COLUMN: Stepper + To-Do List + Dossier Summary */}
                <div className="dash-col-primary">
                    
                    {/* Visual 5-Step Progress Stepper */}
                    <div className="dash-card-premium progress-card">
                        <div className="card-header-styled">
                            <div className="header-badge-group">
                                <h3>Application Processing Pipeline</h3>
                                <p>Live tracking across European consular stages</p>
                            </div>
                            <span className="dossier-pill-tag">Dossier: <strong>{dossierRef}</strong></span>
                        </div>

                        <div className="pipeline-stepper-wrap">
                            <div className="pipeline-track-bar">
                                <div className="pipeline-track-fill" style={{ width: `${statusPercentage}%` }}></div>
                            </div>
                            <div className="pipeline-steps-list">
                                {steps.map((step) => {
                                    const isDone = step.num < currentStepIndex;
                                    const isCurrent = step.num === currentStepIndex;
                                    return (
                                        <div key={step.num} className={`pipeline-step-node ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}>
                                            <div className="step-circle-badge">
                                                {isDone ? (
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                                ) : (
                                                    <span>{step.num}</span>
                                                )}
                                            </div>
                                            <div className="step-label-group">
                                                <strong className="step-title">{step.title}</strong>
                                                <span className="step-desc">{step.desc}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Stage Info Notice */}
                        <div className="pipeline-status-banner">
                            <div className="banner-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                            </div>
                            <div className="banner-text">
                                <strong>Stage 1 Active: Dossier Received & Legal Pre-Check</strong>
                                <p>EuroTech operators have received your initial files and are currently formatting the consular dossier according to Schengen regulations.</p>
                            </div>
                        </div>
                    </div>

                    {/* To-Do List (Action Items) */}
                    <div className="dash-card-premium todo-card">
                        <div className="card-header-styled">
                            <div className="header-badge-group">
                                <h3>Action Required (Tasks)</h3>
                                <p>Items requiring your review or file upload</p>
                            </div>
                            <span className="badge-counter-warning">1 Pending</span>
                        </div>

                        <div className="todo-items-list">
                            {/* Task 1: Upload Documents */}
                            <div className="todo-item-card urgent">
                                <div className="todo-icon-box orange">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/></svg>
                                </div>
                                <div className="todo-content-box">
                                    <div className="todo-title-row">
                                        <h4>Upload Supporting Documents</h4>
                                        <span className="priority-pill red">Required</span>
                                    </div>
                                    <p>Your passport scan and latest 3-month bank statement are required for biometric submission.</p>
                                </div>
                                <button className="btn-todo-action" onClick={() => navigate('/client/documents')}>
                                    Upload Now
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                                </button>
                            </div>

                            {/* Task 2: Application Form Review */}
                            <div className="todo-item-card review">
                                <div className="todo-icon-box blue">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="16 3 21 8 8 21 3 21 3 16 16 3"/></svg>
                                </div>
                                <div className="todo-content-box">
                                    <div className="todo-title-row">
                                        <h4>Consular Application Review</h4>
                                        <span className="priority-pill blue">Review</span>
                                    </div>
                                    <p>Review the generated consular questionnaire to ensure all personal and itinerary dates match your flight booking.</p>
                                </div>
                                <button className="btn-todo-action outline" onClick={() => navigate('/client/application')}>
                                    Review Form
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                                </button>
                            </div>

                            {/* Task 3: Security Verification (Done) */}
                            <div className="todo-item-card completed">
                                <div className="todo-icon-box green">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                </div>
                                <div className="todo-content-box">
                                    <div className="todo-title-row">
                                        <h4>Security Profile & KYC Verification</h4>
                                        <span className="priority-pill green">Verified</span>
                                    </div>
                                    <p>Your primary digital identity, email verification, and two-factor authentication are certified.</p>
                                </div>
                                <div className="completed-badge">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                                    Done
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Application Summary Box */}
                    <div className="dash-card-premium summary-card">
                        <div className="card-header-styled">
                            <div className="header-badge-group">
                                <h3>Consular Application Summary</h3>
                                <p>Verified parameters for your travel visa</p>
                            </div>
                            <button className="btn-styled-link" onClick={() => navigate('/client/tracking')}>
                                View Full Timeline →
                            </button>
                        </div>
                        <div className="dossier-tiles-grid">
                            <div className="dossier-tile">
                                <span className="tile-lbl">Destination Country</span>
                                <strong className="tile-val">🇭🇺 {destinationCountry}</strong>
                                <small className="tile-sub">Schengen Member State</small>
                            </div>
                            <div className="dossier-tile">
                                <span className="tile-lbl">Visa Category</span>
                                <strong className="tile-val">{visaCategoryName}</strong>
                                <small className="tile-sub">Tourism & Business Visit</small>
                            </div>
                            <div className="dossier-tile">
                                <span className="tile-lbl">Travelers Included</span>
                                <strong className="tile-val">{applicantsCount} Applicant(s)</strong>
                                <small className="tile-sub">{clientName}</small>
                            </div>
                            <div className="dossier-tile">
                                <span className="tile-lbl">Biometrics Appointment</span>
                                <strong className="tile-val">{appointmentText}</strong>
                                <small className="tile-sub">EuroTech Consular Desk</small>
                            </div>
                        </div>
                    </div>

                </div>

                {/* RIGHT COLUMN: Quick Actions, Timeline & VIP Concierge */}
                <div className="dash-col-secondary">
                    
                    {/* Quick Actions Panel */}
                    <div className="dash-card-premium quick-actions-panel">
                        <div className="card-header-styled">
                            <h3>Quick Actions</h3>
                        </div>
                        <div className="quick-actions-btns">
                            <button className="quick-action-link-btn" onClick={() => navigate('/client/appointment')}>
                                <div className="qa-icon blue">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                </div>
                                <div className="qa-text">
                                    <strong>Manage Appointment</strong>
                                    <span>Reschedule or view consular ticket</span>
                                </div>
                                <svg className="qa-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                            </button>

                            <button className="quick-action-link-btn" onClick={() => navigate('/client/documents')}>
                                <div className="qa-icon emerald">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                </div>
                                <div className="qa-text">
                                    <strong>Document Repository</strong>
                                    <span>Upload scans & download verified files</span>
                                </div>
                                <svg className="qa-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                            </button>

                            <button className="quick-action-link-btn" onClick={() => navigate('/client/services')}>
                                <div className="qa-icon purple">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                </div>
                                <div className="qa-text">
                                    <strong>Add-on Services</strong>
                                    <span>Insurance, translation & lounge access</span>
                                </div>
                                <svg className="qa-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                            </button>

                            <button className="quick-action-link-btn" onClick={handleDownloadDossierSummary}>
                                <div className="qa-icon gold">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                </div>
                                <div className="qa-text">
                                    <strong>Dossier Summary (PDF)</strong>
                                    <span>Download certified travel sheet</span>
                                </div>
                                <svg className="qa-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                            </button>
                        </div>
                    </div>

                    {/* Recent Activity Timeline */}
                    <div className="dash-card-premium activity-feed-panel">
                        <div className="card-header-styled">
                            <h3>Audit Activity Feed</h3>
                        </div>
                        <div className="modern-timeline">
                            <div className="timeline-event">
                                <div className="timeline-node active"></div>
                                <div className="timeline-info">
                                    <strong>Biometric Appointment Reserved</strong>
                                    <p>{appointmentText} at EuroTech Center</p>
                                    <span className="timeline-time">Today, 10:30 AM</span>
                                </div>
                            </div>
                            <div className="timeline-event">
                                <div className="timeline-node"></div>
                                <div className="timeline-info">
                                    <strong>Dossier File Initialized</strong>
                                    <p>Reference Code: {dossierRef}</p>
                                    <span className="timeline-time">Yesterday</span>
                                </div>
                            </div>
                            <div className="timeline-event">
                                <div className="timeline-node"></div>
                                <div className="timeline-info">
                                    <strong>Security Profile Verified</strong>
                                    <p>Individual identity checks completed</p>
                                    <span className="timeline-time">2 days ago</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* VIP Premium Lounge Card */}
                    <div className="vip-lounge-banner">
                        <div className="vip-lounge-header">
                            <span className="vip-pill-gold">VIP SERVICES</span>
                            <div className="vip-icon-badge">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            </div>
                        </div>
                        <h3>EuroTech Premium Lounge</h3>
                        <p>Enjoy private biometric processing, refreshments, dedicated visa officers, and zero waiting time at the consulate center.</p>
                        <button className="btn-vip-gold" onClick={() => navigate('/client/services')}>
                            Upgrade for 81.00 AZN
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}