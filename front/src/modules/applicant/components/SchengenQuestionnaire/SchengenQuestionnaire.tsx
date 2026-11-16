import React, { useState } from 'react';
import Step1TripDetails from './Step1TripDetails';
import Step2PersonalData from './Step2PersonalData';
import Step3TravelDocument from './Step3TravelDocument';
import Step4AccommodationExpenses from './Step4AccommodationExpenses';
import Step5ContactsEmployment from './Step5ContactsEmployment';
import type { DossierContext } from '../../types/applicant.types';

interface SchengenQuestionnaireProps {
  formData: Record<string, any>;
  onFieldChange: (field: string, value: any) => void;
  dossier: DossierContext | null;
  onOpenMrzModal: () => void;
  onSaveForm: () => void;
  isCorporateMode?: boolean;
}

export default function SchengenQuestionnaire({
  formData,
  onFieldChange,
  dossier,
  onOpenMrzModal,
  onSaveForm,
  isCorporateMode,
}: SchengenQuestionnaireProps) {
  const [currentStep, setCurrentStep] = useState(1);

  const steps = [
    { id: 1, title: '1. Plans & Purpose' },
    { id: 2, title: '2. Identification' },
    { id: 3, title: '3. Travel Document' },
    { id: 4, title: '4. Stay & Solvency' },
    { id: 5, title: '5. Contacts & Job' },
  ];

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < 5) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      onSaveForm();
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="schengen-questionnaire-card">
      {/* Horizontal Stepper */}
      <div className="questionnaire-horizontal-stepper">
        {steps.map((st) => {
          const isActive = currentStep === st.id;
          const isCompleted = currentStep > st.id;
          return (
            <button
              key={st.id}
              type="button"
              className={`stepper-node ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              onClick={() => setCurrentStep(st.id)}
            >
              <div className="node-number">{isCompleted ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ width: 12, height: 12, display: 'block', margin: 'auto' }}><polyline points="20 6 9 17 4 12"/></svg> : st.id}</div>
              <span className="node-title">{st.title}</span>
              <div className="node-line"></div>
            </button>
          );
        })}
      </div>

      {/* Form Content */}
      <form onSubmit={handleNext} className="questionnaire-body-form">
        {currentStep === 1 && (
          <Step1TripDetails
            formData={formData}
            onChange={onFieldChange}
            destinationFallback={dossier?.country?.nameEn}
          />
        )}

        {currentStep === 2 && (
          <Step2PersonalData
            formData={formData}
            onChange={onFieldChange}
          />
        )}

        {currentStep === 3 && (
          <Step3TravelDocument
            formData={formData}
            onChange={onFieldChange}
            onOpenMrzModal={onOpenMrzModal}
          />
        )}

        {currentStep === 4 && (
          <Step4AccommodationExpenses
            formData={formData}
            onChange={onFieldChange}
            isCorporateMode={isCorporateMode}
            corporateCompanyName={dossier?.user?.companyName}
          />
        )}

        {currentStep === 5 && (
          <Step5ContactsEmployment
            formData={formData}
            onChange={onFieldChange}
            isCorporateMode={isCorporateMode}
            corporateCompanyName={dossier?.user?.companyName}
            corporateAddress={undefined}
            corporatePhone={dossier?.user?.phone}
          />
        )}

        {/* Footer Navigation Buttons */}
        <div className="questionnaire-footer-nav">
          {currentStep > 1 ? (
            <button
              type="button"
              className="btn-step-prev"
              onClick={handlePrev}
            >
              ← Previous Step
            </button>
          ) : (
            <div></div>
          )}

          <div className="nav-right-actions">
            <button
              type="submit"
              className="btn-step-next"
            >
              {currentStep === 5 ? 'Save & Finalize Questionnaire' : 'Save & Continue →'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

