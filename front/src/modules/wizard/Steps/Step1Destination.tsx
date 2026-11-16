import React, { useState, useEffect } from 'react';
import { dossierService } from '@/shared/api/services';
import type { DestinationCountry } from '../types/wizard.types';

interface Step1Props {
  data: {
    country: string;
    countryId: string;
    countryCode: string;
    duration: string;
    projectReason: string;
    travelDate?: string;
  };
  updateData: (field: string, value: any) => void;
}

const FALLBACK_COUNTRIES: DestinationCountry[] = [
  { id: 'hu-default', code: 'HU', nameEn: 'Hungary', nameAz: 'Macarıstan', flag: '🇭🇺', processingTime: '15 business days', consularFee: '€80' },
  { id: 'de-default', code: 'DE', nameEn: 'Germany', nameAz: 'Almaniya', flag: '🇩🇪', processingTime: '15 business days', consularFee: '€80' },
  { id: 'at-default', code: 'AT', nameEn: 'Austria', nameAz: 'Avstriya', flag: '🇦🇹', processingTime: '15 business days', consularFee: '€80' },
  { id: 'it-default', code: 'IT', nameEn: 'Italy', nameAz: 'İtaliya', flag: '🇮🇹', processingTime: '15 business days', consularFee: '€80' },
  { id: 'fr-default', code: 'FR', nameEn: 'France', nameAz: 'Fransa', flag: '🇫🇷', processingTime: '15 business days', consularFee: '€80' },
  { id: 'es-default', code: 'ES', nameEn: 'Spain', nameAz: 'İspaniya', flag: '🇪🇸', processingTime: '15 business days', consularFee: '€80' },
  { id: 'pl-default', code: 'PL', nameEn: 'Poland', nameAz: 'Polşa', flag: '🇵🇱', processingTime: '15 business days', consularFee: '€80' },
  { id: 'cz-default', code: 'CZ', nameEn: 'Czech Republic', nameAz: 'Çexiya', flag: '🇨🇿', processingTime: '15 business days', consularFee: '€80' },
  { id: 'tr-default', code: 'TR', nameEn: 'Turkey', nameAz: 'Türkiyə', flag: '🇹🇷', processingTime: '15 business days', consularFee: '€80' },
];

function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🇪🇺';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export default function Step1Destination({ data, updateData }: Step1Props) {
  const [countries, setCountries] = useState<DestinationCountry[]>(FALLBACK_COUNTRIES);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    let isMounted = true;
    setLoadingCountries(true);
    dossierService.getCountries()
      .then(res => {
        if (isMounted && res.data?.countries && res.data.countries.length > 0) {
          const mapped: DestinationCountry[] = res.data.countries.map((c: any) => ({
            id: c.id,
            code: c.code || 'EU',
            nameEn: c.nameEn || 'Schengen State',
            nameAz: c.nameAz || c.nameEn || 'Şengen Dövləti',
            flag: getFlagEmoji(c.code),
            processingTime: '15 business days',
            consularFee: '€80',
          }));
          setCountries(mapped);

          // Default selection if not selected yet
          if (!data.countryId && mapped.length > 0) {
            const defaultSelection = mapped.find(m => m.code === 'HU') || mapped[0];
            updateData('country', defaultSelection.nameEn);
            updateData('countryId', defaultSelection.id);
            updateData('countryCode', defaultSelection.code);
          }
        }
      })
      .catch(err => {
        console.warn('Using fallback countries list:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingCountries(false);
      });

    return () => { isMounted = false; };
  }, []);

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

  const currentProjectOptions = data.duration === 'long' ? longStayOptions : shortStayOptions;

  const handleCountrySelect = (c: DestinationCountry) => {
    updateData('country', c.nameEn);
    updateData('countryId', c.id);
    updateData('countryCode', c.code);
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

      {/* Duration of Stay (Schengen C vs National D) */}
      <div className="wizard-input-group" style={{ marginBottom: '32px' }}>
        <label>Duration of Stay (For all members)</label>
        <div className="duration-cards-grid">
          <div
            className={`duration-card ${data.duration === 'short' ? 'selected' : ''}`}
            onClick={() => { updateData('duration', 'short'); updateData('projectReason', shortStayOptions[0]); }}
          >
            <div className="duration-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div className="duration-content">
              <h3>Short Stay (≤ 90 days)</h3>
              <span className="visa-badge">Schengen C Visa</span>
            </div>
          </div>

          <div
            className={`duration-card ${data.duration === 'long' ? 'selected' : ''}`}
            onClick={() => { updateData('duration', 'long'); updateData('projectReason', longStayOptions[0]); }}
          >
            <div className="duration-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div className="duration-content">
              <h3>Long Stay (&gt; 90 days)</h3>
              <span className="visa-badge">National D Visa</span>
            </div>
          </div>
        </div>
      </div>

      {/* Purpose of the Journey */}
      <div className="wizard-input-group">
        <label>Travel Project & Main Purpose</label>
        <div className="premium-select-wrapper">
          <select
            value={data.projectReason}
            onChange={(e) => updateData('projectReason', e.target.value)}
            className={data.projectReason ? 'selected' : ''}
            disabled={!data.duration}
          >
            <option value="" disabled>Select your consular travel purpose</option>
            {currentProjectOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

