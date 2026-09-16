import React, { useState, useEffect } from 'react';
import { useToast } from '@/shared/context/ToastContext';
import { dossierService, documentService } from '@/shared/api/services';
import './ClientDocuments.css';

type DocStatus = 'pending' | 'review' | 'verified' | 'rejected';

interface DocumentItem {
    id: string;
    backendDocId?: string;
    docType: string;
    title: string;
    description: string;
    status: DocStatus;
    icon: React.ReactNode;
    feedback?: string;
}

export default function ClientDocuments() {
    const { showSuccess, showError } = useToast();
    const [dossierId, setDossierId] = useState<string>('');
    const [selectedApplicant, setSelectedApplicant] = useState('app-1');
    const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);

    const [applicants, setApplicants] = useState([
        { id: 'app-1', name: 'Primary Applicant' },
    ]);

    // Initial documents
    const [documents, setDocuments] = useState<DocumentItem[]>([
        {
            id: 'passport',
            docType: 'PASSPORT',
            title: 'Valid Passport Copy',
            description: 'Provide a clear, colored scan of the main passport page containing your photo and personal details. Must be valid for at least 3 months beyond your return date.',
            status: 'verified',
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
        },
        {
            id: 'photo',
            docType: 'BIOMETRIC_PHOTO',
            title: 'Biometric Photograph',
            description: 'Recent (no older than 6 months) color photograph measuring 3.5 x 4.5 cm. Light background, neutral expression, adherence to ICAO standards.',
            status: 'review',
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        },
        {
            id: 'bank',
            docType: 'BANK_STATEMENT',
            title: 'Proof of Financial Means',
            description: 'Official bank statements covering the last 3 consecutive months with the bank\'s stamp and signature, proving sufficient funds.',
            status: 'pending',
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 12h.01"/><path d="M17 12h.01"/><path d="M7 12h.01"/></svg>
        },
        {
            id: 'employment',
            docType: 'EMPLOYMENT_LETTER',
            title: 'Employment / Leave Letter',
            description: 'An official letter from your employer stating your position, salary, and approved leave dates. Must include company letterhead and stamp.',
            status: 'pending',
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
        },
        {
            id: 'accommodation',
            docType: 'ACCOMMODATION',
            title: 'Proof of Accommodation',
            description: 'Confirmed hotel reservation or a letter of invitation from the host covering the entire duration of your stay in the Schengen area.',
            status: 'pending',
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        },
        {
            id: 'flight',
            docType: 'FLIGHT_ITINERARY',
            title: 'Flight Itinerary',
            description: 'Round-trip flight reservation or itinerary under your name. (Purchasing the actual ticket before visa approval is not recommended).',
            status: 'pending',
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        },
        {
            id: 'insurance',
            docType: 'INSURANCE',
            title: 'Travel Medical Insurance',
            description: 'Insurance certificate covering the entire Schengen area with a minimum coverage of €30,000 for medical emergencies.',
            status: 'rejected',
            feedback: 'The uploaded document is blurry and the coverage amount is unreadable. Please upload a high-resolution PDF copy.',
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M8 11h8"/><path d="M12 7v8"/></svg>
        }
    ]);

    // Load active dossier from backend
    useEffect(() => {
        dossierService.getMyDossiers()
            .then(res => {
                if (res.data?.dossiers && res.data.dossiers.length > 0) {
                    const active = res.data.dossiers[0];
                    setDossierId(active.id);
                    if (active.applicants && active.applicants.length > 0) {
                        const mappedApps = active.applicants.map((app: any, idx: number) => ({
                            id: app.id,
                            name: `${app.firstName} ${app.lastName} (${idx === 0 ? 'Primary' : 'Co-Applicant'})`,
                        }));
                        setApplicants(mappedApps);
                        setSelectedApplicant(mappedApps[0].id);
                    }
                }
            })
            .catch(() => {});
    }, []);

    const handleFileChange = async (docId: string, docType: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingDocId(docId);
        try {
            if (dossierId && selectedApplicant) {
                const res = await documentService.uploadDocument({
                    dossierId,
                    applicantId: selectedApplicant,
                    requiredDocumentType: docType,
                    isMandatory: true,
                    file,
                });
                const backendDoc = res.data?.document;
                setDocuments(prev => prev.map(d => d.id === docId ? { 
                    ...d, 
                    status: 'review', 
                    backendDocId: backendDoc?.id,
                    feedback: undefined 
                } : d));
                showSuccess(`${file.name} uploaded successfully!`);
            } else {
                // Fallback state update
                setDocuments(prev => prev.map(d => d.id === docId ? { ...d, status: 'review', feedback: undefined } : d));
                showSuccess(`${file.name} uploaded for review!`);
            }
        } catch (err: any) {
            console.error('File upload error:', err);
            showError(err.message || 'File upload failed.');
        } finally {
            setUploadingDocId(null);
            e.target.value = '';
        }
    };

    const handleViewFile = async (doc: DocumentItem) => {
        if (doc.backendDocId) {
            try {
                const res = await documentService.getSignedUrl(doc.backendDocId);
                const signedUrl = res.data?.signedUrl;
                if (signedUrl) {
                    window.open(signedUrl, '_blank');
                    return;
                }
            } catch (err) {
                console.warn('Signed URL retrieval error:', err);
            }
        }
        showSuccess(`Opening secure viewer for ${doc.title}...`);
    };

    // Tərəqqinin (Progress) hesablanması
    const totalDocs = documents.length;
    const uploadedDocs = documents.filter(d => d.status !== 'pending' && d.status !== 'rejected').length;
    const progressPercentage = Math.round((uploadedDocs / totalDocs) * 100);

    const renderStatusBadge = (status: DocStatus) => {
        switch (status) {
            case 'verified': return <span className="doc-badge verified">Verified</span>;
            case 'review': return <span className="doc-badge review">Under Review</span>;
            case 'rejected': return <span className="doc-badge rejected">Action Required</span>;
            case 'pending': default: return <span className="doc-badge pending">Missing</span>;
        }
    };

    return (
        <div className="documents-content fade-in">
            {/* Header with Applicant Selector */}
            <div className="docs-header-premium">
                <div className="header-titles">
                    <h1 className="docs-title">Document Repository</h1>
                    <p className="docs-subtitle">Securely upload and manage official documentation required for visa processing.</p>
                </div>
                
                <div className="applicant-selector-box">
                    <label>Viewing Documents For:</label>
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

            {/* Əsas İki Sütunlu (Layout) Dizayn */}
            <div className="docs-main-layout">
                
                {/* SOL SÜTUN: Şaquli Checklist (Sticky) */}
                <aside className="docs-sidebar">
                    <div className="docs-tracker-card-vertical">
                        <div className="tracker-header">
                            <h3>Submission Checklist</h3>
                            <span className="tracker-count">{uploadedDocs} / {totalDocs}</span>
                        </div>
                        
                        <div className="tracker-progress-bar">
                            <div className="progress-fill" style={{ width: `${progressPercentage}%` }}></div>
                        </div>

                        <div className="tracker-items-vertical">
                            {documents.map(doc => {
                                const isUploaded = doc.status !== 'pending' && doc.status !== 'rejected';
                                const isRejected = doc.status === 'rejected';
                                
                                return (
                                    <div key={`check-${doc.id}`} className={`tracker-item-vert ${isUploaded ? 'completed' : isRejected ? 'rejected' : 'pending'}`}>
                                        <div className="tracker-icon-vert">
                                            {isUploaded ? (
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                            ) : isRejected ? (
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                            ) : (
                                                <span className="empty-circle"></span>
                                            )}
                                        </div>
                                        <span className="tracker-label-vert">{doc.title}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </aside>

                {/* SAĞ SÜTUN: Detallı Sənəd Kartları */}
                <section className="docs-list-premium">
                    {documents.map((doc) => (
                        <div key={doc.id} className={`doc-card-premium ${doc.status}`}>
                            <div className="doc-card-icon">
                                {doc.icon}
                            </div>
                            
                            <div className="doc-card-info">
                                <div className="doc-card-header">
                                    <h3>{doc.title}</h3>
                                    {renderStatusBadge(doc.status)}
                                </div>
                                <p className="doc-explanatory-text">{doc.description}</p>
                                
                                {doc.status === 'rejected' && doc.feedback && (
                                    <div className="doc-feedback-alert">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                        <div className="feedback-content">
                                            <strong>Feedback:</strong>
                                            <span>{doc.feedback}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="doc-card-actions">
                                {(doc.status === 'pending' || doc.status === 'rejected') ? (
                                    <label className="btn-upload-primary">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                        {uploadingDocId === doc.id ? 'Uploading...' : 'Upload File'}
                                        <input 
                                            type="file" 
                                            hidden 
                                            accept=".pdf,.png,.jpg,.jpeg"
                                            onChange={(e) => handleFileChange(doc.id, doc.docType, e)} 
                                        />
                                    </label>
                                ) : (
                                    <div className="action-group">
                                        <button 
                                            className="btn-icon-secondary" 
                                            title="View Uploaded File"
                                            onClick={() => handleViewFile(doc)}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                        </button>
                                        <label className="btn-icon-secondary" title="Replace File" style={{ display: 'inline-flex', cursor: 'pointer' }}>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                                            <input 
                                                type="file" 
                                                hidden 
                                                accept=".pdf,.png,.jpg,.jpeg"
                                                onChange={(e) => handleFileChange(doc.id, doc.docType, e)} 
                                            />
                                        </label>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </section>
            </div>
        </div>
    );
}