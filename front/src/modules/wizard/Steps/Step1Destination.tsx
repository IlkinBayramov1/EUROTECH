import React, { useState, useEffect, useMemo } from 'react';
import { dossierService } from '@/shared/api/services';
import { vcmsApi } from '@/modules/admin/api/vcmsApi';
import type { DestinationCountry } from '../types/wizard.types';

interface Step1Props {
  data: {
    country: string;
    countryId: string;
    countryCode: string;
    duration: string;
    projectReason: string;
    visaTypeId?: string;
    visaTypeName?: string;
    visaPurposeId?: string;
    visaPurposeName?: string;
    consularFeeEur?: number;
    travelDate?: string;
  };
  updateData: (field: string, value: any) => void;
}

const FALLBACK_COUNTRIES: DestinationCountry[] = [
  { id: 'hu-default', code: 'HU', nameEn: 'Hungary', nameAz: 'Macarıstan', flag: 'HU', processingTime: '15 business days', consularFee: '€80' },
  { id: 'de-default', code: 'DE', nameEn: 'Germany', nameAz: 'Almaniya', flag: 'DE', processingTime: '15 business days', consularFee: '€80' },
  { id: 'at-default', code: 'AT', nameEn: 'Austria', nameAz: 'Avstriya', flag: 'AT', processingTime: '15 business days', consularFee: '€80' },
  { id: 'it-default', code: 'IT', nameEn: 'Italy', nameAz: 'İtaliya', flag: 'IT', processingTime: '15 business days', consularFee: '€80' },
  { id: 'fr-default', code: 'FR', nameEn: 'France', nameAz: 'Fransa', flag: 'FR', processingTime: '15 business days', consularFee: '€80' },
  { id: 'es-default', code: 'ES', nameEn: 'Spain', nameAz: 'İspaniya', flag: 'ES', processingTime: '15 business days', consularFee: '€80' },
  { id: 'pl-default', code: 'PL', nameEn: 'Poland', nameAz: 'Polşa', flag: 'PL', processingTime: '15 business days', consularFee: '€80' },
  { id: 'cz-default', code: 'CZ', nameEn: 'Czech Republic', nameAz: 'Çexiya', flag: 'CZ', processingTime: '15 business days', consularFee: '€80' },
  { id: 'tr-default', code: 'TR', nameEn: 'Turkey', nameAz: 'Türkiyə', flag: 'TR', processingTime: '15 business days', consularFee: '€80' },
];

function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return 'EU';
  return countryCode.toUpperCase();
}

