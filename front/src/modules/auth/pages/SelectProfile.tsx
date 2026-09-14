import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/context/AuthContext';
import { EuroTechLogo } from '@/shared/components/icons/Icons';
import './SelectProfile.css';

type ProfileType = 'individual' | 'agent' | 'corporate' | null;

export default function SelectProfile() {
  const [selectedProfile, setSelectedProfile] = useState<ProfileType>(null);
  const navigate = useNavigate();
  const { setRoleOverride } = useAuth();

  const handleContinue = () => {
    if (!selectedProfile) return;

    if (selectedProfile === 'individual') {
      setRoleOverride('INDIVIDUAL');
      navigate('/login/individual');
    }
    if (selectedProfile === 'agent') {
      setRoleOverride('AGENT');
      navigate('/login/agent');
    }
    if (selectedProfile === 'corporate') {
      setRoleOverride('CORPORATE');
      navigate('/login/corporate');
    }
  };

  return (
    <div className="sp-wrapper">
      {/* Top Navigation / Branding */}
      <header className="sp-header">
        <EuroTechLogo size={36} subtitle="Immigration Portal" />
        <div className="sp-header-support">
          <span>Need assistance?</span>
          <a href="mailto:support@eurotech.services">Contact Support</a>
        </div>
      </header>

      {/* Main Content */}
      <main className="sp-main">
        <div className="sp-content-container">
          <div className="sp-text-center">
            <h1 className="sp-title">Select Application Profile</h1>
            <p className="sp-subtitle">
              Please select the category that best describes your application purpose to access the correct portal.
            </p>
          </div>

          <div className="sp-grid">
            {/* 1. Individual Profile */}
            <div
              className={`sp-card ${selectedProfile === 'individual' ? 'sp-card-active' : ''}`}
              onClick={() => setSelectedProfile('individual')}
            >
              <div className="sp-card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <h3 className="sp-card-title">Individual Applicant</h3>
              <p className="sp-card-desc">For personal visas, student permits, and family residency applications.</p>
              <div className="sp-radio">
                <div className="sp-radio-inner"></div>
              </div>
            </div>

            {/* 2. Tour Operator Profile */}
            <div
              className={`sp-card ${selectedProfile === 'agent' ? 'sp-card-active' : ''}`}
              onClick={() => setSelectedProfile('agent')}
            >
              <div className="sp-card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <h3 className="sp-card-title">Tour Operator</h3>
              <p className="sp-card-desc">For processing bulk tourist visas, group applications, and managing client rosters.</p>
              <div className="sp-radio">
                <div className="sp-radio-inner"></div>
              </div>
            </div>

            {/* 3. Corporate Profile */}
            <div
              className={`sp-card ${selectedProfile === 'corporate' ? 'sp-card-active' : ''}`}
              onClick={() => setSelectedProfile('corporate')}
            >
              <div className="sp-card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
                  <path d="M9 22v-4h6v4"></path>
                  <path d="M8 6h.01"></path>
                  <path d="M16 6h.01"></path>
                  <path d="M12 6h.01"></path>
                  <path d="M12 10h.01"></path>
                  <path d="M12 14h.01"></path>
                  <path d="M16 10h.01"></path>
                  <path d="M16 14h.01"></path>
                  <path d="M8 10h.01"></path>
                  <path d="M8 14h.01"></path>
                </svg>
              </div>
              <h3 className="sp-card-title">Corporate Partner</h3>
              <p className="sp-card-desc">For corporate mobility, ICT transfers, employee business visas, and SaaS management.</p>
              <div className="sp-radio">
                <div className="sp-radio-inner"></div>
              </div>
            </div>
          </div>

          <div className="sp-actions">
            <button
              className="sp-btn-primary"
              disabled={!selectedProfile}
              onClick={handleContinue}
            >
              Continue to Portal
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
