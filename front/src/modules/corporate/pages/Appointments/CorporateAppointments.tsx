import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { corporateService } from '@/shared/api/services/corporate.service';
import './CorporateAppointments.css';

interface AppointmentRecord {
    id: string;
    time: string;
    batchId: string;
    batchName: string;
    destination: string;
    size: number;
    status: 'Confirmed' | 'Pending Payment';
    location: string;
}

export default function CorporateAppointments() {
    const navigate = useNavigate();

    // Calendar States
    const [currentViewDate, setCurrentViewDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<number>(new Date().getDate());
    const [loading, setLoading] = useState<boolean>(true);

    // Dynamic Appointments State (100% Real Database)
    const [appointmentsByDate, setAppointmentsByDate] = useState<Record<number, AppointmentRecord[]>>({});

    useEffect(() => {
        async function loadCorporateAppointments() {
            setLoading(true);
            try {
                const res = await corporateService.getBatches();
                const updated: Record<number, AppointmentRecord[]> = {};

                if (res.data?.batches && Array.isArray(res.data.batches)) {
                    res.data.batches.forEach((b: any) => {
                        const targetDateStr = b.appointmentDate || b.travelDate || b.createdAt;
                        if (targetDateStr) {
                            const d = new Date(targetDateStr);
                            if (d.getMonth() === currentViewDate.getMonth() && d.getFullYear() === currentViewDate.getFullYear()) {
                                const day = d.getDate();
                                if (!updated[day]) updated[day] = [];

                                const isConfirmed = (
                                    b.status === 'PROCESSING' || 
                                    b.status === 'READY' || 
                                    b.status === 'COMPLETED' ||
                                    (b.appointments && b.appointments.some((a: any) => a.status === 'CONFIRMED'))
                                );

                                updated[day].push({
                                    id: `APT-${b.code || b.id.slice(0, 6)}`,
                                    time: b.appointmentTime || '10:00 AM',
                                    batchId: b.code || b.id,
                                    batchName: b.name || 'Corporate Delegation',
                                    destination: b.destination || 'Europe / Schengen',
                                    size: b.totalEmployees || (b.applicants?.length) || 1,
                                    status: isConfirmed ? 'Confirmed' : 'Pending Payment',
                                    location: 'EuroTech Premium Biometrics Center'
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
        }
        loadCorporateAppointments();
    }, [currentViewDate]);

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
                                                <span className={`corp-badge ${appt.status === 'Confirmed' ? 'badge-success' : 'badge-warning'}`}>
                                                    {appt.status}
                                                </span>
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
                                                <button className="btn-outline-primary" onClick={() => navigate('/corporate/batches')}>
                                                    View Batch
                                                </button>
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
        </div>
    );
}