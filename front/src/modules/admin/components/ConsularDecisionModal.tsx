import React, { useState } from 'react';
import { adminService } from '@/shared/api/services/admin.service';
import { useToast } from '@/shared/context/ToastContext';
import type { DossierStatusType } from '@/shared/types/admin.types';
import './ConsularDecisionModal.css';

interface ConsularDecisionModalProps {
  dossierId: string;
  dossierNumber: string;
  currentStatus: DossierStatusType;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newStatus: DossierStatusType) => void;
}

export default function ConsularDecisionModal({
  dossierId,
  dossierNumber,
  currentStatus,
  isOpen,
  onClose,
  onSuccess,
}: ConsularDecisionModalProps) {
  const { showSuccess, showError } = useToast();
  const [selectedDecision, setSelectedDecision] = useState<DossierStatusType>('APPROVED');
  const [consularNotes, setConsularNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDecision === 'REJECTED' && !consularNotes.trim()) {
      showError('Please record the legal/consular grounds for refusal.');
      return;
    }

    setIsSubmitting(true);
    try {
      await adminService.updateDossierDecision(dossierId, {
        nextStatus: selectedDecision,
        notes: consularNotes.trim() || undefined,
      });

      showSuccess(`Consular decision recorded: ${selectedDecision.replace(/_/g, ' ')}`);
      onSuccess(selectedDecision);
      onClose();
    } catch (err: any) {
      console.error('Decision update error:', err);
      showError(err.message || 'Failed to record consular decision.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="decision-modal-overlay" onClick={onClose}>
      <div className="decision-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="decision-modal-header">
          <div>
            <span className="consular-seal-text">Official Diplomatic Review</span>
            <h3>Issue Consular Decision</h3>
            <p className="dossier-ref-tag">Dossier: <strong>{dossierNumber}</strong></p>
          </div>
          <button className="decision-close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="decision-modal-body">
          <p className="decision-instructions">
            Select the formal status outcome for this visa dossier. All updates are permanently logged into the blockchain/audit log and communicated to the applicant.
          </p>

          <div className="decision-options-list">
            {/* 1. Transmit to Embassy */}
            <label className={`decision-card ${selectedDecision === 'SUBMITTED_TO_CONSULATE' ? 'selected-consulate' : ''}`}>
              <input
                type="radio"
                name="decision"
                value="SUBMITTED_TO_CONSULATE"
                checked={selectedDecision === 'SUBMITTED_TO_CONSULATE'}
                onChange={() => setSelectedDecision('SUBMITTED_TO_CONSULATE')}
              />
              <div className="decision-icon">🛂</div>
              <div className="decision-text">
                <strong>Transmit to Embassy / VAC</strong>
                <span>Internal verification passed. Dispatched to the diplomatic mission for biometric visa stamp.</span>
              </div>
            </label>

            {/* 2. Approve */}
            <label className={`decision-card ${selectedDecision === 'APPROVED' ? 'selected-approve' : ''}`}>
              <input
                type="radio"
                name="decision"
                value="APPROVED"
                checked={selectedDecision === 'APPROVED'}
                onChange={() => setSelectedDecision('APPROVED')}
              />
              <div className="decision-icon">✅</div>
              <div className="decision-text">
                <strong>Approve Visa Application</strong>
                <span>Official visa grant authorized. Passport returned with approved Schengen/National sticker.</span>
              </div>
            </label>

            {/* 3. Reject */}
            <label className={`decision-card ${selectedDecision === 'REJECTED' ? 'selected-reject' : ''}`}>
              <input
                type="radio"
                name="decision"
                value="REJECTED"
                checked={selectedDecision === 'REJECTED'}
                onChange={() => setSelectedDecision('REJECTED')}
              />
              <div className="decision-icon">❌</div>
              <div className="decision-text">
                <strong>Refuse Visa Application</strong>
                <span>Application rejected under diplomatic immigration criteria. Official refusal letter generated.</span>
              </div>
            </label>

            {/* 4. Request Applicant Correction */}
            <label className={`decision-card ${selectedDecision === 'NEEDS_CORRECTION' ? 'selected-warning' : ''}`}>
              <input
                type="radio"
                name="decision"
                value="NEEDS_CORRECTION"
                checked={selectedDecision === 'NEEDS_CORRECTION'}
                onChange={() => setSelectedDecision('NEEDS_CORRECTION')}
              />
              <div className="decision-icon">⚠️</div>
              <div className="decision-text">
                <strong>Return for Correction</strong>
                <span>Applicant must submit amended documentation or clarify questionnaire answers.</span>
              </div>
            </label>
          </div>

          <div className="decision-notes-area">
            <label>
              Official Consular Findings & Remarks
              {selectedDecision === 'REJECTED' && <span className="star-red">* (Required)</span>}
            </label>
            <textarea
              rows={3}
              placeholder={
                selectedDecision === 'APPROVED'
                  ? 'E.g. Visa issued for 90 days, multiple entry. Bio verification cleared.'
                  : selectedDecision === 'REJECTED'
                  ? 'State specific legal grounds for refusal (e.g. Schengen Visa Code Article 32)...'
                  : 'Add administrative or consular remarks...'
              }
              value={consularNotes}
              onChange={(e) => setConsularNotes(e.target.value)}
            />
          </div>

          <div className="decision-modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button 
              type="submit" 
              className={`btn-confirm-decision ${selectedDecision === 'REJECTED' ? 'btn-red' : 'btn-emerald'}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Recording Official Decision...' : `Confirm: ${selectedDecision.replace(/_/g, ' ')}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
