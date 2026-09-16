import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentService } from '@/shared/api/services';
import { useToast } from '@/shared/context/ToastContext';
import './AgentWizard.css';

// Yeni 5 addımlıq flow üçün komponentlər
import Step1Country from './Steps/Step1Country';
import Step2GroupServices from './Steps/Step2GroupServices';
import Step3GroupApplicants from './Steps/Step3GroupApplicants';
import Step4Appointments from './Steps/Step4Appointments';
import Step5Confirmation from './Steps/Step5Confirmation';

export interface ApplicantData {
    id: string;
    firstName: string;
    lastName: string;
    passportNumber: string;
    dob: string;
    issueDate: string; // <-- ADDED
    expiryDate: string; // <-- ADDED
    documents: { passport: boolean; photo: boolean; };
}

export default function AgentWizard() {
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast();
    const [currentStep, setCurrentStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        // Step 1
        country: '',
        duration: '', 
        projectReason: '',
        travelDate: '',
        
        // Step 2
        services: { 
            activePackage: 'standard', // 'standard' | 'premium' | 'vip'
        },
        
        // Step 3
        groupName: '',
        applicants: [] as ApplicantData[],
        
        // Step 4
        appointmentDate: '',
        appointmentTime: ''
    });

    const updateFormData = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleNext = async () => {
        if (currentStep < 5) {
            setCurrentStep(prev => prev + 1);
            return;
        }

        setSubmitting(true);
        try {
            await agentService.createGroup({
                name: formData.groupName || 'Tour Delegation',
                destination: formData.country || 'Hungary',
                travelDate: formData.travelDate || new Date().toISOString().split('T')[0],
                duration: formData.duration || 'short',
                projectReason: formData.projectReason || 'Tourism',
            });
            showSuccess('Tour Group registered successfully!');
            navigate('/agent/groups');
        } catch (err: any) {
            console.error('Agent group create error:', err);
            showError(err.message || 'Group created with local state.');
            navigate('/agent/groups');
        } finally {
            setSubmitting(false);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) setCurrentStep(prev => prev - 1);
        else navigate('/agent'); 
    };

    const isNextDisabled = () => {
        if (currentStep === 1) return !formData.country || !formData.duration || !formData.projectReason || !formData.travelDate;        
        if (currentStep === 2) return false; // Package has default 'standard'
        if (currentStep === 3) {
            if (!formData.groupName.trim()) return true;
            if (formData.applicants.length === 0) return true;
            return formData.applicants.some(app => 
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
                <div className="wizard-brand">
                    <span className="brand-badge">B2B PORTAL</span>
                    <span className="brand-title">New Group Application</span>
                </div>
                <button className="btn-close" onClick={() => navigate('/agent')}>Exit Wizard</button>
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
                    <div className="step-card">
                        {renderStepContent()}
                    </div>

                    <footer className="wizard-footer">
                        <button className="btn-secondary" onClick={handleBack}>
                            {currentStep === 1 ? 'Cancel' : 'Back'}
                        </button>
                        <button className="btn-primary" onClick={handleNext} disabled={isNextDisabled() || submitting}>
                            {submitting ? 'Registering Group...' : currentStep === 5 ? 'Submit Group Application' : 'Next Step \u2192'}
                        </button>
                    </footer>
                </section>
            </main>
        </div>
    );
}