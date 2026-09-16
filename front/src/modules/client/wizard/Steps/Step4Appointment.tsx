import React, { useState, useEffect } from 'react';
import { appointmentService } from '@/shared/api/services';

interface Step4Props {
    data: {
        appointmentDate: string;
        appointmentTime: string;
    };
    updateData: (field: string, value: string) => void;
}

export default function Step4Appointment({ data, updateData }: Step4Props) {
    // Təqvimdə hazırda baxılan ay/il üçün state
    const [currentViewDate, setCurrentViewDate] = useState(new Date());
    const [slots, setSlots] = useState<{ id: string; label: string; status: 'available' | 'full' }[]>([
        { id: '09:00', label: '09:00', status: 'available' },
        { id: '10:30', label: '10:30', status: 'available' },
        { id: '13:00', label: '13:00', status: 'available' },
        { id: '14:30', label: '14:30', status: 'available' },
        { id: '16:00', label: '16:00', status: 'available' },
    ]);

    useEffect(() => {
        if (!data.appointmentDate) return;
        appointmentService.getSlots(data.appointmentDate)
            .then(res => {
                if (res.data?.slots && res.data.slots.length > 0) {
                    const mapped = res.data.slots.map((s: any) => ({
                        id: s.startTime,
                        label: s.startTime,
                        status: s.bookedCount >= s.capacity ? 'full' : 'available',
                    }));
                    setSlots(mapped);
                }
            })
            .catch(() => {});
    }, [data.appointmentDate]);

    // Təqvim naviqasiyası
    const handlePrevMonth = () => {
        setCurrentViewDate(new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentViewDate(new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1, 1));
    };

    // Ayın günlərini hesablamaq
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    
    // Həftənin Bazar ertəsindən (Monday) başlaması üçün ofset (0 = Sunday)
    const startingDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; 
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Yalnız tarixi müqayisə etmək üçün saatı sıfırlayırıq

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const handleDateSelect = (day: number) => {
        // Format YYYY-MM-DD
        const selectedDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        updateData('appointmentDate', selectedDateStr);
        updateData('appointmentTime', ''); 
    };

    return (
        <div className="step-content fade-in">
            <h1 className="step-title">Biometric Appointment</h1>
            <p className="step-subtitle">Select a date and time for your biometric data collection at our Visa Center.</p>

            <div className="appointment-container">
                {/* 1. INTERACTIVE CALENDAR COLUMN */}
                <div className="appointment-column">
                    <h3>1. Select Date</h3>
                    
                    <div className="premium-calendar-card">
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
                            {/* Ayın əvvəlindəki boş xanalar */}
                            {Array.from({ length: startingDay }).map((_, index) => (
                                <div key={`empty-${index}`} className="calendar-day empty"></div>
                            ))}
                            
                            {/* Ayın günləri */}
                            {Array.from({ length: daysInMonth }).map((_, index) => {
                                const day = index + 1;
                                const currentDate = new Date(year, month, day);
                                const isPast = currentDate < today;
                                
                                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                const isSelected = data.appointmentDate === dateStr;

                                return (
                                    <button 
                                        key={day}
                                        className={`calendar-day ${isSelected ? 'selected' : ''} ${isPast ? 'disabled' : ''}`}
                                        disabled={isPast}
                                        onClick={() => handleDateSelect(day)}
                                    >
                                        {day}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* 2. TIME SLOTS COLUMN */}
                <div className="appointment-column">
                    <h3>2. Select Time Slot</h3>
                    {!data.appointmentDate ? (
                        <div className="empty-state-box">
                            Please select a date first to view available slots.
                        </div>
                    ) : (
                        <div className="time-grid-compact fade-in">
                            {slots.map(slot => {
                                const isSelected = data.appointmentTime === slot.id;
                                const isFull = slot.status === 'full';
                                
                                return (
                                    <div 
                                        key={slot.id} 
                                        className={`slot-card-compact ${isSelected ? 'selected' : ''} ${isFull ? 'full' : ''}`}
                                        onClick={() => !isFull && updateData('appointmentTime', slot.id)}
                                    >
                                        <div className="slot-time-text">{slot.label}</div>
                                        {isFull && <div className="slot-full-text">Full</div>}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <div className="terms-box" style={{ marginTop: '40px', backgroundColor: '#FFFBEB', borderLeftColor: '#F59E0B', color: '#B45309' }}>
                <strong>Important Note:</strong> Your selected appointment slot will only be confirmed and secured after the final payment is successfully processed.
            </div>
        </div>
    );
}