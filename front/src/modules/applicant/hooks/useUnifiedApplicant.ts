import { useState, useEffect, useCallback, useRef } from 'react';
import { dossierService } from '@/shared/api/services/dossier.service';
import { useToast } from '@/shared/context/ToastContext';
import type { UnifiedApplicant, DossierContext, ApplicantSwitcherItem } from '../types/applicant.types';

export const DEFAULT_SCHENGEN_FORM: Record<string, any> = {
  // Step 1: Your plans
  purpose: 'Tourism',
  purposeOtherDetails: '',
  purposeDetails: '',
  destination: '',
  firstEntry: '',
  entriesRequested: 'Single',
  arrivalDate: '',
  departureDate: '',
  durationOfStay: '',
  hasPreviousFingerprints: 'No',
  fingerprintDate: '',
  fingerprintVisaNumber: '',
  hasFinalDestinationPermit: 'No',
  finalDestinationAuthority: '',
  finalDestinationValidFrom: '',
  finalDestinationValidUntil: '',

  // Step 2: Personal Information 
  firstName: '',
  lastName: '',
  birthSurname: '',
  birthDate: '',
  birthPlace: '',
  birthCountry: 'Azerbaijan',
  nationality: 'Azerbaijan',
  nationalityAtBirth: '',
  otherNationalities: '',
  gender: 'Male',
  maritalStatus: 'Single',
  nationalId: '',
  isMinor: 'No',
  guardianSurname: '',
  guardianName: '',
  guardianAddress: '',
  guardianPhone: '',
  guardianEmail: '',
  guardianNationality: 'Azerbaijan',

  // Step 3: Travel Document
  passportType: 'Ordinary passport',
  otherDocTypeDetails: '',
  passportNumber: '',
  issueDate: '',
  passportExpiry: '',
  issuedBy: 'Ministry of Internal Affairs',
  hasOtherResidence: 'No',
  otherResidenceType: '',
  otherResidenceNumber: '',
  otherResidenceValidUntil: '',
  hasEuFamilyMember: 'No',
  euFamilySurname: '',
  euFamilyName: '',
  euFamilyDob: '',
  euFamilyNationality: '',
  euFamilyDocNumber: '',
  euFamilyRelationship: '',

  // Step 4: Your stay & accommodation
  invitingType: 'individual',
  invitingParty: '',
  address: '',
  stayEmail: '',
  stayPhone: '',
  companyName: '',
  companyAddress: '',
  companyContactName: '',
  companyContactAddress: '',
  companyContactEmail: '',
  companyContactPhone: '',
  costCoveredBy: 'By applicant himself',
  meansOfSupport: 'Credit card & Cash',
  meansOfSupportApplicant: ['cash', 'credit_card'],
  meansOfSupportSponsor: ['accommodation', 'all_expenses'],

  // Step 5: Contacts & Employment
  homeAddress: '',
  homeEmail: '',
  homePhone: '',
  currentOccupation: '',
  employerName: '',
  employerAddress: '',
  employerPhone: '',
  hasRepresentative: 'No',
  representativeName: '',
  representativeAddress: '',
  representativeEmail: '',
  representativePhone: '',
};

export function calculateFormProgress(form: Record<string, any>): number {
  if (!form || Object.keys(form).length === 0) return 0;
  let score = 0;
  if (form.purpose && (form.arrivalDate || form.departureDate || form.destination)) score += 20;
  if (form.firstName && form.lastName && (form.birthDate || form.nationality)) score += 20;
  if (form.passportNumber && (form.issueDate || form.passportExpiry || form.issuedBy)) score += 20;
  if ((form.invitingParty || form.companyName || form.address) && form.costCoveredBy) score += 20;
  if (form.homeAddress || form.homeEmail || form.homePhone || form.currentOccupation) score += 20;
  return Math.min(100, score);
}

