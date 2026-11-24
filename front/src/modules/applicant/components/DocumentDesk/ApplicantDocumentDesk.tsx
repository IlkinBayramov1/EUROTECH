import React, { useState, useRef, useEffect } from 'react';
import { documentService } from '@/shared/api/services/document.service';
import { vcmsApi } from '@/modules/admin/api/vcmsApi';
import { useToast } from '@/shared/context/ToastContext';
import { getFileUrl } from '@/shared/utils/file.util';
import type { UnifiedApplicant, DossierContext, ApplicantDoc } from '../../types/applicant.types';

interface DocumentDeskProps {
  applicant: UnifiedApplicant;
  dossier: DossierContext;
  onReload: () => void;
}

const DEFAULT_OFFICIAL_DOC_TYPES = [
  { code: 'PASSPORT', title: 'National Passport Bio-Data Page', desc: 'High-resolution scan of primary bio-data page with photo and signature.', isMandatory: true },
  { code: 'BIOMETRIC_PHOTO', title: 'ICAO Biometric Photograph', desc: 'Recent color photograph (35x45mm) on clean light background complying with ICAO standards.', isMandatory: true },
  { code: 'BANK_STATEMENT', title: 'Proof of Financial Solvency (Bank Statement)', desc: 'Official bank account statement covering the trailing 3-6 months with bank stamp.', isMandatory: true },
  { code: 'EMPLOYMENT_LETTER', title: 'Employment Certificate / Mission Order', desc: 'Official HR employment confirmation letter, company decree, or student certificate.', isMandatory: true },
  { code: 'ACCOMMODATION', title: 'Hotel / Accommodation Reservation', desc: 'Confirmed booking voucher showing applicant names matching intended travel itinerary.', isMandatory: true },
  { code: 'FLIGHT_ITINERARY', title: 'Roundtrip Flight Reservation', desc: 'Confirmed flight booking showing entry and exit points into Schengen territory.', isMandatory: true },
  { code: 'INSURANCE', title: 'Schengen Travel Medical Insurance', desc: 'Insurance certificate covering minimum €30,000 emergency medical and repatriation expenses.', isMandatory: true },
];

