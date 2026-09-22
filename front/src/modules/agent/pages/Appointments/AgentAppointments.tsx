import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AgentAppointments.css';
import { agentService, appointmentService, TimeSlot as AvailableSlot } from '@/shared/api/services';
import { useToast } from '@/shared/context/ToastContext';

export interface ApplicantItem {
    id: string;
    name: string;
    passport: string;
    docsStatus: 'Verified' | 'Pending' | 'Rejected';
}

export interface AgentAppointmentItem {
    id: string;
    timeSlotId: string;
    status: string;
    location: string;
    notes?: string;
    timeSlot: {
        id: string;
        date: string;
        startTime: string;
        capacity: number;
        bookedCount: number;
        location: string;
    };
    groupInfo: {
        id: string;
        dbId?: string;
        name: string;
        destination: string;
        size: number;
        passportStatus: string;
        package: string;
        applicants: ApplicantItem[];
    };
}

export default function AgentAppointments() {
    const navigate = useNavigate();
    const [currentViewDate, setCurrentViewDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<number>(new Date().getDate());
    const [appointments, setAppointments] = useState<AgentAppointmentItem[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<AgentAppointmentItem | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    
    // Reschedule State
    const [isRescheduling, setIsRescheduling] = useState(false);
    const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [selectedNewSlotId, setSelectedNewSlotId] = useState<string | null>(null);
    const [isSubmittingReschedule, setIsSubmittingReschedule] = useState(false);

    const { showSuccess, showError } = useToast();

    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const startingDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; 
    
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const loadAppointments = async (targetYear = year, targetMonth = month) => {
        setLoading(true);
        try {
            const res: any = await agentService.getAgentAppointments();
            const data: AgentAppointmentItem[] = res?.data?.appointments || res?.appointments || [];
            setAppointments(data);

            // Auto-select first appointment date in current view month if available
            const monthAppts = data.filter((appt) => {
                if (!appt.timeSlot?.date) return false;
                const d = new Date(appt.timeSlot.date);
                return d.getFullYear() === targetYear && d.getMonth() === targetMonth && appt.status !== 'CANCELLED';
            });

            if (monthAppts.length > 0) {
                const firstDay = new Date(monthAppts[0].timeSlot.date).getDate();
                setSelectedDate(firstDay);
            } else if (today.getFullYear() === targetYear && today.getMonth() === targetMonth) {
                setSelectedDate(today.getDate());
            } else {
                setSelectedDate(1);
            }
        } catch (err: any) {
            console.error('Failed to load agent appointments:', err);
            showError(err.message || 'Görüşlər databazadan yüklənərkən xəta baş verdi.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAppointments(year, month);
    }, []);

    const handlePrevMonth = () => {
        const prev = new Date(year, month - 1, 1);
        setCurrentViewDate(prev);
        loadAppointments(prev.getFullYear(), prev.getMonth());
    };

    const handleNextMonth = () => {
        const next = new Date(year, month + 1, 1);
        setCurrentViewDate(next);
        loadAppointments(next.getFullYear(), next.getMonth());
    };

    // Calculate which days have appointments in this month
    const bookedDaysSet = new Set(
        appointments
            .filter((appt) => {
                if (!appt.timeSlot?.date) return false;
                const d = new Date(appt.timeSlot.date);
                return d.getFullYear() === year && d.getMonth() === month && appt.status !== 'CANCELLED';
            })
            .map((appt) => new Date(appt.timeSlot.date).getDate())
    );

    // Appointments scheduled for the currently selected day
    const dayAppointments = appointments.filter((appt) => {
        if (!appt.timeSlot?.date) return false;
        const d = new Date(appt.timeSlot.date);
        return (
            d.getFullYear() === year &&
            d.getMonth() === month &&
            d.getDate() === selectedDate &&
            appt.status !== 'CANCELLED'
        );
    });

    const handleViewDetails = (appt: AgentAppointmentItem) => {
        setSelectedSlot(appt);
        setIsRescheduling(false);
        setSelectedNewSlotId(null);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setIsRescheduling(false);
        setSelectedNewSlotId(null);
        setTimeout(() => setSelectedSlot(null), 300);
    };

    // Open Reschedule view and fetch available slots from backend
    const handleStartReschedule = async () => {
        setIsRescheduling(true);
        setSelectedNewSlotId(null);
        setLoadingSlots(true);

        try {
            const res: any = await appointmentService.getSlots();
            const slotsData = res?.data?.slots || res?.slots || [];
            // Filter out the current slot and only show slots with capacity
            const filtered = slotsData.filter((s: AvailableSlot) => s.id !== selectedSlot?.timeSlotId && (s.capacity - s.bookedCount) > 0);
            setAvailableSlots(filtered);
        } catch (err: any) {
            console.error('Error fetching available slots:', err);
            showError('Mövcud vaxt slotları yüklənərkən xəta baş verdi.');
        } finally {
            setLoadingSlots(false);
        }
    };

    // Confirm reschedule in backend
    const handleConfirmReschedule = async () => {
        if (!selectedSlot || !selectedNewSlotId) return;

        setIsSubmittingReschedule(true);
        try {
            await appointmentService.rescheduleAppointment(selectedSlot.id, selectedNewSlotId);
            showSuccess('Görüş vaxtı uğurla dəyişdirildi!');
            setIsRescheduling(false);
            closeModal();
            // Reload live appointments from backend
            await loadAppointments(year, month);
        } catch (err: any) {
            console.error('Reschedule error:', err);
            showError(err.message || 'Görüş vaxtı dəyişdirilərkən xəta baş verdi.');
        } finally {
            setIsSubmittingReschedule(false);
        }
    };

    const handleDownloadManifest = async () => {
        if (!selectedSlot) return;
        setIsDownloading(true);

        try {
            const res: any = await appointmentService.generateManifestPdf({
                appointmentId: selectedSlot.id,
                groupBatchId: selectedSlot.groupInfo.dbId,
            });

            const data = res?.data || res;
            if (data && data.fileUrl) {
                const apiOrigin = import.meta.env.VITE_API_URL 
                    ? import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, '') 
                    : 'http://localhost:5000';
                
                const fileUrl = data.fileUrl.startsWith('http')
                    ? data.fileUrl
                    : `${apiOrigin}${data.fileUrl}`;

                const link = document.createElement('a');
                link.href = fileUrl;
                link.download = data.fileName || `manifest_${selectedSlot.groupInfo.id}.pdf`;
                link.target = '_blank';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                showSuccess('Qrup konsulluq manifesti (PDF) uğurla yükləndi!');
            } else {
                showError('PDF manifest tapılmadı.');
            }
        } catch (err: any) {
            console.error('Manifest download error:', err);
            showError(err.message || 'Manifest endirilərkən xəta baş verdi.');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="agent-appointments-content fade-in">
            {/* --- Premium Header --- */}
            <div className="agent-appt-header-premium">
                <div className="header-titles">
                    <h1 className="dash-title">Appointments Dashboard</h1>
                    <p className="dash-subtitle">Manage and track biometric consular appointments exclusively for your tour groups.</p>
                </div>
            </div>

            <div className="agent-appt-grid-premium">
                {/* --- Sol Tərəf: İnteraktiv Təqvim --- */}
                <div className="agent-appt-calendar-column">
                    <div className="premium-calendar-card sticky-card">
                        <div className="calendar-header-nav">
                            <button className="btn-cal-nav" onClick={handlePrevMonth} title="Previous Month">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                            </button>
                            <div className="calendar-current-month">
                                {monthNames[month]} {year}
                            </div>
                            <button className="btn-cal-nav" onClick={handleNextMonth} title="Next Month">
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
                                const isSelected = day === selectedDate;
                                const hasBooking = bookedDaysSet.has(day);

                                return (
                                    <button 
                                        key={day}
                                        className={`calendar-day ${isSelected ? 'selected' : ''} ${isPast && !hasBooking ? 'disabled' : ''} ${hasBooking ? 'has-booking' : ''}`}
                                        disabled={isPast && !hasBooking}
                                        onClick={() => setSelectedDate(day)}
                                    >
                                        {day}
                                        {hasBooking && <div className="day-indicator-dot"></div>}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="calendar-legend-premium" style={{ justifyContent: 'center' }}>
                            <div className="legend-item">
                                <div className="legend-color booked"></div>
                                <span>Your Group Appointments ({appointments.length})</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- Sağ Tərəf: Detallı Saat Slotları --- */}
                <div className="agent-appt-slots-column">
                    <div className="daily-schedule-card">
                        <div className="schedule-header">
                            <div className="selected-date-display">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                <h3>{monthNames[month]} {selectedDate}, {year}</h3>
                            </div>
                        </div>

                        <div className="slots-list-premium">
                            {loading ? (
                                <div className="empty-state-box" style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--color-neutral)' }}>
                                    <div className="spinner-center" style={{ margin: '0 auto 16px' }}></div>
                                    <p style={{ margin: 0 }}>Görüşlər databazadan yüklənir...</p>
                                </div>
                            ) : dayAppointments.length > 0 ? (
                                dayAppointments.map(appt => (
                                    <div key={appt.id} className={`slot-card-premium ${appt.status.toLowerCase()}`}>
                                        <div className="slot-time-block">
                                            <div className="slot-time-display">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                <strong>{appt.timeSlot.startTime}</strong>
                                            </div>
                                            <div className="slot-capacity-display">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                                <span>{appt.groupInfo.size} Travelers</span>
                                            </div>
                                        </div>
                                        
                                        <div className="slot-info-block">
                                            <div className="group-details-box">
                                                <div className="group-header-row">
                                                    <span className={`slot-status-badge badge-${appt.status.toLowerCase()}`}>
                                                        {appt.status === 'CONFIRMED' ? 'Confirmed' : appt.status === 'RESCHEDULED' ? 'Rescheduled' : appt.status}
                                                    </span>
                                                    <span className="group-id-ref">{appt.groupInfo.id}</span>
                                                </div>
                                                <h4>{appt.groupInfo.name}</h4>
                                                <p>{appt.groupInfo.destination} • {appt.location} • {appt.groupInfo.passportStatus}</p>
                                            </div>
                                        </div>

                                        <div className="slot-action-block">
                                            <button className="btn-text-secondary" onClick={() => handleViewDetails(appt)}>
                                                View Details
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : appointments.length === 0 ? (
                                <div className="empty-state-box" style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--color-neutral)' }}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '48px', height: '48px', marginBottom: '16px', opacity: 0.5 }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                    <h4 style={{ margin: '0 0 8px 0', color: 'var(--color-primary)' }}>No Scheduled Group Appointments</h4>
                                    <p style={{ margin: '0 0 20px 0', fontSize: '0.95rem' }}>You have not scheduled any consular appointments for your tour groups yet.</p>
                                    <button 
                                        type="button" 
                                        className="btn-primary" 
                                        style={{ margin: '0 auto', display: 'inline-flex' }}
                                        onClick={() => navigate('/agent/create-group')}
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                        Register New Tour Group
                                    </button>
                                </div>
                            ) : (
                                <div className="empty-state-box" style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--color-neutral)' }}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '48px', height: '48px', marginBottom: '16px', opacity: 0.5 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                    <p style={{ margin: 0, fontSize: '1.05rem' }}>No group appointments scheduled for this date.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* --- ULTRA-PREMIUM MODAL --- */}
            {isModalOpen && selectedSlot && (
                <div className="premium-modal-overlay fade-in" onClick={closeModal}>
                    <div className="premium-modal-container slide-up" onClick={(e) => e.stopPropagation()}>
                        
                        {/* Modal Header */}
                        <div className="modal-header">
                            <div className="modal-header-info">
                                <span className="modal-badge">
                                    {isRescheduling ? 'Reschedule Appointment' : 'Appointment Details'}
                                </span>
                                <h2>{selectedSlot.groupInfo.name}</h2>
                            </div>
                            <button className="btn-modal-close" onClick={closeModal}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="modal-body">
                            {isRescheduling ? (
                                <div className="reschedule-panel slide-up">
                                    <div className="reschedule-header-box">
                                        <h4>Yeni Görüş Vaxtı Seçin</h4>
                                        <p className="reschedule-subtitle">
                                            Konsulluq biometrik qəbulu üçün sistemdə mövcud olan açıq vaxt slotlarından birini seçin:
                                        </p>
                                    </div>

                                    {loadingSlots ? (
                                        <div className="slots-loading-state">
                                            <div className="spinner-center" style={{ margin: '20px auto 8px' }}></div>
                                            <p>Açıq vaxt yuvaları yoxlanılır...</p>
                                        </div>
                                    ) : availableSlots.length === 0 ? (
                                        <div className="no-slots-alert">
                                            Hazırda alternativ boş vaxt yuvası tapılmadı. Zəhmət olmasa daha sonra təkrar yoxlayın.
                                        </div>
                                    ) : (
                                        <div className="reschedule-slots-grid">
                                            {availableSlots.slice(0, 16).map((slot) => {
                                                const sDate = new Date(slot.date);
                                                const dateStr = sDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                                const isSelected = selectedNewSlotId === slot.id;
                                                const availableLeft = slot.capacity - slot.bookedCount;

                                                return (
                                                    <div
                                                        key={slot.id}
                                                        className={`reschedule-slot-chip ${isSelected ? 'selected' : ''}`}
                                                        onClick={() => setSelectedNewSlotId(slot.id)}
                                                    >
                                                        <div className="slot-chip-date">{dateStr}</div>
                                                        <div className="slot-chip-time">{slot.startTime}</div>
                                                        <div className="slot-chip-cap">{availableLeft} yer qalıb</div>
                                                        <div className="slot-chip-loc">{slot.location.split(',')[0]}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <div className="reschedule-actions-row">
                                        <button 
                                            type="button"
                                            className="btn-modal-secondary" 
                                            onClick={() => { setIsRescheduling(false); setSelectedNewSlotId(null); }}
                                        >
                                            Geri
                                        </button>
                                        <button 
                                            type="button"
                                            className="btn-modal-primary"
                                            disabled={!selectedNewSlotId || isSubmittingReschedule}
                                            onClick={handleConfirmReschedule}
                                        >
                                            {isSubmittingReschedule ? 'Dəyişdirilir...' : 'Təsdiq et və Dəyişdir'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Top Info Cards */}
                                    <div className="modal-info-grid">
                                        <div className="modal-info-card">
                                            <span className="info-label">Date & Time</span>
                                            <strong className="info-value">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                                {monthNames[new Date(selectedSlot.timeSlot.date).getMonth()]} {new Date(selectedSlot.timeSlot.date).getDate()}, {new Date(selectedSlot.timeSlot.date).getFullYear()} • {selectedSlot.timeSlot.startTime}
                                            </strong>
                                        </div>
                                        <div className="modal-info-card">
                                            <span className="info-label">Group Reference</span>
                                            <strong className="info-value">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                                {selectedSlot.groupInfo.id} ({selectedSlot.groupInfo.destination})
                                            </strong>
                                        </div>
                                        <div className="modal-info-card">
                                            <span className="info-label">Service Package</span>
                                            <strong className="info-value text-gold">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                                                {selectedSlot.groupInfo.package}
                                            </strong>
                                        </div>
                                    </div>

                                    {/* Location Info Banner */}
                                    <div className="modal-location-banner" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'var(--color-bg)', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '0.9rem', color: 'var(--color-neutral)' }}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18, color: 'var(--color-secondary)' }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                        <span>Consular Center: <strong style={{ color: 'var(--color-primary)' }}>{selectedSlot.location}</strong></span>
                                    </div>

                                    {/* Applicants Manifest Table */}
                                    <div className="modal-manifest-section">
                                        <h3>Group Manifest ({selectedSlot.groupInfo.size} Applicants in Database)</h3>
                                        <div className="manifest-table-wrapper">
                                            <table className="manifest-table">
                                                <thead>
                                                    <tr>
                                                        <th>Applicant Name</th>
                                                        <th>Passport No.</th>
                                                        <th>Documents Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedSlot.groupInfo.applicants && selectedSlot.groupInfo.applicants.length > 0 ? (
                                                        selectedSlot.groupInfo.applicants.map((app, idx) => (
                                                            <tr key={idx}>
                                                                <td className="manifest-name">{app.name}</td>
                                                                <td className="manifest-passport">{app.passport}</td>
                                                                <td>
                                                                    <span className={`manifest-badge ${app.docsStatus.toLowerCase()}`}>
                                                                        {app.docsStatus}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <tr>
                                                            <td colSpan={3} style={{ textAlign: 'center', color: 'var(--color-neutral)', padding: '24px' }}>
                                                                No applicants registered in this group yet.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Modal Footer (only show when not in reschedule mode) */}
                        {!isRescheduling && (
                            <div className="modal-footer">
                                <button 
                                    className="btn-modal-secondary"
                                    onClick={handleStartReschedule}
                                    type="button"
                                >
                                    Reschedule Slot
                                </button>
                                <button 
                                    className="btn-modal-primary"
                                    onClick={handleDownloadManifest}
                                    disabled={isDownloading}
                                    type="button"
                                >
                                    {isDownloading ? (
                                        <>
                                            <svg 
                                                viewBox="0 0 24 24" 
                                                fill="none" 
                                                stroke="currentColor" 
                                                strokeWidth="2" 
                                                strokeLinecap="round" 
                                                strokeLinejoin="round" 
                                                style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }}
                                            >
                                                <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="10"/>
                                            </svg>
                                            Yüklənir...
                                        </>
                                    ) : (
                                        <>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                                <polyline points="7 10 12 15 17 10"/>
                                                <line x1="12" y1="15" x2="12" y2="3"/>
                                            </svg>
                                            Download Manifest (PDF)
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}