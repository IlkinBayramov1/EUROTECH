export type AppointmentStatus = 'BOOKED' | 'RESCHEDULED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';

export interface TimeSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  isAvailable?: boolean;
}

export interface Appointment {
  id: string;
  dossierId: string;
  timeSlotId: string;
  status: AppointmentStatus;
  notes?: string;
  timeSlot?: TimeSlot;
  dossier?: {
    dossierCode: string;
    targetCountry: string;
    applicantsCount?: number;
  };
  createdAt: string;
}
