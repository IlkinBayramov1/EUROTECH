import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/shared/context/AuthContext';
import { dossierService } from '@/shared/api/services/dossier.service';
import { useToast } from '@/shared/context/ToastContext';
import './ClientApplication.css';

interface ApplicantData {
    id: string;
    type: 'Primary' | 'Co-Applicant';
    firstName: string;
    lastName: string;
    status: 'completed' | 'in-progress' | 'not-started';
    progress: number;
    formData?: Record<string, any>;
    passportNumber?: string;
    birthDate?: string;
    nationality?: string;
    gender?: string;
}

const DEFAULT_FORM_DATA: Record<string, any> = {
    // Step 1: Your plans
    purpose: 'Tourism',
    destination: 'Hungary',
    firstEntry: 'Hungary',
    entriesRequested: 'Single',
    arrivalDate: '',
    departureDate: '',
    durationOfStay: '',

    // Step 2: Personal Information 
    firstName: '',
    lastName: '',
    birthSurname: '',
    birthDate: '',
    birthPlace: '',
    birthCountry: 'Azerbaijan',
    nationality: 'Azerbaijan',
    gender: '',
    maritalStatus: '',
    nationalId: '',

    // Step 3: Travel Document
    passportType: 'Ordinary passport',
    passportNumber: '',
    issueDate: '',
    passportExpiry: '',
    issuedBy: '',

    // Step 4: Your stay & accommodation
    invitingParty: '',
    address: '',
    stayEmail: '',
    stayPhone: '',
    costCoveredBy: 'By applicant himself',
    meansOfSupport: '',

    // Step 5: Contacts & Employment
    homeAddress: '',
    homeEmail: '',
    homePhone: '',
    currentOccupation: '',
    employerName: '',
    employerAddress: '',
};

function calculateFormProgress(form: Record<string, any>): number {
    if (!form || Object.keys(form).length === 0) return 0;
    
    let score = 0;
    // Step 1 checks (trip particulars)
    if (form.purpose && (form.arrivalDate || form.departureDate || form.destination)) score += 20;
    // Step 2 checks (identification)
    if (form.firstName && form.lastName && (form.birthDate || form.nationality)) score += 20;
    // Step 3 checks (travel document)
    if (form.passportNumber && (form.issueDate || form.passportExpiry || form.issuedBy)) score += 20;
    // Step 4 checks (stay & accommodation)
    if ((form.invitingParty || form.address) && form.costCoveredBy) score += 20;
    // Step 5 checks (contact & employment)
    if (form.homeAddress || form.homeEmail || form.homePhone || form.currentOccupation) score += 20;

    return Math.min(100, score);
}

