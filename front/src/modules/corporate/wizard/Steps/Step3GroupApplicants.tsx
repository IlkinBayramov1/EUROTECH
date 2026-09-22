import React, { useRef } from 'react';
import type { EmployeeData } from '../CorporateWizard';
import { UploadIcon, UserPlusIcon, LinkIcon, TrashIcon } from '@/shared/components/icons/Icons';
import { useToast } from '@/shared/context/ToastContext';

interface Step3Props {
    data: {
        batchName: string; // Corporate Wizard-da istifadə etdiyimiz ad
        employees: EmployeeData[];
    };
    updateData: (field: string, value: any) => void;
}

export default function Step3Employees({ data, updateData }: Step3Props) {
    const { showSuccess, showError } = useToast();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    
    // İşçi əlavə etmək üçün funksiya
    const handleAddEmployee = () => {
        const newEmployee: EmployeeData = {
            id: `emp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            firstName: '',
            lastName: '',
            dob: '',
            passportNumber: '',
            issueDate: '',
            expiryDate: '',
            role: '',        // HR Role
            department: '',  // HR Department
            documents: { passport: false, photo: false }
        };
        updateData('employees', [...data.employees, newEmployee]);
    };

    // İşçini silmək
    const handleRemoveEmployee = (id: string) => {
        updateData('employees', data.employees.filter(emp => emp.id !== id));
    };

    // İşçi məlumatlarını dəyişmək
    const handleEmployeeChange = (id: string, field: keyof EmployeeData, value: string) => {
        const updated = data.employees.map(emp => {
            if (emp.id === id) {
                return { ...emp, [field]: value };
            }
            return emp;
        });
        updateData('employees', updated);
    };

    // Nümayəndəlik linkini kopyalamaq (Delegation Link)
    const handleCopyDelegationLink = (id: string, name: string) => {
        const link = `${window.location.origin}/corporate/delegation?token=del_${id}`;
        navigator.clipboard.writeText(link);
        showSuccess(`Delegation Link copied to clipboard for ${name || 'Employee'}!`);
    };

    // Real CSV File Upload Parser
    const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                if (lines.length < 2) {
                    showError('CSV file is empty or missing headers.');
                    return;
                }

                const newEmployees: EmployeeData[] = [];
                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                    if (cols.length >= 2) {
                        newEmployees.push({
                            id: `emp-csv-${Date.now()}-${i}`,
                            firstName: cols[0] || 'Employee',
                            lastName: cols[1] || '',
                            dob: cols[2] || '1990-01-01',
                            passportNumber: cols[3] || `P${Math.floor(1000000 + Math.random() * 9000000)}`,
                            issueDate: '2020-01-01',
                            expiryDate: '2030-01-01',
                            role: cols[4] || 'Specialist',
                            department: cols[5] || 'Engineering',
                            documents: { passport: false, photo: false }
                        });
                    }
                }

                if (newEmployees.length > 0) {
                    updateData('employees', [...data.employees, ...newEmployees]);
                    showSuccess(`Successfully imported ${newEmployees.length} employee(s) from CSV!`);
                } else {
                    showError('No valid employee records found in CSV.');
                }
            } catch (err) {
                showError('Failed to parse CSV file.');
            }
        };
        reader.readAsText(file);
    };

    // Department seçimləri
    const departments = [
        "Engineering", "Marketing", "Sales", "Operations", "Finance", 
        "Human Resources", "Legal", "Executive / C-Suite", "Other"
    ];


    return (
        <div className="step-content fade-in">
            <div className="corp-step-header">
                <h1 className="step-title">Employee Roster</h1>
                <p className="step-subtitle">Define your batch name and input employee details. You can also generate a delegation link for employees to fill in their own information.</p>
            </div>
            
            {/* 1. Batch Name */}
            <div className="wizard-form-grid" style={{ marginBottom: '10px' }}>
                <div className="wizard-input-group full-width">
                    <label>Batch Name (Internal Corporate Reference)</label>
                    <input 
                        type="text" 
                        value={data.batchName} 
                        onChange={(e) => updateData('batchName', e.target.value)} 
                        className="premium-input" 
                        placeholder="e.g. Q3 Berlin Relocation Batch"
                    />
                </div>
            </div>

            {/* Section Divider */}
            <div className="section-divider-corp">
                <div className="divider-title-group">
                    <h3>Employee List ({data.employees.length})</h3>
                </div>
                <div className="divider-actions">
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleCsvUpload} 
                        style={{ display: 'none' }} 
                        accept=".csv" 
                    />
                    <button className="btn-outline-corp" onClick={() => fileInputRef.current?.click()} type="button">
                        <UploadIcon size={16} />
                        Upload CSV
                    </button>
                    <button className="btn-add-corp" onClick={handleAddEmployee} type="button">
                        <UserPlusIcon size={16} />
                        Add Employee
                    </button>
                </div>
            </div>

            {/* 2. Employee List */}
            <div className="applicants-container">
                {data.employees.length === 0 ? (
                    <div className="empty-applicants-box fade-in">
                        <UserPlusIcon size={32} style={{ color: 'var(--color-text-muted)' }} />
                        <p>No employees added to this batch yet. Add them manually or upload a CSV file.</p>
                    </div>
                ) : (
                    data.employees.map((emp, index) => (
                        <div key={emp.id} className="corp-employee-card fade-in">
                            
                            {/* Card Header */}
                            <div className="corp-emp-card-header">
                                <div className="emp-title-section">
                                    <div className="emp-avatar-placeholder">{emp.firstName ? emp.firstName[0] : (index + 1)}</div>
                                    <h4>
                                        {emp.firstName || emp.lastName ? `${emp.firstName} ${emp.lastName}` : `Employee #${index + 1}`}
                                    </h4>
                                </div>
                                
                                <div className="emp-actions-section">
                                    <button 
                                        className="btn-delegate-link" 
                                        onClick={() => handleCopyDelegationLink(emp.id, `${emp.firstName} ${emp.lastName}`)}
                                        title="Copy Delegation Link"
                                        type="button"
                                    >
                                        <LinkIcon size={16} />
                                        Send Link
                                    </button>
                                    <button className="btn-remove-corp" onClick={() => handleRemoveEmployee(emp.id)} type="button">
                                        <TrashIcon size={16} />
                                    </button>
                                </div>
                            </div>
                            
                            {/* Corporate Form Grid (8 Fields Total) */}
                            <div className="wizard-form-grid">
                                
                                {/* Identity Row */}
                                <div className="wizard-input-group">
                                    <label>First Name</label>
                                    <input type="text" value={emp.firstName} onChange={(e) => handleEmployeeChange(emp.id, 'firstName', e.target.value)} className="premium-input" placeholder="e.g. David" />
                                </div>
                                <div className="wizard-input-group">
                                    <label>Last Name</label>
                                    <input type="text" value={emp.lastName} onChange={(e) => handleEmployeeChange(emp.id, 'lastName', e.target.value)} className="premium-input" placeholder="e.g. Smith" />
                                </div>
                                <div className="wizard-input-group">
                                    <label>Date of Birth</label>
                                    <input type="date" value={emp.dob} onChange={(e) => handleEmployeeChange(emp.id, 'dob', e.target.value)} className="premium-input" />
                                </div>

                                {/* Corporate Role Row */}
                                <div className="wizard-input-group">
                                    <label>Department</label>
                                    <select value={emp.department} onChange={(e) => handleEmployeeChange(emp.id, 'department', e.target.value)} className="premium-input">
                                        <option value="" disabled>Select Department</option>
                                        {departments.map(dep => (
                                            <option key={dep} value={dep}>{dep}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="wizard-input-group" style={{ gridColumn: 'span 2' }}>
                                    <label>Job Title / Role</label>
                                    <input type="text" value={emp.role} onChange={(e) => handleEmployeeChange(emp.id, 'role', e.target.value)} className="premium-input" placeholder="e.g. Senior Software Engineer" />
                                </div>

                                {/* Passport Row */}
                                <div className="wizard-input-group">
                                    <label>Passport Number</label>
                                    <input type="text" value={emp.passportNumber} onChange={(e) => handleEmployeeChange(emp.id, 'passportNumber', e.target.value.toUpperCase())} className="premium-input" placeholder="e.g. P1234567" />
                                </div>
                                <div className="wizard-input-group">
                                    <label>Passport Issue Date</label>
                                    <input type="date" value={emp.issueDate} onChange={(e) => handleEmployeeChange(emp.id, 'issueDate', e.target.value)} className="premium-input" />
                                </div>
                                <div className="wizard-input-group">
                                    <label>Passport Expiry Date</label>
                                    <input type="date" value={emp.expiryDate} onChange={(e) => handleEmployeeChange(emp.id, 'expiryDate', e.target.value)} className="premium-input" />
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}