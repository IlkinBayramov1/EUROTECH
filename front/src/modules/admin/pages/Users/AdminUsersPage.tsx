import React, { useEffect, useState } from 'react';
import { vcmsApi } from '../../api/vcmsApi';
import '../../styles/vcms.css';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    role: 'OPERATOR',
    phone: '',
    companyName: '',
    password: '',
  });

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadUsers = async () => {
    try {
      const res = await vcmsApi.listUsers({ role: roleFilter, search });
      setUsers(res.data?.users || []);
    } catch (err: any) {
      notify(err.message || 'Failed to load users');
    }
  };

  useEffect(() => {
    loadUsers();
  }, [roleFilter, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await vcmsApi.createUser(form);
      setShowCreateModal(false);
      setForm({ fullName: '', email: '', role: 'OPERATOR', phone: '', companyName: '', password: '' });
      await loadUsers();
      notify('User account created successfully');
    } catch (err: any) {
      notify(err.message || 'Failed to create user');
    }
  };

  return (
    <div className="vcms-page">
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 2000,
            padding: '12px 18px',
            borderRadius: 12,
            background: '#0f172a',
            color: '#fff',
            fontWeight: 600,
          }}
        >
          {toast}
        </div>
      )}

      <div className="vcms-header">
        <div className="vcms-title-group">
          <h1>
            User Management
            <span className="vcms-badge info">{users.length} Users</span>
          </h1>
          <p>
            Manage Admin & Consular Officers, B2B Travel Agents, Corporate HR Accounts, and Individual Applicants.
          </p>
        </div>
        <button className="vcms-btn accent" onClick={() => setShowCreateModal(true)}>
          + Create Staff / Portal User
        </button>
      </div>

      <div className="vcms-toolbar">
        <div className="vcms-filters">
          <input
            className="vcms-input"
            style={{ minWidth: 260 }}
            placeholder="Search by full name, email, username, or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="vcms-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="ALL">All Roles</option>
            <option value="ADMIN">ADMIN (Executive Admin)</option>
            <option value="MANAGER">MANAGER (Consular Manager)</option>
            <option value="OPERATOR">OPERATOR (Visa Officer)</option>
            <option value="AGENT_TUR_OPERATOR">AGENT_TUR_OPERATOR (Travel Agent)</option>
            <option value="CORPORATE_HR">CORPORATE_HR (Corporate Mobility)</option>
            <option value="INDIVIDUAL">INDIVIDUAL (Applicant)</option>
          </select>
        </div>
      </div>

      <div className="vcms-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="vcms-table">
          <thead>
            <tr>
              <th>Full Name & Company</th>
              <th>Email & Phone</th>
              <th>Role (RBAC)</th>
              <th>Status</th>
              <th>Activity</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.fullName}</strong>
                  {u.companyName && <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{u.companyName}</div>}
                </td>
                <td>
                  <div>{u.email}</div>
                  <div style={{ fontSize: '0.77rem', color: '#64748b' }}>{u.phone || '—'}</div>
                </td>
                <td>
                  <select
                    className="vcms-select"
                    style={{ padding: '4px 8px', fontSize: '0.79rem' }}
                    value={u.role}
                    onChange={async (e) => {
                      await vcmsApi.updateUser(u.id, { role: e.target.value });
                      await loadUsers();
                      notify(`Updated ${u.fullName} role to ${e.target.value}`);
                    }}
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="MANAGER">MANAGER</option>
                    <option value="OPERATOR">OPERATOR</option>
                    <option value="AGENT_TUR_OPERATOR">AGENT_TUR_OPERATOR</option>
                    <option value="CORPORATE_HR">CORPORATE_HR</option>
                    <option value="INDIVIDUAL">INDIVIDUAL</option>
                  </select>
                </td>
                <td>
                  <select
                    className="vcms-select"
                    style={{ padding: '4px 8px', fontSize: '0.79rem' }}
                    value={u.accountStatus}
                    onChange={async (e) => {
                      await vcmsApi.updateUser(u.id, { accountStatus: e.target.value });
                      await loadUsers();
                      notify(`Updated ${u.fullName} status to ${e.target.value}`);
                    }}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                    <option value="PENDING_PASSWORD">PENDING_PASSWORD</option>
                  </select>
                </td>
                <td>
                  <span className="vcms-badge info">{u._count?.dossiers || 0} Dossiers</span>{' '}
                  <span className="vcms-badge code">{u._count?.appointments || 0} Bookings</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <div className="vcms-modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="vcms-modal" onClick={(e) => e.stopPropagation()}>
            <div className="vcms-modal-header">
              <h2>+ Create Staff or Portal User</h2>
              <button className="vcms-btn sm secondary" onClick={() => setShowCreateModal(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="vcms-form-grid">
                <div className="vcms-field">
                  <label>Full Name *</label>
                  <input
                    className="vcms-input"
                    required
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  />
                </div>
                <div className="vcms-field">
                  <label>Email *</label>
                  <input
                    type="email"
                    className="vcms-input"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="vcms-field">
                  <label>Role *</label>
                  <select
                    className="vcms-select"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="MANAGER">MANAGER</option>
                    <option value="OPERATOR">OPERATOR</option>
                    <option value="AGENT_TUR_OPERATOR">AGENT_TUR_OPERATOR</option>
                    <option value="CORPORATE_HR">CORPORATE_HR</option>
                    <option value="INDIVIDUAL">INDIVIDUAL</option>
                  </select>
                </div>
                <div className="vcms-field">
                  <label>Password</label>
                  <input
                    type="password"
                    className="vcms-input"
                    placeholder="Default: EuroTech2026!"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="vcms-btn secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="vcms-btn accent">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
