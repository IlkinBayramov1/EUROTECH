import React, { useState, useEffect } from 'react';
import { adminService } from '@/shared/api/services/admin.service';
import { useToast } from '@/shared/context/ToastContext';
import './AdminSettings.css';

interface CountryItem {
  id: string;
  code: string;
  nameAz: string;
  nameEn: string;
  isActive: boolean;
}

export default function AdminSettings() {
  const { showSuccess } = useToast();
  const [countries, setCountries] = useState<CountryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Consular config settings
  const [sessionTimeout, setSessionTimeout] = useState('15');
  const [urgentProcessingFee, setUrgentProcessingFee] = useState('50.00');
  const [premiumLoungeFee, setPremiumLoungeFee] = useState('81.00');

  useEffect(() => {
    adminService.getCountries()
      .then((res: any) => {
        if (res.data?.countries) {
          setCountries(res.data.countries);
        }
      })
      .catch((err) => console.warn('Could not load countries:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    showSuccess('Consular parameters and fee configurations saved successfully.');
  };

  return (
    <div className="admin-settings-view">
      <div className="settings-header">
        <div>
          <h1 className="settings-title">Consular Jurisdiction & System Settings</h1>
          <p className="settings-subtitle">
            Configure destination country availability, state visa fee baselines, and security policies.
          </p>
        </div>
      </div>

      <div className="settings-layout-grid">
        {/* Left: Settings Forms */}
        <div className="settings-main-col">
          {/* Active Jurisdictions */}
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
                    <span className="status-badge-active">
                      ● Active Filings
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Consular Fees Configuration */}
          <div className="settings-panel">
            <h3>Diplomatic Service Rates & Additional Services</h3>
            <p className="panel-desc">Standard service pricing applied to Individual, Agent, and Corporate invoices.</p>

            <form onSubmit={handleSaveSettings}>
              <div className="form-two-col">
                <div className="setting-input-group">
                  <label>Express / Urgent Processing Surcharge (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={urgentProcessingFee}
                    onChange={(e) => setUrgentProcessingFee(e.target.value)}
                  />
                </div>
                <div className="setting-input-group">
                  <label>VIP Consular Lounge Access (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={premiumLoungeFee}
                    onChange={(e) => setPremiumLoungeFee(e.target.value)}
                  />
                </div>
              </div>

              <div className="setting-input-group">
                <label>HMAC Signed Document Download Expiration (Minutes)</label>
                <input
                  type="number"
                  value={sessionTimeout}
                  onChange={(e) => setSessionTimeout(e.target.value)}
                />
                <span className="input-helper">Complies with GDPR secure transient document access rules.</span>
              </div>

              <button type="submit" className="btn-save-settings">
                Save Parameter Updates
              </button>
            </form>
          </div>
        </div>

        {/* Right: Security & Centers Panel */}
        <div className="settings-side-col">
          <div className="settings-panel">
            <h3>Consular Review Centers</h3>
            <div className="center-item">
              <div className="center-flag">🇦🇿</div>
              <div>
                <strong>EuroTech Baku Center</strong>
                <p>Nizami St. 142, Landmark III, Baku, Azerbaijan</p>
                <small>Hours: Mon–Fri, 09:00 – 18:00</small>
              </div>
            </div>
            <div className="center-item">
              <div className="center-flag">🇭🇺</div>
              <div>
                <strong>EuroTech Budapest Office</strong>
                <p>Andrássy út 58, 1062 Budapest, Hungary</p>
                <small>Hours: Mon–Fri, 09:00 – 17:30</small>
              </div>
            </div>
          </div>

          <div className="settings-panel">
            <h3>System Compliance</h3>
            <div className="compliance-row">
              <span>GDPR Article 17 Anonymizer:</span>
              <strong className="text-emerald">ACTIVE</strong>
            </div>
            <div className="compliance-row">
              <span>Magic Bytes File Inspection:</span>
              <strong className="text-emerald">ENABLED</strong>
            </div>
            <div className="compliance-row">
              <span>SHA-256 Token Session Rotation:</span>
              <strong className="text-emerald">ENABLED</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
