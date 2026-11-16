import React from 'react';
import type { ApplicantSwitcherItem } from '../types/applicant.types';

interface ApplicantSwitcherProps {
  applicants: ApplicantSwitcherItem[];
  currentApplicantId: string;
  onSelectApplicant: (applicantId: string) => void;
  onOpenAddModal?: () => void;
  canAdd?: boolean;
  portalType?: string;
}

export default function ApplicantSwitcher({
  applicants,
  currentApplicantId,
  onSelectApplicant,
  onOpenAddModal,
  canAdd = true,
  portalType,
}: ApplicantSwitcherProps) {
  if (!applicants || applicants.length === 0) return null;

  const isIndividual = portalType === 'INDIVIDUAL';
  const isCorporate = portalType === 'CORPORATE';

  const titleText = isIndividual
    ? `Applicants & Family Members (${applicants.length}):`
    : isCorporate
    ? `Delegation Employees (${applicants.length}):`
    : `Group Passenger Manifest (${applicants.length}):`;

  const hintText = isIndividual
    ? 'Click to switch between applicants.'
    : isCorporate
    ? 'Click to switch employee application file.'
    : 'Click on any traveler to switch application.';

  return (
    <div className="applicant-switcher-container">
      <div className="switcher-label-row">
        <span className="switcher-title">{titleText}</span>
        <span className="switcher-hint">{hintText}</span>
      </div>

      <div className="switcher-items-scroll">
        {applicants.map((app, index) => {
          const isActive = app.id === currentApplicantId;
          const fullName = `${app.firstName || ''} ${app.lastName || ''}`.trim() || `Applicant ${index + 1}`;
          const isComplete = app.verifiedDocsCount > 0 && app.verifiedDocsCount >= app.documentsCount;

          return (
            <button
              key={app.id}
              type="button"
              className={`switcher-pill ${isActive ? 'active' : ''}`}
              onClick={() => onSelectApplicant(app.id)}
            >
              <span className="pill-index">{index + 1}</span>
              <span className="pill-name">{fullName}</span>
              <span className="pill-passport">{app.passportNumber || 'No pass'}</span>
              {isComplete ? (
                <span className="pill-status-check">Done</span>
              ) : (
                <span className="pill-docs-count">{app.documentsCount} docs</span>
              )}
            </button>
          );
        })}

        {canAdd && onOpenAddModal && (
          <button
            type="button"
            className="btn-switcher-add"
            onClick={onOpenAddModal}
          >
            + Add Member
          </button>
        )}
      </div>
    </div>
  );
}