export default function ApplicantDocumentDesk({
  applicant,
  dossier,
  onReload,
}: DocumentDeskProps) {
  const { showSuccess, showError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDocCode, setSelectedDocCode] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [vcmsDocs, setVcmsDocs] = useState<any[]>([]);

  useEffect(() => {
    if (!dossier?.id || !applicant?.id) return;
    vcmsApi
      .getApplicantAnswers(dossier.id, applicant.id)
      .then((res) => {
        const docs = res.data?.schema?.documents || [];
        if (Array.isArray(docs) && docs.length > 0) {
          setVcmsDocs(docs.filter((d: any) => d.evaluatedVisibility !== false));
        }
      })
      .catch(() => {});
  }, [dossier?.id, applicant?.id]);

  // Dynamic document requirements from VCMS PurposeDocumentConfig, database visaCategory, or default official list
  const requiredList = React.useMemo(() => {
    if (vcmsDocs.length > 0) {
      return vcmsDocs.map((d: any) => ({
        code: d.legacyDocCode || d.documentCode,
        documentCode: d.documentCode,
        purposeDocumentConfigId: d.configId || d.id,
        title: `${d.documentCode} — ${d.nameEn}`,
        desc: d.descriptionEn || d.descriptionAz || 'Official consular compliance document.',
        isMandatory: d.evaluatedRequired !== undefined ? d.evaluatedRequired : d.isRequired,
      }));
    }
    const dbTypes = dossier.visaCategory?.requiredDocTypes;
    if (Array.isArray(dbTypes) && dbTypes.length > 0) {
      return dbTypes.map(t => ({
        code: t.code,
        documentCode: t.code,
        purposeDocumentConfigId: undefined,
        title: t.nameEn || t.code,
        desc: t.descriptionEn || t.descriptionAz || 'Official consular compliance document.',
        isMandatory: t.isMandatory !== undefined ? t.isMandatory : true,
      }));
    }
    return DEFAULT_OFFICIAL_DOC_TYPES.map((t) => ({
      ...t,
      documentCode: t.code,
      purposeDocumentConfigId: undefined,
    }));
  }, [vcmsDocs, dossier.visaCategory]);

  const applicantDocs = applicant.documents || [];

  const handleTriggerUpload = (docCode: string) => {
    setSelectedDocCode(docCode);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDocCode) return;

    if (file.size > 15 * 1024 * 1024) {
      showError('File exceeds maximum allowable size of 15 MB.');
      return;
    }

    setUploading(true);
    try {
      const targetReq = requiredList.find(r => r.code === selectedDocCode);
      await documentService.uploadDocument({
        dossierId: dossier.id,
        applicantId: applicant.id,
        requiredDocumentType: selectedDocCode,
        purposeDocumentConfigId: targetReq?.purposeDocumentConfigId,
        globalDocumentCode: targetReq?.documentCode,
        isMandatory: targetReq ? targetReq.isMandatory : true,
        file,
      });

      showSuccess(`Document uploaded successfully: ${file.name}`);
      onReload();
    } catch (err: any) {
      console.error('Document upload error:', err);
      showError(err.message || 'Failed to upload document file.');
    } finally {
      setUploading(false);
      setSelectedDocCode(null);
    }
  };

  const handleDeleteDocument = async (docId: string, docTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete ${docTitle}?`)) return;
    try {
      await documentService.deleteDocument(docId);
      showSuccess('Document deleted.');
      onReload();
    } catch (err: any) {
      showError(err.message || 'Failed to delete document.');
    }
  };

  const uploadedCount = requiredList.filter(r =>
    applicantDocs.some(d => d.requiredDocumentType === r.code)
  ).length;

  return (
    <div className="applicant-doc-desk-card">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      <div className="doc-desk-header">
        <div>
          <h3>Official Document Examination & Upload Desk</h3>
          <p className="doc-desk-sub">
            Upload clear digital copies in PDF, JPG, or PNG format for consular verification.
          </p>
        </div>
        <div className="doc-desk-counter-pill">
          Uploaded: <strong>{uploadedCount} / {requiredList.length}</strong>
        </div>
      </div>

      <div className="doc-cards-grid">
        {requiredList.map((req) => {
          const uploadedDoc: ApplicantDoc | undefined = applicantDocs.find(
            d => d.requiredDocumentType === req.code
          );

          let statusBadge = null;
          if (uploadedDoc) {
            const st = uploadedDoc.status;
            if (st === 'VERIFIED') {
              statusBadge = <span className="status-badge-verified">Verified</span>;
            } else if (st === 'NEEDS_CORRECTION') {
              statusBadge = <span className="status-badge-correction">Action Required</span>;
            } else if (st === 'REJECTED') {
              statusBadge = <span className="status-badge-rejected">Rejected</span>;
            } else {
              statusBadge = <span className="status-badge-pending">Under Review</span>;
            }
          }

          return (
            <div key={req.code} className={`doc-item-card ${uploadedDoc ? 'has-file' : 'missing'}`}>
              <div className="doc-card-top">
                <div className="doc-title-group">
                  <div className="doc-type-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  </div>
                  <div>
                    <h4 className="doc-name">{req.title}</h4>
                    <span className="doc-desc">{req.desc}</span>
                  </div>
                </div>
                <div className="doc-meta-right">
                  {req.isMandatory && <span className="mandatory-tag">MANDATORY</span>}
                  {statusBadge}
                </div>
              </div>

              {uploadedDoc && (
                <div className="uploaded-file-banner">
                  <span className="file-name">
                    {uploadedDoc.originalFileName || uploadedDoc.fileName || 'Uploaded_Document.pdf'}
                  </span>
                  {uploadedDoc.operatorNotes && (
                    <div className="operator-notes-box">
                      <strong>Consular Officer Note:</strong> {uploadedDoc.operatorNotes}
                    </div>
                  )}
                </div>
              )}

              <div className="doc-card-actions">
                {uploadedDoc ? (
                  <>
                    <a
                      href={getFileUrl(uploadedDoc.fileUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-doc-view"
                    >
                      View Document
                    </a>
                    <button
                      type="button"
                      className="btn-doc-replace"
                      onClick={() => handleTriggerUpload(req.code)}
                      disabled={uploading}
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      className="btn-doc-delete"
                      onClick={() => handleDeleteDocument(uploadedDoc.id, req.title)}
                    >
                      Delete
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn-doc-upload"
                    onClick={() => handleTriggerUpload(req.code)}
                    disabled={uploading}
                  >
                    Upload Document
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

