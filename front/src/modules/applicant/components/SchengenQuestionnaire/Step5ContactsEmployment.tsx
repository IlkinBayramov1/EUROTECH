import React from 'react';

interface Step5Props {
  formData: Record<string, any>;
  onChange: (field: string, value: any) => void;
  isCorporateMode?: boolean;
  corporateCompanyName?: string;
  corporateAddress?: string;
  corporatePhone?: string;
}

export default function Step5ContactsEmployment({
  formData,
  onChange,
  isCorporateMode,
  corporateCompanyName,
  corporateAddress,
  corporatePhone,
}: Step5Props) {
  return (
    <div className="step-content-block">
      <h2>5. Current Occupation, Employer & Contacts</h2>
      <p className="app-step-desc">
        Provide applicant's permanent residential address, contact details and professional employment status (Boxes 19, 20).
      </p>

      <div className="applicant-form-grid">
        <div className="applicant-input-group full-width">
          <label>Applicant's Home Residential Address (Box 19) *</label>
          <input
            type="text"
            className="applicant-input"
            value={formData.homeAddress || ''}
            onChange={(e) => onChange('homeAddress', e.target.value)}
            placeholder="e.g. Nizami str. 120, Apt 45, Baku, Azerbaijan"
            required
          />
        </div>

        <div className="applicant-input-group">
          <label>Applicant's Email Address (Box 19) *</label>
          <input
            type="email"
            className="applicant-input"
            value={formData.homeEmail || ''}
            onChange={(e) => onChange('homeEmail', e.target.value)}
            placeholder="applicant@example.com"
            required
          />
        </div>

        <div className="applicant-input-group">
          <label>Applicant's Telephone Number (Box 19) *</label>
          <input
            type="tel"
            className="applicant-input"
            value={formData.homePhone || ''}
            onChange={(e) => onChange('homePhone', e.target.value)}
            placeholder="+994 (__) ___-__-__"
            required
          />
        </div>

        <div className="applicant-input-group full-width">
          <label>Current Professional Occupation / Job Title (Box 20) *</label>
          <input
            type="text"
            className="applicant-input"
            value={formData.currentOccupation || ''}
            onChange={(e) => onChange('currentOccupation', e.target.value)}
            placeholder="e.g. Senior Software Engineer, Accountant, General Manager, Student"
            required
          />
        </div>

        <div className="applicant-input-group full-width">
          <label>
            Employer / Educational Establishment Name (Box 20) *
          </label>
          <input
            type="text"
            className="applicant-input"
            value={formData.employerName || (isCorporateMode ? corporateCompanyName : '') || ''}
            onChange={(e) => onChange('employerName', e.target.value)}
            placeholder="e.g. SOCAR Downstream Management LLC"
            required
          />
        </div>

        <div className="applicant-input-group full-width">
          <label>Employer Address & Postal Code (Box 20) *</label>
          <input
            type="text"
            className="applicant-input"
            value={formData.employerAddress || (isCorporateMode ? corporateAddress : '') || ''}
            onChange={(e) => onChange('employerAddress', e.target.value)}
            placeholder="e.g. 121 Heydar Aliyev Avenue, Baku AZ1029"
            required
          />
        </div>

        <div className="applicant-input-group">
          <label>Employer / Company Telephone Number *</label>
          <input
            type="tel"
            className="applicant-input"
            value={formData.employerPhone || (isCorporateMode ? corporatePhone : '') || ''}
            onChange={(e) => onChange('employerPhone', e.target.value)}
            placeholder="+994 (12) ___-____"
            required
          />
        </div>

        {/* Representative / Third Party Preparer */}
        <div className={`conditional-card full-width ${formData.hasRepresentative === 'Yes' ? 'active' : ''}`}>
          <div
            className="conditional-header"
            onClick={() => onChange('hasRepresentative', formData.hasRepresentative === 'Yes' ? 'No' : 'Yes')}
          >
            <div className="conditional-title-wrap">
              <span className="conditional-badge">Optional</span>
              <h4 className="conditional-title">Official Representative / Legal Proxy Information</h4>
            </div>
            <div className="toggle-switch-pill">
              <span>{formData.hasRepresentative === 'Yes' ? 'APPLICABLE (Bəli)' : 'NONE (Xeyr)'}</span>
              <input
                type="checkbox"
                checked={formData.hasRepresentative === 'Yes'}
                onChange={(e) => onChange('hasRepresentative', e.target.checked ? 'Yes' : 'No')}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <span className="field-sublabel">
            If this visa dossier is represented by a certified attorney or legal proxy, specify their registered contact information.
          </span>
          {formData.hasRepresentative === 'Yes' && (
            <div className="applicant-form-grid fade-in" style={{ marginTop: 14 }}>
              <div className="applicant-input-group full-width">
                <label>Representative / Attorney Full Name</label>
                <input
                  type="text"
                  className="applicant-input"
                  value={formData.representativeName || ''}
                  onChange={(e) => onChange('representativeName', e.target.value)}
                  placeholder="e.g. Eldar Gasimov, Attorney at Law"
                />
              </div>
              <div className="applicant-input-group full-width">
                <label>Representative Office Address</label>
                <input
                  type="text"
                  className="applicant-input"
                  value={formData.representativeAddress || ''}
                  onChange={(e) => onChange('representativeAddress', e.target.value)}
                />
              </div>
              <div className="applicant-input-group">
                <label>Representative Telephone</label>
                <input
                  type="tel"
                  className="applicant-input"
                  value={formData.representativePhone || ''}
                  onChange={(e) => onChange('representativePhone', e.target.value)}
                />
              </div>
              <div className="applicant-input-group">
                <label>Representative Email</label>
                <input
                  type="email"
                  className="applicant-input"
                  value={formData.representativeEmail || ''}
                  onChange={(e) => onChange('representativeEmail', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

