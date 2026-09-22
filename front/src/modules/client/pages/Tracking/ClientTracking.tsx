import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { dossierService } from '@/shared/api/services';
import { useToast } from '@/shared/context/ToastContext';
import './ClientTracking.css';

interface ApplicantInfo {
    id: string;
    name: string;
    firstName?: string;
    lastName?: string;
    passportNumber?: string;
    nationality?: string;
    isPrimary?: boolean;
}

interface TimelineEvent {
    id: string;
    title: string;
    category: 'REGISTRATION' | 'DOCUMENTS' | 'APPOINTMENT' | 'SERVICES' | 'STATUS_UPDATE';
    status: 'COMPLETED' | 'IN_PROGRESS' | 'ALERT' | 'PENDING';
    date: string | Date;
    description: string;
    badge?: string;
    notes?: string;
}

interface TrackingData {
    currentStage: number;
    stageTitle: string;
    stageDescription: string;
    needsCorrection: boolean;
    decision: 'APPROVED' | 'REJECTED' | null;
    events: TimelineEvent[];
    activeAppointment: any;
    servicesCount: number;
    verifiedDocsCount: number;
    totalDocsCount: number;
    estimatedDays: number;
}

export default function ClientTracking() {
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast();

    const [dossier, setDossier] = useState<any>(null);
    const [tracking, setTracking] = useState<TrackingData | null>(null);
    const [applicants, setApplicants] = useState<ApplicantInfo[]>([]);
    const [selectedApplicantId, setSelectedApplicantId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
    const [copiedRef, setCopiedRef] = useState(false);

    const loadTrackingData = useCallback(async (isSilent = false) => {
        if (!isSilent) setIsLoading(true);
        else setIsRefreshing(true);

        try {
            const myDossiersRes = await dossierService.getMyDossiers();
            const dossiers = myDossiersRes.data?.dossiers || [];
            
            if (dossiers.length > 0) {
                const activeDossier = dossiers[0];
                setDossier(activeDossier);

                // Map applicants
                if (activeDossier.applicants && activeDossier.applicants.length > 0) {
                    const mapped = activeDossier.applicants.map((a: any, idx: number) => ({
                        id: a.id,
                        name: `${a.firstName} ${a.lastName} (${idx === 0 ? 'Primary' : 'Co-Applicant'})`,
                        firstName: a.firstName,
                        lastName: a.lastName,
                        passportNumber: a.passportNumber,
                        nationality: a.nationality,
                        isPrimary: idx === 0,
                    }));
                    setApplicants(mapped);
                    if (!selectedApplicantId || !mapped.some((m: any) => m.id === selectedApplicantId)) {
                        setSelectedApplicantId(mapped[0].id);
                    }
                }

                // Fetch dedicated tracking payload
                try {
                    const trackRes = await dossierService.getTracking(activeDossier.dossierNumber || activeDossier.id);
                    if (trackRes.data?.data?.tracking) {
                        setTracking(trackRes.data.data.tracking);
                        if (trackRes.data.data.dossier) {
                            setDossier(trackRes.data.data.dossier);
                        }
                    }
                } catch (trackErr) {
                    console.warn('Dedicated tracking API fallback:', trackErr);
                }
            }
        } catch (err) {
            console.error('Failed to load tracking data:', err);
            showError('Could not load live tracking data. Please refresh.');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [selectedApplicantId, showError]);

    useEffect(() => {
        loadTrackingData();
    }, [loadTrackingData]);

    const handleCopyReference = () => {
        const ref = dossier?.dossierNumber;
        if (ref) {
            navigator.clipboard.writeText(ref);
            setCopiedRef(true);
            showSuccess('Reference number copied to clipboard!');
            setTimeout(() => setCopiedRef(false), 2500);
        }
    };

    const handleDownloadSummaryPdf = async () => {
        const identifier = dossier?.id || dossier?.dossierNumber;
        if (!identifier) return;
        setIsDownloadingPdf(true);
        try {
            const res: any = await dossierService.getDossierSummaryPdf(identifier);
            const payload = res?.data?.data || res?.data || res;
            const downloadUrl = payload?.downloadUrl;
            const fileName = payload?.fileName || `Dossier_Summary_${dossier?.dossierNumber || 'Tracking'}.pdf`;

            if (downloadUrl) {
                const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : `http://localhost:5000${downloadUrl}`;

                try {
                    // Fetch blob to download directly to disk and bypass browser popup blockers
                    const response = await fetch(fullUrl);
                    const blob = await response.blob();
                    const blobUrl = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(blobUrl);
                    showSuccess('Dossier summary slip downloaded successfully!');
                } catch {
                    // Fallback to direct window link
                    const a = document.createElement('a');
                    a.href = fullUrl;
                    a.download = fileName;
                    a.target = '_blank';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    showSuccess('Dossier summary slip opened for download.');
                }
            } else {
                showError('Could not retrieve PDF download link.');
            }
        } catch (err: any) {
            console.error('Download summary PDF error:', err);
            showError('Failed to generate tracking summary PDF.');
        } finally {
            setIsDownloadingPdf(false);
        }
    };

    // Calculate Stepper State
    const currentStep = tracking?.currentStage || (() => {
        switch (dossier?.status) {
            case 'RECEIVED': return 1;
            case 'UNDER_REVIEW': return 2;
            case 'SUBMITTED_TO_CONSULATE': return 4;
            case 'APPROVED': case 'REJECTED': return 5;
            default: return 2;
        }
    })();

    const stages = [
        { id: 1, title: 'File Preparation', desc: 'Compilation & compliance' },
        { id: 2, title: 'Appointment Ready', desc: 'Biometric scheduling' },
        { id: 3, title: 'Submitted at VAC', desc: 'Biometrics provided' },
        { id: 4, title: 'Consular Review', desc: 'Embassy processing' },
        { 
            id: 5, 
            title: tracking?.decision === 'APPROVED' ? 'Visa Issued' : tracking?.decision === 'REJECTED' ? 'Decision Issued' : 'Passport Returned', 
            desc: tracking?.decision === 'APPROVED' ? 'Granted & Ready' : tracking?.decision === 'REJECTED' ? 'Notice issued' : 'Ready for collection' 
        }
    ];

    const progressPercentage = Math.min(100, Math.max(0, ((currentStep - 1) / (stages.length - 1)) * 100));
    const dossierRef = dossier?.dossierNumber || 'HU-AZ-2026-95176';
    const selectedApplicant = applicants.find(a => a.id === selectedApplicantId) || applicants[0];

    // Filter documents for selected applicant
    const applicantDocs = (dossier?.documents || []).filter(
        (d: any) => !d.applicantId || d.applicantId === selectedApplicant?.id
    );
    const verifiedAppDocs = applicantDocs.filter((d: any) => d.status === 'VERIFIED');

    // Active appointment
    const activeAppointment = tracking?.activeAppointment || (dossier?.appointments && dossier.appointments.length > 0 ? dossier.appointments[0] : null);

    const formatDate = (rawDate?: string | Date | null) => {
        if (!rawDate) return '—';
        try {
            return new Intl.DateTimeFormat('en-GB', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            }).format(new Date(rawDate));
        } catch {
            return String(rawDate);
        }
    };

    return (
        <div className="tracking-page-content fade-in">
            {/* Header & Controls */}
            <div className="tracking-header-premium">
                <div className="header-titles">
                    <div className="tracking-badge-row">
                        <span className="live-status-pill">
                            <span className="pulse-indicator"></span>
                            Live Consular Gateway
                        </span>
                        <span className="dossier-pill">{dossierRef}</span>
                        <button 
                            type="button"
                            className="btn-copy-ref" 
                            onClick={handleCopyReference}
                            title="Copy reference number"
                        >
                            {copiedRef ? 'Copied!' : 'Copy Ref'}
                        </button>
                    </div>
                    <h1 className="docs-title">Live Application Tracking</h1>
                    <p className="docs-subtitle">
                        Real-time status, biometric milestones, and consular dispatch updates for your visa dossier.
                    </p>
                </div>
                
                <div className="header-actions-row">
                    <button 
                        type="button"
                        className="btn-refresh-tracking" 
                        onClick={() => loadTrackingData(true)}
                        disabled={isRefreshing}
                        title="Refresh latest consular tracking updates"
                    >
                        <svg className={isRefreshing ? 'spinner' : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M23 4v6h-6"/>
                            <path d="M1 20v-6h6"/>
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                        </svg>
                        {isRefreshing ? 'Syncing...' : 'Refresh Status'}
                    </button>

                    <div className="applicant-selector-box tracking-selector">
                        <label htmlFor="tracking-applicant-select">Tracking Status For:</label>
                        <div className="premium-select-wrapper compact">
                            <select 
                                id="tracking-applicant-select"
                                value={selectedApplicantId} 
                                onChange={(e) => setSelectedApplicantId(e.target.value)}
                            >
                                {applicants.map(app => (
                                    <option key={app.id} value={app.id}>{app.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* High Priority Alerts (Needs Correction / Approved / Rejected) */}
            {tracking?.needsCorrection && (
                <div className="tracking-alert-banner alert-warning fade-in">
                    <div className="alert-icon-wrap">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    </div>
                    <div className="alert-content">
                        <h4>Action Required: Additional Information Requested</h4>
                        <p>
                            The consular compliance officer has requested additional documentation or form corrections before proceeding.
                        </p>
                        {tracking.events.find(e => e.status === 'ALERT')?.description && (
                            <div className="alert-officer-note">
                                <strong>Officer Note:</strong> {tracking.events.find(e => e.status === 'ALERT')?.description}
                            </div>
                        )}
                    </div>
                    <button 
                        type="button" 
                        className="btn-alert-action" 
                        onClick={() => navigate('/client/documents')}
                    >
                        Review Documents
                    </button>
                </div>
            )}

            {tracking?.decision === 'APPROVED' && (
                <div className="tracking-alert-banner alert-success fade-in">
                    <div className="alert-icon-wrap success">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <div className="alert-content">
                        <h4>Congratulations! Your Visa Has Been Approved</h4>
                        <p>
                            The Consular Authority has officially granted your Schengen visa. Your passport with the attached visa counterfoil is prepared for collection or courier dispatch.
                        </p>
                    </div>
                    <button 
                        type="button" 
                        className="btn-alert-action success" 
                        onClick={handleDownloadSummaryPdf}
                        disabled={isDownloadingPdf}
                    >
                        Download Approval Slip
                    </button>
                </div>
            )}

            {tracking?.decision === 'REJECTED' && (
                <div className="tracking-alert-banner alert-danger fade-in">
                    <div className="alert-icon-wrap danger">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    </div>
                    <div className="alert-content">
                        <h4>Consular Decision Concluded</h4>
                        <p>
                            The consular evaluation has concluded and an official consular decision notification letter has been issued.
                        </p>
                    </div>
                </div>
            )}

            {/* Top Stepper (Premium Horizontal Timeline) */}
            <div className="tracking-stepper-card">
                <div className="stepper-header-info">
                    <div>
                        <span className="stepper-stage-tag">Current Milestone: Stage {currentStep} of 5</span>
                        <h3 className="stepper-stage-title">{tracking?.stageTitle || stages[currentStep - 1]?.title}</h3>
                    </div>
                    <p className="stepper-stage-desc">{tracking?.stageDescription || stages[currentStep - 1]?.desc}</p>
                </div>

                <div className="stepper-wrapper">
                    <div className="stepper-track-bg"></div>
                    <div className="stepper-track-fill" style={{ width: `${progressPercentage}%` }}></div>

                    {stages.map((stage) => {
                        const isActive = currentStep === stage.id;
                        const isCompleted = currentStep > stage.id;
                        const isPending = currentStep < stage.id;
                        const isApprovedOutcome = stage.id === 5 && tracking?.decision === 'APPROVED';
                        const isRejectedOutcome = stage.id === 5 && tracking?.decision === 'REJECTED';

                        return (
                            <div 
                                key={stage.id} 
                                className={`stepper-node ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isPending ? 'pending' : ''} ${isApprovedOutcome ? 'outcome-approved' : ''} ${isRejectedOutcome ? 'outcome-rejected' : ''}`}
                            >
                                <div className="node-icon-circle">
                                    {isCompleted ? (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    ) : isApprovedOutcome ? (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                    ) : isRejectedOutcome ? (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
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

            {/* Main Layout Grid */}
            <div className="tracking-layout-grid">
                {/* Left Column: Detailed Real Timeline */}
                <div className="tracking-history-column">
                    <div className="tracking-card">
                        <div className="card-title-row">
                            <div>
                                <h3>Official Tracking Milestones</h3>
                                <p className="card-subtitle">Real-time audit log synchronized with the EuroTech Consular Database.</p>
                            </div>
                            <span className="milestones-count">
                                {tracking?.events ? `${tracking.events.length} Milestones` : 'Live'}
                            </span>
                        </div>
                        
                        <div className="vertical-timeline">
                            {tracking?.events && tracking.events.length > 0 ? (
                                tracking.events.map((evt, idx) => {
                                    const isFirst = idx === 0;
                                    const isAlert = evt.status === 'ALERT';

                                    return (
                                        <div key={evt.id || idx} className={`timeline-item ${isFirst ? 'active' : 'completed'} ${isAlert ? 'item-alert' : ''}`}>
                                            <div className="timeline-icon">
                                                {evt.category === 'APPOINTMENT' ? (
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                                ) : evt.category === 'DOCUMENTS' ? (
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
                                                ) : evt.category === 'SERVICES' ? (
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                                                ) : isAlert ? (
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                                ) : (
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                                )}
                                            </div>

                                            <div className="timeline-content">
                                                <div className="timeline-header-meta">
                                                    <h4>{evt.title}</h4>
                                                    <span className="timeline-time-badge">{formatDate(evt.date)}</span>
                                                </div>
                                                <p>{evt.description}</p>
                                                {evt.badge && (
                                                    <div className="timeline-tags-row">
                                                        <span className="timeline-tag">{evt.badge}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <>
                                    {activeAppointment && (
                                        <div className="timeline-item active">
                                            <div className="timeline-icon">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                            </div>
                                            <div className="timeline-content">
                                                <div className="timeline-header-meta">
                                                    <h4>Appointment Slot Confirmed</h4>
                                                    <span className="timeline-time-badge">{formatDate(activeAppointment.appointmentDate)}</span>
                                                </div>
                                                <p>
                                                    Confirmed biometric slot at {activeAppointment.location || 'EuroTech Visa Center'} ({activeAppointment.timeSlot?.startTime || 'Confirmed'}).
                                                </p>
                                                <span className="timeline-tag">{activeAppointment.referenceNumber || 'CONFIRMED'}</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="timeline-item completed">
                                        <div className="timeline-icon">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                        </div>
                                        <div className="timeline-content">
                                            <div className="timeline-header-meta">
                                                <h4>Dossier Initialized & Registered</h4>
                                                <span className="timeline-time-badge">{formatDate(dossier?.createdAt)}</span>
                                            </div>
                                            <p>Your online application was registered in the EuroTech consular gateway. Reference assigned.</p>
                                            <span className="timeline-tag">{dossierRef}</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Rich Dossier Metadata Sidebar */}
                <aside className="tracking-summary-column">
                    <div className="tracking-card sticky-sidebar">
                        <div className="metadata-card-header">
                            <h3>Dossier Metadata</h3>
                            <span className={`meta-status-pill status-${(dossier?.status || 'RECEIVED').toLowerCase()}`}>
                                {dossier?.status?.replace(/_/g, ' ') || 'RECEIVED'}
                            </span>
                        </div>

                        <div className="metadata-rows-list">
                            <div className="metadata-row">
                                <span className="meta-label">Reference Number:</span>
                                <div className="meta-val-copy">
                                    <strong>{dossierRef}</strong>
                                    <button 
                                        type="button" 
                                        className="btn-icon-copy" 
                                        onClick={handleCopyReference}
                                        title="Copy reference code"
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                    </button>
                                </div>
                            </div>

                            <div className="metadata-row">
                                <span className="meta-label">Destination Country:</span>
                                <strong className="meta-country-val">
                                    <span className="flag-icon-circle">🇭🇺</span>
                                    {dossier?.country?.nameEn || 'Hungary'}
                                </strong>
                            </div>

                            <div className="metadata-row">
                                <span className="meta-label">Visa Category:</span>
                                <strong>{dossier?.visaCategory?.nameEn || 'Schengen Tourist (C)'}</strong>
                            </div>

                            <div className="metadata-row">
                                <span className="meta-label">Selected Applicant:</span>
                                <div className="meta-val-stacked">
                                    <strong>{selectedApplicant?.name?.split(' (')[0] || 'Primary Applicant'}</strong>
                                    <span className="sub-val">Passport: {selectedApplicant?.passportNumber || '—'}</span>
                                </div>
                            </div>

                            <div className="metadata-row">
                                <span className="meta-label">Biometric Appointment:</span>
                                {activeAppointment ? (
                                    <div className="meta-val-stacked">
                                        <strong className="text-success-green">
                                            {formatDate(activeAppointment.appointmentDate).split(',')[0]} ({activeAppointment.timeSlot?.startTime || 'Scheduled'})
                                        </strong>
                                        <span className="sub-val">{activeAppointment.location}</span>
                                    </div>
                                ) : (
                                    <div className="meta-val-stacked">
                                        <span className="text-warning-amber">Not yet booked</span>
                                        <button 
                                            type="button" 
                                            className="btn-link-action"
                                            onClick={() => navigate('/client/appointment')}
                                        >
                                            Schedule Now &rarr;
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="metadata-row">
                                <span className="meta-label">Document Progress:</span>
                                <strong>{verifiedAppDocs.length} / {applicantDocs.length} Verified</strong>
                            </div>

                            <div className="metadata-row">
                                <span className="meta-label">Active Extra Services:</span>
                                <strong>{dossier?.services?.length || 0} Service(s)</strong>
                            </div>

                            <div className="metadata-row">
                                <span className="meta-label">Payment Status:</span>
                                <strong className={`payment-pill ${dossier?.paymentStatus === 'PAID' ? 'paid' : 'pending'}`}>
                                    {dossier?.paymentStatus || 'PENDING'} ({(dossier?.totalAmount || 200).toFixed(2)} AZN)
                                </strong>
                            </div>

                            <div className="metadata-row">
                                <span className="meta-label">Standard Processing ETA:</span>
                                <strong className="text-muted-standard">~15 Calendar Days</strong>
                            </div>
                        </div>

                        <div className="sidebar-actions-section">
                            <button 
                                type="button" 
                                className="btn-primary btn-summary-pdf" 
                                onClick={handleDownloadSummaryPdf}
                                disabled={isDownloadingPdf}
                            >
                                {isDownloadingPdf ? (
                                    <>
                                        <svg className="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                                        Generating PDF...
                                    </>
                                ) : (
                                    <>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                        Download Tracking Slip (PDF)
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}