export default function ClientApplication() {
    const { user, refreshUser } = useAuth();
    const { showSuccess, showError } = useToast();
    const [view, setView] = useState<'list' | 'edit'>('list');
    const [activeApplicant, setActiveApplicant] = useState<ApplicantData | null>(null);
    const [currentFormStep, setCurrentFormStep] = useState(1);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [dossierId, setDossierId] = useState<string | null>(null);

    // Add Applicant Modal States
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newFirstName, setNewFirstName] = useState('');
    const [newLastName, setNewLastName] = useState('');
    const [newPassportNumber, setNewPassportNumber] = useState('');
    const [newNationality, setNewNationality] = useState('Azerbaijan');

    // Download Format Modal States (PDF / Excel)
    const [downloadTargetApp, setDownloadTargetApp] = useState<ApplicantData | null>(null);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

    // Applicants strictly loaded from Database (MySQL/Prisma)
    const [applicants, setApplicants] = useState<ApplicantData[]>([]);

    const [formData, setFormData] = useState<Record<string, any>>({
        ...DEFAULT_FORM_DATA,
    });

    // Load active dossier applicants from backend
    const loadApplicantsFromBackend = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await dossierService.getMyDossiers();
            const dossiers = res.data?.dossiers || [];
            if (dossiers.length > 0) {
                const active = dossiers[0];
                setDossierId(active.id);

                let dbApplicants = active.applicants || [];

                // If dossier exists but has no applicants yet, automatically create primary applicant in DB
                if (dbApplicants.length === 0 && user) {
                    const nameParts = (user.fullName || '').trim().split(' ').filter(Boolean);
                    const pFirst = nameParts[0] || 'Müştəri';
                    const pLast = nameParts.slice(1).join(' ') || '';
                    try {
                        const createRes = await dossierService.addApplicants(active.id, [{
                            firstName: pFirst,
                            lastName: pLast,
                            passportNumber: user.passportNumber || '',
                            nationality: 'AZ',
                            formDataJson: {
                                firstName: pFirst,
                                lastName: pLast,
                                passportNumber: user.passportNumber || '',
                                homeEmail: user.email || '',
                                homePhone: user.phone || '',
                                nationality: 'Azerbaijan',
                            }
                        }]);
                        if (createRes.data?.applicants) {
                            dbApplicants = createRes.data.applicants;
                        }
                    } catch (addErr) {
                        console.error('Error auto-creating primary applicant in DB:', addErr);
                    }
                }

                if (dbApplicants && dbApplicants.length > 0) {
                    const mapped: ApplicantData[] = dbApplicants.map((a: any, idx: number) => {
                        const formObj = (a.formDataJson && typeof a.formDataJson === 'object') ? a.formDataJson : {};
                        const prog = calculateFormProgress(formObj);
                        return {
                            id: a.id,
                            type: idx === 0 ? 'Primary' : 'Co-Applicant',
                            firstName: a.firstName || formObj.firstName || '',
                            lastName: a.lastName || formObj.lastName || '',
                            status: prog >= 100 ? 'completed' : prog > 0 ? 'in-progress' : 'not-started',
                            progress: prog,
                            formData: formObj,
                            passportNumber: a.passportNumber || formObj.passportNumber || '',
                            birthDate: a.birthDate ? String(a.birthDate).split('T')[0] : (formObj.birthDate || ''),
                            nationality: a.nationality || formObj.nationality || 'Azerbaijan',
                            gender: a.gender || formObj.gender || '',
                        };
                    });
                    setApplicants(mapped);
                } else {
                    setApplicants([]);
                }
            } else {
                setApplicants([]);
            }
        } catch (err) {
            console.warn('Failed to load dossier applicants from backend:', err);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadApplicantsFromBackend();
    }, [loadApplicantsFromBackend]);

    // Handle Edit Applicant
    const handleEditApplicant = (app: ApplicantData) => {
        setActiveApplicant(app);
        setCurrentFormStep(1);

        const isPrimary = app.type === 'Primary' || applicants[0]?.id === app.id;
        const loadedFormData = {
            ...DEFAULT_FORM_DATA,
            ...(app.formData || {}),
            firstName: app.firstName || app.formData?.firstName || '',
            lastName: app.lastName || app.formData?.lastName || '',
            passportNumber: app.passportNumber || app.formData?.passportNumber || '',
            birthDate: app.birthDate ? String(app.birthDate).split('T')[0] : (app.formData?.birthDate || ''),
            nationality: app.nationality || app.formData?.nationality || 'Azerbaijan',
            gender: app.gender || app.formData?.gender || '',
            homeEmail: app.formData?.homeEmail || (isPrimary ? (user?.email || '') : ''),
            homePhone: app.formData?.homePhone || (isPrimary ? (user?.phone || '') : ''),
        };

        setFormData(loadedFormData);
        setView('edit');
    };

    // Generic input change helper
    const handleFieldChange = (field: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            [field]: value,
        }));
    };

    // Helper to persist current form step data to backend database
    const persistFormData = async (dataToSave: Record<string, any>, targetStep?: number) => {
        if (!dossierId || !activeApplicant?.id) return;
        try {
            const currentProgress = calculateFormProgress(dataToSave);
            const currentStatus = currentProgress >= 100 ? 'completed' : currentProgress > 0 ? 'in-progress' : 'not-started';

            await dossierService.updateApplicantForm(dossierId, activeApplicant.id, {
                ...dataToSave,
                step: targetStep || currentFormStep,
                formProgress: currentProgress,
            });

            // Update local applicants list in state
            setApplicants(prev => prev.map(a => {
                if (a.id === activeApplicant.id) {
                    return {
                        ...a,
                        firstName: dataToSave.firstName || a.firstName,
                        lastName: dataToSave.lastName || a.lastName,
                        passportNumber: dataToSave.passportNumber || a.passportNumber,
                        progress: currentProgress,
                        status: currentStatus,
                        formData: { ...dataToSave },
                    };
                }
                return a;
            }));

            // If primary applicant changed names, refresh user session in sidebar
            if (activeApplicant.type === 'Primary' && (dataToSave.firstName || dataToSave.lastName)) {
                refreshUser();
            }
        } catch (err) {
            console.warn('Auto-save form data warning:', err);
        }
    };

    // Save step draft & advance
    const handleSaveAndNext = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const isFinalStep = currentFormStep === 5;
            const currentProgress = isFinalStep ? 100 : calculateFormProgress(formData);
            const currentStatus = (isFinalStep || currentProgress >= 100) ? 'completed' : currentProgress > 0 ? 'in-progress' : 'not-started';

            if (dossierId && activeApplicant?.id) {
                await dossierService.updateApplicantForm(dossierId, activeApplicant.id, {
                    ...formData,
                    step: currentFormStep,
                    formProgress: currentProgress,
                });
            }

            // Update local applicant in state
            setApplicants(prev => prev.map(a => {
                if (a.id === activeApplicant?.id) {
                    return {
                        ...a,
                        firstName: formData.firstName || a.firstName,
                        lastName: formData.lastName || a.lastName,
                        passportNumber: formData.passportNumber || a.passportNumber,
                        progress: currentProgress,
                        status: currentStatus,
                        formData: { ...formData },
                    };
                }
                return a;
            }));

            if (activeApplicant?.type === 'Primary' && (formData.firstName || formData.lastName)) {
                refreshUser();
            }

            if (currentFormStep < 5) {
                setCurrentFormStep(prev => prev + 1);
                showSuccess(`Step ${currentFormStep} saved. Proceeding to Step ${currentFormStep + 1}...`);
            } else {
                showSuccess('Official Schengen Application Form completed & saved successfully!');
                handleBackToList();
            }
        } catch (err: any) {
            console.warn('Draft save error:', err);
            if (currentFormStep < 5) {
                setCurrentFormStep(prev => prev + 1);
            } else {
                handleBackToList();
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleBackToList = () => {
        setView('list');
        setActiveApplicant(null);
        loadApplicantsFromBackend();
    };

    // Confirm adding a new co-applicant
    const handleConfirmAddApplicant = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFirstName.trim()) {
            showError('Please enter applicant given name.');
            return;
        }
        if (!newPassportNumber.trim()) {
            showError('Please enter applicant passport number.');
            return;
        }
        const fn = newFirstName.trim();
        const ln = newLastName.trim();
        const pNum = newPassportNumber.trim().toUpperCase();
        const nat = newNationality.trim() || 'Azerbaijan';

        if (dossierId) {
            try {
                await dossierService.addApplicants(dossierId, [{
                    firstName: fn,
                    lastName: ln,
                    passportNumber: pNum,
                    nationality: nat,
                    formDataJson: {
                        firstName: fn,
                        lastName: ln,
                        passportNumber: pNum,
                        nationality: nat,
                    }
                }]);

                showSuccess(`Co-applicant ${fn} ${ln} added to dossier!`);
                await loadApplicantsFromBackend();
                setNewFirstName('');
                setNewLastName('');
                setNewPassportNumber('');
                setNewNationality('Azerbaijan');
                setIsAddModalOpen(false);
                return;
            } catch (err: any) {
                console.warn('Backend add applicant error:', err);
                showError(err?.response?.data?.message || 'Failed to add applicant');
            }
        }
    };

    // Remove Co-Applicant (Backend + Frontend)
    const handleRemoveApplicant = async (appId: string) => {
        const appToRemove = applicants.find(a => a.id === appId);
        if (!window.confirm(`Are you sure you want to remove ${appToRemove?.firstName} ${appToRemove?.lastName}?`)) {
            return;
        }

        if (dossierId && appId && !appId.startsWith('app-') && !appId.includes('default')) {
            try {
                await dossierService.deleteApplicant(dossierId, appId);
                showSuccess('Applicant removed successfully from dossier.');
                loadApplicantsFromBackend();
                return;
            } catch (err: any) {
                console.warn('Backend delete applicant warning:', err);
            }
        }

        setApplicants(prev => prev.filter(a => a.id !== appId));
        showSuccess('Applicant removed.');
    };

    const handleDownloadPdf = async (app: ApplicantData) => {
        const isCurrentlyEditing = activeApplicant?.id === app.id;
        const appForm = {
            ...(app.formData || {}),
            ...(isCurrentlyEditing ? formData : {}),
            firstName: isCurrentlyEditing ? (formData.firstName || app.firstName) : app.firstName,
            lastName: isCurrentlyEditing ? (formData.lastName || app.lastName) : app.lastName,
            passportNumber: isCurrentlyEditing ? (formData.passportNumber || app.passportNumber) : app.passportNumber,
            nationality: isCurrentlyEditing ? (formData.nationality || app.nationality) : app.nationality,
            gender: isCurrentlyEditing ? (formData.gender || app.gender) : app.gender,
            birthDate: isCurrentlyEditing ? (formData.birthDate || app.birthDate) : app.birthDate,
            homePhone: isCurrentlyEditing ? (formData.homePhone !== undefined ? formData.homePhone : app.formData?.homePhone) : app.formData?.homePhone,
        };
        try {
            const res = await dossierService.getApplicationFormPdf(dossierId || 'demo', app.id, appForm);
            if (res.data?.downloadUrl) {
                const fullUrl = res.data.downloadUrl.startsWith('http')
                    ? res.data.downloadUrl
                    : `http://localhost:5000${res.data.downloadUrl}`;
                
                // Fetch blob directly to ensure clean file download without browser popup-blocking
                const fileRes = await fetch(fullUrl);
                if (!fileRes.ok) {
                    throw new Error(`File fetch failed with status ${fileRes.status}`);
                }
                const blob = await fileRes.blob();
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = res.data.fileName || `Application_Form_${app.firstName}_${app.lastName}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
                showSuccess(`Official Application Form (PDF) downloaded for ${app.firstName} ${app.lastName}!`);
                setIsDownloadModalOpen(false);
                return;
            }
        } catch (err) {
            console.error('Download PDF error:', err);
            showError('PDF yüklənərkən xəta baş verdi. Zəhmət olmasa yenidən cəhd edin.');
        }
    };

    // Download Application Data Sheet (Excel / CSV with UTF-8 BOM)
    const handleDownloadExcel = (app: ApplicantData) => {
        const appForm = app.formData || formData;
        const rows = [
            ['EUROTECH VISA & IMMIGRATION SERVICES - SCHENGEN APPLICATION DATA SHEET'],
            ['Export Timestamp', new Date().toISOString()],
            [''],
            ['SECTION', 'FIELD NAME', 'FIELD VALUE'],
            ['1. Identification', 'Applicant Type', app.type],
            ['1. Identification', 'First Name (Given Name)', app.firstName],
            ['1. Identification', 'Last Name (Surname)', app.lastName],
            ['1. Identification', 'Surname at Birth', appForm.birthSurname || app.lastName],
            ['1. Identification', 'Date of Birth', appForm.birthDate || '—'],
            ['1. Identification', 'Place of Birth', appForm.birthPlace || '—'],
            ['1. Identification', 'Country of Birth', appForm.birthCountry || '—'],
            ['1. Identification', 'Current Nationality', appForm.nationality || 'Azerbaijan'],
            ['1. Identification', 'Gender', appForm.gender || '—'],
            ['1. Identification', 'Marital Status', appForm.maritalStatus || '—'],
            ['1. Identification', 'National ID / FIN', appForm.nationalId || '—'],
            ['2. Travel Document', 'Document Type', appForm.passportType || 'Ordinary passport'],
            ['2. Travel Document', 'Passport Number', (appForm.passportNumber || '—').toUpperCase()],
            ['2. Travel Document', 'Date of Issue', appForm.issueDate || '—'],
            ['2. Travel Document', 'Valid Until (Expiry)', appForm.passportExpiry || '—'],
            ['2. Travel Document', 'Issued By Authority', appForm.issuedBy || '—'],
            ['3. Trip Plans', 'Main Purpose of Visit', appForm.purpose || '—'],
            ['3. Trip Plans', 'Destination Member State', appForm.destination || '—'],
            ['3. Trip Plans', 'First Entry Member State', appForm.firstEntry || '—'],
            ['3. Trip Plans', 'Entries Requested', appForm.entriesRequested || 'Single'],
            ['3. Trip Plans', 'Intended Date of Arrival', appForm.arrivalDate || '—'],
            ['3. Trip Plans', 'Intended Date of Departure', appForm.departureDate || '—'],
            ['3. Trip Plans', 'Duration of Stay (Days)', appForm.durationOfStay || '—'],
            ['4. Stay & Inviting', 'Inviting Host / Hotel', appForm.invitingParty || '—'],
            ['4. Stay & Inviting', 'Accommodation Address', appForm.address || '—'],
            ['4. Stay & Inviting', 'Host Contact Email', appForm.stayEmail || '—'],
            ['4. Stay & Inviting', 'Host Contact Phone', appForm.stayPhone || '—'],
            ['4. Stay & Inviting', 'Cost Covered By', appForm.costCoveredBy || 'By applicant himself'],
            ['4. Stay & Inviting', 'Means of Support', appForm.meansOfSupport || '—'],
            ['5. Contacts & Job', 'Home Address', appForm.homeAddress || '—'],
            ['5. Contacts & Job', 'Applicant Email', appForm.homeEmail || user?.email || '—'],
            ['5. Contacts & Job', 'Applicant Telephone', appForm.homePhone || user?.phone || '—'],
            ['5. Contacts & Job', 'Current Occupation', appForm.currentOccupation || '—'],
            ['5. Contacts & Job', 'Employer / University Name', appForm.employerName || '—'],
            ['5. Contacts & Job', 'Employer Address & Tel', appForm.employerAddress || '—'],
            ['Application Status', 'Form Progress', `${app.progress}%`],
            ['Application Status', 'Submission Status', app.status.toUpperCase()],
        ];

        const csvContent = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Application_Sheet_${app.firstName}_${app.lastName}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showSuccess(`Application data for ${app.firstName} ${app.lastName} exported to Excel!`);
        setIsDownloadModalOpen(false);
    };

    // List View
    if (view === 'list') {
        return (
            <div className="app-form-content fade-in">
                <div className="app-form-header">
                    <div className="header-text">
                        <h1 className="docs-title">Applications</h1>
                        <p className="docs-subtitle">Select an applicant below to complete their official consular application form.</p>
                    </div>
                    <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        + New Applicant
                    </button>
                </div>

                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                        <div style={{ width: 42, height: 42, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#3b82f6', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }}></div>
                        <p style={{ color: 'var(--color-neutral)', fontSize: '0.95rem' }}>Verilənlər bazasından məlumatlar oxunur...</p>
                    </div>
                ) : applicants.length === 0 ? (
                    <div className="empty-state-card" style={{ textAlign: 'center', padding: '60px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.12)' }}>
                        <p style={{ color: 'var(--color-neutral)', fontSize: '1rem', marginBottom: '16px' }}>Bu dosye üzrə qeydiyyatdan keçmiş ərizəçi tapılmadı.</p>
                        <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>+ Yeni Ərizəçi Əlavə Edin</button>
                    </div>
                ) : (
                    <div className="applicants-grid-view">
                        {applicants.map(app => (
                            <div key={app.id} className="applicant-profile-card">
                                <div className="profile-card-header">
                                    <div className="profile-avatar">
                                        {(app.firstName.charAt(0) || 'A')}{(app.lastName.charAt(0) || 'P')}
                                    </div>
                                    <div className="profile-info">
                                        <h3>{app.firstName} {app.lastName}</h3>
                                        <span className="profile-type">{app.type.toUpperCase()}</span>
                                    </div>
                                    <div className={`profile-status ${app.status}`}>
                                        {app.status === 'completed' ? 'COMPLETED' : app.status === 'in-progress' ? 'IN PROGRESS' : 'NOT STARTED'}
                                    </div>
                                </div>
                                
                                <div className="profile-progress-bar">
                                    <div className="progress-fill" style={{ width: `${app.progress}%` }}></div>
                                </div>
                                
                                <div className="profile-card-actions">
                                    <div className="progress-text">{app.progress}% Complete</div>
                                    <div className="action-buttons">
                                        <button 
                                            className="btn-icon-action" 
                                            title="Edit Official Application Form" 
                                            onClick={() => handleEditApplicant(app)}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                        </button>
                                        
                                        <button 
                                            className="btn-icon-action" 
                                            title="Download Application Form (PDF / Excel)" 
                                            onClick={() => {
                                                setDownloadTargetApp(app);
                                                setIsDownloadModalOpen(true);
                                            }}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                        </button>
                                        
                                        {app.type !== 'Primary' && (
                                            <button 
                                                className="btn-icon-action danger" 
                                                title="Remove Co-Applicant" 
                                                onClick={() => handleRemoveApplicant(app.id)}
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* --- ADD APPLICANT MODAL --- */}
                {isAddModalOpen && (
                    <div className="premium-modal-overlay fade-in" onClick={() => setIsAddModalOpen(false)}>
                        <div className="premium-modal-container slide-up" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <div className="modal-header-info">
                                    <span className="modal-badge">Visa Dossier</span>
                                    <h2>Add Co-Applicant</h2>
                                </div>
                                <button className="btn-modal-close" onClick={() => setIsAddModalOpen(false)}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                            </div>

                            <form onSubmit={handleConfirmAddApplicant}>
                                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <p style={{ fontSize: '0.88rem', color: 'var(--color-neutral)' }}>
                                        Dosyenizə yeni ailə üzvü və ya səyahət yoldaşı əlavə edin.
                                    </p>
                                    <div className="wizard-input-group">
                                        <label>Ad (Given Name) *</label>
                                        <input 
                                            type="text" 
                                            value={newFirstName} 
                                            onChange={(e) => setNewFirstName(e.target.value)} 
                                            className="premium-input" 
                                            placeholder="Məs. Əli" 
                                            required 
                                            autoFocus
                                        />
                                    </div>
                                    <div className="wizard-input-group">
                                        <label>Soyad (Surname) *</label>
                                        <input 
                                            type="text" 
                                            value={newLastName} 
                                            onChange={(e) => setNewLastName(e.target.value)} 
                                            className="premium-input" 
                                            placeholder="Məs. Əliyev" 
                                            required 
                                        />
                                    </div>
                                    <div className="wizard-input-group">
                                        <label>Xarici Pasport Nömrəsi *</label>
                                        <input 
                                            type="text" 
                                            value={newPassportNumber} 
                                            onChange={(e) => setNewPassportNumber(e.target.value)} 
                                            className="premium-input" 
                                            placeholder="Məs. C00000000" 
                                            required
                                        />
                                    </div>
                                    <div className="wizard-input-group">
                                        <label>Vətəndaşlıq</label>
                                        <input 
                                            type="text" 
                                            value={newNationality} 
                                            onChange={(e) => setNewNationality(e.target.value)} 
                                            className="premium-input" 
                                            placeholder="Azerbaijan" 
                                        />
                                    </div>
                                </div>

                                <div className="modal-footer" style={{ marginTop: '16px' }}>
                                    <button type="button" className="btn-modal-secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                                    <button type="submit" className="btn-modal-primary">Add Applicant</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* --- DOWNLOAD FORMAT MODAL (PDF / EXCEL) --- */}
                {isDownloadModalOpen && downloadTargetApp && (
                    <div className="premium-modal-overlay fade-in" onClick={() => setIsDownloadModalOpen(false)}>
                        <div className="premium-modal-container slide-up" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <div className="modal-header-info">
                                    <span className="modal-badge">Official Consular Export</span>
                                    <h2>Export Application Dossier</h2>
                                </div>
                                <button className="btn-modal-close" onClick={() => setIsDownloadModalOpen(false)}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                            </div>

                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <p style={{ fontSize: '0.9rem', color: 'var(--color-neutral)' }}>
                                    Select the preferred document export format for <strong>{downloadTargetApp.firstName} {downloadTargetApp.lastName}</strong>:
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {/* Format 1: Official PDF */}
                                    <button 
                                        type="button" 
                                        onClick={() => handleDownloadPdf(downloadTargetApp)} 
                                        className="format-select-card"
                                        style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', cursor: 'pointer', textAlign: 'left' }}
                                    >
                                        <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 24, height: 24 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <strong style={{ fontSize: '0.95rem', color: 'var(--color-primary)' }}>Official Application Form (PDF)</strong>
                                                <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>.PDF</span>
                                            </div>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--color-neutral)', display: 'block', marginTop: 2 }}>
                                                Print-ready Schengen Annex I official application form with verified security seals.
                                            </span>
                                        </div>
                                    </button>

                                    {/* Format 2: Excel Spreadsheet */}
                                    <button 
                                        type="button" 
                                        onClick={() => handleDownloadExcel(downloadTargetApp)} 
                                        className="format-select-card"
                                        style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', cursor: 'pointer', textAlign: 'left' }}
                                    >
                                        <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 24, height: 24 }}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <strong style={{ fontSize: '0.95rem', color: 'var(--color-primary)' }}>Consular Data Sheet (Excel / CSV)</strong>
                                                <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>.CSV / .XLS</span>
                                            </div>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--color-neutral)', display: 'block', marginTop: 2 }}>
                                                Tabular dataset compatible with Microsoft Excel, containing all applicant form fields.
                                            </span>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-modal-secondary" onClick={() => setIsDownloadModalOpen(false)}>Close</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // 2. Edit Form View (5-Step Horizontal Line Stepper & Official Schengen Fields)
    const formSteps = [
        { id: 1, title: '1. Your plans' },
        { id: 2, title: '2. Your information' },
        { id: 3, title: '3. Travel document' },
        { id: 4, title: '4. Your stay & sponsor' },
        { id: 5, title: '5. Contacts & job' }
    ];

    return (
        <div className="app-form-content fade-in">
            {/* Header: Back Button & Applicant Name */}
            <div className="edit-form-header">
                <button className="btn-back-link" onClick={async () => {
                    await persistFormData(formData);
                    handleBackToList();
                }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                    Back to Applicants
                </button>
                <div className="active-applicant-badge">
                    Editing Application: <strong>{activeApplicant?.firstName} {activeApplicant?.lastName}</strong> ({activeApplicant?.type})
                </div>
            </div>

            {/* Horizontal Line Stepper */}
            <div className="horizontal-stepper-wrapper">
                {formSteps.map(step => (
                    <div 
                        key={step.id} 
                        className={`stepper-item-horiz ${currentFormStep === step.id ? 'active' : ''} ${currentFormStep > step.id ? 'completed' : ''}`}
                        onClick={async () => {
                            await persistFormData(formData, step.id);
                            setCurrentFormStep(step.id);
                        }}
                    >
                        <span className="stepper-label">{step.title}</span>
                        <div className="stepper-line"></div>
                    </div>
                ))}
            </div>

            {/* Form Content Area (Centered) */}
            <div className="form-centered-container">
                <form className="step-form-card fade-in" onSubmit={handleSaveAndNext}>
                    
                    {/* STEP 1: Your Plans */}
                    {currentFormStep === 1 && (
                        <div className="step-content-block">
                            <h2>1. Your Plans & Trip Information</h2>
                            <p className="app-step-desc">Provide particulars regarding the main purpose and duration of your intended stay in the Schengen Area.</p>
                            
                            <div className="client-form-grid">
                                <div className="client-input-group full-width">
                                    <label>Main Purpose(s) of the Journey</label>
                                    <select 
                                        className="client-input"
                                        value={formData.purpose || 'Tourism'}
                                        onChange={(e) => handleFieldChange('purpose', e.target.value)}
                                        required
                                    >
                                        <option value="Tourism">Tourism (Vacation / Leisure)</option>
                                        <option value="Business">Business (Conferences, Meetings)</option>
                                        <option value="Visiting family/friends">Visiting Family or Friends</option>
                                        <option value="Cultural">Cultural Event</option>
                                        <option value="Sports">Sports Competition</option>
                                        <option value="Official visit">Official Government Visit</option>
                                        <option value="Medical reasons">Medical Treatment</option>
                                        <option value="Study">Study / Educational Course</option>
                                        <option value="Transit">Airport Transit</option>
                                        <option value="Other">Other Reasons</option>
                                    </select>
                                </div>

                                <div className="client-input-group">
                                    <label>Member State of Main Destination</label>
                                    <select 
                                        className="client-input"
                                        value={formData.destination || 'Hungary'}
                                        onChange={(e) => handleFieldChange('destination', e.target.value)}
                                    >
                                        <option value="Hungary">Hungary</option>
                                        <option value="Germany">Germany</option>
                                        <option value="Austria">Austria</option>
                                        <option value="France">France</option>
                                        <option value="Italy">Italy</option>
                                        <option value="Spain">Spain</option>
                                        <option value="Czech Republic">Czech Republic</option>
                                        <option value="Poland">Poland</option>
                                    </select>
                                </div>

                                <div className="client-input-group">
                                    <label>Member State of First Entry</label>
                                    <select 
                                        className="client-input"
                                        value={formData.firstEntry || 'Hungary'}
                                        onChange={(e) => handleFieldChange('firstEntry', e.target.value)}
                                    >
                                        <option value="Hungary">Hungary</option>
                                        <option value="Germany">Germany</option>
                                        <option value="Austria">Austria</option>
                                        <option value="Turkey (Transit)">Turkey (Transit)</option>
                                        <option value="Poland">Poland</option>
                                    </select>
                                </div>

                                <div className="client-input-group">
                                    <label>Number of Entries Requested</label>
                                    <select 
                                        className="client-input"
                                        value={formData.entriesRequested || 'Single'}
                                        onChange={(e) => handleFieldChange('entriesRequested', e.target.value)}
                                    >
                                        <option value="Single">Single Entry (1)</option>
                                        <option value="Two">Two Entries (2)</option>
                                        <option value="Multiple">Multiple Entries (90 Days)</option>
                                    </select>
                                </div>

                                <div className="client-input-group">
                                    <label>Duration of Intended Stay (Days)</label>
                                    <input 
                                        type="number" 
                                        className="client-input" 
                                        value={formData.durationOfStay || '10'}
                                        onChange={(e) => handleFieldChange('durationOfStay', e.target.value)}
                                        min="1" 
                                        max="90" 
                                    />
                                </div>

                                <div className="client-input-group">
                                    <label>Intended Date of Arrival</label>
                                    <input 
                                        type="date" 
                                        className="client-input" 
                                        value={formData.arrivalDate || ''}
                                        onChange={(e) => handleFieldChange('arrivalDate', e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="client-input-group">
                                    <label>Intended Date of Departure</label>
                                    <input 
                                        type="date" 
                                        className="client-input" 
                                        value={formData.departureDate || ''}
                                        onChange={(e) => handleFieldChange('departureDate', e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Personal Information */}
                    {currentFormStep === 2 && (
                        <div className="step-content-block">
                            <h2>2. Personal Details of the Applicant</h2>
                            <p className="app-step-desc">Enter your full identity details exactly as shown in your biometric passport.</p>
                            
                            <div className="client-form-grid">
                                <div className="client-input-group">
                                    <label>First Name (Given Name)</label>
                                    <input 
                                        type="text" 
                                        className="client-input" 
                                        value={formData.firstName || ''}
                                        onChange={(e) => handleFieldChange('firstName', e.target.value)}
                                        required 
                                    />
                                </div>

                                <div className="client-input-group">
                                    <label>Last Name (Surname)</label>
                                    <input 
                                        type="text" 
                                        className="client-input" 
                                        value={formData.lastName || ''}
                                        onChange={(e) => handleFieldChange('lastName', e.target.value)}
                                        required 
                                    />
                                </div>

                                <div className="client-input-group">
                                    <label>Surname at Birth (Previous Name)</label>
                                    <input 
                                        type="text" 
                                        className="client-input" 
                                        value={formData.birthSurname || ''}
                                        onChange={(e) => handleFieldChange('birthSurname', e.target.value)}
                                        placeholder="Optional if unchanged" 
                                    />
                                </div>

                                <div className="client-input-group">
                                    <label>Date of Birth</label>
                                    <input 
                                        type="date" 
                                        className="client-input" 
                                        value={formData.birthDate || ''}
                                        onChange={(e) => handleFieldChange('birthDate', e.target.value)}
                                        required 
                                    />
                                </div>

                                <div className="client-input-group">
                                    <label>Place of Birth (City)</label>
                                    <input 
                                        type="text" 
                                        className="client-input" 
                                        value={formData.birthPlace || ''}
                                        onChange={(e) => handleFieldChange('birthPlace', e.target.value)}
                                        placeholder="e.g. Baku" 
                                    />
                                </div>

                                <div className="client-input-group">
                                    <label>Country of Birth</label>
                                    <input 
                                        type="text" 
                                        className="client-input" 
                                        value={formData.birthCountry || 'Azerbaijan'}
                                        onChange={(e) => handleFieldChange('birthCountry', e.target.value)}
                                    />
                                </div>

                                <div className="client-input-group">
                                    <label>Current Nationality</label>
                                    <select 
                                        className="client-input"
                                        value={formData.nationality || 'Azerbaijan'}
                                        onChange={(e) => handleFieldChange('nationality', e.target.value)}
                                    >
                                        <option value="Azerbaijan">Azerbaijan</option>
                                        <option value="Turkey">Turkey</option>
                                        <option value="Georgia">Georgia</option>
                                        <option value="Kazakhstan">Kazakhstan</option>
                                        <option value="Uzbekistan">Uzbekistan</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>

                                <div className="client-input-group">
                                    <label>Sex (Gender)</label>
                                    <select 
                                        className="client-input"
                                        value={formData.gender || 'Male'}
                                        onChange={(e) => handleFieldChange('gender', e.target.value)}
                                    >
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </select>
                                </div>

                                <div className="client-input-group">
                                    <label>Marital Status</label>
                                    <select 
                                        className="client-input"
                                        value={formData.maritalStatus || 'Single'}
                                        onChange={(e) => handleFieldChange('maritalStatus', e.target.value)}
                                    >
                                        <option value="Single">Single</option>
                                        <option value="Married">Married</option>
                                        <option value="Divorced">Divorced</option>
                                        <option value="Widowed">Widowed</option>
                                        <option value="Separated">Separated</option>
                                    </select>
                                </div>

                                <div className="client-input-group">
                                    <label>National ID / FIN Code</label>
                                    <input 
                                        type="text" 
                                        className="client-input" 
                                        value={formData.nationalId || ''}
                                        onChange={(e) => handleFieldChange('nationalId', e.target.value.toUpperCase())}
                                        placeholder="e.g. 7A1BC23" 
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Travel Document */}
                    {currentFormStep === 3 && (
                        <div className="step-content-block">
                            <h2>3. Type & Details of Travel Document</h2>
                            <p className="app-step-desc">Provide passport specifications required for border control validation.</p>
                            
                            <div className="client-form-grid">
                                <div className="client-input-group full-width">
                                    <label>Type of Travel Document</label>
                                    <select 
                                        className="client-input"
                                        value={formData.passportType || 'Ordinary passport'}
                                        onChange={(e) => handleFieldChange('passportType', e.target.value)}
                                    >
                                        <option value="Ordinary passport">Ordinary Passport</option>
                                        <option value="Diplomatic passport">Diplomatic Passport</option>
                                        <option value="Service passport">Service Passport</option>
                                        <option value="Official passport">Official Passport</option>
                                        <option value="Special passport">Special Passport</option>
                                    </select>
                                </div>

                                <div className="client-input-group">
                                    <label>Passport Number</label>
                                    <input 
                                        type="text" 
                                        className="client-input" 
                                        value={formData.passportNumber || ''}
                                        onChange={(e) => handleFieldChange('passportNumber', e.target.value.toUpperCase())}
                                        placeholder="e.g. C12345678"
                                        required 
                                    />
                                </div>

                                <div className="client-input-group">
                                    <label>Issued by Authority</label>
                                    <input 
                                        type="text" 
                                        className="client-input" 
                                        value={formData.issuedBy || 'Ministry of Internal Affairs'}
                                        onChange={(e) => handleFieldChange('issuedBy', e.target.value)}
                                    />
                                </div>

                                <div className="client-input-group">
                                    <label>Date of Issue</label>
                                    <input 
                                        type="date" 
                                        className="client-input" 
                                        value={formData.issueDate || ''}
                                        onChange={(e) => handleFieldChange('issueDate', e.target.value)}
                                        required 
                                    />
                                </div>

                                <div className="client-input-group">
                                    <label>Valid Until (Expiry Date)</label>
                                    <input 
                                        type="date" 
                                        className="client-input" 
                                        value={formData.passportExpiry || ''}
                                        onChange={(e) => handleFieldChange('passportExpiry', e.target.value)}
                                        required 
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: Your Stay & Accommodation */}
                    {currentFormStep === 4 && (
                        <div className="step-content-block">
                            <h2>4. Inviting Party, Accommodation & Funding</h2>
                            <p className="app-step-desc">Enter details of the host or lodging establishment covering your stay in the Schengen Area.</p>
                            
                            <div className="client-form-grid">
                                <div className="client-input-group full-width">
                                    <label>Inviting Organization, Person, or Hotel Name</label>
                                    <input 
                                        type="text" 
                                        className="client-input" 
                                        value={formData.invitingParty || ''}
                                        onChange={(e) => handleFieldChange('invitingParty', e.target.value)}
                                        placeholder="e.g. Hotel Sas Budapest or EuroTech Kft." 
                                        required
                                    />
                                </div>

                                <div className="client-input-group full-width">
                                    <label>Full Address of Inviting Party / Hotel</label>
                                    <input 
                                        type="text" 
                                        className="client-input" 
                                        value={formData.address || ''}
                                        onChange={(e) => handleFieldChange('address', e.target.value)}
                                        placeholder="e.g. 1051 Budapest, Sas utca 12, Hungary" 
                                        required
                                    />
                                </div>

                                <div className="client-input-group">
                                    <label>Contact Email of Host / Hotel</label>
                                    <input 
                                        type="email" 
                                        className="client-input" 
                                        value={formData.stayEmail || ''}
                                        onChange={(e) => handleFieldChange('stayEmail', e.target.value)}
                                        placeholder="e.g. reservation@hotelsas.hu" 
                                    />
                                </div>

                                <div className="client-input-group">
                                    <label>Telephone of Host / Hotel</label>
                                    <input 
                                        type="tel" 
                                        className="client-input" 
                                        value={formData.stayPhone || ''}
                                        onChange={(e) => handleFieldChange('stayPhone', e.target.value)}
                                        placeholder="e.g. +36 1 234 5678" 
                                    />
                                </div>

                                <div className="client-input-group">
                                    <label>Cost of Travelling Covered By</label>
                                    <select 
                                        className="client-input"
                                        value={formData.costCoveredBy || 'By applicant himself'}
                                        onChange={(e) => handleFieldChange('costCoveredBy', e.target.value)}
                                    >
                                        <option value="By applicant himself">By Applicant Himself/Herself</option>
                                        <option value="By a sponsor (host/company)">By a Sponsor (Host / Employer / Inviting Company)</option>
                                    </select>
                                </div>

                                <div className="client-input-group">
                                    <label>Means of Financial Support</label>
                                    <select 
                                        className="client-input"
                                        value={formData.meansOfSupport || 'Credit card & Cash'}
                                        onChange={(e) => handleFieldChange('meansOfSupport', e.target.value)}
                                    >
                                        <option value="Credit card & Cash">Credit Card & Cash</option>
                                        <option value="Credit Card">Credit Card</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Pre-paid accommodation">Pre-paid Accommodation</option>
                                        <option value="Pre-paid transport">Pre-paid Transport</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 5: Contacts & Employment */}
                    {currentFormStep === 5 && (
                        <div className="step-content-block">
                            <h2>5. Contact Information & Current Employment</h2>
                            <p className="app-step-desc">Enter your domestic residential address and current occupational details.</p>
                            
                            <div className="client-form-grid">
                                <div className="client-input-group full-width">
                                    <label>Permanent Residential Address</label>
                                    <input 
                                        type="text" 
                                        className="client-input" 
                                        value={formData.homeAddress || ''}
                                        onChange={(e) => handleFieldChange('homeAddress', e.target.value)}
                                        placeholder="e.g. Nizami str. 45, Apt 12, Baku, Azerbaijan" 
                                        required
                                    />
                                </div>

                                <div className="client-input-group">
                                    <label>Applicant Email Address</label>
                                    <input 
                                        type="email" 
                                        className="client-input" 
                                        value={formData.homeEmail || ''}
                                        onChange={(e) => handleFieldChange('homeEmail', e.target.value)}
                                        placeholder="e.g. applicant@email.com" 
                                        required
                                    />
                                </div>

                                <div className="client-input-group">
                                    <label>Applicant Telephone Number</label>
                                    <input 
                                        type="tel" 
                                        className="client-input" 
                                        value={formData.homePhone || ''}
                                        onChange={(e) => handleFieldChange('homePhone', e.target.value)}
                                        placeholder="+994 (__) ___-__-__" 
                                        required
                                    />
                                </div>

                                <div className="client-input-group">
                                    <label>Current Occupation / Job Title</label>
                                    <input 
                                        type="text" 
                                        className="client-input" 
                                        value={formData.currentOccupation || ''}
                                        onChange={(e) => handleFieldChange('currentOccupation', e.target.value)}
                                        placeholder="e.g. Senior Software Engineer / Manager / Student" 
                                    />
                                </div>

                                <div className="client-input-group">
                                    <label>Employer or Educational Institution Name</label>
                                    <input 
                                        type="text" 
                                        className="client-input" 
                                        value={formData.employerName || ''}
                                        onChange={(e) => handleFieldChange('employerName', e.target.value)}
                                        placeholder="e.g. EuroTech Global Technologies MMC" 
                                    />
                                </div>

                                <div className="client-input-group full-width">
                                    <label>Employer Address & Contact Phone</label>
                                    <input 
                                        type="text" 
                                        className="client-input" 
                                        value={formData.employerAddress || ''}
                                        onChange={(e) => handleFieldChange('employerAddress', e.target.value)}
                                        placeholder="e.g. Nobel Ave 15, Baku, (+994 12 404 0000)" 
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="step-form-footer">
                        <button 
                            type="button" 
                            className="btn-secondary" 
                            onClick={async () => {
                                await persistFormData(formData, currentFormStep - 1);
                                setCurrentFormStep(prev => prev - 1);
                            }}
                            disabled={currentFormStep === 1 || isSaving}
                        >
                            Previous
                        </button>
                        
                        <button type="submit" className="btn-primary" disabled={isSaving}>
                            {isSaving ? (
                                <>
                                    <svg className="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
                                    Saving...
                                </>
                            ) : (
                                <>{currentFormStep === 5 ? 'Save & Finish' : 'Save & Next'}</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}