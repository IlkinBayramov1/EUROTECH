import React from 'react';
import type { WizardPortalType, WizardFormData } from '../types/wizard.types';
import {
  usePricingCatalog,
  type PricingCatalogData,
} from '@/shared/hooks/usePricingCatalog';

interface Step5Props {
  portalType: WizardPortalType;
  formData: WizardFormData;
  walletBalance: number;
  updateData: (field: string, value: any) => void;
  catalog?: PricingCatalogData;
}

export default function Step5Review({
  portalType,
  formData,
  walletBalance,
  updateData,
  catalog: propCatalog,
}: Step5Props) {
  const { catalog: hookCatalog, calculateLiveFees } = usePricingCatalog();
  const catalog = propCatalog || hookCatalog;
  const isB2B = portalType === 'GROUP_AGENT' || portalType === 'CORPORATE';
  const applicantsCount = Math.max(1, formData.applicants?.length || 1);

  const fees = calculateLiveFees({
    portalType,
    paxCount: applicantsCount,
    activePackage: formData.services.activePackage,
    services: formData.services,
    duration: formData.duration || 'short',
  });

  const activePackages = (catalog.packages || []).filter((p) => p.isActive !== false);

  const handleQuickPackageSwitch = (pkgId: string) => {
    const pkg = activePackages.find((p) => p.id === pkgId);
    if (!pkg) return;
    const flags = pkg.wizardFlags || {};
    updateData('services', {
      ...formData.services,
      activePackage: pkg.id,
      filePrep: !!flags.filePrep,
      insurance: !!flags.insurance,
      formAssist: !!flags.formAssist,
      photo: !!flags.photo,
      lounge: !!flags.lounge,
      courier: !!flags.courier,
      hotelFlight: !!flags.hotelFlight,
    });
  };

  return (
    <div className="step-content fade-in">
      <h1 className="step-title">Review &amp; Confirmation</h1>
      <p className="step-subtitle">
        Verify your consular dossier details, review your selected payment package, and choose your preferred settlement channel.
      </p>

      {/* Summary Box */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1.5px solid #E2E8F0',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
              Destination Country
            </span>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>
              🇪🇺 {formData.country || 'Hungary'} ({formData.countryCode || 'HU'})
            </div>
            <div style={{ fontSize: '0.82rem', color: '#64748B' }}>
              {formData.duration === 'long' ? 'National D Visa (Long Stay)' : 'Schengen C Visa (Short Stay)'}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
              Travel Date &amp; Purpose
            </span>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>
              📅 {formData.travelDate || 'Departure TBD'}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#64748B' }}>
              {formData.projectReason || 'Tourism'}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
              Biometric Appointment
            </span>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>
              🏛️ {formData.appointmentDate || 'Not selected'}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#64748B' }}>
              {formData.appointmentTime || 'Time TBD'}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
              Total Applicants &amp; Package
            </span>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2563EB', marginTop: '4px' }}>
              👥 {applicantsCount} {applicantsCount === 1 ? 'Applicant' : 'Applicants'}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600 }}>
              Package: {fees.packageName}
            </div>
          </div>
        </div>
      </div>

      {/* Step 5 Package Selector */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1.5px solid #E2E8F0',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#0F172A', fontWeight: 700 }}>
            Selected Service &amp; Payment Package
          </h3>
          <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
            You can switch your package tier before final submission
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {activePackages.map((pkg) => {
            const isSelected = String(formData.services.activePackage || 'standard').toLowerCase() === String(pkg.id).toLowerCase();
            return (
              <div
                key={pkg.id}
                onClick={() => handleQuickPackageSwitch(pkg.id)}
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  border: isSelected ? '2px solid #2563EB' : '1.5px solid #CBD5E1',
                  background: isSelected ? '#EFF6FF' : '#F8FAFC',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: '#0F172A', fontSize: '0.94rem' }}>{pkg.name}</strong>
                  <span style={{ fontWeight: 800, color: '#2563EB', fontSize: '0.92rem' }}>
                    {Number(pkg.priceEur) > 0 ? `+€${Number(pkg.priceEur).toFixed(0)}` : '€0'}/pax
                  </span>
                </div>
                <p style={{ margin: '6px 0 0 0', fontSize: '0.78rem', color: '#64748B', lineHeight: 1.35 }}>
                  {pkg.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Itemized Fee Breakdown */}
      <div
        style={{
          background: '#F8FAFC',
          border: '1.5px solid #E2E8F0',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '28px',
        }}
      >
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.05rem', color: '#0F172A', fontWeight: 700 }}>
          Itemized Consular Fees &amp; Charges
        </h3>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #E2E8F0', fontSize: '0.9rem' }}>
          <span>Official Embassy Consular Fee (€{fees.stateFeePP.toFixed(2)} × {applicantsCount})</span>
          <strong>€ {fees.totalConsularFeesEur.toFixed(2)}</strong>
        </div>

        {fees.totalBaseServiceFeesEur > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #E2E8F0', fontSize: '0.9rem' }}>
            <span>EuroTech Base Processing Fee (€{fees.baseServiceFeePP.toFixed(2)} × {applicantsCount})</span>
            <strong>€ {fees.totalBaseServiceFeesEur.toFixed(2)}</strong>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #E2E8F0', fontSize: '0.9rem' }}>
          <span>Service Package &amp; Add-Ons ({fees.packageName} • €{fees.packageAddOnPP.toFixed(2)} × {applicantsCount})</span>
          <strong>€ {fees.totalPackageFeesEur.toFixed(2)}</strong>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px' }}>
          <div>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>Total Payable Amount:</span>
            <span style={{ display: 'block', fontSize: '0.82rem', color: '#64748B' }}>
              Approx. {fees.grandTotalAzn.toFixed(2)} AZN (Rate: {fees.exchangeRate})
            </span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#2563EB' }}>
            € {fees.grandTotalEur.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Payment Channel Selection */}
      <div className="wizard-input-group" style={{ marginBottom: '28px' }}>
        <label>Select Settlement / Payment Method</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          <div
            onClick={() => updateData('paymentMethod', 'WALLET')}
            style={{
              background: formData.paymentMethod === 'WALLET' ? '#EFF6FF' : '#FFFFFF',
              border: `2px solid ${formData.paymentMethod === 'WALLET' ? '#2563EB' : '#E2E8F0'}`,
              borderRadius: '10px',
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <input
              type="radio"
              checked={formData.paymentMethod === 'WALLET'}
              onChange={() => {}}
              style={{ accentColor: '#2563EB', width: 18, height: 18 }}
            />
            <div>
              <strong style={{ display: 'block', color: '#0F172A', fontSize: '0.95rem' }}>
                Pre-funded EuroTech Wallet
              </strong>
              <span style={{ fontSize: '0.8rem', color: walletBalance >= fees.grandTotalEur ? '#16A34A' : '#DC2626' }}>
                Balance: € {walletBalance.toFixed(2)} {walletBalance >= fees.grandTotalEur ? '(Sufficient)' : '(Low Balance)'}
              </span>
            </div>
          </div>

          <div
            onClick={() => updateData('paymentMethod', isB2B ? 'INVOICE' : 'CARD')}
            style={{
              background: (formData.paymentMethod === 'CARD' || formData.paymentMethod === 'INVOICE') ? '#EFF6FF' : '#FFFFFF',
              border: `2px solid ${(formData.paymentMethod === 'CARD' || formData.paymentMethod === 'INVOICE') ? '#2563EB' : '#E2E8F0'}`,
              borderRadius: '10px',
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <input
              type="radio"
              checked={formData.paymentMethod === 'CARD' || formData.paymentMethod === 'INVOICE'}
              onChange={() => {}}
              style={{ accentColor: '#2563EB', width: 18, height: 18 }}
            />
            <div>
              <strong style={{ display: 'block', color: '#0F172A', fontSize: '0.95rem' }}>
                {isB2B ? 'Proforma Corporate Invoice (Wire Transfer)' : 'Online Card Payment / Terminal'}
              </strong>
              <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                {isB2B ? 'Official invoice with corporate IBAN' : 'Visa, Mastercard & BirKart accepted'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* GDPR & Compliance Consent */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1.5px solid #E2E8F0',
          borderRadius: '10px',
          padding: '16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        <input
          type="checkbox"
          id="gdprConsent"
          checked={formData.gdprConsent}
          onChange={(e) => updateData('gdprConsent', e.target.checked)}
          style={{ accentColor: '#2563EB', width: 18, height: 18, marginTop: '2px', cursor: 'pointer' }}
        />
        <label htmlFor="gdprConsent" style={{ margin: 0, fontSize: '0.85rem', color: '#334155', cursor: 'pointer', lineHeight: 1.5 }}>
          I confirm that all entered passenger particulars, passport bio-data, and travel intents are true, authentic, and complete. I consent to the processing of biometric and consular data under EU GDPR Article 6/9 and official Schengen visa compliance regulations.
        </label>
      </div>
    </div>
  );
}
