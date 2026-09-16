import React, { useState, useEffect } from 'react';
import { useToast } from '@/shared/context/ToastContext';
import { dossierService, appointmentService, TimeSlot } from '@/shared/api/services';
import './ClientAppointment.css';

export default function ClientAppointment() {
    const { showSuccess, showError } = useToast();
    const [status, setStatus] = useState<'confirmed' | 'cancelled'>('confirmed');
    const [appointment, setAppointment] = useState<any>(null);
    const [applicantName, setApplicantName] = useState('Primary Applicant');
    const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
    const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
    const [selectedSlotId, setSelectedSlotId] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        dossierService.getMyDossiers()
            .then(res => {
                if (res.data?.dossiers && res.data.dossiers.length > 0) {
                    const activeDossier = res.data.dossiers[0];
                    if (activeDossier.appointments && activeDossier.appointments.length > 0) {
                        const appt = activeDossier.appointments[0];
                        setAppointment(appt);
                        if (appt.status === 'CANCELLED') {
                            setStatus('cancelled');
                        } else {
                            setStatus('confirmed');
                        }
                    }
                    if (activeDossier.applicants && activeDossier.applicants.length > 0) {
                        const primary = activeDossier.applicants[0];
                        setApplicantName(`${primary.firstName} ${primary.lastName} (${primary.passportNumber || 'Passport on file'})`);
                    }
                }
            })
            .catch(() => {});
    }, []);

    const handleOpenReschedule = async () => {
        setIsRescheduleOpen(true);
        try {
            const res = await appointmentService.getSlots();
            if (res.data?.slots) {
                setAvailableSlots(res.data.slots);
                if (res.data.slots.length > 0) {
                    setSelectedSlotId(res.data.slots[0].id);
                }
            }
        } catch (err) {
            console.warn('Slot loading error:', err);
        }
    };

    const handleConfirmReschedule = async () => {
        if (!selectedSlotId) return;
        setIsSubmitting(true);
        try {
            if (appointment?.id) {
                const res = await appointmentService.rescheduleAppointment(appointment.id, selectedSlotId);
                setAppointment(res.data?.appointment || appointment);
            }
            showSuccess('Appointment rescheduled successfully!');
            setIsRescheduleOpen(false);
        } catch (err: any) {
            showError(err.message || 'Reschedule failed.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = async () => {
        if (window.confirm("Are you sure you want to cancel your appointment? You will need to book a new one to proceed with your application.")) {
            try {
                if (appointment?.id) {
                    await appointmentService.cancelAppointment(appointment.id);
                }
                setStatus('cancelled');
                showSuccess('Appointment cancelled successfully.');
            } catch (err: any) {
                showError(err.message || 'Cancellation failed.');
            }
        }
    };

    const apptDate = appointment?.timeSlot?.date 
        ? new Date(appointment.timeSlot.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        : 'Thursday, September 10, 2026';

    const apptTime = appointment?.timeSlot?.startTime 
        ? `${appointment.timeSlot.startTime} (Local Time)`
        : '10:30 AM (Local Time)';

    return (
        <div className="appointment-page-content fade-in">
            {/* Səhifə Başlığı */}
            <div className="appt-header">
                <div>
                    <h1 className="docs-title">Appointment Management</h1>
                    <p className="docs-subtitle">View your scheduled biometric data submission and document handover details.</p>
                </div>
            </div>

            <div className="appt-grid">
                {/* Sol Sütun: Cari Görüş Detalları */}
                <div className="appt-column-left">
                    <div className="appt-card main-status-card">
                        <div className="card-header-flex">
                            <h3>Current Appointment</h3>
                            {status === 'confirmed' ? (
                                <span className="appt-badge confirmed">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                    Confirmed
                                </span>
                            ) : (
                                <span className="appt-badge cancelled">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                                    Cancelled
                                </span>
                            )}
                        </div>

                        <div className={`appt-details-box ${status === 'cancelled' ? 'dimmed' : ''}`}>
                            <div className="detail-row">
                                <div className="detail-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                </div>
                                <div className="detail-content">
                                    <span>Date</span>
                                    <h4>{apptDate}</h4>
                                </div>
                            </div>
                            
                            <div className="detail-row">
                                <div className="detail-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                </div>
                                <div className="detail-content">
                                    <span>Time</span>
                                    <h4>{apptTime}</h4>
                                </div>
                            </div>

                            <div className="detail-row">
                                <div className="detail-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                                </div>
                                <div className="detail-content">
                                    <span>Applicant(s)</span>
                                    <h4>{applicantName}</h4>
                                </div>
                            </div>
                        </div>

                        {/* Aksiyalar */}
                        {status === 'confirmed' && (
                            <div className="appt-actions">
                                <button className="btn-outline" onClick={handleOpenReschedule}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-7.27l-3.27-3.27"/></svg>
                                    Reschedule
                                </button>
                                <button className="btn-danger-outline" onClick={handleCancel}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                                    Cancel Appointment
                                </button>
                            </div>
                        )}
                        
                        {status === 'cancelled' && (
                            <div className="appt-alert">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                <span>This appointment has been cancelled. Please book a new one to continue your application.</span>
                                <button className="btn-primary small-btn" style={{marginTop: '12px'}} onClick={handleOpenReschedule}>Book New Appointment</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sağ Sütun: Təlimatlar və Məkan */}
                <div className="appt-column-right">
                    <div className="appt-card preparation-card">
                        <h3>Preparation Checklist</h3>
                        <p className="prep-desc">Please bring the following items to your appointment. Missing documents may result in delays or rejection.</p>
                        
                        <ul className="prep-list">
                            <li>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                <span>Printed and signed <strong>Application Form</strong>.</span>
                            </li>
                            <li>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                <span>Original <strong>Passport</strong> (Valid for 3+ months).</span>
                            </li>
                            <li>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                <span>All original <strong>Supporting Documents</strong> uploaded to the portal.</span>
                            </li>
                            <li>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                <span>Consular fee payment receipt (if paid online) or cash in EUR.</span>
                            </li>
                        </ul>
                    </div>

                    <div className="appt-card location-card">
                        <h3>Location Details</h3>
                        <div className="location-box">
                            <div className="location-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            </div>
                            <div className="location-info">
                                <h4>EuroTech Visa Application Center</h4>
                                <p>15 Nobel Avenue, Azure Business Center, 4th Floor</p>
                                <p>Baku, Azerbaijan, AZ1025</p>
                            </div>
                        </div>
                        <a href="https://maps.google.com" target="_blank" rel="noreferrer" className="map-link">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
                            View on Google Maps
                        </a>
                    </div>
                </div>
            </div>

            {/* Reschedule Modal */}
            {isRescheduleOpen && (
                <div className="modal-backdrop" onClick={() => setIsRescheduleOpen(false)} style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999
                }}>
                    <div className="modal-card" onClick={e => e.stopPropagation()} style={{
                        background: '#131B2E', border: '1px solid #1E293B', borderRadius: '16px',
                        padding: '28px', maxWidth: '460px', width: '90%', color: '#fff'
                    }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Reschedule Appointment</h3>
                        <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '20px' }}>
                            Select a newly available time slot from the embassy schedule.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto', marginBottom: '24px' }}>
                            {availableSlots.map(slot => (
                                <div 
                                    key={slot.id} 
                                    onClick={() => setSelectedSlotId(slot.id)}
                                    style={{
                                        padding: '12px 16px',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        background: selectedSlotId === slot.id ? 'rgba(59, 130, 246, 0.15)' : '#1E293B',
                                        border: selectedSlotId === slot.id ? '1px solid #3B82F6' : '1px solid transparent',
                                        color: selectedSlotId === slot.id ? '#60A5FA' : '#E2E8F0',
                                    }}
                                >
                                    <span>{slot.startTime}</span>
                                    <span style={{ fontSize: '12px', color: '#94A3B8' }}>{slot.location || 'EuroTech Center'}</span>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button className="btn-secondary" onClick={() => setIsRescheduleOpen(false)}>Cancel</button>
                            <button className="btn-primary" onClick={handleConfirmReschedule} disabled={isSubmitting}>
                                {isSubmitting ? 'Updating...' : 'Confirm Reschedule'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}