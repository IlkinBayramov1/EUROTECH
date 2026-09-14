export type DossierStatus = 'DRAFT' | 'DOCUMENTS_PENDING' | 'UNDER_REVIEW' | 'APPOINTMENT_BOOKED' | 'APPROVED' | 'REJECTED';

export interface Applicant {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  passportNumber?: string;
  passportExpiry?: string;
  citizenship?: string;
}

export interface Dossier {
  id: string;
  dossierCode: string;
  targetCountry: string;
  visaCategory: string;
  status: DossierStatus;
  travelDate?: string;
  applicants?: Applicant[];
  createdAt: string;
}
