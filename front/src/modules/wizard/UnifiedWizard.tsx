import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/shared/context/AuthContext';
import { useToast } from '@/shared/context/ToastContext';
import {
  dossierService,
  appointmentService,
  additionalService,
  agentService,
  paymentService,
} from '@/shared/api/services';
import { corporateService } from '@/shared/api/services/corporate.service';
import { storage } from '@/shared/utils/storage';
import { usePricingCatalog, type PricingPackageItem } from '@/shared/hooks/usePricingCatalog';
import './UnifiedWizard.css';

import type { WizardPortalType, WizardFormData } from './types/wizard.types';
import Step1Destination from './Steps/Step1Destination';
import Step2Packages from './Steps/Step2Packages';
import Step3Roster from './Steps/Step3Roster';
import Step4Biometrics from './Steps/Step4Biometrics';
import Step5Review from './Steps/Step5Review';

interface UnifiedWizardProps {
  portalType?: WizardPortalType;
}

export default function UnifiedWizard({ portalType: propPortalType }: UnifiedWizardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  // Resolve portal type from prop or current pathname
  const portalType: WizardPortalType = React.useMemo(() => {
    if (propPortalType) return propPortalType;
    const p = location.pathname.toLowerCase();
    if (p.includes('/agent/')) return 'GROUP_AGENT';
    if (p.includes('/corporate/')) return 'CORPORATE';
    return 'INDIVIDUAL';
  }, [propPortalType, location.pathname]);

  const isIndividual = portalType === 'INDIVIDUAL';
  const isAgent = portalType === 'GROUP_AGENT';
  const isCorporate = portalType === 'CORPORATE';

  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const { catalog, packages, calculateLiveFees } = usePricingCatalog();
  const activePackages = (packages || []).filter((p) => p.isActive !== false);

  // Initial Form Data
  const [formData, setFormData] = useState<WizardFormData>(() => {
    const names = (user?.fullName || '').trim().split(' ').filter(Boolean);
    const initialFirstName = (user as any)?.firstName || names[0] || '';
    const initialLastName = (user as any)?.lastName || names.slice(1).join(' ') || '';
    const initialPassport = (user as any)?.passportNumber || '';

    return {
      // Step 1
      country: 'Hungary',
      countryId: '',
      countryCode: 'HU',
      duration: 'short',
      projectReason: 'Tourism & Leisure Travel',
      travelDate: '',

      // Step 2
      services: {
        activePackage: 'standard',
        filePrep: false,
        insurance: false,
        formAssist: false,
        photo: false,
        lounge: false,
        courier: false,
        hotelFlight: false,
      },

      // Step 3
      groupName: isCorporate ? 'Corporate Delegation 2026' : isAgent ? 'Tour Group 2026' : undefined,
      applicants: [
        {
          id: 'app-main',
          firstName: isIndividual ? initialFirstName : '',
          lastName: isIndividual ? initialLastName : '',
          passportNumber: isIndividual ? initialPassport : '',
          dob: '',
          gender: 'MALE',
          nationality: 'AZ',
          issueDate: '',
          expiryDate: '',
          familyRole: 'PRIMARY',
          jobTitle: isCorporate ? 'Specialist' : undefined,
          department: isCorporate ? 'Operations' : undefined,
        },
      ],

      // Step 4
      visaCenter: 'main',
      appointmentDate: '',
      appointmentTime: '10:00 AM',

      // Step 5
      gdprConsent: false,
      paymentMethod: 'WALLET',
    };
  });

  // Fetch Wallet Balance for settlement across all portals
  useEffect(() => {
    if (isCorporate) {
      corporateService
        .getWallet()
        .then((res: any) => {
          const bal = Number(res?.data?.wallet?.balance ?? res?.wallet?.balance ?? 0);
          setWalletBalance(bal);
        })
        .catch(() => setWalletBalance(0));
    } else if (isAgent) {
      agentService
        .getWallet()
        .then((res: any) => {
          const bal = Number(res?.data?.wallet?.balance ?? res?.wallet?.balance ?? 0);
          setWalletBalance(bal);
        })
        .catch(() => setWalletBalance(0));
    } else {
      paymentService
        .getUserWallet()
        .then((res: any) => {
          const bal = Number(res?.data?.wallet?.balanceEur ?? res?.data?.balance ?? 0);
          setWalletBalance(bal);
        })
        .catch(() => setWalletBalance(0));
    }
  }, [isCorporate, isAgent]);

  const updateFormData = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelectPackageAnyStep = (pkg: PricingPackageItem) => {
    const flags = pkg.wizardFlags || {
      filePrep: (pkg.includedServiceIds || []).includes('FILE_PREPARATION'),
      insurance: (pkg.includedServiceIds || []).includes('TRAVEL_INSURANCE'),
      formAssist: (pkg.includedServiceIds || []).includes('FORM_ASSIST'),
      photo: (pkg.includedServiceIds || []).includes('BIOMETRIC_PHOTO'),
      lounge: (pkg.includedServiceIds || []).includes('PREMIUM_LOUNGE'),
      courier: (pkg.includedServiceIds || []).includes('COURIER'),
      hotelFlight:
        (pkg.includedServiceIds || []).includes('HOTEL_BOOKING') ||
        (pkg.includedServiceIds || []).includes('FLIGHT_BOOKING'),
    };
    updateFormData('services', {
      activePackage: pkg.id,
      filePrep: !!flags.filePrep,
      insurance: !!flags.insurance,
      formAssist: !!flags.formAssist,
      photo: !!flags.photo,
      lounge: !!flags.lounge,
      courier: !!flags.courier,
      hotelFlight: !!flags.hotelFlight,
    });
  };

  const liveFees = calculateLiveFees({
    portalType,
    paxCount: formData.applicants?.length || 1,
    activePackage: formData.services.activePackage,
    services: formData.services,
    duration: formData.duration || 'short',
  });

  // Exit Link
  const handleExit = () => {
    if (isCorporate) navigate('/corporate/batches');
    else if (isAgent) navigate('/agent/groups');
    else navigate('/client');
  };

  // Validate Step before advancing
  const isNextDisabled = () => {
    if (currentStep === 1) {
      return !formData.country || !formData.duration || !formData.projectReason;
    }
    if (currentStep === 3) {
      if (!isIndividual && !formData.groupName?.trim()) return true;
      if (!formData.applicants || formData.applicants.length === 0) return true;
      const invalid = formData.applicants.some(
        (a) => !a.firstName.trim() || !a.lastName.trim() || !a.passportNumber.trim()
      );
      if (invalid) return true;
    }
    if (currentStep === 4) {
      return !formData.appointmentDate || !formData.appointmentTime;
    }
    if (currentStep === 5) {
      return !formData.gdprConsent || submitting;
    }
    return false;
  };

  // Handle Step Navigation
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    } else {
      handleExit();
    }
  };

  const handleNext = async () => {
    if (currentStep < 5) {
      setCurrentStep((prev) => prev + 1);
      return;
    }

    // Final Submission (Step 5)
    setSubmitting(true);
    try {
      // 1. Resolve real Country & VisaCategory ID
      let countryId = formData.countryId;
      let visaCategoryId = '';
      try {
        const countriesRes = await dossierService.getCountries();
        const countriesList = countriesRes.data?.countries || [];
        const matched = countriesList.find(
          (c: any) =>
            c.id === countryId ||
            c.code?.toUpperCase() === formData.countryCode?.toUpperCase() ||
            c.nameEn?.toLowerCase() === formData.country?.toLowerCase()
        ) || countriesList[0];

        if (matched) {
          countryId = matched.id;
          const catRes = await dossierService.getVisaCategories(countryId);
          const categories = catRes.data?.visaCategories || [];
          const matchedCat = categories.find((cat: any) =>
            formData.duration === 'long'
              ? cat.code?.includes('NATIONAL') || cat.nameEn?.toLowerCase().includes('national')
              : cat.code?.includes('TOURIST') || cat.code?.includes('SCHENGEN') || cat.nameEn?.toLowerCase().includes('tourist')
          ) || categories[0];
          if (matchedCat) visaCategoryId = matchedCat.id;
        }
      } catch (err) {
        console.warn('Error resolving country/category IDs from templates:', err);
      }

      // 2. Execute Portal-Specific Creation
      if (isIndividual) {
        // --- INDIVIDUAL CREATION ---
        const dossierRes: any = await dossierService.createDossier({
          portalType: 'INDIVIDUAL',
          countryId: countryId || 'hu-default',
          visaCategoryId: visaCategoryId || countryId || 'cat-default',
          package: formData.services.activePackage || 'standard',
          services: formData.services,
          applicantsCount: formData.applicants.length,
          applicants: formData.applicants,
        });

        const createdDossier = dossierRes.data?.dossier || dossierRes.data;
        const dossierId = createdDossier?.id;

        if (dossierId) {
          storage.setActiveDossierId(dossierId);

          // Update primary applicant
          const dbPrimary = createdDossier.applicants?.[0];
          const formPrimary = formData.applicants[0];
          if (dbPrimary && formPrimary) {
            await dossierService.updateApplicantForm(dossierId, dbPrimary.id, {
              firstName: formPrimary.firstName || user?.fullName?.split(' ')[0] || 'Applicant',
              lastName: formPrimary.lastName || '',
              passportNumber: formPrimary.passportNumber || '',
              gender: formPrimary.gender || 'MALE',
              nationality: formPrimary.nationality || 'AZ',
              birthDate: formPrimary.dob || undefined,
              issueDate: formPrimary.issueDate || undefined,
              passportExpiry: formPrimary.expiryDate || undefined,
              destination: formData.country,
              purpose: formData.projectReason,
              homeEmail: user?.email || '',
              homePhone: user?.phone || '',
            }).catch(() => {});
          }

          // Add additional services from Admin-managed package & custom selections
          const s = formData.services;
          const selectedPkgObj = activePackages.find(
            (p) => String(p.id).toLowerCase() === String(s.activePackage || 'standard').toLowerCase()
          );
          const servicesToAdd = new Set<string>(selectedPkgObj?.includedServiceIds || []);
          if (s.lounge) servicesToAdd.add('PREMIUM_LOUNGE');
          if (s.insurance) servicesToAdd.add('TRAVEL_INSURANCE');
          if (s.filePrep) servicesToAdd.add('FILE_PREPARATION');
          if (s.courier) servicesToAdd.add('COURIER');
          if (s.photo) servicesToAdd.add('BIOMETRIC_PHOTO');
          if (s.formAssist) servicesToAdd.add('FORM_ASSIST');
          if (s.express) servicesToAdd.add('EXPRESS_PROCESSING');
          if (s.translation) servicesToAdd.add('TRANSLATION_APOSTILLE');
          if (s.sms) servicesToAdd.add('SMS_TRACKING');
          if (s.hotelFlight) {
            servicesToAdd.add('HOTEL_BOOKING');
            servicesToAdd.add('FLIGHT_BOOKING');
          }

          for (const srvCode of Array.from(servicesToAdd)) {
            await additionalService.addService({ dossierId, serviceType: srvCode }).catch(() => {});
          }

          // Book Appointment
          if (formData.appointmentDate) {
            try {
              let centerLocation = 'EuroTech Main Center';
              if (formData.visaCenter === 'lounge') centerLocation = 'EuroTech Premium Lounge';
              else if (formData.visaCenter === 'ganja') centerLocation = 'Ganja Regional Center';
              const slotsRes = await appointmentService.getSlots(formData.appointmentDate, centerLocation);
              const slots = slotsRes.data?.slots || [];
              const chosenSlot = slots.find((sl: any) => sl.slotTime === formData.appointmentTime) || slots[0];
              if (chosenSlot) {
                await appointmentService.bookAppointment({
                  dossierId,
                  timeSlotId: chosenSlot.id,
                });
              }
            } catch (apptErr) {
              console.warn('Appointment booking error:', apptErr);
            }
          }

          // Settle directly from Individual Wallet if selected
          if (formData.paymentMethod === 'WALLET') {
            await paymentService.payWithWallet({ dossierId }).catch((payErr: any) => {
              console.warn('Individual wallet auto-settle failed:', payErr);
            });
          }

          showSuccess('Application dossier registered successfully!');
          navigate(`/application/${dossierId}`);
        } else {
          showSuccess('Application registered successfully!');
          navigate('/client');
        }
      } else if (isAgent) {
        // --- TOUR OPERATOR (AGENT) CREATION ---
        await agentService.createGroup({
          name: formData.groupName || 'Tour Group',
          destination: formData.country || 'Hungary',
          travelDate: formData.travelDate || new Date().toISOString().split('T')[0],
          duration: formData.duration || 'short',
          projectReason: formData.projectReason || 'Tourism',
          package: formData.services.activePackage || 'standard',
          appointmentDate: formData.appointmentDate || undefined,
          appointmentTime: formData.appointmentTime || undefined,
          applicants: formData.applicants.map((a) => ({
            firstName: a.firstName.trim(),
            lastName: a.lastName.trim(),
            passportNumber: a.passportNumber.trim().toUpperCase(),
            dob: a.dob || undefined,
            issueDate: a.issueDate || undefined,
            expiryDate: a.expiryDate || undefined,
          })),
        });

        showSuccess('Tour Group registered successfully with all travelers!');
        navigate('/agent/groups');
      } else if (isCorporate) {
        // --- CORPORATE MOBILITY CREATION ---
        await corporateService.createBatch({
          name: formData.groupName || 'Corporate Delegation',
          destination: formData.country || 'Hungary',
          travelDate: formData.travelDate || new Date().toISOString().split('T')[0],
          duration: formData.duration || 'short',
          projectReason: formData.projectReason || 'Business',
          package: formData.services.activePackage || 'standard',
          packagePrice: liveFees.packageAddOnPP,
          appointmentDate: formData.appointmentDate || undefined,
          appointmentTime: formData.appointmentTime || undefined,
          paymentMethod: formData.paymentMethod || 'WALLET',
          totalAmount: liveFees.grandTotalEur,
          employees: formData.applicants.map((a) => ({
            firstName: a.firstName.trim(),
            lastName: a.lastName.trim(),
            passportNumber: a.passportNumber.trim().toUpperCase(),
            dob: a.dob || undefined,
            issueDate: a.issueDate || undefined,
            expiryDate: a.expiryDate || undefined,
            role: a.jobTitle || 'Specialist',
            department: a.department || 'Operations',
          })),
        });

        showSuccess(
          formData.paymentMethod === 'WALLET'
            ? 'Corporate Batch registered & settled directly from Company Wallet!'
            : 'Corporate Employee Batch created successfully!'
        );
        navigate('/corporate/batches');
      }
    } catch (err: any) {
      console.error('Wizard submission error:', err);
      showError(err.message || 'Failed to submit application. Please review form entries.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="wizard-layout">
      {/* Top Header */}
      <header className="wizard-header">
        <div className="wizard-brand">
          <span className="brand-badge">EUROTECH</span>
          <span className="brand-title">
            {isCorporate
              ? 'Corporate Application Portal'
              : isAgent
              ? 'Tour Operator Application Portal'
              : 'Individual Application Portal'}
          </span>
        </div>
        <button type="button" className="btn-close" onClick={handleExit}>
          Exit Application
        </button>
      </header>

      {/* Main Content with Left Stepper */}
      <div className="wizard-main">
        {/* Left Vertical Stepper */}
        <aside className="wizard-sidebar">
          <ul className="stepper-list">
            <li className={`stepper-item ${currentStep === 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>
              <div className="step-indicator">{currentStep > 1 ? '✓' : '1'}</div>
              <span className="step-name">Destination & Visa</span>
            </li>
            <li className={`stepper-item ${currentStep === 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>
              <div className="step-indicator">{currentStep > 2 ? '✓' : '2'}</div>
              <span className="step-name">Packages & Services</span>
            </li>
            <li className={`stepper-item ${currentStep === 3 ? 'active' : ''} ${currentStep > 3 ? 'completed' : ''}`}>
              <div className="step-indicator">{currentStep > 3 ? '✓' : '3'}</div>
              <span className="step-name">Applicant Info</span>
            </li>
            <li className={`stepper-item ${currentStep === 4 ? 'active' : ''} ${currentStep > 4 ? 'completed' : ''}`}>
              <div className="step-indicator">{currentStep > 4 ? '✓' : '4'}</div>
              <span className="step-name">Appointment</span>
            </li>
            <li className={`stepper-item ${currentStep === 5 ? 'active' : ''}`}>
              <div className="step-indicator">5</div>
              <span className="step-name">Confirmation</span>
            </li>
          </ul>

          {/* Persistent Live Package & Fee Summary in Sidebar across ALL 5 Steps */}
          <div
            style={{
              marginTop: '24px',
              padding: '16px',
              background: '#F8FAFC',
              border: '1.5px solid #E2E8F0',
              borderRadius: '12px',
            }}
          >
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Active Payment Package
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1D4ED8', marginTop: '4px' }}>
              {liveFees.packageName}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '4px' }}>
              {liveFees.paxCount} {liveFees.paxCount === 1 ? 'Applicant' : 'Applicants'} •{' '}
              {formData.duration === 'long' ? 'National D' : 'Schengen C'}
            </div>
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>Est. Total:</span>
              <strong style={{ fontSize: '1.15rem', color: '#0F172A', fontWeight: 900 }}>
                €{liveFees.grandTotalEur.toFixed(2)}
              </strong>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.74rem', color: '#64748B' }}>
              ≈ {liveFees.grandTotalAzn.toFixed(2)} AZN
            </div>
          </div>
        </aside>

        {/* Center Step Form */}
        <section className="wizard-content-area">
          {/* Interactive Payment Package Bar visible across Steps 1, 3, and 4 (Step 2 & Step 5 have full package cards) */}
          {currentStep !== 2 && currentStep !== 5 && (
            <div
              style={{
                background: '#FFFFFF',
                border: '1.5px solid #DBEAFE',
                borderRadius: '12px',
                padding: '14px 18px',
                marginBottom: '18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.06)',
              }}
            >
              <div>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Step {currentStep} of 5 • Payment Package &amp; Live Fee Calculator
                </span>
                <div style={{ fontSize: '0.86rem', color: '#334155', marginTop: '2px' }}>
                  Selected: <strong>{liveFees.packageName}</strong> ({liveFees.paxCount} Pax) — Total:{' '}
                  <strong style={{ color: '#2563EB' }}>€{liveFees.grandTotalEur.toFixed(2)}</strong> (~{liveFees.grandTotalAzn.toFixed(2)} AZN)
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {activePackages.map((pkg) => {
                  const isSel = String(formData.services.activePackage || 'standard').toLowerCase() === String(pkg.id).toLowerCase();
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => handleSelectPackageAnyStep(pkg)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: isSel ? '2px solid #2563EB' : '1px solid #CBD5E1',
                        background: isSel ? '#EFF6FF' : '#F8FAFC',
                        color: isSel ? '#1D4ED8' : '#334155',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                      }}
                    >
                      {pkg.name} ({Number(pkg.priceEur) > 0 ? `+€${Number(pkg.priceEur).toFixed(0)}` : '€0'})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="step-card">
            {currentStep === 1 && (
              <Step1Destination data={formData} updateData={updateFormData} />
            )}

            {currentStep === 2 && (
              <Step2Packages
                portalType={portalType}
                services={formData.services}
                applicantsCount={formData.applicants?.length || 1}
                updateData={updateFormData}
                catalog={catalog}
              />
            )}

            {currentStep === 3 && (
              <Step3Roster
                portalType={portalType}
                groupName={formData.groupName}
                applicants={formData.applicants}
                updateData={updateFormData}
              />
            )}

            {currentStep === 4 && (
              <Step4Biometrics data={formData} updateData={updateFormData} />
            )}

            {currentStep === 5 && (
              <Step5Review
                portalType={portalType}
                formData={formData}
                walletBalance={walletBalance}
                updateData={updateFormData}
                catalog={catalog}
              />
            )}
          </div>

          {/* Stepper Footer Controls */}
          <footer className="wizard-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleBack}
              disabled={submitting}
            >
              {currentStep === 1 ? 'Exit Wizard' : 'Previous Step'}
            </button>

            <button
              type="button"
              className="btn-primary"
              onClick={handleNext}
              disabled={isNextDisabled()}
            >
              {submitting
                ? 'Registering Consular Dossier...'
                : currentStep === 5
                ? 'Confirm & Register Application'
                : 'Save & Continue →'}
            </button>
          </footer>
        </section>
      </div>
    </div>
  );
}
