import React from 'react';

interface Step2Props {
  formData: Record<string, any>;
  onChange: (field: string, value: any) => void;
}

export default function Step2PersonalData({ formData, onChange }: Step2Props) {
  return (
    <div className="step-content-block">
      <h2>2. Personal Details of the Applicant</h2>
      <p className="app-step-desc">
        Enter your full identity details exactly as shown in your biometric passport.
      </p>

      <div className="applicant-form-grid">
        <div className="applicant-input-group">
          <label>First Name (Given Name) *</label>
          <input
            type="text"
            className="applicant-input"
            value={formData.firstName || ''}
            onChange={(e) => onChange('firstName', e.target.value)}
            required
          />
        </div>

        <div className="applicant-input-group">
          <label>Last Name (Surname) *</label>
          <input
            type="text"
            className="applicant-input"
            value={formData.lastName || ''}
            onChange={(e) => onChange('lastName', e.target.value)}
            required
          />
        </div>

        <div className="applicant-input-group">
          <label>Surname at Birth (Previous Name)</label>
          <input
            type="text"
            className="applicant-input"
            value={formData.birthSurname || ''}
            onChange={(e) => onChange('birthSurname', e.target.value)}
            placeholder="Optional if unchanged"
          />
        </div>

        <div className="applicant-input-group">
          <label>Date of Birth *</label>
          <input
            type="date"
            className="applicant-input"
            value={formData.birthDate || ''}
            onChange={(e) => onChange('birthDate', e.target.value)}
            required
          />
        </div>

        <div className="applicant-input-group">
          <label>Place of Birth (City)</label>
          <input
            type="text"
            className="applicant-input"
            value={formData.birthPlace || ''}
            onChange={(e) => onChange('birthPlace', e.target.value)}
            placeholder="e.g. Baku"
          />
        </div>

        <div className="applicant-input-group">
          <label>Country of Birth</label>
          <input
            type="text"
            className="applicant-input"
            value={formData.birthCountry || 'Azerbaijan'}
            onChange={(e) => onChange('birthCountry', e.target.value)}
          />
        </div>

        <div className="applicant-input-group">
          <label>Current Nationality *</label>
          <select
            className="applicant-input"
            value={formData.nationality || 'Azerbaijan'}
            onChange={(e) => onChange('nationality', e.target.value)}
          >
            <option value="Azerbaijan">Azerbaijan</option>
            <option value="Turkey">Turkey</option>
            <option value="Georgia">Georgia</option>
            <option value="Kazakhstan">Kazakhstan</option>
            <option value="Uzbekistan">Uzbekistan</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="applicant-input-group">
          <label>Nationality at Birth (if different - Box 7)</label>
          <input
            type="text"
            className="applicant-input"
            value={formData.nationalityAtBirth || ''}
            onChange={(e) => onChange('nationalityAtBirth', e.target.value)}
            placeholder="Optional if same as current"
          />
        </div>

        <div className="applicant-input-group">
          <label>Other Nationalities / Dual Citizenship (Box 7)</label>
          <input
            type="text"
            className="applicant-input"
            value={formData.otherNationalities || ''}
            onChange={(e) => onChange('otherNationalities', e.target.value)}
            placeholder="e.g. None / Turkey"
          />
        </div>

        <div className="applicant-input-group">
          <label>Sex (Gender - Box 8) *</label>
          <select
            className="applicant-input"
            value={formData.gender || 'Male'}
            onChange={(e) => onChange('gender', e.target.value)}
          >
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="applicant-input-group">
          <label>Marital Status (Box 9) *</label>
          <select
            className="applicant-input"
            value={formData.maritalStatus || 'Single'}
            onChange={(e) => onChange('maritalStatus', e.target.value)}
          >
            <option value="Single">Single</option>
            <option value="Married">Married</option>
            <option value="Registered Partnership">Registered Partnership</option>
            <option value="Divorced">Divorced</option>
            <option value="Widowed">Widowed</option>
            <option value="Separated">Separated</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="applicant-input-group">
          <label>National ID / FIN Code (Box 11)</label>
          <input
            type="text"
            className="applicant-input"
            value={formData.nationalId || ''}
            onChange={(e) => onChange('nationalId', e.target.value.toUpperCase())}
            placeholder="e.g. 7A1BC23"
          />
        </div>

        {/* Box 10: Minor Parental Authority / Legal Guardian */}
        <div className={`conditional-card full-width ${formData.isMinor === 'Yes' ? 'active' : ''}`}>
          <div
            className="conditional-header"
            onClick={() => onChange('isMinor', formData.isMinor === 'Yes' ? 'No' : 'Yes')}
          >
            <div className="conditional-title-wrap">
              <span className="conditional-badge">Box 10</span>
              <h4 className="conditional-title">Parental Authority / Legal Guardian (In the case of minors)</h4>
            </div>
            <div className="toggle-switch-pill">
              <span>{formData.isMinor === 'Yes' ? 'APPLICABLE (Bəli)' : 'NOT APPLICABLE (Xeyr)'}</span>
              <input
                type="checkbox"
                checked={formData.isMinor === 'Yes'}
                onChange={(e) => onChange('isMinor', e.target.checked ? 'Yes' : 'No')}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <span className="field-sublabel">
            18 yaşına çatmamış ərizəçilər üçün qanuni qəyyum və ya valideynin rəsmi məlumatları.
          </span>
          {formData.isMinor === 'Yes' && (
            <div className="applicant-form-grid fade-in" style={{ marginTop: 14 }}>
              <div className="applicant-input-group">
                <label>Guardian Surname (Soyad) *</label>
                <input
                  type="text"
                  className="applicant-input"
                  value={formData.guardianSurname || ''}
                  onChange={(e) => onChange('guardianSurname', e.target.value)}
                  placeholder="e.g. Bayramov"
                />
              </div>
              <div className="applicant-input-group">
                <label>Guardian First Name (Ad) *</label>
                <input
                  type="text"
                  className="applicant-input"
                  value={formData.guardianName || ''}
                  onChange={(e) => onChange('guardianName', e.target.value)}
                  placeholder="e.g. Rəşad"
                />
              </div>
              <div className="applicant-input-group full-width">
                <label>Guardian Residential Address (if different from applicant)</label>
                <input
                  type="text"
                  className="applicant-input"
                  value={formData.guardianAddress || ''}
                  onChange={(e) => onChange('guardianAddress', e.target.value)}
                  placeholder="e.g. Samad Vurgun str. 45, Baku"
                />
              </div>
              <div className="applicant-input-group">
                <label>Guardian Telephone Number</label>
                <input
                  type="tel"
                  className="applicant-input"
                  value={formData.guardianPhone || ''}
                  onChange={(e) => onChange('guardianPhone', e.target.value)}
                  placeholder="+994 (__) ___-__-__"
                />
              </div>
              <div className="applicant-input-group">
                <label>Guardian Email Address</label>
                <input
                  type="email"
                  className="applicant-input"
                  value={formData.guardianEmail || ''}
                  onChange={(e) => onChange('guardianEmail', e.target.value)}
                  placeholder="guardian@example.com"
                />
              </div>
              <div className="applicant-input-group">
                <label>Guardian Nationality</label>
                <input
                  type="text"
                  className="applicant-input"
                  value={formData.guardianNationality || 'Azerbaijan'}
                  onChange={(e) => onChange('guardianNationality', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

