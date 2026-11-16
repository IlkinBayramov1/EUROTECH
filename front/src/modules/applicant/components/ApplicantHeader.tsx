import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { downloadFileFromApi } from '@/shared/utils/download.util';
import { useToast } from '@/shared/context/ToastContext';
import type { UnifiedApplicant, DossierContext, ApplicantPermissions } from '../types/applicant.types';

interface ApplicantHeaderProps {
  applicant: UnifiedApplicant;
  dossier: DossierContext;
  permissions: ApplicantPermissions;
  progress: number;
  saving: boolean;
  lastSaved: Date | null;
  onOpenMrzModal: () => void;
  onManualSave: () => void;
}

export default function ApplicantHeader({
  applicant,
  dossier,
  permissions,
  progress,
  saving,
  lastSaved,
  onOpenMrzModal,
  onManualSave,
}: ApplicantHeaderProps) {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadSchengenPdf = async () => {
    setDownloadingPdf(true);
    try {
      await downloadFileFromApi(
        `/dossiers/${dossier.id}/applicants/${applicant.id}/application-pdf?download=true`,
        `Harmonized_Schengen_Form_${applicant.firstName}_${applicant.lastName}.pdf`
      );
      showSuccess('Official Harmonized Schengen PDF Form downloaded.');
    } catch (err: any) {
      showError(err.message || 'Failed to generate Schengen form PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleCopySelfFillLink = () => {
    const originUrl = window.location.origin;
    const url = `${originUrl}/application/${dossier.id}/applicant/${applicant.id}?origin=guest&token=self-fill-${applicant.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
    showSuccess(`Applicant Self-Fill link copied!\n${url}`);
  };

  const fullName = `${applicant.firstName || ''} ${applicant.lastName || ''}`.trim() || 'Applicant';

  return (
    <div className="applicant-unified-header">
      <div className="header-top-row">
        <div className="header-breadcrumb-wrap">
          {permissions.backUrl ? (
            <button
              type="button"
              className="btn-back-portal"
              onClick={() => navigate(permissions.backUrl)}
            >
              {permissions.backLabel}
            </button>
          ) : (
            <div className="guest-seal-badge">
              EuroTech Official Consular Gateway
            </div>
          )}
          {dossier.groupBatch && (
            <span className="breadcrumb-path">
              <span className="breadcrumb-sep">/</span>
              <span className="breadcrumb-batch">{dossier.groupBatch.code}</span>
              <span className="breadcrumb-sep">/</span>
              <span className="breadcrumb-current">{fullName}</span>
            </span>
          )}
        </div>

        <div className="header-meta-pills">
          <span className="portal-role-tag">{permissions.portalBadgeText}</span>
          <span className="dossier-code-pill">
            Dossier: <strong>{dossier.dossierNumber}</strong>
          </span>
          {dossier.country && (
            <span className="country-badge-pill">
              Destination: <strong>{dossier.country.nameEn}</strong>
            </span>
          )}
          {dossier.groupBatch && (
            <span className="batch-badge-pill">
              Batch: <strong>{dossier.groupBatch.code}</strong> ({dossier.groupBatch.name})
            </span>
          )}
        </div>
      </div>

      <div className="header-main-row">
        <div className="applicant-identity-box">
          <div className="applicant-avatar">
            {(applicant.firstName?.[0] || 'A').toUpperCase()}
            {(applicant.lastName?.[0] || '').toUpperCase()}
          </div>
          <div className="applicant-names">
            <h1 className="applicant-full-name">{fullName}</h1>
            <div className="applicant-sub-tags">
              <span className="passport-tag">
                Passport: <strong>{applicant.passportNumber || 'Not specified'}</strong>
              </span>
              <span className="role-tag">
                {applicant.familyRole === 'PRIMARY'
                  ? (permissions.origin === 'corporate' ? 'PRIMARY EMPLOYEE' : permissions.origin === 'agent' ? 'PRIMARY TRAVELER' : 'PRIMARY APPLICANT')
                  : (applicant.familyRole || (permissions.origin === 'corporate' ? 'EMPLOYEE' : permissions.origin === 'agent' ? 'PASSENGER' : 'CO-APPLICANT'))}
              </span>
              <span className="status-indicator">
                {progress === 100 ? 'Ready for Submission' : `${progress}% Completed`}
              </span>
            </div>
          </div>
        </div>

        <div className="header-actions-box">
          <div className="save-status-info">
            {saving ? (
              <span className="text-saving">
                <span className="save-spinner"></span> Saving draft...
              </span>
            ) : lastSaved ? (
              <span className="text-saved">
                Saved to database ({lastSaved.toLocaleTimeString()})
              </span>
            ) : (
              <span className="text-idle">Ready</span>
            )}
          </div>

          <div className="action-buttons-group">
            <button
              type="button"
              className="btn-action-ghost"
              onClick={onOpenMrzModal}
              title="Automatically extract passport information from 2-line machine readable zone"
            >
              Scan Passport MRZ
            </button>

            {permissions.origin !== 'guest' && (
              <button
                type="button"
                className="btn-action-ghost"
                onClick={handleCopySelfFillLink}
                title="Copy secure link for the applicant to complete on their personal device"
              >
                Copy Self-Fill Link
              </button>
            )}

            <button
              type="button"
              className="btn-action-primary-pdf"
              onClick={handleDownloadSchengenPdf}
              disabled={downloadingPdf}
            >
              {downloadingPdf ? 'Generating PDF...' : 'Download Schengen PDF'}
            </button>

            <button
              type="button"
              className="btn-action-save"
              onClick={onManualSave}
            >
              Save Draft
            </button>
          </div>
        </div>
      </div>

      <div className="header-progress-bar-wrapper">
        <div className="progress-bar-track">
          <div
            className="progress-bar-fill"
            style={{
              width: `${progress}%`,
              backgroundColor: progress === 100 ? '#10B981' : progress > 50 ? '#2563EB' : '#F59E0B',
            }}
          ></div>
        </div>
      </div>
    </div>
  );
}

