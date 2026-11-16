import React from 'react';

interface Step3Props {
  formData: Record<string, any>;
  onChange: (field: string, value: any) => void;
  onOpenMrzModal: () => void;
}

export default function Step3TravelDocument({ formData, onChange, onOpenMrzModal }: Step3Props) {
  return (
    <div className="step-content-block">
      <div className="step-heading-row">
        <div>
          <h2>3. Type & Details of Travel Document</h2>
          <p className="app-step-desc">
            Enter passport details exactly as indicated on the bio-data page (Boxes 12, 13, 14, 15, 16, 17, 18).
          </p>
        </div>
        <button
          type="button"
          className="btn-quick-mrz"
          onClick={onOpenMrzModal}
        >
          Scan Passport MRZ
        </button>
      </div>

      <div className="applicant-form-grid">
        <div className="applicant-input-group full-width">
          <label>Type of Travel Document (Box 12) *</label>
          <select
            className="applicant-input"
            value={formData.passportType || 'Ordinary passport'}
            onChange={(e) => onChange('passportType', e.target.value)}
          >
            <option value="Ordinary passport">Ordinary Passport (Ümumvətəndaş)</option>
            <option value="Diplomatic passport">Diplomatic Passport (Diplomatik)</option>
            <option value="Service passport">Service Passport (Xidməti)</option>
            <option value="Official passport">Official Passport (Rəsmi)</option>
            <option value="Special passport">Special Passport (Xüsusi)</option>
            <option value="Other travel document">Other Travel Document</option>
          </select>
        </div>

        {formData.passportType === 'Other travel document' && (
          <div className="applicant-input-group full-width fade-in">
            <label>Specify Other Document Type (Box 12) *</label>
            <input
              type="text"
              className="applicant-input"
              value={formData.otherDocTypeDetails || ''}
              onChange={(e) => onChange('otherDocTypeDetails', e.target.value)}
              placeholder="e.g. Alien's passport, Seaman's book"
              required
            />
          </div>
        )}

        <div className="applicant-input-group">
          <label>Number of Travel Document (Passport No - Box 13) *</label>
          <input
            type="text"
            className="applicant-input"
            value={formData.passportNumber || ''}
            onChange={(e) => onChange('passportNumber', e.target.value.toUpperCase())}
            placeholder="e.g. C12345678"
            required
          />
        </div>

        <div className="applicant-input-group">
          <label>Date of Issue (Box 14) *</label>
          <input
            type="date"
            className="applicant-input"
            value={formData.issueDate || ''}
            onChange={(e) => onChange('issueDate', e.target.value)}
            required
          />
        </div>

        <div className="applicant-input-group">
          <label>Valid Until (Expiry Date - Box 15) *</label>
          <input
            type="date"
            className="applicant-input"
            value={formData.passportExpiry || ''}
            onChange={(e) => onChange('passportExpiry', e.target.value)}
            required
          />
        </div>

        <div className="applicant-input-group">
          <label>Issued by Authority / Country (Box 16) *</label>
          <input
            type="text"
            className="applicant-input"
            value={formData.issuedBy || 'Ministry of Internal Affairs'}
            onChange={(e) => onChange('issuedBy', e.target.value)}
            placeholder="e.g. Ministry of Internal Affairs"
            required
          />
        </div>

        {/* Box 18: Residence in a country other than current nationality */}
        <div className={`conditional-card full-width ${formData.hasOtherResidence === 'Yes' ? 'active' : ''}`}>
          <div
            className="conditional-header"
            onClick={() => onChange('hasOtherResidence', formData.hasOtherResidence === 'Yes' ? 'No' : 'Yes')}
          >
            <div className="conditional-title-wrap">
              <span className="conditional-badge">Box 18</span>
              <h4 className="conditional-title">Residence in Another Country (Yaşayış İcazəsi)</h4>
            </div>
            <div className="toggle-switch-pill">
              <span>{formData.hasOtherResidence === 'Yes' ? 'YES (Bəli)' : 'NO (Xeyr)'}</span>
              <input
                type="checkbox"
                checked={formData.hasOtherResidence === 'Yes'}
                onChange={(e) => onChange('hasOtherResidence', e.target.checked ? 'Yes' : 'No')}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <span className="field-sublabel">
            Do you reside in a country other than that of your current nationality?
          </span>
          {formData.hasOtherResidence === 'Yes' && (
            <div className="applicant-form-grid fade-in" style={{ marginTop: 14 }}>
              <div className="applicant-input-group">
                <label>Residence Permit / Equivalent Document Type</label>
                <input
                  type="text"
                  className="applicant-input"
                  value={formData.otherResidenceType || ''}
                  onChange={(e) => onChange('otherResidenceType', e.target.value)}
                  placeholder="e.g. Permanent Residence Card"
                />
              </div>
              <div className="applicant-input-group">
                <label>Permit Number</label>
                <input
                  type="text"
                  className="applicant-input"
                  value={formData.otherResidenceNumber || ''}
                  onChange={(e) => onChange('otherResidenceNumber', e.target.value)}
                  placeholder="e.g. TR-99887766"
                />
              </div>
              <div className="applicant-input-group full-width">
                <label>Valid Until (Expiry Date)</label>
                <input
                  type="date"
                  className="applicant-input"
                  value={formData.otherResidenceValidUntil || ''}
                  onChange={(e) => onChange('otherResidenceValidUntil', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Boxes 17 & 18: EU, EEA or CH Family Member */}
        <div className={`conditional-card full-width ${formData.hasEuFamilyMember === 'Yes' ? 'active' : ''}`}>
          <div
            className="conditional-header"
            onClick={() => onChange('hasEuFamilyMember', formData.hasEuFamilyMember === 'Yes' ? 'No' : 'Yes')}
          >
            <div className="conditional-title-wrap">
              <span className="conditional-badge">Boxes 17 & 18</span>
              <h4 className="conditional-title">Family Relationship with an EU, EEA or CH Citizen</h4>
            </div>
            <div className="toggle-switch-pill">
              <span>{formData.hasEuFamilyMember === 'Yes' ? 'YES (Bəli)' : 'NO (Xeyr)'}</span>
              <input
                type="checkbox"
                checked={formData.hasEuFamilyMember === 'Yes'}
                onChange={(e) => onChange('hasEuFamilyMember', e.target.checked ? 'Yes' : 'No')}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <span className="field-sublabel">
            Applicable only if you are an eligible family member of an EU, EEA or Swiss Confederation citizen.
          </span>
          {formData.hasEuFamilyMember === 'Yes' && (
            <div className="applicant-form-grid fade-in" style={{ marginTop: 14 }}>
              <div className="applicant-input-group">
                <label>Family Member Surname (Soyad)</label>
                <input
                  type="text"
                  className="applicant-input"
                  value={formData.euFamilySurname || ''}
                  onChange={(e) => onChange('euFamilySurname', e.target.value)}
                />
              </div>
              <div className="applicant-input-group">
                <label>Family Member First Name (Ad)</label>
                <input
                  type="text"
                  className="applicant-input"
                  value={formData.euFamilyName || ''}
                  onChange={(e) => onChange('euFamilyName', e.target.value)}
                />
              </div>
              <div className="applicant-input-group">
                <label>Date of Birth</label>
                <input
                  type="date"
                  className="applicant-input"
                  value={formData.euFamilyDob || ''}
                  onChange={(e) => onChange('euFamilyDob', e.target.value)}
                />
              </div>
              <div className="applicant-input-group">
                <label>Nationality of EU Citizen</label>
                <input
                  type="text"
                  className="applicant-input"
                  value={formData.euFamilyNationality || ''}
                  onChange={(e) => onChange('euFamilyNationality', e.target.value)}
                  placeholder="e.g. Germany, Hungary"
                />
              </div>
              <div className="applicant-input-group">
                <label>Passport / ID Number of EU Citizen</label>
                <input
                  type="text"
                  className="applicant-input"
                  value={formData.euFamilyDocNumber || ''}
                  onChange={(e) => onChange('euFamilyDocNumber', e.target.value)}
                />
              </div>
              <div className="applicant-input-group">
                <label>Family Relationship</label>
                <select
                  className="applicant-input"
                  value={formData.euFamilyRelationship || 'Spouse'}
                  onChange={(e) => onChange('euFamilyRelationship', e.target.value)}
                >
                  <option value="Spouse">Spouse (Həyat yoldaşı)</option>
                  <option value="Child">Child (Övlad)</option>
                  <option value="Grandchild">Grandchild (Nəvə)</option>
                  <option value="Dependent ascendant">Dependent Ascendant (Himayədə olan valideyn)</option>
                  <option value="Registered Partner">Registered Partner</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

