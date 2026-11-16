import React from 'react';

interface Step4Props {
  formData: Record<string, any>;
  onChange: (field: string, value: any) => void;
  isCorporateMode?: boolean;
  corporateCompanyName?: string;
}

export default function Step4AccommodationExpenses({
  formData,
  onChange,
  isCorporateMode,
  corporateCompanyName,
}: Step4Props) {
  const currentInvitingType = formData.invitingType || (isCorporateMode ? 'company' : 'hotel');

  const toggleApplicantSupportMean = (meanKey: string) => {
    const list: string[] = Array.isArray(formData.meansOfSupportApplicant)
      ? [...formData.meansOfSupportApplicant]
      : ['cash', 'credit_card'];
    const idx = list.indexOf(meanKey);
    if (idx > -1) list.splice(idx, 1);
    else list.push(meanKey);
    onChange('meansOfSupportApplicant', list);
  };

  const toggleSponsorSupportMean = (meanKey: string) => {
    const list: string[] = Array.isArray(formData.meansOfSupportSponsor)
      ? [...formData.meansOfSupportSponsor]
      : ['accommodation', 'all_expenses'];
    const idx = list.indexOf(meanKey);
    if (idx > -1) list.splice(idx, 1);
    else list.push(meanKey);
    onChange('meansOfSupportSponsor', list);
  };

  return (
    <div className="step-content-block">
      <h2>4. Accommodation, Host & Travel Expenses</h2>
      <p className="app-step-desc">
        Specify your inviting party or accommodation details and how your travel costs will be covered (Boxes 30, 31, 32).
      </p>

      {/* Inviting / Accommodation Type Selector */}
      <div className="inviting-type-selector">
        <label
          className={`inviting-type-pill ${currentInvitingType === 'hotel' ? 'active' : ''}`}
          onClick={() => onChange('invitingType', 'hotel')}
        >
          <input
            type="radio"
            name="invitingTypeRadio"
            checked={currentInvitingType === 'hotel'}
            onChange={() => onChange('invitingType', 'hotel')}
          />
          Hotel / Tourist Accommodation
        </label>

        <label
          className={`inviting-type-pill ${currentInvitingType === 'individual' ? 'active' : ''}`}
          onClick={() => onChange('invitingType', 'individual')}
        >
          <input
            type="radio"
            name="invitingTypeRadio"
            checked={currentInvitingType === 'individual'}
            onChange={() => onChange('invitingType', 'individual')}
          />
          Inviting Private Individual / Host
        </label>

        <label
          className={`inviting-type-pill ${currentInvitingType === 'company' ? 'active' : ''}`}
          onClick={() => onChange('invitingType', 'company')}
        >
          <input
            type="radio"
            name="invitingTypeRadio"
            checked={currentInvitingType === 'company'}
            onChange={() => onChange('invitingType', 'company')}
          />
          Inviting Company / Corporate Partner
        </label>
      </div>

      <div className="applicant-form-grid" style={{ marginTop: 20 }}>
        {currentInvitingType === 'company' ? (
          <>
            <div className="applicant-input-group full-width">
              <label>Name of Inviting Company / Organization (Box 31) *</label>
              <input
                type="text"
                className="applicant-input"
                value={formData.companyName || corporateCompanyName || ''}
                onChange={(e) => onChange('companyName', e.target.value)}
                placeholder="e.g. EuroTech Business Solutions Kft."
                required
              />
            </div>

            <div className="applicant-input-group full-width">
              <label>Company Address & Location (Box 31) *</label>
              <input
                type="text"
                className="applicant-input"
                value={formData.companyAddress || ''}
                onChange={(e) => onChange('companyAddress', e.target.value)}
                placeholder="e.g. Vaci utca 12, 1052 Budapest, Hungary"
                required
              />
            </div>

            <div className="applicant-input-group">
              <label>Contact Person at Company (Given Name & Surname)</label>
              <input
                type="text"
                className="applicant-input"
                value={formData.companyContactName || ''}
                onChange={(e) => onChange('companyContactName', e.target.value)}
                placeholder="e.g. Laszlo Nagy"
              />
            </div>

            <div className="applicant-input-group">
              <label>Company Telephone Number *</label>
              <input
                type="tel"
                className="applicant-input"
                value={formData.companyContactPhone || ''}
                onChange={(e) => onChange('companyContactPhone', e.target.value)}
                placeholder="+36 1 234 5678"
                required
              />
            </div>

            <div className="applicant-input-group full-width">
              <label>Company Email Address *</label>
              <input
                type="email"
                className="applicant-input"
                value={formData.companyContactEmail || ''}
                onChange={(e) => onChange('companyContactEmail', e.target.value)}
                placeholder="contact@company.hu"
                required
              />
            </div>
          </>
        ) : (
          <>
            <div className="applicant-input-group full-width">
              <label>
                {currentInvitingType === 'hotel'
                  ? 'Name of Hotel / Temporary Accommodation (Box 30) *'
                  : 'Name of Inviting Host / Family Member (Box 30) *'}
              </label>
              <input
                type="text"
                className="applicant-input"
                value={formData.invitingParty || ''}
                onChange={(e) => onChange('invitingParty', e.target.value)}
                placeholder={
                  currentInvitingType === 'hotel'
                    ? 'e.g. Danubius Hotel Helia, Budapest'
                    : 'e.g. Istvan Kovacs'
                }
                required
              />
            </div>

            <div className="applicant-input-group full-width">
              <label>Address of Accommodation / Host (Box 30) *</label>
              <input
                type="text"
                className="applicant-input"
                value={formData.address || ''}
                onChange={(e) => onChange('address', e.target.value)}
                placeholder="e.g. Karpat utca 62-64, 1133 Budapest"
                required
              />
            </div>

            <div className="applicant-input-group">
              <label>Contact Telephone Number *</label>
              <input
                type="tel"
                className="applicant-input"
                value={formData.stayPhone || ''}
                onChange={(e) => onChange('stayPhone', e.target.value)}
                placeholder="+36 (__) ___-____"
                required
              />
            </div>

            <div className="applicant-input-group">
              <label>Contact Email Address *</label>
              <input
                type="email"
                className="applicant-input"
                value={formData.stayEmail || ''}
                onChange={(e) => onChange('stayEmail', e.target.value)}
                placeholder="reservation@hotel.com"
                required
              />
            </div>
          </>
        )}

        {/* Box 32: Cost of travelling and living during stay */}
        <div className="solvency-coverage-card full-width">
          <div className="solvency-header">
            <span className="conditional-badge">Box 32</span>
            <h4>Cost of Travelling and Living is Covered By:</h4>
          </div>

          <div className="coverage-selector-radios">
            <label className="radio-pill">
              <input
                type="radio"
                name="costCoveredBy"
                value="By applicant himself"
                checked={formData.costCoveredBy === 'By applicant himself'}
                onChange={(e) => onChange('costCoveredBy', e.target.value)}
              />
              By the applicant himself/herself (Özü tərəfindən)
            </label>

            <label className="radio-pill">
              <input
                type="radio"
                name="costCoveredBy"
                value="By a sponsor / company"
                checked={formData.costCoveredBy === 'By a sponsor / company'}
                onChange={(e) => onChange('costCoveredBy', e.target.value)}
              />
              By a sponsor / Host / Employer Company (Şirkət / Sponsor tərəfindən)
            </label>
          </div>

          {formData.costCoveredBy === 'By applicant himself' ? (
            <div className="means-of-support-box fade-in">
              <span className="means-title">Means of Support Provided by Applicant:</span>
              <div className="means-checkbox-grid">
                {[
                  { key: 'cash', label: 'Cash (Nağd vəsait)' },
                  { key: 'credit_card', label: 'Credit card (Bank / Kredit kartı)' },
                  { key: 'traveller_cheques', label: 'Traveller cheques' },
                  { key: 'prepaid_accommodation', label: 'Pre-paid accommodation (Əvvəlcədən ödənilmiş otel)' },
                  { key: 'prepaid_transport', label: 'Pre-paid transport (Ödənilmiş biletlər)' },
                ].map((item) => (
                  <label key={item.key} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={(formData.meansOfSupportApplicant || ['cash', 'credit_card']).includes(item.key)}
                      onChange={() => toggleApplicantSupportMean(item.key)}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="means-of-support-box fade-in">
              <span className="means-title">Means of Support Provided by Sponsor / Company:</span>
              <div className="means-checkbox-grid">
                {[
                  { key: 'all_expenses', label: 'All expenses covered during stay (Bütün xərclər qarşılanır)' },
                  { key: 'accommodation', label: 'Accommodation provided (Yaşayış yeri təmin edilir)' },
                  { key: 'prepaid_transport', label: 'Pre-paid transport' },
                  { key: 'cash', label: 'Cash allowance (Ezamiyyət gündəlik xərcləri)' },
                ].map((item) => (
                  <label key={item.key} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={(formData.meansOfSupportSponsor || ['accommodation', 'all_expenses']).includes(item.key)}
                      onChange={() => toggleSponsorSupportMean(item.key)}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

