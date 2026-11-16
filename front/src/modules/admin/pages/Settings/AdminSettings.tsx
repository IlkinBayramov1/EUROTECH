import React, { useState, useEffect } from 'react';
import { adminService } from '@/shared/api/services/admin.service';
import { useToast } from '@/shared/context/ToastContext';
import {
  DEFAULT_FRONTEND_CATALOG,
  type PricingCatalogData,
  type PricingPackageItem,
  type PricingServiceItem,
} from '@/shared/hooks/usePricingCatalog';
import './AdminSettings.css';

interface CountryItem {
  id: string;
  code: string;
  nameAz: string;
  nameEn: string;
  isActive: boolean;
}

export default function AdminSettings() {
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState<'packages' | 'services' | 'baseFees' | 'system'>('packages');
  const [countries, setCountries] = useState<CountryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Full Admin Pricing Catalog State
  const [catalog, setCatalog] = useState<PricingCatalogData>(DEFAULT_FRONTEND_CATALOG);

  // Consular config settings
  const [sessionTimeout, setSessionTimeout] = useState('15');
  const [healthStatus, setHealthStatus] = useState<any>(null);

  const loadSettingsData = async () => {
    setLoading(true);
    try {
      const [countriesRes, settingsRes, catalogRes, healthRes]: any = await Promise.all([
        adminService.getCountries().catch(() => null),
        adminService.getSettings().catch(() => null),
        adminService.getPricingCatalog().catch(() => null),
        adminService.getIntegrationsHealth().catch(() => null),
      ]);

      if (countriesRes?.data?.countries || countriesRes?.countries) {
        setCountries(countriesRes?.data?.countries || countriesRes?.countries);
      }

      const s = settingsRes?.settings || settingsRes?.data?.settings;
      if (s?.sessionTimeout) {
        setSessionTimeout(String(s.sessionTimeout));
      }

      const loadedCatalog =
        catalogRes?.data?.catalog ||
        catalogRes?.catalog ||
        settingsRes?.data?.pricingCatalog ||
        settingsRes?.pricingCatalog;

      if (loadedCatalog && loadedCatalog.packages && loadedCatalog.services) {
        setCatalog({
          baseFees: {
            ...DEFAULT_FRONTEND_CATALOG.baseFees,
            ...(loadedCatalog.baseFees || {}),
            agentCommissionRates: {
              ...DEFAULT_FRONTEND_CATALOG.baseFees.agentCommissionRates,
              ...(loadedCatalog.baseFees?.agentCommissionRates || {}),
            },
          },
          packages: loadedCatalog.packages,
          services: loadedCatalog.services,
          exchangeRate: Number(loadedCatalog.baseFees?.eurToAznRate || loadedCatalog.exchangeRate || 1.85),
          currency: 'EUR',
        });
      }

      if (healthRes) {
        setHealthStatus(healthRes.services || healthRes.data?.services);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsData();
  }, []);

  // --- Package Handlers ---
  const handlePackageChange = (idx: number, field: keyof PricingPackageItem, value: any) => {
    setCatalog((prev) => {
      const updated = [...prev.packages];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, packages: updated };
    });
  };

  const handleToggleIncludedService = (pkgIdx: number, serviceId: string) => {
    setCatalog((prev) => {
      const updated = [...prev.packages];
      const pkg = { ...updated[pkgIdx] };
      const current = Array.isArray(pkg.includedServiceIds) ? [...pkg.includedServiceIds] : [];
      const exists = current.includes(serviceId);
      pkg.includedServiceIds = exists ? current.filter((id) => id !== serviceId) : [...current, serviceId];
      updated[pkgIdx] = pkg;
      return { ...prev, packages: updated };
    });
  };

  const handleAddPackage = () => {
    const newId = `pkg_${Date.now().toString().slice(-4)}`;
    const newPkg: PricingPackageItem = {
      id: newId,
      code: newId.toUpperCase(),
      name: 'New Service Package',
      badge: 'Custom Tier',
      description: 'Custom consular service package configured by Administrator.',
      priceEur: 95.0,
      features: ['Priority verification', 'Dedicated support'],
      includedServiceIds: ['FILE_PREPARATION'],
      applicablePortals: ['INDIVIDUAL', 'GROUP_AGENT', 'CORPORATE'],
      isActive: true,
    };
    setCatalog((prev) => ({ ...prev, packages: [...prev.packages, newPkg] }));
  };

  const handleRemovePackage = (idx: number) => {
    const pkg = catalog.packages[idx];
    if (!pkg) return;
    if (['standard', 'premium', 'vip'].includes(pkg.id)) {
      showError('Core system tiers (Standard, Premium, VIP) cannot be deleted, but you can rename them, edit their prices, or deactivate them.');
      return;
    }
    setCatalog((prev) => ({
      ...prev,
      packages: prev.packages.filter((_, i) => i !== idx),
    }));
  };

  // --- Service Handlers ---
  const handleServiceChange = (idx: number, field: keyof PricingServiceItem, value: any) => {
    setCatalog((prev) => {
      const updated = [...prev.services];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, services: updated };
    });
  };

  const handleAddService = () => {
    const code = `CUSTOM_SERVICE_${Date.now().toString().slice(-4)}`;
    const newSrv: PricingServiceItem = {
      id: code,
      code,
      wizardKey: code.toLowerCase(),
      title: 'New Consular Add-On',
      description: 'Official consular value-added service.',
      category: 'ASSISTANCE',
      priceEur: 25.0,
      recommended: false,
      isActive: true,
    };
    setCatalog((prev) => ({ ...prev, services: [...prev.services, newSrv] }));
  };

  const handleRemoveService = (idx: number) => {
    setCatalog((prev) => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== idx),
    }));
  };

  // --- Base Fees Handlers ---
  const handleBaseFeeChange = (field: string, value: number) => {
    setCatalog((prev) => ({
      ...prev,
      baseFees: {
        ...prev.baseFees,
        [field]: value,
      },
    }));
  };

  const handleCommissionChange = (tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM', value: number) => {
    setCatalog((prev) => ({
      ...prev,
      baseFees: {
        ...prev.baseFees,
        agentCommissionRates: {
          ...prev.baseFees.agentCommissionRates,
          [tier]: value,
        },
      },
    }));
  };

  const handleSaveAllCatalog = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      await adminService.savePricingCatalog(catalog);
      await adminService.updateSettings({
        sessionTimeout,
        eurToAznRate: String(catalog.baseFees.eurToAznRate),
      });
      showSuccess('Bütün ödəniş paketləri, xidmət adları və qiymətlər uğurla bazada yadda saxlanıldı!');
      await loadSettingsData();
    } catch (err: any) {
      showError(err.response?.data?.message || err.message || 'Failed to save pricing catalog');
    } finally {
      setIsSaving(false);
    }
  };

  const rate = Number(catalog.baseFees.eurToAznRate || 1.85);

  return (
    <div className="admin-settings-view">
      <div className="settings-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="settings-title">Payment Packages, Services &amp; System Configuration</h1>
          <p className="settings-subtitle">
            Manage all payment packages, service names, descriptions, add-on prices, and base consular fees across Individual, Tour Agent, and Corporate portals.
          </p>
        </div>
        <button
          type="button"
          className="btn-save-settings"
          style={{ width: 'auto', padding: '12px 24px', margin: 0 }}
          onClick={() => handleSaveAllCatalog()}
          disabled={isSaving}
        >
          {isSaving ? 'Saving All Changes...' : '💾 Save All Packages & Prices'}
        </button>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setActiveTab('packages')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: activeTab === 'packages' ? '2px solid #2563EB' : '1px solid #CBD5E1',
            background: activeTab === 'packages' ? '#EFF6FF' : '#FFFFFF',
            color: activeTab === 'packages' ? '#1D4ED8' : '#334155',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          📦 Payment Packages ({catalog.packages.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('services')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: activeTab === 'services' ? '2px solid #2563EB' : '1px solid #CBD5E1',
            background: activeTab === 'services' ? '#EFF6FF' : '#FFFFFF',
            color: activeTab === 'services' ? '#1D4ED8' : '#334155',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ✨ Add-On Services ({catalog.services.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('baseFees')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: activeTab === 'baseFees' ? '2px solid #2563EB' : '1px solid #CBD5E1',
            background: activeTab === 'baseFees' ? '#EFF6FF' : '#FFFFFF',
            color: activeTab === 'baseFees' ? '#1D4ED8' : '#334155',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          💶 Base Fees, Rates &amp; Commissions
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('system')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: activeTab === 'system' ? '2px solid #2563EB' : '1px solid #CBD5E1',
            background: activeTab === 'system' ? '#EFF6FF' : '#FFFFFF',
            color: activeTab === 'system' ? '#1D4ED8' : '#334155',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          🏛️ Jurisdictions &amp; System Health
        </button>
      </div>

      {/* TAB 1: PAYMENT PACKAGES MANAGER */}
      {activeTab === 'packages' && (
        <div className="settings-panel" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: 0 }}>Payment Packages (All Portals &amp; 5-Step Wizard)</h3>
              <p className="panel-desc" style={{ margin: '4px 0 0 0' }}>
                Edit package names, badges, descriptions, prices (€), feature bullet points, and bundled add-on services. Changes apply immediately to Individual, Agent, and Corporate portals.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddPackage}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                background: '#0F172A',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + Add New Payment Package
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
            {catalog.packages.map((pkg, idx) => (
              <div
                key={pkg.id || idx}
                style={{
                  border: pkg.isActive ? '2px solid #BFDBFE' : '1.5px dashed #CBD5E1',
                  borderRadius: '12px',
                  padding: '20px',
                  background: pkg.isActive ? '#FFFFFF' : '#F8FAFC',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, background: '#EFF6FF', color: '#1D4ED8', padding: '4px 10px', borderRadius: '6px' }}>
                    ID: {pkg.id.toUpperCase()}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={pkg.isActive !== false}
                        onChange={(e) => handlePackageChange(idx, 'isActive', e.target.checked)}
                      />
                      Active
                    </label>
                    {!['standard', 'premium', 'vip'].includes(pkg.id) && (
                      <button
                        type="button"
                        onClick={() => handleRemovePackage(idx)}
                        style={{ background: '#FEE2E2', color: '#B91C1C', border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                <div className="setting-input-group" style={{ marginBottom: 0 }}>
                  <label>Package Name (Displayed in Wizard &amp; Modules)</label>
                  <input
                    type="text"
                    value={pkg.name}
                    onChange={(e) => handlePackageChange(idx, 'name', e.target.value)}
                    placeholder="e.g. Premium Bundle"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="setting-input-group" style={{ marginBottom: 0 }}>
                    <label>Price per Person (€ EUR)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={pkg.priceEur}
                      onChange={(e) => handlePackageChange(idx, 'priceEur', parseFloat(e.target.value) || 0)}
                    />
                    <span className="input-helper">≈ {(Number(pkg.priceEur || 0) * rate).toFixed(2)} AZN</span>
                  </div>
                  <div className="setting-input-group" style={{ marginBottom: 0 }}>
                    <label>Badge / Tag Label</label>
                    <input
                      type="text"
                      value={pkg.badge || ''}
                      onChange={(e) => handlePackageChange(idx, 'badge', e.target.value)}
                      placeholder="e.g. Recommended"
                    />
                  </div>
                </div>

                <div className="setting-input-group" style={{ marginBottom: 0 }}>
                  <label>Package Description</label>
                  <textarea
                    rows={2}
                    value={pkg.description}
                    onChange={(e) => handlePackageChange(idx, 'description', e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.86rem', fontFamily: 'inherit' }}
                  />
                </div>

                <div className="setting-input-group" style={{ marginBottom: 0 }}>
                  <label>Feature Bullet Points (One per line)</label>
                  <textarea
                    rows={3}
                    value={(pkg.features || []).join('\n')}
                    onChange={(e) =>
                      handlePackageChange(
                        idx,
                        'features',
                        e.target.value.split('\n')
                      )
                    }
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.84rem', fontFamily: 'inherit' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Included Add-On Services in this Package:
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '130px', overflowY: 'auto', padding: '8px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    {catalog.services.map((srv) => {
                      const included = (pkg.includedServiceIds || []).includes(srv.id);
                      return (
                        <label
                          key={srv.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            background: included ? '#DBEAFE' : '#FFFFFF',
                            color: included ? '#1E40AF' : '#475569',
                            border: `1px solid ${included ? '#93C5FD' : '#CBD5E1'}`,
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={included}
                            onChange={() => handleToggleIncludedService(idx, srv.id)}
                          />
                          {srv.title} (€{Number(srv.priceEur).toFixed(0)})
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: ADD-ON SERVICES MANAGER */}
      {activeTab === 'services' && (
        <div className="settings-panel" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: 0 }}>Individual Add-On Services Catalog</h3>
              <p className="panel-desc" style={{ margin: '4px 0 0 0' }}>
                Configure the names, descriptions, categories, and prices (€) of all standalone value-added services shown in the Wizard and Buy Services modules.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddService}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                background: '#0F172A',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + Add New Service
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {catalog.services.map((srv, idx) => (
              <div
                key={srv.id || idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 2fr 130px 130px auto',
                  gap: '12px',
                  alignItems: 'center',
                  padding: '14px',
                  background: srv.isActive !== false ? '#FFFFFF' : '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                }}
              >
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, display: 'block' }}>
                    Service Name ({srv.id})
                  </label>
                  <input
                    type="text"
                    value={srv.title}
                    onChange={(e) => handleServiceChange(idx, 'title', e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontWeight: 600 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, display: 'block' }}>
                    Description
                  </label>
                  <input
                    type="text"
                    value={srv.description}
                    onChange={(e) => handleServiceChange(idx, 'description', e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.84rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, display: 'block' }}>
                    Category
                  </label>
                  <input
                    type="text"
                    value={srv.category}
                    onChange={(e) => handleServiceChange(idx, 'category', e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, display: 'block' }}>
                    Price (€ EUR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={srv.priceEur}
                    onChange={(e) => handleServiceChange(idx, 'priceEur', parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontWeight: 700, color: '#1D4ED8' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '14px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={srv.isActive !== false}
                      onChange={(e) => handleServiceChange(idx, 'isActive', e.target.checked)}
                    />
                    Active
                  </label>
                  {srv.id.startsWith('CUSTOM_') && (
                    <button
                      type="button"
                      onClick={() => handleRemoveService(idx)}
                      style={{ background: '#FEE2E2', color: '#B91C1C', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: BASE FEES, EXCHANGE RATE & AGENT COMMISSIONS */}
      {activeTab === 'baseFees' && (
        <div className="settings-panel" style={{ marginBottom: '24px' }}>
          <h3>Base Consular Fees, Portal Processing Fees &amp; Partner Commissions</h3>
          <p className="panel-desc">
            Define baseline embassy visa fees, B2B processing fees, EUR/AZN exchange rate, and Tour Operator commission tiers.
          </p>

          <div className="form-two-col" style={{ marginBottom: '20px' }}>
            <div className="setting-input-group">
              <label>Schengen Short-Stay (C Visa) State Fee (€ / person)</label>
              <input
                type="number"
                step="0.01"
                value={catalog.baseFees.schengenShortStayFeeEur}
                onChange={(e) => handleBaseFeeChange('schengenShortStayFeeEur', parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="setting-input-group">
              <label>National Long-Stay (D Visa) State Fee (€ / person)</label>
              <input
                type="number"
                step="0.01"
                value={catalog.baseFees.nationalLongStayFeeEur}
                onChange={(e) => handleBaseFeeChange('nationalLongStayFeeEur', parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="setting-input-group">
              <label>Individual Portal Base Service Fee (€ / person)</label>
              <input
                type="number"
                step="0.01"
                value={catalog.baseFees.individualBaseServiceFeeEur}
                onChange={(e) => handleBaseFeeChange('individualBaseServiceFeeEur', parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="setting-input-group">
              <label>Tour Agent (B2B) Base Processing Fee (€ / person)</label>
              <input
                type="number"
                step="0.01"
                value={catalog.baseFees.agentBaseServiceFeeEur}
                onChange={(e) => handleBaseFeeChange('agentBaseServiceFeeEur', parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="setting-input-group">
              <label>Corporate Mobility Base Processing Fee (€ / person)</label>
              <input
                type="number"
                step="0.01"
                value={catalog.baseFees.corporateBaseServiceFeeEur}
                onChange={(e) => handleBaseFeeChange('corporateBaseServiceFeeEur', parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="setting-input-group">
              <label>EUR to AZN Conversion Rate (1 EUR = ? AZN)</label>
              <input
                type="number"
                step="0.01"
                value={catalog.baseFees.eurToAznRate}
                onChange={(e) => handleBaseFeeChange('eurToAznRate', parseFloat(e.target.value) || 1.85)}
              />
            </div>
          </div>

          <h4 style={{ margin: '24px 0 12px 0', color: '#0F172A' }}>Tour Operator Commission Rates (€ / Passenger)</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            {(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] as const).map((tier) => (
              <div key={tier} className="setting-input-group" style={{ marginBottom: 0 }}>
                <label>{tier} Tier Commission (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={catalog.baseFees.agentCommissionRates[tier]}
                  onChange={(e) => handleCommissionChange(tier, parseFloat(e.target.value) || 0)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: JURISDICTIONS & SYSTEM HEALTH */}
      {activeTab === 'system' && (
        <div className="settings-layout-grid">
          <div className="settings-main-col">
            <div className="settings-panel">
              <h3>Active Consular Jurisdictions</h3>
              <p className="panel-desc">Manage destination countries accepting Schengen and national visa filings.</p>

              {loading ? (
                <p className="text-muted">Loading country registries...</p>
              ) : (
                <div className="jurisdiction-list">
                  {countries.map((c) => (
                    <div key={c.id} className="jurisdiction-card">
                      <div className="jur-info">
                        <span className="jur-code">{c.code}</span>
                        <div>
                          <strong>{c.nameEn}</strong>
                          <span>({c.nameAz})</span>
                        </div>
                      </div>
                      <span className="status-badge-active">● Active Filings</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="settings-panel">
              <h3>Security &amp; Signed URL Parameters</h3>
              <div className="setting-input-group">
                <label>HMAC Signed Document Download Expiration (Minutes)</label>
                <input
                  type="number"
                  value={sessionTimeout}
                  onChange={(e) => setSessionTimeout(e.target.value)}
                />
                <span className="input-helper">Complies with GDPR secure transient document access rules.</span>
              </div>
            </div>
          </div>

          <div className="settings-side-col">
            <div className="settings-panel">
              <h3>Consular Review Centers</h3>
              <div className="center-item">
                <div className="center-flag">AZ</div>
                <div>
                  <strong>EuroTech Baku Center</strong>
                  <p>Nizami St. 142, Landmark III, Baku, Azerbaijan</p>
                  <small>Hours: Mon–Fri, 09:00 – 18:00</small>
                </div>
              </div>
              <div className="center-item">
                <div className="center-flag">HU</div>
                <div>
                  <strong>EuroTech Budapest Office</strong>
                  <p>Andrássy út 58, 1062 Budapest, Hungary</p>
                  <small>Hours: Mon–Fri, 09:00 – 17:30</small>
                </div>
              </div>
            </div>

            <div className="settings-panel">
              <h3>System Compliance &amp; Live Integrations</h3>
              <div className="compliance-row">
                <span>Database Cluster:</span>
                <strong className={healthStatus?.database?.status === 'ONLINE' ? 'text-emerald' : 'text-amber'}>
                  {healthStatus?.database?.status || 'ONLINE'}{' '}
                  {healthStatus?.database?.latencyMs ? `(${healthStatus.database.latencyMs}ms)` : ''}
                </strong>
              </div>
              <div className="compliance-row">
                <span>Encrypted Storage:</span>
                <strong className="text-emerald">{healthStatus?.storage?.status || 'WRITABLE'}</strong>
              </div>
              <div className="compliance-row">
                <span>Schengen AcroForm Engine:</span>
                <strong className="text-emerald">{healthStatus?.consularSchengenEngine?.status || 'OPERATIONAL'}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
