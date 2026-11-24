import React, { useState, useEffect } from 'react';
import Step1TripDetails from './Step1TripDetails';
import Step2PersonalData from './Step2PersonalData';
import Step3TravelDocument from './Step3TravelDocument';
import Step4AccommodationExpenses from './Step4AccommodationExpenses';
import Step5ContactsEmployment from './Step5ContactsEmployment';
import { vcmsApi } from '@/modules/admin/api/vcmsApi';
import DynamicVcmsFormRenderer, {
  type VcmsQuestionItem,
} from '../VcmsDynamicForm/DynamicVcmsFormRenderer';
import type { DossierContext } from '../../types/applicant.types';

interface SchengenQuestionnaireProps {
  applicantId?: string;
  formData: Record<string, any>;
  onFieldChange: (field: string, value: any) => void;
  dossier: DossierContext | null;
  onOpenMrzModal: () => void;
  onSaveForm: () => void;
  isCorporateMode?: boolean;
}

export default function SchengenQuestionnaire({
  applicantId,
  formData,
  onFieldChange,
  dossier,
  onOpenMrzModal,
  onSaveForm,
  isCorporateMode,
}: SchengenQuestionnaireProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [vcmsQuestions, setVcmsQuestions] = useState<VcmsQuestionItem[]>([]);
  const [vcmsAnswers, setVcmsAnswers] = useState<Record<string, any>>({});
  const [vcmsMeta, setVcmsMeta] = useState<{ visaTypeName?: string; visaPurposeName?: string }>({});

  const targetAppId = applicantId || (dossier as any)?.applicants?.[0]?.id;

  useEffect(() => {
    if (!dossier?.id || !targetAppId) return;
    vcmsApi
      .getApplicantAnswers(dossier.id, targetAppId)
      .then((res) => {
        const qs = res.data?.schema?.questions || [];
        setVcmsQuestions(qs);
        setVcmsMeta({
          visaTypeName: res.data?.visaType?.nameEn,
          visaPurposeName: res.data?.visaPurpose?.nameEn || res.data?.schema?.purpose?.nameEn,
        });
        const savedMap: Record<string, any> = {};
        for (const ans of res.data?.savedAnswers || []) {
          savedMap[ans.questionCode] =
            Array.isArray(ans.selectedOptionCodesJson) && ans.selectedOptionCodesJson.length > 1
              ? ans.selectedOptionCodesJson
              : ans.valueText ||
                (Array.isArray(ans.selectedOptionCodesJson) ? ans.selectedOptionCodesJson[0] : '') ||
                (ans.valueJson !== null && ans.valueJson !== undefined ? ans.valueJson : '');
        }
        setVcmsAnswers(savedMap);
      })
      .catch(() => {});
  }, [dossier?.id, targetAppId]);

  const handleVcmsAnswerChange = (q: VcmsQuestionItem, val: any) => {
    const nextMap = { ...vcmsAnswers, [q.questionCode]: val };
    setVcmsAnswers(nextMap);
    if (q.schengenPdfFieldKey) {
      onFieldChange(
        q.schengenPdfFieldKey,
        Array.isArray(val) ? val.join(', ') : val
      );
    }
    if (dossier?.id && targetAppId) {
      const isSelect = ['SINGLE_SELECT', 'MULTIPLE_SELECT'].includes(q.answerType);
      const selectedCodes = isSelect
        ? Array.isArray(val)
          ? val.map(String)
          : val
            ? [String(val)]
            : []
        : undefined;
      const strVal = Array.isArray(val) ? val.join(', ') : String(val ?? '');
      vcmsApi
        .saveApplicantAnswers(dossier.id, targetAppId, [
          {
            purposeQuestionConfigId: q.configId,
            questionCode: q.questionCode,
            valueText: strVal,
            valueJson: Array.isArray(val) ? val : undefined,
            selectedOptionCodes: selectedCodes,
          },
        ])
        .catch(() => {});
    }
  };

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

        {/* Dynamic Country & Purpose Configured VCMS Questions for Current Category Step */}
        <DynamicVcmsFormRenderer
          questions={vcmsQuestions}
          answers={vcmsAnswers}
          onAnswerChange={handleVcmsAnswerChange}
          stepFilter={currentStep}
          countryName={dossier?.country?.nameEn}
          visaTypeName={vcmsMeta.visaTypeName}
          visaPurposeName={vcmsMeta.visaPurposeName}
        />

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

