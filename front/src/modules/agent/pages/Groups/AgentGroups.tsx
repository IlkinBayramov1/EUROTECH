import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './AgentGroups.css';

// --- Tiplər ---
interface Applicant {
    id: string;
    fullName: string;
    passport: string;
    status: 'pending' | 'verified' | 'action_req';
    formProgress: number;
}

interface Group {
    id: string;
    name: string;
    destination: string;
    travelDate: string;         // STEP 1: Intended Departure Date
    duration: 'short' | 'long'; // STEP 1: Duration
    projectReason: string;      // STEP 1: Purpose
    createdDate: string;
    status: 'draft' | 'processing';
    applicants: Applicant[];
}

export default function AgentGroups() {
    const navigate = useNavigate();

    // --- State-lər ---
    const [view, setView] = useState<'list' | 'manage'>('list');
    const [activeGroup, setActiveGroup] = useState<Group | null>(null);
    const [activeApplicant, setActiveApplicant] = useState<Applicant | null>(null);
    
    // Manage View State-ləri
    const [manageTab, setManageTab] = useState<'form' | 'docs'>('form');
    const [currentFormStep, setCurrentFormStep] = useState(1);
    const [isSaving, setIsSaving] = useState(false);

    // Modal State-ləri
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [groupForSettings, setGroupForSettings] = useState<Group | null>(null);

    // Qrup Datası (Step 1 detalları əlavə edilib)
    const [groups, setGroups] = useState<Group[]>([
        {
            id: 'GRP-8821', name: 'TechTrade IT Delegation', destination: 'Hungary', travelDate: '2026-10-15', duration: 'short', projectReason: 'Business / Corporate', createdDate: 'Sep 1, 2026', status: 'processing',
            applicants: [
                { id: 'A-01', fullName: 'Ali Mammadov', passport: 'C1234567', status: 'verified', formProgress: 100 },
                { id: 'A-02', fullName: 'Ceyhun Hasanov', passport: 'C9876543', status: 'pending', formProgress: 40 }
            ]
        },
        {
            id: 'GRP-8845', name: 'Vienna Summer Tour', destination: 'Austria', travelDate: '2026-11-20', duration: 'short', projectReason: 'Tourism', createdDate: 'Sep 3, 2026', status: 'draft',
            applicants: [
                { id: 'A-03', fullName: 'Leyla Abbasova', passport: 'C4567890', status: 'action_req', formProgress: 0 }
            ]
        }
    ]);

    // --- Funksiyalar (Aksiyalar) ---
    const handleManageApplicant = (group: Group, applicant: Applicant) => {
        setActiveGroup(group);
        setActiveApplicant(applicant);
        setManageTab('form');
        setCurrentFormStep(1);
        setView('manage');
    };

    const handleBackToList = () => {
        setView('list');
        setActiveGroup(null);
        setActiveApplicant(null);
    };

    const handleSubmitGroup = (groupId: string) => {
        setGroups(prev => prev.map(g => g.id === groupId ? { ...g, status: 'processing' } : g));
        alert('Group successfully submitted for processing!');
    };

    const handleSaveForm = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setTimeout(() => {
            setIsSaving(false);
            if (currentFormStep < 5) setCurrentFormStep(prev => prev + 1);
            else alert('Application form saved successfully!');
        }, 800);
    };

    const handleUploadDoc = () => {
        setIsSaving(true);
        setTimeout(() => {
            setIsSaving(false);
            alert('Document uploaded and sent for review.');
        }, 1000);
    };

    // Modal Funksiyaları
    const openSettings = (group: Group) => {
        setGroupForSettings(group);
        setIsSettingsOpen(true);
    };

    const closeSettings = () => {
        setIsSettingsOpen(false);
        setTimeout(() => setGroupForSettings(null), 300);
    };

    const handleSaveSettings = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setTimeout(() => {
            setIsSaving(false);
            closeSettings();
        }, 800);
    };

    // --- Status İkonları ---
    const renderApplicantStatus = (status: Applicant['status']) => {
        switch (status) {
            case 'verified': return <span className="app-status-dot verified" title="Verified"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></span>;
            case 'action_req': return <span className="app-status-dot action-req" title="Action Required"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></span>;
            case 'pending': default: return <span className="app-status-dot pending" title="Pending"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>;
        }
    };

    // ==========================================
    // RENDER: VİEW 1 - Qrupların Siyahısı
    // ==========================================
    if (view === 'list') {
        return (
            <div className="agent-groups-content fade-in">
                <div className="agent-groups-header">
                    <div>
                        <h1 className="dash-title">Groups Management</h1>
                        <p className="dash-subtitle">Create and manage applicant groups, track missing documents, and submit bulk applications.</p>
                    </div>
                    <button className="btn-primary" onClick={() => navigate('/agent/create-group')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px', width: '18px'}}><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                        Create New Group
                    </button>
                </div>

                <div className="groups-filter-bar">
                    <div className="search-input-wrapper">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" placeholder="Search by Group Name, ID or Applicant Name..." />
                    </div>
                    <div className="filter-select-wrapper"><select><option>All Destinations</option></select></div>
                    <div className="filter-select-wrapper"><select><option>All Statuses</option></select></div>
                </div>

                <div className="groups-list">
                    {groups.map(group => (
                        <div key={group.id} className="group-card fade-in">
                            <div className="group-card-header">
                                <div className="group-info-main">
                                    <div className="group-icon">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                    </div>
                                    <div>
                                        <div className="group-title-row">
                                            <h3>{group.name}</h3>
                                            <span className={`status-label ${group.status === 'draft' ? 'action-req' : group.status === 'processing' ? 'processing' : 'ready'}`}>
                                                {group.status.charAt(0).toUpperCase() + group.status.slice(1)}
                                            </span>
                                        </div>
                                        <div className="group-meta">
                                            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Created: {group.createdDate}</span>
                                            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Destination: <strong>{group.destination}</strong></span>
                                            <span>ID: {group.id}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="group-actions">
                                    <button className="btn-icon-action" onClick={() => openSettings(group)} title="Group Settings">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                                    </button>
                                    {group.status === 'draft' && (
                                        <button className="btn-secondary small-btn" onClick={() => handleSubmitGroup(group.id)}>Submit Group</button>
                                    )}
                                </div>
                            </div>

                            <div className="group-applicants-section">
                                <div className="applicants-header">
                                    <h4>Applicants ({group.applicants.length})</h4>
                                </div>
                                <div className="applicants-table-wrapper">
                                    <table className="applicants-table">
                                        <thead>
                                            <tr>
                                                <th>Status</th>
                                                <th>Applicant Name</th>
                                                <th>Passport No.</th>
                                                <th>Docs</th>
                                                <th className="text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {group.applicants.map(app => (
                                                <tr key={app.id}>
                                                    <td className="cell-status">{renderApplicantStatus(app.status)}</td>
                                                    <td className="cell-name">{app.fullName}</td>
                                                    <td className="cell-passport">{app.passport}</td>
                                                    <td className="cell-docs">
                                                        <span className={`docs-count ${app.status === 'action_req' ? 'missing' : 'complete'}`}>
                                                            {app.status === 'action_req' ? '2 Missing' : 'All Uploaded'}
                                                        </span>
                                                    </td>
                                                    <td className="cell-actions text-right">
                                                        <button className="btn-action-outline" onClick={() => handleManageApplicant(group, app)}>
                                                            Manage
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* --- ULTRA-PREMIUM SETTINGS MODAL --- */}
                {isSettingsOpen && groupForSettings && (
                    <div className="premium-modal-overlay fade-in" onClick={closeSettings}>
                        <div className="premium-modal-container slide-up" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <div className="modal-header-info">
                                    <span className="modal-badge">Group Settings</span>
                                    <h2>{groupForSettings.name}</h2>
                                </div>
                                <button className="btn-modal-close" onClick={closeSettings}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                            </div>

                            <div className="modal-body">
                                <form id="settingsForm" onSubmit={handleSaveSettings}>
                                    
                                    {/* 1. Group Identity Section */}
                                    <div className="settings-section">
                                        <h3>General Identity</h3>
                                        <div className="client-form-grid">
                                            <div className="client-input-group full-width">
                                                <label>Group Name (Internal Reference)</label>
                                                <input type="text" className="client-input" defaultValue={groupForSettings.name} required />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Group ID</label>
                                                <input type="text" className="client-input" defaultValue={groupForSettings.id} disabled />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Creation Date</label>
                                                <input type="text" className="client-input" defaultValue={groupForSettings.createdDate} disabled />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. Step 1 (Travel Parameters) Section */}
                                    <div className="settings-section">
                                        <h3>Travel Parameters</h3>
                                        <div className="client-form-grid">
                                            <div className="client-input-group">
                                                <label>Destination Country</label>
                                                <input type="text" className="client-input" defaultValue={groupForSettings.destination} disabled />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Intended Departure Date</label>
                                                <input type="date" className="client-input" defaultValue={groupForSettings.travelDate} disabled />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Duration of Stay</label>
                                                <input type="text" className="client-input" defaultValue={groupForSettings.duration === 'short' ? 'Short Stay (≤ 90 days)' : 'Long Stay (> 90 days)'} disabled />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Group Travel Project</label>
                                                <input type="text" className="client-input" defaultValue={groupForSettings.projectReason} disabled />
                                            </div>
                                            <div className="client-input-group full-width" style={{ marginTop: '-8px' }}>
                                                <span className="helper-text">Core travel parameters cannot be changed after group initialization.</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 3. Administrative Status Section */}
                                    <div className="settings-section">
                                        <h3>Administrative Status</h3>
                                        <div className="client-input-group full-width">
                                            <label>Current Processing Status</label>
                                            <select className="client-input" defaultValue={groupForSettings.status}>
                                                <option value="draft">Draft (Awaiting Action)</option>
                                                <option value="processing">Processing</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* 4. Danger Zone */}
                                    <div className="settings-danger-zone">
                                        <div className="danger-info">
                                            <h4>Danger Zone</h4>
                                            <p>Deleting this group will permanently remove all associated applicants, uploaded documents, and application forms. This action cannot be undone.</p>
                                        </div>
                                        <button type="button" className="btn-danger-outline" onClick={() => alert('Delete confirmation would appear here.')}>
                                            Delete Group
                                        </button>
                                    </div>
                                </form>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-modal-secondary" onClick={closeSettings} disabled={isSaving}>Cancel</button>
                                <button type="submit" form="settingsForm" className="btn-modal-primary" disabled={isSaving}>
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ==========================================
    // RENDER: VİEW 2 - Sərnişin İdarəetmə Paneli (Form & Docs)
    // ==========================================
    const formSteps = [
        { id: 1, title: 'Your plans' }, { id: 2, title: 'Your information' }, { id: 3, title: 'Your last visa' }, { id: 4, title: 'Your stay' }, { id: 5, title: 'Your contacts' }
    ];

    return (
        <div className="agent-groups-content fade-in">
            {/* Header: Back & Info */}
            <div className="manage-view-header">
                <button className="btn-back-link" onClick={handleBackToList}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                    Back to Groups
                </button>
                <div className="manage-applicant-info">
                    <div className="applicant-id-badge">Group: <strong>{activeGroup?.name}</strong></div>
                    <h2 className="manage-title">Applicant: {activeApplicant?.fullName}</h2>
                </div>
            </div>

            {/* Premium Tabs */}
            <div className="manage-tabs-container">
                <button className={`premium-tab ${manageTab === 'form' ? 'active' : ''}`} onClick={() => setManageTab('form')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    1. Application Form
                </button>
                <button className={`premium-tab ${manageTab === 'docs' ? 'active' : ''}`} onClick={() => setManageTab('docs')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    2. Required Documents
                </button>
            </div>

            {/* --- TAB 1: APPLICATION FORM --- */}
            {manageTab === 'form' && (
                <div className="fade-in">
                    <div className="horizontal-stepper-wrapper">
                        {formSteps.map(step => (
                            <div key={step.id} className={`stepper-item-horiz ${currentFormStep === step.id ? 'active' : ''} ${currentFormStep > step.id ? 'completed' : ''}`} onClick={() => setCurrentFormStep(step.id)}>
                                <span className="stepper-label">{step.title}</span>
                                <div className="stepper-line"></div>
                            </div>
                        ))}
                    </div>

                    <div className="form-centered-container">
                        <form className="step-form-card" onSubmit={handleSaveForm}>
                            <div className="step-content-block">
                                <h2>{formSteps.find(s => s.id === currentFormStep)?.title}</h2>
                                <p className="step-desc">Complete the official details for {activeApplicant?.fullName}.</p>
                                <div className="client-form-grid">
                                    {currentFormStep === 2 ? (
                                        <>
                                            <div className="client-input-group"><label>First Name</label><input type="text" className="client-input" defaultValue={activeApplicant?.fullName.split(' ')[0]} /></div>
                                            <div className="client-input-group"><label>Last Name</label><input type="text" className="client-input" defaultValue={activeApplicant?.fullName.split(' ')[1]} /></div>
                                            <div className="client-input-group"><label>Passport No.</label><input type="text" className="client-input" defaultValue={activeApplicant?.passport} /></div>
                                        </>
                                    ) : (
                                        <div className="client-input-group full-width"><label>Required Data</label><input type="text" className="client-input" placeholder="Enter data..." /></div>
                                    )}
                                </div>
                            </div>

                            <div className="step-form-footer">
                                <button type="button" className="btn-secondary" onClick={() => setCurrentFormStep(prev => prev - 1)} disabled={currentFormStep === 1}>Previous</button>
                                <button type="submit" className="btn-primary" disabled={isSaving}>
                                    {isSaving ? 'Saving...' : currentFormStep === 5 ? 'Save Form' : 'Next'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- TAB 2: DOCUMENTS --- */}
            {manageTab === 'docs' && (
                <div className="docs-main-layout fade-in">
                    <aside className="docs-sidebar">
                        <div className="docs-tracker-card-vertical">
                            <div className="tracker-header">
                                <h3>Document Checklist</h3>
                                <span className="tracker-count">1 / 3 Uploaded</span>
                            </div>
                            <div className="tracker-progress-bar"><div className="progress-fill" style={{ width: '33%' }}></div></div>
                            <div className="tracker-items-vertical">
                                <div className="tracker-item-vert completed"><div className="tracker-icon-vert"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></div><span className="tracker-label-vert">Passport Copy</span></div>
                                <div className="tracker-item-vert rejected"><div className="tracker-icon-vert"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div><span className="tracker-label-vert">Biometric Photo</span></div>
                                <div className="tracker-item-vert pending"><div className="tracker-icon-vert"><span className="empty-circle"></span></div><span className="tracker-label-vert">Bank Statement</span></div>
                            </div>
                        </div>
                    </aside>

                    <section className="docs-list-premium">
                        <div className="doc-card-premium verified">
                            <div className="doc-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg></div>
                            <div className="doc-card-info">
                                <div className="doc-card-header"><h3>Valid Passport Copy</h3><span className="doc-badge verified">Verified</span></div>
                                <p className="doc-explanatory-text">Scanned copy of the main passport page.</p>
                            </div>
                            <div className="doc-card-actions"><button className="btn-icon-secondary"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div>
                        </div>

                        <div className="doc-card-premium rejected">
                            <div className="doc-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>
                            <div className="doc-card-info">
                                <div className="doc-card-header"><h3>Biometric Photograph</h3><span className="doc-badge rejected">Action Required</span></div>
                                <p className="doc-explanatory-text">Recent color photo measuring 3.5 x 4.5 cm.</p>
                                <div className="doc-feedback-alert">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                    <div className="feedback-content"><strong>Feedback:</strong><span>The uploaded photo is too blurry.</span></div>
                                </div>
                            </div>
                            <div className="doc-card-actions">
                                <button className="btn-upload-primary" onClick={handleUploadDoc}>
                                    {isSaving ? 'Uploading...' : 'Re-upload File'}
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}