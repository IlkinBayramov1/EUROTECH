import React from 'react';

export default function Step2GroupServices({ data, updateData }: any) {
    const s = data.services;

    const handleSelectPackage = (pkg: 'standard' | 'premium' | 'vip') => {
        updateData('services', { activePackage: pkg });
    };

    return (
        <div className="step-content fade-in">
            <h1 className="step-title">Packages & Services</h1>
            <p className="step-subtitle">Select a corporate mobility tier. This package will be applied to <strong>all employees</strong> added in the next step.</p>

            <div className="packages-grid">
                <div className={`package-card basic ${s.activePackage === 'standard' ? 'active' : ''}`} onClick={() => handleSelectPackage('standard')}>
                    <div className="package-header">
                        <h3>Standard</h3>
                        <div className="package-price">€ 0 <span>/ employee</span></div>
                        <p>Essential corporate consular processing (€145 base fee / employee).</p>
                    </div>
                    <div className="package-action">
                        <button type="button" className={`btn-package ${s.activePackage === 'standard' ? 'selected' : ''}`}>
                            {s.activePackage === 'standard' ? 'Current Selection' : 'Select Standard'}
                        </button>
                    </div>
                </div>

                <div className={`package-card premium ${s.activePackage === 'premium' ? 'active' : ''}`} onClick={() => handleSelectPackage('premium')}>
                    <div className="package-badge">HR Recommended</div>
                    <div className="package-header">
                        <h3>Premium Business Bundle</h3>
                        <div className="package-price">€ 126 <span>/ employee</span></div>
                        <p>Full file preparation, 37-point form assist, biometric photo & €30k insurance.</p>
                    </div>
                    <div className="package-action">
                        <button type="button" className={`btn-package ${s.activePackage === 'premium' ? 'selected' : ''}`}>
                            {s.activePackage === 'premium' ? 'Current Selection' : 'Select Premium'}
                        </button>
                    </div>
                </div>

                <div className={`package-card vip ${s.activePackage === 'vip' ? 'active' : ''}`} onClick={() => handleSelectPackage('vip')}>
                    <div className="package-badge luxury">VIP Executive</div>
                    <div className="package-header">
                        <h3>VIP Platinum</h3>
                        <div className="package-price">€ 257 <span>/ employee</span></div>
                        <p>Includes VIP Lounge priority slot, hotel/flight itinerary & secure passport courier.</p>
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
                <span><strong>Note:</strong> All corporate fees are billed in EUR (€). The total Proforma Invoice is calculated automatically from the employee roster in Step 3.</span>
            </div>
        </div>
    );
}
