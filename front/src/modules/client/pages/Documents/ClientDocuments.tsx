import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/shared/context/ToastContext';
import { dossierService, documentService } from '@/shared/api/services';
import { storage } from '@/shared/utils/storage';
import './ClientDocuments.css';

type DocStatus = 'missing' | 'review' | 'verified' | 'rejected';

interface DocumentItem {
    id: string;
    backendDocId?: string;
    docType: string;
    title: string;
    description: string;
    status: DocStatus;
    icon: React.ReactNode;
    feedback?: string;
    fileName?: string;
    fileSize?: number;
    fileUrl?: string;
    isMandatory?: boolean;
}

const DEFAULT_REQUIREMENTS: DocumentItem[] = [
    {
        id: 'passport',
        docType: 'PASSPORT',
        title: 'Valid Passport Copy',
        description: 'Provide a clear, colored scan of the main passport page containing your photo and personal details. Must be valid for at least 3 months beyond your return date.',
        status: 'verified',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg>,
        fileName: 'passport_scan_primary.pdf',
        fileSize: 1450000,
        isMandatory: true,
    },
    {
        id: 'photo',
        docType: 'BIOMETRIC_PHOTO',
        title: 'Biometric Photograph',
        description: 'Recent (no older than 6 months) color photograph measuring 3.5 x 4.5 cm. Light background, neutral expression, adherence to ICAO standards.',
        status: 'review',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>,
        fileName: 'biometric_photo_icao.jpg',
        fileSize: 850000,
        isMandatory: true,
    },
    {
        id: 'bank',
        docType: 'BANK_STATEMENT',
        title: 'Proof of Financial Means',
        description: 'Official bank statements covering the last 3 consecutive months with the bank\'s stamp and signature, proving sufficient funds.',
        status: 'missing',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M12 12h.01" /><path d="M17 12h.01" /><path d="M7 12h.01" /></svg>,
        isMandatory: true,
    },
    {
        id: 'employment',
        docType: 'EMPLOYMENT_LETTER',
        title: 'Employment / Leave Letter',
        description: 'An official letter from your employer stating your position, salary, and approved leave dates. Must include company letterhead and stamp.',
        status: 'missing',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>,
        isMandatory: true,
    },
    {
        id: 'accommodation',
        docType: 'ACCOMMODATION',
        title: 'Proof of Accommodation',
        description: 'Confirmed hotel reservation or a letter of invitation from the host covering the entire duration of your stay in the Schengen area.',
        status: 'missing',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
        isMandatory: true,
    },
    {
        id: 'flight',
        docType: 'FLIGHT_ITINERARY',
        title: 'Flight Itinerary',
        description: 'Round-trip flight reservation or itinerary under your name. (Purchasing the actual ticket before visa approval is not recommended).',
        status: 'missing',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>,
        isMandatory: true,
    },
    {
        id: 'insurance',
        docType: 'INSURANCE',
        title: 'Travel Medical Insurance',
        description: 'Insurance certificate covering the entire Schengen area with a minimum coverage of €30,000 for medical emergencies.',
        status: 'rejected',
        feedback: 'The uploaded document is blurry and the coverage amount is unreadable. Please upload a high-resolution PDF copy.',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M8 11h8" /><path d="M12 7v8" /></svg>,
        fileName: 'travel_insurance_draft.pdf',
        fileSize: 420000,
        isMandatory: true,
    }
];

