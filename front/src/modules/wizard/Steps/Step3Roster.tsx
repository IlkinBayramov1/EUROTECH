import React, { useRef, useState } from 'react';
import type { WizardPortalType, ApplicantRow } from '../types/wizard.types';
import { extractMrzFromText } from '@/shared/utils/mrzParser';
import { parseRosterCsv, downloadRosterTemplate } from '@/shared/utils/excelParser';
import { useToast } from '@/shared/context/ToastContext';

interface Step3Props {
  portalType: WizardPortalType;
  groupName?: string;
  applicants: ApplicantRow[];
  updateData: (field: string, value: any) => void;
}

export default function Step3Roster({
  portalType,
  groupName,
  applicants,
  updateData,
}: Step3Props) {
  const { showSuccess, showError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openMrzId, setOpenMrzId] = useState<string | null>(null);
  const [mrzInput, setMrzInput] = useState('');
  const [mrzError, setMrzError] = useState<string | null>(null);

  const isIndividual = portalType === 'INDIVIDUAL';
  const isAgent = portalType === 'GROUP_AGENT';
  const isCorporate = portalType === 'CORPORATE';

  // --- Add new row ---
  const handleAddApplicant = () => {
    const newId = `app-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newRow: ApplicantRow = {
      id: newId,
      firstName: '',
      lastName: '',
      passportNumber: '',
      dob: '',
      gender: 'MALE',
      nationality: 'AZ',
      issueDate: '',
      expiryDate: '',
      familyRole: isIndividual ? 'SPOUSE' : 'OTHER',
      jobTitle: isCorporate ? 'Specialist' : undefined,
      department: isCorporate ? 'Operations' : undefined,
    };
    updateData('applicants', [...applicants, newRow]);
  };

  const handleRemoveApplicant = (id: string) => {
    if (isIndividual && applicants.length <= 1) return;
    updateData('applicants', applicants.filter(a => a.id !== id));
  };

  const handleFieldChange = (id: string, field: keyof ApplicantRow, value: any) => {
    const updated = applicants.map(a => {
      if (a.id === id) {
        return { ...a, [field]: value };
      }
      return a;
    });
    updateData('applicants', updated);
  };

  // --- CSV / Excel Roster upload for Agent and Corporate ---
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const result = parseRosterCsv(text);

        if (result.errors.length > 0 && result.applicants.length === 0) {
          showError(`CSV Error: ${result.errors[0]}`);
          return;
        }

        const mappedRows: ApplicantRow[] = result.applicants.map((item, idx) => ({
          id: `app-csv-${Date.now()}-${idx}`,
          firstName: item.firstName,
          lastName: item.lastName,
          passportNumber: item.passportNumber,
          dob: item.dob,
          issueDate: item.issueDate || '',
          expiryDate: item.expiryDate || '',
          nationality: 'AZ',
          gender: 'MALE',
          jobTitle: isCorporate ? 'Specialist' : undefined,
          department: isCorporate ? 'General' : undefined,
        }));

        if (mappedRows.length > 0) {
          // If first row was blank, replace it; otherwise append
          const firstIsBlank = applicants.length === 1 && !applicants[0].firstName && !applicants[0].passportNumber;
          const merged = firstIsBlank ? mappedRows : [...applicants, ...mappedRows];
          updateData('applicants', merged);
          showSuccess(`${mappedRows.length} travelers successfully imported from CSV file!`);
        }
      } catch (err: any) {
        showError('Failed to parse uploaded CSV file: ' + err.message);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Optical MRZ parsing ---
  const handleParseMrz = (appId: string) => {
    if (!mrzInput.trim()) return;
    try {
      const res = extractMrzFromText(mrzInput);
      if (res && res.passportNumber) {
        const updated = applicants.map(a => {
          if (a.id === appId) {
            return {
              ...a,
              firstName: res.firstName || a.firstName,
              lastName: res.lastName || a.lastName,
              passportNumber: res.passportNumber.toUpperCase(),
              dob: res.birthDate || a.dob,
              expiryDate: res.expiryDate || a.expiryDate,
              gender: (res.gender === 'F' ? 'FEMALE' : 'MALE') as 'MALE' | 'FEMALE',
              nationality: res.nationality || a.nationality || 'AZ',
            };
          }
          return a;
        });
        updateData('applicants', updated);
        showSuccess('Passport MRZ parsed successfully!');
        setOpenMrzId(null);
        setMrzInput('');
        setMrzError(null);
      } else {
        setMrzError('Could not detect valid 2-line ICAO Doc 9303 MRZ format.');
      }
    } catch (e: any) {
      setMrzError(e.message || 'MRZ parse error');
    }
  };

  return (
    <div className="step-content fade-in">
      {/* Hidden file input for CSV */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".csv,.txt"
        onChange={handleCsvUpload}
      />

      <h1 className="step-title">
        {isIndividual && 'Applicant Information'}
        {isAgent && 'Group Information & Passenger Manifest'}
        {isCorporate && 'Corporate Batch & Employee Manifest'}
      </h1>
      <p className="step-subtitle">
        {isIndividual && 'Enter biometric and travel document details for the primary applicant and any accompanying family members.'}
        {isAgent && 'Specify the tour group identifier and register all travelers. You can also import members via Excel/CSV.'}
        {isCorporate && 'Specify the corporate mobility batch title and register employee credentials.'}
      </p>

      {/* Group or Batch Name for Agent / Corporate */}
      {!isIndividual && (
        <div className="wizard-input-group" style={{ marginBottom: '28px' }}>
          <label>{isCorporate ? 'Company Delegation / Batch Name *' : 'Tour Group Name *'}</label>
          <input
            type="text"
            className="premium-input"
            value={groupName || ''}
            onChange={(e) => updateData('groupName', e.target.value)}
            placeholder={isCorporate ? 'e.g. SOCAR Technical Delegation Budapest 2026' : 'e.g. EuroTravel Autumn Budapest & Vienna Tour'}
          />
        </div>
      )}

      {/* ==================================================== */}
      {/* INDIVIDUAL PORTAL APPLICANT CARDS */}
      {/* ==================================================== */}
      {isIndividual && (
        <div className="applicants-container">
          {applicants.map((app, idx) => {
            const isPrimary = idx === 0;
            const isMrzOpen = openMrzId === app.id;

            return (
              <div
                key={app.id}
                className="applicant-card"
                style={{
                  background: '#FFFFFF',
                  border: '1.5px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '24px',
                  marginBottom: '24px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span
                      style={{
                        background: isPrimary ? '#2563EB' : '#475569',
                        color: '#FFFFFF',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: '6px',
                      }}
                    >
                      {isPrimary ? 'PRIMARY APPLICANT' : `APPLICANT #${idx + 1}`}
                    </span>
                    <strong style={{ fontSize: '1.05rem', color: '#0F172A' }}>
                      {app.firstName || app.lastName ? `${app.firstName} ${app.lastName}` : 'New Applicant'}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn-roster-csv"
                      onClick={() => { setOpenMrzId(isMrzOpen ? null : app.id); setMrzError(null); }}
                    >
                      Scan Passport MRZ
                    </button>
                    {!isPrimary && (
                      <button
                        type="button"
                        className="btn-roster-del"
                        onClick={() => handleRemoveApplicant(app.id)}
                        title="Remove member"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* MRZ Box */}
                {isMrzOpen && (
                  <div style={{ background: '#F8FAFC', border: '1.5px dashed #2563EB', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 600, color: '#1E293B' }}>
                      Paste 2 lines of passport MRZ code:
                    </p>
                    <textarea
                      rows={2}
                      className="roster-input"
                      value={mrzInput}
                      onChange={(e) => setMrzInput(e.target.value.toUpperCase())}
                      placeholder="P<AZEALIYEV<<VUSAL<<<<<<<<<<<<<<<<<<<<<<<<<<&#10;C012345678AZE9005121M3112255<<<<<<<<<<<<<<04"
                      style={{ fontFamily: 'monospace', letterSpacing: '1px' }}
                    />
                    {mrzError && <p style={{ color: '#EF4444', fontSize: '0.8rem', margin: '6px 0 0 0' }}>{mrzError}</p>}
                    <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button type="button" className="btn-roster-csv" onClick={() => setOpenMrzId(null)}>Cancel</button>
                      <button type="button" className="btn-roster-add" onClick={() => handleParseMrz(app.id)}>Autofill Form</button>
                    </div>
                  </div>
                )}

                <div className="wizard-form-grid">
                  <div className="wizard-input-group">
                    <label>Given Name(s) *</label>
                    <input
                      type="text"
                      className="premium-input"
                      value={app.firstName}
                      onChange={(e) => handleFieldChange(app.id, 'firstName', e.target.value)}
                      placeholder="e.g. Vusal"
                    />
                  </div>

                  <div className="wizard-input-group">
                    <label>Surname (Family Name) *</label>
                    <input
                      type="text"
                      className="premium-input"
                      value={app.lastName}
                      onChange={(e) => handleFieldChange(app.id, 'lastName', e.target.value)}
                      placeholder="e.g. Aliyev"
                    />
                  </div>

                  <div className="wizard-input-group">
                    <label>Passport Number *</label>
                    <input
                      type="text"
                      className="premium-input"
                      value={app.passportNumber}
                      onChange={(e) => handleFieldChange(app.id, 'passportNumber', e.target.value.toUpperCase())}
                      placeholder="e.g. C01234567"
                    />
                  </div>

                  <div className="wizard-input-group">
                    <label>Date of Birth</label>
                    <input
                      type="date"
                      className="premium-input"
                      value={app.dob || ''}
                      onChange={(e) => handleFieldChange(app.id, 'dob', e.target.value)}
                    />
                  </div>

                  <div className="wizard-input-group">
                    <label>Gender</label>
                    <select
                      className="premium-input"
                      value={app.gender || 'MALE'}
                      onChange={(e) => handleFieldChange(app.id, 'gender', e.target.value)}
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                    </select>
                  </div>

                  <div className="wizard-input-group">
                    <label>Passport Expiry Date</label>
                    <input
                      type="date"
                      className="premium-input"
                      value={app.expiryDate || ''}
                      onChange={(e) => handleFieldChange(app.id, 'expiryDate', e.target.value)}
                    />
                  </div>

                  {!isPrimary && (
                    <div className="wizard-input-group">
                      <label>Relationship to Primary</label>
                      <select
                        className="premium-input"
                        value={app.familyRole || 'SPOUSE'}
                        onChange={(e) => handleFieldChange(app.id, 'familyRole', e.target.value)}
                      >
                        <option value="SPOUSE">Spouse</option>
                        <option value="CHILD">Child / Dependent</option>
                        <option value="OTHER">Other Co-Traveler</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <button
            type="button"
            className="btn-roster-add"
            onClick={handleAddApplicant}
            style={{ width: '100%', padding: '12px', justifyContent: 'center' }}
          >
            + Add Family Member / Co-Traveler
          </button>
        </div>
      )}

      {/* ==================================================== */}
      {/* B2B / CORPORATE ROSTER TABLE */}
      {/* ==================================================== */}
      {!isIndividual && (
        <div>
          <div className="roster-header-actions">
            <span className="roster-stats-badge">
              Total {isCorporate ? 'Employees' : 'Travelers'}: {applicants.length}
            </span>

            <div className="roster-action-btns">
              <button
                type="button"
                className="btn-roster-csv"
                onClick={() => downloadRosterTemplate()}
              >
                Download Excel Template
              </button>
              <button
                type="button"
                className="btn-roster-csv"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload CSV / Excel
              </button>
              <button
                type="button"
                className="btn-roster-add"
                onClick={handleAddApplicant}
              >
                + Add {isCorporate ? 'Employee' : 'Traveler'}
              </button>
            </div>
          </div>

          <div className="roster-table-container">
            <table className="roster-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>First Name *</th>
                  <th>Last Name *</th>
                  <th>Passport No *</th>
                  <th>Date of Birth</th>
                  {isCorporate && <th>Job Title</th>}
                  {isCorporate && <th>Department</th>}
                  <th>Passport Expiry</th>
                  <th style={{ width: '50px' }}>Del</th>
                </tr>
              </thead>
              <tbody>
                {applicants.map((app, idx) => (
                  <tr key={app.id}>
                    <td style={{ fontWeight: 700, color: '#64748B' }}>{idx + 1}</td>
                    <td>
                      <input
                        type="text"
                        className="roster-input"
                        placeholder="First name"
                        value={app.firstName}
                        onChange={(e) => handleFieldChange(app.id, 'firstName', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="roster-input"
                        placeholder="Last name"
                        value={app.lastName}
                        onChange={(e) => handleFieldChange(app.id, 'lastName', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="roster-input"
                        placeholder="Passport"
                        value={app.passportNumber}
                        onChange={(e) => handleFieldChange(app.id, 'passportNumber', e.target.value.toUpperCase())}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        className="roster-input"
                        value={app.dob || ''}
                        onChange={(e) => handleFieldChange(app.id, 'dob', e.target.value)}
                      />
                    </td>
                    {isCorporate && (
                      <td>
                        <input
                          type="text"
                          className="roster-input"
                          placeholder="Job Title"
                          value={app.jobTitle || ''}
                          onChange={(e) => handleFieldChange(app.id, 'jobTitle', e.target.value)}
                        />
                      </td>
                    )}
                    {isCorporate && (
                      <td>
                        <input
                          type="text"
                          className="roster-input"
                          placeholder="Department"
                          value={app.department || ''}
                          onChange={(e) => handleFieldChange(app.id, 'department', e.target.value)}
                        />
                      </td>
                    )}
                    <td>
                      <input
                        type="date"
                        className="roster-input"
                        value={app.expiryDate || ''}
                        onChange={(e) => handleFieldChange(app.id, 'expiryDate', e.target.value)}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-roster-del"
                        onClick={() => handleRemoveApplicant(app.id)}
                        disabled={applicants.length <= 1}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
