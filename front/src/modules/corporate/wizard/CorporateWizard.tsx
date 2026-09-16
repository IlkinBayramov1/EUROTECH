import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EuroTechLogo } from '@/shared/components/icons/Icons';
import './CorporateWizard.css';

// Yeni 5 addımlıq flow üçün komponentlər
import Step1Country from './Steps/Step1Country';
import Step2GroupServices from './Steps/Step2GroupServices';
import Step3GroupApplicants from './Steps/Step3GroupApplicants';
import Step4Appointments from './Steps/Step4Appointments';
import Step5Confirmation from './Steps/Step5Confirmation';

import { corporateService } from '@/shared/api/services/corporate.service';

export interface EmployeeData {
    id: string;
    firstName: string;
    lastName: string;
    dob: string;
    passportNumber: string;
    issueDate: string;
    expiryDate: string;
    role: string;        // <-- YENİ: Vəzifə
    department: string;  // <-- YENİ: Şöbə
    documents: { passport: boolean; photo: boolean };
}

export default function CorporateWizard() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        // Step 1
        country: '',
        destination: '',
        duration: '', 
        projectReason: '',
        travelDate: '',
        
        // Step 2
        services: { 
            activePackage: 'standard', // 'standard' | 'premium' | 'vip'
        },
        
        // Step 3
        batchName: '',
        employees: [] as EmployeeData[],
        
        // Step 4
        appointmentDate: '',
        appointmentTime: ''
    });

    const updateFormData = (field: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            [field]: value,
            ...(field === 'country' ? { destination: value } : {})
        }));
    };

    const handleNext = async () => {
        if (currentStep < 5) {
            setCurrentStep(prev => prev + 1);
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            const batchRes = await corporateService.createBatch({
                name: formData.batchName || 'Corporate Delegation Batch',
                destination: formData.destination || formData.country || 'Europe / Schengen',
                travelDate: formData.travelDate,
                duration: formData.duration,
                projectReason: formData.projectReason,
            });

            const batchId = batchRes.data?.batch?.id;

            if (formData.employees && formData.employees.length > 0) {
                for (const emp of formData.employees) {
                    try {
                        await corporateService.addEmployee({
                            firstName: emp.firstName,
                            lastName: emp.lastName,
                            jobTitle: emp.role || 'Employee',
                            department: emp.department || 'General',
                            passportNumber: emp.passportNumber,
                        });
                    } catch (empErr) {
                        console.warn('Failed to add employee to directory:', empErr);
                    }
                }
            }

            if (batchId) {
                try {
                    await corporateService.generateInvoice(batchId);
                } catch (invErr) {
                    console.warn('Invoice auto-generation note:', invErr);
                }
            }

            navigate('/corporate/batches');
        } catch (err: any) {
            console.error('Failed to create corporate batch:', err);
            setError(err.message || 'Batch creation failed. Please check your data.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) setCurrentStep(prev => prev - 1);
        else navigate('/corporate'); 
    };

    const isNextDisabled = () => {
        if (currentStep === 1) return !formData.country || !formData.duration || !formData.projectReason || !formData.travelDate;        
        if (currentStep === 2) return false; // Package has default 'standard'
        if (currentStep === 3) {
            if (!formData.batchName.trim()) return true;
            if (formData.employees.length === 0) return true;
            return formData.employees.some(app => 
                !app.firstName.trim() || 
                !app.lastName.trim() || 
                !app.passportNumber.trim() || 
                !app.dob.trim() ||
                !app.issueDate.trim() || // <-- ADDED validation
                !app.expiryDate.trim()   // <-- ADDED validation
            );
        }
        if (currentStep === 4) return !formData.appointmentDate || !formData.appointmentTime;
        return false;
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 1: return <Step1Country data={formData} updateData={updateFormData} />;
            case 2: return <Step2GroupServices data={formData} updateData={updateFormData} />;
            case 3: return <Step3GroupApplicants data={formData} updateData={updateFormData} />;
            case 4: return <Step4Appointments data={formData} updateData={updateFormData} />;
            case 5: return <Step5Confirmation data={formData} />;
            default: return null;
        }
    };

    const steps = [
        'Destination & Visa', 
        'Packages & Services', 
        'Group Info', 
        'Group Appointment', 
        'Confirmation'
    ];

    return (
        <div className="agent-wizard-layout fade-in">
            <header className="wizard-header">
                <div className="wizard-brand" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <EuroTechLogo size={32} subtitle="Corporate Mobility" />
                    <span className="brand-badge" style={{ backgroundColor: 'var(--color-primary)' }}>NEW EMPLOYEE BATCH</span>
                </div>
                <button className="btn-close" onClick={() => navigate('/corporate')}>Exit Wizard</button>
            </header>

            <main className="wizard-main">
                <aside className="wizard-sidebar">
                    <ul className="stepper-list">
                        {steps.map((stepName, index) => {
                            const stepNumber = index + 1;
                            const isActive = currentStep === stepNumber;
                            const isCompleted = currentStep > stepNumber;

                            return (
                                <li key={stepNumber} className={`stepper-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                                    <div className="step-indicator">
                                        {isCompleted ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{width: '16px', height: '16px'}}><polyline points="20 6 9 17 4 12"/></svg> : stepNumber}
                                    </div>
                                    <span className="step-name">{stepName}</span>
                                </li>
                            );
                        })}
                    </ul>
                </aside>

                <section className="wizard-content-area">
                    {error && (
                        <div style={{ padding: '12px 16px', marginBottom: '16px', background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', fontSize: '14px' }}>
                            {error}
                        </div>
                    )}
                    <div className="step-card">
                        {renderStepContent()}
                    </div>

                    <footer className="wizard-footer">
                        <button className="btn-secondary" onClick={handleBack} disabled={submitting}>
                            {currentStep === 1 ? 'Cancel' : 'Back'}
                        </button>
                        <button className="btn-primary" onClick={handleNext} disabled={isNextDisabled() || submitting}>
                            {submitting ? 'Submitting Application...' : currentStep === 5 ? 'Submit Group Application' : 'Next Step \u2192'}
                        </button>
                    </footer>
                </section>
            </main>
        </div>
    );
}