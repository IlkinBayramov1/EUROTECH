export type WizardPortalType = 'INDIVIDUAL' | 'GROUP_AGENT' | 'CORPORATE';

export interface ApplicantRow {
  id: string;
  firstName: string;
  lastName: string;
  passportNumber: string;
  dob?: string;
  gender?: 'MALE' | 'FEMALE';
  nationality?: string;
  issueDate?: string;
  expiryDate?: string;
  familyRole?: 'PRIMARY' | 'SPOUSE' | 'CHILD' | 'DEPENDENT' | 'OTHER';
  jobTitle?: string;
  department?: string;
}

export interface WizardServices {
  activePackage: 'standard' | 'premium' | 'vip' | 'custom' | string;
  filePrep?: boolean;
  insurance?: boolean;
  formAssist?: boolean;
  photo?: boolean;
  lounge?: boolean;
  courier?: boolean;
  hotelFlight?: boolean;
  express?: boolean;
  translation?: boolean;
  sms?: boolean;
  [key: string]: any;
}

export interface DestinationCountry {
  id: string;
  code: string;
  nameEn: string;
  nameAz: string;
  flag: string;
  processingTime: string;
  consularFee: string;
}

export interface WizardFormData {
  // Step 1: Destination & Visa
  country: string;
  countryId: string;
  countryCode: string;
  duration: 'short' | 'long' | '';
  visaCategoryId?: string;
  visaCategoryCode?: string;
  visaTypeId?: string;
  visaTypeName?: string;
  visaPurposeId?: string;
  visaPurposeName?: string;
  consularFeeEur?: number;
  projectReason: string;
  travelDate: string;

  // Step 2: Packages & Services
  services: WizardServices;

  // Step 3: Group/Batch & Applicants
  groupName?: string;
  applicants: ApplicantRow[];

  // Step 4: Appointment
  visaCenter: string;
  appointmentDate: string;
  appointmentTime: string;
  timeSlotId?: string;

  // Step 5: Confirmation
  gdprConsent: boolean;
  paymentMethod: 'WALLET' | 'CARD' | 'INVOICE' | 'BANK_SLIP';
}

