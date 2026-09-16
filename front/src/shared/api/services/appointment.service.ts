import { apiClient } from '../client';

export interface TimeSlot {
  id: string;
  date: string;
  startTime: string;
  capacity: number;
  bookedCount: number;
  location: string;
  isActive: boolean;
}

export interface BookAppointmentPayload {
  dossierId?: string;
  groupBatchId?: string;
  timeSlotId: string;
  notes?: string;
}

export const appointmentService = {
  getSlots: (date?: string, location?: string) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (location) params.append('location', location);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get(`/appointments/slots${queryString}`);
  },

  bookAppointment: (payload: BookAppointmentPayload) =>
    apiClient.post('/appointments/book', payload),

  rescheduleAppointment: (appointmentId: string, newTimeSlotId: string) =>
    apiClient.patch(`/appointments/${appointmentId}/reschedule`, { newTimeSlotId }),

  cancelAppointment: (appointmentId: string) =>
    apiClient.delete(`/appointments/${appointmentId}/cancel`),

  getManifestPdfUrl: (appointmentId: string) =>
    apiClient.get(`/appointments/${appointmentId}/manifest-pdf`),

  generateManifestPdf: (payload?: { appointmentId?: string; groupBatchId?: string; groupInfo?: any }) =>
    apiClient.post('/appointments/manifest-pdf', payload || {}),
};
