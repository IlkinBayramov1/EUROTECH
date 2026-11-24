import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { corporateService } from '@/shared/api/services/corporate.service';
import { documentService, dossierService } from '@/shared/api/services';
import { useToast } from '@/shared/context/ToastContext';
import { getFileUrl } from '@/shared/utils/file.util';
import SchengenQuestionnaire from '@/modules/applicant/components/SchengenQuestionnaire/SchengenQuestionnaire';
import { DEFAULT_SCHENGEN_FORM_DATA } from '@/modules/applicant/types/applicant.types';
import { usePricingCatalog } from '@/shared/hooks/usePricingCatalog';
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
    packageTier?: string;
    totalFee?: number;
    employees: Employee[];
    dossierId?: string;
}

const REQUIRED_CORP_DOCS = [
    { type: 'PASSPORT', title: 'Valid Passport Copy', desc: 'High resolution color scan of primary bio-data page.' },
    { type: 'EMPLOYMENT_LETTER', title: 'Official Employment Letter', desc: 'Official HR letter verifying position, tenure and approved corporate travel.' },
    { type: 'INSURANCE', title: 'Corporate Travel Insurance', desc: 'International travel insurance covering medical emergency and repatriation.' },
    { type: 'TRAVEL_ORDER', title: 'Corporate Travel Order / Mission Order', desc: 'Internal company delegation decree signed and sealed by management.' },
];

const REQ_CORP_DOC_TYPES = new Set(REQUIRED_CORP_DOCS.map(d => d.type));

