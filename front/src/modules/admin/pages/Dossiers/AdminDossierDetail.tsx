import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminService } from '@/shared/api/services/admin.service';
import { useToast } from '@/shared/context/ToastContext';
import DocumentReviewModal from '@/modules/admin/components/DocumentReviewModal';
import ConsularDecisionModal from '@/modules/admin/components/ConsularDecisionModal';
import type { AdminDossier, AdminApplicantDocument, DossierStatusType } from '@/shared/types/admin.types';
import './AdminDossierDetail.css';

export default function AdminDossierDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [dossier, setDossier] = useState<AdminDossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'documents' | 'applicant' | 'history'>('documents');

  // Modals state
  const [selectedDocForReview, setSelectedDocForReview] = useState<AdminApplicantDocument | null>(null);
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const fetchDossierData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await adminService.getDossierById(id);
      if (res.data?.dossier) {
        setDossier(res.data.dossier);
      }
    } catch (err: any) {
      console.error('Failed to load dossier details:', err);
      showError(err.message || 'Could not load dossier details.');
    } finally {
      setLoading(false);
    }
  }, [id, showError]);

  useEffect(() => {
    fetchDossierData();
  }, [fetchDossierData]);

  const handleExportChecklist = async () => {
    if (!id) return;
    setIsExporting(true);
    try {
      const res: any = await adminService.exportChecklist(id);
      if (res.data?.checklistPdfUrl || res.checklistPdfUrl) {
        window.open(res.data?.checklistPdfUrl || res.checklistPdfUrl, '_blank');
      } else {
        showSuccess('Checklist export triggered.');
      }
    } catch (err) {
      showError('Failed to export checklist PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSummary = async () => {
    if (!id) return;
    setIsExporting(true);
    try {
      const res: any = await adminService.getSummaryPdf(id);
      if (res.data?.summaryPdfUrl || res.summaryPdfUrl) {
        window.open(res.data?.summaryPdfUrl || res.summaryPdfUrl, '_blank');
      } else {
        showSuccess('Summary PDF generated.');
      }
    } catch (err) {
      showError('Failed to generate summary PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="dossier-detail-loading">
        <div className="spinner"></div>
        <p>Loading dossier examination workspace...</p>
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="dossier-detail-error">
        <h2>Dossier not found</h2>
        <p>The requested visa application record does not exist or has been removed.</p>
        <button className="btn-action-primary" onClick={() => navigate('/admin/dossiers')}>
          ← Return to All Dossiers
        </button>
      </div>
    );
  }

  const primaryApplicant = dossier.applicants?.[0];
  const allDocuments = dossier.documents || [];
  const verifiedCount = allDocuments.filter(d => d.status === 'VERIFIED').length;
  const correctionCount = allDocuments.filter(d => d.status === 'NEEDS_CORRECTION').length;
  const formData = primaryApplicant?.formDataJson || {};

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'badge-approved';
      case 'REJECTED': return 'badge-rejected';
      case 'UNDER_REVIEW': return 'badge-review';
      case 'NEEDS_CORRECTION': return 'badge-warning';
      case 'SUBMITTED_TO_CONSULATE': return 'badge-consulate';
      default: return 'badge-received';
    }
  };

  const getDocStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return <span className="doc-pill pill-verified">✓ Verified</span>;
      case 'NEEDS_CORRECTION':
        return <span className="doc-pill pill-correction">⚠️ Action Req.</span>;
      case 'REJECTED':
        return <span className="doc-pill pill-rejected">✕ Rejected</span>;
      default:
        return <span className="doc-pill pill-pending">Pending Review</span>;
    }
  };

  return (
    <div className="admin-dossier-detail-view">
      {/* --- TOP BREADCRUMB & ACTIONS --- */}
      <div className="detail-top-nav">
        <button className="btn-back" onClick={() => navigate('/admin/dossiers')}>
          ← Back to Dossier Registry
        </button>
        <div className="top-nav-actions">
          <button className="btn-secondary" onClick={handleExportSummary} disabled={isExporting}>
            📄 Summary PDF
          </button>
          <button className="btn-secondary" onClick={handleExportChecklist} disabled={isExporting}>
            📋 Export Checklist
          </button>
          <button className="btn-consular-decision" onClick={() => setIsDecisionModalOpen(true)}>
            ⚖️ Issue Consular Decision
          </button>
        </div>
      </div>

      {/* --- DOSSIER HERO CARD --- */}
      <div className="dossier-hero-card">
        <div className="hero-left">
          <div className="dossier-header-title">
            <span className="hero-jurisdiction">
              {dossier.country?.nameEn} Consular Review
            </span>
            <h1>{dossier.dossierNumber}</h1>
          </div>
          <div className="hero-meta-strip">
            <span className={`admin-badge ${getStatusBadgeClass(dossier.status)}`}>
              {dossier.status.replace(/_/g, ' ')}
            </span>
            <span className="hero-sep">•</span>
            <span className="hero-channel">Channel: <strong>{dossier.portalType}</strong></span>
            <span className="hero-sep">•</span>
            <span className="hero-date">Registered: {new Date(dossier.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </div>

        <div className="hero-right">
          <div className="hero-stat-box">
            <span className="box-label">Verified Documents</span>
            <span className="box-val text-emerald">{verifiedCount} / {allDocuments.length}</span>
            {correctionCount > 0 && <span className="box-sub text-amber">{correctionCount} Needs Correction</span>}
          </div>
          <div className="hero-stat-box">
            <span className="box-label">Total Consular Fees</span>
            <span className="box-val">€{dossier.totalAmount}</span>
            <span className="box-sub">Status: {dossier.paymentStatus}</span>
          </div>
        </div>
      </div>

      {/* --- QUICK DETAILS BAR --- */}
      <div className="dossier-summary-bar">
        <div className="summary-col">
          <span className="col-label">PRIMARY APPLICANT</span>
          <strong>{primaryApplicant ? `${primaryApplicant.firstName} ${primaryApplicant.lastName}` : dossier.user?.fullName}</strong>
          <span>Passport: {primaryApplicant?.passportNumber || '—'}</span>
        </div>
        <div className="summary-col">
          <span className="col-label">DESTINATION / CATEGORY</span>
          <strong>{dossier.country?.nameEn || 'Schengen Area'}</strong>
          <span>{dossier.visaCategory?.nameEn || 'Visa'}</span>
        </div>
        <div className="summary-col">
          <span className="col-label">BIOMETRIC APPOINTMENT</span>
          <strong>
            {dossier.appointmentDate 
              ? new Date(dossier.appointmentDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
              : 'Not Scheduled'}
          </strong>
          <span>{dossier.appointmentLocation || 'EuroTech Main Biometrics Center'}</span>
        </div>
        <div className="summary-col">
          <span className="col-label">REGISTERED USER / CONTACT</span>
          <strong>{dossier.user?.email || '—'}</strong>
          <span>{dossier.user?.phone || 'No phone recorded'}</span>
        </div>
      </div>

      {/* --- TABS NAVIGATION --- */}
      <div className="detail-tabs-header">
        <button
          className={`detail-tab-btn ${activeTab === 'documents' ? 'active' : ''}`}
          onClick={() => setActiveTab('documents')}
        >
          📁 Document Examination Desk ({allDocuments.length})
        </button>
        <button
          className={`detail-tab-btn ${activeTab === 'applicant' ? 'active' : ''}`}
          onClick={() => setActiveTab('applicant')}
        >
          👤 Consular Application Questionnaire
        </button>
        <button
          className={`detail-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          🕒 Audit Trail & Status History ({dossier.statusHistory?.length || 0})
        </button>
      </div>

      {/* --- TAB CONTENT AREA --- */}
      <div className="detail-tab-content">
        {/* TAB 1: DOCUMENTS */}
        {activeTab === 'documents' && (
          <div className="tab-pane-documents">
            <div className="docs-section-header">
              <div>
                <h3>Mandatory Document Checklist</h3>
                <p>Click on any document card to inspect the file preview and record official verification decisions.</p>
              </div>
            </div>

            {allDocuments.length === 0 ? (
              <div className="empty-docs-box">
                <p>No documents uploaded for this application yet.</p>
              </div>
            ) : (
              <div className="docs-grid">
                {allDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="admin-doc-card"
                    onClick={() => setSelectedDocForReview(doc)}
                  >
                    <div className="doc-card-top">
                      <div className="doc-icon-box">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                        </svg>
                      </div>
                      {getDocStatusBadge(doc.status)}
                    </div>
                    <div className="doc-card-title">
                      <h4>{doc.requiredDocumentType.replace(/_/g, ' ')}</h4>
                      <p title={doc.fileName}>{doc.fileName}</p>
                    </div>
                    {doc.operatorNotes && (
                      <div className="doc-notes-preview">
                        <strong>Note:</strong> {doc.operatorNotes}
                      </div>
                    )}
                    <div className="doc-card-footer">
                      <span className="doc-size">{(doc.fileSize / 1024).toFixed(0)} KB</span>
                      <button className="btn-examine-doc">
                        Examine & Verify →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: APPLICANT FORM */}
        {activeTab === 'applicant' && (
          <div className="tab-pane-questionnaire">
            <div className="questionnaire-header">
              <h3>Applicant Bio-Data & Consular Responses</h3>
              <p>Submitted responses to the 5-step official consular application questionnaire.</p>
            </div>

            <div className="qa-sections-grid">
              {/* Step 1: Travel Plans */}
              <div className="qa-card">
                <h4>1. Travel Details & Plans</h4>
                <div className="qa-rows">
                  <div className="qa-row"><span className="qa-k">Purpose:</span><span className="qa-v">{formData.purpose || 'Tourism'}</span></div>
                  <div className="qa-row"><span className="qa-k">Destination:</span><span className="qa-v">{formData.destination || dossier.country?.nameEn}</span></div>
                  <div className="qa-row"><span className="qa-k">First Entry:</span><span className="qa-v">{formData.firstEntry || dossier.country?.nameEn}</span></div>
                  <div className="qa-row"><span className="qa-k">Entries Requested:</span><span className="qa-v">{formData.entriesRequested || 'Single'}</span></div>
                  <div className="qa-row"><span className="qa-k">Arrival Date:</span><span className="qa-v">{formData.arrivalDate || '—'}</span></div>
                  <div className="qa-row"><span className="qa-k">Departure Date:</span><span className="qa-v">{formData.departureDate || '—'}</span></div>
                  <div className="qa-row"><span className="qa-k">Duration of Stay:</span><span className="qa-v">{formData.durationOfStay ? `${formData.durationOfStay} days` : '—'}</span></div>
                </div>
              </div>

              {/* Step 2: Personal Info */}
              <div className="qa-card">
                <h4>2. Personal Identification</h4>
                <div className="qa-rows">
                  <div className="qa-row"><span className="qa-k">Full Name:</span><span className="qa-v">{formData.firstName} {formData.lastName}</span></div>
                  <div className="qa-row"><span className="qa-k">Birth Surname:</span><span className="qa-v">{formData.birthSurname || '—'}</span></div>
                  <div className="qa-row"><span className="qa-k">Date of Birth:</span><span className="qa-v">{formData.birthDate || '—'}</span></div>
                  <div className="qa-row"><span className="qa-k">Place of Birth:</span><span className="qa-v">{formData.birthPlace || '—'}</span></div>
                  <div className="qa-row"><span className="qa-k">Nationality:</span><span className="qa-v">{formData.nationality || 'Azerbaijan'}</span></div>
                  <div className="qa-row"><span className="qa-k">Gender:</span><span className="qa-v">{formData.gender || '—'}</span></div>
                  <div className="qa-row"><span className="qa-k">Marital Status:</span><span className="qa-v">{formData.maritalStatus || '—'}</span></div>
                </div>
              </div>

              {/* Step 3: Travel Document */}
              <div className="qa-card">
                <h4>3. Travel Document (Passport)</h4>
                <div className="qa-rows">
                  <div className="qa-row"><span className="qa-k">Passport Type:</span><span className="qa-v">{formData.passportType || 'Ordinary Passport'}</span></div>
                  <div className="qa-row"><span className="qa-k">Passport Number:</span><span className="qa-v font-mono">{formData.passportNumber || primaryApplicant?.passportNumber || '—'}</span></div>
                  <div className="qa-row"><span className="qa-k">Date of Issue:</span><span className="qa-v">{formData.issueDate || '—'}</span></div>
                  <div className="qa-row"><span className="qa-k">Date of Expiry:</span><span className="qa-v">{formData.passportExpiry || '—'}</span></div>
                  <div className="qa-row"><span className="qa-k">Issued By:</span><span className="qa-v">{formData.issuedBy || 'Republic of Azerbaijan'}</span></div>
                </div>
              </div>

              {/* Step 4: Accommodation & Host */}
              <div className="qa-card">
                <h4>4. Stay & Financial Support</h4>
                <div className="qa-rows">
                  <div className="qa-row"><span className="qa-k">Inviting Party / Hotel:</span><span className="qa-v">{formData.invitingParty || 'Hotel Reservation'}</span></div>
                  <div className="qa-row"><span className="qa-k">Address in Destination:</span><span className="qa-v">{formData.address || '—'}</span></div>
                  <div className="qa-row"><span className="qa-k">Travel Costs Covered By:</span><span className="qa-v">{formData.costCoveredBy || 'Applicant himself'}</span></div>
                  <div className="qa-row"><span className="qa-k">Means of Support:</span><span className="qa-v">{formData.meansOfSupport || 'Credit card & Cash'}</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: AUDIT HISTORY */}
        {activeTab === 'history' && (
          <div className="tab-pane-history">
            <div className="history-header">
              <h3>Consular Audit & Status Log</h3>
              <p>Chronological record of status transitions, officer reviews, and notifications.</p>
            </div>

            {!dossier.statusHistory || dossier.statusHistory.length === 0 ? (
              <div className="empty-history-box">
                <p>No status transitions recorded yet for this dossier.</p>
              </div>
            ) : (
              <div className="history-timeline">
                {dossier.statusHistory.map((h) => (
                  <div key={h.id} className="timeline-node">
                    <div className="timeline-dot"></div>
                    <div className="timeline-content">
                      <div className="timeline-title-row">
                        <strong>
                          {h.fromStatus} ➔ <span className="status-highlight">{h.toStatus}</span>
                        </strong>
                        <span className="timeline-time">
                          {new Date(h.createdAt).toLocaleString('en-US')}
                        </span>
                      </div>
                      {h.notes && <p className="timeline-notes">"{h.notes}"</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- DOCUMENT REVIEW MODAL --- */}
      {selectedDocForReview && (
        <DocumentReviewModal
          document={selectedDocForReview}
          dossierId={dossier.id}
          isOpen={true}
          onClose={() => setSelectedDocForReview(null)}
          onSuccess={() => fetchDossierData()}
        />
      )}

      {/* --- CONSULAR DECISION MODAL --- */}
      {isDecisionModalOpen && (
        <ConsularDecisionModal
          dossierId={dossier.id}
          dossierNumber={dossier.dossierNumber}
          currentStatus={dossier.status}
          isOpen={true}
          onClose={() => setIsDecisionModalOpen(false)}
          onSuccess={(newStatus: DossierStatusType) => {
            setDossier(prev => prev ? { ...prev, status: newStatus } : null);
            fetchDossierData();
          }}
        />
      )}
    </div>
  );
}
