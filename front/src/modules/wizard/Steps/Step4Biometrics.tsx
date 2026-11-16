import React from 'react';

interface Step4Props {
  data: {
    visaCenter: string;
    appointmentDate: string;
    appointmentTime: string;
  };
  updateData: (field: string, value: any) => void;
}

const TIME_SLOTS = [
  '09:30 AM',
  '10:00 AM',
  '10:30 AM',
  '11:00 AM',
  '11:30 AM',
  '02:00 PM',
  '02:30 PM',
  '03:00 PM',
  '03:30 PM',
  '04:00 PM',
  '04:30 PM',
];

export default function Step4Biometrics({ data, updateData }: Step4Props) {
  const today = new Date().toISOString().split('T')[0];

  const centers = [
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

  return (
    <div className="step-content fade-in">
      <h1 className="step-title">Biometric Appointment Scheduling</h1>
      <p className="step-subtitle">Select the submission facility, date, and preferred time slot for consular biometric data collection.</p>

      {/* Center Selection */}
      <div className="wizard-input-group" style={{ marginBottom: '32px' }}>
        <label>Visa Application Center</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {centers.map((c) => {
            const isSelected = data.visaCenter === c.id || (c.id === 'main' && !data.visaCenter);
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
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
                  <p style={{ margin: '0 0 10px 0', fontSize: '0.8rem', color: '#64748B' }}>
                    📍 {c.location}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569', lineHeight: 1.4 }}>
                    {c.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Date & Time Slot */}
      <div className="wizard-form-grid" style={{ marginBottom: '32px' }}>
        <div className="wizard-input-group">
          <label>Appointment Date *</label>
          <input
            type="date"
            className="premium-input"
            value={data.appointmentDate || ''}
            onChange={(e) => updateData('appointmentDate', e.target.value)}
            min={today}
          />
        </div>

        <div className="wizard-input-group">
          <label>Preferred Time Slot *</label>
          <div className="premium-select-wrapper">
            <select
              value={data.appointmentTime || ''}
              onChange={(e) => updateData('appointmentTime', e.target.value)}
              className={data.appointmentTime ? 'selected' : ''}
            >
              <option value="" disabled>Select time slot</option>
              {TIME_SLOTS.map((slot) => (
                <option key={slot} value={slot}>{slot}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="info-alert">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span>
          <strong>Biometrics Requirement:</strong> All applicants aged 12 and above must present themselves in person to register 10-digit digital fingerprints and biometric facial photographs unless previously captured within the past 59 months.
        </span>
      </div>
    </div>
  );
}

