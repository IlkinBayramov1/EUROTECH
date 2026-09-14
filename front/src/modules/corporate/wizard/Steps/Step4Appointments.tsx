import React, { useState } from 'react';

interface Step4Props {
    data: {
        appointmentDate: string;
        appointmentTime: string;
        employees: any[];
    };
    updateData: (field: string, value: string) => void;
}

export default function Step4Appointments({ data, updateData }: Step4Props) {
    // Calendar State
    const [currentViewDate, setCurrentViewDate] = useState(new Date());

    // Time slots (Simple format)
    const timeSlots = [
        { id: '09:00', label: '09:00', status: 'available' },
        { id: '13:00', label: '13:00', status: 'available' },
        { id: '14:30', label: '14:30', status: 'available' },
        { id: '16:00', label: '16:00', status: 'available' },
    ];

    const groupSize = data.employees?.length || 1;

    // Calendar Navigation
    const handlePrevMonth = () => setCurrentViewDate(new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() - 1, 1));
    const handleNextMonth = () => setCurrentViewDate(new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1, 1));

    // Calendar Calculations
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    
    // Offset for Monday start (0 = Sunday)
    const startingDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; 
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const handleDateSelect = (day: number) => {
        const selectedDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        updateData('appointmentDate', selectedDateStr);
        updateData('appointmentTime', ''); // Reset time when date changes
    };

    return (
        <div className="step-content fade-in">
            <h1 className="step-title">Biometric Appointment</h1>
            <p className="step-subtitle">Select a single date and time for all {groupSize} applicants to submit their biometric data at our Visa Center.</p>

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
                            {/* Empty cells at start of month */}
                            {Array.from({ length: startingDay }).map((_, index) => (
                                <div key={`empty-${index}`} className="calendar-day empty"></div>
                            ))}
                            
                            {/* Days of the month */}
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
                            {timeSlots.map(slot => {
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

            <div className="terms-box" style={{ marginTop: '40px', backgroundColor: '#FFFBEB', borderLeftColor: '#F59E0B', color: '#B45309', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #F59E0B' }}>
                <strong>Important Note:</strong> Your selected appointment slot will only be confirmed and secured after the final payment is successfully processed.
            </div>
        </div>
    );
}