import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EuroTechLogo } from '@/shared/components/icons/Icons';
import './SelectProfile.css';

type ProfileType = 'individual' | 'agent' | 'corporate';

export default function SelectProfile() {
  const [selectedProfile, setSelectedProfile] = useState<ProfileType | null>(null);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const navigate = useNavigate();

  const handleEnterProfile = (profile: ProfileType, targetMode?: 'login' | 'register') => {
    if (!profile) return;

    if (profile === 'individual') {
      navigate(targetMode ? `/login/individual?mode=${targetMode}` : '/login/individual');
    } else if (profile === 'agent') {
      navigate(targetMode ? `/login/agent?mode=${targetMode}` : '/login/agent');
    } else if (profile === 'corporate') {
      navigate(targetMode ? `/login/corporate?mode=${targetMode}` : '/login/corporate');
    }
  };

  const handleCardClick = (profile: ProfileType) => {
    setSelectedProfile(profile);
  };

  const handleCardDoubleClick = (profile: ProfileType) => {
    setSelectedProfile(profile);
    handleEnterProfile(profile);
  };

  const handleKeyDown = (e: React.KeyboardEvent, profile: ProfileType) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedProfile(profile);
      handleEnterProfile(profile);
    }
  };

  return (
    <div className="sp-wrapper">
      {/* Background Decorative Lighting */}
      <div className="sp-ambient-light light-1"></div>
      <div className="sp-ambient-light light-2"></div>

      {/* Top Navigation / Branding */}
      <header className="sp-header">
        <EuroTechLogo size={38} subtitle="Enterprise Immigration Platform" theme="dark" />
        <div className="sp-header-support">
          <span>Need assistance?</span>
          <button 
            type="button" 
            className="sp-support-link-btn" 
            onClick={() => setIsSupportModalOpen(true)}
          >
            Contact Support
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="sp-main">
        <div className="sp-content-container">

          <div className="sp-text-center">
            <div className="sp-kicker">EUROTECH DIGITAL ECOSYSTEM</div>
            <h1 className="sp-title">Select Application Profile</h1>
            <p className="sp-subtitle">
              Choose your profile category to access dedicated consular tools, group management, or corporate mobility portals.
            </p>
          </div>

          <div className="sp-grid">
            {/* 1. Individual Profile */}
            <div
              className={`sp-card ${selectedProfile === 'individual' ? 'sp-card-active' : ''}`}
              onClick={() => handleCardClick('individual')}
              onDoubleClick={() => handleCardDoubleClick('individual')}
              onKeyDown={(e) => handleKeyDown(e, 'individual')}
              tabIndex={0}
              role="button"
              aria-label="Individual Applicant Portal"
            >
              <div className="sp-card-badge">B2C Portal</div>
              <div className="sp-card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <h3 className="sp-card-title">Individual Applicant</h3>
              <p className="sp-card-desc">
                For personal tourist visas, student permits, work authorizations, and family residency applications.
              </p>
              <div className="sp-card-features">
                <span>✓ 5-Step Guided Wizard</span>
                <span>✓ Live Status Tracking</span>
                <span>✓ Slot Booking & Reschedule</span>
              </div>
              <div className="sp-radio">
                <div className="sp-radio-inner"></div>
              </div>
            </div>

            {/* 2. Tour Operator Profile */}
            <div
              className={`sp-card ${selectedProfile === 'agent' ? 'sp-card-active' : ''}`}
              onClick={() => handleCardClick('agent')}
              onDoubleClick={() => handleCardDoubleClick('agent')}
              onKeyDown={(e) => handleKeyDown(e, 'agent')}
              tabIndex={0}
              role="button"
              aria-label="Tour Operator Portal"
            >
              <div className="sp-card-badge">B2B Agency</div>
              <div className="sp-card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <h3 className="sp-card-title">Tour Operator</h3>
              <p className="sp-card-desc">
                For travel agencies managing bulk tourist visas, group delegations, digital wallets, and consular manifests.
              </p>
              <div className="sp-card-features">
                <span>✓ Group Dossier Submissions</span>
                <span>✓ Commission Wallet (€20/pax)</span>
                <span>✓ Embassy Manifest PDF</span>
              </div>
              <div className="sp-radio">
                <div className="sp-radio-inner"></div>
              </div>
            </div>

            {/* 3. Corporate Profile */}
            <div
              className={`sp-card ${selectedProfile === 'corporate' ? 'sp-card-active' : ''}`}
              onClick={() => handleCardClick('corporate')}
              onDoubleClick={() => handleCardDoubleClick('corporate')}
              onKeyDown={(e) => handleKeyDown(e, 'corporate')}
              tabIndex={0}
              role="button"
              aria-label="Corporate Partner Portal"
            >
              <div className="sp-card-badge">Enterprise HR</div>
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
              <p className="sp-card-desc">
                For multinational HR teams handling corporate business trips, employee registries, and delegation magic links.
              </p>
              <div className="sp-card-features">
                <span>✓ Employee Batches & Magic Links</span>
                <span>✓ Corporate Wire Invoicing</span>
                <span>✓ Visa Validity & Expiry Alerts</span>
              </div>
              <div className="sp-radio">
                <div className="sp-radio-inner"></div>
              </div>
            </div>
          </div>

          <div className="sp-actions">
            {selectedProfile === 'individual' ? (
              <div className="sp-actions-dual">
                <button
                  type="button"
                  className="sp-btn-primary"
                  onClick={() => handleEnterProfile('individual', 'register')}
                >
                  Start 5-Step Application (Register) →
                </button>
                <button
                  type="button"
                  className="sp-btn-secondary"
                  onClick={() => handleEnterProfile('individual', 'login')}
                >
                  Sign In to Existing Portal
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="sp-btn-primary"
                disabled={!selectedProfile}
                onClick={() => selectedProfile && handleEnterProfile(selectedProfile)}
              >
                {selectedProfile
                  ? `Continue as ${
                      selectedProfile === 'agent'
                        ? 'Tour Operator'
                        : 'Corporate Partner'
                    } →`
                  : 'Select a Profile to Continue'}
              </button>
            )}
            <p className="sp-actions-hint">Tip: You can double-click any card to enter directly.</p>
          </div>
        </div>
      </main>

      {/* Support & Hotline Modal */}
      {isSupportModalOpen && (
        <div className="sp-modal-overlay" onClick={() => setIsSupportModalOpen(false)}>
          <div className="sp-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="sp-modal-header">
              <h3>EuroTech Consular Support & Hotline</h3>
              <button className="sp-modal-close" onClick={() => setIsSupportModalOpen(false)}>×</button>
            </div>
            <div className="sp-modal-body">
              <div className="sp-support-item">
                <div className="sp-support-icon">📞</div>
                <div>
                  <strong>Emergency Consular Hotline:</strong>
                  <p>+994 12 400 00 00 / +36 1 455 00 00</p>
                </div>
              </div>
              <div className="sp-support-item">
                <div className="sp-support-icon">✉️</div>
                <div>
                  <strong>Direct Email Support:</strong>
                  <p><a href="mailto:support@eurotech.services">support@eurotech.services</a></p>
                </div>
              </div>
              <div className="sp-support-item">
                <div className="sp-support-icon">⏰</div>
                <div>
                  <strong>Operating Hours:</strong>
                  <p>Monday – Friday: 09:00 – 18:00 (Baku & Budapest Time)</p>
                </div>
              </div>
            </div>
            <div className="sp-modal-footer">
              <button className="sp-btn-modal-close" onClick={() => setIsSupportModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
