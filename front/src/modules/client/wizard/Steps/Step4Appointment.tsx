import React, { useState, useEffect } from 'react';
import { appointmentService } from '@/shared/api/services';

interface Step4Props {
    data: {
        appointmentDate: string;
        appointmentTime: string;
        visaCenter?: string;
    };
    updateData: (field: string, value: string) => void;
}

interface TimeSlotItem {
    id: string;
    time: string;
    available: boolean;
    remainingCapacity?: number;
}

const DEFAULT_SLOTS: TimeSlotItem[] = [
    { id: 'slot-0900', time: '09:00 AM', available: true, remainingCapacity: 5 },
    { id: 'slot-1015', time: '10:15 AM', available: true, remainingCapacity: 4 },
    { id: 'slot-1130', time: '11:30 AM', available: true, remainingCapacity: 3 },
    { id: 'slot-1300', time: '01:00 PM', available: true, remainingCapacity: 6 },
    { id: 'slot-1415', time: '02:15 PM', available: true, remainingCapacity: 4 },
    { id: 'slot-1530', time: '03:30 PM', available: true, remainingCapacity: 2 },
    { id: 'slot-1645', time: '04:45 PM', available: true, remainingCapacity: 5 },
];

export default function Step4Appointment({ data, updateData }: Step4Props) {
    const [currentViewDate, setCurrentViewDate] = useState(new Date());
    const [slots, setSlots] = useState<TimeSlotItem[]>(DEFAULT_SLOTS);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [selectedCenter, setSelectedCenter] = useState(data.visaCenter || 'baku');

    const handleCenterChange = (center: string) => {
        setSelectedCenter(center);
        updateData('visaCenter', center);
    };

    useEffect(() => {
        if (!data.appointmentDate) return;
        setLoadingSlots(true);
        appointmentService.getSlots(data.appointmentDate)
            .then(res => {
                if (res.data?.slots && res.data.slots.length > 0) {
                    const mapped: TimeSlotItem[] = res.data.slots.map((s: any) => ({
                        id: s.id || s.startTime,
                        time: s.startTime,
                        available: (s.availableCapacity ?? (s.capacity - s.bookedCount)) > 0,
                        remainingCapacity: s.availableCapacity ?? (s.capacity - s.bookedCount)
                    }));
                    setSlots(mapped);
                } else {
                    setSlots(DEFAULT_SLOTS);
                }
            })
            .catch(() => {
                setSlots(DEFAULT_SLOTS);
            })
            .finally(() => {
                setLoadingSlots(false);
            });
    }, [data.appointmentDate]);

    // Calendar navigation
    const handlePrevMonth = () => {
        setCurrentViewDate(new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentViewDate(new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1, 1));
    };

    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const startingDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; 
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const handleDateSelect = (day: number) => {
        const selectedDate = new Date(year, month, day);
        if (selectedDate < today || selectedDate.getDay() === 0 || selectedDate.getDay() === 6) {
            return; // past or weekend
        }
        const selectedDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        updateData('appointmentDate', selectedDateStr);
        updateData('appointmentTime', ''); 
    };

    return (
        <div className="step-content fade-in">
            <h1 className="step-title">Consular Biometrics & Appointment Slot</h1>
            <p className="step-subtitle">Schedule your in-person biometric appointment (fingerprinting and document validation) at an authorized EuroTech Consular Center.</p>

            {/* --- VISA CENTER LOCATION SELECTOR --- */}
            <div style={{ marginBottom: '32px' }}>
                <label style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0F1E36', marginBottom: '12px', display: 'block' }}>
                    Select Consular Collection Center
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                    <div 
                        onClick={() => handleCenterChange('baku')}
                        style={{
                            background: selectedCenter === 'baku' ? '#EFF6FF' : '#FFFFFF',
                            border: selectedCenter === 'baku' ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
                            borderRadius: '12px',
                            padding: '18px 20px',
                            cursor: 'pointer',
                            display: 'flex',
                            gap: '14px',
                            alignItems: 'center',
                            boxShadow: selectedCenter === 'baku' ? '0 4px 14px rgba(37, 99, 235, 0.12)' : '0 2px 6px rgba(15, 23, 42, 0.04)',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <div style={{ fontSize: '1.8rem' }}>🏛️</div>
                        <div>
                            <strong style={{ color: selectedCenter === 'baku' ? '#1E3A8A' : '#0F1E36', display: 'block', fontSize: '1rem', fontWeight: 700 }}>
                                EuroTech Main Center — Baku
                            </strong>
                            <span style={{ fontSize: '0.82rem', color: '#64748B' }}>Nizami St. 140, Landmark III (09:00 - 18:00)</span>
                        </div>
                    </div>

                    <div 
                        onClick={() => handleCenterChange('ganja')}
                        style={{
                            background: selectedCenter === 'ganja' ? '#EFF6FF' : '#FFFFFF',
                            border: selectedCenter === 'ganja' ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
                            borderRadius: '12px',
                            padding: '18px 20px',
                            cursor: 'pointer',
                            display: 'flex',
                            gap: '14px',
                            alignItems: 'center',
                            boxShadow: selectedCenter === 'ganja' ? '0 4px 14px rgba(37, 99, 235, 0.12)' : '0 2px 6px rgba(15, 23, 42, 0.04)',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <div style={{ fontSize: '1.8rem' }}>🏢</div>
                        <div>
                            <strong style={{ color: selectedCenter === 'ganja' ? '#1E3A8A' : '#0F1E36', display: 'block', fontSize: '1rem', fontWeight: 700 }}>
                                EuroTech Regional Hub — Ganja
                            </strong>
                            <span style={{ fontSize: '0.82rem', color: '#64748B' }}>Heydar Aliyev Ave. 45, Ganja Plaza (09:00 - 17:00)</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="appointment-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px' }}>
                {/* 1. INTERACTIVE CALENDAR COLUMN */}
                <div className="appointment-column">
                    <h3 style={{ fontSize: '1.05rem', color: '#0F1E36', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>📅</span> 1. Select Date
                    </h3>
                    
                    <div className="premium-calendar-card" style={{
                        background: '#FFFFFF',
                        border: '1.5px solid #E2E8F0',
                        borderRadius: '14px',
                        padding: '22px',
                        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)'
                    }}>
                        <div className="calendar-header-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                            <button className="btn-cal-nav" onClick={handlePrevMonth} style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '6px', color: '#0F1E36', cursor: 'pointer', padding: '6px 10px' }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 16, height: 16 }}><polyline points="15 18 9 12 15 6"/></svg>
                            </button>
                            <div className="calendar-current-month" style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0F1E36' }}>
                                {monthNames[month]} {year}
                            </div>
                            <button className="btn-cal-nav" onClick={handleNextMonth} style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '6px', color: '#0F1E36', cursor: 'pointer', padding: '6px 10px' }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 16, height: 16 }}><polyline points="9 18 15 12 9 6"/></svg>
                            </button>
                        </div>
                        
                        <div className="calendar-weekdays" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontWeight: 700, fontSize: '0.8rem', color: '#64748B', marginBottom: '10px' }}>
                            <span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span style={{ color: '#DC2626' }}>Sa</span><span style={{ color: '#DC2626' }}>Su</span>
                        </div>

                        <div className="calendar-days-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                            {Array.from({ length: startingDay }).map((_, index) => (
                                <div key={`empty-${index}`} style={{ height: '38px' }}></div>
                            ))}

                            {Array.from({ length: daysInMonth }).map((_, index) => {
                                const day = index + 1;
                                const dateObj = new Date(year, month, day);
                                const isPast = dateObj < today;
                                const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                                const disabled = isPast || isWeekend;
                                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                const isSelected = data.appointmentDate === dateStr;

                                return (
                                    <button
                                        key={day}
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => handleDateSelect(day)}
                                        style={{
                                            height: '38px',
                                            borderRadius: '8px',
                                            border: isSelected ? '2px solid #2563EB' : '1px solid #E2E8F0',
                                            background: isSelected ? '#2563EB' : disabled ? '#F8FAFC' : '#FFFFFF',
                                            color: isSelected ? '#FFFFFF' : disabled ? '#CBD5E1' : '#0F1E36',
                                            fontWeight: isSelected ? 700 : 600,
                                            cursor: disabled ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.15s ease',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.9rem',
                                            boxShadow: isSelected ? '0 2px 8px rgba(37, 99, 235, 0.3)' : 'none'
                                        }}
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
                    <h3 style={{ fontSize: '1.05rem', color: '#0F1E36', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>⏰</span> 2. Select Time Slot
                    </h3>

                    {!data.appointmentDate ? (
                        <div style={{
                            background: '#F8FAFC',
                            border: '1.5px dashed #CBD5E1',
                            borderRadius: '14px',
                            padding: '48px 20px',
                            textAlign: 'center',
                            color: '#64748B'
                        }}>
                            <span style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }}>📅</span>
                            <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 500 }}>Please select an available appointment date from the calendar first.</p>
                        </div>
                    ) : (
                        <div>
                            <div style={{ fontSize: '0.88rem', color: '#2563EB', fontWeight: 700, marginBottom: '14px' }}>
                                Available slots for {data.appointmentDate}:
                            </div>
                            {loadingSlots ? (
                                <p style={{ color: '#64748B' }}>Loading verified consular slots...</p>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                                    {slots.map(sl => {
                                        const isSelected = data.appointmentTime === sl.time;
                                        return (
                                            <button
                                                key={sl.id}
                                                type="button"
                                                disabled={!sl.available}
                                                onClick={() => updateData('appointmentTime', sl.time)}
                                                style={{
                                                    padding: '12px 14px',
                                                    borderRadius: '10px',
                                                    background: isSelected ? '#2563EB' : sl.available ? '#FFFFFF' : '#F8FAFC',
                                                    border: isSelected ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
                                                    color: isSelected ? '#FFFFFF' : sl.available ? '#0F1E36' : '#94A3B8',
                                                    cursor: sl.available ? 'pointer' : 'not-allowed',
                                                    textAlign: 'center',
                                                    boxShadow: isSelected ? '0 4px 12px rgba(37, 99, 235, 0.25)' : '0 1px 3px rgba(15, 23, 42, 0.04)',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <strong style={{ display: 'block', fontSize: '0.95rem' }}>{sl.time}</strong>
                                                <span style={{ fontSize: '0.75rem', color: isSelected ? '#BFDBFE' : sl.available ? '#059669' : '#DC2626', fontWeight: 600 }}>
                                                    {sl.available ? `${sl.remainingCapacity ?? 4} available` : 'Booked'}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {data.appointmentTime && (
                                <div style={{
                                    marginTop: '20px',
                                    padding: '14px 18px',
                                    borderRadius: '8px',
                                    background: '#ECFDF5',
                                    border: '1px solid #A7F3D0',
                                    color: '#047857',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <span>✓</span>
                                    <span>Confirmed Slot: {data.appointmentDate} at {data.appointmentTime}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}