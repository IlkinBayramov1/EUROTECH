import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { corporateService } from '@/shared/api/services/corporate.service';
import { documentService } from '@/shared/api/services';
import { useToast } from '@/shared/context/ToastContext';
import './CorporateBatches.css';

// --- Tiplər ---
export interface EmployeeDoc {
    id: string;
    requiredDocumentType: string;
    fileUrl: string;
    fileName?: string;
    originalFileName?: string;
    status: 'PENDING' | 'VERIFIED' | 'NEEDS_CORRECTION' | 'REJECTED';
    operatorNotes?: string;
    createdAt?: string;
}

export interface Employee {
    id: string;
    dossierId?: string;
    fullName: string;
    firstName?: string;
    lastName?: string;
    passport: string;
    passportNumber?: string;
    dob?: string;
    expiryDate?: string;
    status: 'pending' | 'verified' | 'action_req';
    formProgress: number;
    documents: EmployeeDoc[];
    formDataJson?: any;
}

export interface Batch {
    id: string;
    code?: string;
    name: string;
    destination: string;
    travelDate: string;
    duration: 'short' | 'long';
    projectReason: string;
    createdDate: string;
    status: 'draft' | 'processing' | 'ready';
    employees: Employee[];
    dossierId?: string;
}

const REQUIRED_CORP_DOCS = [
    { type: 'PASSPORT', title: 'Valid Passport Copy', desc: 'High resolution color scan of primary bio-data page.' },
    { type: 'EMPLOYMENT_LETTER', title: 'Official Employment Letter', desc: 'Official HR letter verifying position, tenure and approved corporate travel.' },
    { type: 'INSURANCE', title: 'Corporate Travel Insurance', desc: 'International travel insurance covering medical emergency and repatriation.' },
    { type: 'TRAVEL_ORDER', title: 'Corporate Travel Order / Mission Order', desc: 'Internal company delegation decree signed and sealed by management.' },
];

