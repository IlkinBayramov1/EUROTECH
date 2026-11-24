import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import '../../styles/vcms.css';

export default function DestinationsHubLayout() {
  const location = useLocation();
  const path = location.pathname;

  const isQuestionPool = path.startsWith('/admin/destinations/question-pool');
  const isDocumentPool = path.startsWith('/admin/destinations/document-pool');
  const isVisaOffices = path.startsWith('/admin/destinations/visa-offices');
  const isCountries = !isQuestionPool && !isDocumentPool && !isVisaOffices;

  return (
    <div className="vcms-hub-shell">
      <div className="vcms-hub-bar">
        <div className="vcms-hub-bar-inner">
          <nav className="vcms-hub-nav" aria-label="Visa Configuration Sections">
            <NavLink
              to="/admin/destinations"
              className={() => `vcms-hub-link ${isCountries ? 'active' : ''}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              Countries
            </NavLink>

            <NavLink
              to="/admin/destinations/question-pool"
              className={({ isActive }) => `vcms-hub-link ${isActive ? 'active' : ''}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              Question Pool
            </NavLink>

            <NavLink
              to="/admin/destinations/document-pool"
              className={({ isActive }) => `vcms-hub-link ${isActive ? 'active' : ''}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Document Pool
            </NavLink>

            <NavLink
              to="/admin/destinations/visa-offices"
              className={({ isActive }) => `vcms-hub-link ${isActive ? 'active' : ''}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18" />
                <path d="M5 21V7l7-4 7 4v14" />
                <path d="M9 9h1" />
                <path d="M14 9h1" />
                <path d="M9 13h1" />
                <path d="M14 13h1" />
              </svg>
              Visa Centers & Embassies
            </NavLink>
          </nav>

          <span className="vcms-badge info">Visa Configuration Hub</span>
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <Outlet />
      </div>
    </div>
  );
}
