import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentService, appointmentService, documentService } from '@/shared/api/services';
import { useToast } from '@/shared/context/ToastContext';
import './AgentGroups.css';

// --- Tiplər ---
export interface ApplicantDoc {
    id: string;
    requiredDocumentType: string;
    fileUrl: string;
    originalFileName?: string;
    status: 'PENDING' | 'VERIFIED' | 'NEEDS_CORRECTION' | 'REJECTED';
    operatorNotes?: string;
    createdAt?: string;
}

export interface Applicant {
    id: string;
    fullName: string;
    firstName: string;
    lastName: string;
    passport: string;
    dob?: string;
    issueDate?: string;
    expiryDate?: string;
    status: 'pending' | 'verified' | 'action_req';
    formProgress: number;
    dossierId: string;
    documents: ApplicantDoc[];
    formDataJson?: any;
}

export interface Group {
    id: string;
    code: string;
    name: string;
    destination: string;
    travelDate: string;
    duration: 'short' | 'long';
    projectReason: string;
    createdDate: string;
    status: 'draft' | 'processing';
    applicants: Applicant[];
    dossierId?: string;
}

const REQUIRED_DOC_TYPES = [
    { type: 'PASSPORT', title: 'Valid Passport Copy', desc: 'Scanned color copy of the primary passport page (clear bio-data and photo).' },
    { type: 'BIOMETRIC_PHOTO', title: 'ICAO Biometric Photograph', desc: 'Recent color photo measuring 3.5 x 4.5 cm with light background, meeting ICAO standards.' },
    { type: 'INSURANCE', title: 'Schengen Travel Medical Insurance', desc: 'Medical insurance certificate covering minimum €30,000 for emergency treatment and repatriation.' },
    { type: 'FLIGHT_ITINERARY', title: 'Roundtrip Flight Reservation', desc: 'Confirmed booking itinerary showing entry and exit dates matching travel parameters.' },
    { type: 'BANK_STATEMENT', title: 'Proof of Financial Solvency', desc: 'Official bank account statement covering the past 3-6 months with bank stamp.' },
];

