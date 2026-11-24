import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { corporateService } from '@/shared/api/services/corporate.service';
import { appointmentService } from '@/shared/api/services/appointment.service';
import { vcmsApi } from '@/modules/admin/api/vcmsApi';
import { useToast } from '@/shared/context/ToastContext';
import { getFileUrl } from '@/shared/utils/file.util';
import './CorporateAppointments.css';

interface AppointmentRecord {
    id: string;
    appointmentId?: string;
    bookingCode?: string | null;
    timeSlotId?: string | null;
    countryId?: string | null;
    visaTypeId?: string | null;
    visaPurposeId?: string | null;
    time: string;
    batchId: string;
    batchDbId?: string;
    batchName: string;
    destination: string;
    size: number;
    status: 'Confirmed' | 'Pending Payment' | 'Rescheduled';
    location: string;
}

export default function CorporateAppointments() {
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast();

    // Calendar States
    const [currentViewDate, setCurrentViewDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<number>(new Date().getDate());
    const [loading, setLoading] = useState<boolean>(true);
    const [apptNotifications, setApptNotifications] = useState<any[]>([]);

    // Reschedule Modal States
    const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentRecord | null>(null);
    const [availableSlots, setAvailableSlots] = useState<any[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [selectedNewSlotId, setSelectedNewSlotId] = useState<string>('');
    const [isSubmittingReschedule, setIsSubmittingReschedule] = useState(false);

    // Dynamic Appointments State (100% Real Database)
    const [appointmentsByDate, setAppointmentsByDate] = useState<Record<number, AppointmentRecord[]>>({});

    useEffect(() => {
        vcmsApi
            .getMyAppointmentNotifications()
            .then((res) => setApptNotifications(res.data?.notifications || []))
            .catch(() => {});
    }, []);

    const loadCorporateAppointments = useCallback(async () => {
        setLoading(true);
        try {
            const res = await corporateService.getBatches();
            const updated: Record<number, AppointmentRecord[]> = {};

            if (res.data?.batches && Array.isArray(res.data.batches)) {
                res.data.batches.forEach((b: any) => {
                    const realAppt = Array.isArray(b.appointments) && b.appointments.length > 0
                        ? b.appointments.find((a: any) => a.status !== 'CANCELLED') || b.appointments[0]
                        : null;
                    const primaryDossier = b.dossiers?.[0] || null;
                    const targetDateStr =
                        realAppt?.timeSlot?.date ||
                        primaryDossier?.appointmentDate ||
                        b.appointmentDate ||
                        b.travelDate ||
                        b.createdAt;

                    if (targetDateStr) {
                        const d = new Date(targetDateStr);
                        if (d.getMonth() === currentViewDate.getMonth() && d.getFullYear() === currentViewDate.getFullYear()) {
                            const day = d.getDate();
                            if (!updated[day]) updated[day] = [];

                            const isRescheduled = realAppt?.status === 'RESCHEDULED';
                            const isConfirmed =
                                isRescheduled ||
                                realAppt?.status === 'CONFIRMED' ||
                                b.status === 'PROCESSING' ||
                                b.status === 'READY' ||
                                b.status === 'COMPLETED';

                            const providerObj = realAppt?.timeSlot?.provider || null;
                            const providerName =
                                providerObj?.name ||
                                providerObj?.visaApplicationCentre?.providerName ||
                                providerObj?.embassy?.authorityName ||
                                null;

                            updated[day].push({
                                id: realAppt?.bookingCode || `APT-${b.code || b.id.slice(0, 6)}`,
                                appointmentId: realAppt?.id || undefined,
                                bookingCode: realAppt?.bookingCode || null,
                                timeSlotId: realAppt?.timeSlotId || null,
                                countryId: primaryDossier?.countryId || realAppt?.timeSlot?.countryId || null,
                                visaTypeId: primaryDossier?.visaTypeId || realAppt?.timeSlot?.visaTypeId || null,
                                visaPurposeId: primaryDossier?.visaPurposeId || realAppt?.timeSlot?.visaPurposeId || null,
                                time: realAppt?.timeSlot?.startTime || b.appointmentTime || '10:00 AM',
                                batchId: b.code || b.id,
                                batchDbId: b.id,
                                batchName: b.name || 'Corporate Delegation',
                                destination: b.destination || primaryDossier?.country?.nameEn || 'Europe / Schengen',
                                size: b.totalEmployees || b.employees?.length || realAppt?.groupSize || 1,
                                status: isRescheduled ? 'Rescheduled' : isConfirmed ? 'Confirmed' : 'Pending Payment',
                                location:
                                    realAppt?.location ||
                                    realAppt?.timeSlot?.location ||
                                    providerName ||
                                    primaryDossier?.appointmentLocation ||
                                    'EuroTech Premium Biometrics Center',
                            });
                        }
                    }
                });
            }
            setAppointmentsByDate(updated);
        } catch (err) {
            console.warn('Failed to load batches for appointments:', err);
            setAppointmentsByDate({});
        } finally {
            setLoading(false);
        }
    }, [currentViewDate]);

    useEffect(() => {
        loadCorporateAppointments();
    }, [loadCorporateAppointments]);

    const handleOpenRescheduleModal = async (appt: AppointmentRecord) => {
        setRescheduleTarget(appt);
        setSelectedNewSlotId('');
        setLoadingSlots(true);
        try {
            let slotsList: any[] = [];
            try {
                const vcmsRes = await vcmsApi.getCustomerPublishedSlots({
                    countryId: appt.countryId || undefined,
                    visaTypeId: appt.visaTypeId || undefined,
                    visaPurposeId: appt.visaPurposeId || undefined,
                    groupSize: Math.max(1, appt.size || 1),
                });
                if (Array.isArray(vcmsRes.data?.slots) && vcmsRes.data.slots.length > 0) {
                    slotsList = vcmsRes.data.slots;
                }
            } catch {
                // fallback below
            }
            if (slotsList.length === 0) {
                const res: any = await appointmentService.getSlots(undefined, undefined, {
                    countryId: appt.countryId,
                    visaTypeId: appt.visaTypeId,
                    groupSize: Math.max(1, appt.size || 1),
                } as any);
                slotsList = res?.data?.slots || [];
            }
            const filtered = slotsList.filter(
                (s: any) =>
                    s.id !== appt.timeSlotId &&
                    (s.capacity - (s.bookedCount || 0)) >= Math.max(1, appt.size || 1) &&
                    !['DRAFT', 'BLOCKED', 'CLOSED'].includes(s.slotStatus)
            );
            setAvailableSlots(filtered);
            if (filtered[0]) setSelectedNewSlotId(filtered[0].id);
        } catch {
            showError('Could not load available appointment slots.');
        } finally {
            setLoadingSlots(false);
        }
    };

    const handleConfirmCorporateReschedule = async () => {
        if (!rescheduleTarget?.appointmentId || !selectedNewSlotId) return;
        setIsSubmittingReschedule(true);
        try {
            await appointmentService.rescheduleAppointment(rescheduleTarget.appointmentId, selectedNewSlotId);
            showSuccess(`Corporate batch appointment (${rescheduleTarget.id}) rescheduled!`);
            setRescheduleTarget(null);
            await loadCorporateAppointments();
        } catch (err: any) {
            showError(err.message || 'Failed to reschedule corporate appointment.');
        } finally {
            setIsSubmittingReschedule(false);
        }
    };

    // Calendar Calculations
    const handlePrevMonth = () => setCurrentViewDate(new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() - 1, 1));
    const handleNextMonth = () => setCurrentViewDate(new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1, 1));

    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const startingDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; 
    
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const handleDownloadManifest = async (batchId: string, batchName: string) => {
        try {
            showSuccess(`Generating official Appointment Manifest (PDF) for ${batchName}...`);
            const res: any = await appointmentService.generateManifestPdf({ groupBatchId: batchId });
            
            const payload = res?.data?.data || res?.data || res;
            const downloadUrl = payload?.downloadUrl || payload?.fileUrl || payload?.pdfUrl || res?.downloadUrl || res?.fileUrl || res?.pdfUrl;
            const fileName = payload?.fileName || res?.fileName || `manifest_${batchId}.pdf`;

            if (downloadUrl) {
                const fullUrl = getFileUrl(downloadUrl);
                try {
                    const fileRes = await fetch(fullUrl);
                    if (!fileRes.ok) throw new Error(`Download status ${fileRes.status}`);
                    const blob = await fileRes.blob();
                    const blobUrl = window.URL.createObjectURL(blob);

                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
                } catch {
                    const link = document.createElement('a');
                    link.href = fullUrl;
                    link.target = '_blank';
                    link.download = fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }

                showSuccess('Biometric Appointment Manifest (PDF) downloaded successfully.');
            } else {
                showError('Could not obtain Manifest PDF URL.');
            }
        } catch (err: any) {
            console.error('Manifest download error:', err);
            showError(err.message || 'Failed to generate appointment manifest');
        }
    };

    const currentAppointments = appointmentsByDate[selectedDate] || [];

    return (
        <div className="corp-appt-content fade-in">
            {/* --- Header --- */}
            <div className="corp-appt-header">
                <div className="header-titles">
                    <h1 className="dash-title">Appointments Schedule</h1>
                    <p className="dash-subtitle">Track biometric appointments for your employee batches. Note: Slots are unconfirmed until corporate payment is settled.</p>
                </div>
            </div>

            {apptNotifications.filter((n) => !n.readAt).length > 0 && (
                <div style={{ marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {apptNotifications
                        .filter((n) => !n.readAt)
                        .map((notif) => (
                            <div
                                key={notif.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 14,
                                    padding: '13px 16px',
                                    borderRadius: 12,
                                    background: notif.type === 'SLOT_RESCHEDULED' ? '#fef3c7' : '#eff6ff',
                                    border: `1px solid ${notif.type === 'SLOT_RESCHEDULED' ? '#fcd34d' : '#bfdbfe'}`,
                                    color: '#0f172a',
                                    fontSize: '0.86rem',
                                }}
                            >
                                <div>
                                    <strong>{notif.title}:</strong> {notif.message}
                                </div>
                                <button
                                    type="button"
                                    className="btn-outline-secondary"
                                    style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                                    onClick={async () => {
                                        await vcmsApi.markAppointmentNotificationRead(notif.id);
                                        setApptNotifications((prev) =>
                                            prev.map((item) =>
                                                item.id === notif.id ? { ...item, readAt: new Date().toISOString() } : item
                                            )
                                        );
                                    }}
                                >
                                    Dismiss
                                </button>
                            </div>
                        ))}
                </div>
            )}

            <div className="corp-appt-grid">
                {/* --- LEFT: CALENDAR --- */}
                <div className="corp-appt-column-left">
                    <div className="corp-calendar-card sticky-card">
                        <div className="calendar-header-nav">
                            <button className="btn-cal-nav" onClick={handlePrevMonth}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                            </button>
                            <div className="calendar-current-month">
                                {monthNames[month]} {year}
                            </div>
                            <button className="btn-cal-nav" onClick={handleNextMonth}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                            </button>
                        </div>
                        
                        <div className="calendar-weekdays">
                            <span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span>
                        </div>

                        <div className="calendar-days-grid">
                            {Array.from({ length: startingDay }).map((_, index) => (
                                <div key={`empty-${index}`} className="calendar-day empty"></div>
                            ))}
                            
                            {Array.from({ length: daysInMonth }).map((_, index) => {
                                const day = index + 1;
                                const currentDate = new Date(year, month, day);
                                const isPast = currentDate < today;
                                const isSelected = day === selectedDate && month === today.getMonth();

                                const dailyApps = appointmentsByDate[day];
                                const hasConfirmed = dailyApps?.some(a => a.status === 'Confirmed');
                                const hasPending = dailyApps?.some(a => a.status === 'Pending Payment');

                                return (
                                    <button 
                                        key={day}
                                        className={`calendar-day ${isSelected ? 'selected' : ''} ${isPast ? 'disabled' : ''}`}
                                        disabled={isPast && !dailyApps}
                                        onClick={() => setSelectedDate(day)}
                                    >
                                        {day}
                                        <div className="day-dots-container">
                                            {hasConfirmed && <span className="day-dot confirmed"></span>}
                                            {hasPending && <span className="day-dot pending"></span>}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="calendar-legend-premium">
                            <div className="legend-item"><div className="legend-color confirmed"></div><span>Confirmed</span></div>
                            <div className="legend-item"><div className="legend-color pending"></div><span>Pending Payment</span></div>
                        </div>
                    </div>
                </div>

                {/* --- RIGHT: DAILY SCHEDULE --- */}
                <div className="corp-appt-column-right">
                    <div className="corp-schedule-card">
                        <div className="schedule-header">
                            <div className="selected-date-display">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                <h3>{monthNames[month]} {selectedDate}, {year}</h3>
                            </div>
                        </div>

                        <div className="corp-appt-list">
                            {loading ? (
                                <div className="empty-state-box">
                                    <p>Loading biometric appointments from database...</p>
                                </div>
                            ) : currentAppointments.length > 0 ? (
                                currentAppointments.map(appt => (
                                    <div key={appt.id} className={`corp-appt-item ${appt.status === 'Confirmed' ? 'confirmed' : 'pending'}`}>
                                        
                                        {/* Time & Location */}
                                        <div className="appt-time-block">
                                            <div className="appt-time">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                <strong>{appt.time}</strong>
                                            </div>
                                            <div className="appt-location">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                                <span>{appt.location}</span>
                                            </div>
                                        </div>

                                        {/* Batch Info */}
                                        <div className="appt-info-block">
                                            <div className="appt-badge-row">
                                                <span className={`corp-badge ${appt.status !== 'Pending Payment' ? 'badge-success' : 'badge-warning'}`}>
                                                    {appt.status}
                                                </span>
                                                {appt.bookingCode && (
                                                    <span
                                                        style={{
                                                            fontSize: '0.74rem',
                                                            padding: '2px 8px',
                                                            borderRadius: 999,
                                                            background: '#e0e7ff',
                                                            color: '#3730a3',
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        {appt.bookingCode}
                                                    </span>
                                                )}
                                                <span className="appt-batch-id">{appt.batchId}</span>
                                            </div>
                                            <h4>{appt.batchName}</h4>
                                            <p>{appt.size} Employees • Destination: {appt.destination}</p>

                                            {appt.status === 'Pending Payment' && (
                                                <div className="appt-warning-alert">
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                                    <span>This slot will be released if the invoice is not paid within 24 hours.</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="appt-actions-block">
                                            {appt.status === 'Pending Payment' ? (
                                                <button className="btn-action danger" onClick={() => navigate('/corporate/finance')}>
                                                    Pay Invoice
                                                </button>
                                            ) : (
                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                    {appt.appointmentId && (
                                                        <button
                                                            className="btn-outline-secondary"
                                                            style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                                                            onClick={() => handleOpenRescheduleModal(appt)}
                                                        >
                                                            Reschedule
                                                        </button>
                                                    )}
                                                    <button 
                                                        className="btn-outline-secondary" 
                                                        style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                                                        onClick={() => handleDownloadManifest(appt.batchId, appt.batchName)}
                                                    >
                                                        Manifest (PDF)
                                                    </button>
                                                    <button className="btn-outline-primary" onClick={() => navigate('/corporate/batches')}>
                                                        View Batch
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-state-box">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                    <p>No corporate appointments scheduled for this date.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {rescheduleTarget && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(15, 23, 42, 0.65)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999,
                        padding: 20,
                    }}
                    onClick={() => setRescheduleTarget(null)}
                >
                    <div
                        style={{
                            background: '#ffffff',
                            borderRadius: 16,
                            maxWidth: 540,
                            width: '100%',
                            padding: 24,
                            boxShadow: '0 20px 30px rgba(0,0,0,0.2)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', color: '#0f172a' }}>
                            Reschedule Corporate Appointment ({rescheduleTarget.id})
                        </h3>
                        <p style={{ margin: '0 0 16px 0', fontSize: '0.84rem', color: '#64748b' }}>
                            Select a published slot with capacity for {rescheduleTarget.size} employee(s) ({rescheduleTarget.destination}).
                        </p>

                        {loadingSlots ? (
                            <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Loading available slots...</div>
                        ) : availableSlots.length === 0 ? (
                            <div style={{ padding: 20, textAlign: 'center', color: '#dc2626', fontSize: '0.88rem' }}>
                                No alternative published slots found with capacity for {rescheduleTarget.size} employee(s).
                            </div>
                        ) : (
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                                    gap: 10,
                                    maxHeight: 280,
                                    overflowY: 'auto',
                                    marginBottom: 18,
                                }}
                            >
                                {availableSlots.slice(0, 16).map((slot) => {
                                    const sDate = slot.slotDate || new Date(slot.date).toISOString().slice(0, 10);
                                    const rem = slot.capacity - (slot.bookedCount || 0);
                                    const isSel = selectedNewSlotId === slot.id;
                                    return (
                                        <button
                                            key={slot.id}
                                            type="button"
                                            onClick={() => setSelectedNewSlotId(slot.id)}
                                            style={{
                                                padding: '10px 12px',
                                                borderRadius: 10,
                                                border: isSel ? '2px solid #2563eb' : '1px solid #cbd5e1',
                                                background: isSel ? '#eff6ff' : '#f8fafc',
                                                color: isSel ? '#1d4ed8' : '#0f172a',
                                                textAlign: 'left',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{sDate}</div>
                                            <div style={{ fontWeight: 800, fontSize: '0.9rem', marginTop: 2 }}>{slot.startTime}</div>
                                            <div style={{ fontSize: '0.73rem', color: '#64748b' }}>{rem} seats open</div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button
                                type="button"
                                className="btn-outline-secondary"
                                onClick={() => setRescheduleTarget(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-outline-primary"
                                disabled={!selectedNewSlotId || isSubmittingReschedule}
                                onClick={handleConfirmCorporateReschedule}
                            >
                                {isSubmittingReschedule ? 'Saving...' : 'Confirm Reschedule'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}