export default function CorporateBatches() {
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast();

    // --- State-lər ---
    const [view, setView] = useState<'list' | 'manage'>('list');
    const [batches, setBatches] = useState<Batch[]>([]);
    const [activeBatch, setActiveBatch] = useState<Batch | null>(null);
    const [activeEmployee, setActiveEmployee] = useState<Employee | null>(null);
    const [loading, setLoading] = useState(true);
    
    // Manage View State-ləri
    const [manageTab, setManageTab] = useState<'form' | 'docs'>('form');
    const [currentFormStep, setCurrentFormStep] = useState(1);
    const [isSaving, setIsSaving] = useState(false);
    const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
    const [targetUploadType, setTargetUploadType] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Filter & Search State-ləri
    const [searchQuery, setSearchQuery] = useState('');
    const [destinationFilter, setDestinationFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');

    // Modal State-ləri
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [batchForSettings, setBatchForSettings] = useState<Batch | null>(null);
    const [editBatchName, setEditBatchName] = useState('');

    // Employee Form Data
    const [employeeFormData, setEmployeeFormData] = useState({
        firstName: '',
        lastName: '',
        passportNumber: '',
        dob: '',
        expiryDate: '',
        jobTitle: '',
        department: '',
        hotelAccommodation: '',
        specialNotes: '',
    });

    // Qrupları Verilənlər Bazasından Yükləmə Funksiyası
    const fetchBatches = async () => {
        try {
            setLoading(true);
            const res = await corporateService.getBatches();
            if (res.data?.batches) {
                const mapped: Batch[] = res.data.batches.map((b: any) => {
                    const primaryDossier = b.dossiers?.[0] || {};
                    const primaryDossierId = primaryDossier.id || '';
                    const rawEmployees = b.employees || primaryDossier.applicants || [];

                    const mappedEmployees: Employee[] = rawEmployees.map((emp: any) => {
                        const docs: EmployeeDoc[] = (emp.documents || []).map((d: any) => ({
                            id: d.id,
                            requiredDocumentType: d.requiredDocumentType || d.type || 'DOCUMENT',
                            fileUrl: d.fileUrl,
                            fileName: d.fileName,
                            originalFileName: d.originalFileName || d.fileName,
                            status: d.status || 'PENDING',
                            operatorNotes: d.operatorNotes,
                            createdAt: d.createdAt,
                        }));

                        const hasRejected = docs.some(d => d.status === 'REJECTED');
                        const verifiedCount = docs.filter(d => d.status === 'VERIFIED').length;
                        const allVerified = docs.length >= 2 && verifiedCount === docs.length;
                        const empStatus: 'verified' | 'pending' | 'action_req' =
                            hasRejected ? 'action_req' : allVerified ? 'verified' : 'pending';

                        const formProgress = emp.formDataJson?.formProgress || (allVerified ? 100 : docs.length > 0 ? 60 : 30);

                        return {
                            id: emp.id,
                            dossierId: emp.dossierId || primaryDossierId,
                            fullName: emp.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Employee',
                            firstName: emp.firstName || '',
                            lastName: emp.lastName || '',
                            passport: emp.passportNumber || emp.passport || 'P0000000',
                            passportNumber: emp.passportNumber || emp.passport || 'P0000000',
                            dob: emp.birthDate ? String(emp.birthDate).split('T')[0] : emp.formDataJson?.dob || '',
                            expiryDate: emp.formDataJson?.expiryDate || '',
                            status: empStatus,
                            formProgress,
                            documents: docs,
                            formDataJson: emp.formDataJson || {},
                        };
                    });

                    return {
                        id: b.id,
                        code: b.code || b.id,
                        name: b.name || b.code || 'Corporate Batch',
                        destination: b.destination || 'Europe / Schengen',
                        travelDate: b.travelDate ? String(b.travelDate).split('T')[0] : 'TBD',
                        duration: b.duration || 'short',
                        projectReason: b.projectReason || 'Business / Corporate',
                        createdDate: new Date(b.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                        status: (b.status ? b.status.toLowerCase() : 'draft') as 'draft' | 'processing' | 'ready',
                        employees: mappedEmployees,
                        dossierId: primaryDossierId,
                    };
                });
                setBatches(mapped);
            } else {
                setBatches([]);
            }
        } catch (err: any) {
            console.warn('Failed to load corporate batches from backend:', err);
            setBatches([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBatches();
    }, []);

    // Mövcud Ölkələr siyahısı
    const destinations = useMemo(() => {
        const set = new Set<string>();
        batches.forEach(b => { if (b.destination) set.add(b.destination); });
        return Array.from(set);
    }, [batches]);

    // Filtrlənmiş Qruplar
    const filteredBatches = useMemo(() => {
        return batches.filter(batch => {
            const matchesQuery = searchQuery === '' ||
                batch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (batch.code && batch.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
                batch.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                batch.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
                batch.employees.some(e =>
                    e.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    e.passport.toLowerCase().includes(searchQuery.toLowerCase())
                );

            const matchesDest = destinationFilter === 'ALL' || batch.destination.toLowerCase() === destinationFilter.toLowerCase();
            const matchesStatus = statusFilter === 'ALL' || batch.status.toLowerCase() === statusFilter.toLowerCase();

            return matchesQuery && matchesDest && matchesStatus;
        });
    }, [batches, searchQuery, destinationFilter, statusFilter]);

    // --- Funksiyalar ---
    const handleManageEmployee = (batch: Batch, employee: Employee) => {
        setActiveBatch(batch);
        setActiveEmployee(employee);
        setEmployeeFormData({
            firstName: employee.firstName || employee.fullName.split(' ')[0] || '',
            lastName: employee.lastName || employee.fullName.split(' ').slice(1).join(' ') || '',
            passportNumber: employee.passportNumber || employee.passport || '',
            dob: employee.dob || '',
            expiryDate: employee.expiryDate || '',
            jobTitle: employee.formDataJson?.jobTitle || '',
            department: employee.formDataJson?.department || '',
            hotelAccommodation: employee.formDataJson?.hotelAccommodation || '',
            specialNotes: employee.formDataJson?.specialNotes || '',
        });
        setManageTab('form');
        setCurrentFormStep(1);
        setView('manage');
    };

    const handleBackToList = () => {
        setView('list');
        setActiveBatch(null);
        setActiveEmployee(null);
    };

    const handleSubmitBatch = async (batchId: string) => {
        try {
            await corporateService.submitBatch(batchId);
            await corporateService.generateInvoice(batchId);
            showSuccess('Batch successfully submitted! Invoice generated.');
            await fetchBatches();
            navigate('/corporate/finance');
        } catch (err: any) {
            console.error('Batch submit error:', err);
            showError(err.message || 'Failed to submit batch.');
        }
    };

    const handleSaveForm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeBatch || !activeEmployee) return;

        setIsSaving(true);
        try {
            const payload = {
                firstName: employeeFormData.firstName,
                lastName: employeeFormData.lastName,
                passportNumber: employeeFormData.passportNumber,
                dob: employeeFormData.dob,
                expiryDate: employeeFormData.expiryDate,
                jobTitle: employeeFormData.jobTitle,
                department: employeeFormData.department,
                hotelAccommodation: employeeFormData.hotelAccommodation,
                specialNotes: employeeFormData.specialNotes,
                formProgress: Math.min(100, currentFormStep * 25),
            };

            await corporateService.saveEmployeeForm(activeBatch.id, activeEmployee.id, payload);

            setActiveEmployee(prev => prev ? {
                ...prev,
                firstName: employeeFormData.firstName,
                lastName: employeeFormData.lastName,
                fullName: `${employeeFormData.firstName} ${employeeFormData.lastName}`.trim() || prev.fullName,
                passport: employeeFormData.passportNumber || prev.passport,
                passportNumber: employeeFormData.passportNumber || prev.passportNumber,
                dob: employeeFormData.dob,
                expiryDate: employeeFormData.expiryDate,
                formDataJson: { ...prev.formDataJson, ...payload },
                formProgress: Math.min(100, currentFormStep * 25),
            } : null);

            if (currentFormStep < 4) {
                setCurrentFormStep(prev => prev + 1);
                showSuccess(`Step ${currentFormStep} data saved to database! Proceeding to next step.`);
            } else {
                showSuccess('Employee dossier successfully updated in database!');
            }
            await fetchBatches();
        } catch (err: any) {
            showError(err.message || 'Failed to save employee dossier form.');
        } finally {
            setIsSaving(false);
        }
    };

    const triggerUpload = (docType: string) => {
        setTargetUploadType(docType);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeEmployee || !activeBatch) return;

        setUploadingDocType(targetUploadType);
        try {
            await documentService.uploadDocument({
                dossierId: activeEmployee.dossierId || activeBatch.dossierId || '',
                applicantId: activeEmployee.id,
                requiredDocumentType: targetUploadType,
                isMandatory: true,
                file,
            });

            showSuccess(`${targetUploadType} document successfully uploaded to database!`);
            await fetchBatches();

            // Refresh active employee documents
            const refreshed = await corporateService.getBatches();
            if (refreshed.data?.batches) {
                const currBatch = refreshed.data.batches.find((b: any) => b.id === activeBatch.id);
                const rawEmpList = currBatch?.employees || currBatch?.dossiers?.[0]?.applicants || [];
                const foundEmp = rawEmpList.find((emp: any) => emp.id === activeEmployee.id);
                if (foundEmp) {
                    setActiveEmployee(prev => prev ? {
                        ...prev,
                        documents: foundEmp.documents || [],
                    } : null);
                }
            }
        } catch (err: any) {
            console.error('File upload error:', err);
            showError(err.message || 'Failed to upload document.');
        } finally {
            setUploadingDocType(null);
            setTargetUploadType('');
        }
    };

    const handleCopyDelegationLink = async (empId: string, empName: string, batchId?: string) => {
        try {
            const res = await corporateService.generateDelegationLink(empId, batchId);
            if (res.data?.delegationUrl) {
                await navigator.clipboard.writeText(res.data.delegationUrl);
                showSuccess(`Delegation link for ${empName} copied to clipboard!`);
                return;
            }
        } catch (err) {
            console.warn('Error generating delegation link:', err);
        }
        const fallbackUrl = `${window.location.origin}/corporate/delegation?token=del_${empId}`;
        await navigator.clipboard.writeText(fallbackUrl);
        showSuccess(`Delegation link for ${empName} copied to clipboard!`);
    };

    // Modal Funksiyaları
    const openSettings = (batch: Batch) => {
        setBatchForSettings(batch);
        setEditBatchName(batch.name);
        setIsSettingsOpen(true);
    };

    const closeSettings = () => {
        setIsSettingsOpen(false);
        setTimeout(() => {
            setBatchForSettings(null);
            setEditBatchName('');
        }, 300);
    };

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!batchForSettings) return;

        setIsSaving(true);
        try {
            await corporateService.updateBatch(batchForSettings.id, { name: editBatchName });
            showSuccess('Batch details successfully updated in database!');
            closeSettings();
            await fetchBatches();
        } catch (err: any) {
            showError(err.message || 'Failed to update batch');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteBatch = async () => {
        if (!batchForSettings) return;
        if (!window.confirm(`Are you sure you want to cancel and delete batch "${batchForSettings.name}" from database? This action cannot be undone.`)) return;

        setIsSaving(true);
        try {
            await corporateService.deleteBatch(batchForSettings.id);
            showSuccess('Batch and related records deleted successfully from database.');
            closeSettings();
            await fetchBatches();
        } catch (err: any) {
            showError(err.message || 'Failed to delete batch');
        } finally {
            setIsSaving(false);
        }
    };

    // --- Status İkonları ---
    const renderEmployeeStatus = (status: Employee['status']) => {
        switch (status) {
            case 'verified': return <span className="emp-status-dot verified" title="Verified"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></span>;
            case 'action_req': return <span className="emp-status-dot action-req" title="Action Required"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></span>;
            case 'pending': default: return <span className="emp-status-dot pending" title="Pending"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>;
        }
    };

    const handleExportBatchesExcel = () => {
        const headers = [
            'Batch ID',
            'Batch Name',
            'Destination',
            'Travel Date',
            'Duration',
            'Project Reason',
            'Batch Status',
            'Created Date',
            'Employee ID',
            'Employee Name',
            'Passport No',
            'Data Progress (%)',
            'Verification Status'
        ];

        const escapeCsv = (str: any) => `"${String(str || '').replace(/"/g, '""')}"`;
        const rows: string[] = [];

        batches.forEach(batch => {
            if (batch.employees.length === 0) {
                rows.push([
                    escapeCsv(batch.id),
                    escapeCsv(batch.name),
                    escapeCsv(batch.destination),
                    escapeCsv(batch.travelDate),
                    escapeCsv(batch.duration),
                    escapeCsv(batch.projectReason),
                    escapeCsv(batch.status),
                    escapeCsv(batch.createdDate),
                    escapeCsv('N/A'),
                    escapeCsv('No Employees'),
                    escapeCsv('N/A'),
                    escapeCsv('0'),
                    escapeCsv('N/A')
                ].join(','));
            } else {
                batch.employees.forEach(emp => {
                    rows.push([
                        escapeCsv(batch.id),
                        escapeCsv(batch.name),
                        escapeCsv(batch.destination),
                        escapeCsv(batch.travelDate),
                        escapeCsv(batch.duration),
                        escapeCsv(batch.projectReason),
                        escapeCsv(batch.status),
                        escapeCsv(batch.createdDate),
                        escapeCsv(emp.id),
                        escapeCsv(emp.fullName),
                        escapeCsv(emp.passport),
                        escapeCsv(emp.formProgress),
                        escapeCsv(emp.status)
                    ].join(','));
                });
            }
        });

        const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `corporate_batches_full_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showSuccess('Bütün korporativ qruplar Excel (CSV) formatında uğurla yükləndi!');
    };

    const handleExportSingleBatchExcel = (batch: Batch) => {
        const headers = [
            'Employee ID',
            'Full Name',
            'Passport Number',
            'Form Progress (%)',
            'Verification Status',
            'Batch ID',
            'Batch Name',
            'Destination'
        ];

        const escapeCsv = (str: any) => `"${String(str || '').replace(/"/g, '""')}"`;
        const rows = batch.employees.map(emp => [
            escapeCsv(emp.id),
            escapeCsv(emp.fullName),
            escapeCsv(emp.passport),
            escapeCsv(emp.formProgress),
            escapeCsv(emp.status),
            escapeCsv(batch.id),
            escapeCsv(batch.name),
            escapeCsv(batch.destination)
        ].join(','));

        const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const cleanName = batch.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        a.download = `batch_${cleanName}_roster.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showSuccess(`${batch.name} qrupunun siyahısı Excel (CSV) formatında uğurla yükləndi!`);
    };

    // ==========================================
    // RENDER: VİEW 1 - BATCH LIST
    // ==========================================
    if (view === 'list') {
        return (
            <div className="corp-batches-content fade-in">
                {/* Gizli Fayl Girişi */}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    accept=".pdf,.jpg,.jpeg,.png" 
                    onChange={handleFileSelected} 
                />

                <div className="corp-batches-header">
                    <div className="header-titles">
                        <h1 className="dash-title">Employee Batches</h1>
                        <p className="dash-subtitle">Manage corporate visa batches, track employee document uploads, and finalize submissions.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <button className="btn-secondary" onClick={handleExportBatchesExcel} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', border: '1px solid #cbd5e1', padding: '0.6rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: '#1e293b' }}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
                            Export Batches (Excel)
                        </button>
                        <button className="btn-primary" onClick={() => navigate('/corporate/create-batch')}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                            Create New Batch
                        </button>
                    </div>
                </div>

                <div className="corp-filter-bar">
                    <div className="search-input-wrapper">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input 
                            type="text" 
                            placeholder="Search by Batch Name, ID or Employee Name..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="filter-select-wrapper">
                        <select value={destinationFilter} onChange={(e) => setDestinationFilter(e.target.value)}>
                            <option value="ALL">All Destinations</option>
                            {destinations.map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>
                    <div className="filter-select-wrapper">
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="ALL">All Statuses</option>
                            <option value="draft">Awaiting Action (Draft)</option>
                            <option value="processing">Processing</option>
                            <option value="ready">Visas Ready</option>
                        </select>
                    </div>
                    {(searchQuery || destinationFilter !== 'ALL' || statusFilter !== 'ALL') && (
                        <button 
                            type="button" 
                            onClick={() => { setSearchQuery(''); setDestinationFilter('ALL'); setStatusFilter('ALL'); }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--color-secondary)', fontWeight: 600, cursor: 'pointer', padding: '0 8px' }}
                        >
                            Reset
                        </button>
                    )}
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-neutral)' }}>
                        <p>Connecting to database and fetching corporate batches...</p>
                    </div>
                ) : filteredBatches.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '56px 24px', backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                        <div style={{ width: '56px', height: '56px', margin: '0 auto 16px auto', borderRadius: '50%', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-secondary)' }}>
                            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        </div>
                        <h3 style={{ margin: '0 0 8px 0', color: 'var(--color-primary)' }}>No corporate batches found</h3>
                        <p style={{ margin: '0 0 20px 0', color: 'var(--color-neutral)', fontSize: '0.95rem' }}>
                            {batches.length === 0 ? 'You have not registered any employee visa batches yet.' : 'No batches match your active search filters.'}
                        </p>
                        <button className="btn-primary" onClick={() => navigate('/corporate/create-batch')} style={{ margin: '0 auto' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                            Create New Batch
                        </button>
                    </div>
                ) : (
                    <div className="corp-batches-list">
                        {filteredBatches.map(batch => (
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
                                                <span>ID: {batch.code || batch.id}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="batch-actions">
                                        <button className="btn-icon-action" onClick={() => handleExportSingleBatchExcel(batch)} title="Export Batch Roster (Excel)">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
                                        </button>
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
                                        <button className="btn-text add-emp-btn" onClick={() => navigate('/corporate/employees')}>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                                            Add Employee
                                        </button>
                                    </div>

                                    {batch.employees.length === 0 ? (
                                        <div style={{ padding: '24px', textAlign: 'center', color: '#64748B', backgroundColor: 'var(--color-surface)', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '0.9rem' }}>
                                            No employees registered in this batch yet. Click "Add Employee" or create a batch with assigned staff.
                                        </div>
                                    ) : (
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
                                                                    <button className="btn-icon-secondary" title="Copy Delegation Link" onClick={() => handleCopyDelegationLink(emp.id, emp.fullName, batch.id)}>
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
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

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
                                <form id="settingsForm" onSubmit={handleSaveSettings}>
                                    <div className="settings-section">
                                        <h3>Administrative Details</h3>
                                        <div className="corp-form-grid">
                                            <div className="corp-input-group full-width">
                                                <label>Batch Name (Internal Reference)</label>
                                                <input 
                                                    type="text" 
                                                    className="corp-input" 
                                                    value={editBatchName}
                                                    onChange={(e) => setEditBatchName(e.target.value)}
                                                    required 
                                                />
                                            </div>
                                            <div className="corp-input-group">
                                                <label>Destination Country</label>
                                                <input type="text" className="corp-input" defaultValue={batchForSettings.destination} disabled />
                                            </div>
                                            <div className="corp-input-group">
                                                <label>Intended Departure Date</label>
                                                <input type="text" className="corp-input" defaultValue={batchForSettings.travelDate} disabled />
                                            </div>
                                            <div className="corp-input-group">
                                                <label>Project Type</label>
                                                <input type="text" className="corp-input" defaultValue={batchForSettings.projectReason} disabled />
                                            </div>
                                            <div className="corp-input-group">
                                                <label>Batch Code</label>
                                                <input type="text" className="corp-input" defaultValue={batchForSettings.code || batchForSettings.id} disabled />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="settings-danger-zone">
                                        <div className="danger-info">
                                            <h4>Cancel Batch</h4>
                                            <p>Canceling this batch will delete all delegation dossiers, appointments and invoices associated with it from the database.</p>
                                        </div>
                                        <button 
                                            type="button" 
                                            className="btn-danger-outline"
                                            onClick={handleDeleteBatch}
                                            disabled={isSaving}
                                        >
                                            {isSaving ? 'Deleting...' : 'Cancel & Delete Batch'}
                                        </button>
                                    </div>
                                </form>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-modal-secondary" onClick={closeSettings} disabled={isSaving}>Close</button>
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
    // RENDER: VİEW 2 - MANAGE EMPLOYEE DOSSIER
    // ==========================================
    const formSteps = [
        { id: 1, title: 'Personal Info' }, 
        { id: 2, title: 'Travel Docs' }, 
        { id: 3, title: 'Employment' }, 
        { id: 4, title: 'Accommodation' }
    ];

    const uploadedDocTypes = new Set(activeEmployee?.documents.map(d => d.requiredDocumentType) || []);

    return (
        <div className="corp-batches-content fade-in">
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
                    2. Document Repository ({activeEmployee?.documents.length || 0})
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
                                <p className="step-desc">Fill out or verify the official consular data for {activeEmployee?.fullName}. All updates are persisted directly to database.</p>
                                
                                <div className="corp-form-grid">
                                    {currentFormStep === 1 && (
                                        <>
                                            <div className="corp-input-group">
                                                <label>First Name</label>
                                                <input 
                                                    type="text" 
                                                    className="corp-input" 
                                                    value={employeeFormData.firstName}
                                                    onChange={(e) => setEmployeeFormData({ ...employeeFormData, firstName: e.target.value })}
                                                    required 
                                                />
                                            </div>
                                            <div className="corp-input-group">
                                                <label>Last Name</label>
                                                <input 
                                                    type="text" 
                                                    className="corp-input" 
                                                    value={employeeFormData.lastName}
                                                    onChange={(e) => setEmployeeFormData({ ...employeeFormData, lastName: e.target.value })}
                                                    required 
                                                />
                                            </div>
                                            <div className="corp-input-group">
                                                <label>Passport Number</label>
                                                <input 
                                                    type="text" 
                                                    className="corp-input" 
                                                    value={employeeFormData.passportNumber}
                                                    onChange={(e) => setEmployeeFormData({ ...employeeFormData, passportNumber: e.target.value })}
                                                    required 
                                                />
                                            </div>
                                            <div className="corp-input-group">
                                                <label>Date of Birth</label>
                                                <input 
                                                    type="date" 
                                                    className="corp-input" 
                                                    value={employeeFormData.dob}
                                                    onChange={(e) => setEmployeeFormData({ ...employeeFormData, dob: e.target.value })}
                                                />
                                            </div>
                                        </>
                                    )}

                                    {currentFormStep === 2 && (
                                        <>
                                            <div className="corp-input-group">
                                                <label>Passport Number</label>
                                                <input 
                                                    type="text" 
                                                    className="corp-input" 
                                                    value={employeeFormData.passportNumber}
                                                    onChange={(e) => setEmployeeFormData({ ...employeeFormData, passportNumber: e.target.value })}
                                                    required 
                                                />
                                            </div>
                                            <div className="corp-input-group">
                                                <label>Passport Expiry Date</label>
                                                <input 
                                                    type="date" 
                                                    className="corp-input" 
                                                    value={employeeFormData.expiryDate}
                                                    onChange={(e) => setEmployeeFormData({ ...employeeFormData, expiryDate: e.target.value })}
                                                />
                                            </div>
                                            <div className="corp-input-group">
                                                <label>Destination Country</label>
                                                <input type="text" className="corp-input" value={activeBatch?.destination || 'Europe / Schengen'} disabled />
                                            </div>
                                            <div className="corp-input-group">
                                                <label>Intended Departure Date</label>
                                                <input type="text" className="corp-input" value={activeBatch?.travelDate || 'TBD'} disabled />
                                            </div>
                                        </>
                                    )}

                                    {currentFormStep === 3 && (
                                        <>
                                            <div className="corp-input-group">
                                                <label>Job Title / Position</label>
                                                <input 
                                                    type="text" 
                                                    className="corp-input" 
                                                    placeholder="e.g. Senior Software Engineer"
                                                    value={employeeFormData.jobTitle}
                                                    onChange={(e) => setEmployeeFormData({ ...employeeFormData, jobTitle: e.target.value })}
                                                />
                                            </div>
                                            <div className="corp-input-group">
                                                <label>Corporate Department</label>
                                                <input 
                                                    type="text" 
                                                    className="corp-input" 
                                                    placeholder="e.g. Information Technology"
                                                    value={employeeFormData.department}
                                                    onChange={(e) => setEmployeeFormData({ ...employeeFormData, department: e.target.value })}
                                                />
                                            </div>
                                            <div className="corp-input-group full-width">
                                                <label>Corporate Mission / Travel Reason</label>
                                                <input type="text" className="corp-input" value={activeBatch?.projectReason || 'Corporate Business'} disabled />
                                            </div>
                                        </>
                                    )}

                                    {currentFormStep === 4 && (
                                        <>
                                            <div className="corp-input-group full-width">
                                                <label>Accommodation / Hotel Details</label>
                                                <input 
                                                    type="text" 
                                                    className="corp-input" 
                                                    placeholder="e.g. Hilton Vienna Park, Am Stadtpark 1, Vienna"
                                                    value={employeeFormData.hotelAccommodation}
                                                    onChange={(e) => setEmployeeFormData({ ...employeeFormData, hotelAccommodation: e.target.value })}
                                                />
                                            </div>
                                            <div className="corp-input-group full-width">
                                                <label>Special Requests & Consular Notes</label>
                                                <textarea 
                                                    className="corp-input" 
                                                    rows={3}
                                                    placeholder="Additional information for consulate or internal HR records..."
                                                    value={employeeFormData.specialNotes}
                                                    onChange={(e) => setEmployeeFormData({ ...employeeFormData, specialNotes: e.target.value })}
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="step-form-footer">
                                <button type="button" className="btn-secondary" onClick={() => setCurrentFormStep(prev => prev - 1)} disabled={currentFormStep === 1}>Previous</button>
                                <button type="submit" className="btn-primary" disabled={isSaving}>
                                    {isSaving ? 'Saving to DB...' : currentFormStep === 4 ? 'Save Dossier' : 'Next Step →'}
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
                                <span className="tracker-count">{activeEmployee?.documents.length || 0} / {REQUIRED_CORP_DOCS.length} Uploaded</span>
                            </div>
                            <div className="tracker-progress-bar">
                                <div 
                                    className="progress-fill" 
                                    style={{ width: `${Math.min(100, Math.round(((activeEmployee?.documents.length || 0) / REQUIRED_CORP_DOCS.length) * 100))}%` }}
                                ></div>
                            </div>
                            <div className="tracker-items-vertical">
                                {REQUIRED_CORP_DOCS.map(doc => {
                                    const isUploaded = uploadedDocTypes.has(doc.type);
                                    const matched = activeEmployee?.documents.find(d => d.requiredDocumentType === doc.type);
                                    const isRejected = matched?.status === 'REJECTED';
                                    const isVerified = matched?.status === 'VERIFIED';

                                    return (
                                        <div key={doc.type} className={`tracker-item-vert ${isRejected ? 'rejected' : isVerified ? 'completed' : isUploaded ? 'completed' : 'pending'}`}>
                                            <div className="tracker-icon-vert">
                                                {isRejected ? (
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
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
                        {REQUIRED_CORP_DOCS.map(reqDoc => {
                            const existing = activeEmployee?.documents.find(d => d.requiredDocumentType === reqDoc.type);
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
                                            <span className={`doc-badge ${isRejected ? 'action-req' : isVerified ? 'verified' : isUploaded ? 'verified' : 'pending'}`}>
                                                {isRejected ? 'Action Required' : isVerified ? 'Verified' : isUploaded ? 'Uploaded (Pending Review)' : 'Missing'}
                                            </span>
                                        </div>
                                        <p className="doc-explanatory-text">{reqDoc.desc}</p>

                                        {isRejected && existing?.operatorNotes && (
                                            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '10px 14px', borderRadius: '8px', color: '#991B1B', fontSize: '0.85rem', marginTop: '8px' }}>
                                                <strong>Operator Feedback: </strong>{existing.operatorNotes}
                                            </div>
                                        )}

                                        {isUploaded && (existing?.originalFileName || existing?.fileName) && (
                                            <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '6px' }}>
                                                File: <strong>{existing.originalFileName || existing.fileName}</strong>
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