export default function ClientDocuments() {
    const { showSuccess, showError } = useToast();
    const [dossier, setDossier] = useState<any>(null);
    const [dossierId, setDossierId] = useState<string>('');
    const [selectedApplicant, setSelectedApplicant] = useState('app-1');
    const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
    const [exportingPdf, setExportingPdf] = useState(false);
    const [exportingExcel, setExportingExcel] = useState(false);
    const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
    const [zoomLevel, setZoomLevel] = useState(1);

    const [applicants, setApplicants] = useState([
        { id: 'app-1', name: 'Primary Applicant' },
    ]);

    const [documents, setDocuments] = useState<DocumentItem[]>(DEFAULT_REQUIREMENTS);

    // Map documents for the chosen applicant
    const syncDocumentsForApplicant = useCallback((targetAppId: string, currentDossier: any) => {
        if (!currentDossier) return;

        const allDocs = currentDossier.documents || [];
        const applicantDocs = allDocs.filter((d: any) => d.applicantId === targetAppId);

        // If this applicant has actual documents stored in DB, map them accurately
        if (applicantDocs.length > 0) {
            setDocuments(prev => prev.map(req => {
                const found = applicantDocs.find(
                    (d: any) => d.requiredDocumentType === req.docType || d.requiredDocumentType?.toLowerCase() === req.docType.toLowerCase()
                );

                if (found) {
                    let status: DocStatus = 'review';
                    if (found.status === 'VERIFIED') status = 'verified';
                    else if (found.status === 'NEEDS_CORRECTION' || found.status === 'REJECTED') status = 'rejected';
                    else status = 'review';

                    return {
                        ...req,
                        status,
                        backendDocId: found.id,
                        fileName: found.fileName,
                        fileSize: found.fileSize,
                        fileUrl: found.fileUrl,
                        feedback: found.operatorNotes || undefined,
                    };
                } else {
                    return {
                        ...req,
                        status: 'missing' as DocStatus,
                        backendDocId: undefined,
                        fileName: undefined,
                        fileSize: undefined,
                        fileUrl: undefined,
                        feedback: undefined,
                    };
                }
            }));
        } else if (allDocs.length > 0) {
            // Dossier has documents, but this specific co-applicant has none yet
            setDocuments(prev => prev.map(req => ({
                ...req,
                status: 'missing' as DocStatus,
                backendDocId: undefined,
                fileName: undefined,
                fileSize: undefined,
                fileUrl: undefined,
                feedback: undefined,
            })));
        } else {
            // First time visit / demo state: keep DEFAULT_REQUIREMENTS
            setDocuments(DEFAULT_REQUIREMENTS);
        }
    }, []);

    // Load active dossier from backend
    const loadDossierData = useCallback(async () => {
        try {
            const res = await dossierService.getMyDossiers();
            if (res.data?.dossiers && res.data.dossiers.length > 0) {
                const active = res.data.dossiers[0];
                setDossier(active);
                setDossierId(active.id);

                if (active.applicants && active.applicants.length > 0) {
                    const mappedApps = active.applicants.map((app: any, idx: number) => ({
                        id: app.id,
                        name: `${app.firstName} ${app.lastName} (${idx === 0 ? 'Primary' : 'Co-Applicant'})`,
                    }));
                    setApplicants(mappedApps);
                    setSelectedApplicant(mappedApps[0].id);
                    syncDocumentsForApplicant(mappedApps[0].id, active);
                } else {
                    syncDocumentsForApplicant('app-1', active);
                }
            }
        } catch (err) {
            console.warn('Documents dossier load error:', err);
        }
    }, [syncDocumentsForApplicant]);

    useEffect(() => {
        loadDossierData();
    }, [loadDossierData]);

    // Handle Applicant Change
    const handleApplicantChange = (newAppId: string) => {
        setSelectedApplicant(newAppId);
        syncDocumentsForApplicant(newAppId, dossier);
    };

    // File Upload / Replacement Handler
    const handleFileChange = async (docId: string, docType: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // File size validation (10MB)
        if (file.size > 10 * 1024 * 1024) {
            showError('File size exceeds the 10MB limit. Please upload a smaller file.');
            e.target.value = '';
            return;
        }

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

                // Update local document
                setDocuments(prev => prev.map(d => d.id === docId ? {
                    ...d,
                    status: 'review',
                    backendDocId: backendDoc?.id,
                    fileName: file.name,
                    fileSize: file.size,
                    fileUrl: backendDoc?.fileUrl,
                    feedback: undefined
                } : d));

                showSuccess(`${file.name} uploaded successfully!`);
                await loadDossierData();
            } else {
                showError('Active dossier or applicant not found. Please refresh the page.');
            }
        } catch (err: any) {
            console.error('File upload error:', err);
            showError(err.message || 'File upload failed.');
        } finally {
            setUploadingDocId(null);
            e.target.value = '';
        }
    };

    // Delete / Remove Document Handler
    const handleDeleteDocument = async (doc: DocumentItem) => {
        if (!window.confirm(`Are you sure you want to remove "${doc.title}"?`)) {
            return;
        }

        if (doc.backendDocId) {
            try {
                await documentService.deleteDocument(doc.backendDocId);
                showSuccess(`${doc.title} removed successfully.`);
                await loadDossierData();
            } catch (err: any) {
                console.error('Delete error:', err);
                showError(err.message || 'Failed to delete document.');
            }
        } else {
            setDocuments(prev => prev.map(d => d.id === doc.id ? {
                ...d,
                status: 'missing',
                backendDocId: undefined,
                fileName: undefined,
                fileSize: undefined,
                fileUrl: undefined,
                feedback: undefined,
            } : d));
            showSuccess(`${doc.title} removed.`);
        }
    };

    // View File Handler (Opens Inline Modal with Real File Preview)
    const handleViewFile = async (doc: DocumentItem) => {
        setZoomLevel(1);
        let resolvedUrl = doc.fileUrl;
        if (doc.backendDocId) {
            try {
                const res = await documentService.getSignedUrl(doc.backendDocId);
                if (res.data?.signedUrl) {
                    resolvedUrl = res.data.signedUrl;
                }
            } catch (err) {
                console.warn('Could not fetch signed url for preview, using fallback:', err);
            }
        }
        setPreviewDoc({
            ...doc,
            fileUrl: resolvedUrl,
        });
    };

    // Download Individual Document (Real File)
    const handleDownloadIndividualDoc = async (doc: DocumentItem) => {
        try {
            if (doc.backendDocId) {
                const res = await documentService.getSignedUrl(doc.backendDocId);
                const downloadPath = res.data?.signedUrl;
                if (downloadPath) {
                    const fullUrl = downloadPath.startsWith('http') ? downloadPath : `http://localhost:5000${downloadPath}`;
                    const a = document.createElement('a');
                    a.href = fullUrl;
                    a.download = doc.fileName || `${doc.docType.toLowerCase()}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    showSuccess(`${doc.title} downloaded successfully!`);
                    return;
                }
            }

            if (doc.fileUrl) {
                const fullUrl = doc.fileUrl.startsWith('http') ? doc.fileUrl : `http://localhost:5000${doc.fileUrl}`;
                const a = document.createElement('a');
                a.href = fullUrl;
                a.download = doc.fileName || `${doc.docType.toLowerCase()}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                showSuccess(`${doc.title} downloaded successfully!`);
                return;
            }

            showError('Document file is not ready for download.');
        } catch (err: any) {
            console.error('Download error:', err);
            showError(err.message || 'Failed to download document.');
        }
    };

    // Header Action: Download Official Submission Checklist (PDF)
    const handleDownloadChecklistPdf = async () => {
        if (!dossierId) {
            showError('Active dossier not found.');
            return;
        }
        setExportingPdf(true);
        try {
            const token = storage.getToken();
            const res = await fetch(`http://localhost:5000/api/v1/documents/dossier/${dossierId}/export-checklist?format=pdf`, {
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                }
            });
            if (!res.ok) throw new Error('PDF generation failed on server');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Document_Checklist_${dossier?.dossierNumber || 'HU-AZ-2026'}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            showSuccess('Official Submission Checklist (PDF) downloaded!');
        } catch (err: any) {
            console.error('Checklist PDF error:', err);
            showError('Failed to download Checklist PDF.');
        } finally {
            setExportingPdf(false);
        }
    };

    // Header Action: Export Document Inventory (Excel/CSV)
    const handleExportChecklistExcel = async () => {
        if (!dossierId) {
            showError('Active dossier not found.');
            return;
        }
        setExportingExcel(true);
        try {
            const token = storage.getToken();
            const res = await fetch(`http://localhost:5000/api/v1/documents/dossier/${dossierId}/export-checklist?format=excel`, {
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                }
            });
            if (!res.ok) throw new Error('Excel generation failed on server');
            const text = await res.text();
            const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Document_Inventory_${dossier?.dossierNumber || 'HU-AZ-2026'}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            showSuccess('Document Inventory (Excel) exported successfully!');
        } catch (err: any) {
            console.error('Checklist Excel error:', err);
            showError('Failed to export Excel.');
        } finally {
            setExportingExcel(false);
        }
    };

    // Progress calculation
    const totalDocs = documents.length;
    const uploadedDocs = documents.filter(d => d.status === 'verified' || d.status === 'review').length;
    const progressPercentage = Math.round((uploadedDocs / totalDocs) * 100);

    const renderStatusBadge = (status: DocStatus) => {
        switch (status) {
            case 'verified': return <span className="doc-badge verified">Verified</span>;
            case 'review': return <span className="doc-badge review">Under Review</span>;
            case 'rejected': return <span className="doc-badge rejected">Action Required</span>;
            case 'missing': default: return <span className="doc-badge pending">Missing</span>;
        }
    };

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return '';
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="documents-content fade-in">
            {/* Header with Applicant Selector & Official Export Actions */}
            <div className="docs-header-premium">
                <div className="header-titles">
                    <h1 className="docs-title">Document Repository</h1>
                    <p className="docs-subtitle">Securely upload and manage official documentation required for visa processing.</p>
                </div>

                <div className="header-right-controls">
                    <div className="export-action-buttons">
                        <button
                            className="btn-export-header pdf"
                            onClick={handleDownloadChecklistPdf}
                            disabled={exportingPdf}
                            title="Download official Schengen submission report as PDF"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><polyline points="9 15 12 18 15 15" /></svg>
                            {exportingPdf ? 'Exporting PDF...' : 'Checklist (PDF)'}
                        </button>
                        <button
                            className="btn-export-header excel"
                            onClick={handleExportChecklistExcel}
                            disabled={exportingExcel}
                            title="Export all required and uploaded document records as Excel/CSV"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M8 13h8" /><path d="M8 17h8" /><path d="M10 9h4" /></svg>
                            {exportingExcel ? 'Exporting...' : 'Inventory (Excel)'}
                        </button>
                    </div>

                    <div className="applicant-selector-box">
                        <label>Viewing Documents For:</label>
                        <div className="premium-select-wrapper compact">
                            <select
                                value={selectedApplicant}
                                onChange={(e) => handleApplicantChange(e.target.value)}
                            >
                                {applicants.map(app => (
                                    <option key={app.id} value={app.id}>{app.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Two-Column Layout */}
            <div className="docs-main-layout">

                {/* LEFT COLUMN: Vertical Sticky Submission Checklist */}
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
                                const isUploaded = doc.status === 'verified' || doc.status === 'review';
                                const isRejected = doc.status === 'rejected';

                                return (
                                    <div key={`check-${doc.id}`} className={`tracker-item-vert ${isUploaded ? 'completed' : isRejected ? 'rejected' : 'pending'}`}>
                                        <div className="tracker-icon-vert">
                                            {isUploaded ? (
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                            ) : isRejected ? (
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
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

                {/* RIGHT COLUMN: Detailed Document Cards */}
                <section className="docs-list-premium">
                    {documents.map((doc) => (
                        <div key={doc.id} className={`doc-card-premium ${doc.status === 'missing' ? 'pending' : doc.status}`}>
                            <div className="doc-card-icon">
                                {doc.icon}
                            </div>

                            <div className="doc-card-info">
                                <div className="doc-card-header">
                                    <h3>{doc.title}</h3>
                                    {renderStatusBadge(doc.status)}
                                </div>
                                <p className="doc-explanatory-text">{doc.description}</p>

                                {doc.fileName && (
                                    <div className="doc-file-meta">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
                                        <span className="file-name">{doc.fileName}</span>
                                        {doc.fileSize && <span className="file-size">({formatFileSize(doc.fileSize)})</span>}
                                    </div>
                                )}

                                {doc.status === 'rejected' && doc.feedback && (
                                    <div className="doc-feedback-alert">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                                        <div className="feedback-content">
                                            <strong>Consular Feedback:</strong>
                                            <span>{doc.feedback}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="doc-card-actions">
                                {doc.status === 'missing' ? (
                                    <div className="upload-container">
                                        <label className="btn-upload-primary">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                            {uploadingDocId === doc.id ? 'Uploading...' : 'Upload File'}
                                            <input
                                                type="file"
                                                hidden
                                                accept=".pdf,.png,.jpg,.jpeg"
                                                onChange={(e) => handleFileChange(doc.id, doc.docType, e)}
                                            />
                                        </label>
                                        <span className="upload-format-hint">PDF, PNG, JPG (Max 10MB)</span>
                                    </div>
                                ) : (
                                    <div className="action-group">
                                        <button
                                            className="btn-icon-secondary"
                                            title="View Uploaded File Preview"
                                            onClick={() => handleViewFile(doc)}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                        </button>

                                        <button
                                            className="btn-icon-secondary download-btn"
                                            title="Download Document (PDF)"
                                            onClick={() => handleDownloadIndividualDoc(doc)}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                        </button>

                                        <label className="btn-icon-secondary" title="Replace File" style={{ display: 'inline-flex', cursor: 'pointer' }}>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><polyline points="23 20 23 14 17 14" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" /></svg>
                                            <input
                                                type="file"
                                                hidden
                                                accept=".pdf,.png,.jpg,.jpeg"
                                                onChange={(e) => handleFileChange(doc.id, doc.docType, e)}
                                            />
                                        </label>

                                        {doc.status !== 'verified' && (
                                            <button
                                                className="btn-icon-secondary delete-btn"
                                                title="Remove Document"
                                                onClick={() => handleDeleteDocument(doc)}
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </section>
            </div>

            {/* Modern Inline Document Preview Modal */}
            {previewDoc && (
                <div className="doc-preview-modal-overlay" onClick={() => setPreviewDoc(null)}>
                    <div className="doc-preview-modal-container" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title-group">
                                <h2>{previewDoc.title}</h2>
                                {renderStatusBadge(previewDoc.status)}
                            </div>
                            <div className="modal-actions-right">
                                <div className="zoom-controls">
                                    <button onClick={() => setZoomLevel(prev => Math.max(prev - 0.2, 0.6))} title="Zoom Out">-</button>
                                    <span>{Math.round(zoomLevel * 100)}%</span>
                                    <button onClick={() => setZoomLevel(prev => Math.min(prev + 0.2, 2.0))} title="Zoom In">+</button>
                                    <button onClick={() => setZoomLevel(1)} title="Reset Zoom">Reset</button>
                                </div>
                                <button className="modal-close-btn" onClick={() => setPreviewDoc(null)} title="Close Preview">
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="modal-body">
                            <div className="preview-canvas-wrapper" style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center', transition: 'transform 0.2s ease' }}>
                                <div className="document-sheet-simulation">
                                    <div className="sheet-header">
                                        <div className="sheet-logo">EUROTECH VISA PLATFORM</div>
                                        <div className="sheet-ref">REF: {dossier?.dossierNumber || 'HU-AZ-2026-91529'}</div>
                                    </div>
                                    <div className="sheet-stamp-watermark">
                                        {previewDoc.status.toUpperCase()}
                                    </div>
                                    <div className="sheet-content">
                                        <h3>Official Consular Record: {previewDoc.title}</h3>
                                        <div className="sheet-grid">
                                            <div><strong>Document Type:</strong> {previewDoc.docType}</div>
                                            <div><strong>Applicant:</strong> {applicants.find(a => a.id === selectedApplicant)?.name || 'Primary Applicant'}</div>
                                            <div><strong>File Name:</strong> {previewDoc.fileName || 'scan_certified.pdf'}</div>
                                            <div><strong>Security Status:</strong> AES-256 Verified Electronic Document</div>
                                        </div>

                                        <div className="sheet-body-preview">
                                            {previewDoc.fileUrl ? (
                                                <div className="real-preview-container">
                                                    {(previewDoc.fileName?.match(/\.(jpg|jpeg|png|webp)$/i) || previewDoc.fileUrl.match(/\.(jpg|jpeg|png|webp)/i)) ? (
                                                        <img
                                                            src={previewDoc.fileUrl.startsWith('http') ? previewDoc.fileUrl : `http://localhost:5000${previewDoc.fileUrl}`}
                                                            alt={previewDoc.title}
                                                            className="real-preview-img"
                                                        />
                                                    ) : (
                                                        <iframe
                                                            src={`${previewDoc.fileUrl.startsWith('http') ? previewDoc.fileUrl : `http://localhost:5000${previewDoc.fileUrl}`}#toolbar=0`}
                                                            className="real-preview-iframe"
                                                            title={previewDoc.title}
                                                        />
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="real-preview-empty">
                                                    <p>Preview not available for this document.</p>
                                                </div>
                                            )}
                                        </div>

                                        {previewDoc.feedback && (
                                            <div className="sheet-feedback-box">
                                                <strong>Officer Audit Note:</strong>
                                                <p>{previewDoc.feedback}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <div className="footer-file-info">
                                <span>{previewDoc.fileName || `${previewDoc.docType.toLowerCase()}.pdf`}</span>
                                {previewDoc.fileSize && <span className="meta">({formatFileSize(previewDoc.fileSize)})</span>}
                            </div>
                            <div className="footer-buttons">
                                <button className="btn-modal-download" onClick={() => handleDownloadIndividualDoc(previewDoc)}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                    Download (PDF)
                                </button>
                                <button className="btn-modal-close" onClick={() => setPreviewDoc(null)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}