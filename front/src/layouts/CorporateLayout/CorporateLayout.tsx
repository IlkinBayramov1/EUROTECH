import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/context/AuthContext';
import { EuroTechLogo } from '@/shared/components/icons/Icons';
import './CorporateLayout.css';

export default function CorporateLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="corporate-layout">
      {/* --- CORPORATE SIDEBAR --- */}
      <aside className="corporate-sidebar">
        <div className="corporate-brand" style={{ cursor: 'pointer' }} onClick={() => navigate('/corporate')}>
          <EuroTechLogo size={32} subtitle="Corporate Mobility" />
        </div>

        <nav className="corp-nav">
          <p className="nav-label">WORKSPACES</p>

          <NavLink to="/corporate" end className={({ isActive }) => `corp-nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
            </span>
            Dashboard
          </NavLink>

          <NavLink to="/corporate/batches" className={({ isActive }) => `corp-nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </span>
            Visa Batches
          </NavLink>

          <NavLink to="/corporate/employees" className={({ isActive }) => `corp-nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            </span>
            Employee Registry
          </NavLink>

          <NavLink to="/corporate/appointments" className={({ isActive }) => `corp-nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </span>
            Consular Schedule
          </NavLink>

          <p className="nav-label" style={{ marginTop: '16px' }}>BILLING & WALLET</p>

          <NavLink to="/corporate/finance" className={({ isActive }) => `corp-nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            </span>
            Prepaid Wallet & Invoices
          </NavLink>
        </nav>

        <div className="corp-sidebar-footer">
          <div className="corp-profile">
            <div className="corp-avatar">
              {user?.companyName ? user.companyName[0].toUpperCase() : 'C'}
            </div>
            <div className="corp-info">
              <h4>{user?.companyName || 'Corp Tech Azerbaijan MMC'}</h4>
              <span>Corporate HR</span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Sign Out">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </aside>

      {/* --- CORPORATE MAIN CONTENT --- */}
      <div className="corporate-main">
        <header className="corporate-topbar">
          <div className="topbar-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" placeholder="Search batch ID, employee name or department..." />
          </div>

          <div className="topbar-actions">
            <button className="btn-create-batch" onClick={() => navigate('/corporate/create-batch')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Employee Batch
            </button>
            <div className="action-item" onClick={() => navigate('/')} title="Switch Portal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </div>
          </div>
        </header>

        <main className="corporate-page-outlet">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