export default function Step1Destination({ data, updateData }: Step1Props) {
  const [countries, setCountries] = useState<DestinationCountry[]>(FALLBACK_COUNTRIES);
  const [vcmsCountries, setVcmsCountries] = useState<any[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    let isMounted = true;
    setLoadingCountries(true);
    vcmsApi
      .getPublicCountries()
      .then((res) => {
        const rawList = res.data?.countries || [];
        if (isMounted && rawList.length > 0) {
          setVcmsCountries(rawList);
          const mapped: DestinationCountry[] = rawList.map((c: any) => ({
            id: c.id,
            code: c.code || 'EU',
            nameEn: c.nameEn || 'Schengen State',
            nameAz: c.nameAz || c.nameEn || 'Şengen Dövləti',
            flag: c.flagEmoji || getFlagEmoji(c.code),
            processingTime: c.processingDaysLabel || '15 business days',
            consularFee: `€${c.visaTypes?.[0]?.defaultFeeEur || 80}`,
          }));
          setCountries(mapped);

          const defaultSelection =
            rawList.find((m: any) => m.id === data.countryId || m.code === data.countryCode) ||
            rawList.find((m: any) => m.code === 'FR' || m.code === 'HU') ||
            rawList[0];

          if (defaultSelection) {
            if (!data.countryId) {
              updateData('country', defaultSelection.nameEn);
              updateData('countryId', defaultSelection.id);
              updateData('countryCode', defaultSelection.code);
            }
            const firstVt = defaultSelection.visaTypes?.[0];
            if (firstVt && !data.visaTypeId) {
              updateData('visaTypeId', firstVt.id);
              updateData('visaTypeName', firstVt.nameEn);
              updateData('duration', firstVt.stayCategory === 'LONG' ? 'long' : 'short');
              const firstPurpose = firstVt.purposes?.[0];
              if (firstPurpose && !data.visaPurposeId) {
                updateData('visaPurposeId', firstPurpose.id);
                updateData('visaPurposeName', firstPurpose.nameEn);
                updateData('projectReason', firstPurpose.nameEn);
                const fee = firstPurpose.consularFeeOverride ?? firstVt.defaultFeeEur;
                if (fee !== undefined && fee !== null) {
                  updateData('consularFeeEur', Number(fee));
                }
              } else if (firstVt.defaultFeeEur !== undefined && firstVt.defaultFeeEur !== null) {
                updateData('consularFeeEur', Number(firstVt.defaultFeeEur));
              }
            }
          }
          return;
        }
        return dossierService.getCountries();
      })
      .catch(() => {
        // Fallback to default countries
      })
      .finally(() => {
        if (isMounted) setLoadingCountries(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const activeVcmsCountry = useMemo(() => {
    return (
      vcmsCountries.find(
        (c) =>
          c.id === data.countryId ||
          c.code?.toUpperCase() === data.countryCode?.toUpperCase() ||
          c.nameEn?.toLowerCase() === data.country?.toLowerCase()
      ) || vcmsCountries[0] || null
    );
  }, [vcmsCountries, data.countryId, data.countryCode, data.country]);

  const activeVisaType = useMemo(() => {
    if (!activeVcmsCountry?.visaTypes?.length) return null;
    if (data.visaTypeId) {
      const byId = activeVcmsCountry.visaTypes.find((v: any) => v.id === data.visaTypeId);
      if (byId) return byId;
    }
    const wantLong = data.duration === 'long';
    return (
      activeVcmsCountry.visaTypes.find((v: any) =>
        wantLong ? v.stayCategory === 'LONG' : v.stayCategory === 'SHORT'
      ) || activeVcmsCountry.visaTypes[0]
    );
  }, [activeVcmsCountry, data.visaTypeId, data.duration]);

  const dynamicPurposes = useMemo(() => {
    return activeVisaType?.purposes || [];
  }, [activeVisaType]);

  const shortStayOptions = [
    'Tourism & Leisure Travel',
    'Business & Commercial Delegation',
    'Official Visit & Diplomatic Mission',
    'Family or Private Visit',
    'Medical Treatment',
    'Short-term Studies / Cultural Exchange',
    'Transit & Airport Layover',
  ];

  const longStayOptions = [
    'Employment / Work Authorization',
    'Higher Education / University Studies',
    'Family Reunification & Settlement',
    'EU Blue Card & Talent Relocation',
    'Scientific Research & Academia',
    'Long-term Resident / Guest Worker',
  ];

  const currentProjectOptions =
    dynamicPurposes.length > 0
      ? dynamicPurposes.map((p: any) => p.nameEn)
      : data.duration === 'long'
        ? longStayOptions
        : shortStayOptions;

  const handleCountrySelect = (c: DestinationCountry) => {
    updateData('country', c.nameEn);
    updateData('countryId', c.id);
    updateData('countryCode', c.code);
    const matched = vcmsCountries.find((vc) => vc.id === c.id || vc.code === c.code);
    if (matched?.visaTypes?.length) {
      const vt =
        matched.visaTypes.find((v: any) =>
          data.duration === 'long' ? v.stayCategory === 'LONG' : v.stayCategory === 'SHORT'
        ) || matched.visaTypes[0];
      updateData('visaTypeId', vt.id);
      updateData('visaTypeName', vt.nameEn);
      updateData('duration', vt.stayCategory === 'LONG' ? 'long' : 'short');
      if (vt.purposes?.[0]) {
        const p = vt.purposes[0];
        updateData('visaPurposeId', p.id);
        updateData('visaPurposeName', p.nameEn);
        updateData('projectReason', p.nameEn);
        const fee = p.consularFeeOverride ?? vt.defaultFeeEur;
        updateData('consularFeeEur', fee !== undefined && fee !== null ? Number(fee) : undefined);
      } else {
        updateData('consularFeeEur', vt.defaultFeeEur !== undefined ? Number(vt.defaultFeeEur) : undefined);
      }
    }
  };

  return (
    <div className="step-content fade-in">
      <h1 className="step-title">Destination & Visa Category</h1>
      <p className="step-subtitle">Select your European destination country and specify the duration and purpose of your travel.</p>

      {/* Destination Countries Grid */}
      <div className="wizard-input-group" style={{ marginBottom: '36px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <label style={{ margin: 0, fontWeight: 700, fontSize: '0.92rem', color: 'var(--color-primary)' }}>
            Destination Country (Schengen / EU)
          </label>
          <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
            {loadingCountries ? 'Loading official embassies...' : 'Select your primary entry country'}
          </span>
        </div>

        <div
          className="country-cards-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
            gap: '14px',
            marginBottom: '24px',
          }}
        >
          {countries.map((c) => {
            const isSelected =
              data.countryId === c.id ||
              data.country?.toLowerCase() === c.nameEn.toLowerCase() ||
              data.countryCode?.toUpperCase() === c.code.toUpperCase();

            return (
              <div
                key={c.id || c.code}
                className={`country-card ${isSelected ? 'selected' : ''}`}
                onClick={() => handleCountrySelect(c)}
                tabIndex={0}
                role="button"
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCountrySelect(c); }}
                style={{
                  background: isSelected ? '#EFF6FF' : '#FFFFFF',
                  border: isSelected ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '18px 14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  boxShadow: isSelected ? '0 4px 14px rgba(37, 99, 235, 0.15)' : '0 2px 6px rgba(15, 23, 42, 0.04)',
                }}
              >
                <div
                  className="country-card-code"
                  style={{
                    fontSize: '1.8rem',
                    fontWeight: 800,
                    color: isSelected ? '#2563EB' : '#0F172A',
                    marginBottom: '4px',
                    letterSpacing: '1px',
                  }}
                >
                  {c.code}
                </div>
                <strong
                  className="country-card-name"
                  style={{
                    color: isSelected ? '#1E3A8A' : '#0F1E36',
                    fontSize: '1rem',
                    marginBottom: '3px',
                    fontWeight: 700,
                  }}
                >
                  {c.nameEn}
                </strong>
                <span
                  className="country-card-local"
                  style={{
                    fontSize: '0.8rem',
                    color: '#64748B',
                    marginBottom: '8px',
                  }}
                >
                  {c.nameAz}
                </span>
                <span
                  className="country-card-badge"
                  style={{
                    fontSize: '0.75rem',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    background: isSelected ? '#2563EB' : '#F1F5F9',
                    color: isSelected ? '#FFFFFF' : '#475569',
                    fontWeight: 600,
                  }}
                >
                  {c.processingTime}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Travel Date */}
      <div className="wizard-form-grid" style={{ marginBottom: '32px' }}>
        <div className="wizard-input-group">
          <label>Intended Travel Date (Departure)</label>
          <input
            type="date"
            className="premium-input"
            value={data.travelDate || ''}
            onChange={(e) => updateData('travelDate', e.target.value)}
            min={today}
          />
        </div>
        <div className="wizard-input-group">
          <label>Selected Destination Embassy</label>
          <input
            type="text"
            className="premium-input"
            readOnly
            value={`${data.country || 'Hungary'} Consular Mission (${data.countryCode || 'HU'})`}
            style={{ background: '#F8FAFC', color: '#475569', fontWeight: 600 }}
          />
        </div>
      </div>

      {/* Duration of Stay / Dynamic Country Visa Types */}
      <div className="wizard-input-group" style={{ marginBottom: '32px' }}>
        <label>Visa Type & Duration of Stay</label>
        <div className="duration-cards-grid">
          {activeVcmsCountry?.visaTypes?.length ? (
            activeVcmsCountry.visaTypes.map((vt: any) => {
              const isSelected = activeVisaType?.id === vt.id;
              const isLong = vt.stayCategory === 'LONG';
              return (
                <div
                  key={vt.id}
                  className={`duration-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    updateData('visaTypeId', vt.id);
                    updateData('visaTypeName', vt.nameEn);
                    updateData('duration', isLong ? 'long' : 'short');
                    const firstP = vt.purposes?.[0];
                    if (firstP) {
                      updateData('visaPurposeId', firstP.id);
                      updateData('visaPurposeName', firstP.nameEn);
                      updateData('projectReason', firstP.nameEn);
                      const fee = firstP.consularFeeOverride ?? vt.defaultFeeEur;
                      updateData('consularFeeEur', fee !== undefined && fee !== null ? Number(fee) : undefined);
                    } else {
                      updateData('visaPurposeId', '');
                      updateData('projectReason', isLong ? longStayOptions[0] : shortStayOptions[0]);
                      updateData('consularFeeEur', vt.defaultFeeEur !== undefined ? Number(vt.defaultFeeEur) : undefined);
                    }
                  }}
                >
                  <div className="duration-icon">
                    {isLong ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    )}
                  </div>
                  <div className="duration-content">
                    <h3>{vt.nameEn}</h3>
                    <span className="visa-badge">
                      {isLong ? 'Long Stay (> 90 days)' : 'Short Stay (≤ 90 days)'}
                      {vt.defaultFeeEur !== undefined ? ` · €${Number(vt.defaultFeeEur).toFixed(0)}` : ''}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <>
              <div
                className={`duration-card ${data.duration === 'short' ? 'selected' : ''}`}
                onClick={() => {
                  updateData('duration', 'short');
                  updateData('projectReason', shortStayOptions[0]);
                }}
              >
                <div className="duration-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <div className="duration-content">
                  <h3>Short Stay (≤ 90 days)</h3>
                  <span className="visa-badge">Schengen C Visa</span>
                </div>
              </div>

              <div
                className={`duration-card ${data.duration === 'long' ? 'selected' : ''}`}
                onClick={() => {
                  updateData('duration', 'long');
                  updateData('projectReason', longStayOptions[0]);
                }}
              >
                <div className="duration-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="duration-content">
                  <h3>Long Stay (&gt; 90 days)</h3>
                  <span className="visa-badge">National D Visa</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Purpose of the Journey */}
      <div className="wizard-input-group" style={{ marginBottom: 24 }}>
        <label>Travel Project & Main Purpose ({activeVcmsCountry?.nameEn || data.country})</label>
        <div className="premium-select-wrapper">
          <select
            value={data.projectReason}
            onChange={(e) => {
              const val = e.target.value;
              updateData('projectReason', val);
              const matchedP = dynamicPurposes.find((p: any) => p.nameEn === val);
              if (matchedP) {
                updateData('visaPurposeId', matchedP.id);
                updateData('visaPurposeName', matchedP.nameEn);
                const fee = matchedP.consularFeeOverride ?? activeVisaType?.defaultFeeEur;
                if (fee !== undefined && fee !== null) {
                  updateData('consularFeeEur', Number(fee));
                }
              }
            }}
            className={data.projectReason ? 'selected' : ''}
            disabled={!data.duration}
          >
            <option value="" disabled>Select your consular travel purpose</option>
            {currentProjectOptions.map((opt: string) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Visa Application Centre & Embassy Official Info Card */}
      {(activeVcmsCountry?.visaApplicationCentres?.[0] || activeVcmsCountry?.embassies?.[0]) && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 14,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: 16,
            fontSize: '0.82rem',
            color: '#334155',
          }}
        >
          {activeVcmsCountry?.visaApplicationCentres?.[0] && (
            <div>
              <strong style={{ color: '#0f172a', display: 'block', marginBottom: 4 }}>
                Visa Application Centre ({activeVcmsCountry.visaApplicationCentres[0].providerName})
              </strong>
              <div>Address: {activeVcmsCountry.visaApplicationCentres[0].address}</div>
              <div>
                Tel: {activeVcmsCountry.visaApplicationCentres[0].telephone} · Email:{' '}
                {activeVcmsCountry.visaApplicationCentres[0].email}
              </div>
            </div>
          )}
          {activeVcmsCountry?.embassies?.[0] && (
            <div>
              <strong style={{ color: '#0f172a', display: 'block', marginBottom: 4 }}>
                {activeVcmsCountry.embassies[0].responsibleAuthority}
              </strong>
              <div>Address: {activeVcmsCountry.embassies[0].address}</div>
              <div>
                Tel: {activeVcmsCountry.embassies[0].telephone} · Email: {activeVcmsCountry.embassies[0].email}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

