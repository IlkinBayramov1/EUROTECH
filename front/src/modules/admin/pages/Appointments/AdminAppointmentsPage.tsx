import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { vcmsApi, EXCLUDED_DATE_REASONS } from '../../api/vcmsApi';
import '../../styles/vcms.css';

type AppointmentSubTab =
  | 'CALENDAR'
  | 'PROVIDERS'
  | 'SCHEDULES_RULES'
  | 'EXCLUDED_DATES'
  | 'MANUAL_SLOTS'
  | 'BOOKINGS';

export default function AdminAppointmentsPage() {
  const [searchParams] = useSearchParams();
  const initialCountryId = searchParams.get('countryId') || '';

  const [subTab, setSubTab] = useState<AppointmentSubTab>('CALENDAR');
  const [providerKindFilter, setProviderKindFilter] = useState<'ALL' | 'EMBASSY' | 'VISA_APPLICATION_CENTRE'>('ALL');
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Reference Data
  const [countries, setCountries] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);

  // Calendar Filters (6 mandatory filters from Batch 3 Image 2)
  const [selectedCountryId, setSelectedCountryId] = useState<string>(initialCountryId);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('ALL');
  const [selectedVisaTypeId, setSelectedVisaTypeId] = useState<string>('ALL');
  const [selectedPurposeId, setSelectedPurposeId] = useState<string>('ALL');
  const [monthKey, setMonthKey] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 7);
  });
  const [slotStatusFilter, setSlotStatusFilter] = useState<string>('ALL');

  // Calendar Data & Selected Day (5.3 Daily Slot Details)
  const [calendarData, setCalendarData] = useState<any | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState<string>('');

  // Monthly Schedule & Generation Rules Form (Sections 3, 4 & 5)
  const [activeScheduleId, setActiveScheduleId] = useState<string>('');
  const [scheduleForm, setScheduleForm] = useState({
    countryId: '',
    providerId: '',
    visaTypeId: '',
    visaPurposeId: '',
    monthKey: '',
    managementMode: 'AUTOMATIC_GENERATION' as 'AUTOMATIC_GENERATION' | 'MANUAL_AVAILABILITY',
    timezone: 'Asia/Baku',
    appointmentsPerDay: 2,
    appointmentTimes: ['09:00', '11:00'],
    capacityPerSlot: 1,
    workingDays: [1, 2, 3, 4, 5],
    excludeWeekends: true,
    excludeLastDayOfMonth: true,
    excludePublicHolidays: true,
  });
  const [draftPreview, setDraftPreview] = useState<any | null>(null);

  // Excluded Date Form (Section 3.4 & 6)
  const [exceptionForm, setExceptionForm] = useState({
    countryId: '',
    providerId: '',
    excludedDate: '',
    reason: 'PUBLIC_HOLIDAY',
    note: '',
  });

  // Manual Slot Form (Section 6 & 7 — 9 fields)
  const [manualForm, setManualForm] = useState({
    countryId: '',
    providerId: '',
    visaTypeId: '',
    visaPurposeId: '',
    slotDate: '',
    startTime: '15:00',
    capacity: 1,
    slotStatus: 'AVAILABLE',
    notes: '',
  });

  // Provider Visa Type / Purpose Mapping Modal (Section 7)
  const [mappingProvider, setMappingProvider] = useState<any | null>(null);
  const [mappedVisaTypeIds, setMappedVisaTypeIds] = useState<string[]>([]);
  const [mappedPurposeIds, setMappedPurposeIds] = useState<string[]>([]);

  // Edit Slot Modal
  const [editingSlot, setEditingSlot] = useState<any | null>(null);
  const [editSlotForm, setEditSlotForm] = useState({
    slotDate: '',
    startTime: '',
    capacity: 1,
    slotStatus: 'AVAILABLE',
    notes: '',
  });

  // Admin Reschedule Booking Modal (Section 8)
  const [rescheduleTargetBooking, setRescheduleTargetBooking] = useState<any | null>(null);
  const [rescheduleNewSlotId, setRescheduleNewSlotId] = useState<string>('');
  const [rescheduleNotes, setRescheduleNotes] = useState<string>('');
  const [rescheduleSendNotif, setRescheduleSendNotif] = useState<boolean>(true);

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4200);
  };

  const loadReferenceData = async () => {
    try {
      const [cRes, pRes] = await Promise.all([
        vcmsApi.listDestinations(),
        vcmsApi.listAppointmentProviders(),
      ]);
      const cList = cRes.data?.countries || [];
      const pList = pRes.data?.providers || [];
      setCountries(cList);
      setProviders(pList);

      const defaultCountry =
        cList.find((c: any) => c.id === selectedCountryId) ||
        cList.find((c: any) => c.code === 'FR') ||
        cList[0];

      if (defaultCountry && !selectedCountryId) {
        setSelectedCountryId(defaultCountry.id);
      }

      if (defaultCountry) {
        const countryProvs = pList.filter((p: any) => p.countryId === defaultCountry.id);
        const firstProv = countryProvs[0];
        const firstVt = defaultCountry.visaTypes?.[0];
        setScheduleForm((prev) => ({
          ...prev,
          countryId: prev.countryId || defaultCountry.id,
          providerId: prev.providerId || firstProv?.id || '',
          visaTypeId: prev.visaTypeId || firstVt?.id || '',
          monthKey: prev.monthKey || monthKey,
        }));
        setManualForm((prev) => ({
          ...prev,
          countryId: prev.countryId || defaultCountry.id,
          providerId: prev.providerId || firstProv?.id || '',
          visaTypeId: prev.visaTypeId || firstVt?.id || '',
          slotDate: prev.slotDate || `${monthKey}-04`,
        }));
        setExceptionForm((prev) => ({
          ...prev,
          countryId: prev.countryId || defaultCountry.id,
          excludedDate: prev.excludedDate || `${monthKey}-24`,
        }));
      }
    } catch (err: any) {
      notify(err.message || 'Failed to load appointment providers', 'error');
    }
  };

  const loadCalendarAndSchedules = async () => {
    try {
      const [calRes, schRes, excRes, bookRes] = await Promise.all([
        vcmsApi.getAppointmentCalendar({
          countryId: selectedCountryId || undefined,
          providerId: selectedProviderId !== 'ALL' ? selectedProviderId : undefined,
          visaTypeId: selectedVisaTypeId !== 'ALL' ? selectedVisaTypeId : undefined,
          visaPurposeId: selectedPurposeId !== 'ALL' ? selectedPurposeId : undefined,
          monthKey,
          slotStatus: slotStatusFilter !== 'ALL' ? slotStatusFilter : undefined,
        }),
        vcmsApi.listAppointmentSchedules({
          countryId: selectedCountryId || undefined,
          monthKey,
        }),
        vcmsApi.listExcludedDates({
          countryId: selectedCountryId || undefined,
          monthKey,
        }),
        vcmsApi.listBookings({
          countryId: selectedCountryId || undefined,
        }),
      ]);
      setCalendarData(calRes.data);
      setSchedules(schRes.data?.schedules || []);
      setExceptions(excRes.data?.exceptions || []);
      setBookings(bookRes.data?.bookings || []);

      if (calRes.data?.days?.length > 0 && !selectedDateStr) {
        const firstOpen = calRes.data.days.find((d: any) => d.totalSlotsCount > 0) || calRes.data.days[0];
        setSelectedDateStr(firstOpen.date);
      }
    } catch (err: any) {
      notify(err.message || 'Failed to load appointment calendar', 'error');
    }
  };

  useEffect(() => {
    loadReferenceData();
  }, []);

  useEffect(() => {
    loadCalendarAndSchedules();
  }, [selectedCountryId, selectedProviderId, selectedVisaTypeId, selectedPurposeId, monthKey, slotStatusFilter]);

  const activeCountry = useMemo(
    () => countries.find((c) => c.id === selectedCountryId) || countries[0] || null,
    [countries, selectedCountryId]
  );

  const countryProviders = useMemo(
    () => providers.filter((p) => !selectedCountryId || p.countryId === selectedCountryId),
    [providers, selectedCountryId]
  );

  const countryVisaTypes = useMemo(() => activeCountry?.visaTypes || [], [activeCountry]);

  const countryPurposes = useMemo(() => {
    if (selectedVisaTypeId && selectedVisaTypeId !== 'ALL') {
      const vt = countryVisaTypes.find((v: any) => v.id === selectedVisaTypeId);
      return vt?.purposes || [];
    }
    return countryVisaTypes.flatMap((v: any) => v.purposes || []);
  }, [countryVisaTypes, selectedVisaTypeId]);

  const selectedDayObj = useMemo(() => {
    return calendarData?.days?.find((d: any) => d.date === selectedDateStr) || calendarData?.days?.[0] || null;
  }, [calendarData, selectedDateStr]);

  // Leading blank cells for Monday-first calendar grid
  const leadingEmptyDays = useMemo(() => {
    const firstDay = calendarData?.days?.[0];
    if (!firstDay) return [];
    const offset = Math.max(0, (firstDay.isoDayOfWeek || 1) - 1);
    return Array.from({ length: offset });
  }, [calendarData]);

  // Handlers
  const handleSaveAndPreviewSchedule = async (generateNow = false) => {
    try {
      const saveRes = await vcmsApi.saveAppointmentSchedule({
        id: activeScheduleId || undefined,
        countryId: scheduleForm.countryId || selectedCountryId,
        providerId: scheduleForm.providerId,
        visaTypeId: scheduleForm.visaTypeId,
        visaPurposeId: scheduleForm.visaPurposeId || null,
        monthKey: scheduleForm.monthKey || monthKey,
        managementMode: scheduleForm.managementMode,
        timezone: scheduleForm.timezone,
        rule: {
          appointmentsPerDay: Number(scheduleForm.appointmentsPerDay),
          appointmentTimesJson: scheduleForm.appointmentTimes,
          capacityPerSlot: Number(scheduleForm.capacityPerSlot),
          workingDaysJson: scheduleForm.workingDays,
          excludeWeekends: scheduleForm.excludeWeekends,
          excludeLastDayOfMonth: scheduleForm.excludeLastDayOfMonth,
          excludePublicHolidays: scheduleForm.excludePublicHolidays,
        },
      });
      const sch = saveRes.data?.schedule;
      setActiveScheduleId(sch.id);

      const prevRes = await vcmsApi.previewScheduleGeneration(sch.id);
      setDraftPreview(prevRes.data?.preview);

      if (generateNow) {
        const genRes = await vcmsApi.generateScheduleSlots(sch.id);
        setDraftPreview(genRes.data?.generation);
        notify(
          `Generated ${genRes.data.generation.createdCount} slots in DRAFT status (${genRes.data.generation.preservedCount} existing preserved). Review & click Publish!`
        );
      } else {
        notify('Draft Preview computed! Review the 6 metrics below.');
      }

      await loadCalendarAndSchedules();
    } catch (err: any) {
      notify(err.message || 'Failed to save schedule rules', 'error');
    }
  };

  const handlePublishSchedule = async (scheduleId: string) => {
    try {
      const res = await vcmsApi.publishSchedule(scheduleId);
      notify(`Schedule PUBLISHED! ${res.data.activatedSlotsCount} slots are now open to customers.`);
      await loadCalendarAndSchedules();
    } catch (err: any) {
      notify(err.message || 'Publish failed', 'error');
    }
  };

  const handleAddExcludedDate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await vcmsApi.createExcludedDate({
        countryId: exceptionForm.countryId || selectedCountryId || null,
        providerId: exceptionForm.providerId || null,
        excludedDate: exceptionForm.excludedDate,
        reason: exceptionForm.reason,
        note: exceptionForm.note,
      });
      if (res.data?.warning) {
        notify(res.data.warning, 'error');
      } else {
        notify(`Excluded date ${exceptionForm.excludedDate} (${exceptionForm.reason}) saved`);
      }
      setExceptionForm({ ...exceptionForm, note: '' });
      await loadCalendarAndSchedules();
    } catch (err: any) {
      notify(err.message || 'Failed to add excluded date', 'error');
    }
  };

  const handleCreateManualSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await vcmsApi.createManualSlot({
        ...manualForm,
        countryId: manualForm.countryId || selectedCountryId,
      });
      notify(`Manual slot created on ${manualForm.slotDate} at ${manualForm.startTime} (Capacity: ${manualForm.capacity})`);
      await loadCalendarAndSchedules();
    } catch (err: any) {
      notify(err.message || 'Failed to create manual slot', 'error');
    }
  };

  const handleUpdateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlot) return;
    try {
      const res = await vcmsApi.updateSlot(editingSlot.id, editSlotForm);
      setEditingSlot(null);
      notify(
        res.data?.notificationsSentCount > 0
          ? `Slot updated & ${res.data.notificationsSentCount} customer(s) automatically notified!`
          : 'Slot updated'
      );
      await loadCalendarAndSchedules();
    } catch (err: any) {
      notify(err.message || 'Failed to update slot', 'error');
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    try {
      await vcmsApi.deleteSlot(slotId);
      notify('Unbooked slot deleted');
      await loadCalendarAndSchedules();
    } catch (err: any) {
      notify(err.message || 'Booked slot cannot be deleted!', 'error');
    }
  };

  const handleSaveProviderMappings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mappingProvider) return;
    try {
      await vcmsApi.updateProviderVisaMappings(mappingProvider.id, {
        visaTypeIds: mappedVisaTypeIds,
        visaPurposeIds: mappedPurposeIds,
      });
      setMappingProvider(null);
      await loadReferenceData();
      notify(`Updated Visa Type & Purpose mappings for ${mappingProvider.displayName}`);
    } catch (err: any) {
      notify(err.message || 'Failed to save provider mappings', 'error');
    }
  };

  const handleAdminRescheduleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleTargetBooking || !rescheduleNewSlotId) return;
    try {
      await vcmsApi.adminRescheduleBooking(rescheduleTargetBooking.id, {
        newTimeSlotId: rescheduleNewSlotId,
        adminNotes: rescheduleNotes,
        sendNotification: rescheduleSendNotif,
      });
      setRescheduleTargetBooking(null);
      setRescheduleNewSlotId('');
      setRescheduleNotes('');
      await loadCalendarAndSchedules();
      notify('Booking rescheduled and customer notified via In-App + Email!');
    } catch (err: any) {
      notify(err.message || 'Failed to reschedule booking', 'error');
    }
  };

  return (
    <div className="vcms-page">
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 2000,
            padding: '12px 18px',
            borderRadius: 12,
            background: toast.type === 'error' ? '#dc2626' : '#0f172a',
            color: '#fff',
            fontWeight: 600,
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          }}
        >
          {toast.text}
        </div>
      )}

      <div className="vcms-header">
        <div className="vcms-title-group">
          <h1>
            Appointment Management System
            <span className="vcms-badge info">{monthKey}</span>
          </h1>
          <p>
            Manage Embassy Appointments & Visa Application Centre Appointments, Monthly Schedules (Draft → Publish →
            Close → Archive), Automatic Slot Generation Rules, Excluded Dates, Manual Slots, and Customer Bookings.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="vcms-btn secondary"
            onClick={() => {
              setSubTab('MANUAL_SLOTS');
            }}
          >
            + Add Extra Manual Slot
          </button>
          <button
            className="vcms-btn accent"
            onClick={() => {
              setSubTab('SCHEDULES_RULES');
            }}
          >
            Open Monthly Slot Generator
          </button>
        </div>
      </div>

      {/* Unified Appointment Hub Sub-Navigation */}
      <div className="vcms-tabs">
        <button
          className={`vcms-tab ${subTab === 'CALENDAR' ? 'active' : ''}`}
          onClick={() => setSubTab('CALENDAR')}
        >
          Calendar
        </button>
        <button
          className={`vcms-tab ${subTab === 'PROVIDERS' ? 'active' : ''}`}
          onClick={() => setSubTab('PROVIDERS')}
        >
          Embassy & Visa Centres ({providers.length})
        </button>
        <button
          className={`vcms-tab ${subTab === 'SCHEDULES_RULES' ? 'active' : ''}`}
          onClick={() => setSubTab('SCHEDULES_RULES')}
        >
          Schedules & Rules
        </button>
        <button
          className={`vcms-tab ${subTab === 'EXCLUDED_DATES' ? 'active' : ''}`}
          onClick={() => setSubTab('EXCLUDED_DATES')}
        >
          Excluded Dates ({exceptions.length})
        </button>
        <button
          className={`vcms-tab ${subTab === 'MANUAL_SLOTS' ? 'active' : ''}`}
          onClick={() => setSubTab('MANUAL_SLOTS')}
        >
          Manual Slots
        </button>
        <button
          className={`vcms-tab ${subTab === 'BOOKINGS' ? 'active' : ''}`}
          onClick={() => setSubTab('BOOKINGS')}
        >
          Bookings ({bookings.length})
        </button>
      </div>

      {/* ====================================================================
          1. APPOINTMENT CALENDAR & 5.3 DAILY SLOT DETAILS
          ==================================================================== */}
      {subTab === 'CALENDAR' && (
        <div>
          {/* 5.1 Calendar Filters (6 mandatory filters) */}
          <div className="vcms-toolbar">
            <div className="vcms-filters">
              <div className="vcms-field">
                <label>Country</label>
                <select
                  className="vcms-select"
                  value={selectedCountryId}
                  onChange={(e) => {
                    setSelectedCountryId(e.target.value);
                    setSelectedProviderId('ALL');
                    setSelectedVisaTypeId('ALL');
                    setSelectedPurposeId('ALL');
                  }}
                >
                  <option value="">All Countries</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.flagEmoji} {c.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="vcms-field">
                <label>Appointment Provider</label>
                <select
                  className="vcms-select"
                  value={selectedProviderId}
                  onChange={(e) => setSelectedProviderId(e.target.value)}
                >
                  <option value="ALL">All Providers (Embassy & Visa Centre)</option>
                  {countryProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName} [{p.providerType === 'EMBASSY' ? 'Embassy' : 'Visa Centre'}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="vcms-field">
                <label>Visa Type</label>
                <select
                  className="vcms-select"
                  value={selectedVisaTypeId}
                  onChange={(e) => setSelectedVisaTypeId(e.target.value)}
                >
                  <option value="ALL">All Visa Types</option>
                  {countryVisaTypes.map((vt: any) => (
                    <option key={vt.id} value={vt.id}>
                      {vt.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="vcms-field">
                <label>Visa Purpose</label>
                <select
                  className="vcms-select"
                  value={selectedPurposeId}
                  onChange={(e) => setSelectedPurposeId(e.target.value)}
                >
                  <option value="ALL">All Purposes</option>
                  {countryPurposes.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="vcms-field">
                <label>Month</label>
                <input
                  type="month"
                  className="vcms-input"
                  value={monthKey}
                  onChange={(e) => setMonthKey(e.target.value)}
                />
              </div>

              <div className="vcms-field">
                <label>Slot Status</label>
                <select
                  className="vcms-select"
                  value={slotStatusFilter}
                  onChange={(e) => setSlotStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="AVAILABLE">Available</option>
                  <option value="BOOKED">Booked</option>
                  <option value="BLOCKED">Blocked</option>
                  <option value="DRAFT">Draft (Unpublished)</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 18 }}>
            {/* 5.2 Calendar View */}
            <div className="vcms-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0 }}>
                  {activeCountry ? `${activeCountry.flagEmoji} ${activeCountry.nameEn}` : 'All Countries'} —{' '}
                  {monthKey} Calendar
                </h3>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span className="vcms-badge available">Open</span>
                  <span className="vcms-badge draft">Draft</span>
                  <span className="vcms-badge blocked">Closed / Holiday</span>
                  <span className="vcms-badge weekend">Weekend</span>
                </div>
              </div>

              <div className="vcms-cal-grid">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                  <div key={d} className="vcms-cal-head">
                    {d}
                  </div>
                ))}

                {leadingEmptyDays.map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}

                {(calendarData?.days || []).map((day: any) => (
                  <div
                    key={day.date}
                    onClick={() => setSelectedDateStr(day.date)}
                    className={`vcms-cal-cell ${day.dayState.toLowerCase()} ${
                      selectedDateStr === day.date ? 'selected' : ''
                    }`}
                  >
                    <div className="vcms-cal-daynum">
                      <span>{day.dayOfMonth}</span>
                      {day.totalBooked > 0 && (
                        <span className="vcms-badge info" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                          {day.totalBooked} Booked
                        </span>
                      )}
                    </div>

                    <div>
                      {day.dayState === 'CLOSED' && (
                        <span
                          className="vcms-badge blocked"
                          style={{ fontSize: '0.7rem' }}
                          title={day.exception?.note || day.exception?.reason}
                        >
                          Closed
                        </span>
                      )}
                      {day.dayState === 'OPEN' && (
                        <span className="vcms-badge available" style={{ fontSize: '0.72rem' }}>
                          {day.openSlotsCount} Open
                        </span>
                      )}
                      {day.dayState === 'DRAFT' && (
                        <span className="vcms-badge draft" style={{ fontSize: '0.72rem' }}>
                          {day.draftSlotsCount} Draft
                        </span>
                      )}
                      {day.dayState === 'FULL' && (
                        <span className="vcms-badge info" style={{ fontSize: '0.72rem' }}>
                          Full ({day.totalBooked}/{day.totalCapacity})
                        </span>
                      )}
                      {day.dayState === 'BLOCKED' && (
                        <span className="vcms-badge blocked" style={{ fontSize: '0.72rem' }}>
                          Blocked
                        </span>
                      )}
                      {day.dayState === 'WEEKEND' && (
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Weekend</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 5.3 Daily Slot Details */}
            <div className="vcms-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <h3 style={{ margin: 0 }}>{selectedDayObj?.date || 'Select a Date'}</h3>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {selectedDayObj?.openSlotsCount || 0} Available · {selectedDayObj?.totalSlotsCount || 0} Total Slots
                  </span>
                </div>
                <button
                  className="vcms-btn sm accent"
                  onClick={() => {
                    setManualForm((prev) => ({
                      ...prev,
                      slotDate: selectedDayObj?.date || `${monthKey}-15`,
                    }));
                    setSubTab('MANUAL_SLOTS');
                  }}
                >
                  + Add Extra Slot
                </button>
              </div>

              {selectedDayObj?.exception && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#b91c1c',
                    padding: '10px 12px',
                    borderRadius: 10,
                    fontSize: '0.82rem',
                    marginBottom: 12,
                  }}
                >
                  <strong>Excluded Date ({selectedDayObj.exception.reason}):</strong>{' '}
                  {selectedDayObj.exception.note || 'No automatic appointments on this date.'}
                </div>
              )}

              {(selectedDayObj?.slots || []).length === 0 ? (
                <div style={{ padding: '24px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '0.86rem' }}>
                  No appointment slots on this date. Use <strong>+ Add Extra Slot</strong> or{' '}
                  <strong>Slot Generation Rules</strong>.
                </div>
              ) : (
                (selectedDayObj?.slots || []).map((slot: any) => (
                  <div key={slot.id} className="vcms-item-row">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong style={{ fontSize: '1.02rem' }}>{slot.startTime}</strong>
                        <span className={`vcms-badge ${String(slot.slotStatus).toLowerCase()}`}>
                          {slot.slotStatus}
                        </span>
                        <span className="vcms-badge info">
                          Booked: {slot.bookedCount} / Cap: {slot.capacity}
                        </span>
                        {slot.isManual && <span className="vcms-badge override">Manual</span>}
                      </div>
                      <div style={{ fontSize: '0.79rem', color: '#64748b', marginTop: 4 }}>
                        {slot.provider?.displayName || slot.location} · {slot.visaType?.nameEn || 'All Types'} ·{' '}
                        {slot.timezone}
                      </div>
                      {slot.notes && (
                        <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: 2 }}>Note: {slot.notes}</div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="vcms-btn sm secondary"
                        onClick={() => {
                          setEditingSlot(slot);
                          setEditSlotForm({
                            slotDate: slot.slotDate || selectedDayObj.date,
                            startTime: slot.startTime,
                            capacity: slot.capacity,
                            slotStatus: slot.slotStatus,
                            notes: slot.notes || '',
                          });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="vcms-btn sm secondary"
                        onClick={async () => {
                          const nextSt = slot.slotStatus === 'BLOCKED' ? 'AVAILABLE' : 'BLOCKED';
                          await vcmsApi.updateSlot(slot.id, { slotStatus: nextSt });
                          await loadCalendarAndSchedules();
                          notify(`Slot ${slot.startTime} marked as ${nextSt}`);
                        }}
                      >
                        {slot.slotStatus === 'BLOCKED' ? 'Unblock' : 'Block'}
                      </button>
                      <button
                        className="vcms-btn sm danger"
                        disabled={slot.bookedCount > 0}
                        title={
                          slot.bookedCount > 0
                            ? 'Booked slot cannot be deleted!'
                            : 'Delete this unbooked slot'
                        }
                        onClick={() => handleDeleteSlot(slot.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          EMBASSY & VISA CENTRE APPOINTMENT PROVIDERS
          ==================================================================== */}
      {subTab === 'PROVIDERS' && (
        <div>
          <div className="vcms-toolbar">
            <div>
              <strong>Embassy & Visa Application Centre Appointment Sources</strong>
              <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                Configure which Visa Types and Purposes each Embassy or Visa Application Centre serves (no hardcoded
                Short/Long Stay restriction).
              </div>
            </div>
            <div className="vcms-pill-switch">
              <button
                type="button"
                className={`vcms-pill-btn ${providerKindFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setProviderKindFilter('ALL')}
              >
                All Providers
              </button>
              <button
                type="button"
                className={`vcms-pill-btn ${providerKindFilter === 'EMBASSY' ? 'active' : ''}`}
                onClick={() => setProviderKindFilter('EMBASSY')}
              >
                Embassy Appointments
              </button>
              <button
                type="button"
                className={`vcms-pill-btn ${providerKindFilter === 'VISA_APPLICATION_CENTRE' ? 'active' : ''}`}
                onClick={() => setProviderKindFilter('VISA_APPLICATION_CENTRE')}
              >
                Visa Centre Appointments
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(430px, 1fr))', gap: 16 }}>
            {providers
              .filter((p) => providerKindFilter === 'ALL' || p.providerType === providerKindFilter)
              .map((prov) => (
                <div key={prov.id} className="vcms-card" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <strong>
                      {prov.country?.flagEmoji} {prov.country?.nameEn} — {prov.displayName}
                    </strong>
                    <span className="vcms-badge active">{prov.status}</span>
                  </div>
                  <div style={{ fontSize: '0.83rem', color: '#475569', marginBottom: 10 }}>
                    <div>
                      <strong>Appointment Source:</strong>{' '}
                      {prov.providerType === 'EMBASSY' ? 'Embassy' : 'Visa Application Centre'}
                    </div>
                    <div>
                      <strong>Local Timezone:</strong> <code>{prov.timezone}</code>
                    </div>
                    <div>
                      <strong>Default Mode:</strong> {prov.defaultManagementMode}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <strong>Served Visa Types:</strong>{' '}
                      {(prov.servedVisaTypes || []).map((svt: any) => (
                        <span key={svt.id} className="vcms-badge info" style={{ marginRight: 5 }}>
                          {svt.visaType?.nameEn}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      className="vcms-btn sm secondary"
                      onClick={() => {
                        setMappingProvider(prov);
                        setMappedVisaTypeIds((prov.servedVisaTypes || []).map((s: any) => s.visaTypeId));
                        setMappedPurposeIds((prov.servedPurposes || []).map((s: any) => s.visaPurposeId));
                      }}
                    >
                      Configure Served Visa Types & Purposes
                    </button>
                    <button
                      className="vcms-btn sm accent"
                      onClick={() => {
                        setSelectedCountryId(prov.countryId);
                        setSelectedProviderId(prov.id);
                        setScheduleForm((prev) => ({
                          ...prev,
                          countryId: prov.countryId,
                          providerId: prov.id,
                          visaTypeId: prov.servedVisaTypes?.[0]?.visaTypeId || prev.visaTypeId,
                        }));
                        setSubTab('SCHEDULES_RULES');
                      }}
                    >
                      Manage Appointments →
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ====================================================================
          MONTHLY SCHEDULES & SLOT GENERATION RULES
          ==================================================================== */}
      {subTab === 'SCHEDULES_RULES' && (
        <div>
          {/* 10. Monthly Workflow 7-Step Banner */}
          <div className="vcms-workflow-bar">
            {[
              { step: 1, label: '1. Select Month & Provider' },
              { step: 2, label: '2. Choose Mode (Auto/Manual)' },
              { step: 3, label: '3. Set Generation Rules' },
              { step: 4, label: '4. Generate Slots (Draft)' },
              { step: 5, label: '5. Review Calendar' },
              { step: 6, label: '6. Publish Schedule' },
              { step: 7, label: '7. Close / Archive' },
            ].map((w) => (
              <div key={w.step} className="vcms-workflow-step done">
                <span className="vcms-workflow-dot">{w.step}</span>
                <span>{w.label}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 18 }}>
            {/* Left: Schedule Configuration & Generation Rules */}
            <div className="vcms-card">
              <h3 style={{ marginTop: 0 }}>Monthly Schedule & Slot Generation Rules</h3>
              <div className="vcms-form-grid">
                <div className="vcms-field">
                  <label>Country *</label>
                  <select
                    className="vcms-select"
                    value={scheduleForm.countryId || selectedCountryId}
                    onChange={(e) => {
                      const cId = e.target.value;
                      setSelectedCountryId(cId);
                      const cProvs = providers.filter((p) => p.countryId === cId);
                      const cObj = countries.find((c) => c.id === cId);
                      setScheduleForm({
                        ...scheduleForm,
                        countryId: cId,
                        providerId: cProvs[0]?.id || '',
                        visaTypeId: cObj?.visaTypes?.[0]?.id || '',
                      });
                    }}
                  >
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.flagEmoji} {c.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="vcms-field">
                  <label>Appointment Provider (Embassy / Visa Centre) *</label>
                  <select
                    className="vcms-select"
                    value={scheduleForm.providerId}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, providerId: e.target.value })}
                  >
                    {countryProviders.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.displayName} ({p.providerType === 'EMBASSY' ? 'Embassy' : 'Visa Centre'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="vcms-field">
                  <label>Visa Type *</label>
                  <select
                    className="vcms-select"
                    value={scheduleForm.visaTypeId}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, visaTypeId: e.target.value })}
                  >
                    {countryVisaTypes.map((vt: any) => (
                      <option key={vt.id} value={vt.id}>
                        {vt.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="vcms-field">
                  <label>Target Month *</label>
                  <input
                    type="month"
                    className="vcms-input"
                    value={scheduleForm.monthKey || monthKey}
                    onChange={(e) => {
                      setMonthKey(e.target.value);
                      setScheduleForm({ ...scheduleForm, monthKey: e.target.value });
                    }}
                  />
                </div>

                <div className="vcms-field" style={{ gridColumn: '1 / -1' }}>
                  <label>Slot Management Mode (Two Distinct Modes — Section 11)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label
                      style={{
                        border:
                          scheduleForm.managementMode === 'AUTOMATIC_GENERATION'
                            ? '2px solid #2563eb'
                            : '1px solid #cbd5e1',
                        borderRadius: 10,
                        padding: 10,
                        cursor: 'pointer',
                        background:
                          scheduleForm.managementMode === 'AUTOMATIC_GENERATION' ? '#eff6ff' : '#ffffff',
                      }}
                    >
                      <input
                        type="radio"
                        checked={scheduleForm.managementMode === 'AUTOMATIC_GENERATION'}
                        onChange={() =>
                          setScheduleForm({ ...scheduleForm, managementMode: 'AUTOMATIC_GENERATION' })
                        }
                      />{' '}
                      <strong>1. Automatic Generation</strong>
                      <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: 3 }}>
                        Generate monthly slots automatically from standard working days & slot times.
                      </div>
                    </label>
                    <label
                      style={{
                        border:
                          scheduleForm.managementMode === 'MANUAL_AVAILABILITY'
                            ? '2px solid #2563eb'
                            : '1px solid #cbd5e1',
                        borderRadius: 10,
                        padding: 10,
                        cursor: 'pointer',
                        background:
                          scheduleForm.managementMode === 'MANUAL_AVAILABILITY' ? '#eff6ff' : '#ffffff',
                      }}
                    >
                      <input
                        type="radio"
                        checked={scheduleForm.managementMode === 'MANUAL_AVAILABILITY'}
                        onChange={() =>
                          setScheduleForm({ ...scheduleForm, managementMode: 'MANUAL_AVAILABILITY' })
                        }
                      />{' '}
                      <strong>2. Manual Availability</strong>
                      <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: 3 }}>
                        Enter only real confirmed dates & times provided by the Embassy / Visa Centre.
                      </div>
                    </label>
                  </div>
                </div>

                {/* Technical Distinction: Appointments per day vs Capacity per slot */}
                <div className="vcms-field">
                  <label>Appointments per Day (Number of Time Slots)</label>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    className="vcms-input"
                    value={scheduleForm.appointmentsPerDay}
                    onChange={(e) => {
                      const count = Math.max(1, Number(e.target.value));
                      const nextTimes = [...scheduleForm.appointmentTimes];
                      while (nextTimes.length < count) nextTimes.push('14:00');
                      setScheduleForm({
                        ...scheduleForm,
                        appointmentsPerDay: count,
                        appointmentTimes: nextTimes.slice(0, count),
                      });
                    }}
                  />
                </div>

                <div className="vcms-field">
                  <label>Capacity per Slot (Applicants per Time Slot)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    className="vcms-input"
                    value={scheduleForm.capacityPerSlot}
                    onChange={(e) =>
                      setScheduleForm({ ...scheduleForm, capacityPerSlot: Math.max(1, Number(e.target.value)) })
                    }
                  />
                </div>

                <div className="vcms-field" style={{ gridColumn: '1 / -1' }}>
                  <label>
                    Appointment Times ({scheduleForm.appointmentsPerDay} slots × {scheduleForm.capacityPerSlot}{' '}
                    capacity = {scheduleForm.appointmentsPerDay * scheduleForm.capacityPerSlot} applicants/day)
                  </label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {scheduleForm.appointmentTimes.map((t, idx) => (
                      <input
                        key={idx}
                        type="text"
                        className="vcms-input"
                        style={{ width: 100 }}
                        value={t}
                        onChange={(e) => {
                          const next = [...scheduleForm.appointmentTimes];
                          next[idx] = e.target.value;
                          setScheduleForm({ ...scheduleForm, appointmentTimes: next });
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Working Days Checkboxes */}
                <div className="vcms-field" style={{ gridColumn: '1 / -1' }}>
                  <label>Working Days</label>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {[
                      { day: 1, label: 'Monday' },
                      { day: 2, label: 'Tuesday' },
                      { day: 3, label: 'Wednesday' },
                      { day: 4, label: 'Thursday' },
                      { day: 5, label: 'Friday' },
                      { day: 6, label: 'Saturday' },
                      { day: 7, label: 'Sunday' },
                    ].map((wd) => {
                      const active = scheduleForm.workingDays.includes(wd.day);
                      return (
                        <label
                          key={wd.day}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: '1px solid #cbd5e1',
                            background: active ? '#0f172a' : '#fff',
                            color: active ? '#fff' : '#334155',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...scheduleForm.workingDays, wd.day]
                                : scheduleForm.workingDays.filter((d) => d !== wd.day);
                              setScheduleForm({ ...scheduleForm, workingDays: next });
                            }}
                          />
                          {wd.label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* 3.5 Standalone Exclude Last Day of Month Card */}
                <div
                  style={{
                    gridColumn: '1 / -1',
                    background: '#0f172a',
                    color: '#fff',
                    padding: '14px 16px',
                    borderRadius: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>Exclude Last Day of Month</strong>
                    <span className="vcms-badge active">
                      {scheduleForm.excludeLastDayOfMonth ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.79rem', color: '#94a3b8', margin: '4px 0 10px 0' }}>
                    Ayın son təqvim günündə avtomatik appointment yaradılmayacaq (həftəiçi olsa belə).
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input
                      type="checkbox"
                      checked={scheduleForm.excludeLastDayOfMonth}
                      onChange={(e) =>
                        setScheduleForm({ ...scheduleForm, excludeLastDayOfMonth: e.target.checked })
                      }
                    />
                    Do not generate appointments on the last calendar day.
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                <button className="vcms-btn secondary" onClick={() => handleSaveAndPreviewSchedule(false)}>
                  1. Preview Draft Calendar (Dry-Run)
                </button>
                <button className="vcms-btn accent" onClick={() => handleSaveAndPreviewSchedule(true)}>
                  2. Generate Appointment Slots (as DRAFT)
                </button>
              </div>
            </div>

            {/* Right: Draft Preview Calendar, 6 Mandatory Metrics & Publish */}
            <div>
              {draftPreview && (
                <div className="vcms-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0 }}>{draftPreview.monthKey} — Slot Generation Result</h3>
                    <span className="vcms-badge draft">Draft Preview</span>
                  </div>

                  {/* 6 Mandatory Result Metrics (Batch 3 Image 1) */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 10,
                      background: '#f8fafc',
                      padding: 14,
                      borderRadius: 12,
                      marginBottom: 14,
                      fontSize: '0.84rem',
                    }}
                  >
                    <div>
                      <strong>Total working days:</strong>{' '}
                      <span style={{ color: '#16a34a', fontWeight: 800 }}>{draftPreview.totalWorkingDays}</span>
                    </div>
                    <div>
                      <strong>Total generated slots:</strong>{' '}
                      <span style={{ color: '#2563eb', fontWeight: 800 }}>{draftPreview.totalGeneratedSlots}</span>
                    </div>
                    <div>
                      <strong>Excluded dates:</strong> {draftPreview.excludedDatesCount}
                    </div>
                    <div>
                      <strong>Potential conflicts:</strong> {draftPreview.potentialConflicts?.length || 0}
                    </div>
                    <div>
                      <strong>First appointment date:</strong> {draftPreview.firstAppointmentDate || '—'}
                    </div>
                    <div>
                      <strong>Last appointment date:</strong> {draftPreview.lastAppointmentDate || '—'}
                    </div>
                  </div>

                  {activeScheduleId && (
                    <button
                      className="vcms-btn success"
                      style={{ width: '100%' }}
                      onClick={() => handlePublishSchedule(activeScheduleId)}
                    >
                      ✓ Confirm & Publish Schedule to Customers
                    </button>
                  )}
                </div>
              )}

              {/* Existing Schedules Lifecycle List */}
              <div className="vcms-card">
                <h3 style={{ marginTop: 0 }}>Monthly Schedules ({monthKey})</h3>
                {schedules.length === 0 ? (
                  <div style={{ fontSize: '0.84rem', color: '#94a3b8' }}>
                    No monthly schedules created for {monthKey} yet.
                  </div>
                ) : (
                  schedules.map((sch) => (
                    <div
                      key={sch.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 0',
                        borderBottom: '1px solid #f1f5f9',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <strong>{sch.provider?.displayName}</strong>
                          <span className="vcms-badge info">{sch.visaType?.nameEn}</span>
                          <span className={`vcms-badge ${String(sch.status).toLowerCase()}`}>{sch.status}</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 3 }}>
                          {sch.monthKey} · {sch._count?.slots || 0} slots · Mode: {sch.managementMode}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {sch.status === 'DRAFT' && (
                          <button
                            className="vcms-btn sm success"
                            onClick={() => handlePublishSchedule(sch.id)}
                          >
                            Publish
                          </button>
                        )}
                        {sch.status === 'PUBLISHED' && (
                          <button
                            className="vcms-btn sm secondary"
                            onClick={async () => {
                              await vcmsApi.updateScheduleStatus(sch.id, 'CLOSED');
                              await loadCalendarAndSchedules();
                              notify('Schedule closed');
                            }}
                          >
                            Close
                          </button>
                        )}
                        {sch.status === 'CLOSED' && (
                          <button
                            className="vcms-btn sm secondary"
                            onClick={async () => {
                              await vcmsApi.updateScheduleStatus(sch.id, 'ARCHIVED');
                              await loadCalendarAndSchedules();
                              notify('Schedule archived');
                            }}
                          >
                            Archive
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          6. EXCLUDED DATES (PUBLIC HOLIDAYS & CLOSURES)
          ==================================================================== */}
      {subTab === 'EXCLUDED_DATES' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 18 }}>
          <div className="vcms-card">
            <h3 style={{ marginTop: 0 }}>+ Add Excluded Date / Public Holiday</h3>
            <form onSubmit={handleAddExcludedDate}>
              <div className="vcms-form-grid">
                <div className="vcms-field">
                  <label>Country (or All Countries)</label>
                  <select
                    className="vcms-select"
                    value={exceptionForm.countryId}
                    onChange={(e) => setExceptionForm({ ...exceptionForm, countryId: e.target.value })}
                  >
                    <option value="">All Countries (Global Holiday)</option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.flagEmoji} {c.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="vcms-field">
                  <label>Excluded Date *</label>
                  <input
                    type="date"
                    className="vcms-input"
                    required
                    value={exceptionForm.excludedDate}
                    onChange={(e) => setExceptionForm({ ...exceptionForm, excludedDate: e.target.value })}
                  />
                </div>
                <div className="vcms-field">
                  <label>Reason (5 Standard Categories) *</label>
                  <select
                    className="vcms-select"
                    value={exceptionForm.reason}
                    onChange={(e) => setExceptionForm({ ...exceptionForm, reason: e.target.value })}
                  >
                    {EXCLUDED_DATE_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="vcms-field">
                  <label>Note / Holiday Name</label>
                  <input
                    className="vcms-input"
                    placeholder="e.g. Christmas Eve, Embassy National Holiday"
                    value={exceptionForm.note}
                    onChange={(e) => setExceptionForm({ ...exceptionForm, note: e.target.value })}
                  />
                </div>
              </div>
              <button type="submit" className="vcms-btn accent">
                Add Excluded Date
              </button>
            </form>
          </div>

          <div className="vcms-card">
            <h3 style={{ marginTop: 0 }}>Excluded Dates for {monthKey}</h3>
            {exceptions.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No excluded dates configured for {monthKey}.</div>
            ) : (
              exceptions.map((ex) => (
                <div key={ex.id} className="vcms-item-row">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong>{ex.excludedDate}</strong>
                      <span className="vcms-badge blocked">{ex.reason}</span>
                      {ex.country && (
                        <span className="vcms-badge info">
                          {ex.country.flagEmoji} {ex.country.code}
                        </span>
                      )}
                    </div>
                    {ex.note && <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 3 }}>{ex.note}</div>}
                  </div>
                  <button
                    className="vcms-btn sm danger"
                    onClick={async () => {
                      await vcmsApi.deleteExcludedDate(ex.id);
                      await loadCalendarAndSchedules();
                      notify('Excluded date removed');
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
          7. MANUAL SLOT MANAGEMENT (9 MANDATORY FIELDS)
          ==================================================================== */}
      {subTab === 'MANUAL_SLOTS' && (
        <div className="vcms-card">
          <h3 style={{ marginTop: 0 }}>Manual Slot Management (+ Add Extra Slot / Real Confirmed Availability)</h3>
          <p style={{ fontSize: '0.83rem', color: '#64748b' }}>
            Add extra appointment times outside standard rules (e.g. Friday 15:00) or enter manually confirmed
            Embassy/Visa Centre slots. Duplicate slots for the same provider, date, and time are automatically blocked.
          </p>

          <form onSubmit={handleCreateManualSlot}>
            <div className="vcms-form-grid">
              <div className="vcms-field">
                <label>Country *</label>
                <select
                  className="vcms-select"
                  required
                  value={manualForm.countryId || selectedCountryId}
                  onChange={(e) => {
                    const cId = e.target.value;
                    setSelectedCountryId(cId);
                    const cProvs = providers.filter((p) => p.countryId === cId);
                    const cObj = countries.find((c) => c.id === cId);
                    setManualForm({
                      ...manualForm,
                      countryId: cId,
                      providerId: cProvs[0]?.id || '',
                      visaTypeId: cObj?.visaTypes?.[0]?.id || '',
                    });
                  }}
                >
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.flagEmoji} {c.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="vcms-field">
                <label>Provider (Embassy / Visa Centre) *</label>
                <select
                  className="vcms-select"
                  required
                  value={manualForm.providerId}
                  onChange={(e) => setManualForm({ ...manualForm, providerId: e.target.value })}
                >
                  {countryProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="vcms-field">
                <label>Visa Type *</label>
                <select
                  className="vcms-select"
                  required
                  value={manualForm.visaTypeId}
                  onChange={(e) => setManualForm({ ...manualForm, visaTypeId: e.target.value })}
                >
                  {countryVisaTypes.map((vt: any) => (
                    <option key={vt.id} value={vt.id}>
                      {vt.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="vcms-field">
                <label>Visa Purpose (Optional)</label>
                <select
                  className="vcms-select"
                  value={manualForm.visaPurposeId}
                  onChange={(e) => setManualForm({ ...manualForm, visaPurposeId: e.target.value })}
                >
                  <option value="">All Purposes under Visa Type</option>
                  {countryPurposes.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="vcms-field">
                <label>Date *</label>
                <input
                  type="date"
                  className="vcms-input"
                  required
                  value={manualForm.slotDate}
                  onChange={(e) => setManualForm({ ...manualForm, slotDate: e.target.value })}
                />
              </div>

              <div className="vcms-field">
                <label>Time (Local Provider Timezone) *</label>
                <input
                  type="text"
                  className="vcms-input"
                  required
                  placeholder="15:00"
                  value={manualForm.startTime}
                  onChange={(e) => setManualForm({ ...manualForm, startTime: e.target.value })}
                />
              </div>

              <div className="vcms-field">
                <label>Capacity (Applicants accepted at this time) *</label>
                <input
                  type="number"
                  min={1}
                  className="vcms-input"
                  required
                  value={manualForm.capacity}
                  onChange={(e) => setManualForm({ ...manualForm, capacity: Math.max(1, Number(e.target.value)) })}
                />
              </div>

              <div className="vcms-field">
                <label>Status *</label>
                <select
                  className="vcms-select"
                  value={manualForm.slotStatus}
                  onChange={(e) => setManualForm({ ...manualForm, slotStatus: e.target.value })}
                >
                  <option value="AVAILABLE">Available</option>
                  <option value="BLOCKED">Blocked</option>
                </select>
              </div>

              <div className="vcms-field" style={{ gridColumn: '1 / -1' }}>
                <label>Notes</label>
                <input
                  className="vcms-input"
                  placeholder="e.g. Extra Friday afternoon slot granted by French Consulate"
                  value={manualForm.notes}
                  onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                />
              </div>
            </div>

            <button type="submit" className="vcms-btn accent">
              + Create Manual Appointment Slot
            </button>
          </form>
        </div>
      )}

      {/* ====================================================================
          8. BOOKINGS MANAGEMENT (AP001 + 6 STATUSES + RESCHEDULE NOTIFICATION)
          ==================================================================== */}
      {subTab === 'BOOKINGS' && (
        <div className="vcms-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="vcms-table">
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Customer</th>
                <th>Country & Provider</th>
                <th>Date & Time</th>
                <th>Group Size</th>
                <th>Status</th>
                <th>Actions (Status & Reschedule)</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>
                    <span className="vcms-badge code">{b.bookingCode || 'AP---'}</span>
                  </td>
                  <td>
                    <strong>{b.user?.fullName || 'Applicant'}</strong>
                    <div style={{ fontSize: '0.77rem', color: '#64748b' }}>
                      {b.user?.email} · {b.dossier?.dossierNumber || b.groupBatch?.code || ''}
                    </div>
                  </td>
                  <td>
                    <strong>
                      {b.timeSlot?.country?.nameEn || b.dossier?.country?.nameEn || 'Destination'}
                    </strong>
                    <div style={{ fontSize: '0.77rem', color: '#64748b' }}>
                      {b.timeSlot?.provider?.displayName || b.location}
                    </div>
                  </td>
                  <td>
                    <strong>
                      {b.timeSlot?.slotDate ||
                        (b.timeSlot?.date ? new Date(b.timeSlot.date).toISOString().slice(0, 10) : '—')}{' '}
                      · {b.timeSlot?.startTime}
                    </strong>
                    <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                      Timezone: {b.timeSlot?.timezone || 'Asia/Baku'}
                    </div>
                  </td>
                  <td>{b.groupSize || 1} Pax</td>
                  <td>
                    <span className={`vcms-badge ${String(b.status).toLowerCase()}`}>{b.status}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <select
                        className="vcms-select"
                        style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                        value={b.status}
                        onChange={async (e) => {
                          await vcmsApi.updateBookingStatus(b.id, { status: e.target.value });
                          await loadCalendarAndSchedules();
                          notify(`Booking ${b.bookingCode} status updated to ${e.target.value}`);
                        }}
                      >
                        <option value="PENDING">Pending</option>
                        <option value="CONFIRMED">Confirmed</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="NO_SHOW">No-show</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>

                      <button
                        className="vcms-btn sm secondary"
                        onClick={() => {
                          setRescheduleTargetBooking(b);
                          setRescheduleNewSlotId('');
                          setRescheduleNotes('');
                        }}
                      >
                        Reschedule & Notify
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Provider -> Visa Types & Purposes Dynamic Mapping */}
      {mappingProvider && (
        <div className="vcms-modal-backdrop" onClick={() => setMappingProvider(null)}>
          <div className="vcms-modal" onClick={(e) => e.stopPropagation()}>
            <div className="vcms-modal-header">
              <h2>Configure Served Visa Types & Purposes — {mappingProvider.displayName}</h2>
              <button className="vcms-btn sm secondary" onClick={() => setMappingProvider(null)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveProviderMappings}>
              <p style={{ fontSize: '0.84rem', color: '#475569' }}>
                Select which Visa Types (and optionally specific Purposes) this provider accepts appointments for:
              </p>
              <div style={{ marginBottom: 14 }}>
                {(countries.find((c) => c.id === mappingProvider.countryId)?.visaTypes || []).map((vt: any) => (
                  <div
                    key={vt.id}
                    style={{
                      padding: 12,
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      marginBottom: 10,
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                      <input
                        type="checkbox"
                        checked={mappedVisaTypeIds.includes(vt.id)}
                        onChange={(e) => {
                          if (e.target.checked) setMappedVisaTypeIds([...mappedVisaTypeIds, vt.id]);
                          else setMappedVisaTypeIds(mappedVisaTypeIds.filter((id) => id !== vt.id));
                        }}
                      />
                      {vt.nameEn} ({vt.code})
                    </label>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, paddingLeft: 24 }}>
                      {(vt.purposes || []).map((p: any) => (
                        <label key={p.id} style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <input
                            type="checkbox"
                            checked={mappedPurposeIds.includes(p.id)}
                            onChange={(e) => {
                              if (e.target.checked) setMappedPurposeIds([...mappedPurposeIds, p.id]);
                              else setMappedPurposeIds(mappedPurposeIds.filter((id) => id !== p.id));
                            }}
                          />
                          {p.nameEn}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="vcms-btn secondary" onClick={() => setMappingProvider(null)}>
                  Cancel
                </button>
                <button type="submit" className="vcms-btn accent">
                  Save Mappings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Slot (Date/Time/Capacity/Status — sends Customer Notification if booked!) */}
      {editingSlot && (
        <div className="vcms-modal-backdrop" onClick={() => setEditingSlot(null)}>
          <div className="vcms-modal" onClick={(e) => e.stopPropagation()}>
            <div className="vcms-modal-header">
              <h2>Edit Appointment Slot ({editingSlot.slotDate} · {editingSlot.startTime})</h2>
              <button className="vcms-btn sm secondary" onClick={() => setEditingSlot(null)}>
                ✕
              </button>
            </div>
            {editingSlot.bookedCount > 0 && (
              <div
                style={{
                  background: '#fef3c7',
                  border: '1px solid #fcd34d',
                  color: '#92400e',
                  padding: '10px 12px',
                  borderRadius: 10,
                  fontSize: '0.82rem',
                  marginBottom: 14,
                }}
              >
                <strong>Active Booking Alert:</strong> This slot has {editingSlot.bookedCount} active customer
                booking(s). Changing the Date or Time will automatically send an instant notification to the customer!
              </div>
            )}
            <form onSubmit={handleUpdateSlot}>
              <div className="vcms-form-grid">
                <div className="vcms-field">
                  <label>Date *</label>
                  <input
                    type="date"
                    className="vcms-input"
                    required
                    value={editSlotForm.slotDate}
                    onChange={(e) => setEditSlotForm({ ...editSlotForm, slotDate: e.target.value })}
                  />
                </div>
                <div className="vcms-field">
                  <label>Time *</label>
                  <input
                    type="text"
                    className="vcms-input"
                    required
                    value={editSlotForm.startTime}
                    onChange={(e) => setEditSlotForm({ ...editSlotForm, startTime: e.target.value })}
                  />
                </div>
                <div className="vcms-field">
                  <label>Capacity *</label>
                  <input
                    type="number"
                    min={Math.max(1, editingSlot.bookedCount)}
                    className="vcms-input"
                    required
                    value={editSlotForm.capacity}
                    onChange={(e) => setEditSlotForm({ ...editSlotForm, capacity: Number(e.target.value) })}
                  />
                </div>
                <div className="vcms-field">
                  <label>Status</label>
                  <select
                    className="vcms-select"
                    value={editSlotForm.slotStatus}
                    onChange={(e) => setEditSlotForm({ ...editSlotForm, slotStatus: e.target.value })}
                  >
                    <option value="AVAILABLE">Available</option>
                    <option value="BLOCKED">Blocked</option>
                    <option value="DRAFT">Draft</option>
                  </select>
                </div>
                <div className="vcms-field" style={{ gridColumn: '1 / -1' }}>
                  <label>Notes</label>
                  <input
                    className="vcms-input"
                    value={editSlotForm.notes}
                    onChange={(e) => setEditSlotForm({ ...editSlotForm, notes: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="vcms-btn secondary" onClick={() => setEditingSlot(null)}>
                  Cancel
                </button>
                <button type="submit" className="vcms-btn accent">
                  Save Slot Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reschedule Customer Booking & Send Notification */}
      {rescheduleTargetBooking && (
        <div className="vcms-modal-backdrop" onClick={() => setRescheduleTargetBooking(null)}>
          <div className="vcms-modal" onClick={(e) => e.stopPropagation()}>
            <div className="vcms-modal-header">
              <h2>
                Reschedule Booking {rescheduleTargetBooking.bookingCode} ({rescheduleTargetBooking.user?.fullName})
              </h2>
              <button className="vcms-btn sm secondary" onClick={() => setRescheduleTargetBooking(null)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleAdminRescheduleBooking}>
              <div className="vcms-field" style={{ marginBottom: 12 }}>
                <label>Select New Available Slot *</label>
                <select
                  className="vcms-select"
                  required
                  value={rescheduleNewSlotId}
                  onChange={(e) => setRescheduleNewSlotId(e.target.value)}
                >
                  <option value="">-- Choose Available Slot --</option>
                  {(calendarData?.days || [])
                    .flatMap((d: any) => d.slots || [])
                    .filter(
                      (s: any) =>
                        s.id !== rescheduleTargetBooking.timeSlotId &&
                        s.slotStatus === 'AVAILABLE' &&
                        s.bookedCount < s.capacity
                    )
                    .map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.slotDate} · {s.startTime} — {s.provider?.displayName || s.location} (Cap:{' '}
                        {s.capacity - s.bookedCount} free)
                      </option>
                    ))}
                </select>
              </div>
              <div className="vcms-field" style={{ marginBottom: 12 }}>
                <label>Consular Reason / Note to Customer</label>
                <input
                  className="vcms-input"
                  placeholder="e.g. Consular section schedule adjustment"
                  value={rescheduleNotes}
                  onChange={(e) => setRescheduleNotes(e.target.value)}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={rescheduleSendNotif}
                  onChange={(e) => setRescheduleSendNotif(e.target.checked)}
                />
                Send instant notification (In-App + Email) to customer about date/time change
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="vcms-btn secondary" onClick={() => setRescheduleTargetBooking(null)}>
                  Cancel
                </button>
                <button type="submit" className="vcms-btn accent">
                  Confirm Reschedule & Notify Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