export function useUnifiedApplicant(dossierId: string, applicantId: string) {
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const [applicant, setApplicant] = useState<UnifiedApplicant | null>(null);
  const [dossier, setDossier] = useState<DossierContext | null>(null);
  const [allApplicants, setAllApplicants] = useState<ApplicantSwitcherItem[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>(DEFAULT_SCHENGEN_FORM);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentApplicantIdRef = useRef(applicantId);
  currentApplicantIdRef.current = applicantId;

  // Load applicant details from real MySQL API
  const loadApplicantDetails = useCallback(async () => {
    if (!dossierId) return;
    setLoading(true);
    try {
      const res: any = await dossierService.getApplicantDetails(dossierId, applicantId);
      const data = res.data?.data || res.data;
      if (data) {
        setApplicant(data.applicant);
        setDossier(data.dossier);
        setAllApplicants(data.allApplicants || []);

        const rawJson = data.applicant?.formDataJson || {};
        const destName = data.dossier?.country?.nameEn || '';

        const dbBirthDate = data.applicant?.birthDate ? String(data.applicant.birthDate).split('T')[0] : '';
        const effectiveBirthDate = dbBirthDate || rawJson.birthDate || rawJson.dob || '';
        const effectiveExpiry = rawJson.passportExpiry || rawJson.passportExpiryDate || rawJson.expiryDate || '';
        const effectivePhone = rawJson.homePhone || rawJson.phone || rawJson.contactPhone || '';

        setFormData({
          ...DEFAULT_SCHENGEN_FORM,
          destination: destName,
          firstEntry: destName,
          firstName: data.applicant?.firstName || '',
          lastName: data.applicant?.lastName || '',
          passportNumber: data.applicant?.passportNumber || '',
          nationality: data.applicant?.nationality === 'AZ' ? 'Azerbaijan' : (data.applicant?.nationality || 'Azerbaijan'),
          gender: data.applicant?.gender === 'FEMALE' ? 'Female' : 'Male',
          ...rawJson,
          birthDate: effectiveBirthDate || rawJson.birthDate || '',
          passportExpiry: effectiveExpiry || rawJson.passportExpiry || '',
          homePhone: effectivePhone || rawJson.homePhone || '',
        });
      }
    } catch (err: any) {
      console.error('Failed to load applicant details:', err);
      showError(err.message || 'Could not load applicant consular data.');
    } finally {
      setLoading(false);
    }
  }, [dossierId, applicantId, showError]);

  useEffect(() => {
    loadApplicantDetails();
  }, [loadApplicantDetails]);

  // Real-time autosave
  const triggerAutoSave = useCallback((updatedForm: Record<string, any>) => {
    if (!dossierId || !applicantId) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await dossierService.updateApplicantForm(dossierId, applicantId, updatedForm);
        setLastSaved(new Date());
      } catch (err: any) {
        console.warn('Applicant form autosave failed:', err);
      } finally {
        setSaving(false);
      }
    }, 600);
  }, [dossierId, applicantId]);

  const updateFormField = useCallback((name: string, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      triggerAutoSave(updated);
      return updated;
    });
  }, [triggerAutoSave]);

  const updateMultipleFields = useCallback((fields: Record<string, any>) => {
    setFormData(prev => {
      const updated = { ...prev, ...fields };
      triggerAutoSave(updated);
      return updated;
    });
  }, [triggerAutoSave]);

  const manualSave = useCallback(async () => {
    if (!dossierId || !applicantId) return;
    setSaving(true);
    try {
      await dossierService.updateApplicantForm(dossierId, applicantId, formData);
      setLastSaved(new Date());
      showSuccess('Consular questionnaire draft saved to database!');
    } catch (err: any) {
      showError(err.message || 'Failed to save application form.');
    } finally {
      setSaving(false);
    }
  }, [dossierId, applicantId, formData, showSuccess, showError]);

  const progress = calculateFormProgress(formData);

  return {
    loading,
    saving,
    lastSaved,
    applicant,
    dossier,
    allApplicants,
    formData,
    progress,
    updateFormField,
    updateMultipleFields,
    manualSave,
    reloadDetails: loadApplicantDetails,
  };
}

