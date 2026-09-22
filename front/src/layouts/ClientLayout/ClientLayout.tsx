import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/context/AuthContext';
import { ShieldIcon, EuroTechLogo } from '@/shared/components/icons/Icons';
import { dossierService } from '@/shared/api/services';
import './ClientLayout.css';

export default function ClientLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const displayName = user?.fullName || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email || 'Müştəri');
  const userInitials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n: string) => n[0].toUpperCase())
    .join('') || 'U';

  // --- Interactive Search State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // --- Notifications Popover State ---
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; desc: string; time: string; unread: boolean }>>([]);

  useEffect(() => {
    let isMounted = true;
    dossierService.getMyDossiers()
      .then(res => {
        if (!isMounted) return;
        const dossiers = res.data?.dossiers || [];
        if (dossiers.length > 0) {
          const d = dossiers[0];
          const appt = d.appointments?.find((a: any) => a.status === 'CONFIRMED') || d.appointments?.[0];
          const notifs: any[] = [];
          if (appt) {
            const dateStr = appt.timeSlot?.date ? new Date(appt.timeSlot.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Upcoming';
            const timeStr = appt.timeSlot?.startTime || '10:30 AM';
            notifs.push({
              id: 'n-appt',
              title: `Biometrics Scheduled (${appt.status || 'CONFIRMED'})`,
              desc: `Consular slot on ${dateStr} at ${timeStr} (${appt.timeSlot?.location || 'EuroTech Center'}).`,
              time: 'Active',
              unread: true
            });
          }
          if (d.documents && d.documents.length > 0) {
            const latestDoc = d.documents[0];
            notifs.push({
              id: 'n-doc',
              title: `Document ${latestDoc.status || 'UPLOADED'}`,
              desc: `File "${latestDoc.fileName || 'document'}" registered in consular vault.`,
              time: 'Recent',
              unread: latestDoc.status === 'PENDING'
            });
          }
          if (d.dossierNumber) {
            notifs.push({
              id: 'n-dos',
              title: `Dossier ${d.status ? d.status.replace(/_/g, ' ') : 'Active'}`,
              desc: `Schengen Application Ref: ${d.dossierNumber} • ${d.country?.nameEn || 'Schengen'}.`,
              time: 'Verified',
              unread: false
            });
          }
          if (notifs.length > 0) setNotifications(notifs);
        } else {
          setNotifications([
            { id: 'n-welcome', title: 'Welcome to EuroTech Portal', desc: 'Start your European visa application to begin consular processing.', time: 'Now', unread: true }
          ]);
        }
      })
      .catch(() => {
        if (isMounted) {
          setNotifications([
            { id: 'n-welcome', title: 'EuroTech Consular Portal', desc: 'Secure European visa and mobility services active.', time: 'Now', unread: false }
          ]);
        }
      });

    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchablePages = [
    { title: 'Dashboard Overview', path: '/client', category: 'General' },
    { title: 'Documents Repository & Uploads', path: '/client/documents', category: 'Documents' },
    { title: 'Schengen Visa Application Anket', path: '/client/application', category: 'Application' },
    { title: 'Consular Appointment & Biometrics', path: '/client/appointment', category: 'Appointments' },
    { title: 'Buy Value-Added Services & VIP Lounge', path: '/client/services', category: 'Services' },
    { title: 'Live Consular Status Tracking', path: '/client/tracking', category: 'Tracking' },
    { title: 'GDPR Privacy & Data Export', path: '/client/privacy', category: 'Privacy & Security' },
  ];

  const filteredPages = searchQuery.trim() === ''
    ? []
    : searchablePages.filter(p =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase())
      );

  const handleSelectSearchItem = (path: string) => {
    navigate(path);
    setSearchQuery('');
    setIsSearchOpen(false);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filteredPages.length > 0) {
      handleSelectSearchItem(filteredPages[0].path);
    }
  };

  const unreadCount = notifications.filter(n => n.unread).length;

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  return (
    <div className="client-layout">
      {/* --- EXECUTIVE DARK SIDEBAR --- */}
      <aside className="client-sidebar">
        <div className="sidebar-brand" style={{ cursor: 'pointer' }} onClick={() => navigate('/client')}>
          <EuroTechLogo size={32} subtitle="Client Portal" theme="light" />
        </div>

        <nav className="sidebar-nav">
          <p className="nav-heading">MAIN MENU</p>

          <NavLink to="/client" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
            </span>
            Dashboard
          </NavLink>

          <NavLink to="/client/documents" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </span>
            Documents
          </NavLink>

          <NavLink to="/client/application" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </span>
            Applications
          </NavLink>

          <NavLink to="/client/appointment" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </span>
            Appointment
          </NavLink>

          <NavLink to="/client/services" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            </span>
            Buy Services
          </NavLink>

          <NavLink to="/client/tracking" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
            </span>
            Status Tracking
          </NavLink>

          <p className="nav-heading" style={{ marginTop: '24px' }}>COMPLIANCE & LEGAL</p>

          <NavLink to="/client/privacy" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">
              <ShieldIcon size={18} />
            </span>
            GDPR Privacy Center
          </NavLink>
        </nav>

        {/* Client User Profile Footer */}
        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">
              {userInitials}
            </div>
            <div className="user-info">
              <h4>{displayName}</h4>
              <span>{user?.email || 'Individual Applicant'}</span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Sign Out">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <div className="client-main">
        <header className="client-topbar">
          {/* Interactive Search Bar with Dropdown */}
          <div className="topbar-search-container" ref={searchRef}>
            <div className="topbar-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                type="text"
                placeholder="Search applications, dossier, appointments, services..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                onKeyDown={handleSearchKeyDown}
              />
              {searchQuery && (
                <button
                  className="search-clear-btn"
                  onClick={() => { setSearchQuery(''); setIsSearchOpen(false); }}
                  type="button"
                >
                  ✕
                </button>
              )}
            </div>

            {isSearchOpen && searchQuery.trim() !== '' && (
              <div className="search-dropdown-menu">
                {filteredPages.length === 0 ? (
                  <div className="search-no-results">No matching portal pages or services found.</div>
                ) : (
                  filteredPages.map((item) => (
                    <div
                      key={item.path}
                      className="search-result-item"
                      onClick={() => handleSelectSearchItem(item.path)}
                    >
                      <span className="search-res-cat">{item.category}</span>
                      <strong className="search-res-title">{item.title}</strong>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="topbar-actions">
            {/* Notifications Popover */}
            <div className="notif-wrapper" ref={notifRef}>
              <button
                className="topbar-icon-btn badge-trigger"
                title="Notifications"
                type="button"
                onClick={() => setIsNotificationsOpen(prev => !prev)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                {unreadCount > 0 && <span className="notification-dot"></span>}
              </button>

              {isNotificationsOpen && (
                <div className="notif-dropdown-menu fade-in">
                  <div className="notif-header">
                    <h4>Notifications ({unreadCount} new)</h4>
                    {unreadCount > 0 && (
                      <button className="btn-mark-read" onClick={handleMarkAllRead}>
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="notif-list">
                    {notifications.map((n) => (
                      <div key={n.id} className={`notif-item ${n.unread ? 'unread' : ''}`}>
                        <div className="notif-content">
                          <strong>{n.title}</strong>
                          <p>{n.desc}</p>
                          <span className="notif-time">{n.time}</span>
                        </div>
                        {n.unread && <span className="notif-unread-dot"></span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Account & Privacy Settings */}
            <button
              className="topbar-icon-btn"
              onClick={() => navigate('/client/privacy')}
              title="Account & Privacy Settings"
              type="button"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06-.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
          </div>
        </header>

        <main className="client-page-outlet">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

