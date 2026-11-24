import React, { useEffect, useState } from 'react';
import { vcmsApi } from '@/modules/admin/api/vcmsApi';

interface Step4Props {
  data: {
    countryId?: string;
    visaTypeId?: string;
    visaPurposeId?: string;
    visaCenter: string;
    appointmentDate: string;
    appointmentTime: string;
    timeSlotId?: string;
    applicants?: any[];
  };
  updateData: (field: string, value: any) => void;
}

const FALLBACK_TIME_SLOTS = [
  '09:00',
  '09:30 AM',
  '10:00 AM',
  '10:30 AM',
  '11:00',
  '11:30 AM',
  '02:00 PM',
  '02:30 PM',
  '03:00 PM',
  '03:30 PM',
  '04:00 PM',
];

export default function Step4Biometrics({ data, updateData }: Step4Props) {
  const today = new Date().toISOString().split('T')[0];
  const [providers, setProviders] = useState<any[]>([]);
  const [publishedSlots, setPublishedSlots] = useState<any[]>([]);

  const groupSize = Math.max(1, data.applicants?.length || 1);

  useEffect(() => {
    vcmsApi
      .getCustomerPublishedSlots({
        countryId: data.countryId || undefined,
        visaTypeId: data.visaTypeId || undefined,
        visaPurposeId: data.visaPurposeId || undefined,
        groupSize,
      })
      .then((res) => {
        const provs = res.data?.providers || [];
        const slots = res.data?.slots || [];
        setProviders(provs);
        setPublishedSlots(slots);

        if (provs[0] && (!data.visaCenter || data.visaCenter === 'main')) {
          updateData('visaCenter', provs[0].displayName);
        }
        if (slots[0] && !data.appointmentDate) {
          updateData('appointmentDate', slots[0].slotDate || new Date(slots[0].date).toISOString().slice(0, 10));
          updateData('appointmentTime', slots[0].startTime);
          updateData('timeSlotId', slots[0].id);
        }
      })
      .catch(() => {});
  }, [data.countryId, data.visaTypeId, data.visaPurposeId]);

  const fallbackCenters = [
    {
      id: 'main',
      name: 'EuroTech Main Consular Center',
      location: 'Port Baku Towers, 153 Neftchilar Ave, Baku',
      desc: 'Standard diplomatic file acceptance desk with full biometric booths.',
      badge: 'Main Center',
    },
    {
      id: 'lounge',
      name: 'EuroTech Premium Lounge',
      location: 'Port Baku Towers, 12th Floor, Baku',
      desc: 'Private quiet diplomatic lounge, dedicated officer assistance, and refreshments.',
      badge: 'VIP Service',
    },
    {
      id: 'ganja',
      name: 'Ganja Regional Center',
      location: 'Heydar Aliyev Ave 45, Ganja',
      desc: 'Regional biometric collection facility for western regions of Azerbaijan.',
      badge: 'Regional Desk',
    },
  ];

  const activeCenters =
    providers.length > 0
      ? providers.map((p) => ({
          id: p.displayName,
          name: p.displayName,
          location: p.visaApplicationCentre?.address || p.embassy?.address || 'Baku, Azerbaijan',
          desc:
            p.providerType === 'EMBASSY'
              ? `Official Diplomatic Mission (${p.timezone}) · Tel: ${p.embassy?.telephone || '—'}`
              : `Authorized Visa Application Centre (${p.timezone}) · Tel: ${p.visaApplicationCentre?.telephone || '—'}`,
          badge: p.providerType === 'EMBASSY' ? 'Embassy Appointment' : 'Visa Application Centre',
        }))
      : fallbackCenters;

  const slotsForSelectedDate = publishedSlots.filter(
    (s) => (s.slotDate || new Date(s.date).toISOString().slice(0, 10)) === data.appointmentDate
  );

  return (
    <div className="step-content fade-in">
      <h1 className="step-title">Biometric & Consular Appointment Scheduling</h1>
      <p className="step-subtitle">
        Select the official Visa Application Centre or Embassy facility, date, and published appointment slot.
      </p>

      {/* Center / Provider Selection */}
      <div className="wizard-input-group" style={{ marginBottom: '28px' }}>
        <label>Designated Appointment Provider (Embassy / Visa Application Centre)</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {activeCenters.map((c) => {
            const isSelected = data.visaCenter === c.id || (c === activeCenters[0] && !data.visaCenter);
            return (
              <div
                key={c.id}
                onClick={() => updateData('visaCenter', c.id)}
                style={{
                  background: isSelected ? '#EFF6FF' : '#FFFFFF',
                  border: `2px solid ${isSelected ? '#2563EB' : '#E2E8F0'}`,
                  borderRadius: '12px',
                  padding: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px',
                    }}
                  >
                    <span
                      style={{
                        background: isSelected ? '#2563EB' : '#E2E8F0',
                        color: isSelected ? '#FFFFFF' : '#475569',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      {c.badge}
                    </span>
                    {isSelected && (
                      <span style={{ color: '#2563EB', fontWeight: 700, fontSize: '0.9rem' }}>✓ Selected</span>
                    )}
                  </div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: '#0F172A', fontWeight: 700 }}>
                    {c.name}
                  </h3>
                  <p style={{ margin: '0 0 10px 0', fontSize: '0.8rem', color: '#64748B' }}>{c.location}</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569', lineHeight: 1.4 }}>{c.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Published Available Slots Quick Picker (if Admin has published a schedule) */}
      {publishedSlots.length > 0 && (
        <div className="wizard-input-group" style={{ marginBottom: '24px' }}>
          <label>Published Available Consular Slots ({publishedSlots.length} open)</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {publishedSlots.slice(0, 14).map((slot) => {
              const sDate = slot.slotDate || new Date(slot.date).toISOString().slice(0, 10);
              const isChosen =
                data.timeSlotId === slot.id ||
                (data.appointmentDate === sDate && data.appointmentTime === slot.startTime);
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => {
                    updateData('appointmentDate', sDate);
                    updateData('appointmentTime', slot.startTime);
                    updateData('timeSlotId', slot.id);
                    if (slot.provider?.displayName) {
                      updateData('visaCenter', slot.provider.displayName);
                    }
                  }}
                  style={{
                    padding: '8px 13px',
                    borderRadius: 10,
                    border: isChosen ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: isChosen ? '#eff6ff' : '#ffffff',
                    color: isChosen ? '#1d4ed8' : '#0f172a',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  {sDate} · {slot.startTime} ({slot.availableCapacity} left)
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Date & Time Slot */}
      <div className="wizard-form-grid" style={{ marginBottom: '32px' }}>
        <div className="wizard-input-group">
          <label>Appointment Date *</label>
          <input
            type="date"
            className="premium-input"
            value={data.appointmentDate || ''}
            onChange={(e) => {
              updateData('appointmentDate', e.target.value);
              updateData('timeSlotId', '');
            }}
            min={today}
          />
        </div>

        <div className="wizard-input-group">
          <label>Preferred Time Slot *</label>
          <div className="premium-select-wrapper">
            <select
              value={data.appointmentTime || ''}
              onChange={(e) => {
                const chosenTime = e.target.value;
                updateData('appointmentTime', chosenTime);
                const matched = slotsForSelectedDate.find((s) => s.startTime === chosenTime);
                updateData('timeSlotId', matched?.id || '');
              }}
              className={data.appointmentTime ? 'selected' : ''}
            >
              <option value="" disabled>
                Select time slot
              </option>
              {(slotsForSelectedDate.length > 0
                ? slotsForSelectedDate.map((s) => s.startTime)
                : FALLBACK_TIME_SLOTS
              ).map((slotTime) => (
                <option key={slotTime} value={slotTime}>
                  {slotTime}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="info-alert">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>
          <strong>Biometrics Requirement:</strong> All applicants aged 12 and above must present themselves in person
          to register 10-digit digital fingerprints and biometric facial photographs unless previously captured within
          the past 59 months.
        </span>
      </div>
    </div>
  );
}
