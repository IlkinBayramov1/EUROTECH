import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './CorporateBatches.css';

// --- Tiplər ---
interface Employee {
    id: string;
    fullName: string;
    passport: string;
    status: 'pending' | 'verified' | 'action_req';
    formProgress: number;
}

interface Batch {
    id: string;
    name: string;
    destination: string;
    travelDate: string;
    duration: 'short' | 'long';
    projectReason: string;
    createdDate: string;
    status: 'draft' | 'processing' | 'ready';
    employees: Employee[];
}

export default function CorporateBatches() {
    const navigate = useNavigate();

    // --- State-lər ---
    const [view, setView] = useState<'list' | 'manage'>('list');
    const [activeBatch, setActiveBatch] = useState<Batch | null>(null);
    const [activeEmployee, setActiveEmployee] = useState<Employee | null>(null);
    
    // Manage View State-ləri
    const [manageTab, setManageTab] = useState<'form' | 'docs'>('form');
    const [currentFormStep, setCurrentFormStep] = useState(1);
    const [isSaving, setIsSaving] = useState(false);

    // Modal State-ləri
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [batchForSettings, setBatchForSettings] = useState<Batch | null>(null);

    // Mock Corporate Data
    const [batches, setBatches] = useState<Batch[]>([
        {
            id: 'BCH-2026-101', name: 'Vienna Summit Delegation', destination: 'Austria', travelDate: '2026-10-15', duration: 'short', projectReason: 'Business / Corporate', createdDate: 'Sep 1, 2026', status: 'processing',
            employees: [
                { id: 'EMP-001', fullName: 'David Smith', passport: 'P1234567', status: 'verified', formProgress: 100 },
                { id: 'EMP-002', fullName: 'Sarah Connor', passport: 'P9876543', status: 'pending', formProgress: 40 }
            ]
        },
        {
            id: 'BCH-2026-098', name: 'Berlin Relocation Q3', destination: 'Germany', travelDate: '2026-11-20', duration: 'long', projectReason: 'Work', createdDate: 'Sep 3, 2026', status: 'draft',
            employees: [
                { id: 'EMP-003', fullName: 'Michael Chang', passport: 'P4567890', status: 'action_req', formProgress: 0 }
            ]
        }
    ]);

    // --- Funksiyalar ---
    const handleManageEmployee = (batch: Batch, employee: Employee) => {
        setActiveBatch(batch);
        setActiveEmployee(employee);
        setManageTab('form');
        setCurrentFormStep(1);
        setView('manage');
    };

    const handleBackToList = () => {
        setView('list');
        setActiveBatch(null);
        setActiveEmployee(null);
    };

    const handleSubmitBatch = (batchId: string) => {
        setBatches(prev => prev.map(b => b.id === batchId ? { ...b, status: 'processing' } : b));
        alert('Batch successfully submitted for processing! Redirecting to payments...');
        navigate('/corporate/finance');
    };

    const handleSaveForm = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setTimeout(() => {
            setIsSaving(false);
            if (currentFormStep < 5) setCurrentFormStep(prev => prev + 1);
            else alert('Employee application form saved successfully!');
        }, 800);
    };

    const handleCopyDelegationLink = (empName: string) => {
        alert(`Delegation link for ${empName} copied to clipboard!\nYou can send this link to the employee so they can securely upload their own documents and fill out the form.`);
    };

    // Modal Funksiyaları
    const openSettings = (batch: Batch) => {
        setBatchForSettings(batch);
        setIsSettingsOpen(true);
    };

    const closeSettings = () => {
        setIsSettingsOpen(false);
        setTimeout(() => setBatchForSettings(null), 300);
    };

    // --- Status İkonları ---
    const renderEmployeeStatus = (status: Employee['status']) => {
        switch (status) {
            case 'verified': return <span className="emp-status-dot verified" title="Verified"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></span>;
            case 'action_req': return <span className="emp-status-dot action-req" title="Action Required"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></span>;
            case 'pending': default: return <span className="emp-status-dot pending" title="Pending"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>;
        }
    };

    // ==========================================
    // RENDER: VİEW 1 - BATCH LIST
    // ==========================================
    if (view === 'list') {
        return (
            <div className="corp-batches-content fade-in">
                <div className="corp-batches-header">
                    <div className="header-titles">
                        <h1 className="dash-title">Employee Batches</h1>
                        <p className="dash-subtitle">Manage corporate visa batches, track employee document uploads, and finalize submissions.</p>
                    </div>
                    <button className="btn-primary" onClick={() => navigate('/corporate/create-batch')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                        Create New Batch
                    </button>
                </div>

                <div className="corp-filter-bar">
                    <div className="search-input-wrapper">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" placeholder="Search by Batch Name, ID or Employee Name..." />
                    </div>
                    <div className="filter-select-wrapper"><select><option>All Destinations</option></select></div>
                    <div className="filter-select-wrapper"><select><option>All Statuses</option></select></div>
                </div>

                <div className="corp-batches-list">
                    {batches.map(batch => (
                        <div key={batch.id} className="corp-batch-card fade-in">
                            <div className="batch-card-header">
                                <div className="batch-info-main">
                                    <div className="batch-icon">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                    </div>
                                    <div>
                                        <div className="batch-title-row">
                                            <h3>{batch.name}</h3>
                                            <span className={`corp-badge ${batch.status === 'draft' ? 'badge-warning' : batch.status === 'processing' ? 'badge-processing' : 'badge-success'}`}>
                                                {batch.status === 'draft' ? 'Awaiting Action' : batch.status === 'processing' ? 'Processing' : 'Visas Ready'}
                                            </span>
                                        </div>
                                        <div className="batch-meta">
                                            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Created: {batch.createdDate}</span>
                                            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Destination: <strong>{batch.destination}</strong></span>
                                            <span>ID: {batch.id}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="batch-actions">
                                    <button className="btn-icon-action" onClick={() => openSettings(batch)} title="Batch Settings">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                                    </button>
                                    {batch.status === 'draft' && (
                                        <button className="btn-primary-solid" onClick={() => handleSubmitBatch(batch.id)}>Submit & Pay</button>
                                    )}
                                </div>
                            </div>

                            <div className="batch-employees-section">
                                <div className="employees-header">
                                    <h4>Employees ({batch.employees.length})</h4>
                                    <button className="btn-text add-emp-btn">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                                        Add Employee
                                    </button>
                                </div>
                                <div className="employees-table-wrapper">
                                    <table className="employees-table">
                                        <thead>
                                            <tr>
                                                <th>Status</th>
                                                <th>Employee Name</th>
                                                <th>Passport No.</th>
                                                <th>Data Collection</th>
                                                <th className="text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {batch.employees.map(emp => (
                                                <tr key={emp.id}>
                                                    <td className="cell-status">{renderEmployeeStatus(emp.status)}</td>
                                                    <td className="cell-name">{emp.fullName}</td>
                                                    <td className="cell-passport">{emp.passport}</td>
                                                    <td className="cell-docs">
                                                        <div className="emp-progress-indicator">
                                                            <div className="emp-progress-bg"><div className={`emp-progress-fill ${emp.formProgress < 100 ? 'warning' : 'success'}`} style={{ width: `${emp.formProgress}%` }}></div></div>
                                                            <span>{emp.formProgress}% Complete</span>
                                                        </div>
                                                    </td>
                                                    <td className="cell-actions text-right">
                                                        <div className="action-group-right">
                                                            <button className="btn-icon-secondary" title="Copy Delegation Link" onClick={() => handleCopyDelegationLink(emp.fullName)}>
                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                                            </button>
                                                            <button className="btn-action-outline" onClick={() => handleManageEmployee(batch, emp)}>
                                                                Manage Dossier
                                                            </button>
                                                        </div>
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
                {isSettingsOpen && batchForSettings && (
                    <div className="premium-modal-overlay fade-in" onClick={closeSettings}>
                        <div className="premium-modal-container slide-up" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <div className="modal-header-info">
                                    <span className="modal-badge">Batch Settings</span>
                                    <h2>{batchForSettings.name}</h2>
                                </div>
                                <button className="btn-modal-close" onClick={closeSettings}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                            </div>

                            <div className="modal-body">
                                <form id="settingsForm" onSubmit={(e) => { e.preventDefault(); closeSettings(); }}>
                                    <div className="settings-section">
                                        <h3>Administrative Details</h3>
                                        <div className="corp-form-grid">
                                            <div className="corp-input-group full-width">
                                                <label>Batch Name (Internal Reference)</label>
                                                <input type="text" className="corp-input" defaultValue={batchForSettings.name} required />
                                            </div>
                                            <div className="corp-input-group">
                                                <label>Destination Country</label>
                                                <input type="text" className="corp-input" defaultValue={batchForSettings.destination} disabled />
                                            </div>
                                            <div className="corp-input-group">
                                                <label>Intended Departure Date</label>
                                                <input type="date" className="corp-input" defaultValue={batchForSettings.travelDate} disabled />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="settings-danger-zone">
                                        <div className="danger-info">
                                            <h4>Cancel Batch</h4>
                                            <p>Canceling this batch will revoke all employee delegation links and delete unsubmitted data.</p>
                                        </div>
                                        <button type="button" className="btn-danger-outline">Cancel Batch</button>
                                    </div>
                                </form>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-modal-secondary" onClick={closeSettings}>Close</button>
                                <button type="submit" form="settingsForm" className="btn-modal-primary">Save Changes</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ==========================================
    // RENDER: VİEW 2 - MANAGE EMPLOYEE DOSSIER
    // ==========================================
    const formSteps = [
        { id: 1, title: 'Personal Info' }, { id: 2, title: 'Travel Docs' }, { id: 3, title: 'Employment' }, { id: 4, title: 'Accommodation' }
    ];

    return (
        <div className="corp-batches-content fade-in">
            {/* Header: Back & Info */}
            <div className="manage-view-header">
                <button className="btn-back-link" onClick={handleBackToList}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                    Back to Batches
                </button>
                <div className="manage-employee-info">
                    <div className="employee-id-badge">Batch: <strong>{activeBatch?.name}</strong></div>
                    <h2 className="manage-title">Employee: {activeEmployee?.fullName}</h2>
                </div>
            </div>

            {/* Premium Tabs */}
            <div className="corp-tabs-container">
                <button className={`corp-premium-tab ${manageTab === 'form' ? 'active' : ''}`} onClick={() => setManageTab('form')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    1. HR Form Completion
                </button>
                <button className={`corp-premium-tab ${manageTab === 'docs' ? 'active' : ''}`} onClick={() => setManageTab('docs')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    2. Document Repository
                </button>
            </div>

            {/* --- TAB 1: FORM --- */}
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
                                <p className="step-desc">Fill out or verify the official consular data for {activeEmployee?.fullName}. You can also delegate this task via link.</p>
                                <div className="corp-form-grid">
                                    <div className="corp-input-group full-width"><label>Required Data</label><input type="text" className="corp-input" placeholder="Enter corporate data..." /></div>
                                </div>
                            </div>

                            <div className="step-form-footer">
                                <button type="button" className="btn-secondary" onClick={() => setCurrentFormStep(prev => prev - 1)} disabled={currentFormStep === 1}>Previous</button>
                                <button type="submit" className="btn-primary" disabled={isSaving}>
                                    {isSaving ? 'Saving...' : currentFormStep === 4 ? 'Save Dossier' : 'Next'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- TAB 2: DOCS --- */}
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
                                <div className="tracker-item-vert pending"><div className="tracker-icon-vert"><span className="empty-circle"></span></div><span className="tracker-label-vert">Employment Letter</span></div>
                                <div className="tracker-item-vert pending"><div className="tracker-icon-vert"><span className="empty-circle"></span></div><span className="tracker-label-vert">Travel Insurance</span></div>
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

                        <div className="doc-card-premium pending">
                            <div className="doc-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg></div>
                            <div className="doc-card-info">
                                <div className="doc-card-header"><h3>Employment Letter</h3><span className="doc-badge pending">Missing</span></div>
                                <p className="doc-explanatory-text">Official HR letter stating position and salary.</p>
                            </div>
                            <div className="doc-card-actions">
                                <button className="btn-upload-primary">Upload File</button>
                            </div>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}