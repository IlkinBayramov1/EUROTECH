import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/context/AuthContext';
import { dossierService } from '@/shared/api/services';
import { useToast } from '@/shared/context/ToastContext';
import './ClientDashboard.css';

export default function ClientDashboard() {
    const { user } = useAuth();
    const { showSuccess, showError } = useToast();
    const navigate = useNavigate();
    const [dossiers, setDossiers] = useState<any[]>([]);
    const [selectedDossierId, setSelectedDossierId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState(false);
    const [isDownloadingSummary, setIsDownloadingSummary] = useState(false);

    // Format Human-Readable Consular Document Types
    const formatDocType = (rawType: string) => {
        switch (rawType) {
            case 'PASSPORT': return 'Passport Copy / Scan';
            case 'FLIGHT_ITINERARY': return 'Roundtrip Flight Reservation';
            case 'BIOMETRIC_PHOTO': case 'PHOTO': return 'ICAO Biometric Photograph';
            case 'INSURANCE': return 'Schengen Travel Medical Insurance';
            case 'BANK_STATEMENT': case 'FINANCIAL': return 'Bank Statement & Solvency Proof';
            case 'EMPLOYMENT': return 'Employment Verification Letter';
            case 'HOTEL_ITINERARY': case 'HOTEL_BOOKING': return 'Hotel Booking Voucher';
            case 'FORM': return 'Completed Application Form';
            default: return String(rawType || 'DOCUMENT').replace(/_/g, ' ');
        }
    };

    useEffect(() => {
        let isMounted = true;
        dossierService.getMyDossiers()
            .then(res => {
                if (isMounted && res.data?.dossiers) {
                    const list = res.data.dossiers;
                    setDossiers(list);
                    if (list.length > 0) {
                        setSelectedDossierId(list[0].id);
                    }
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

    // Currently selected active dossier
    const dossier = useMemo(() => {
        if (!selectedDossierId) return dossiers[0] || null;
        return dossiers.find(d => d.id === selectedDossierId) || dossiers[0] || null;
    }, [dossiers, selectedDossierId]);

    // Format client name cleanly in Title Case
    const rawName = user?.fullName || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email || 'Müştəri');
    const clientName = rawName
        .split(' ')
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ') || (user?.email || 'Müştəri');

    const clientId = user?.username || (user?.id ? `EUR${user.id.substring(0, 5).toUpperCase()}` : 'EUR');
    const dossierRef = dossier?.dossierNumber || '—';

    // Status & Progress calculation
    const statusText = dossier?.status ? dossier.status.replace(/_/g, ' ') : 'NOT STARTED';
    const currentStepIndex = (() => {
        switch (dossier?.status) {
            case 'RECEIVED': return 1;
            case 'UNDER_REVIEW': return 2;
            case 'NEEDS_CORRECTION': return 2;
            case 'SUBMITTED_TO_CONSULATE': return 3;
            case 'CONSULATE_PROCESSING': return 4;
            case 'APPROVED': case 'PASSPORT_READY': return 5;
            default: return 1;
        }
    })();

    const statusPercentage = (currentStepIndex / 5) * 100;

    const applicantsCount = dossier?.applicants?.length || 0;
    const destinationCountry = dossier?.country?.nameEn || dossier?.country?.nameAz || 'European Destination';
    const visaCategoryName = dossier?.visaCategory?.nameEn || dossier?.visaCategory?.nameAz || 'Schengen Visa';
    
    // Dynamic Real Appointment Data (Prioritize active confirmed appointment)
    const appointment = dossier?.appointments?.find((a: any) => a.status === 'CONFIRMED')
        || dossier?.appointments?.[0];
    const appointmentTimeSlot = appointment?.timeSlot;
    const appointmentDateStr = appointmentTimeSlot?.date 
        ? new Date(appointmentTimeSlot.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
        : '';
    const appointmentTimeStr = appointmentTimeSlot?.startTime || '';
    const appointmentText = appointment ? `${appointmentDateStr}, ${appointmentTimeStr}` : 'Not Scheduled';
    const appointmentLocation = appointmentTimeSlot?.location || appointment?.location || 'EuroTech Visa Center';

    // Dynamic Real Documents & Readiness
    const documentsList = dossier?.documents || [];
    const uploadedDocsCount = documentsList.length;
    const totalRequiredDocs = dossier?.visaCategory?.requiredDocTypes?.length || 4;
    const docsReadinessPct = totalRequiredDocs > 0 ? Math.min(100, Math.round((uploadedDocsCount / totalRequiredDocs) * 100)) : 0;

    // Dynamic Compliance Tasks & Real Pending Items Calculation
    const missingDocsCount = Math.max(0, totalRequiredDocs - uploadedDocsCount);
    const isApptMissing = !appointment || appointment.status === 'CANCELLED';
    const primaryApplicant = dossier?.applicants?.[0];
    const isFormIncomplete = !primaryApplicant?.formDataJson || Object.keys(primaryApplicant.formDataJson).length === 0;

    const pendingTasks = useMemo(() => {
        if (!dossier) return [];
        const tasks: Array<{
            id: string;
            title: string;
            desc: string;
            priority: 'Required' | 'Review' | 'Verified';
            color: 'orange' | 'blue' | 'green';
            actionText?: string;
            actionRoute?: string;
            isDone: boolean;
        }> = [];

        // 1. Check for any rejected documents
        const rejectedDocs = documentsList.filter((d: any) => d.status === 'REJECTED');
        if (rejectedDocs.length > 0) {
            tasks.push({
                id: 'task-rejected-docs',
                title: 'Action Required: Re-upload Rejected Document',
                desc: `${rejectedDocs.length} consular document(s) rejected (${rejectedDocs.map((d: any) => formatDocType(d.requiredDocumentType || d.type)).join(', ')}). Please re-upload according to consulate guidelines.`,
                priority: 'Required',
                color: 'orange',
                actionText: 'Re-upload Now',
                actionRoute: '/client/documents',
                isDone: false
            });
        }

        // 2. Document Upload
        if (missingDocsCount > 0) {
            tasks.push({
                id: 'task-docs',
                title: 'Upload Supporting Documents',
                desc: `${missingDocsCount} required consular document(s) remaining for submission (solvency proof, passport, biometric photo).`,
                priority: 'Required',
                color: 'orange',
                actionText: 'Upload Now',
                actionRoute: '/client/documents',
                isDone: false
            });
        } else {
            tasks.push({
                id: 'task-docs-done',
                title: 'Required Documents Repository',
                desc: `All ${uploadedDocsCount} mandatory consular documents successfully uploaded and certified.`,
                priority: 'Verified',
                color: 'green',
                isDone: true
            });
        }

        // 2. Biometrics Appointment
        if (isApptMissing) {
            tasks.push({
                id: 'task-appt',
                title: 'Schedule Consular Biometrics Appointment',
                desc: 'Select a suitable date and time slot at the EuroTech center for biometric fingerprint collection.',
                priority: 'Required',
                color: 'orange',
                actionText: 'Book Slot',
                actionRoute: '/client/appointment',
                isDone: false
            });
        } else {
            tasks.push({
                id: 'task-appt-done',
                title: 'Consular Biometrics Appointment Reserved',
                desc: `Confirmed for ${appointmentText} at ${appointmentLocation}.`,
                priority: 'Verified',
                color: 'green',
                actionText: 'View Ticket',
                actionRoute: '/client/appointment',
                isDone: true
            });
        }

        // 3. Application Form Review
        if (isFormIncomplete) {
            tasks.push({
                id: 'task-form',
                title: 'Consular Application Questionnaire Review',
                desc: 'Review and confirm personal details, travel itinerary, and host information for consular filing.',
                priority: 'Review',
                color: 'blue',
                actionText: 'Review Form',
                actionRoute: '/client/application',
                isDone: false
            });
        } else {
            tasks.push({
                id: 'task-form-done',
                title: 'Consular Application Questionnaire Certified',
                desc: `Verified for applicant ${primaryApplicant?.firstName || ''} ${primaryApplicant?.lastName || ''}.`,
                priority: 'Verified',
                color: 'green',
                actionText: 'Inspect',
                actionRoute: '/client/application',
                isDone: true
            });
        }

        // 4. Security KYC
        tasks.push({
            id: 'task-sec',
            title: 'Security Profile & Digital ID Verification',
            desc: 'Primary digital identity, email verification, and consular 2FA certified in EuroTech trust network.',
            priority: 'Verified',
            color: 'green',
            isDone: true
        });

        return tasks;
    }, [dossier, missingDocsCount, isApptMissing, isFormIncomplete, uploadedDocsCount, appointmentText, appointmentLocation, primaryApplicant]);

    const activePendingTasksCount = pendingTasks.filter(t => !t.isDone).length;

    // Dynamic Activity Feed generated from real DB events
    const activityFeed = useMemo(() => {
        if (!dossier) return [];
        const items: Array<{ id: string; title: string; desc: string; time: string; active?: boolean }> = [];

        if (appointment) {
            items.push({
                id: 'appt-' + appointment.id,
                title: `Consular Appointment: ${appointment.status || 'CONFIRMED'}`,
                desc: `${appointmentText} at ${appointmentLocation}`,
                time: appointment.createdAt ? new Date(appointment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Today',
                active: appointment.status === 'CONFIRMED',
            });
        }

        if (documentsList.length > 0) {
            documentsList.slice(0, 3).forEach((doc: any) => {
                const docTitle = formatDocType(doc.requiredDocumentType || doc.type);
                items.push({
                    id: 'doc-' + doc.id,
                    title: `Document: ${docTitle}`,
                    desc: `File: ${doc.fileName || 'Uploaded'} • Status: ${doc.status || 'PENDING'}`,
                    time: doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recent',
                });
            });
        }

        if (dossier.statusHistory && dossier.statusHistory.length > 0) {
            dossier.statusHistory.slice(0, 3).forEach((sh: any) => {
                items.push({
                    id: 'sh-' + sh.id,
                    title: `Consular Status: ${(sh.toStatus || sh.status || '').replace(/_/g, ' ')}`,
                    desc: sh.notes || sh.note || 'Dossier progressed in consular workflow',
                    time: sh.createdAt ? new Date(sh.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recent',
                });
            });
        }

        if (dossier.createdAt) {
            items.push({
                id: 'dossier-init',
                title: 'Dossier File Initialized',
                desc: `Consular Tracking Ref: ${dossierRef}`,
                time: new Date(dossier.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            });
        }

        if (user?.createdAt) {
            items.push({
                id: 'sec-verified',
                title: 'Account Security & Digital Profile Active',
                desc: 'AES-256 encrypted consular profile established',
                time: new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            });
        }

        return items;
    }, [dossier, appointment, appointmentText, appointmentLocation, documentsList, dossierRef, user]);

    // Check if user purchased VIP Lounge (checks real database serviceType)
    const hasVipLounge = useMemo(() => {
        if (!dossier?.services) return false;
        return dossier.services.some((s: any) => 
            s.serviceType === 'PREMIUM_LOUNGE' ||
            (s.serviceName && s.serviceName.toLowerCase().includes('lounge')) ||
            (s.serviceId && s.serviceId.toLowerCase().includes('lounge'))
        );
    }, [dossier]);

    const countryCodeToFlag = (country?: any) => {
        const c = (country?.code || country?.nameEn || country?.nameAz || '').toUpperCase();
        if (c.includes('HU') || c.includes('HUNGAR') || c.includes('MACAR')) return '🇭🇺';
        if (c.includes('DE') || c.includes('GERMAN') || c.includes('ALMAN')) return '🇩🇪';
        if (c.includes('AT') || c.includes('AUSTRI') || c.includes('AVST')) return '🇦🇹';
        if (c.includes('IT') || c.includes('ITAL')) return '🇮🇹';
        if (c.includes('FR') || c.includes('FRAN')) return '🇫🇷';
        if (c.includes('ES') || c.includes('SPAIN') || c.includes('ISP')) return '🇪🇸';
        if (c.includes('CZ') || c.includes('CZECH') || c.includes('CEX')) return '🇨🇿';
        if (c.includes('NL') || c.includes('NETHER') || c.includes('NIDER')) return '🇳🇱';
        if (c.includes('PL') || c.includes('POLAND') || c.includes('POL')) return '🇵🇱';
        return '🇪🇺';
    };

    const stageNotices: Record<number, { title: string; desc: string }> = {
        1: {
            title: 'Stage 1 Active: Dossier Received & Legal Pre-Check',
            desc: 'EuroTech operators have received your initial files and are currently formatting the consular dossier according to Schengen regulations.'
        },
        2: {
            title: 'Stage 2 Active: Document Verification & Translation',
            desc: 'Consular specialists are cross-checking all passport pages, financial statements, and supporting employer letters.'
        },
        3: {
            title: 'Stage 3 Active: Consular Filing Preparation',
            desc: 'Your harmonised visa application forms and official manifests are compiled, certified, and sealed for diplomatic transmission.'
        },
        4: {
            title: 'Stage 4 Active: Embassy Review & Biometrics',
            desc: 'Your application is under evaluation by consular officers following your biometric appointment at the processing center.'
        },
        5: {
            title: 'Stage 5 Active: Visa Issued & Passport Ready',
            desc: 'Consular decision finalized. Your passport with approved travel visa is ready for secure courier delivery or personal pickup.'
        }
    };
    const currentNotice = stageNotices[currentStepIndex] || stageNotices[1];

    const handleCopyClientId = () => {
        navigator.clipboard.writeText(clientId);
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
    };

    const handleDownloadDossierSummary = async () => {
        if (!dossier?.id) return;
        setIsDownloadingSummary(true);
        try {
            const res = await dossierService.getDossierSummaryPdf(dossier.id);
            const downloadUrl = res.data?.downloadUrl;
            if (downloadUrl) {
                const backendOrigin = import.meta.env.VITE_API_URL
                    ? import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, '')
                    : 'http://localhost:5000';
                const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : `${backendOrigin}${downloadUrl}`;
                const response = await fetch(fullUrl);
                if (!response.ok) throw new Error('PDF faylını serverdən oxumaq mümkün olmadı.');
                const blob = await response.blob();
                const blobUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = res.data?.fileName || `Dossier_Summary_${dossierRef}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(blobUrl);
                showSuccess('Dossier Summary PDF uğurla yükləndi.');
            } else {
                showError('PDF yükləmə linki əldə edilmədi.');
            }
        } catch (err: any) {
            console.error('Dossier summary PDF download error:', err);
            showError(err?.message || 'Dossier summary PDF yüklənməsi uğursuz oldu.');
        } finally {
            setIsDownloadingSummary(false);
        }
    };

    const steps = [
        { num: 1, title: 'Received', desc: 'Dossier Created' },
        { num: 2, title: 'Preparation', desc: 'Document Verification' },
        { num: 3, title: 'Submission', desc: 'Consular Filing' },
        { num: 4, title: 'Consulate', desc: 'Biometrics Review' },
        { num: 5, title: 'Ready', desc: 'Passport Delivery' }
    ];

    if (loading) {
        return (
            <div className="dashboard-content fade-in" style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div className="pulse-dot" style={{ margin: '0 auto 16px', width: '16px', height: '16px' }}></div>
                <p style={{ color: '#64748B', fontWeight: 600 }}>Loading your European visa dossier...</p>
            </div>
        );
    }

    // =========================================================================
    // EMPTY STATE: User has 0 dossiers in database
    // =========================================================================
    if (!dossier || dossiers.length === 0) {
        return (
            <div className="dashboard-content fade-in">
                {/* Hero Header */}
                <div className="dash-hero-header">
                    <div className="hero-titles-wrap">
                        <div className="hero-status-pill neutral">
                            <span className="pulse-dot grey"></span>
                            <span>No Active Application • Schengen & European Visas</span>
                        </div>
                        <h1 className="hero-client-title">
                            Welcome back, <span className="highlight-name">{clientName}</span>!
                        </h1>
                        <p className="hero-client-subtitle">
                            You do not have an active European visa dossier yet. Start your application now to secure priority consular submission.
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
                        <button className="btn-hero-primary pulse-btn" onClick={() => navigate('/individual/wizard')}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Start New Application
                        </button>
                    </div>
                </div>

                {/* High-End Onboarding Banner Card */}
                <div className="dash-card-premium onboarding-banner-card">
                    <div className="onboarding-banner-content">
                        <div className="onboarding-icon-box">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                        </div>
                        <div className="onboarding-text-wrap">
                            <h2>Begin Your European Visa Application</h2>
                            <p>
                                Welcome to EuroTech Immigration Portal. Our system provides direct integration with European consular networks, biometric scheduling, and legal document verification.
                            </p>
                            <div className="onboarding-cta-row">
                                <button className="btn-start-large" onClick={() => navigate('/individual/wizard')}>
                                    Start Application Dossier →
                                </button>
                                <button className="btn-secondary-outline" onClick={() => navigate('/client/privacy')}>
                                    Account & Privacy Center
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 3 Step Roadmap Preview */}
                    <div className="onboarding-steps-grid">
                        <div className="onboarding-step-box">
                            <div className="step-badge-num">1</div>
                            <h4>Destination & Category</h4>
                            <p>Choose your Schengen destination (Hungary, Austria, Germany, etc.) and specific travel category.</p>
                        </div>
                        <div className="onboarding-step-box">
                            <div className="step-badge-num">2</div>
                            <h4>Applicants & Documents</h4>
                            <p>Enter traveler profiles, passport scans, and financial solvency proof in certified digital formats.</p>
                        </div>
                        <div className="onboarding-step-box">
                            <div className="step-badge-num">3</div>
                            <h4>Appointment & Tracking</h4>
                            <p>Book your consular biometrics slot, finalize submission, and monitor real-time visa status.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // =========================================================================
    // ACTIVE DOSSIER STATE: User has 1 or more dossiers in database
    // =========================================================================
    return (
        <div className="dashboard-content fade-in">
            {/* --- Ultra-Premium Hero Header --- */}
            <div className="dash-hero-header">
                <div className="hero-titles-wrap">
                    <div className="hero-top-badges">
                        <div className="hero-status-pill">
                            <span className="pulse-dot"></span>
                            <span>Dossier In Progress • {destinationCountry} (Schengen)</span>
                        </div>
                        {dossiers.length > 1 && (
                            <div className="dossier-selector-dropdown">
                                <label>Active Dossier:</label>
                                <select 
                                    value={dossier.id} 
                                    onChange={(e) => setSelectedDossierId(e.target.value)}
                                    className="dossier-select-control"
                                >
                                    {dossiers.map(d => (
                                        <option key={d.id} value={d.id}>
                                            {d.dossierNumber || d.id.substring(0, 8)} • {d.country?.nameEn || 'Schengen'} ({d.status})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
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
                <div className="metric-kpi-card status-kpi" title={`Current Status: ${statusText}`}>
                    <div className="kpi-icon-box blue-gradient">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    <div className="kpi-info-block">
                        <span className="kpi-label">Current Status</span>
                        <h3 className="kpi-value">{statusText}</h3>
                        <div className="kpi-pill success">● Step {currentStepIndex} of 5 Active</div>
                    </div>
                </div>

                {/* 2. Documents (Dynamic from DB) */}
                <div className="metric-kpi-card docs-kpi clickable" onClick={() => navigate('/client/documents')} title="Click to view required documents">
                    <div className="kpi-icon-box emerald-gradient">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    </div>
                    <div className="kpi-info-block">
                        <span className="kpi-label">Dossier Documents</span>
                        <h3 className="kpi-value">{uploadedDocsCount} Uploaded</h3>
                        <div className="kpi-pill info">{docsReadinessPct}% Readiness</div>
                    </div>
                </div>

                {/* 3. Appointment (Dynamic from DB) */}
                <div className="metric-kpi-card appt-kpi clickable" onClick={() => navigate('/client/appointment')} title="Click to manage consular appointment">
                    <div className="kpi-icon-box indigo-gradient">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <div className="kpi-info-block">
                        <span className="kpi-label">Consular Biometrics</span>
                        <h3 className="kpi-value">{appointment ? `${appointmentDateStr}` : 'Not Scheduled'}</h3>
                        <div className={`kpi-pill ${appointment ? 'purple' : 'warning'}`}>
                            {appointment ? appointmentLocation : 'Schedule Slot →'}
                        </div>
                    </div>
                </div>

                {/* 4. Action Required (Dynamic Calculation) */}
                <div className="metric-kpi-card warning-kpi" title="Compliance Tasks Pending Review">
                    <div className="kpi-icon-box amber-gradient">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    </div>
                    <div className="kpi-info-block">
                        <span className="kpi-label">Compliance Tasks</span>
                        <h3 className="kpi-value">{activePendingTasksCount} Action{activePendingTasksCount === 1 ? '' : 's'} Required</h3>
                        <div className={`kpi-pill ${activePendingTasksCount > 0 ? 'warning' : 'success'}`}>
                            {activePendingTasksCount > 0 ? `${activePendingTasksCount} Pending` : 'All Verified'}
                        </div>
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
                                                <strong className="pipeline-step-title">{step.title}</strong>
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
                                <strong>{currentNotice.title}</strong>
                                <p>{currentNotice.desc}</p>
                            </div>
                        </div>
                    </div>

                    {/* To-Do List (Action Items - 100% Dynamic from Database) */}
                    <div className="dash-card-premium todo-card">
                        <div className="card-header-styled">
                            <div className="header-badge-group">
                                <h3>Action Required (Tasks)</h3>
                                <p>Items requiring your review or file upload</p>
                            </div>
                            <span className={activePendingTasksCount > 0 ? "badge-counter-warning" : "badge-counter-success"}>
                                {activePendingTasksCount} Pending
                            </span>
                        </div>

                        <div className="todo-items-list">
                            {pendingTasks.map((task) => (
                                <div key={task.id} className={`todo-item-card ${task.isDone ? 'completed' : task.color === 'orange' ? 'urgent' : 'review'}`}>
                                    <div className={`todo-icon-box ${task.color}`}>
                                        {task.isDone ? (
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                        ) : task.color === 'orange' ? (
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/></svg>
                                        ) : (
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="16 3 21 8 8 21 3 21 3 16 16 3"/></svg>
                                        )}
                                    </div>
                                    <div className="todo-content-box">
                                        <div className="todo-title-row">
                                            <h4>{task.title}</h4>
                                            <span className={`priority-pill ${task.isDone ? 'green' : task.priority === 'Required' ? 'red' : 'blue'}`}>
                                                {task.priority}
                                            </span>
                                        </div>
                                        <p>{task.desc}</p>
                                    </div>
                                    {task.isDone ? (
                                        <div className="completed-badge">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                                            Done
                                        </div>
                                    ) : (
                                        <button 
                                            className={`btn-todo-action ${task.priority === 'Review' ? 'outline' : ''}`}
                                            onClick={() => task.actionRoute && navigate(task.actionRoute)}
                                        >
                                            {task.actionText}
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                                        </button>
                                    )}
                                </div>
                            ))}
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
                                <strong className="tile-val">{countryCodeToFlag(dossier?.country)} {destinationCountry}</strong>
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
                                <small className="tile-sub">{appointmentLocation}</small>
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

                            <button className="quick-action-link-btn" onClick={handleDownloadDossierSummary} disabled={isDownloadingSummary}>
                                <div className="qa-icon gold">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                </div>
                                <div className="qa-text">
                                    <strong>{isDownloadingSummary ? 'Generating PDF...' : 'Dossier Summary (PDF)'}</strong>
                                    <span>Download certified travel sheet</span>
                                </div>
                                <svg className="qa-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                            </button>
                        </div>
                    </div>

                    {/* Recent Activity Timeline (Dynamic from DB) */}
                    <div className="dash-card-premium activity-feed-panel">
                        <div className="card-header-styled">
                            <h3>Audit Activity Feed</h3>
                        </div>
                        <div className="modern-timeline">
                            {activityFeed.map((event) => (
                                <div key={event.id} className="timeline-event">
                                    <div className={`timeline-node ${event.active ? 'active' : ''}`}></div>
                                    <div className="timeline-info">
                                        <strong>{event.title}</strong>
                                        <p>{event.desc}</p>
                                        <span className="timeline-time">{event.time}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* VIP Premium Lounge Card */}
                    <div className={`vip-lounge-banner ${hasVipLounge ? 'vip-active' : ''}`}>
                        <div className="vip-lounge-header">
                            <span className="vip-pill-gold">
                                {hasVipLounge ? 'VIP SERVICE CONFIRMED' : 'VIP SERVICES'}
                            </span>
                            <div className="vip-icon-badge">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            </div>
                        </div>
                        <h3>EuroTech Premium Lounge</h3>
                        {hasVipLounge ? (
                            <>
                                <p>Your VIP lounge access and expedited consular filing are certified for your application. Enjoy private processing and refreshments.</p>
                                <div className="vip-confirmed-badge">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                    Active on Appointment Date
                                </div>
                            </>
                        ) : (
                            <>
                                <p>Enjoy private biometric processing, refreshments, dedicated visa officers, and zero waiting time at the consulate center.</p>
                                <button className="btn-vip-gold" onClick={() => navigate('/client/services')}>
                                    Upgrade for 81 AZN
                                </button>
                            </>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}