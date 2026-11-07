import React, { useState, useEffect } from 'react';
import type { AuditLogItem } from '@/shared/types/admin.types';
import { adminService } from '@/shared/api/services/admin.service';
import './AdminAuditLogs.css';

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res: any = await adminService.getAuditLogs({
        search: search || undefined,
        action: actionFilter !== 'ALL' ? actionFilter : undefined,
      });
      const items = res?.logs || res?.data?.logs || [];
      setLogs(items);
    } catch (err) {
      console.warn('Failed to fetch live audit logs from backend:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  return (
    <div className="admin-audit-logs-view">
      <div className="audit-header">
        <div>
          <h1 className="audit-title">Security & Consular Audit Trails</h1>
          <p className="audit-subtitle">
            Immutable, SOC2 and GDPR Article 30 compliant access and verification logs.
          </p>
        </div>
        <div className="audit-badge-pill">
          <span className="dot-green"></span>
          <span>Tamper-Resistant Logging Active</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: 1 }}>
          <input
            type="text"
            placeholder="Search by action, officer name, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              fontSize: '0.9rem',
            }}
          />
          <button type="submit" style={{ padding: '10px 18px', borderRadius: '8px', background: '#2563EB', color: '#FFF', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            Filter
          </button>
        </form>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid #CBD5E1',
            fontSize: '0.9rem',
            background: '#FFF',
          }}
        >
          <option value="ALL">All Event Actions</option>
          <option value="CONSULAR_DECISION_ISSUED">Consular Decisions</option>
          <option value="DOCUMENT_REVIEWED">Document Reviews</option>
          <option value="DOSSIER_SUBMITTED">Dossier Submissions</option>
          <option value="BATCH_PAID">Batch Payments</option>
          <option value="BANK_SLIP_REVIEWED">Bank Slip Reviews</option>
          <option value="WALLET_TOPUP">Wallet Top-Ups</option>
        </select>
        <button
          onClick={fetchLogs}
          style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFF', cursor: 'pointer' }}
          title="Reload logs"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="audit-table-panel">
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Event Action</th>
                <th>Operator / Officer</th>
                <th>IP / Terminal Location</th>
                <th>Event Metadata</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <span className="action-tag">{log.action}</span>
                  </td>
                  <td>
                    <div className="officer-cell">
                      <strong>{log.user?.fullName || 'System'}</strong>
                      <span>{log.user?.email || '—'}</span>
                    </div>
                  </td>
                  <td>
                    <span className="ip-text">{log.ipAddress}</span>
                  </td>
                  <td>
                    <div className="meta-json-cell">
                      <code>{JSON.stringify(log.details)}</code>
                    </div>
                  </td>
                  <td>
                    <span className="time-text">
                      {new Date(log.createdAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
