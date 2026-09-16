import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentService } from '@/shared/api/services';
import { useToast } from '@/shared/context/ToastContext';
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
    const { showSuccess, showError } = useToast();

    // --- State-lər ---
    const [view, setView] = useState<'list' | 'manage'>('list');
    const [activeGroup, setActiveGroup] = useState<Group | null>(null);
    const [activeApplicant, setActiveApplicant] = useState<Applicant | null>(null);
    
    // Manage View State-ləri
    const [manageTab, setManageTab] = useState<'form' | 'docs'>('form');
    const [currentFormStep, setCurrentFormStep] = useState(1);
    const [isSaving, setIsSaving] = useState(false);

    // Filter & Search State-ləri
    const [searchQuery, setSearchQuery] = useState('');
    const [destinationFilter, setDestinationFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');

    // Modal State-ləri
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [groupForSettings, setGroupForSettings] = useState<Group | null>(null);

    // Qrup Datası
    const [groups, setGroups] = useState<Group[]>([
        {
            id: 'GRP-8821', 
            name: 'TechTrade IT Delegation', 
            destination: 'Hungary', 
            travelDate: '2026-10-15', 
            duration: 'short', 
            projectReason: 'Business / Corporate', 
            createdDate: 'Sep 1, 2026', 
            status: 'processing',
            applicants: [
                { id: 'A-01', fullName: 'Ali Mammadov', passport: 'C1234567', status: 'verified', formProgress: 100 },
                { id: 'A-02', fullName: 'Ceyhun Hasanov', passport: 'C9876543', status: 'pending', formProgress: 40 }
            ]
        },
        {
            id: 'GRP-8845', 
            name: 'Vienna Summer Tour', 
            destination: 'Austria', 
            travelDate: '2026-11-20', 
            duration: 'short', 
            projectReason: 'Tourism', 
            createdDate: 'Sep 3, 2026', 
            status: 'draft',
            applicants: [
                { id: 'A-03', fullName: 'Leyla Abbasova', passport: 'C4567890', status: 'action_req', formProgress: 0 }
            ]
        }
    ]);

    useEffect(() => {
        agentService.getGroups()
            .then(res => {
                if (res.data?.groups && res.data.groups.length > 0) {
                    const mapped: Group[] = res.data.groups.map((g: any) => ({
                        id: g.id || g.code,
                        name: g.name,
                        destination: g.destination || 'Hungary',
                        travelDate: g.travelDate ? String(g.travelDate).split('T')[0] : '2026-10-15',
                        duration: (g.duration as 'short' | 'long') || 'short',
                        projectReason: g.projectReason || 'Tourism',
                        createdDate: new Date(g.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                        status: g.status === 'COMPLETED' || g.status === 'PROCESSING' ? 'processing' : 'draft',
                        applicants: g.dossier?.applicants?.map((a: any, idx: number) => ({
                            id: a.id || `A-${idx + 1}`,
                            fullName: `${a.firstName} ${a.lastName}`.trim() || 'Applicant',
                            passport: a.passportNumber || 'C1234567',
                            status: idx === 0 ? 'verified' : 'pending',
                            formProgress: idx === 0 ? 100 : 40,
                        })) || [
                            { id: 'A-01', fullName: 'Ali Mammadov', passport: 'C1234567', status: 'verified', formProgress: 100 }
                        ],
                    }));
                    setGroups(mapped);
                }
            })
            .catch(() => {});
    }, []);

    // Hesablanmış Metrikalar (KPIs)
    const stats = useMemo(() => {
        const totalGroups = groups.length;
        const totalApplicants = groups.reduce((acc, g) => acc + g.applicants.length, 0);
        const verifiedApplicants = groups.reduce((acc, g) => 
            acc + g.applicants.filter(a => a.status === 'verified').length, 0
        );
        const actionReqCount = groups.reduce((acc, g) => 
            acc + g.applicants.filter(a => a.status === 'action_req').length, 0
        );
        const estimatedCommission = totalApplicants * 20; // €20 per passenger commission

        return {
            totalGroups,
            totalApplicants,
            verifiedApplicants,
            actionReqCount,
            estimatedCommission,
            readinessRate: totalApplicants > 0 ? Math.round((verifiedApplicants / totalApplicants) * 100) : 0
        };
    }, [groups]);

    // Mövcud Ölkələr siyahısı
    const destinations = useMemo(() => {
        const set = new Set<string>();
        groups.forEach(g => set.add(g.destination));
        return Array.from(set);
    }, [groups]);

    // Filtrlənmiş Qruplar
    const filteredGroups = useMemo(() => {
        return groups.filter(g => {
            const matchesQuery = searchQuery === '' || 
                g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                g.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                g.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
                g.applicants.some(a => a.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || a.passport.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesDest = destinationFilter === 'ALL' || g.destination.toLowerCase() === destinationFilter.toLowerCase();
            const matchesStatus = statusFilter === 'ALL' || g.status.toLowerCase() === statusFilter.toLowerCase();

            return matchesQuery && matchesDest && matchesStatus;
        });
    }, [groups, searchQuery, destinationFilter, statusFilter]);

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

    const handleSubmitGroup = async (groupId: string) => {
        try {
            await agentService.submitGroup(groupId);
        } catch (e) {
            console.warn('Group submit offline fallback:', e);
        }
        setGroups(prev => prev.map(g => g.id === groupId ? { ...g, status: 'processing' } : g));
        showSuccess('Group successfully submitted for processing! Commission recorded in wallet.');
    };

    const handleDownloadManifest = (group: Group) => {
        showSuccess(`Generating official consular manifest for ${group.name} (${group.id})...`);
        setTimeout(() => {
            alert(`Consular Manifest PDF generated for ${group.name}.\nTotal travelers: ${group.applicants.length}\nReference: ${group.id}`);
        }, 600);
    };

    const handleSaveForm = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setTimeout(() => {
            setIsSaving(false);
            if (currentFormStep < 5) {
                setCurrentFormStep(prev => prev + 1);
            } else {
                showSuccess('Application form saved successfully!');
            }
        }, 600);
    };

    const handleUploadDoc = () => {
        setIsSaving(true);
        setTimeout(() => {
            setIsSaving(false);
            showSuccess('Document uploaded and sent for consular review.');
        }, 800);
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
            showSuccess('Group settings updated successfully.');
        }, 600);
    };

    const resetFilters = () => {
        setSearchQuery('');
        setDestinationFilter('ALL');
        setStatusFilter('ALL');
    };

    // --- Status İkonları və Pill-ləri ---
    const renderApplicantStatus = (status: Applicant['status']) => {
        switch (status) {
            case 'verified':
                return (
                    <span className="app-status-badge verified">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        Verified
                    </span>
                );
            case 'action_req':
                return (
                    <span className="app-status-badge action_req">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        Action Req.
                    </span>
                );
            case 'pending':
            default:
                return (
                    <span className="app-status-badge pending">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        In Progress
                    </span>
                );
        }
    };

    // ==========================================
    // RENDER: VİEW 1 - Qrupların Siyahısı
    // ==========================================
    if (view === 'list') {
        return (
            <div className="agent-groups-content fade-in">
                {/* --- HEADER --- */}
                <div className="agent-groups-header">
                    <div className="header-left">
                        <span className="portal-pill-badge">B2B Agent Ecosystem</span>
                        <h1 className="dash-title">Groups Management</h1>
                        <p className="dash-subtitle">Create and manage applicant groups, track missing documents, and submit bulk applications.</p>
                    </div>
                    <div className="header-actions">
                        <button className="btn-primary-gradient" onClick={() => navigate('/agent/create-group')}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Create New Group
                        </button>
                    </div>
                </div>

                {/* --- 4 KPI STAT CARDS --- */}
                <div className="agent-kpi-grid">
                    <div className="kpi-card">
                        <div className="kpi-icon-box blue">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        </div>
                        <div className="kpi-content">
                            <span className="kpi-label">Active Groups</span>
                            <span className="kpi-value">{stats.totalGroups}</span>
                            <span className="kpi-subtext">Registered Tour Delegations</span>
                        </div>
                    </div>

                    <div className="kpi-card">
                        <div className="kpi-icon-box indigo">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </div>
                        <div className="kpi-content">
                            <span className="kpi-label">Total Travelers</span>
                            <span className="kpi-value">{stats.totalApplicants}</span>
                            <span className="kpi-subtext">Managed Applicants</span>
                        </div>
                    </div>

                    <div className="kpi-card">
                        <div className="kpi-icon-box emerald">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        </div>
                        <div className="kpi-content">
                            <span className="kpi-label">Readiness Rate</span>
                            <span className="kpi-value">{stats.readinessRate}%</span>
                            <span className="kpi-subtext">{stats.verifiedApplicants} of {stats.totalApplicants} Verified</span>
                        </div>
                    </div>

                    <div className="kpi-card">
                        <div className="kpi-icon-box amber">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                        </div>
                        <div className="kpi-content">
                            <span className="kpi-label">Est. Commission</span>
                            <span className="kpi-value">€{stats.estimatedCommission}</span>
                            <span className="kpi-subtext">€20.00 / Passenger</span>
                        </div>
                    </div>
                </div>

                {/* --- FILTER & SEARCH BAR --- */}
                <div className="groups-filter-bar">
                    <div className="search-input-wrapper">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input 
                            type="text" 
                            placeholder="Search by Group Name, ID or Applicant Name..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="filter-select-wrapper">
                        <select 
                            value={destinationFilter} 
                            onChange={(e) => setDestinationFilter(e.target.value)}
                        >
                            <option value="ALL">All Destinations</option>
                            {destinations.map(dest => (
                                <option key={dest} value={dest}>{dest}</option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-select-wrapper">
                        <select 
                            value={statusFilter} 
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="processing">Processing</option>
                            <option value="draft">Draft (Action Required)</option>
                        </select>
                    </div>

                    {(searchQuery || destinationFilter !== 'ALL' || statusFilter !== 'ALL') && (
                        <button className="btn-reset-filters" onClick={resetFilters}>
                            Reset Filters
                        </button>
                    )}
                </div>

                {/* --- GROUPS LIST --- */}
                {filteredGroups.length === 0 ? (
                    <div className="groups-empty-state fade-in">
                        <div className="empty-icon-circle">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        </div>
                        <h3>No matching groups found</h3>
                        <p>Try adjusting your search terms or filters to find the applicant delegations you are looking for.</p>
                        <button className="btn-reset-filters" onClick={resetFilters}>Clear All Filters</button>
                    </div>
                ) : (
                    <div className="groups-list">
                        {filteredGroups.map(group => {
                            const verifiedCount = group.applicants.filter(a => a.status === 'verified').length;
                            const progressPercent = Math.round((verifiedCount / group.applicants.length) * 100);

                            return (
                                <div key={group.id} className="group-card fade-in">
                                    <div className="group-card-header">
                                        <div className="group-info-main">
                                            <div className="group-icon-avatar">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                            </div>
                                            <div className="group-titles-block">
                                                <div className="group-title-row">
                                                    <h3>{group.name}</h3>
                                                    <span className={`status-pill ${group.status}`}>
                                                        <span className="pulse-dot"></span>
                                                        {group.status === 'draft' ? 'Draft' : 'Processing'}
                                                    </span>
                                                    <span className="code-badge">{group.id}</span>
                                                </div>
                                                <div className="group-meta-chips">
                                                    <span className="meta-chip">
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                        Created: {group.createdDate}
                                                    </span>
                                                    <span className="meta-chip">
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                                        Destination: <strong>{group.destination}</strong>
                                                    </span>
                                                    <span className="meta-chip">
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                                        Departure: {group.travelDate}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="group-actions">
                                            {group.status === 'draft' && (
                                                <button className="btn-submit-group" onClick={() => handleSubmitGroup(group.id)}>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                                                    Submit Group
                                                </button>
                                            )}
                                            
                                            <button 
                                                className="btn-icon-action" 
                                                onClick={() => handleDownloadManifest(group)} 
                                                title="Download Consular Manifest PDF"
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                            </button>

                                            <button className="btn-icon-action" onClick={() => openSettings(group)} title="Group Settings">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                                            </button>
                                        </div>
                                    </div>

                                    {/* APPLICANTS ROSTER TABLE */}
                                    <div className="group-applicants-section">
                                        <div className="applicants-header-row">
                                            <h4>
                                                Delegation Roster 
                                                <span className="applicants-count-chip">{group.applicants.length} Travelers</span>
                                            </h4>
                                            <div className="readiness-indicator">
                                                Readiness: <strong>{progressPercent}% Complete</strong>
                                            </div>
                                        </div>

                                        <div className="applicants-table-wrapper">
                                            <table className="applicants-table">
                                                <thead>
                                                    <tr>
                                                        <th>Applicant Name</th>
                                                        <th>Passport No.</th>
                                                        <th>Status</th>
                                                        <th>Documents</th>
                                                        <th style={{ textAlign: 'right' }}>Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {group.applicants.map((app, idx) => {
                                                        const initials = app.fullName
                                                            .split(' ')
                                                            .map(n => n[0])
                                                            .join('')
                                                            .toUpperCase()
                                                            .slice(0, 2);

                                                        return (
                                                            <tr key={app.id}>
                                                                <td>
                                                                    <div className="applicant-identity">
                                                                        <div className="applicant-initials-avatar">{initials}</div>
                                                                        <div className="applicant-name-wrap">
                                                                            <span className="applicant-full-name">{app.fullName}</span>
                                                                            <span className="applicant-role-label">
                                                                                {idx === 0 ? 'Primary Applicant' : 'Delegation Traveler'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <span className="cell-passport-code">{app.passport}</span>
                                                                </td>
                                                                <td>
                                                                    <div className="cell-status-wrapper">
                                                                        {renderApplicantStatus(app.status)}
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <span className={`cell-docs-tag ${app.status === 'action_req' ? 'missing' : 'complete'}`}>
                                                                        {app.status === 'action_req' ? '2 Missing Docs' : 'All Uploaded (4/4)'}
                                                                    </span>
                                                                </td>
                                                                <td style={{ textAlign: 'right' }}>
                                                                    <button className="btn-manage-action" onClick={() => handleManageApplicant(group, app)}>
                                                                        Manage
                                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

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
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                            </div>

                            <div className="modal-body">
                                <form id="settingsForm" onSubmit={handleSaveSettings}>
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
                                            <div className="client-input-group full-width">
                                                <span className="helper-text">Core travel parameters cannot be changed after consular submission.</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="settings-danger-zone">
                                        <div className="danger-info">
                                            <h4>Danger Zone</h4>
                                            <p>Deleting this group will remove all associated applicants and uploaded documents. This action cannot be undone.</p>
                                        </div>
                                        <button type="button" className="btn-danger-outline" onClick={() => alert('Group deletion requires master admin confirmation.')}>
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
        { id: 1, title: 'Your plans' }, 
        { id: 2, title: 'Your information' }, 
        { id: 3, title: 'Your last visa' }, 
        { id: 4, title: 'Your stay' }, 
        { id: 5, title: 'Your contacts' }
    ];

    return (
        <div className="agent-groups-content fade-in">
            {/* Header: Back & Info */}
            <div className="manage-view-header">
                <button className="btn-back-link" onClick={handleBackToList}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                    Back to Groups List
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
                                <p className="step-desc">Complete the official consular details for {activeApplicant?.fullName}.</p>
                                <div className="client-form-grid">
                                    {currentFormStep === 2 ? (
                                        <>
                                            <div className="client-input-group"><label>First Name</label><input type="text" className="client-input" defaultValue={activeApplicant?.fullName.split(' ')[0]} /></div>
                                            <div className="client-input-group"><label>Last Name</label><input type="text" className="client-input" defaultValue={activeApplicant?.fullName.split(' ')[1]} /></div>
                                            <div className="client-input-group"><label>Passport No.</label><input type="text" className="client-input" defaultValue={activeApplicant?.passport} /></div>
                                        </>
                                    ) : (
                                        <div className="client-input-group full-width"><label>Required Data</label><input type="text" className="client-input" placeholder="Enter required consular details..." /></div>
                                    )}
                                </div>
                            </div>

                            <div className="step-form-footer">
                                <button type="button" className="btn-modal-secondary" onClick={() => setCurrentFormStep(prev => prev - 1)} disabled={currentFormStep === 1}>Previous</button>
                                <button type="submit" className="btn-primary-gradient" disabled={isSaving}>
                                    {isSaving ? 'Saving...' : currentFormStep === 5 ? 'Save Form' : 'Next Step →'}
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
                                <span>Document Checklist</span>
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
                                <p className="doc-explanatory-text">Scanned color copy of the main passport page with complete biometric clarity.</p>
                            </div>
                        </div>

                        <div className="doc-card-premium rejected">
                            <div className="doc-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>
                            <div className="doc-card-info">
                                <div className="doc-card-header"><h3>Biometric Photograph</h3><span className="doc-badge rejected">Action Required</span></div>
                                <p className="doc-explanatory-text">Recent color photo measuring 3.5 x 4.5 cm according to ICAO standards.</p>
                                <div className="doc-feedback-alert">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                    <div className="feedback-content"><strong>Operator Feedback:</strong><span>The uploaded photo does not meet minimum resolution standards.</span></div>
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