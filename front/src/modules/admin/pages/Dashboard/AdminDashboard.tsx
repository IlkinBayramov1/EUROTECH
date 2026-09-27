import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '@/shared/api/services/admin.service';
import type { AdminMetrics, AdminDossier } from '@/shared/types/admin.types';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<AdminMetrics>({
    activeDossiers: 0,
    underReviewCount: 0,
    approvedThisMonth: 0,
    totalRevenue: 0,
  });
  const [recentDossiers, setRecentDossiers] = useState<AdminDossier[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [metricsRes, dossiersRes] = await Promise.allSettled([
        adminService.getMetrics(),
        adminService.getAllDossiers({ limit: 6 }),
      ]);

      if (metricsRes.status === 'fulfilled' && metricsRes.value?.data?.metrics) {
        setMetrics(metricsRes.value.data.metrics);
      }

      if (dossiersRes.status === 'fulfilled' && dossiersRes.value?.data?.dossiers) {
        setRecentDossiers(dossiersRes.value.data.dossiers);
      }
    } catch (err) {
      console.warn('Failed to load admin dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'badge-approved';
      case 'REJECTED': return 'badge-rejected';
      case 'UNDER_REVIEW': return 'badge-review';
      case 'NEEDS_CORRECTION': return 'badge-warning';
      case 'SUBMITTED_TO_CONSULATE': return 'badge-consulate';
      default: return 'badge-received';
    }
  };

  const getPortalBadge = (portalType: string) => {
    switch (portalType) {
      case 'GROUP_AGENT': return <span className="admin-tag tag-agent">Agency Group</span>;
      case 'CORPORATE': return <span className="admin-tag tag-corp">Corporate</span>;
      default: return <span className="admin-tag tag-client">B2C Citizen</span>;
    }
  };

  return (
    <div className="admin-dashboard-view">
      {/* --- DASHBOARD HEADER --- */}
      <div className="admin-dash-header">
        <div>
          <h1 className="admin-dash-title">Consular Operations Desk</h1>
          <p className="admin-dash-subtitle">
            Overview of multi-jurisdictional visa dossiers, consular decisions, and biometric appointments.
          </p>
        </div>
        <div className="admin-header-actions">
          <button className="btn-refresh" onClick={loadDashboardData} title="Refresh Live Queue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Refresh
          </button>
          <button className="btn-action-primary" onClick={() => navigate('/admin/dossiers?status=UNDER_REVIEW')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Start Review Queue
          </button>
        </div>
      </div>

      {/* --- KPI STATS CARDS --- */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card" onClick={() => navigate('/admin/dossiers')}>
          <div className="stat-card-header">
            <span className="stat-title">Active Applications</span>
            <div className="stat-icon icon-blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
          </div>
          <div className="stat-value">{loading ? '—' : metrics.activeDossiers}</div>
          <div className="stat-meta text-blue">Dossiers currently in workflow</div>
        </div>

        <div className="admin-stat-card card-urgent" onClick={() => navigate('/admin/dossiers?status=UNDER_REVIEW')}>
          <div className="stat-card-header">
            <span className="stat-title">Awaiting Officer Review</span>
            <div className="stat-icon icon-amber">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
          </div>
          <div className="stat-value">{loading ? '—' : metrics.underReviewCount}</div>
          <div className="stat-meta text-amber">Immediate consular triage required</div>
        </div>

        <div className="admin-stat-card" onClick={() => navigate('/admin/dossiers?status=APPROVED')}>
          <div className="stat-card-header">
            <span className="stat-title">Visas Issued This Month</span>
            <div className="stat-icon icon-emerald">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
          </div>
          <div className="stat-value">{loading ? '—' : metrics.approvedThisMonth}</div>
          <div className="stat-meta text-emerald">Positive consular decisions</div>
        </div>

        <div className="admin-stat-card">
          <div className="stat-card-header">
            <span className="stat-title">Processed State & Service Fees</span>
            <div className="stat-icon icon-purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" ry="2"/>
                <line x1="2" y1="10" x2="22" y2="10"/>
              </svg>
            </div>
          </div>
          <div className="stat-value">{loading ? '—' : formatCurrency(metrics.totalRevenue)}</div>
          <div className="stat-meta text-purple">Settled consular revenues</div>
        </div>
      </div>

      {/* --- QUICK ACTION TILES --- */}
      <div className="admin-triage-bar">
        <div className="triage-item" onClick={() => navigate('/admin/dossiers?status=RECEIVED')}>
          <div className="triage-dot dot-blue"></div>
          <span>New Submissions</span>
          <span className="triage-arrow">→</span>
        </div>
        <div className="triage-item" onClick={() => navigate('/admin/dossiers?status=NEEDS_CORRECTION')}>
          <div className="triage-dot dot-amber"></div>
          <span>Pending Applicant Corrections</span>
          <span className="triage-arrow">→</span>
        </div>
        <div className="triage-item" onClick={() => navigate('/admin/dossiers?status=SUBMITTED_TO_CONSULATE')}>
          <div className="triage-dot dot-purple"></div>
          <span>Transferred to Embassy</span>
          <span className="triage-arrow">→</span>
        </div>
        <div className="triage-item" onClick={() => navigate('/admin/audit-logs')}>
          <div className="triage-dot dot-slate"></div>
          <span>Security & Audit Trails</span>
          <span className="triage-arrow">→</span>
        </div>
      </div>

      {/* --- RECENT APPLICATIONS TABLE --- */}
      <div className="admin-panel">
        <div className="panel-header">
          <div className="panel-title-area">
            <h3>Recent Applications Queue</h3>
            <p>Live incoming dossiers across Individual, Tour Agency, and Corporate HR portals.</p>
          </div>
          <button className="panel-link-btn" onClick={() => navigate('/admin/dossiers')}>
            View All Dossiers ({metrics.activeDossiers}) →
          </button>
        </div>

        {loading ? (
          <div className="admin-loading-state">
            <div className="spinner"></div>
            <span>Loading live queue records...</span>
          </div>
        ) : recentDossiers.length === 0 ? (
          <div className="admin-empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p>No dossiers found in queue.</p>
          </div>
        ) : (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Dossier Code</th>
                  <th>Primary Applicant / User</th>
                  <th>Destination & Category</th>
                  <th>Channel</th>
                  <th>Total Fee</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentDossiers.map((d) => (
                  <tr key={d.id} className="table-row-hover" onClick={() => navigate(`/admin/dossiers/${d.id}`)}>
                    <td>
                      <div className="dossier-code-cell">
                        <span className="code-text">{d.dossierNumber}</span>
                        <span className="code-date">{new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </td>
                    <td>
                      <div className="user-cell">
                        <strong>{d.user?.fullName || 'Applicant'}</strong>
                        <span>{d.user?.email || '—'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="destination-cell">
                        <span className="dest-name">{d.country?.nameEn || d.country?.nameAz || 'Schengen'}</span>
                        <span className="dest-category">{d.visaCategory?.nameEn || d.visaCategory?.nameAz || 'Visa'}</span>
                      </div>
                    </td>
                    <td>{getPortalBadge(d.portalType)}</td>
                    <td>
                      <span className="fee-cell">{formatCurrency(d.totalAmount || 0)}</span>
                    </td>
                    <td>
                      <span className={`admin-badge ${getStatusBadgeClass(d.status)}`}>
                        {d.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="btn-examine"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/dossiers/${d.id}`);
                        }}
                      >
                        Examine →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
