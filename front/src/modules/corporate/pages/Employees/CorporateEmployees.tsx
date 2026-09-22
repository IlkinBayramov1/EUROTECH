import React, { useState, useEffect, useMemo, useRef } from 'react';
import { corporateService, documentService } from '@/shared/api/services';
import { useToast } from '@/shared/context/ToastContext';
import './CorporateEmployees.css';

// --- Tiplər ---
export interface VisaRecord {
    id: string;
    country: string;
    type: string;
    issueDate: string;
    expiryDate: string;
    status: 'Active' | 'Expired' | 'Processing';
    batchRef: string;
}

export interface ArchivedDoc {
    id: string;
    name: string;
    uploadDate: string;
    fileUrl?: string;
    type: 'pdf' | 'image';
    status?: string;
}

export interface EmployeeProfile {
    id: string;
    rawId: string;
    firstName: string;
    lastName: string;
    image?: string;
    jobTitle: string;
    department: string;
    nationality: string;
    passportNo: string;
    passportExpiry: string;
    email: string;
    phone: string;
    visaHistory: VisaRecord[];
    documents: ArchivedDoc[];
    dossierId?: string;
    applicantId?: string;
}

export default function CorporateEmployees() {
    const { showSuccess, showError } = useToast();
    const [view, setView] = useState<'list' | 'dossier'>('list');
    const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
    const [activeEmployee, setActiveEmployee] = useState<EmployeeProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // Search & Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('ALL');

    // Add Employee Modal state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newFirstName, setNewFirstName] = useState('');
    const [newLastName, setNewLastName] = useState('');
    const [newJobTitle, setNewJobTitle] = useState('');
    const [newDepartment, setNewDepartment] = useState('Engineering');
    const [newNationality, setNewNationality] = useState('Azerbaijan');
    const [newPassport, setNewPassport] = useState('');
    const [newPassportExpiry, setNewPassportExpiry] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Edit Employee Modal state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editFirstName, setEditFirstName] = useState('');
    const [editLastName, setEditLastName] = useState('');
    const [editJobTitle, setEditJobTitle] = useState('');
    const [editDepartment, setEditDepartment] = useState('');
    const [editNationality, setEditNationality] = useState('');
    const [editPassport, setEditPassport] = useState('');
    const [editPassportExpiry, setEditPassportExpiry] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editPhone, setEditPhone] = useState('');

    // Hidden File Input for Document Upload
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploadingDoc, setIsUploadingDoc] = useState(false);

    // Real DB-dən İşçilərin Yüklənməsi
    const fetchEmployees = async () => {
        try {
            setLoading(true);
            const res = await corporateService.getEmployees();
            if (res.data?.employees) {
                const mapped: EmployeeProfile[] = res.data.employees.map((e: any) => {
                    const visaList: VisaRecord[] = (e.visaHistory || []).map((v: any) => ({
                        id: v.id,
                        country: v.country || 'Europe / Schengen',
                        type: v.type || 'Schengen C (Business)',
                        issueDate: v.issueDate ? String(v.issueDate).split('T')[0] : 'N/A',
                        expiryDate: v.expiryDate ? String(v.expiryDate).split('T')[0] : 'N/A',
                        status: v.status === 'ACTIVE' ? 'Active' : v.status === 'PROCESSING' ? 'Processing' : 'Expired',
                        batchRef: v.batchRef || 'DIRECT',
                    }));

                    const docList: ArchivedDoc[] = (e.documents || []).map((d: any) => ({
                        id: d.id,
                        name: d.originalFileName || d.fileName || `${d.requiredDocumentType || 'Document'}.pdf`,
                        uploadDate: d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently',
                        fileUrl: d.fileUrl,
                        type: (d.fileName || d.fileUrl)?.match(/\.(jpg|jpeg|png)$/i) ? 'image' : 'pdf',
                        status: d.status,
                    }));

                    return {
                        id: e.id?.length > 8 ? e.id.substring(0, 8).toUpperCase() : (e.id || 'EMP-001'),
                        rawId: e.id,
                        firstName: e.firstName || '',
                        lastName: e.lastName || '',
                        jobTitle: e.jobTitle || 'Employee',
                        department: e.department || 'General',
                        nationality: e.nationality || 'Azerbaijan',
                        passportNo: e.passportNumber || 'P0000000',
                        passportExpiry: e.passportExpiry ? String(e.passportExpiry).split('T')[0] : 'N/A',
                        email: e.email || '',
                        phone: e.phone || '',
                        visaHistory: visaList,
                        documents: docList,
                        dossierId: e.dossierId,
                        applicantId: e.applicantId,
                    };
                });
                setEmployees(mapped);
            } else {
                setEmployees([]);
            }
        } catch (err: any) {
            console.warn('Failed to load corporate employees from database:', err);
            setEmployees([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEmployees();
    }, []);

    // Unikal Departamentlər siyahısı
    const departments = useMemo(() => {
        const set = new Set<string>();
        employees.forEach(e => {
            if (e.department) set.add(e.department);
        });
        return Array.from(set);
    }, [employees]);

    // Filtrlənmiş İşçilər
    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => {
            const matchesSearch = searchQuery === '' ||
                `${emp.firstName} ${emp.lastName} ${emp.id} ${emp.passportNo} ${emp.jobTitle}`
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase());

            const matchesDept = departmentFilter === 'ALL' ||
                emp.department.toLowerCase() === departmentFilter.toLowerCase();

            return matchesSearch && matchesDept;
        });
    }, [employees, searchQuery, departmentFilter]);

    // --- Aksiyalar ---
    const handleViewDossier = (employee: EmployeeProfile) => {
        setActiveEmployee(employee);
        setView('dossier');
    };

    const handleBackToList = () => {
        setView('list');
        setActiveEmployee(null);
    };

    const handleGenerateDelegation = async (rawEmployeeId: string) => {
        try {
            const res = await corporateService.generateDelegationLink(rawEmployeeId);
            const fullLink = res.data?.delegationUrl || `${window.location.origin}/corporate/delegation?token=${res.data?.delegationToken}`;
            await navigator.clipboard.writeText(fullLink);
            showSuccess('Magic Delegation Link copied to clipboard! Share it with the employee.');
        } catch (err: any) {
            console.warn('Error generating delegation link:', err);
            showError(err.message || 'Failed to generate delegation link.');
        }
    };

    const handleAddEmployeeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await corporateService.addEmployee({
                firstName: newFirstName,
                lastName: newLastName,
                jobTitle: newJobTitle,
                department: newDepartment,
                nationality: newNationality,
                passportNumber: newPassport,
                passportExpiry: newPassportExpiry || undefined,
                email: newEmail,
                phone: newPhone,
            });

            showSuccess('Employee successfully registered in corporate database!');
            setIsAddModalOpen(false);
            setNewFirstName('');
            setNewLastName('');
            setNewJobTitle('');
            setNewPassport('');
            setNewPassportExpiry('');
            setNewEmail('');
            setNewPhone('');
            await fetchEmployees();
        } catch (err: any) {
            showError(err.message || 'Failed to register employee.');
        } finally {
            setIsSaving(false);
        }
    };

    const openEditModal = (employee: EmployeeProfile) => {
        setEditFirstName(employee.firstName);
        setEditLastName(employee.lastName);
        setEditJobTitle(employee.jobTitle);
        setEditDepartment(employee.department);
        setEditNationality(employee.nationality);
        setEditPassport(employee.passportNo);
        setEditPassportExpiry(employee.passportExpiry !== 'N/A' ? employee.passportExpiry : '');
        setEditEmail(employee.email);
        setEditPhone(employee.phone);
        setIsEditModalOpen(true);
    };

    const handleEditEmployeeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeEmployee) return;

        setIsSaving(true);
        try {
            await corporateService.updateEmployee(activeEmployee.rawId, {
                firstName: editFirstName,
                lastName: editLastName,
                jobTitle: editJobTitle,
                department: editDepartment,
                nationality: editNationality,
                passportNumber: editPassport,
                passportExpiry: editPassportExpiry || undefined,
                email: editEmail,
                phone: editPhone,
            });

            showSuccess('Employee profile successfully updated in database!');
            setIsEditModalOpen(false);
            await fetchEmployees();

            // Active employee state-ni də yenilə
            setActiveEmployee(prev => prev ? {
                ...prev,
                firstName: editFirstName,
                lastName: editLastName,
                jobTitle: editJobTitle,
                department: editDepartment,
                nationality: editNationality,
                passportNo: editPassport,
                passportExpiry: editPassportExpiry || 'N/A',
                email: editEmail,
                phone: editPhone,
            } : null);
        } catch (err: any) {
            showError(err.message || 'Failed to update employee.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteEmployee = async () => {
        if (!activeEmployee) return;
        if (!window.confirm(`Are you sure you want to remove "${activeEmployee.firstName} ${activeEmployee.lastName}" from the company registry? This action cannot be undone.`)) return;

        setIsSaving(true);
        try {
            await corporateService.deleteEmployee(activeEmployee.rawId);
            showSuccess('Employee removed from corporate directory.');
            setIsEditModalOpen(false);
            handleBackToList();
            await fetchEmployees();
        } catch (err: any) {
            showError(err.message || 'Failed to delete employee.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleExportRosterExcel = () => {
        const list = filteredEmployees.length > 0 ? filteredEmployees : employees;
        const headers = [
            'Employee ID',
            'First Name',
            'Last Name',
            'Department',
            'Job Title',
            'Nationality',
            'Passport No',
            'Passport Expiry',
            'Email',
            'Phone',
            'Active Visa Country',
            'Active Visa Type',
            'Active Visa Status'
        ];

        const escapeCsv = (str: any) => `"${String(str || '').replace(/"/g, '""')}"`;

        const rows = list.map(emp => {
            const activeVisa = emp.visaHistory.find(v => v.status === 'Active') || emp.visaHistory[0] || {} as any;
            return [
                escapeCsv(emp.id),
                escapeCsv(emp.firstName),
                escapeCsv(emp.lastName),
                escapeCsv(emp.department),
                escapeCsv(emp.jobTitle),
                escapeCsv(emp.nationality),
                escapeCsv(emp.passportNo),
                escapeCsv(emp.passportExpiry),
                escapeCsv(emp.email),
                escapeCsv(emp.phone),
                escapeCsv(activeVisa.country || 'N/A'),
                escapeCsv(activeVisa.type || 'N/A'),
                escapeCsv(activeVisa.status || 'N/A'),
            ].join(',');
        });

        const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `corporate_employee_roster_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showSuccess('İşçi siyahısı Excel (CSV) formatında uğurla yükləndi!');
    };

    const handleDownloadEmployeeDoc = (doc: ArchivedDoc, emp: EmployeeProfile) => {
        if (doc.fileUrl) {
            const fullUrl = doc.fileUrl.startsWith('http') ? doc.fileUrl : `http://localhost:5000${doc.fileUrl}`;
            const link = document.createElement('a');
            link.href = fullUrl;
            link.download = doc.name;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showSuccess(`${doc.name} faylı endirilir...`);
            return;
        }

        showError('Sənəd faylının URL ünvanı tapılmadı.');
    };

    const triggerUploadNewDoc = () => {
        if (!activeEmployee) return;
        if (!activeEmployee.applicantId || !activeEmployee.dossierId) {
            showError('Bu işçinin birbaşa viza partiyası (dossier) tapılmadı. Sənədlər "Visa Batches" bölməsində əlavə olunur.');
            return;
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeEmployee) return;

        setIsUploadingDoc(true);
        try {
            await documentService.uploadDocument({
                dossierId: activeEmployee.dossierId || '',
                applicantId: activeEmployee.applicantId || '',
                requiredDocumentType: 'OTHER',
                isMandatory: false,
                file,
            });
            showSuccess(`"${file.name}" sənədi uğurla sistemə yükləndi!`);
            await fetchEmployees();

            // Active employee sənədlərini yenilə
            const refreshed = await corporateService.getEmployees();
            if (refreshed.data?.employees) {
                const found = refreshed.data.employees.find((emp: any) => emp.id === activeEmployee.rawId);
                if (found) {
                    const docList: ArchivedDoc[] = (found.documents || []).map((d: any) => ({
                        id: d.id,
                        name: d.originalFileName || d.fileName || 'Document.pdf',
                        uploadDate: d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently',
                        fileUrl: d.fileUrl,
                        type: (d.fileName || d.fileUrl)?.match(/\.(jpg|jpeg|png)$/i) ? 'image' : 'pdf',
                        status: d.status,
                    }));
                    setActiveEmployee(prev => prev ? { ...prev, documents: docList } : null);
                }
            }
        } catch (err: any) {
            showError(err.message || 'Sənəd yükləmək mümkün olmadı.');
        } finally {
            setIsUploadingDoc(false);
        }
    };

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
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <button className="btn-secondary" onClick={handleExportRosterExcel} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', border: '1px solid #cbd5e1', padding: '0.6rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: '#1e293b' }}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
                            Export Roster (Excel)
                        </button>
                        <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                            Add New Employee
                        </button>
                    </div>
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
                        <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
                            <option value="ALL">All Departments</option>
                            {departments.map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>
                    {(searchQuery || departmentFilter !== 'ALL') && (
                        <button 
                            type="button" 
                            onClick={() => { setSearchQuery(''); setDepartmentFilter('ALL'); }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--color-secondary)', fontWeight: 600, cursor: 'pointer', padding: '0 8px' }}
                        >
                            Reset
                        </button>
                    )}
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-neutral)' }}>
                        <p>Connecting to database and fetching corporate employee registry...</p>
                    </div>
                ) : filteredEmployees.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '56px 24px', backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                        <div style={{ width: '56px', height: '56px', margin: '0 auto 16px auto', borderRadius: '50%', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-secondary)' }}>
                            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        </div>
                        <h3 style={{ margin: '0 0 8px 0', color: 'var(--color-primary)' }}>No employees registered</h3>
                        <p style={{ margin: '0 0 20px 0', color: 'var(--color-neutral)', fontSize: '0.95rem' }}>
                            {employees.length === 0 ? 'Your company employee directory is currently empty. Click "Add New Employee" to register staff.' : 'No employees match your search criteria.'}
                        </p>
                        <button className="btn-primary" onClick={() => setIsAddModalOpen(true)} style={{ margin: '0 auto' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                            Add First Employee
                        </button>
                    </div>
                ) : (
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
                                            <tr key={emp.rawId} className="emp-row" onClick={() => handleViewDossier(emp)}>
                                                <td>
                                                    <div className="emp-cell-profile">
                                                        <div className="emp-avatar-sm text-avatar">
                                                            {emp.firstName?.[0] || 'E'}{emp.lastName?.[0] || ''}
                                                        </div>
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
                        </div>
                    </div>
                )}

                {/* Add Employee Modal */}
                {isAddModalOpen && (
                    <div className="premium-modal-overlay fade-in" onClick={() => setIsAddModalOpen(false)}>
                        <div className="premium-modal-container slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px' }}>
                            <div className="modal-header">
                                <div className="modal-header-info">
                                    <span className="modal-badge">Company Registry</span>
                                    <h2>Add New Employee</h2>
                                </div>
                                <button className="btn-modal-close" onClick={() => setIsAddModalOpen(false)}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                            </div>

                            <div className="modal-body">
                                <form id="addEmpForm" onSubmit={handleAddEmployeeSubmit} className="corp-form-grid">
                                    <div className="corp-input-group">
                                        <label>First Name</label>
                                        <input 
                                            type="text" 
                                            className="corp-input" 
                                            required 
                                            placeholder="e.g. Ali"
                                            value={newFirstName} 
                                            onChange={e => setNewFirstName(e.target.value)} 
                                        />
                                    </div>
                                    <div className="corp-input-group">
                                        <label>Last Name</label>
                                        <input 
                                            type="text" 
                                            className="corp-input" 
                                            required 
                                            placeholder="e.g. Mammadov"
                                            value={newLastName} 
                                            onChange={e => setNewLastName(e.target.value)} 
                                        />
                                    </div>
                                    <div className="corp-input-group">
                                        <label>Job Title / Position</label>
                                        <input 
                                            type="text" 
                                            className="corp-input" 
                                            required 
                                            placeholder="e.g. Senior Software Engineer"
                                            value={newJobTitle} 
                                            onChange={e => setNewJobTitle(e.target.value)} 
                                        />
                                    </div>
                                    <div className="corp-input-group">
                                        <label>Department</label>
                                        <input 
                                            type="text" 
                                            className="corp-input" 
                                            required 
                                            placeholder="e.g. Engineering"
                                            value={newDepartment} 
                                            onChange={e => setNewDepartment(e.target.value)} 
                                        />
                                    </div>
                                    <div className="corp-input-group">
                                        <label>Passport Number</label>
                                        <input 
                                            type="text" 
                                            className="corp-input" 
                                            required 
                                            placeholder="e.g. C12345678"
                                            value={newPassport} 
                                            onChange={e => setNewPassport(e.target.value)} 
                                        />
                                    </div>
                                    <div className="corp-input-group">
                                        <label>Passport Expiry Date</label>
                                        <input 
                                            type="date" 
                                            className="corp-input" 
                                            value={newPassportExpiry} 
                                            onChange={e => setNewPassportExpiry(e.target.value)} 
                                        />
                                    </div>
                                    <div className="corp-input-group">
                                        <label>Nationality</label>
                                        <input 
                                            type="text" 
                                            className="corp-input" 
                                            value={newNationality} 
                                            onChange={e => setNewNationality(e.target.value)} 
                                        />
                                    </div>
                                    <div className="corp-input-group">
                                        <label>Phone Number</label>
                                        <input 
                                            type="text" 
                                            className="corp-input" 
                                            placeholder="e.g. +994 50 123 45 67"
                                            value={newPhone} 
                                            onChange={e => setNewPhone(e.target.value)} 
                                        />
                                    </div>
                                    <div className="corp-input-group full-width">
                                        <label>Corporate Email</label>
                                        <input 
                                            type="email" 
                                            className="corp-input" 
                                            placeholder="e.g. employee@company.com"
                                            value={newEmail} 
                                            onChange={e => setNewEmail(e.target.value)} 
                                        />
                                    </div>
                                </form>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-modal-secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                                <button type="submit" form="addEmpForm" className="btn-modal-primary" disabled={isSaving}>
                                    {isSaving ? 'Registering...' : 'Register Employee'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ==========================================
    // RENDER 2: EMPLOYEE DOSSIER ARCHIVE
    // ==========================================
    if (view === 'dossier' && activeEmployee) {
        return (
            <div className="corp-emp-content fade-in">
                {/* Hidden File Input */}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    accept=".pdf,.jpg,.jpeg,.png" 
                    onChange={handleFileSelected} 
                />

                <div className="manage-view-header">
                    <button className="btn-back-link" onClick={handleBackToList}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                        Back to Directory
                    </button>
                    <div className="manage-employee-info" style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-primary btn-sm" onClick={() => handleGenerateDelegation(activeEmployee.rawId)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:'16px', marginRight:'6px'}}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                            Copy Delegation Link
                        </button>
                        <button className="btn-outline-secondary btn-sm" onClick={() => openEditModal(activeEmployee)}>
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
                            <span>{activeEmployee.firstName?.[0] || 'E'}{activeEmployee.lastName?.[0] || ''}</span>
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
                                    <span className="info-label">Nationality</span>
                                    <strong className="info-value">{activeEmployee.nationality}</strong>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Email Address</span>
                                    <strong className="info-value">{activeEmployee.email || '—'}</strong>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Phone Number</span>
                                    <strong className="info-value">{activeEmployee.phone || '—'}</strong>
                                </div>
                            </div>
                        </div>

                        {/* Document Archive Box */}
                        <div className="corp-panel-card">
                            <div className="panel-header">
                                <h3>Document Archive ({activeEmployee.documents.length})</h3>
                                {activeEmployee.dossierId && (
                                    <button 
                                        className="btn-text-link" 
                                        onClick={triggerUploadNewDoc}
                                        disabled={isUploadingDoc}
                                    >
                                        {isUploadingDoc ? 'Uploading...' : 'Upload New'}
                                    </button>
                                )}
                            </div>
                            <div className="doc-archive-list">
                                {activeEmployee.documents.length === 0 ? (
                                    <div style={{ color: 'var(--color-neutral)', fontStyle: 'italic', fontSize: '0.9rem', textAlign: 'center', padding: '16px' }}>
                                        No uploaded documents registered for this employee yet.
                                    </div>
                                ) : (
                                    activeEmployee.documents.map(doc => (
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
                                            <button 
                                                className="btn-icon-action" 
                                                title="Download Document" 
                                                onClick={() => activeEmployee && handleDownloadEmployeeDoc(doc, activeEmployee)}
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                            </button>
                                        </div>
                                    ))
                                )}
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
                                    <div className="empty-state-box">No official visa history recorded for this employee.</div>
                                ) : (
                                    activeEmployee.visaHistory.map((visa) => (
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

                {/* Edit Employee Modal */}
                {isEditModalOpen && (
                    <div className="premium-modal-overlay fade-in" onClick={() => setIsEditModalOpen(false)}>
                        <div className="premium-modal-container slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px' }}>
                            <div className="modal-header">
                                <div className="modal-header-info">
                                    <span className="modal-badge">Employee Profile</span>
                                    <h2>Edit Employee Details</h2>
                                </div>
                                <button className="btn-modal-close" onClick={() => setIsEditModalOpen(false)}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                            </div>

                            <div className="modal-body">
                                <form id="editEmpForm" onSubmit={handleEditEmployeeSubmit} className="corp-form-grid">
                                    <div className="corp-input-group">
                                        <label>First Name</label>
                                        <input 
                                            type="text" 
                                            className="corp-input" 
                                            required 
                                            value={editFirstName} 
                                            onChange={e => setEditFirstName(e.target.value)} 
                                        />
                                    </div>
                                    <div className="corp-input-group">
                                        <label>Last Name</label>
                                        <input 
                                            type="text" 
                                            className="corp-input" 
                                            required 
                                            value={editLastName} 
                                            onChange={e => setEditLastName(e.target.value)} 
                                        />
                                    </div>
                                    <div className="corp-input-group">
                                        <label>Job Title</label>
                                        <input 
                                            type="text" 
                                            className="corp-input" 
                                            required 
                                            value={editJobTitle} 
                                            onChange={e => setEditJobTitle(e.target.value)} 
                                        />
                                    </div>
                                    <div className="corp-input-group">
                                        <label>Department</label>
                                        <input 
                                            type="text" 
                                            className="corp-input" 
                                            required 
                                            value={editDepartment} 
                                            onChange={e => setEditDepartment(e.target.value)} 
                                        />
                                    </div>
                                    <div className="corp-input-group">
                                        <label>Passport Number</label>
                                        <input 
                                            type="text" 
                                            className="corp-input" 
                                            required 
                                            value={editPassport} 
                                            onChange={e => setEditPassport(e.target.value)} 
                                        />
                                    </div>
                                    <div className="corp-input-group">
                                        <label>Passport Expiry</label>
                                        <input 
                                            type="date" 
                                            className="corp-input" 
                                            value={editPassportExpiry} 
                                            onChange={e => setEditPassportExpiry(e.target.value)} 
                                        />
                                    </div>
                                    <div className="corp-input-group">
                                        <label>Nationality</label>
                                        <input 
                                            type="text" 
                                            className="corp-input" 
                                            value={editNationality} 
                                            onChange={e => setEditNationality(e.target.value)} 
                                        />
                                    </div>
                                    <div className="corp-input-group">
                                        <label>Phone Number</label>
                                        <input 
                                            type="text" 
                                            className="corp-input" 
                                            value={editPhone} 
                                            onChange={e => setEditPhone(e.target.value)} 
                                        />
                                    </div>
                                    <div className="corp-input-group full-width">
                                        <label>Corporate Email</label>
                                        <input 
                                            type="email" 
                                            className="corp-input" 
                                            value={editEmail} 
                                            onChange={e => setEditEmail(e.target.value)} 
                                        />
                                    </div>
                                </form>

                                <div className="settings-danger-zone" style={{ marginTop: '8px' }}>
                                    <div className="danger-info">
                                        <h4>Remove Employee</h4>
                                        <p>Permanently remove this employee from your company corporate mobility records.</p>
                                    </div>
                                    <button 
                                        type="button" 
                                        className="btn-danger-outline" 
                                        onClick={handleDeleteEmployee}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? 'Deleting...' : 'Delete Employee'}
                                    </button>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-modal-secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</button>
                                <button type="submit" form="editEmpForm" className="btn-modal-primary" disabled={isSaving}>
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return null;
}