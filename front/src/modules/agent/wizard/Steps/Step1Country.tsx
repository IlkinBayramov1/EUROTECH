import React from 'react';

export default function Step1Country({ data, updateData }: any) {
    const shortStayOptions = ["Tourism", "Business / Corporate", "Official visit", "Cultural / Sports event"];
    const longStayOptions = ["Work", "Studies", "Family settlement", "Other"];

    const currentProjectOptions = data.duration === 'long' ? longStayOptions : shortStayOptions;
    
    // Keçmiş tarixlərin seçilməsini bloklamaq üçün bugünkü tarixi alırıq
    const today = new Date().toISOString().split("T")[0];

    return (
        <div className="step-content fade-in">
            <h1 className="step-title">Destination & Visa Type</h1>
            <p className="step-subtitle">Select the destination, intended travel date, and overarching travel purpose for this client group.</p>
            
            {/* Ölkə və Tarix eyni sətirdə (Grid) */}
            <div className="wizard-form-grid" style={{ marginBottom: '32px' }}>
                <div className="wizard-input-group">
                    <label>Destination Country</label>
                    <div className="premium-select-wrapper">
                        <select value={data.country} onChange={(e) => updateData('country', e.target.value)} className={data.country ? 'selected' : ''}>
                            <option value="" disabled>Select destination...</option>
                            <option value="Hungary">Hungary</option>
                            <option value="Austria">Austria</option>
                            <option value="Germany">Germany</option>
                        </select>
                    </div>
                </div>

                <div className="wizard-input-group">
                    <label>Intended Travel Date (Departure)</label>
                    <input 
                        type="date" 
                        className="premium-input" 
                        value={data.travelDate || ''} 
                        onChange={(e) => updateData('travelDate', e.target.value)} 
                        min={today} // Keçmiş tarixləri bloklayır
                    />
                </div>
            </div>

            <div className="wizard-input-group" style={{ marginBottom: '32px' }}>
                <label>Duration of Stay (For all group members)</label>
                <div className="duration-cards-grid">
                    <div className={`duration-card ${data.duration === 'short' ? 'selected' : ''}`} onClick={() => { updateData('duration', 'short'); updateData('projectReason', ''); }}>
                        <div className="duration-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        </div>
                        <div className="duration-content">
                            <h3>Short Stay (≤ 90 days)</h3>
                            <span className="visa-badge">Schengen C Visa</span>
                        </div>
                    </div>
                    
                    <div className={`duration-card ${data.duration === 'long' ? 'selected' : ''}`} onClick={() => { updateData('duration', 'long'); updateData('projectReason', ''); }}>
                        <div className="duration-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        </div>
                        <div className="duration-content">
                            <h3>Long Stay (&gt; 90 days)</h3>
                            <span className="visa-badge">National D Visa</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="wizard-input-group">
                <label>Group Travel Project</label>
                <div className="premium-select-wrapper">
                    <select value={data.projectReason} onChange={(e) => updateData('projectReason', e.target.value)} className={data.projectReason ? 'selected' : ''} disabled={!data.duration}>
                        <option value="" disabled>Choose the primary reason for the group's trip</option>
                        {currentProjectOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>
            </div>
        </div>
    );
}