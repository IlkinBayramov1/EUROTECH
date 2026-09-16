import React, { useState } from 'react';
import './AgentAppointments.css';
import { appointmentService } from '@/shared/api/services';
import { useToast } from '@/shared/context/ToastContext';

type SlotStatus = 'booked';

interface ApplicantMock {
    name: string;
    passport: string;
    docsStatus: 'Verified' | 'Pending' | 'Rejected';
}

interface TimeSlot {
    id: string;
    time: string;
    status: SlotStatus;
    capacity: string;
    groupInfo: { 
        id: string; 
        name: string; 
        size: number; 
        passportStatus: string;
        package: string;
        applicants: ApplicantMock[];
    };
}

export default function AgentAppointments() {
    const [currentViewDate, setCurrentViewDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<number>(10);
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const { showSuccess, showError, showToast } = useToast();

    const timeSlots: TimeSlot[] = [
        { 
            id: 's2', time: '10:30 AM', status: 'booked', capacity: '8/10',
            groupInfo: { 
                id: 'GRP-8821', name: 'TechTrade Delegation', size: 8, passportStatus: 'Documents Ready', package: 'Premium Bundle',
                applicants: [
                    { name: 'Ali Mammadov', passport: 'C1234567', docsStatus: 'Verified' },
                    { name: 'Leyla Mammadova', passport: 'C9876543', docsStatus: 'Verified' },
                    { name: 'Hasan Aliyev', passport: 'C4567890', docsStatus: 'Verified' }
                ]
            }
        },
        { 
            id: 's5', time: '16:00 PM', status: 'booked', capacity: '10/10',
            groupInfo: { 
                id: 'GRP-8845', name: 'Vienna Summer Tour', size: 10, passportStatus: 'Pending Action', package: 'VIP Platinum',
                applicants: [
                    { name: 'Samir Karimov', passport: 'C1122334', docsStatus: 'Pending' },
                    { name: 'Aydan Guliyeva', passport: 'C5566778', docsStatus: 'Verified' }
                ]
            }
        },
    ];

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

    const handleViewDetails = (slot: TimeSlot) => {
        setSelectedSlot(slot);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setTimeout(() => setSelectedSlot(null), 300); // Animasiya bitdikdən sonra təmizləyir
    };

    const generateClientManifestPdf = (slot: TimeSlot) => {
        const { groupInfo, time } = slot;
        const dateStr = `Sep ${selectedDate}, ${year}`;

        const lines = [
            'EUROTECH CONSULAR SERVICES - OFFICIAL GROUP MANIFEST',
            '==================================================================',
            `Group Reference : ${groupInfo.id}`,
            `Group Title     : ${groupInfo.name}`,
            `Appointment Slot: ${dateStr} at ${time}`,
            `Service Package : ${groupInfo.package}`,
            `Total Travelers : ${groupInfo.size} Applicants`,
            '------------------------------------------------------------------',
            'PASSENGER MANIFEST:',
            '------------------------------------------------------------------',
            ...groupInfo.applicants.map((app, i) =>
                `${i + 1}. ${app.name.padEnd(25, ' ')} | Passport: ${app.passport.padEnd(12, ' ')} | Status: ${app.docsStatus}`
            ),
            '------------------------------------------------------------------',
            'Document certified for consular biometric submission.',
            'EuroTech Visa & Immigration Systems - Confidential.'
        ];

        const escaped = lines.join('\n').replace(/[()\\]/g, '\\$&').replace(/\n/g, ') Tj T* (');
        const stream = `BT /F1 10 Tf 40 760 Td 15 TL (${escaped}) Tj ET`;
        const pdfData = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000227 00000 n \n0000000300 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${360 + stream.length}\n%%EOF`;

        const blob = new Blob([pdfData], { type: 'application/pdf' });
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `manifest_${groupInfo.id}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    };

    const handleDownloadManifest = async () => {
        if (!selectedSlot) return;
        setIsDownloading(true);

        try {
            const res: any = await appointmentService.generateManifestPdf({
                appointmentId: selectedSlot.id,
                groupInfo: selectedSlot.groupInfo,
            });

            const data = res?.data || res;
            if (data && data.fileUrl) {
                const fileUrl = data.fileUrl.startsWith('http')
                    ? data.fileUrl
                    : `${window.location.origin}${data.fileUrl}`;

                const link = document.createElement('a');
                link.href = fileUrl;
                link.download = data.fileName || `manifest_${selectedSlot.groupInfo.id}.pdf`;
                link.target = '_blank';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                showSuccess('Qrup manifesti (PDF) uğurla yükləndi!');
            } else {
                generateClientManifestPdf(selectedSlot);
                showSuccess('Qrup manifesti (PDF) uğurla yükləndi!');
            }
        } catch (err) {
            console.warn('Backend PDF endpoint error, using client fallback:', err);
            generateClientManifestPdf(selectedSlot);
            showSuccess('Qrup manifesti (PDF) uğurla yükləndi!');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleReschedule = () => {
        showToast('Tarixi dəyişmək üçün təqvimdən yeni vaxt yuvası seçin və ya sorğu göndərin.', 'info');
        closeModal();
    };

    return (
        <div className="agent-appointments-content fade-in">
            {/* --- Premium Header --- */}
            <div className="agent-appt-header-premium">
                <div className="header-titles">
                    <h1 className="dash-title">Appointments Dashboard</h1>
                    <p className="dash-subtitle">Manage and track biometric appointments exclusively for your scheduled groups.</p>
                </div>
            </div>

            <div className="agent-appt-grid-premium">
                {/* --- Sol Tərəf: İnteraktiv Təqvim --- */}
                <div className="agent-appt-calendar-column">
                    <div className="premium-calendar-card sticky-card">
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
                                const hasBooking = !isPast && (day === 10 || day === 18 || day === 25);

                                return (
                                    <button 
                                        key={day}
                                        className={`calendar-day ${isSelected ? 'selected' : ''} ${isPast ? 'disabled' : ''}`}
                                        disabled={isPast}
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
                                <span>Your Group Appointments</span>
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
                            {timeSlots.length > 0 ? (
                                timeSlots.map(slot => (
                                    <div key={slot.id} className={`slot-card-premium ${slot.status}`}>
                                        <div className="slot-time-block">
                                            <div className="slot-time-display">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                <strong>{slot.time}</strong>
                                            </div>
                                            <div className="slot-capacity-display">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                                <span>{slot.capacity} Applicants</span>
                                            </div>
                                        </div>
                                        
                                        <div className="slot-info-block">
                                            <div className="group-details-box">
                                                <div className="group-header-row">
                                                    <span className="slot-status-badge badge-booked">Your Group</span>
                                                    <span className="group-id-ref">{slot.groupInfo.id}</span>
                                                </div>
                                                <h4>{slot.groupInfo.name}</h4>
                                                <p>{slot.groupInfo.size} Applicants • {slot.groupInfo.passportStatus}</p>
                                            </div>
                                        </div>

                                        <div className="slot-action-block">
                                            <button className="btn-text-secondary" onClick={() => handleViewDetails(slot)}>
                                                View Details
                                            </button>
                                        </div>
                                    </div>
                                ))
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
                                <span className="modal-badge">Appointment Details</span>
                                <h2>{selectedSlot.groupInfo.name}</h2>
                            </div>
                            <button className="btn-modal-close" onClick={closeModal}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="modal-body">
                            {/* Top Info Cards */}
                            <div className="modal-info-grid">
                                <div className="modal-info-card">
                                    <span className="info-label">Date & Time</span>
                                    <strong className="info-value">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                        Sep {selectedDate}, {year} • {selectedSlot.time}
                                    </strong>
                                </div>
                                <div className="modal-info-card">
                                    <span className="info-label">Group Reference</span>
                                    <strong className="info-value">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                        {selectedSlot.groupInfo.id}
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

                            {/* Applicants Manifest Table */}
                            <div className="modal-manifest-section">
                                <h3>Group Manifest ({selectedSlot.groupInfo.size} Applicants)</h3>
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
                                            {selectedSlot.groupInfo.applicants.map((app, idx) => (
                                                <tr key={idx}>
                                                    <td className="manifest-name">{app.name}</td>
                                                    <td className="manifest-passport">{app.passport}</td>
                                                    <td>
                                                        <span className={`manifest-badge ${app.docsStatus.toLowerCase()}`}>
                                                            {app.docsStatus}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {/* Fill remaining slots if size > mock data */}
                                            {selectedSlot.groupInfo.size > selectedSlot.groupInfo.applicants.length && (
                                                <tr>
                                                    <td colSpan={3} className="manifest-more">
                                                        + {selectedSlot.groupInfo.size - selectedSlot.groupInfo.applicants.length} more applicants...
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="modal-footer">
                            <button 
                                className="btn-modal-secondary"
                                onClick={handleReschedule}
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
                    </div>
                </div>
            )}
        </div>
    );
}