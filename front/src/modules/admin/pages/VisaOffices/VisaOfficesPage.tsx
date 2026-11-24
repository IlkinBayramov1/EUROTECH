import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { vcmsApi } from '../../api/vcmsApi';
import '../../styles/vcms.css';

export default function VisaOfficesPage() {
  const navigate = useNavigate();
  const [visaCentres, setVisaCentres] = useState<any[]>([]);
  const [embassies, setEmbassies] = useState<any[]>([]);
  const [applicationLocations, setApplicationLocations] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'VAC' | 'EMBASSY' | 'LOCATIONS'>('VAC');

  const loadData = async () => {
    try {
      const res = await vcmsApi.listVisaOffices();
      setVisaCentres(res.data?.visaCentres || []);
      setEmbassies(res.data?.embassies || []);
      setApplicationLocations(res.data?.applicationLocations || []);
    } catch (_) {}
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="vcms-page">
      <div className="vcms-header">
        <div className="vcms-title-group">
          <h1>Visa Application Centres & Embassies</h1>
          <p>
            Separate management for Visa Application Centres (Capago, VFS Global, Visametric) and Diplomatic Embassies,
            linked to both destination country and applicant location country (e.g. Azerbaijan).
          </p>
        </div>
      </div>

      <div className="vcms-tabs">
        <button className={`vcms-tab ${activeTab === 'VAC' ? 'active' : ''}`} onClick={() => setActiveTab('VAC')}>
          Visa Application Centres ({visaCentres.length})
        </button>
        <button
          className={`vcms-tab ${activeTab === 'EMBASSY' ? 'active' : ''}`}
          onClick={() => setActiveTab('EMBASSY')}
        >
          Embassies ({embassies.length})
        </button>
        <button
          className={`vcms-tab ${activeTab === 'LOCATIONS' ? 'active' : ''}`}
          onClick={() => setActiveTab('LOCATIONS')}
        >
          Destination × Applicant Location Matrix ({applicationLocations.length})
        </button>
      </div>

      {activeTab === 'VAC' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 16 }}>
          {visaCentres.map((v) => (
            <div key={v.id} className="vcms-card" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <strong>
                  {v.country?.nameEn} ({v.country?.code}) — Visa Application Centre
                </strong>
                <span className={`vcms-badge ${String(v.status).toLowerCase()}`}>{v.status}</span>
              </div>
              <div style={{ fontSize: '0.84rem', lineHeight: 1.6, color: '#334155' }}>
                <div>
                  <strong>Provider:</strong> {v.providerName}
                </div>
                <div>
                  <strong>Address:</strong> {v.address}
                </div>
                <div>
                  <strong>Location:</strong> {v.city}, {v.locationCountryName} ({v.locationCountryCode})
                </div>
                <div>
                  <strong>Telephone:</strong> {v.telephone || '—'}
                </div>
                <div>
                  <strong>Email:</strong> {v.email || '—'}
                </div>
                {v.officialWebsite && (
                  <div>
                    <strong>Official Website:</strong>{' '}
                    <a href={v.officialWebsite} target="_blank" rel="noreferrer">
                      {v.officialWebsite}
                    </a>
                  </div>
                )}
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button
                  className="vcms-btn sm secondary"
                  onClick={() => navigate(`/admin/destinations/${v.countryId}`)}
                >
                  Edit in {v.country?.nameEn} →
                </button>
                <button
                  className="vcms-btn sm accent"
                  onClick={() => navigate(`/admin/appointments?countryId=${v.countryId}`)}
                >
                  Manage Appointments
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'EMBASSY' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 16 }}>
          {embassies.map((e) => (
            <div key={e.id} className="vcms-card" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <strong>
                  {e.country?.nameEn} ({e.country?.code}) — Embassy
                </strong>
                <span className={`vcms-badge ${String(e.status).toLowerCase()}`}>{e.status}</span>
              </div>
              <div style={{ fontSize: '0.84rem', lineHeight: 1.6, color: '#334155' }}>
                <div>
                  <strong>Responsible Authority:</strong> {e.responsibleAuthority}
                </div>
                <div>
                  <strong>Address:</strong> {e.address}
                </div>
                <div>
                  <strong>Location:</strong> {e.city}, {e.locationCountryName} ({e.locationCountryCode})
                </div>
                <div>
                  <strong>Telephone:</strong> {e.telephone || '—'}
                </div>
                <div>
                  <strong>Email:</strong> {e.email || '—'}
                </div>
                {e.officialWebsite && (
                  <div>
                    <strong>Official Website:</strong>{' '}
                    <a href={e.officialWebsite} target="_blank" rel="noreferrer">
                      {e.officialWebsite}
                    </a>
                  </div>
                )}
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button
                  className="vcms-btn sm secondary"
                  onClick={() => navigate(`/admin/destinations/${e.countryId}`)}
                >
                  Edit in {e.country?.nameEn} →
                </button>
                <button
                  className="vcms-btn sm accent"
                  onClick={() => navigate(`/admin/appointments?countryId=${e.countryId}`)}
                >
                  Manage Embassy Appointments
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'LOCATIONS' && (
        <div className="vcms-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="vcms-table">
            <thead>
              <tr>
                <th>Destination Country</th>
                <th>Applicant Location</th>
                <th>Assigned Visa Application Centre</th>
                <th>Assigned Embassy</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {applicationLocations.map((loc) => (
                <tr key={loc.id}>
                  <td>
                    <strong>
                      {loc.destinationCountry?.flagEmoji} {loc.destinationCountry?.nameEn}
                    </strong>
                  </td>
                  <td>
                    <span className="vcms-badge info">
                      {loc.applicantCountryName} ({loc.applicantCountryCode})
                    </span>
                  </td>
                  <td>
                    {loc.visaApplicationCentre
                      ? `${loc.visaApplicationCentre.providerName} (${loc.visaApplicationCentre.city})`
                      : '—'}
                  </td>
                  <td>{loc.embassy ? loc.embassy.responsibleAuthority : '—'}</td>
                  <td>
                    <span className="vcms-badge active">{loc.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
