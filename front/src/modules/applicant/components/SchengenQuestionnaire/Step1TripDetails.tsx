import React from 'react';

interface Step1Props {
  formData: Record<string, any>;
  onChange: (field: string, value: any) => void;
  destinationFallback?: string;
}

export default function Step1TripDetails({ formData, onChange, destinationFallback }: Step1Props) {
  return (
    <div className="step-content-block">
      <h2>1. Your Plans & Trip Information</h2>
      <p className="app-step-desc">
        Provide particulars regarding the main purpose and duration of your intended stay in the Schengen Area (Boxes 21, 23, 24, 25, 27, 28).
      </p>

      <div className="applicant-form-grid">
        <div className="applicant-input-group full-width">
          <label>Main Purpose(s) of the Journey (Box 21) *</label>
          <select
            className="applicant-input"
            value={formData.purpose || 'Tourism'}
            onChange={(e) => onChange('purpose', e.target.value)}
            required
          >
            <option value="Tourism">Tourism (Vacation / Leisure)</option>
            <option value="Business">Business (Conferences, Meetings)</option>
            <option value="Visiting family/friends">Visiting Family or Friends</option>
            <option value="Cultural">Cultural Event</option>
            <option value="Sports">Sports Competition</option>
            <option value="Official visit">Official Government Visit</option>
            <option value="Medical reasons">Medical Treatment</option>
            <option value="Study">Study / Educational Course</option>
            <option value="Transit">Airport Transit</option>
            <option value="Other">Other Reasons</option>
          </select>
        </div>

        {formData.purpose === 'Other' && (
          <div className="applicant-input-group full-width fade-in">
            <label>Specify Other Purpose of Stay (Box 21) *</label>
            <input
              type="text"
              className="applicant-input"
              value={formData.purposeOtherDetails || ''}
              onChange={(e) => onChange('purposeOtherDetails', e.target.value)}
              placeholder="Please specify the exact nature of your visit..."
              required
            />
          </div>
        )}

        <div className="applicant-input-group full-width">
          <label>Additional Information on Purpose of Stay (Box 24, Optional)</label>
          <input
            type="text"
            className="applicant-input"
            value={formData.purposeDetails || ''}
            onChange={(e) => onChange('purposeDetails', e.target.value)}
            placeholder="e.g. Participating in bilateral symposium in Budapest"
          />
        </div>

        <div className="applicant-input-group">
          <label>Member State of Main Destination (Box 23) *</label>
          <select
            className="applicant-input"
            value={formData.destination || destinationFallback || 'Hungary'}
            onChange={(e) => onChange('destination', e.target.value)}
          >
            <option value="Hungary">Hungary</option>
            <option value="Germany">Germany</option>
            <option value="Austria">Austria</option>
            <option value="France">France</option>
            <option value="Italy">Italy</option>
            <option value="Spain">Spain</option>
            <option value="Czech Republic">Czech Republic</option>
            <option value="Poland">Poland</option>
          </select>
        </div>

        <div className="applicant-input-group">
          <label>Member State of First Entry (Box 23) *</label>
          <select
            className="applicant-input"
            value={formData.firstEntry || destinationFallback || 'Hungary'}
            onChange={(e) => onChange('firstEntry', e.target.value)}
          >
            <option value="Hungary">Hungary</option>
            <option value="Germany">Germany</option>
            <option value="Austria">Austria</option>
            <option value="Turkey (Transit)">Turkey (Transit)</option>
            <option value="Poland">Poland</option>
          </select>
        </div>

        <div className="applicant-input-group">
          <label>Number of Entries Requested (Box 28)</label>
          <select
            className="applicant-input"
            value={formData.entriesRequested || 'Single'}
            onChange={(e) => onChange('entriesRequested', e.target.value)}
          >
            <option value="Single">Single Entry (1)</option>
            <option value="Two">Two Entries (2)</option>
            <option value="Multiple">Multiple Entries (90 Days)</option>
          </select>
        </div>

        <div className="applicant-input-group">
          <label>Duration of Intended Stay (Days) *</label>
          <input
            type="number"
            className="applicant-input"
            value={formData.durationOfStay || '10'}
            onChange={(e) => onChange('durationOfStay', e.target.value)}
            min="1"
            max="90"
            required
          />
        </div>

        <div className="applicant-input-group">
          <label>Intended Date of Arrival *</label>
          <input
            type="date"
            className="applicant-input"
            value={formData.arrivalDate || ''}
            onChange={(e) => onChange('arrivalDate', e.target.value)}
            required
          />
        </div>

        <div className="applicant-input-group">
          <label>Intended Date of Departure *</label>
          <input
            type="date"
            className="applicant-input"
            value={formData.departureDate || ''}
            onChange={(e) => onChange('departureDate', e.target.value)}
            required
          />
        </div>

        {/* Box 27: Fingerprints Collected Previously */}
        <div className={`conditional-card full-width ${formData.hasPreviousFingerprints === 'Yes' ? 'active' : ''}`}>
          <div
            className="conditional-header"
            onClick={() => onChange('hasPreviousFingerprints', formData.hasPreviousFingerprints === 'Yes' ? 'No' : 'Yes')}
          >
            <div className="conditional-title-wrap">
              <span className="conditional-badge">Box 27</span>
              <h4 className="conditional-title">Biometric Data: Fingerprints Collected Previously</h4>
            </div>
            <div className="toggle-switch-pill">
              <span>{formData.hasPreviousFingerprints === 'Yes' ? 'YES (Bəli)' : 'NO (Xeyr)'}</span>
              <input
                type="checkbox"
                checked={formData.hasPreviousFingerprints === 'Yes'}
                onChange={(e) => onChange('hasPreviousFingerprints', e.target.checked ? 'Yes' : 'No')}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <span className="field-sublabel">
            Have your fingerprints been collected previously for the purpose of applying for a Schengen visa?
          </span>
          {formData.hasPreviousFingerprints === 'Yes' && (
            <div className="applicant-form-grid fade-in" style={{ marginTop: 14 }}>
              <div className="applicant-input-group">
                <label>Date of Collection (if known)</label>
                <input
                  type="date"
                  className="applicant-input"
                  value={formData.fingerprintDate || ''}
                  onChange={(e) => onChange('fingerprintDate', e.target.value)}
                />
              </div>
              <div className="applicant-input-group">
                <label>Visa Sticker Number (if known)</label>
                <input
                  type="text"
                  className="applicant-input"
                  value={formData.fingerprintVisaNumber || ''}
                  onChange={(e) => onChange('fingerprintVisaNumber', e.target.value)}
                  placeholder="e.g. V-HUN-1234567"
                />
              </div>
            </div>
          )}
        </div>

        {/* Box 25: Transit Final Destination Permit */}
        <div className={`conditional-card full-width ${formData.hasFinalDestinationPermit === 'Yes' ? 'active' : ''}`}>
          <div
            className="conditional-header"
            onClick={() => onChange('hasFinalDestinationPermit', formData.hasFinalDestinationPermit === 'Yes' ? 'No' : 'Yes')}
          >
            <div className="conditional-title-wrap">
              <span className="conditional-badge">Box 25</span>
              <h4 className="conditional-title">Entry Permit for Final Country of Destination (Transit Only)</h4>
            </div>
            <div className="toggle-switch-pill">
              <span>{formData.hasFinalDestinationPermit === 'Yes' ? 'YES (Bəli)' : 'NO (Xeyr)'}</span>
              <input
                type="checkbox"
                checked={formData.hasFinalDestinationPermit === 'Yes'}
                onChange={(e) => onChange('hasFinalDestinationPermit', e.target.checked ? 'Yes' : 'No')}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <span className="field-sublabel">
            Son təyinat ölkəsinə giriş icazəniz (viza / yaşayış icazəsi) varsa qeyd edin.
          </span>
          {formData.hasFinalDestinationPermit === 'Yes' && (
            <div className="applicant-form-grid fade-in" style={{ marginTop: 14 }}>
              <div className="applicant-input-group full-width">
                <label>Issued by Authority</label>
                <input
                  type="text"
                  className="applicant-input"
                  value={formData.finalDestinationAuthority || ''}
                  onChange={(e) => onChange('finalDestinationAuthority', e.target.value)}
                  placeholder="e.g. Ministry of Foreign Affairs"
                />
              </div>
              <div className="applicant-input-group">
                <label>Valid From</label>
                <input
                  type="date"
                  className="applicant-input"
                  value={formData.finalDestinationValidFrom || ''}
                  onChange={(e) => onChange('finalDestinationValidFrom', e.target.value)}
                />
              </div>
              <div className="applicant-input-group">
                <label>Valid Until</label>
                <input
                  type="date"
                  className="applicant-input"
                  value={formData.finalDestinationValidUntil || ''}
                  onChange={(e) => onChange('finalDestinationValidUntil', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

