import React from 'react';

export default function Step2GroupServices({ data, updateData }: any) {
    const s = data.services;

    const handleSelectPackage = (pkg: 'standard' | 'premium' | 'vip') => {
        updateData('services', { activePackage: pkg });
    };

    return (
        <div className="step-content fade-in">
            <h1 className="step-title">Packages & Services</h1>
            <p className="step-subtitle">Select a B2B service tier in EUR. This package will be applied to <strong>all travelers</strong> added in the next step (in addition to €145 base consular & processing fee per person).</p>

            <div className="packages-grid">
                <div className={`package-card basic ${s.activePackage === 'standard' ? 'active' : ''}`} onClick={() => handleSelectPackage('standard')}>
                    <div className="package-header">
                        <h3>Standard</h3>
                        <div className="package-price">€ 0 <span>/ person</span></div>
                        <p>Essential consular & biometrics processing.</p>
                    </div>
                    <div className="package-action">
                        <button type="button" className={`btn-package ${s.activePackage === 'standard' ? 'selected' : ''}`}>
                            {s.activePackage === 'standard' ? 'Current Selection' : 'Select Standard'}
                        </button>
                    </div>
                </div>

                <div className={`package-card premium ${s.activePackage === 'premium' ? 'active' : ''}`} onClick={() => handleSelectPackage('premium')}>
                    <div className="package-badge">Agent Recommended</div>
                    <div className="package-header">
                        <h3>Premium Bundle</h3>
                        <div className="package-price">+€ 126 <span>/ person</span></div>
                        <p>File prep, form assist, photo & Schengen insurance.</p>
                    </div>
                    <div className="package-action">
                        <button type="button" className={`btn-package ${s.activePackage === 'premium' ? 'selected' : ''}`}>
                            {s.activePackage === 'premium' ? 'Current Selection' : 'Select Premium'}
                        </button>
                    </div>
                </div>

                <div className={`package-card vip ${s.activePackage === 'vip' ? 'active' : ''}`} onClick={() => handleSelectPackage('vip')}>
                    <div className="package-badge luxury">VIP Service</div>
                    <div className="package-header">
                        <h3>VIP Platinum</h3>
                        <div className="package-price">+€ 257 <span>/ person</span></div>
                        <p>Includes Premium Lounge, itinerary & courier return.</p>
                    </div>
                    <div className="package-action">
                        <button type="button" className={`btn-package ${s.activePackage === 'vip' ? 'selected' : ''}`}>
                            {s.activePackage === 'vip' ? 'Current Selection' : 'Select VIP'}
                        </button>
                    </div>
                </div>
            </div>
            
            <div className="info-alert">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <span><strong>Note:</strong> The B2B group invoice (EUR) and your partner commission will be calculated automatically based on the number of travelers added in Step 3.</span>
            </div>
        </div>
    );
}
