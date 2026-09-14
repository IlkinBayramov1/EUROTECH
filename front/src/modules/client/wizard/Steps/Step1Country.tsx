import React from 'react';

interface Step1Props {
    data: {
        country: string;
        duration: string; // 'short' | 'long' | ''
        projectReason: string;
    };
    updateData: (field: string, value: string) => void;
}

export default function Step1Country({ data, updateData }: Step1Props) {
    
    // Qısa müddətli (Schengen C) üçün layihə/səbəb seçimləri
    const shortStayOptions = [
        "Family or private settlement",
        "Medical reasons",
        "Official visit",
        "Work",
        "Family or private visit",
        "Tourism",
        "Studies"
    ];

    // Uzun müddətli (National D) üçün layihə/səbəb seçimləri
    const longStayOptions = [
        "Work",
        "Family or private visit",
        "Family or private settlement (minor)",
        "Other",
        "Return visa",
        "Studies",
        "Taking up official duties",
        "Talent Cards",
        "Visitor"
    ];

    const currentProjectOptions = data.duration === 'long' ? longStayOptions : shortStayOptions;

    const handleDurationSelect = (duration: 'short' | 'long') => {
        updateData('duration', duration);
        updateData('projectReason', ''); // Müddət dəyişəndə alt seçimi sıfırlayırıq
    };

    return (
        <div className="step-content fade-in">
            <h1 className="step-title">Destination & Visa Type</h1>
            <p className="step-subtitle">Select your destination and specify the duration and purpose of your travel.</p>
            
            <div className="wizard-input-group" style={{ marginBottom: '32px' }}>
                <label>Destination Country</label>
                <div className="premium-select-wrapper">
                    <select 
                        value={data.country} 
                        onChange={(e) => updateData('country', e.target.value)}
                        className={data.country ? 'selected' : ''}
                    >
                        <option value="" disabled>Select a destination...</option>
                        <option value="Hungary">Hungary</option>
                        <option value="Austria">Austria</option>
                        <option value="Germany">Germany</option>
                        <option value="Italy">Italy</option>
                        <option value="France">France</option>
                    </select>
                </div>
            </div>

            <div className="wizard-input-group" style={{ marginBottom: '32px' }}>
                <label>Duration of Stay</label>
                <div className="duration-cards-grid">
                    {/* Short Stay Card */}
                    <div 
                        className={`duration-card ${data.duration === 'short' ? 'selected' : ''}`}
                        onClick={() => handleDurationSelect('short')}
                    >
                        <div className="duration-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        </div>
                        <div className="duration-content">
                            <h3>Short Stay (≤ 90 days)</h3>
                            <p>Up to 90 days within a 180-day period.</p>
                            <span className="visa-badge">Schengen C Visa</span>
                        </div>
                        <div className="duration-check">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                    </div>

                    {/* Long Stay Card */}
                    <div 
                        className={`duration-card ${data.duration === 'long' ? 'selected' : ''}`}
                        onClick={() => handleDurationSelect('long')}
                    >
                        <div className="duration-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        </div>
                        <div className="duration-content">
                            <h3>Long Stay (&gt; 90 days)</h3>
                            <p>Extended duration exceeding 90 days.</p>
                            <span className="visa-badge">National D Visa</span>
                        </div>
                        <div className="duration-check">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                    </div>
                </div>
            </div>

            <div className="wizard-input-group">
                <label>Travel Project</label>
                <p className="wizard-helper-text" style={{ marginTop: '-4px', marginBottom: '8px' }}>Please specify the primary reason for your trip based on your stay duration.</p>
                <div className="premium-select-wrapper">
                    <select 
                        value={data.projectReason} 
                        onChange={(e) => updateData('projectReason', e.target.value)}
                        className={data.projectReason ? 'selected' : ''}
                        disabled={!data.duration}
                    >
                        <option value="" disabled>Choose the category that applies to you</option>
                        {currentProjectOptions.map(option => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                </div>
                {!data.duration && <span className="wizard-helper-text">Please select a duration of stay first to unlock travel categories.</span>}
            </div>
        </div>
    );
}