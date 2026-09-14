import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ClientWizard.css';

// Yeni ardıcıllıqla addımların idxalı
import Step1Country from './Steps/Step1Country';
import Step2Services from './Steps/Step2Services';
import Step3Applicant from './Steps/Step3Applicant';
import Step4Appointment from './Steps/Step4Appointment';
import Step5Confirm from './Steps/Step5Confirm';

export default function IndividualWizard() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);

    // Yenilənmiş məlumat strukturu (5 Addım üçün)
    const [formData, setFormData] = useState({
        // Step 1
        country: '',
        duration: '',
        projectReason: '',
        
        // Step 2
        services: {
            activePackage: 'standard', // 'standard' | 'premium' | 'vip' | 'custom'
            filePrep: false,
            insurance: false,
            formAssist: false,
            photo: false,
            lounge: false,
            courier: false,
            hotelFlight: false
        },

        // Step 3
        applicants: [
            { id: 'app-main', firstName: '', lastName: '', dob: '', passportNumber: '', issueDate: '', expiryDate: '' }
        ],
        
        // Step 4
        appointmentDate: '',
        appointmentTime: ''
    });

    const updateFormData = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleNext = () => {
        if (currentStep < 5) {
            setCurrentStep(prev => prev + 1);
        } else {
            // Yekunda fərdi müştəri panelinə yönləndirmə
            navigate('/client'); 
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(prev => prev - 1);
        } else {
            navigate('/login/individual');
        }
    };

    const isNextDisabled = () => {
        if (currentStep === 1) return !formData.country || !formData.duration || !formData.projectReason;
        if (currentStep === 2) return false; // Xidmətlər məcbur deyil
        if (currentStep === 3) {
            // Check if ANY applicant has an empty field
            return formData.applicants.some(
                app => !app.firstName.trim() || !app.lastName.trim() || !app.dob.trim() || 
                       !app.passportNumber.trim() || !app.issueDate.trim() || !app.expiryDate.trim()
            );
        }
        if (currentStep === 4) return !formData.appointmentDate || !formData.appointmentTime;
        
        return false;
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 1: return <Step1Country data={formData} updateData={updateFormData} />;
            case 2: return <Step2Services data={formData} updateData={updateFormData} />;
            case 3: return <Step3Applicant data={formData} updateData={updateFormData} />;
            case 4: return <Step4Appointment data={formData} updateData={updateFormData} />;
            case 5: return <Step5Confirm data={formData} />;
            default: return null;
        }
    };

    const steps = ['Destination & Visa', 'Packages & Services', 'Applicant Info', 'Appointment', 'Confirmation'];

    return (
        <div className="wizard-layout">
            <header className="wizard-header">
                <div className="wizard-brand">
                    <span className="brand-badge">EUROTECH</span>
                    <span className="brand-title">Individual Application</span>
                </div>
                <button className="btn-close" onClick={() => navigate('/')}>Exit Application</button>
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
                                        {isCompleted ? (
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{width: '14px', height: '14px'}}>
                                                <polyline points="20 6 9 17 4 12"/>
                                            </svg>
                                        ) : stepNumber}
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
                        <button 
                            className="btn-primary" 
                            onClick={handleNext}
                            disabled={isNextDisabled()}
                        >
                            {currentStep === 5 ? 'Go to Dashboard' : 'Next Step \u2192'}
                        </button>
                    </footer>
                </section>
            </main>
        </div>
    );
}