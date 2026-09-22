import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/shared/context/ToastContext';
import { dossierService, appointmentService, TimeSlot } from '@/shared/api/services';
import './ClientAppointment.css';

export default function ClientAppointment() {
    const { showSuccess, showError } = useToast();
    const [status, setStatus] = useState<'loading' | 'not_scheduled' | 'confirmed' | 'rescheduled' | 'cancelled'>('loading');
    const [appointment, setAppointment] = useState<any>(null);
    const [dossier, setDossier] = useState<any>(null);
    const [applicantNames, setApplicantNames] = useState<string>('Primary Applicant');

    // Modals
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
    const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
    const [selectedSlotId, setSelectedSlotId] = useState<string>('');
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    // Load active dossier and appointments from database
    const loadAppointmentData = useCallback(async () => {
        try {
            const res = await dossierService.getMyDossiers();
            const dossiers = res.data?.dossiers || [];
            if (dossiers.length > 0) {
                const active = dossiers[0];
                setDossier(active);

                // Extract all applicants for display
                if (active.applicants && active.applicants.length > 0) {
                    const names = active.applicants.map((a: any) => 
                        `${a.firstName} ${a.lastName}${a.passportNumber ? ` (${a.passportNumber})` : ''}`
                    ).join(', ');
                    setApplicantNames(names);
                } else {
                    setApplicantNames(active.user?.fullName || 'Primary Applicant');
                }

                // Check real appointments from DB
                if (active.appointments && active.appointments.length > 0) {
                    const appt = active.appointments[0];
                    setAppointment(appt);
                    if (appt.status === 'CANCELLED') {
                        setStatus('cancelled');
                    } else if (appt.status === 'RESCHEDULED') {
                        setStatus('rescheduled');
                    } else {
                        setStatus('confirmed');
                    }
                } else {
                    setAppointment(null);
                    setStatus('not_scheduled');
                }
            } else {
                setDossier(null);
                setAppointment(null);
                setStatus('not_scheduled');
            }
        } catch (err) {
            console.error('Failed to load appointments:', err);
            setStatus('not_scheduled');
        }
    }, []);

    useEffect(() => {
        loadAppointmentData();
    }, [loadAppointmentData]);

    // Fetch slots for booking/rescheduling
    const fetchAvailableSlots = async () => {
        setLoadingSlots(true);
        try {
            const res = await appointmentService.getSlots();
            if (res.data?.slots) {
                const now = new Date();
                // Filter only future or active slots with remaining capacity or active
                const validSlots = res.data.slots.filter((s: any) => {
                    if (!s.isActive) return false;
                    const d = new Date(s.date);
                    const match = (s.startTime || '').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
                    if (match) {
                        let h = parseInt(match[1], 10);
                        const m = parseInt(match[2], 10);
                        const ampm = (match[3] || '').toUpperCase();
                        if (ampm === 'PM' && h < 12) h += 12;
                        if (ampm === 'AM' && h === 12) h = 0;
                        d.setHours(h, m, 0, 0);
                    }
                    return d > now;
                });

                setAvailableSlots(validSlots);
                const firstAvailable = validSlots.find((s: any) => (s.capacity - s.bookedCount) > 0);
                if (firstAvailable) {
                    setSelectedSlotId(firstAvailable.id);
                } else if (validSlots.length > 0) {
                    setSelectedSlotId(validSlots[0].id);
                }
            }
        } catch (err) {
            console.error('Slot loading error:', err);
            showError('Could not load appointment slots.');
        } finally {
            setLoadingSlots(false);
        }
    };

    // Open booking modal (when not scheduled or re-booking after cancel)
    const handleOpenBooking = async () => {
        setIsBookingModalOpen(true);
        await fetchAvailableSlots();
    };

    // Open reschedule modal
    const handleOpenReschedule = async () => {
        setIsRescheduleModalOpen(true);
        await fetchAvailableSlots();
    };

    // Confirm new booking
    const handleConfirmBooking = async () => {
        if (!selectedSlotId) {
            showError('Please select an appointment time slot.');
            return;
        }
        if (!dossier?.id) {
            showError('No active dossier found. Please start an application first.');
            return;
        }
        setIsSubmitting(true);
        try {
            await appointmentService.bookAppointment({
                dossierId: dossier.id,
                timeSlotId: selectedSlotId,
            });
            showSuccess('Biometric appointment booked and confirmed successfully!');
            setIsBookingModalOpen(false);
            await loadAppointmentData();
        } catch (err: any) {
            showError(err.message || 'Failed to book appointment.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Confirm reschedule
    const handleConfirmReschedule = async () => {
        if (!selectedSlotId || !appointment?.id) {
            showError('Please select a new appointment slot.');
            return;
        }
        setIsSubmitting(true);
        try {
            await appointmentService.rescheduleAppointment(appointment.id, selectedSlotId);
            showSuccess('Appointment rescheduled successfully!');
            setIsRescheduleModalOpen(false);
            await loadAppointmentData();
        } catch (err: any) {
            showError(err.message || 'Failed to reschedule appointment.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Cancel appointment
    const handleCancel = async () => {
        if (!appointment?.id) return;
        if (window.confirm('Are you sure you want to cancel your scheduled biometric appointment? You can book a new slot at any time.')) {
            try {
                await appointmentService.cancelAppointment(appointment.id);
                showSuccess('Appointment cancelled successfully.');
                await loadAppointmentData();
            } catch (err: any) {
                showError(err.message || 'Cancellation failed.');
            }
        }
    };

    // Download confirmation letter PDF
    const handleDownloadConfirmationLetter = async () => {
        if (!appointment?.id) {
            showError('No confirmed appointment found to download letter.');
            return;
        }
        setIsDownloading(true);
        try {
            const res = await appointmentService.generateConfirmationPdf({
                appointmentId: appointment.id,
            });
            const fileUrl = res.data?.fileUrl || (res.data?.fileName ? `/uploads/${res.data.fileName}` : null);
            if (fileUrl) {
                const fullUrl = fileUrl.startsWith('http') ? fileUrl : `http://localhost:5000${fileUrl}`;
                const fileRes = await fetch(fullUrl);
                if (!fileRes.ok) throw new Error(`Download failed with status ${fileRes.status}`);
                const blob = await fileRes.blob();
                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = res.data?.fileName || `appointment_confirmation_${appointment.id.slice(0, 8)}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
                showSuccess('Official Appointment Confirmation Letter (PDF) downloaded!');
            }
        } catch (err: any) {
            console.error('Download error:', err);
            showError(err.message || 'Failed to generate confirmation PDF.');
        } finally {
            setIsDownloading(false);
        }
    };

    // Group available slots by date for modal display
    const groupedSlots = useMemo(() => {
        const groups: Record<string, TimeSlot[]> = {};
        const now = new Date();

        availableSlots.forEach(slot => {
            if (!slot.isActive) return;
            const slotDate = new Date(slot.date);
            const match = (slot.startTime || '').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
            if (match) {
                let h = parseInt(match[1], 10);
                const m = parseInt(match[2], 10);
                const ampm = (match[3] || '').toUpperCase();
                if (ampm === 'PM' && h < 12) h += 12;
                if (ampm === 'AM' && h === 12) h = 0;
                slotDate.setHours(h, m, 0, 0);
            }
            if (slotDate <= now) return;

            const d = new Date(slot.date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
            if (!groups[d]) groups[d] = [];
            groups[d].push(slot);
        });
        return groups;
    }, [availableSlots]);

    const formattedDate = appointment?.timeSlot?.date 
        ? new Date(appointment.timeSlot.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        : '—';

    const formattedTime = appointment?.timeSlot?.startTime 
        ? `${appointment.timeSlot.startTime} (Local Time)`
        : '—';

    const venueLocation = appointment?.timeSlot?.location || appointment?.location || 'EuroTech Visa Application Center';

    return (
        <div className="appointment-page-content fade-in">
            {/* Səhifə Başlığı */}
            <div className="appt-header">
                <div>
                    <h1 className="docs-title">Appointment Management</h1>
                    <p className="docs-subtitle">View your scheduled biometric data submission and document handover details.</p>
                </div>
                {(status === 'confirmed' || status === 'rescheduled') && (
                    <button 
                        className="btn-secondary" 
                        onClick={handleDownloadConfirmationLetter} 
                        disabled={isDownloading}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        {isDownloading ? 'Generating...' : 'Download Confirmation (PDF)'}
                    </button>
                )}
            </div>

            <div className="appt-grid">
                {/* Sol Sütun: Cari Görüş Kartı */}
                <div className="appt-column-left">
                    <div className="appt-card main-status-card">
                        <div className="card-header-flex">
                            <h3>Current Appointment</h3>
                            {status === 'confirmed' && (
                                <span className="appt-badge confirmed">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                    Confirmed
                                </span>
                            )}
                            {status === 'rescheduled' && (
                                <span className="appt-badge rescheduled">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-7.27l-3.27-3.27"/></svg>
                                    Rescheduled
                                </span>
                            )}
                            {status === 'cancelled' && (
                                <span className="appt-badge cancelled">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                                    Cancelled
                                </span>
                            )}
                            {status === 'not_scheduled' && (
                                <span className="appt-badge not-scheduled">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                                    Not Scheduled
                                </span>
                            )}
                        </div>

                        {/* VƏZİYYƏT 1: Görüş Təyin Edilməyib (Empty State) */}
                        {status === 'not_scheduled' && (
                            <div className="not-scheduled-box">
                                <div className="not-scheduled-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                </div>
                                <h4>No Biometric Appointment Scheduled</h4>
                                <p>
                                    To submit your Schengen visa application, you must schedule an in-person biometric appointment (fingerprinting and document handover) at an authorized EuroTech Consular Center.
                                </p>
                                <button className="btn-primary" onClick={handleOpenBooking} style={{ marginTop: '8px' }}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                    Schedule Biometric Appointment
                                </button>
                            </div>
                        )}

                        {/* VƏZİYYƏT 2: Görüş Təsdiqlənib / Rescheduled */}
                        {(status === 'confirmed' || status === 'rescheduled') && (
                            <>
                                <div className="appt-details-box">
                                    <div className="detail-row">
                                        <div className="detail-icon">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                        </div>
                                        <div className="detail-content">
                                            <span>Date</span>
                                            <h4>{formattedDate}</h4>
                                        </div>
                                    </div>
                                    
                                    <div className="detail-row">
                                        <div className="detail-icon">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                        </div>
                                        <div className="detail-content">
                                            <span>Time</span>
                                            <h4>{formattedTime}</h4>
                                        </div>
                                    </div>

                                    <div className="detail-row">
                                        <div className="detail-icon">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                                        </div>
                                        <div className="detail-content">
                                            <span>Applicant(s)</span>
                                            <h4>{applicantNames}</h4>
                                        </div>
                                    </div>
                                </div>

                                <div className="appt-actions">
                                    <button className="btn-secondary" onClick={handleDownloadConfirmationLetter} disabled={isDownloading}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                        Confirmation Letter (PDF)
                                    </button>
                                    <button className="btn-outline" onClick={handleOpenReschedule}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-7.27l-3.27-3.27"/></svg>
                                        Reschedule
                                    </button>
                                    <button className="btn-danger-outline" onClick={handleCancel}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                                        Cancel
                                    </button>
                                </div>
                            </>
                        )}

                        {/* VƏZİYYƏT 3: Görüş Ləğv Edilib */}
                        {status === 'cancelled' && (
                            <div className="appt-alert">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                <span>This appointment has been cancelled. Please book a new biometric slot to continue your application.</span>
                                <button className="btn-primary small-btn" style={{ marginTop: '12px' }} onClick={handleOpenBooking}>
                                    Book New Appointment
                                </button>
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
                                <h4>{venueLocation}</h4>
                                <p>{venueLocation.includes('Premium') ? 'Port Baku Towers, 7th Floor, Neftchilar Ave 153' : '15 Nobel Avenue, Azure Business Center, 4th Floor'}</p>
                                <p>Baku, Azerbaijan, AZ1025</p>
                            </div>
                        </div>
                        <a href="https://maps.google.com/?q=EuroTech+Visa+Application+Center+Baku" target="_blank" rel="noreferrer" className="map-link">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
                            View on Google Maps
                        </a>
                    </div>
                </div>
            </div>

            {/* Modal: Görüş Təyin Et (Booking Modal) */}
            {isBookingModalOpen && (
                <div className="modal-backdrop" onClick={() => setIsBookingModalOpen(false)} style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999
                }}>
                    <div className="modal-card" onClick={e => e.stopPropagation()} style={{
                        background: '#131B2E', border: '1px solid #1E293B', borderRadius: '16px',
                        padding: '28px', maxWidth: '520px', width: '92%', color: '#fff', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
                    }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>Schedule Biometric Appointment</h3>
                        <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '18px' }}>
                            Select your preferred date and time slot for consular biometrics and passport validation.
                        </p>

                        {loadingSlots ? (
                            <div style={{ textAlign: 'center', padding: '30px', color: '#94A3B8' }}>Loading available slots...</div>
                        ) : Object.keys(groupedSlots).length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '30px', color: '#EF4444' }}>No available appointment slots found.</div>
                        ) : (
                            <div className="slot-picker-container">
                                {Object.entries(groupedSlots).map(([dateStr, slots]) => (
                                    <div key={dateStr} className="slot-date-group">
                                        <span className="slot-date-title">{dateStr}</span>
                                        <div className="slot-pills-grid">
                                            {slots.map(slot => {
                                                const rem = slot.capacity - slot.bookedCount;
                                                const isFull = rem <= 0;
                                                const isSelected = selectedSlotId === slot.id;
                                                return (
                                                    <div 
                                                        key={slot.id}
                                                        className={`slot-pill ${isSelected ? 'selected' : ''} ${isFull ? 'disabled' : ''}`}
                                                        onClick={() => !isFull && setSelectedSlotId(slot.id)}
                                                    >
                                                        <span>{slot.startTime}</span>
                                                        <span className="slot-pill-capacity">
                                                            {isFull ? 'Fully Booked' : `${rem} places`}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid #1E293B' }}>
                            <button className="btn-secondary" onClick={() => setIsBookingModalOpen(false)}>Cancel</button>
                            <button 
                                className="btn-primary" 
                                onClick={handleConfirmBooking} 
                                disabled={isSubmitting || !selectedSlotId}
                            >
                                {isSubmitting ? 'Booking...' : 'Confirm Booking'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Vaxtı Dəyiş (Reschedule Modal) */}
            {isRescheduleModalOpen && (
                <div className="modal-backdrop" onClick={() => setIsRescheduleModalOpen(false)} style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999
                }}>
                    <div className="modal-card" onClick={e => e.stopPropagation()} style={{
                        background: '#131B2E', border: '1px solid #1E293B', borderRadius: '16px',
                        padding: '28px', maxWidth: '520px', width: '92%', color: '#fff', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
                    }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>Reschedule Biometric Appointment</h3>
                        <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '18px' }}>
                            Choose a newly available time slot. Your current appointment reservation will be updated automatically.
                        </p>

                        {loadingSlots ? (
                            <div style={{ textAlign: 'center', padding: '30px', color: '#94A3B8' }}>Loading available slots...</div>
                        ) : Object.keys(groupedSlots).length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '30px', color: '#EF4444' }}>No alternative appointment slots found.</div>
                        ) : (
                            <div className="slot-picker-container">
                                {Object.entries(groupedSlots).map(([dateStr, slots]) => (
                                    <div key={dateStr} className="slot-date-group">
                                        <span className="slot-date-title">{dateStr}</span>
                                        <div className="slot-pills-grid">
                                            {slots.map(slot => {
                                                const rem = slot.capacity - slot.bookedCount;
                                                const isFull = rem <= 0 && slot.id !== appointment?.timeSlotId;
                                                const isSelected = selectedSlotId === slot.id;
                                                return (
                                                    <div 
                                                        key={slot.id}
                                                        className={`slot-pill ${isSelected ? 'selected' : ''} ${isFull ? 'disabled' : ''}`}
                                                        onClick={() => !isFull && setSelectedSlotId(slot.id)}
                                                    >
                                                        <span>{slot.startTime}</span>
                                                        <span className="slot-pill-capacity">
                                                            {isFull ? 'Fully Booked' : `${rem} places`}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid #1E293B' }}>
                            <button className="btn-secondary" onClick={() => setIsRescheduleModalOpen(false)}>Cancel</button>
                            <button 
                                className="btn-primary" 
                                onClick={handleConfirmReschedule} 
                                disabled={isSubmitting || !selectedSlotId}
                            >
                                {isSubmitting ? 'Updating...' : 'Confirm Reschedule'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}