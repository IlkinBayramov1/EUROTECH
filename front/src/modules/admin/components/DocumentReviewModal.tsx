import React, { useState } from 'react';
import { adminService } from '@/shared/api/services/admin.service';
import { useToast } from '@/shared/context/ToastContext';
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

  if (!isOpen) return null;

  const isPdf = document.fileName?.toLowerCase().endsWith('.pdf') || document.fileUrl?.toLowerCase().includes('.pdf');
  const fileUrl = document.fileUrl?.startsWith('http') 
    ? document.fileUrl 
    : `http://localhost:5000${document.fileUrl?.startsWith('/') ? '' : '/'}${document.fileUrl}`;

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
                <iframe 
                  src={fileUrl} 
                  title={document.fileName}
                  className="pdf-frame"
                />
                <div className="preview-fallback-bar">
                  <span>Viewing PDF Document</span>
                  <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="btn-open-external">
                    Open in New Tab ↗
                  </a>
                </div>
              </div>
            ) : (
              <div className="image-preview-box">
                <img src={fileUrl} alt={document.fileName} />
                <div className="preview-fallback-bar">
                  <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="btn-open-external">
                    Open Full Image ↗
                  </a>
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
                  <span className="status-icon">✓</span>
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
                  <span className="status-icon">⚠️</span>
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
                  <span className="status-icon">✕</span>
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
