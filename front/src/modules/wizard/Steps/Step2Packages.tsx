import React from 'react';
import type { WizardPortalType, WizardServices } from '../types/wizard.types';
import {
  usePricingCatalog,
  type PricingCatalogData,
  type PricingPackageItem,
} from '@/shared/hooks/usePricingCatalog';

interface Step2Props {
  portalType: WizardPortalType;
  services: WizardServices;
  applicantsCount: number;
  updateData: (field: string, value: any) => void;
  catalog?: PricingCatalogData;
}

export default function Step2Packages({
  portalType,
  services,
  applicantsCount,
  updateData,
  catalog: propCatalog,
}: Step2Props) {
  const { catalog: hookCatalog } = usePricingCatalog();
  const catalog = propCatalog || hookCatalog;
  const isB2B = portalType === 'GROUP_AGENT' || portalType === 'CORPORATE';
  const count = Math.max(1, applicantsCount);

  const activePackages = (catalog.packages || []).filter((p) => p.isActive !== false);
  const activeServices = (catalog.services || []).filter((s) => s.isActive !== false);

  const handleSelectPackage = (pkg: PricingPackageItem) => {
    const flags = pkg.wizardFlags || {
      filePrep: (pkg.includedServiceIds || []).includes('FILE_PREPARATION'),
      insurance: (pkg.includedServiceIds || []).includes('TRAVEL_INSURANCE'),
      formAssist: (pkg.includedServiceIds || []).includes('FORM_ASSIST'),
      photo: (pkg.includedServiceIds || []).includes('BIOMETRIC_PHOTO'),
      lounge: (pkg.includedServiceIds || []).includes('PREMIUM_LOUNGE'),
      courier: (pkg.includedServiceIds || []).includes('COURIER'),
      hotelFlight:
        (pkg.includedServiceIds || []).includes('HOTEL_BOOKING') ||
        (pkg.includedServiceIds || []).includes('FLIGHT_BOOKING'),
    };
    updateData('services', {
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

  const toggleServiceKey = (key: string) => {
    updateData('services', {
      ...services,
      activePackage: 'custom',
      [key]: !services[key],
    });
  };

  return (
    <div className="step-content fade-in">
      <h1 className="step-title">Packages &amp; Services</h1>
      <p className="step-subtitle">
        {isB2B
          ? `Select a B2B service package. This package will be applied to all ${count} travelers/employees (in addition to standard consular state fees).`
          : 'Choose a comprehensive consular service package or customize individual add-ons for your application.'}
      </p>

      {/* Dynamic Admin-Managed Packages Grid */}
      <div className="packages-grid" style={{ marginBottom: '36px' }}>
        {activePackages.map((pkg, idx) => {
          const isSelected = String(services.activePackage || 'standard').toLowerCase() === String(pkg.id).toLowerCase();
          const styleClass = pkg.id === 'vip' ? 'vip' : pkg.id === 'premium' ? 'premium' : idx > 1 ? 'vip' : 'basic';

          return (
            <div
              key={pkg.id}
              className={`package-card ${styleClass} ${isSelected ? 'active' : ''}`}
              onClick={() => handleSelectPackage(pkg)}
            >
              {pkg.badge && (
                <div className={`package-badge ${pkg.id === 'vip' ? 'luxury' : ''}`}>
                  {pkg.badge}
                </div>
              )}
              <div className="package-header">
                <h3>{pkg.name}</h3>
                <div className="package-price">
                  {Number(pkg.priceEur) > 0 ? `+€ ${Number(pkg.priceEur).toFixed(0)}` : '€ 0'}{' '}
                  <span>/ person</span>
                </div>
                <p>{pkg.description}</p>
              </div>
              {Array.isArray(pkg.features) && pkg.features.length > 0 && (
                <ul className="package-features" style={{ margin: '12px 0', paddingLeft: '18px', fontSize: '0.82rem', color: '#475569' }}>
                  {pkg.features.map((feat, fIdx) => (
                    <li key={fIdx} style={{ marginBottom: '4px' }}>{feat}</li>
                  ))}
                </ul>
              )}
              <div className="package-action">
                <button type="button" className={`btn-package ${isSelected ? 'selected' : ''}`}>
                  {isSelected ? 'Current Selection' : `Select ${pkg.name}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Individual Custom Add-ons (Dynamic from Admin Catalog) */}
      {!isB2B && (
        <div className="additional-services-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>
              Custom Consular Add-Ons
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#64748B' }}>Customize your service file</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
            {activeServices.map((srv) => {
              const key = srv.wizardKey || srv.id.toLowerCase();
              const isChecked = !!services[key];
              return (
                <div
                  key={srv.id}
                  onClick={() => toggleServiceKey(key)}
                  style={{
                    background: isChecked ? '#EFF6FF' : '#FFFFFF',
                    border: `1.5px solid ${isChecked ? '#2563EB' : '#E2E8F0'}`,
                    borderRadius: '10px',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#0F172A' }}>{srv.title}</h4>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        style={{ accentColor: '#2563EB', width: 18, height: 18, cursor: 'pointer' }}
                      />
                    </div>
                    <p style={{ margin: '8px 0 12px 0', fontSize: '0.8rem', color: '#64748B', lineHeight: 1.4 }}>
                      {srv.description}
                    </p>
                  </div>
                  <strong style={{ fontSize: '0.95rem', color: '#1D4ED8' }}>
                    +€ {Number(srv.priceEur ?? srv.price ?? 0).toFixed(2)}
                  </strong>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isB2B && (
        <div className="info-alert" style={{ marginTop: '20px' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span>
            <strong>B2B Billing Note:</strong> The selected service tier will be multiplied across all registered travelers/employees in Step 3, with corporate discount and partner tier commission automatically applied.
          </span>
        </div>
      )}
    </div>
  );
}
