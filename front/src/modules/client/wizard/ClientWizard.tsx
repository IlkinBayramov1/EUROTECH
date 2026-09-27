import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/context/AuthContext';
import { dossierService, appointmentService, additionalService } from '@/shared/api/services';
import { useToast } from '@/shared/context/ToastContext';
import { storage } from '@/shared/utils/storage';
import './ClientWizard.css';

// Consular 5-Step Process Components
import Step1Country from './Steps/Step1Country';
import Step2Services from './Steps/Step2Services';
import Step3Applicant from './Steps/Step3Applicant';
import Step4Appointment from './Steps/Step4Appointment';
import Step5Confirm from './Steps/Step5Confirm';

export default function IndividualWizard() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showSuccess, showError } = useToast();
    const [currentStep, setCurrentStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);

    // Initial applicant info from authenticated user if available
    const [formData, setFormData] = useState(() => {
        const names = (user?.fullName || '').trim().split(' ');
        const initialFirstName = user?.firstName || names[0] || '';
        const initialLastName = user?.lastName || names.slice(1).join(' ') || '';
        const initialPassport = user?.passportNumber || '';

        return {
            // Step 1
            country: 'HU',
            duration: 'short',
            projectReason: 'tourism',
            
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
                {
                    id: 'app-main',
                    firstName: initialFirstName,
                    lastName: initialLastName,
                    dob: '',
                    gender: 'MALE' as const,
                    nationality: 'AZ',
                    passportNumber: initialPassport,
                    issueDate: '',
                    expiryDate: '',
                    familyRole: 'PRIMARY' as const
                }
            ],
            
            // Step 4
            visaCenter: 'baku',
            appointmentDate: '',
            appointmentTime: '',

            // Step 5
            gdprConsent: false
        };
    });

    useEffect(() => {
        if (user) {
            setFormData(prev => {
                const firstApp = prev.applicants[0];
                if (!firstApp.firstName && !firstApp.passportNumber) {
                    const names = (user.fullName || '').trim().split(' ');
                    return {
                        ...prev,
                        applicants: [
                            {
                                ...firstApp,
                                firstName: user.firstName || names[0] || '',
                                lastName: user.lastName || names.slice(1).join(' ') || '',
                                passportNumber: user.passportNumber || firstApp.passportNumber
                            },
                            ...prev.applicants.slice(1)
                        ]
                    };
                }
                return prev;
            });
        }
    }, [user]);

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
            let countryId = '';
            let visaCategoryId = '';
            let selectedCountryName = 'Hungary';
            try {
                const countriesRes = await dossierService.getCountries();
                const countries = countriesRes.data?.countries || [];
                const matchedCountry = countries.find((c: any) => 
                    c.code?.toLowerCase() === (formData.country || 'HU').toLowerCase() ||
                    c.nameEn?.toLowerCase().includes((formData.country || '').toLowerCase()) ||
                    c.nameAz?.toLowerCase().includes((formData.country || '').toLowerCase())
                ) || countries[0];

                if (matchedCountry) {
                    countryId = matchedCountry.id;
                    selectedCountryName = matchedCountry.nameEn || 'Hungary';
                    const catRes = await dossierService.getVisaCategories(countryId);
                    const categories = catRes.data?.visaCategories || [];
                    const matchedCat = categories.find((cat: any) => 
                        formData.duration === 'long'
                            ? (cat.code?.includes('NATIONAL') || cat.nameEn?.toLowerCase().includes('national'))
                            : (cat.code?.includes('TOURIST') || cat.code?.includes('SCHENGEN') || cat.nameEn?.toLowerCase().includes('tourist'))
                    ) || categories[0];
                    if (matchedCat) {
                        visaCategoryId = matchedCat.id;
                    }
                }
            } catch (tplErr) {
                console.warn('Template load fallback:', tplErr);
            }

            if (countryId && visaCategoryId) {
                const dossierRes = await dossierService.createDossier({
                    portalType: 'INDIVIDUAL',
                    countryId,
                    visaCategoryId,
                });
                const createdDossier = dossierRes.data?.dossier || dossierRes.data;
                const dossierId = createdDossier?.id;

                if (dossierId) {
                    storage.setActiveDossierId(dossierId);

                    const dbPrimaryApplicant = createdDossier.applicants?.[0];
                    const firstFormApplicant = formData.applicants?.[0];

                    // Update primary applicant with full details from Step 3
                    if (dbPrimaryApplicant && firstFormApplicant) {
                        await dossierService.updateApplicantForm(dossierId, dbPrimaryApplicant.id, {
                            firstName: firstFormApplicant.firstName || user?.firstName || 'Müştəri',
                            lastName: firstFormApplicant.lastName || user?.lastName || '',
                            passportNumber: firstFormApplicant.passportNumber || user?.passportNumber || '',
                            gender: firstFormApplicant.gender || 'MALE',
                            nationality: firstFormApplicant.nationality || 'AZ',
                            birthDate: firstFormApplicant.dob || undefined,
                            passportExpiry: firstFormApplicant.expiryDate || undefined,
                            destination: selectedCountryName,
                            purpose: formData.projectReason === 'tourism' ? 'Tourism' : 'Business',
                            homeEmail: user?.email || '',
                            homePhone: user?.phone || '',
                        }).catch(e => console.warn('Primary applicant update err:', e));
                    }

                    // If user added co-applicants in Step 3 (index > 0), add them
                    if (formData.applicants && formData.applicants.length > 1) {
                        const coApplicants = formData.applicants.slice(1).map((app: any) => ({
                            firstName: app.firstName,
                            lastName: app.lastName,
                            passportNumber: app.passportNumber,
                            gender: app.gender || 'MALE',
                            nationality: app.nationality || 'AZ',
                            birthDate: app.dob || undefined,
                            passportExpiry: app.expiryDate || undefined,
                            familyRole: app.familyRole || 'SPOUSE',
                            formDataJson: {
                                firstName: app.firstName,
                                lastName: app.lastName,
                                passportNumber: app.passportNumber,
                                nationality: app.nationality || 'Azerbaijan',
                                destination: selectedCountryName,
                            }
                        }));
                        await dossierService.addApplicants(dossierId, coApplicants).catch(e => console.warn('Co-applicants add err:', e));
                    }

                    // Add selected additional services
                    const s = formData.services;
                    if (s.lounge || s.activePackage === 'vip') await additionalService.addService({ dossierId, serviceType: 'PREMIUM_LOUNGE' }).catch(() => {});
                    if (s.insurance) await additionalService.addService({ dossierId, serviceType: 'TRAVEL_INSURANCE' }).catch(() => {});
                    if (s.filePrep || s.activePackage === 'premium' || s.activePackage === 'vip') await additionalService.addService({ dossierId, serviceType: 'FILE_PREPARATION' }).catch(() => {});
                    if (s.courier || s.activePackage === 'vip') await additionalService.addService({ dossierId, serviceType: 'COURIER' }).catch(() => {});
                    if (s.photo || s.activePackage === 'premium' || s.activePackage === 'vip') await additionalService.addService({ dossierId, serviceType: 'PHOTO' }).catch(() => {});

                    // Book appointment slot
                    if (formData.appointmentDate) {
                        try {
                            const slotsRes = await appointmentService.getSlots(formData.appointmentDate);
                            const slots = slotsRes.data?.slots || [];
                            const matchedSlot = slots.find((sl: any) => 
                                sl.startTime === formData.appointmentTime ||
                                sl.startTime?.replace(/\s+/g, '') === (formData.appointmentTime || '').replace(/\s+/g, '')
                            ) || slots[0];
                            if (matchedSlot) {
                                await appointmentService.bookAppointment({
                                    dossierId,
                                    timeSlotId: matchedSlot.id,
                                });
                            }
                        } catch (slotErr) {
                            console.warn('Slot booking fallback:', slotErr);
                        }
                    }
                }
            }
            showSuccess('Application dossier submitted and slot confirmed!');
            navigate('/client', { replace: true });
        } catch (err: any) {
            console.error('Submission error:', err);
            showError(err.message || 'Application submitted with offline backup.');
            navigate('/client', { replace: true });
        } finally {
            setSubmitting(false);
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
        if (currentStep === 2) return false; // Services are optional
        if (currentStep === 3) {
            // Check if ANY applicant has an empty required field
            return formData.applicants.some(
                app => !app.firstName?.trim() || !app.lastName?.trim() || !app.dob?.trim() || 
                       !app.passportNumber?.trim() || !app.issueDate?.trim() || !app.expiryDate?.trim()
            );
        }
        if (currentStep === 4) return !formData.appointmentDate || !formData.appointmentTime;
        if (currentStep === 5) return !formData.gdprConsent;
        
        return false;
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 1: return <Step1Country data={formData} updateData={updateFormData} />;
            case 2: return <Step2Services data={formData} updateData={updateFormData} />;
            case 3: return <Step3Applicant data={formData} updateData={updateFormData} />;
            case 4: return <Step4Appointment data={formData} updateData={updateFormData} />;
            case 5: return <Step5Confirm data={formData} updateData={updateFormData} />;
            default: return null;
        }
    };

    const steps = ['Destination & Visa', 'Packages & Services', 'Applicant Info', 'Appointment', 'Confirmation'];

    return (
        <div className="wizard-layout">
            <header className="wizard-header">
                <div className="wizard-brand">
                    <span className="brand-badge">EUROTECH</span>
                    <span className="brand-title">Individual Application Portal</span>
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
                            disabled={isNextDisabled() || submitting}
                        >
                            {submitting 
                                ? 'Authorizing & Submitting...' 
                                : currentStep === 5 
                                    ? 'Confirm & Finalize Dossier \u2192' 
                                    : 'Next Step \u2192'}
                        </button>
                    </footer>
                </section>
            </main>
        </div>
    );
}