export default function AgentGroups() {
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast();

    // --- State-lər ---
    const [view, setView] = useState<'list' | 'manage'>('list');
    const [groups, setGroups] = useState<Group[]>([]);
    const [activeGroup, setActiveGroup] = useState<Group | null>(null);
    const [activeApplicant, setActiveApplicant] = useState<Applicant | null>(null);
    const [loading, setLoading] = useState(true);

    // Manage View State-ləri
    const [manageTab, setManageTab] = useState<'form' | 'docs'>('form');
    const [currentFormStep, setCurrentFormStep] = useState(1);
    const [isSaving, setIsSaving] = useState(false);
    const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);

    // Applicant Form Edit State
    const [applicantFormData, setApplicantFormData] = useState({
        firstName: '',
        lastName: '',
        passportNumber: '',
        dob: '',
        issueDate: '',
        expiryDate: '',
        prevVisas: '',
        fingerprints: '',
        stayDuration: '',
        accommodation: '',
        costCoveredBy: '',
        contactEmail: '',
        contactPhone: '',
        notes: '',
    });

    // Filter & Search State-ləri
    const [searchQuery, setSearchQuery] = useState('');
    const [destinationFilter, setDestinationFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');

    // Modal State-ləri (Group Settings)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [groupForSettings, setGroupForSettings] = useState<Group | null>(null);
    const [editGroupName, setEditGroupName] = useState('');

    // Hidden file input ref
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [targetUploadType, setTargetUploadType] = useState<string>('');

    // Qrupları Verilənlər Bazasından Yükləmə Funksiyası
    const fetchGroups = async () => {
        try {
            setLoading(true);
            const res = await agentService.getGroups();
            if (res.data?.groups) {
                const mapped: Group[] = res.data.groups.map((g: any) => {
                    const primaryDossier = g.dossiers?.[0] || {};
                    const primaryDossierId = primaryDossier.id || '';
                    const rawApplicants = g.applicants || primaryDossier.applicants || [];

                    const mappedApplicants: Applicant[] = rawApplicants.map((a: any) => {
                        const docs: ApplicantDoc[] = (a.documents || []).map((d: any) => ({
                            id: d.id,
                            requiredDocumentType: d.requiredDocumentType || d.type || 'DOCUMENT',
                            fileUrl: d.fileUrl,
                            originalFileName: d.originalFileName,
                            status: d.status || 'PENDING',
                            operatorNotes: d.operatorNotes,
                            createdAt: d.createdAt,
                        }));

                        const hasRejected = docs.some(d => d.status === 'REJECTED');
                        const verifiedCount = docs.filter(d => d.status === 'VERIFIED').length;
                        const allVerified = docs.length >= 3 && verifiedCount === docs.length;

                        const applicantStatus: 'verified' | 'pending' | 'action_req' =
                            hasRejected ? 'action_req' : (allVerified ? 'verified' : 'pending');

                        const formProgress = a.formDataJson?.formProgress || (allVerified ? 100 : docs.length > 0 ? 50 : 25);

                        return {
                            id: a.id,
                            fullName: `${a.firstName || ''} ${a.lastName || ''}`.trim() || 'Traveler',
                            firstName: a.firstName || '',
                            lastName: a.lastName || '',
                            passport: a.passportNumber || 'P0000000',
                            dob: a.birthDate ? String(a.birthDate).split('T')[0] : a.formDataJson?.dob || '',
                            issueDate: a.formDataJson?.issueDate || '',
                            expiryDate: a.formDataJson?.expiryDate || '',
                            status: applicantStatus,
                            formProgress,
                            dossierId: a.dossierId || primaryDossierId,
                            documents: docs,
                            formDataJson: a.formDataJson || {},
                        };
                    });

                    return {
                        id: g.id,
                        code: g.code || g.id,
                        name: g.name,
                        destination: g.destination || 'Europe / Schengen',
                        travelDate: g.travelDate ? String(g.travelDate).split('T')[0] : 'N/A',
                        duration: (g.duration as 'short' | 'long') || 'short',
                        projectReason: g.projectReason || 'Tourism',
                        createdDate: new Date(g.createdAt || Date.now()).toLocaleDateString('az-AZ', { month: 'short', day: 'numeric', year: 'numeric' }),
                        status: (g.status === 'COMPLETED' || g.status === 'PROCESSING') ? 'processing' : 'draft',
                        applicants: mappedApplicants,
                        dossierId: primaryDossierId,
                    };
                });
                setGroups(mapped);
            }
        } catch (err: any) {
            console.error('Failed to load agent groups from DB:', err);
            showError('Qrup məlumatlarını verilənlər bazasından yükləmək mümkün olmadı.');
        } finally {
            setLoading(false);
        }
    };

    // İlk yüklənmə
    useEffect(() => {
        fetchGroups();
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
        const estimatedCommission = totalApplicants * 40; // 40 AZN per passenger commission

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
                g.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
        setApplicantFormData({
            firstName: applicant.firstName || applicant.fullName.split(' ')[0] || '',
            lastName: applicant.lastName || applicant.fullName.split(' ').slice(1).join(' ') || '',
            passportNumber: applicant.passport || '',
            dob: applicant.dob || '',
            issueDate: applicant.issueDate || '',
            expiryDate: applicant.expiryDate || '',
            prevVisas: applicant.formDataJson?.prevVisas || '',
            fingerprints: applicant.formDataJson?.fingerprints || '',
            stayDuration: applicant.formDataJson?.stayDuration || '',
            accommodation: applicant.formDataJson?.accommodation || '',
            costCoveredBy: applicant.formDataJson?.costCoveredBy || '',
            contactEmail: applicant.formDataJson?.contactEmail || '',
            contactPhone: applicant.formDataJson?.contactPhone || '',
            notes: applicant.formDataJson?.notes || '',
        });
        setManageTab('form');
        setCurrentFormStep(1);
        setView('manage');
    };

    const handleBackToList = () => {
        setView('list');
        setActiveGroup(null);
        setActiveApplicant(null);
    };

    // Qrupun Emala Göndərilməsi (Real DB Submit)
    const handleSubmitGroup = async (groupId: string) => {
        try {
            const res = await agentService.submitGroup(groupId);
            showSuccess(`Qrup rəsmi emala göndərildi! Qazanılan komissiya: ${res.data?.commissionCredited || 40} AZN.`);
            await fetchGroups();
        } catch (e: any) {
            console.error('Group submit error:', e);
            showError(e.message || 'Qrupu emala göndərmək mümkün olmadı.');
        }
    };

    // Rəsmi Konsulluq Manifesti (PDF) Yükləməsi
    const handleDownloadManifest = async (group: Group) => {
        showSuccess(`${group.name} (${group.code}) üçün rəsmi konsulluq manifesti hazırlanır...`);
        try {
            const res = await appointmentService.generateManifestPdf({
                groupBatchId: group.id,
                groupInfo: {
                    id: group.code,
                    name: group.name,
                    size: group.applicants.length,
                    package: 'Official Group Manifest',
                    applicants: group.applicants.map(a => ({
                        name: a.fullName,
                        passport: a.passport,
                        docsStatus: a.status === 'verified' ? 'Verified' : 'Pending',
                    })),
                },
            });

            const downloadUrl = res.data?.fileUrl || (res.data?.fileName ? `/uploads/${res.data.fileName}` : null);
            if (downloadUrl) {
                const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : `http://localhost:5000${downloadUrl}`;
                const fileRes = await fetch(fullUrl);
                const blob = await fileRes.blob();
                const blobUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = res.data?.fileName || `manifest_${group.code}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(blobUrl);
                showSuccess('Rəsmi Konsulluq Manifesti (PDF) uğurla endirildi!');
            }
        } catch (e: any) {
            showError(e.message || 'Manifest PDF faylını endirmək mümkün olmadı.');
        }
    };

    // Sərnişin Anket Məlumatlarının Saxlanması (Real DB Update)
    const handleSaveForm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeGroup || !activeApplicant) return;

        setIsSaving(true);
        try {
            const payload = {
                firstName: applicantFormData.firstName,
                lastName: applicantFormData.lastName,
                passportNumber: applicantFormData.passportNumber,
                dob: applicantFormData.dob,
                issueDate: applicantFormData.issueDate,
                expiryDate: applicantFormData.expiryDate,
                prevVisas: applicantFormData.prevVisas,
                fingerprints: applicantFormData.fingerprints,
                stayDuration: applicantFormData.stayDuration,
                accommodation: applicantFormData.accommodation,
                costCoveredBy: applicantFormData.costCoveredBy,
                contactEmail: applicantFormData.contactEmail,
                contactPhone: applicantFormData.contactPhone,
                notes: applicantFormData.notes,
                formProgress: Math.min(100, currentFormStep * 20),
            };

            await agentService.saveApplicantForm(activeGroup.id, activeApplicant.id, payload);

            // Update local state
            setActiveApplicant(prev => prev ? {
                ...prev,
                firstName: applicantFormData.firstName,
                lastName: applicantFormData.lastName,
                fullName: `${applicantFormData.firstName} ${applicantFormData.lastName}`.trim(),
                passport: applicantFormData.passportNumber,
                dob: applicantFormData.dob,
                issueDate: applicantFormData.issueDate,
                expiryDate: applicantFormData.expiryDate,
                formDataJson: { ...prev.formDataJson, ...payload },
            } : null);

            if (currentFormStep < 5) {
                setCurrentFormStep(prev => prev + 1);
                showSuccess(`Addım ${currentFormStep} məlumatları bazada saxlandı! Növbəti addıma keçilir.`);
            } else {
                showSuccess('Ərizəçinin bütün anket məlumatları bazada uğurla saxlanıldı!');
            }
            await fetchGroups();
        } catch (e: any) {
            showError(e.message || 'Anket məlumatlarını saxlamaq mümkün olmadı.');
        } finally {
            setIsSaving(false);
        }
    };

    // Real Sənəd Yükləməsi (Real DB File Upload)
    const triggerUpload = (docType: string) => {
        setTargetUploadType(docType);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeApplicant) return;

        setUploadingDocType(targetUploadType);
        try {
            await documentService.uploadDocument({
                dossierId: activeApplicant.dossierId,
                applicantId: activeApplicant.id,
                requiredDocumentType: targetUploadType,
                isMandatory: true,
                file,
            });

            showSuccess(`${targetUploadType} sənədi uğurla sistemə yükləndi və bazada qeydiyyata alındı!`);
            await fetchGroups();

            // Refresh active applicant documents
            const updatedGroupRes = await agentService.getGroupById(activeGroup?.id || '');
            if (updatedGroupRes.data?.group) {
                const refreshedGroup = updatedGroupRes.data.group;
                const foundApp = refreshedGroup.dossiers?.[0]?.applicants?.find((a: any) => a.id === activeApplicant.id);
                if (foundApp) {
                    setActiveApplicant(prev => prev ? {
                        ...prev,
                        documents: foundApp.documents || [],
                    } : null);
                }
            }
        } catch (err: any) {
            console.error('File upload error:', err);
            showError(err.message || 'Faylı yükləmək mümkün olmadı.');
        } finally {
            setUploadingDocType(null);
            setTargetUploadType('');
        }
    };

    // Sərnişinin Qrupdan Silinməsi (Real DB Delete)
    const handleDeleteApplicant = async (applicantId: string) => {
        if (!activeGroup) return;
        if (!confirm('Bu sərnişini qrupdan və verilənlər bazasından silmək istədiyinizə əminsiniz?')) return;
        try {
            await agentService.removeApplicant(activeGroup.id, applicantId);
            showSuccess('Sərnişin qrupdan və verilənlər bazasından uğurla silindi.');
            await fetchGroups();
            if (activeApplicant?.id === applicantId) {
                handleBackToList();
            }
        } catch (e: any) {
            showError(e.message || 'Sərnişini silmək mümkün olmadı.');
        }
    };

    // Modal Funksiyaları (Settings)
    const openSettings = (group: Group) => {
        setGroupForSettings(group);
        setEditGroupName(group.name);
        setIsSettingsOpen(true);
    };

    const closeSettings = () => {
        setIsSettingsOpen(false);
        setTimeout(() => {
            setGroupForSettings(null);
            setEditGroupName('');
        }, 300);
    };

    // Qrup Adının Yenilənməsi (Real DB Update)
    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!groupForSettings) return;

        setIsSaving(true);
        try {
            await agentService.updateGroup(groupForSettings.id, { name: editGroupName });
            showSuccess('Qrup parametrləri və adı verilənlər bazasında uğurla yeniləndi!');
            closeSettings();
            await fetchGroups();
        } catch (e: any) {
            showError(e.message || 'Qrupu yeniləmək mümkün olmadı.');
        } finally {
            setIsSaving(false);
        }
    };

    // Qrupun Bazadan Silinməsi (Real DB Delete)
    const handleDeleteGroup = async () => {
        if (!groupForSettings) return;
        if (!confirm(`"${groupForSettings.name}" qrupunu və ona aid bütün qeydləri bazadan tamamilə silmək istədiyinizə əminsiniz?`)) return;

        setIsSaving(true);
        try {
            await agentService.deleteGroup(groupForSettings.id);
            showSuccess('Qrup və əlaqəli bütün qeydlər verilənlər bazasından uğurla silindi.');
            closeSettings();
            await fetchGroups();
        } catch (e: any) {
            showError(e.message || 'Qrupu silmək mümkün olmadı.');
        } finally {
            setIsSaving(false);
        }
    };

    const resetFilters = () => {
        setSearchQuery('');
        setDestinationFilter('ALL');
        setStatusFilter('ALL');
    };

    // Status Pill-ləri
    const renderApplicantStatus = (status: Applicant['status']) => {
        switch (status) {
            case 'verified':
                return (
                    <span className="app-status-badge verified">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        Təsdiqlənib
                    </span>
                );
            case 'action_req':
                return (
                    <span className="app-status-badge action_req">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        Tələb Olunur
                    </span>
                );
            case 'pending':
            default:
                return (
                    <span className="app-status-badge pending">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        İcrada
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
                {/* Gizli Fayl Girişi */}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    accept=".pdf,.jpg,.jpeg,.png" 
                    onChange={handleFileSelected} 
                />

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
                            <span className="kpi-value">{loading ? '...' : stats.totalGroups}</span>
                            <span className="kpi-subtext">Registered Tour Delegations</span>
                        </div>
                    </div>

                    <div className="kpi-card">
                        <div className="kpi-icon-box indigo">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </div>
                        <div className="kpi-content">
                            <span className="kpi-label">Total Travelers</span>
                            <span className="kpi-value">{loading ? '...' : stats.totalApplicants}</span>
                            <span className="kpi-subtext">Managed Applicants</span>
                        </div>
                    </div>

                    <div className="kpi-card">
                        <div className="kpi-icon-box emerald">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        </div>
                        <div className="kpi-content">
                            <span className="kpi-label">Readiness Rate</span>
                            <span className="kpi-value">{loading ? '...' : `${stats.readinessRate}%`}</span>
                            <span className="kpi-subtext">{stats.verifiedApplicants} of {stats.totalApplicants} Verified</span>
                        </div>
                    </div>

                    <div className="kpi-card">
                        <div className="kpi-icon-box amber">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                        </div>
                        <div className="kpi-content">
                            <span className="kpi-label">Est. Commission</span>
                            <span className="kpi-value">{loading ? '...' : `${stats.estimatedCommission} AZN`}</span>
                            <span className="kpi-subtext">40.00 AZN / Passenger</span>
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
                            <option value="draft">Draft</option>
                        </select>
                    </div>

                    {(searchQuery || destinationFilter !== 'ALL' || statusFilter !== 'ALL') && (
                        <button className="btn-reset-filters" onClick={resetFilters}>
                            Reset Filters
                        </button>
                    )}
                </div>

                {/* --- GROUPS LIST --- */}
                {loading ? (
                    <div className="groups-empty-state fade-in">
                        <div className="empty-icon-circle">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        </div>
                        <h3>Loading real database groups...</h3>
                        <p>Connecting to EuroTech database and fetching delegation rosters.</p>
                    </div>
                ) : filteredGroups.length === 0 ? (
                    <div className="groups-empty-state fade-in">
                        <div className="empty-icon-circle">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        </div>
                        <h3>No matching groups found</h3>
                        <p>You have not registered any tour groups matching these filters yet.</p>
                        <button className="btn-primary-gradient" onClick={() => navigate('/agent/create-group')} style={{ marginTop: '12px' }}>
                            Register New Tour Group
                        </button>
                    </div>
                ) : (
                    <div className="groups-list">
                        {filteredGroups.map(group => {
                            const verifiedCount = group.applicants.filter(a => a.status === 'verified').length;
                            const totalApps = group.applicants.length;
                            const progressPercent = totalApps > 0 ? Math.round((verifiedCount / totalApps) * 100) : 0;

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
                                                    <span className="code-badge">{group.code}</span>
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
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="3" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
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

                                        {group.applicants.length === 0 ? (
                                            <div style={{ padding: '20px', textAlign: 'center', color: '#64748B', fontSize: '0.9rem' }}>
                                                No travelers registered in this delegation yet.
                                            </div>
                                        ) : (
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

                                                            const docCount = app.documents.length;
                                                            const isComplete = docCount >= 3 && app.status === 'verified';

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
                                                                        <span className={`cell-docs-tag ${isComplete ? 'complete' : 'missing'}`}>
                                                                            {isComplete ? `All Uploaded (${REQUIRED_DOC_TYPES.length}/${REQUIRED_DOC_TYPES.length})` : `${docCount}/${REQUIRED_DOC_TYPES.length} Uploaded`}
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
                                        )}
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
                                                <input 
                                                    type="text" 
                                                    className="client-input" 
                                                    value={editGroupName}
                                                    onChange={(e) => setEditGroupName(e.target.value)}
                                                    required 
                                                />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Group Code</label>
                                                <input type="text" className="client-input" defaultValue={groupForSettings.code} disabled />
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
                                            <p>Deleting this group will remove all associated applicants and uploaded documents from the database. This action cannot be undone.</p>
                                        </div>
                                        <button type="button" className="btn-danger-outline" onClick={handleDeleteGroup} disabled={isSaving}>
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

    const uploadedDocTypes = new Set(activeApplicant?.documents.map(d => d.requiredDocumentType) || []);

    return (
        <div className="agent-groups-content fade-in">
            {/* Gizli Fayl Girişi */}
            <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                accept=".pdf,.jpg,.jpeg,.png" 
                onChange={handleFileSelected} 
            />

            {/* Header: Back & Info */}
            <div className="manage-view-header">
                <button className="btn-back-link" onClick={handleBackToList}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                    Back to Groups List
                </button>
                <div className="manage-applicant-info">
                    <div className="applicant-id-badge">Group: <strong>{activeGroup?.name}</strong> ({activeGroup?.code})</div>
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
                    2. Required Documents ({activeApplicant?.documents.length || 0})
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
                                <p className="step-desc">Complete the official consular details for {activeApplicant?.fullName}. All updates are persisted directly to the database.</p>
                                
                                <div className="client-form-grid">
                                    {currentFormStep === 1 && (
                                        <>
                                            <div className="client-input-group">
                                                <label>Destination Country</label>
                                                <input type="text" className="client-input" value={activeGroup?.destination || 'Hungary'} disabled />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Main Purpose of Travel</label>
                                                <input type="text" className="client-input" value={activeGroup?.projectReason || 'Tourism'} disabled />
                                            </div>
                                            <div className="client-input-group full-width">
                                                <label>Intended Departure Date</label>
                                                <input type="date" className="client-input" value={activeGroup?.travelDate || ''} disabled />
                                            </div>
                                        </>
                                    )}

                                    {currentFormStep === 2 && (
                                        <>
                                            <div className="client-input-group">
                                                <label>First Name</label>
                                                <input 
                                                    type="text" 
                                                    className="client-input" 
                                                    value={applicantFormData.firstName} 
                                                    onChange={(e) => setApplicantFormData({ ...applicantFormData, firstName: e.target.value })}
                                                    required 
                                                />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Last Name</label>
                                                <input 
                                                    type="text" 
                                                    className="client-input" 
                                                    value={applicantFormData.lastName} 
                                                    onChange={(e) => setApplicantFormData({ ...applicantFormData, lastName: e.target.value })}
                                                    required 
                                                />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Passport Number</label>
                                                <input 
                                                    type="text" 
                                                    className="client-input" 
                                                    value={applicantFormData.passportNumber} 
                                                    onChange={(e) => setApplicantFormData({ ...applicantFormData, passportNumber: e.target.value })}
                                                    required 
                                                />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Date of Birth</label>
                                                <input 
                                                    type="date" 
                                                    className="client-input" 
                                                    value={applicantFormData.dob} 
                                                    onChange={(e) => setApplicantFormData({ ...applicantFormData, dob: e.target.value })}
                                                />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Passport Issue Date</label>
                                                <input 
                                                    type="date" 
                                                    className="client-input" 
                                                    value={applicantFormData.issueDate} 
                                                    onChange={(e) => setApplicantFormData({ ...applicantFormData, issueDate: e.target.value })}
                                                />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Passport Expiry Date</label>
                                                <input 
                                                    type="date" 
                                                    className="client-input" 
                                                    value={applicantFormData.expiryDate} 
                                                    onChange={(e) => setApplicantFormData({ ...applicantFormData, expiryDate: e.target.value })}
                                                />
                                            </div>
                                        </>
                                    )}

                                    {currentFormStep === 3 && (
                                        <>
                                            <div className="client-input-group full-width">
                                                <label>Previous Schengen Visas in Past 3 Years</label>
                                                <input 
                                                    type="text" 
                                                    className="client-input" 
                                                    placeholder="e.g. Hungary 2024 (Valid: 2024-06 to 2024-09)" 
                                                    value={applicantFormData.prevVisas}
                                                    onChange={(e) => setApplicantFormData({ ...applicantFormData, prevVisas: e.target.value })}
                                                />
                                            </div>
                                            <div className="client-input-group full-width">
                                                <label>Biometric Fingerprints Collected Previously</label>
                                                <input 
                                                    type="text" 
                                                    className="client-input" 
                                                    placeholder="e.g. Yes - VFS Global Baku (2024) or No"
                                                    value={applicantFormData.fingerprints}
                                                    onChange={(e) => setApplicantFormData({ ...applicantFormData, fingerprints: e.target.value })}
                                                />
                                            </div>
                                        </>
                                    )}

                                    {currentFormStep === 4 && (
                                        <>
                                            <div className="client-input-group">
                                                <label>Duration of Stay (Days)</label>
                                                <input 
                                                    type="text" 
                                                    className="client-input" 
                                                    placeholder="e.g. 14 days"
                                                    value={applicantFormData.stayDuration}
                                                    onChange={(e) => setApplicantFormData({ ...applicantFormData, stayDuration: e.target.value })}
                                                />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Accommodation / Hotel</label>
                                                <input 
                                                    type="text" 
                                                    className="client-input" 
                                                    placeholder="e.g. Grand Hotel Budapest"
                                                    value={applicantFormData.accommodation}
                                                    onChange={(e) => setApplicantFormData({ ...applicantFormData, accommodation: e.target.value })}
                                                />
                                            </div>
                                            <div className="client-input-group full-width">
                                                <label>Travel Cost Covered By</label>
                                                <input 
                                                    type="text" 
                                                    className="client-input" 
                                                    placeholder="e.g. Applicant personally / Company Sponsor"
                                                    value={applicantFormData.costCoveredBy}
                                                    onChange={(e) => setApplicantFormData({ ...applicantFormData, costCoveredBy: e.target.value })}
                                                />
                                            </div>
                                        </>
                                    )}

                                    {currentFormStep === 5 && (
                                        <>
                                            <div className="client-input-group">
                                                <label>Contact Email</label>
                                                <input 
                                                    type="email" 
                                                    className="client-input" 
                                                    placeholder="e.g. traveler@domain.com"
                                                    value={applicantFormData.contactEmail}
                                                    onChange={(e) => setApplicantFormData({ ...applicantFormData, contactEmail: e.target.value })}
                                                />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Contact Phone</label>
                                                <input 
                                                    type="text" 
                                                    className="client-input" 
                                                    placeholder="e.g. +994 50 123 45 67"
                                                    value={applicantFormData.contactPhone}
                                                    onChange={(e) => setApplicantFormData({ ...applicantFormData, contactPhone: e.target.value })}
                                                />
                                            </div>
                                            <div className="client-input-group full-width">
                                                <label>Consular Notes & Special Requests</label>
                                                <textarea 
                                                    className="client-input" 
                                                    rows={3} 
                                                    value={applicantFormData.notes}
                                                    onChange={(e) => setApplicantFormData({ ...applicantFormData, notes: e.target.value })}
                                                    placeholder="Optional notes for consular officers..."
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="step-form-footer">
                                <button type="button" className="btn-modal-secondary" onClick={() => setCurrentFormStep(prev => prev - 1)} disabled={currentFormStep === 1}>Previous</button>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button 
                                        type="button" 
                                        className="btn-danger-outline" 
                                        onClick={() => activeApplicant && handleDeleteApplicant(activeApplicant.id)} 
                                        disabled={!activeApplicant || isSaving}
                                        style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                                    >
                                        Remove Traveler
                                    </button>
                                    <button type="submit" className="btn-primary-gradient" disabled={isSaving}>
                                        {isSaving ? 'Saving to Database...' : currentFormStep === 5 ? 'Save & Complete' : 'Next Step →'}
                                    </button>
                                </div>
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
                                <span className="tracker-count">{activeApplicant?.documents.length || 0} / {REQUIRED_DOC_TYPES.length} Uploaded</span>
                            </div>
                            <div className="tracker-progress-bar">
                                <div 
                                    className="progress-fill" 
                                    style={{ width: `${Math.min(100, Math.round(((activeApplicant?.documents.length || 0) / REQUIRED_DOC_TYPES.length) * 100))}%` }}
                                ></div>
                            </div>
                            <div className="tracker-items-vertical">
                                {REQUIRED_DOC_TYPES.map(doc => {
                                    const isUploaded = uploadedDocTypes.has(doc.type);
                                    const matched = activeApplicant?.documents.find(d => d.requiredDocumentType === doc.type);
                                    const isRejected = matched?.status === 'REJECTED';
                                    const isVerified = matched?.status === 'VERIFIED';

                                    return (
                                        <div key={doc.type} className={`tracker-item-vert ${isRejected ? 'rejected' : isVerified ? 'completed' : isUploaded ? 'completed' : 'pending'}`}>
                                            <div className="tracker-icon-vert">
                                                {isRejected ? (
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                                ) : isUploaded ? (
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                                ) : (
                                                    <span className="empty-circle"></span>
                                                )}
                                            </div>
                                            <span className="tracker-label-vert">{doc.title}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </aside>

                    <section className="docs-list-premium">
                        {REQUIRED_DOC_TYPES.map(reqDoc => {
                            const existing = activeApplicant?.documents.find(d => d.requiredDocumentType === reqDoc.type);
                            const isUploaded = !!existing;
                            const isRejected = existing?.status === 'REJECTED';
                            const isVerified = existing?.status === 'VERIFIED';
                            const isUploadingThis = uploadingDocType === reqDoc.type;

                            return (
                                <div 
                                    key={reqDoc.type} 
                                    className={`doc-card-premium ${isRejected ? 'rejected' : isVerified ? 'verified' : isUploaded ? 'verified' : 'pending'}`}
                                >
                                    <div className="doc-card-icon">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                                    </div>
                                    <div className="doc-card-info">
                                        <div className="doc-card-header">
                                            <h3>{reqDoc.title}</h3>
                                            <span className={`doc-badge ${isRejected ? 'rejected' : isVerified ? 'verified' : isUploaded ? 'verified' : 'pending'}`}>
                                                {isRejected ? 'Action Required' : isVerified ? 'Verified' : isUploaded ? 'Uploaded (Pending Review)' : 'Not Uploaded'}
                                            </span>
                                        </div>
                                        <p className="doc-explanatory-text">{reqDoc.desc}</p>
                                        
                                        {isRejected && existing?.operatorNotes && (
                                            <div className="doc-feedback-alert">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                                <div className="feedback-content">
                                                    <strong>Operator Feedback:</strong>
                                                    <span>{existing.operatorNotes}</span>
                                                </div>
                                            </div>
                                        )}

                                        {isUploaded && existing?.originalFileName && (
                                            <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '6px' }}>
                                                Fayl: <strong>{existing.originalFileName}</strong>
                                            </div>
                                        )}
                                    </div>
                                    <div className="doc-card-actions">
                                        <button 
                                            className="btn-upload-primary" 
                                            onClick={() => triggerUpload(reqDoc.type)}
                                            disabled={isUploadingThis}
                                        >
                                            {isUploadingThis ? 'Uploading...' : isUploaded ? 'Re-upload File' : 'Upload File'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </section>
                </div>
            )}
        </div>
    );
}