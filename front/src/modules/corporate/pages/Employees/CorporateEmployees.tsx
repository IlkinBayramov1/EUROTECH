import React, { useState } from 'react';
import './CorporateEmployees.css';

// --- Tiplər ---
interface VisaRecord {
    id: string;
    country: string;
    type: string;
    issueDate: string;
    expiryDate: string;
    status: 'Active' | 'Expired' | 'Processing';
    batchRef: string;
}

interface ArchivedDoc {
    id: string;
    name: string;
    uploadDate: string;
    type: 'pdf' | 'image';
}

interface EmployeeProfile {
    id: string;
    firstName: string;
    lastName: string;
    image?: string; // Şəkil URL-i (olmadıqda inisiallar göstərilir)
    jobTitle: string;
    department: string;
    nationality: string;
    passportNo: string;
    passportExpiry: string;
    email: string;
    phone: string;
    visaHistory: VisaRecord[];
    documents: ArchivedDoc[];
}

export default function CorporateEmployees() {
    const [view, setView] = useState<'list' | 'dossier'>('list');
    const [activeEmployee, setActiveEmployee] = useState<EmployeeProfile | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // --- Mock Data ---
    const [employees] = useState<EmployeeProfile[]>([
        {
            id: 'EMP-001', firstName: 'David', lastName: 'Smith', jobTitle: 'Senior Software Engineer', department: 'Engineering',
            nationality: 'United Kingdom', passportNo: 'P1234567', passportExpiry: '2030-05-14', email: 'd.smith@techinnovators.com', phone: '+44 7700 900077',
            image: 'https://i.pravatar.cc/150?img=11', // Simulyasiya üçün profil şəkli
            visaHistory: [
                { id: 'V-882', country: 'Austria', type: 'Schengen C (Business)', issueDate: '2026-10-20', expiryDate: '2027-10-20', status: 'Processing', batchRef: 'BCH-2026-101' },
                { id: 'V-551', country: 'Germany', type: 'Schengen C (Business)', issueDate: '2024-03-10', expiryDate: '2025-03-10', status: 'Expired', batchRef: 'BCH-2024-012' }
            ],
            documents: [
                { id: 'D1', name: 'Passport_Copy_Smith.pdf', uploadDate: 'Sep 1, 2026', type: 'pdf' },
                { id: 'D2', name: 'Employment_Contract.pdf', uploadDate: 'Sep 1, 2026', type: 'pdf' },
                { id: 'D3', name: 'Biometric_Photo.jpg', uploadDate: 'Sep 2, 2026', type: 'image' }
            ]
        },
        {
            id: 'EMP-002', firstName: 'Sarah', lastName: 'Connor', jobTitle: 'Marketing Director', department: 'Marketing',
            nationality: 'United States', passportNo: 'P9876543', passportExpiry: '2029-11-22', email: 's.connor@techinnovators.com', phone: '+1 555 0198 234',
            visaHistory: [
                { id: 'V-883', country: 'Austria', type: 'Schengen C (Business)', issueDate: '2026-10-20', expiryDate: '2027-10-20', status: 'Processing', batchRef: 'BCH-2026-101' }
            ],
            documents: [
                { id: 'D4', name: 'Passport_Scan.pdf', uploadDate: 'Sep 3, 2026', type: 'pdf' }
            ]
        },
        {
            id: 'EMP-003', firstName: 'Michael', lastName: 'Chang', jobTitle: 'Operations Manager', department: 'Operations',
            nationality: 'Canada', passportNo: 'P4567890', passportExpiry: '2031-01-10', email: 'm.chang@techinnovators.com', phone: '+1 416 555 0198',
            image: 'https://i.pravatar.cc/150?img=13',
            visaHistory: [
                { id: 'V-901', country: 'Germany', type: 'National D (Work)', issueDate: '2026-09-01', expiryDate: '2027-09-01', status: 'Active', batchRef: 'BCH-2026-098' }
            ],
            documents: [
                { id: 'D5', name: 'Passport_Chang.pdf', uploadDate: 'Aug 20, 2026', type: 'pdf' },
                { id: 'D6', name: 'German_Work_Contract.pdf', uploadDate: 'Aug 21, 2026', type: 'pdf' }
            ]
        }
    ]);

    // --- Aksiyalar ---
    const handleViewDossier = (employee: EmployeeProfile) => {
        setActiveEmployee(employee);
        setView('dossier');
    };

    const handleBackToList = () => {
        setView('list');
        setActiveEmployee(null);
    };

    const filteredEmployees = employees.filter(emp => 
        `${emp.firstName} ${emp.lastName} ${emp.id} ${emp.passportNo}`.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // ==========================================
    // RENDER 1: EMPLOYEE DIRECTORY (LIST)
    // ==========================================
    if (view === 'list') {
        return (
            <div className="corp-emp-content fade-in">
                <div className="corp-emp-header">
                    <div className="header-titles">
                        <h1 className="dash-title">Employee Directory</h1>
                        <p className="dash-subtitle">Manage your corporate workforce, view individual visa histories, and access document archives.</p>
                    </div>
                    <button className="btn-primary">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                        Add New Employee
                    </button>
                </div>

                <div className="corp-filter-bar">
                    <div className="search-input-wrapper">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input 
                            type="text" 
                            placeholder="Search by Employee Name, ID or Passport..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="filter-select-wrapper">
                        <select><option>All Departments</option><option>Engineering</option><option>Marketing</option></select>
                    </div>
                </div>

                <div className="corp-panel-card table-wrapper fade-in">
                    <div className="corp-table-container">
                        <table className="corp-table">
                            <thead>
                                <tr>
                                    <th>Employee</th>
                                    <th>Department</th>
                                    <th>Passport No.</th>
                                    <th>Active Visa Status</th>
                                    <th className="text-right">Dossier</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEmployees.map(emp => {
                                    const activeVisa = emp.visaHistory.find(v => v.status === 'Active' || v.status === 'Processing');
                                    
                                    return (
                                        <tr key={emp.id} className="emp-row" onClick={() => handleViewDossier(emp)}>
                                            <td>
                                                <div className="emp-cell-profile">
                                                    {emp.image ? (
                                                        <img src={emp.image} alt={emp.firstName} className="emp-avatar-sm" />
                                                    ) : (
                                                        <div className="emp-avatar-sm text-avatar">{emp.firstName[0]}{emp.lastName[0]}</div>
                                                    )}
                                                    <div className="emp-cell-info">
                                                        <strong>{emp.firstName} {emp.lastName}</strong>
                                                        <span>{emp.jobTitle} • {emp.id}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{emp.department}</td>
                                            <td className="cell-passport">{emp.passportNo}</td>
                                            <td>
                                                {activeVisa ? (
                                                    <div className="visa-quick-status">
                                                        <span className={`corp-badge ${activeVisa.status === 'Active' ? 'badge-success' : 'badge-processing'}`}>
                                                            {activeVisa.status}
                                                        </span>
                                                        <span className="visa-country">{activeVisa.country}</span>
                                                    </div>
                                                ) : (
                                                    <span className="corp-badge badge-neutral">No Active Visa</span>
                                                )}
                                            </td>
                                            <td className="text-right">
                                                <button className="btn-outline-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handleViewDossier(emp); }}>
                                                    Open Archive
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {filteredEmployees.length === 0 && (
                            <div className="empty-state-box">No employees found matching your search.</div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ==========================================
    // RENDER 2: EMPLOYEE DOSSIER ARCHIVE
    // ==========================================
    if (view === 'dossier' && activeEmployee) {
        return (
            <div className="corp-emp-content fade-in">
                <div className="manage-view-header">
                    <button className="btn-back-link" onClick={handleBackToList}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                        Back to Directory
                    </button>
                    <div className="manage-employee-info">
                        <button className="btn-outline-secondary btn-sm">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:'16px', marginRight:'6px'}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Edit Profile
                        </button>
                    </div>
                </div>

                {/* Dossier Header (Premium Cover) */}
                <div className="dossier-cover-card">
                    <div className="dossier-cover-bg"></div>
                    <div className="dossier-profile-content">
                        <div className="dossier-avatar-large">
                            {activeEmployee.image ? (
                                <img src={activeEmployee.image} alt={activeEmployee.firstName} />
                            ) : (
                                <span>{activeEmployee.firstName[0]}{activeEmployee.lastName[0]}</span>
                            )}
                        </div>
                        <div className="dossier-main-info">
                            <h2>{activeEmployee.firstName} {activeEmployee.lastName}</h2>
                            <p>{activeEmployee.jobTitle} • <strong>{activeEmployee.department}</strong></p>
                            <div className="dossier-tags">
                                <span className="dossier-tag">ID: {activeEmployee.id}</span>
                                <span className="dossier-tag">Nationality: {activeEmployee.nationality}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Dossier Grid Layout */}
                <div className="dossier-grid">
                    
                    {/* Left Column: Personal & Contact Details */}
                    <div className="dossier-column-left">
                        <div className="corp-panel-card">
                            <div className="panel-header"><h3>Personal & Travel Information</h3></div>
                            <div className="info-list">
                                <div className="info-row">
                                    <span className="info-label">Full Name</span>
                                    <strong className="info-value">{activeEmployee.firstName} {activeEmployee.lastName}</strong>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Passport Number</span>
                                    <strong className="info-value passport-font">{activeEmployee.passportNo}</strong>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Passport Expiry</span>
                                    <strong className="info-value">{activeEmployee.passportExpiry}</strong>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Email Address</span>
                                    <strong className="info-value">{activeEmployee.email}</strong>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Phone Number</span>
                                    <strong className="info-value">{activeEmployee.phone}</strong>
                                </div>
                            </div>
                        </div>

                        {/* Document Archive Box */}
                        <div className="corp-panel-card">
                            <div className="panel-header">
                                <h3>Document Archive</h3>
                                <button className="btn-text-link">Upload New</button>
                            </div>
                            <div className="doc-archive-list">
                                {activeEmployee.documents.map(doc => (
                                    <div key={doc.id} className="archive-doc-item">
                                        <div className="doc-icon-sm">
                                            {doc.type === 'pdf' ? (
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                            ) : (
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                            )}
                                        </div>
                                        <div className="doc-info-sm">
                                            <h4>{doc.name}</h4>
                                            <span>Uploaded: {doc.uploadDate}</span>
                                        </div>
                                        <button className="btn-icon-action" title="Download"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Visa History Timeline */}
                    <div className="dossier-column-right">
                        <div className="corp-panel-card h-full">
                            <div className="panel-header">
                                <h3>Visa & Mobility History</h3>
                            </div>
                            
                            <div className="visa-history-timeline">
                                {activeEmployee.visaHistory.length === 0 ? (
                                    <div className="empty-state-box">No visa history found for this employee.</div>
                                ) : (
                                    activeEmployee.visaHistory.map((visa, idx) => (
                                        <div key={visa.id} className="history-timeline-item">
                                            <div className={`history-dot ${visa.status === 'Active' ? 'success' : visa.status === 'Processing' ? 'processing' : 'expired'}`}></div>
                                            
                                            <div className="history-card">
                                                <div className="history-card-header">
                                                    <h4>{visa.country} — {visa.type}</h4>
                                                    <span className={`corp-badge ${visa.status === 'Active' ? 'badge-success' : visa.status === 'Processing' ? 'badge-processing' : 'badge-neutral'}`}>
                                                        {visa.status}
                                                    </span>
                                                </div>
                                                <div className="history-card-body">
                                                    <div className="hist-data"><span>Issue Date:</span> <strong>{visa.issueDate}</strong></div>
                                                    <div className="hist-data"><span>Expiry Date:</span> <strong>{visa.expiryDate}</strong></div>
                                                    <div className="hist-data"><span>Batch Ref:</span> <strong className="text-link">{visa.batchRef}</strong></div>
                                                    <div className="hist-data"><span>Visa ID:</span> <strong>{visa.id}</strong></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        );
    }

    return null;
}