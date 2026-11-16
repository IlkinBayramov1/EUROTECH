import React, { useState } from 'react';
import { adminService } from '@/shared/api/services/admin.service';
import { useToast } from '@/shared/context/ToastContext';
import { getFileUrl } from '@/shared/utils/file.util';
import { storage } from '@/shared/utils/storage';
import { downloadFileFromApi } from '@/shared/utils/download.util';
import type { AdminApplicantDocument, DocumentStatusType } from '@/shared/types/admin.types';
import './DocumentReviewModal.css';

interface DocumentReviewModalProps {
  document: AdminApplicantDocument;
  dossierId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DocumentReviewModal({
  document,
  dossierId,
  isOpen,
  onClose,
  onSuccess,
}: DocumentReviewModalProps) {
  const { showSuccess, showError } = useToast();
  const [selectedStatus, setSelectedStatus] = useState<DocumentStatusType>(document.status || 'PENDING');
  const [notes, setNotes] = useState(document.operatorNotes || '');
  const [notifyApplicant, setNotifyApplicant] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpeningInTab, setIsOpeningInTab] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen) return null;

  const isPdf = document.fileName?.toLowerCase().endsWith('.pdf') || document.fileUrl?.toLowerCase().includes('.pdf');
  const fileUrl = getFileUrl(document.fileUrl);

  const handleOpenInNewTab = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!document) return;

    setIsOpeningInTab(true);
    try {
      // 1. Try to obtain a temporary signed inline URL from backend
      let targetOpenUrl = '';
      if (document.id) {
        try {
          const res = await adminService.getDocumentSignedUrl(document.id);
          const rawSignedUrl = res?.data?.data?.signedUrl || res?.data?.signedUrl || res?.data?.data?.inlineUrl;
          if (rawSignedUrl) {
            targetOpenUrl = getFileUrl(rawSignedUrl);
          }
        } catch (signedErr) {
          console.warn('[DocReviewModal] Could not get signed URL, falling back to static URL / blob:', signedErr);
        }
      }

      // 2. If signed URL obtained, open directly in a new tab
      if (targetOpenUrl) {
        const openedWin = window.open(targetOpenUrl, '_blank', 'noopener,noreferrer');
        if (openedWin) {
          setIsOpeningInTab(false);
          return;
        }
      }

      // 3. Fallback: Authenticated stream via fetch + Blob URL
      const fallbackUrl = fileUrl || getFileUrl(document.fileUrl);
      if (!fallbackUrl) {
        throw new Error('Sənədin fayl keçidi mövcud deyil.');
      }

      const token = storage.getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(fallbackUrl, { method: 'GET', headers });
      if (!res.ok) {
        throw new Error(`Fayl serverdən yüklənə bilmədi (Status: ${res.status})`);
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const opened = window.open(blobUrl, '_blank');
      if (!opened) {
        const a = window.document.createElement('a');
        a.href = blobUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        window.document.body.appendChild(a);
        a.click();
        window.document.body.removeChild(a);
      }
    } catch (err: any) {
      console.error('Failed to open document in new tab:', err);
      showError(err.message || 'Sənəd linki açıla bilmədi.');
    } finally {
      setIsOpeningInTab(false);
    }
  };

  const handleDownloadFile = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!document) return;
    setIsDownloading(true);
    try {
      const fileName = document.fileName || 'document.pdf';
      const targetUrl = fileUrl || getFileUrl(document.fileUrl);
      if (!targetUrl) {
        throw new Error('Sənədin fayl ünvanı mövcud deyil.');
      }
      await downloadFileFromApi(targetUrl, fileName);
    } catch (err: any) {
      console.error('Download error:', err);
      showError(err.message || 'Sənəd endirilə bilmədi.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((selectedStatus === 'NEEDS_CORRECTION' || selectedStatus === 'REJECTED') && !notes.trim()) {
      showError('Please provide operator notes explaining the correction or rejection reason.');
      return;
    }

    setIsSubmitting(true);
    try {
      await adminService.reviewDocument(document.id, {
        status: selectedStatus,
        operatorNotes: notes.trim() || undefined,
      });

      if (notifyApplicant && (selectedStatus === 'NEEDS_CORRECTION' || notes.trim())) {
        await adminService.sendFeedback(dossierId, notes.trim()).catch(() => {});
      }

      showSuccess(`Document marked as ${selectedStatus.replace(/_/g, ' ')}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Document review error:', err);
      showError(err.message || 'Failed to update document status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDocType = (typeStr: string) => {
    return typeStr.replace(/_/g, ' ');
  };

  return (
    <div className="doc-modal-overlay" onClick={onClose}>
      <div className="doc-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="doc-modal-header">
          <div className="doc-header-info">
            <span className="doc-type-badge">{formatDocType(document.requiredDocumentType)}</span>
            <h3 title={document.fileName}>{document.fileName}</h3>
          </div>
          <button className="doc-modal-close-btn" onClick={onClose}>×</button>
        </div>

        {/* Body Split View */}
        <div className="doc-modal-body">
          {/* Left: Document Preview */}
          <div className="doc-preview-pane">
            {isPdf ? (
              <div className="pdf-preview-box">
                {fileUrl ? (
                  <iframe 
                    src={fileUrl} 
                    title={document.fileName}
                    className="pdf-frame"
                  />
                ) : (
                  <div className="preview-empty-state">
                    <p>Sənəd fayl linki təyin edilməyib</p>
                  </div>
                )}
                <div className="preview-fallback-bar">
                  <span>Viewing PDF Document</span>
                  <div className="preview-actions-group">
                    <button
                      type="button"
                      onClick={handleOpenInNewTab}
                      disabled={isOpeningInTab}
                      className="btn-open-external"
                    >
                      {isOpeningInTab ? 'Opening...' : 'Open in New Tab ↗'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadFile}
                      disabled={isDownloading}
                      className="btn-download-preview"
                    >
                      {isDownloading ? 'Downloading...' : 'Download'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="image-preview-box">
                {fileUrl ? (
                  <img src={fileUrl} alt={document.fileName} />
                ) : (
                  <div className="preview-empty-state">
                    <p>Sənəd fayl linki təyin edilməyib</p>
                  </div>
                )}
                <div className="preview-fallback-bar">
                  <span>Image Document</span>
                  <div className="preview-actions-group">
                    <button
                      type="button"
                      onClick={handleOpenInNewTab}
                      disabled={isOpeningInTab}
                      className="btn-open-external"
                    >
                      {isOpeningInTab ? 'Opening...' : 'Open Full Image ↗'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadFile}
                      disabled={isDownloading}
                      className="btn-download-preview"
                    >
                      {isDownloading ? 'Downloading...' : 'Download'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Review & Decision Controls */}
          <div className="doc-decision-pane">
            <h4>Consular Verification Decision</h4>
            <p className="pane-desc">
              Examine the applicant's submitted file for legibility, validity, and compliance with embassy rules.
            </p>

            <form onSubmit={handleSubmit}>
              {/* Status Action Buttons */}
              <div className="status-selector-grid">
                <button
                  type="button"
                  className={`status-btn btn-verify ${selectedStatus === 'VERIFIED' ? 'active' : ''}`}
                  onClick={() => setSelectedStatus('VERIFIED')}
                >
                  <span className="status-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <div>
                    <strong>Verify</strong>
                    <small>Document accepted</small>
                  </div>
                </button>

                <button
                  type="button"
                  className={`status-btn btn-correction ${selectedStatus === 'NEEDS_CORRECTION' ? 'active' : ''}`}
                  onClick={() => setSelectedStatus('NEEDS_CORRECTION')}
                >
                  <span className="status-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </span>
                  <div>
                    <strong>Correction</strong>
                    <small>Request replacement</small>
                  </div>
                </button>

                <button
                  type="button"
                  className={`status-btn btn-reject ${selectedStatus === 'REJECTED' ? 'active' : ''}`}
                  onClick={() => setSelectedStatus('REJECTED')}
                >
                  <span className="status-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </span>
                  <div>
                    <strong>Reject</strong>
                    <small>Declined / Invalid</small>
                  </div>
                </button>
              </div>

              {/* Operator Notes */}
              <div className="input-field-group">
                <label>
                  Operator Review Notes
                  {(selectedStatus === 'NEEDS_CORRECTION' || selectedStatus === 'REJECTED') && (
                    <span className="required-star">* (Required for applicant notice)</span>
                  )}
                </label>
                <textarea
                  rows={4}
                  placeholder={
                    selectedStatus === 'NEEDS_CORRECTION'
                      ? 'E.g. Document image is blurred or stamp is missing. Please re-upload a clear color scan.'
                      : 'Add administrative or verification notes for the record...'
                  }
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Notify Checkbox */}
              <label className="notify-checkbox">
                <input
                  type="checkbox"
                  checked={notifyApplicant}
                  onChange={(e) => setNotifyApplicant(e.target.checked)}
                />
                <span>Send automated email notification to applicant regarding this update</span>
              </label>

              {/* Actions Footer */}
              <div className="modal-actions-footer">
                <button type="button" className="btn-cancel" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit-review" disabled={isSubmitting}>
                  {isSubmitting ? 'Recording Decision...' : 'Save Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
