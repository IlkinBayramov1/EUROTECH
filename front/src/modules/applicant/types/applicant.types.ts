export interface ApplicantDoc {
  id: string;
  requiredDocumentType: string;
  fileUrl: string;
  fileName?: string;
  originalFileName?: string;
  fileSize?: number;
  status: 'PENDING' | 'VERIFIED' | 'NEEDS_CORRECTION' | 'REJECTED';
  operatorNotes?: string;
  isMandatory?: boolean;
  createdAt?: string;
}

export interface UnifiedApplicant {
  id: string;
  dossierId: string;
  firstName: string;
  lastName: string;
  passportNumber: string;
  birthDate?: string;
  nationality?: string;
  gender?: string;
  familyRole?: string;
  formDataJson: Record<string, any>;
  documents: ApplicantDoc[];
  services?: any[];
}

export interface DossierContext {
  id: string;
  dossierNumber: string;
  portalType: 'INDIVIDUAL' | 'GROUP_AGENT' | 'CORPORATE';
  status: string;
  currentStep: number;
  country?: {
    id: string;
    code: string;
    nameEn: string;
    nameAz: string;
    flagUrl?: string;
  };
  visaCategory?: {
    id: string;
    code: string;
    nameEn: string;
    nameAz: string;
    requiredDocTypes?: Array<{
      id: string;
      code: string;
      nameAz: string;
      nameEn: string;
      isMandatory: boolean;
      descriptionAz?: string;
      descriptionEn?: string;
    }>;
    dynamicFields?: any[];
  };
  groupBatch?: {
    id: string;
    code: string;
    name: string;
    destination: string;
    travelDate?: string;
    projectReason?: string;
  } | null;
  user?: {
    id: string;
    fullName: string;
    email: string;
    companyName?: string;
    phone?: string;
    role: string;
  };
  appointment?: any;
}

export interface ApplicantSwitcherItem {
  id: string;
  firstName: string;
  lastName: string;
  passportNumber: string;
  familyRole?: string;
  birthDate?: string;
  gender?: string;
  documentsCount: number;
  verifiedDocsCount: number;
  formDataJson?: Record<string, any>;
}

export type ApplicantOrigin = 'client' | 'agent' | 'corporate' | 'guest';

export interface ApplicantPermissions {
  origin: ApplicantOrigin;
  canEdit: boolean;
  canUploadDocs: boolean;
  canGeneratePdf: boolean;
  canSwitchApplicants: boolean;
  canBookAppointment: boolean;
  showFinancials: boolean;
  backUrl: string;
  backLabel: string;
  portalBadgeText: string;
}

export const DEFAULT_SCHENGEN_FORM_DATA: Record<string, any> = {
  // Step 1: Your plans
  purpose: 'Tourism',
  purposeOtherDetails: '',
  purposeDetails: '',
  destination: 'Hungary',
  firstEntry: 'Hungary',
  entriesRequested: 'Single',
  arrivalDate: '',
  departureDate: '',
  durationOfStay: '10',
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
  invitingType: 'hotel',
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