export default function CorporateBatches() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const urlBatchId = searchParams.get('batchId');
    const { showSuccess, showError } = useToast();
    const { packages: adminPackages, calculateLiveFees } = usePricingCatalog();
    const activeAdminPackages = (adminPackages || []).filter(p => p.isActive !== false);

    // --- State-lər ---
    const [view, setView] = useState<'list' | 'manage'>('list');
    const [batches, setBatches] = useState<Batch[]>([]);
    const [activeBatch, setActiveBatch] = useState<Batch | null>(null);
    const [activeEmployee, setActiveEmployee] = useState<Employee | null>(null);
    const [loading, setLoading] = useState(true);
    
    // Manage View State-ləri
    const [manageTab, setManageTab] = useState<'form' | 'docs' | 'packages'>('form');
    const [currentFormStep, setCurrentFormStep] = useState(1);
    const [isSaving, setIsSaving] = useState(false);
    const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
    const [targetUploadType, setTargetUploadType] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const handledUrlBatchIdRef = useRef<string | null>(null);

    // Add Employee to Batch Modal state
    const [isAddEmpModalOpen, setIsAddEmpModalOpen] = useState(false);
    const [batchForAddEmp, setBatchForAddEmp] = useState<Batch | null>(null);
    const [newEmpFirstName, setNewEmpFirstName] = useState('');
    const [newEmpLastName, setNewEmpLastName] = useState('');
    const [newEmpPassport, setNewEmpPassport] = useState('');
    const [newEmpJobTitle, setNewEmpJobTitle] = useState('');
    const [newEmpDept, setNewEmpDept] = useState('');
    const [newEmpDob, setNewEmpDob] = useState('');
    const [newEmpExpiry, setNewEmpExpiry] = useState('');
    const [isAddingEmp, setIsAddingEmp] = useState(false);

    // Filter & Search State-ləri
    const [searchQuery, setSearchQuery] = useState('');
    const [destinationFilter, setDestinationFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');

    // Modal State-ləri
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [batchForSettings, setBatchForSettings] = useState<Batch | null>(null);
    const [editBatchName, setEditBatchName] = useState('');
    const [editBatchPackage, setEditBatchPackage] = useState('standard');

    // Employee Form Data (Official 37-Point Schengen Questionnaire)
    const [employeeFormData, setEmployeeFormData] = useState<Record<string, any>>({
        ...DEFAULT_SCHENGEN_FORM_DATA,
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
                            dob: emp.birthDate ? String(emp.birthDate).split('T')[0] : (emp.formDataJson?.birthDate || emp.formDataJson?.dob || ''),
                            expiryDate: emp.formDataJson?.passportExpiry || emp.formDataJson?.passportExpiryDate || emp.formDataJson?.expiryDate || '',
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
                        packageTier: String(b.packageTier || mappedEmployees[0]?.formDataJson?.package || 'standard').toLowerCase(),
                        totalFee: Number(primaryDossier.totalAmount || (mappedEmployees.length * 145) || 145),
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

    // --- Funksiyalar (Hoisted before effects) ---
    const handleManageEmployee = (batch: Batch, employee: Employee) => {
        setActiveBatch(batch);
        setActiveEmployee(employee);
        const savedForm = (employee.formDataJson && typeof employee.formDataJson === 'object') ? employee.formDataJson : {};
        const nameParts = (employee.fullName || '').trim().split(' ');
        setEmployeeFormData({
            ...DEFAULT_SCHENGEN_FORM_DATA,
            ...savedForm,
            firstName: employee.firstName || savedForm.firstName || nameParts[0] || '',
            lastName: employee.lastName || savedForm.lastName || nameParts.slice(1).join(' ') || '',
            passportNumber: employee.passportNumber || employee.passport || savedForm.passportNumber || '',
            birthDate: employee.dob || savedForm.birthDate || savedForm.dob || '',
            passportExpiry: employee.expiryDate || savedForm.passportExpiry || savedForm.passportExpiryDate || savedForm.expiryDate || '',
            homePhone: savedForm.homePhone || savedForm.phone || savedForm.contactPhone || '',
            destination: batch.destination || savedForm.destination || 'Hungary',
            employerName: batch.name || savedForm.employerName || '',
        });
        setManageTab('form');
        setCurrentFormStep(1);
        setView('manage');
    };

    const handleBackToList = () => {
        setView('list');
        setActiveBatch(null);
        setActiveEmployee(null);
        handledUrlBatchIdRef.current = null;
        if (urlBatchId) {
            navigate('/corporate/batches', { replace: true });
        }
    };

    useEffect(() => {
        fetchBatches();
    }, []);

    // Auto-select or filter if batchId is provided in URL
    useEffect(() => {
        if (urlBatchId && batches.length > 0 && handledUrlBatchIdRef.current !== urlBatchId) {
            const found = batches.find(b => b.id === urlBatchId || b.code === urlBatchId);
            if (found) {
                handledUrlBatchIdRef.current = urlBatchId;
                setActiveBatch(found);
                setSearchQuery(found.code || found.name);
            }
        }
    }, [urlBatchId, batches]);

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

    const handleSaveForm = async (e?: React.FormEvent) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!activeBatch || !activeEmployee) return;

        setIsSaving(true);
        try {
            await corporateService.saveEmployeeForm(activeBatch.id, activeEmployee.id, employeeFormData);

            setActiveEmployee(prev => prev ? {
                ...prev,
                firstName: employeeFormData.firstName,
                lastName: employeeFormData.lastName,
                fullName: `${employeeFormData.firstName} ${employeeFormData.lastName}`.trim() || prev.fullName,
                passport: employeeFormData.passportNumber || prev.passport,
                passportNumber: employeeFormData.passportNumber || prev.passportNumber,
                dob: employeeFormData.birthDate || employeeFormData.dob,
                expiryDate: employeeFormData.passportExpiry || employeeFormData.expiryDate,
                formDataJson: { ...prev.formDataJson, ...employeeFormData },
                formProgress: 100,
            } : null);

            showSuccess('Employee Schengen application (37 points) saved successfully!');
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
            const res: any = await corporateService.generateDelegationLink(empId, batchId);
            const url = res?.delegationUrl || res?.data?.delegationUrl;
            if (url) {
                await navigator.clipboard.writeText(url);
                showSuccess(`Delegation link for ${empName} copied to clipboard!`);
                return;
            }
        } catch (err: any) {
            console.warn('Error generating delegation link:', err);
            showError(err.message || 'Failed to generate delegation link');
        }
    };

    const handleRemoveEmployeeFromBatch = async (batchId: string, employeeId: string, employeeName: string) => {
        if (!window.confirm(`Are you sure you want to remove "${employeeName}" from this batch?`)) return;
        try {
            await corporateService.removeEmployeeFromBatch(batchId, employeeId);
            showSuccess(`Removed ${employeeName} from batch successfully.`);
            await fetchBatches();
            if (activeEmployee?.id === employeeId) {
                handleBackToList();
            }
        } catch (err: any) {
            showError(err.message || 'Failed to remove employee from batch');
        }
    };

    const handleOpenAddEmpModal = (batch: Batch) => {
        setBatchForAddEmp(batch);
        setNewEmpFirstName('');
        setNewEmpLastName('');
        setNewEmpPassport('');
        setNewEmpJobTitle('');
        setNewEmpDept('');
        setNewEmpDob('');
        setNewEmpExpiry('');
        setIsAddEmpModalOpen(true);
    };

    const handleAddEmployeeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!batchForAddEmp) return;
        if (!newEmpFirstName.trim() || !newEmpPassport.trim()) {
            showError('Please enter at least First Name and Passport Number.');
            return;
        }

        setIsAddingEmp(true);
        try {
            const res: any = await corporateService.addEmployeeToBatch(batchForAddEmp.id, {
                firstName: newEmpFirstName.trim(),
                lastName: newEmpLastName.trim(),
                passportNumber: newEmpPassport.trim().toUpperCase(),
                jobTitle: newEmpJobTitle.trim() || 'Specialist',
                department: newEmpDept.trim() || 'General',
                dob: newEmpDob || undefined,
                expiryDate: newEmpExpiry || undefined,
            });
            const createdData = res.data?.data || res.data || {};
            const createdApplicant = createdData.applicant;
            const targetDossierId = createdApplicant?.dossierId || batchForAddEmp.dossierId || batchForAddEmp.id;
            const batchId = batchForAddEmp.id;

            showSuccess(`Employee ${newEmpFirstName} ${newEmpLastName} added to batch successfully!`);
            setIsAddEmpModalOpen(false);
            setBatchForAddEmp(null);
            await fetchBatches();
        } catch (err: any) {
            showError(err.message || 'Failed to add employee to batch');
        } finally {
            setIsAddingEmp(false);
        }
    };

    const handleDownloadSchengenPdf = async (batch: Batch, employee: Employee) => {
        try {
            showSuccess(`${employee.fullName} üçün rəsmi Şengen vizası ərizə forması (PDF) hazırlanır...`);
            const dossierId = employee.dossierId || batch.id;
            const res = await dossierService.getApplicationFormPdf(dossierId, employee.id, {
                ...(employee.formDataJson || {}),
                firstName: employee.firstName,
                lastName: employee.lastName,
                passportNumber: employee.passport,
                destination: batch.destination,
                purpose: 'Business',
                arrivalDate: batch.travelDate,
                employerName: 'Corporate Partner',
                costCoveredBy: 'By Sponsor / Employer',
            });

            if (res.data?.downloadUrl) {
                const fullUrl = getFileUrl(res.data.downloadUrl);
                
                const fileRes = await fetch(fullUrl);
                if (!fileRes.ok) throw new Error(`Status ${fileRes.status}`);
                const blob = await fileRes.blob();
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = res.data.fileName || `Schengen_Form_${employee.firstName || 'Employee'}_${employee.lastName || ''}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
                showSuccess(`${employee.fullName} üçün Şengen forması (PDF) uğurla endirildi!`);
            }
        } catch (err: any) {
            console.error('Schengen PDF error:', err);
            showError('Şengen PDF formasını yükləmək mümkün olmadı.');
        }
    };

    // Modal Funksiyaları
    const openSettings = (batch: Batch) => {
        setBatchForSettings(batch);
        setEditBatchName(batch.name);
        setEditBatchPackage(batch.packageTier || 'standard');
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
            await corporateService.updateBatch(batchForSettings.id, {
                name: editBatchName,
                packageTier: editBatchPackage,
            } as any);
            showSuccess('Batch details and payment package successfully updated in database!');
            closeSettings();
            await fetchBatches();
        } catch (err: any) {
            showError(err.message || 'Failed to update batch');
        } finally {
            setIsSaving(false);
        }
    };

    const handleChangeBatchPackageDirect = async (batch: Batch, pkgId: string) => {
        setIsSaving(true);
        try {
            await corporateService.updateBatch(batch.id, { packageTier: pkgId } as any);
            const pkgName = activeAdminPackages.find(p => p.id === pkgId)?.name || pkgId.toUpperCase();
            showSuccess(`Batch "${batch.name}" payment package updated to "${pkgName}"!`);
            await fetchBatches();
            if (activeBatch && activeBatch.id === batch.id) {
                setActiveBatch(prev => prev ? { ...prev, packageTier: pkgId } : null);
            }
        } catch (err: any) {
            showError(err.message || 'Failed to update batch payment package');
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
                                                <span
                                                    onClick={() => openSettings(batch)}
                                                    style={{ cursor: 'pointer', color: '#1D4ED8', fontWeight: 700 }}
                                                    title="Change Batch Payment Package"
                                                >
                                                    Package:{' '}
                                                    <strong>
                                                        {activeAdminPackages.find(p => p.id === (batch.packageTier || 'standard'))?.name ||
                                                            (batch.packageTier || 'standard').toUpperCase()}
                                                    </strong>
                                                </span>
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
                                        <button className="btn-text add-emp-btn" onClick={() => handleOpenAddEmpModal(batch)}>
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
                                                                    <button 
                                                                        className="btn-icon-secondary" 
                                                                        title="Download Official Schengen Visa Form (PDF)" 
                                                                        onClick={() => handleDownloadSchengenPdf(batch, emp)}
                                                                        style={{ color: '#EF4444' }}
                                                                    >
                                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                                                    </button>
                                                                    <button className="btn-icon-secondary" title="Copy Delegation Link" onClick={() => handleCopyDelegationLink(emp.id, emp.fullName, batch.id)}>
                                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                                                    </button>
                                                                    <button className="btn-action-outline" onClick={() => handleManageEmployee(batch, emp)}>
                                                                        Manage Dossier
                                                                    </button>
                                                                    <button 
                                                                        className="btn-icon-secondary" 
                                                                        title="Remove Employee from Batch" 
                                                                        onClick={() => handleRemoveEmployeeFromBatch(batch.id, emp.id, emp.fullName)}
                                                                        style={{ color: '#EF4444' }}
                                                                    >
                                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
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

                {/* --- ADD EMPLOYEE TO BATCH MODAL --- */}
                {isAddEmpModalOpen && batchForAddEmp && (
                    <div className="premium-modal-overlay fade-in" onClick={() => setIsAddEmpModalOpen(false)}>
                        <div className="premium-modal-container slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                            <div className="modal-header">
                                <div className="modal-header-info">
                                    <span className="modal-badge">Batch Roster</span>
                                    <h2>Add Employee to {batchForAddEmp.name}</h2>
                                </div>
                                <button className="btn-modal-close" onClick={() => setIsAddEmpModalOpen(false)}>×</button>
                            </div>

                            <form onSubmit={handleAddEmployeeSubmit}>
                                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div>
                                            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>First Name *</label>
                                            <input
                                                type="text"
                                                required
                                                className="premium-input"
                                                value={newEmpFirstName}
                                                onChange={(e) => setNewEmpFirstName(e.target.value)}
                                                placeholder="e.g. John"
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Last Name</label>
                                            <input
                                                type="text"
                                                className="premium-input"
                                                value={newEmpLastName}
                                                onChange={(e) => setNewEmpLastName(e.target.value)}
                                                placeholder="e.g. Doe"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Passport Number *</label>
                                        <input
                                            type="text"
                                            required
                                            className="premium-input"
                                            value={newEmpPassport}
                                            onChange={(e) => setNewEmpPassport(e.target.value.toUpperCase())}
                                            placeholder="e.g. P1234567"
                                        />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div>
                                            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Job Title / Role</label>
                                            <input
                                                type="text"
                                                className="premium-input"
                                                value={newEmpJobTitle}
                                                onChange={(e) => setNewEmpJobTitle(e.target.value)}
                                                placeholder="e.g. Senior Specialist"
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Department</label>
                                            <input
                                                type="text"
                                                className="premium-input"
                                                value={newEmpDept}
                                                onChange={(e) => setNewEmpDept(e.target.value)}
                                                placeholder="e.g. Engineering"
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div>
                                            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Date of Birth</label>
                                            <input
                                                type="date"
                                                className="premium-input"
                                                value={newEmpDob}
                                                onChange={(e) => setNewEmpDob(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Passport Expiry</label>
                                            <input
                                                type="date"
                                                className="premium-input"
                                                value={newEmpExpiry}
                                                onChange={(e) => setNewEmpExpiry(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px' }}>
                                    <button type="button" className="btn-modal-secondary" onClick={() => setIsAddEmpModalOpen(false)}>Cancel</button>
                                    <button type="submit" className="btn-modal-primary" disabled={isAddingEmp}>
                                        {isAddingEmp ? 'Adding...' : 'Add to Batch'}
                                    </button>
                                </div>
                            </form>
                        </div>
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

                                    <div className="settings-section">
                                        <h3>Payment Package &amp; Service Tier</h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                                            {activeAdminPackages.map(pkg => {
                                                const isSel = editBatchPackage === pkg.id;
                                                return (
                                                    <div
                                                        key={pkg.id}
                                                        onClick={() => setEditBatchPackage(pkg.id)}
                                                        style={{
                                                            padding: '12px',
                                                            borderRadius: '10px',
                                                            border: isSel ? '2px solid #2563EB' : '1.5px solid #CBD5E1',
                                                            background: isSel ? '#EFF6FF' : '#FFFFFF',
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <strong style={{ fontSize: '0.88rem', color: '#0F172A' }}>{pkg.name}</strong>
                                                            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#2563EB' }}>
                                                                {Number(pkg.priceEur) > 0 ? `+€${Number(pkg.priceEur).toFixed(0)}` : '€0'}
                                                            </span>
                                                        </div>
                                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.74rem', color: '#64748B' }}>{pkg.description}</p>
                                                    </div>
                                                );
                                            })}
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
    // RENDER: VIEW 2 - MANAGE EMPLOYEE DOSSIER (37 POINTS)
    // ==========================================
    const uploadedDocTypes = new Set(activeEmployee?.documents.map(d => d.requiredDocumentType) || []);
    const additionalDocs = (activeEmployee?.documents || []).filter(d => !REQ_CORP_DOC_TYPES.has(d.requiredDocumentType));
    const uploadedMandatoryCount = REQUIRED_CORP_DOCS.filter(d => uploadedDocTypes.has(d.type)).length;

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
                {activeBatch && activeEmployee && (
                    <div style={{ marginLeft: 'auto' }}>
                        <button 
                            type="button" 
                            className="btn-action-outline"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#1E293B', borderColor: '#CBD5E1' }}
                            onClick={() => handleDownloadSchengenPdf(activeBatch, activeEmployee)}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                            Download Schengen PDF
                        </button>
                    </div>
                )}
            </div>

            {/* Premium Tabs */}
            <div className="corp-tabs-container">
                <button className={`corp-premium-tab ${manageTab === 'form' ? 'active' : ''}`} onClick={() => setManageTab('form')}>
                    1. Application Form (37 Points)
                </button>
                <button className={`corp-premium-tab ${manageTab === 'docs' ? 'active' : ''}`} onClick={() => setManageTab('docs')}>
                    2. Document Repository ({activeEmployee?.documents.length || 0})
                </button>
                <button className={`corp-premium-tab ${manageTab === 'packages' ? 'active' : ''}`} onClick={() => setManageTab('packages')}>
                    3. Payment Packages ({activeAdminPackages.find(p => p.id === (activeBatch?.packageTier || 'standard'))?.name || 'Standard'})
                </button>
            </div>

            {/* --- TAB 3: PAYMENT PACKAGES --- */}
            {manageTab === 'packages' && activeBatch && (
                <div className="fade-in" style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '24px', marginTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0F172A' }}>
                                Corporate Batch Payment Package ({activeBatch.name})
                            </h3>
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748B' }}>
                                Select or upgrade the payment package applied to all {activeBatch.employees.length} employee(s) in this batch.
                            </p>
                        </div>
                        <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '8px 14px', borderRadius: '10px', fontWeight: 800, fontSize: '0.88rem' }}>
                            Batch Total: €{(activeBatch.totalFee || 145).toFixed(2)}
                        </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                        {activeAdminPackages.map(pkg => {
                            const isCur = (activeBatch.packageTier || 'standard') === pkg.id;
                            const liveCalc = calculateLiveFees({
                                portalType: 'CORPORATE',
                                paxCount: Math.max(1, activeBatch.employees.length),
                                activePackage: pkg.id,
                                duration: activeBatch.duration || 'short',
                            });
                            return (
                                <div
                                    key={pkg.id}
                                    style={{
                                        border: isCur ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
                                        background: isCur ? '#EFF6FF' : '#F8FAFC',
                                        borderRadius: '12px',
                                        padding: '20px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>{pkg.name}</h4>
                                            {pkg.badge && (
                                                <span style={{ fontSize: '0.72rem', fontWeight: 800, background: isCur ? '#2563EB' : '#E2E8F0', color: isCur ? '#FFFFFF' : '#334155', padding: '3px 8px', borderRadius: '8px' }}>
                                                    {pkg.badge}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#1D4ED8', marginBottom: '6px' }}>
                                            {Number(pkg.priceEur) > 0 ? `+€${Number(pkg.priceEur).toFixed(2)}` : '€0.00'} <span style={{ fontSize: '0.78rem', color: '#64748B' }}>/ employee</span>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A', marginBottom: '10px' }}>
                                            Batch Total ({activeBatch.employees.length} Emp): €{liveCalc.grandTotalEur.toFixed(2)}
                                        </div>
                                        <p style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.45, marginBottom: '12px' }}>{pkg.description}</p>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={isCur || isSaving}
                                        onClick={() => handleChangeBatchPackageDirect(activeBatch, pkg.id)}
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            borderRadius: '8px',
                                            border: isCur ? '1.5px solid #2563EB' : 'none',
                                            background: isCur ? '#DBEAFE' : '#2563EB',
                                            color: isCur ? '#1E40AF' : '#FFFFFF',
                                            fontWeight: 700,
                                            cursor: isCur ? 'default' : 'pointer',
                                        }}
                                    >
                                        {isCur ? '✓ Active Batch Package' : `Switch Batch to ${pkg.name}`}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* --- TAB 1: 37-POINT SCHENGEN FORM --- */}
            {manageTab === 'form' && (
                <div className="fade-in">
                    <SchengenQuestionnaire
                        formData={employeeFormData}
                        onFieldChange={(field, value) => setEmployeeFormData(prev => ({ ...prev, [field]: value }))}
                        dossier={activeBatch ? {
                            id: activeBatch.dossierId || activeBatch.id,
                            dossierNumber: activeBatch.code || activeBatch.id,
                            portalType: 'CORPORATE',
                            status: activeBatch.status,
                            currentStep: 1,
                            country: { id: '', code: '', nameEn: activeBatch.destination, nameAz: activeBatch.destination },
                            user: { id: '', fullName: '', email: '', companyName: activeBatch.name, role: 'CORPORATE' }
                        } : null}
                        onOpenMrzModal={() => {}}
                        onSaveForm={handleSaveForm}
                        isCorporateMode={true}
                    />
                </div>
            )}

            {/* --- TAB 2: DOCS --- */}
            {manageTab === 'docs' && (
                <div className="docs-main-layout fade-in">
                    <aside className="docs-sidebar">
                        <div className="docs-tracker-card-vertical">
                            <div className="tracker-header">
                                <h3>Document Checklist</h3>
                                <span className="tracker-count">
                                    {uploadedMandatoryCount} / {REQUIRED_CORP_DOCS.length} Required
                                    {additionalDocs.length > 0 ? ` (+${additionalDocs.length} extra)` : ''}
                                </span>
                            </div>
                            <div className="tracker-progress-bar">
                                <div 
                                    className="progress-fill" 
                                    style={{ width: `${Math.min(100, Math.round((uploadedMandatoryCount / REQUIRED_CORP_DOCS.length) * 100))}%` }}
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

                                {additionalDocs.length > 0 && (
                                    <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px dashed #CBD5E1' }}>
                                        <h4 style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748B', marginBottom: '8px', fontWeight: 700 }}>
                                            Additional Profile Documents ({additionalDocs.length})
                                        </h4>
                                        {additionalDocs.map((extraDoc, idx) => {
                                            const isRejected = extraDoc.status === 'REJECTED';
                                            const isVerified = extraDoc.status === 'VERIFIED';
                                            const label = extraDoc.originalFileName || extraDoc.fileName || `Additional Document #${idx + 1}`;
                                            return (
                                                <div key={extraDoc.id || idx} className={`tracker-item-vert ${isRejected ? 'rejected' : isVerified ? 'completed' : 'completed'}`} style={{ marginBottom: '6px' }}>
                                                    <div className="tracker-icon-vert">
                                                        {isRejected ? (
                                                            <svg viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                                        ) : (
                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                                        )}
                                                    </div>
                                                    <span className="tracker-label-vert" title={label}>{label}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
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

                        {additionalDocs.length > 0 && (
                            <div style={{ marginTop: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '0.8rem', background: '#EFF6FF', color: '#1D4ED8', padding: '4px 10px', borderRadius: '12px', fontWeight: 700 }}>
                                            Additional Uploaded Documents ({additionalDocs.length})
                                        </span>
                                        <span style={{ fontSize: '0.85rem', color: '#64748B' }}>
                                            Uploaded from employee profile or external self-fill link
                                        </span>
                                    </div>
                                    <button 
                                        type="button"
                                        className="btn-outline-secondary"
                                        style={{ padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '6px' }}
                                        onClick={() => triggerUpload('OTHER')}
                                    >
                                        + Upload Extra File
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {additionalDocs.map((extraDoc, idx) => {
                                        const isRejected = extraDoc.status === 'REJECTED';
                                        const isVerified = extraDoc.status === 'VERIFIED';
                                        const fileUrl = getFileUrl(extraDoc.fileUrl);
                                        const fileName = extraDoc.originalFileName || extraDoc.fileName || `Additional Document ${idx + 1}`;

                                        return (
                                            <div 
                                                key={extraDoc.id || idx} 
                                                className={`doc-card-premium ${isRejected ? 'rejected' : isVerified ? 'verified' : 'verified'}`}
                                            >
                                                <div className="doc-card-icon" style={{ backgroundColor: '#F1F5F9', color: '#334155' }}>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                                </div>
                                                <div className="doc-card-info">
                                                    <div className="doc-card-header">
                                                        <h3>{fileName}</h3>
                                                        <span className={`doc-badge ${isRejected ? 'action-req' : isVerified ? 'verified' : 'verified'}`}>
                                                            {isRejected ? 'Action Required' : isVerified ? 'Verified' : 'Uploaded (Additional)'}
                                                        </span>
                                                    </div>
                                                    <p className="doc-explanatory-text">
                                                        Type: <strong>{extraDoc.requiredDocumentType || 'Extra Document'}</strong> • Uploaded {extraDoc.createdAt ? new Date(extraDoc.createdAt).toLocaleDateString('en-US') : 'recently'}
                                                    </p>
                                                    {isRejected && extraDoc.operatorNotes && (
                                                        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '10px 14px', borderRadius: '8px', color: '#991B1B', fontSize: '0.85rem', marginTop: '8px' }}>
                                                            <strong>Operator Feedback: </strong>{extraDoc.operatorNotes}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="doc-card-actions">
                                                    {fileUrl && (
                                                        <a 
                                                            href={fileUrl} 
                                                            target="_blank" 
                                                            rel="noreferrer"
                                                            className="btn-upload-primary"
                                                            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                                        >
                                                            Download / View
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
}
