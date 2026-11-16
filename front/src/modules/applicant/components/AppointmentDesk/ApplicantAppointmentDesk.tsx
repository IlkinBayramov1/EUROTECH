import React, { useState, useEffect } from 'react';
import { appointmentService } from '@/shared/api/services/appointment.service';
import { useToast } from '@/shared/context/ToastContext';
import type { DossierContext } from '../../types/applicant.types';

interface AppointmentDeskProps {
  dossier: DossierContext;
  onReload: () => void;
}

export default function ApplicantAppointmentDesk({
  dossier,
  onReload,
}: AppointmentDeskProps) {
  const { showSuccess, showError } = useToast();
  const [selectedCenter, setSelectedCenter] = useState('EuroTech Main Center');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(false);

  const existingAppt = dossier.appointment;

  useEffect(() => {
    if (!selectedDate) return;
    setLoading(true);
    appointmentService
      .getSlots(selectedDate, selectedCenter)
      .then((res: any) => {
        const available = res.data?.slots || [];
        setSlots(available);
        if (available.length > 0) {
          setSelectedSlotId(available[0].id);
        }
      })
      .catch((err) => {
        console.warn('Slot load error:', err);
      })
      .finally(() => setLoading(false));
  }, [selectedDate, selectedCenter]);

  const handleBookSlot = async () => {
    if (!selectedSlotId) {
      showError('Please select a time slot.');
      return;
    }
    setBooking(true);
    try {
      await appointmentService.bookAppointment({
        dossierId: dossier.id,
        timeSlotId: selectedSlotId,
      });
      showSuccess('Biometric appointment booked successfully in database!');
      onReload();
    } catch (err: any) {
      showError(err.message || 'Failed to book appointment slot.');
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="applicant-appointment-desk-card">
      <div className="appt-desk-header">
        <div>
          <h3>Consular Biometric Appointment Management</h3>
          <p>Schedule or view your in-person biometric enrollment and document submission appointment.</p>
        </div>
      </div>

      {existingAppt ? (
        <div className="existing-appointment-card">
          <div className="appt-badge-confirmed">APPOINTMENT CONFIRMED</div>
          <div className="appt-details-grid">
            <div className="appt-data-block">
              <span className="lbl">Date & Time</span>
              <strong>
                {existingAppt.timeSlot?.date ? new Date(existingAppt.timeSlot.date).toLocaleDateString() : 'Scheduled'} at {existingAppt.timeSlot?.startTime || '10:00 AM'}
              </strong>
            </div>
            <div className="appt-data-block">
              <span className="lbl">Consular Center</span>
              <strong>{existingAppt.timeSlot?.location || existingAppt.appointmentLocation || 'EuroTech Main Center'}</strong>
            </div>
            <div className="appt-data-block">
              <span className="lbl">Status</span>
              <strong>{existingAppt.status || 'CONFIRMED'}</strong>
            </div>
          </div>
        </div>
      ) : (
        <div className="book-appointment-workflow">
          <div className="center-selection-grid">
            {[
              { id: 'EuroTech Main Center', title: 'EuroTech Main Center', sub: 'Port Baku Towers, 7th Floor' },
              { id: 'EuroTech Premium Lounge', title: 'EuroTech Premium Lounge', sub: 'VIP Dedicated Desk, Refreshments' },
              { id: 'Ganja Regional Center', title: 'Ganja Regional Center', sub: 'Heydar Aliyev Avenue 44' },
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                className={`center-select-card ${selectedCenter === c.id ? 'active' : ''}`}
                onClick={() => setSelectedCenter(c.id)}
              >
                <strong>{c.title}</strong>
                <span>{c.sub}</span>
              </button>
            ))}
          </div>

          <div className="date-slots-row">
            <div className="date-picker-box">
              <label>Select Preferred Date:</label>
              <input
                type="date"
                className="applicant-input"
                value={selectedDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            <div className="slots-picker-box">
              <label>Available Time Slots:</label>
              {loading ? (
                <div className="slots-loading">Loading slots...</div>
              ) : slots.length === 0 ? (
                <div className="slots-empty">No slots available on this date. Try another date.</div>
              ) : (
                <div className="slots-pills-row">
                  {slots.map((sl) => (
                    <button
                      key={sl.id}
                      type="button"
                      className={`slot-pill ${selectedSlotId === sl.id ? 'active' : ''}`}
                      onClick={() => setSelectedSlotId(sl.id)}
                    >
                      {sl.startTime} ({sl.capacity - (sl.bookedCount || 0)} left)
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            className="btn-confirm-booking"
            onClick={handleBookSlot}
            disabled={booking || !selectedSlotId}
          >
            {booking ? 'Confirming...' : 'Confirm Biometric Appointment'}
          </button>
        </div>
      )}
    </div>
  );
}

