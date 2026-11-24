const prisma = require('../../../config/db');
const { nextBookingCode, buildUniqueSlotKey } = require('./codeGenerator.service');

async function recordAppointmentAudit(actorId, action, details, db = prisma) {
  try {
    await db.auditLog.create({
      data: {
        userId: actorId || null,
        action,
        details: details || {},
      },
    });
  } catch (_) {}
}

function getMonthDateStrings(monthKey) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthKey || '').trim());
  if (!match) {
    const err = new Error('Invalid monthKey format. Expected YYYY-MM (e.g. 2026-12).');
    err.statusCode = 400;
    throw err;
  }
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10); // 1..12
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const dates = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const utcDate = new Date(Date.UTC(year, month - 1, d, 9, 0, 0));
    const jsDay = utcDate.getUTCDay(); // 0=Sun..6=Sat
    const isoDayOfWeek = jsDay === 0 ? 7 : jsDay; // 1=Mon..7=Sun
    dates.push({
      dateStr,
      dayOfMonth: d,
      isoDayOfWeek,
      isLastDayOfMonth: d === daysInMonth,
      utcDate,
    });
  }

  return {
    year,
    month,
    daysInMonth,
    startDate: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)),
    endDate: new Date(Date.UTC(year, month - 1, daysInMonth, 23, 59, 59)),
    dates,
  };
}

// ============================================================================
// 1. APPOINTMENT PROVIDERS & DYNAMIC VISA TYPE / PURPOSE MAPPING
// ============================================================================

async function listAppointmentProviders({ countryId, providerType, applicantCountryCode, status } = {}) {
  const where = {};
  if (countryId && countryId !== 'ALL') where.countryId = countryId;
  if (providerType && providerType !== 'ALL') where.providerType = providerType;
  if (applicantCountryCode && applicantCountryCode !== 'ALL') {
    where.applicantCountryCode = String(applicantCountryCode).toUpperCase();
  }
  if (status && status !== 'ALL') where.status = status;

  return prisma.appointmentProvider.findMany({
    where,
    orderBy: [{ country: { displayOrder: 'asc' } }, { providerType: 'asc' }],
    include: {
      country: { select: { id: true, code: true, nameEn: true, nameAz: true, flagEmoji: true } },
      embassy: true,
      visaApplicationCentre: true,
      servedVisaTypes: {
        where: { isActive: true },
        include: { visaType: true },
      },
      servedPurposes: {
        where: { isActive: true },
        include: { visaPurpose: true },
      },
      _count: {
        select: { schedules: true, slots: true },
      },
    },
  });
}

async function saveAppointmentProvider(payload, actorId) {
  return await prisma.$transaction(async (tx) => {
    const data = {
      countryId: payload.countryId,
      providerType: payload.providerType || 'VISA_APPLICATION_CENTRE',
      embassyId: payload.embassyId || null,
      visaApplicationCentreId: payload.visaApplicationCentreId || null,
      displayName: String(payload.displayName || '').trim(),
      applicantCountryCode: String(payload.applicantCountryCode || 'AZ').trim().toUpperCase(),
      timezone: payload.timezone || 'Asia/Baku',
      defaultManagementMode: payload.defaultManagementMode || 'AUTOMATIC_GENERATION',
      status: payload.status || 'ACTIVE',
    };

    const provider = payload.id
      ? await tx.appointmentProvider.update({ where: { id: payload.id }, data })
      : await tx.appointmentProvider.create({ data });

    if (Array.isArray(payload.visaTypeIds)) {
      await tx.providerVisaType.deleteMany({ where: { providerId: provider.id } });
      for (const vtId of payload.visaTypeIds) {
        await tx.providerVisaType.create({
          data: {
            providerId: provider.id,
            visaTypeId: vtId,
            isDefault: true,
            isActive: true,
          },
        });
      }
    }

    if (Array.isArray(payload.visaPurposeIds)) {
      await tx.providerVisaPurpose.deleteMany({ where: { providerId: provider.id } });
      for (const vpId of payload.visaPurposeIds) {
        await tx.providerVisaPurpose.create({
          data: {
            providerId: provider.id,
            visaPurposeId: vpId,
            isActive: true,
          },
        });
      }
    }

    await recordAppointmentAudit(actorId, 'APPOINTMENT_PROVIDER_SAVED', { providerId: provider.id }, tx);
    return tx.appointmentProvider.findUnique({
      where: { id: provider.id },
      include: {
        country: true,
        embassy: true,
        visaApplicationCentre: true,
        servedVisaTypes: { include: { visaType: true } },
        servedPurposes: { include: { visaPurpose: true } },
      },
    });
  });
}

async function updateProviderVisaMappings(providerId, { visaTypeIds = [], visaPurposeIds = [] }, actorId) {
  return await prisma.$transaction(async (tx) => {
    await tx.providerVisaType.deleteMany({ where: { providerId } });
    for (const vtId of visaTypeIds) {
      await tx.providerVisaType.create({
        data: { providerId, visaTypeId: vtId, isDefault: true, isActive: true },
      });
    }

    await tx.providerVisaPurpose.deleteMany({ where: { providerId } });
    for (const vpId of visaPurposeIds) {
      await tx.providerVisaPurpose.create({
        data: { providerId, visaPurposeId: vpId, isActive: true },
      });
    }

    await recordAppointmentAudit(
      actorId,
      'APPOINTMENT_PROVIDER_MAPPINGS_UPDATED',
      { providerId, visaTypeIds, visaPurposeIds },
      tx
    );

    return tx.appointmentProvider.findUnique({
      where: { id: providerId },
      include: {
        servedVisaTypes: { include: { visaType: true } },
        servedPurposes: { include: { visaPurpose: true } },
      },
    });
  });
}

// ============================================================================
// 2. MONTHLY SCHEDULES & SLOT GENERATION RULES (DRAFT -> PUBLISHED -> CLOSED -> ARCHIVED)
// ============================================================================

async function listAppointmentSchedules({ countryId, providerId, visaTypeId, monthKey, status } = {}) {
  const where = {};
  if (countryId && countryId !== 'ALL') where.countryId = countryId;
  if (providerId && providerId !== 'ALL') where.providerId = providerId;
  if (visaTypeId && visaTypeId !== 'ALL') where.visaTypeId = visaTypeId;
  if (monthKey && monthKey !== 'ALL') where.monthKey = monthKey;
  if (status && status !== 'ALL') where.status = status;

  return prisma.appointmentSchedule.findMany({
    where,
    orderBy: [{ monthKey: 'desc' }, { createdAt: 'desc' }],
    include: {
      country: { select: { id: true, code: true, nameEn: true, nameAz: true, flagEmoji: true } },
      provider: { include: { embassy: true, visaApplicationCentre: true } },
      visaType: true,
      visaPurpose: true,
      generationRule: true,
      exceptions: { orderBy: { excludedDate: 'asc' } },
      _count: { select: { slots: true } },
    },
  });
}

async function createOrUpdateMonthlySchedule(payload, actorId) {
  const { startDate, endDate } = getMonthDateStrings(payload.monthKey);
  const provider = await prisma.appointmentProvider.findUnique({ where: { id: payload.providerId } });
  if (!provider) {
    const err = new Error('Appointment Provider not found');
    err.statusCode = 404;
    throw err;
  }

  return await prisma.$transaction(async (tx) => {
    let schedule = payload.id
      ? await tx.appointmentSchedule.findUnique({ where: { id: payload.id } })
      : await tx.appointmentSchedule.findFirst({
          where: {
            countryId: payload.countryId || provider.countryId,
            providerId: provider.id,
            visaTypeId: payload.visaTypeId,
            visaPurposeId: payload.visaPurposeId || null,
            monthKey: payload.monthKey,
          },
        });

    if (schedule) {
      schedule = await tx.appointmentSchedule.update({
        where: { id: schedule.id },
        data: {
          managementMode: payload.managementMode || schedule.managementMode,
          timezone: payload.timezone || provider.timezone || 'Asia/Baku',
          notes: payload.notes !== undefined ? payload.notes : schedule.notes,
        },
      });
    } else {
      schedule = await tx.appointmentSchedule.create({
        data: {
          countryId: payload.countryId || provider.countryId,
          providerId: provider.id,
          visaTypeId: payload.visaTypeId,
          visaPurposeId: payload.visaPurposeId || null,
          monthKey: payload.monthKey,
          startDate,
          endDate,
          timezone: payload.timezone || provider.timezone || 'Asia/Baku',
          managementMode: payload.managementMode || provider.defaultManagementMode || 'AUTOMATIC_GENERATION',
          status: 'DRAFT',
          createdByUserId: actorId || null,
          notes: payload.notes || null,
        },
      });
    }

    // Save or update SlotGenerationRule (separating appointmentsPerDay and capacityPerSlot!)
    const ruleInput = payload.rule || payload;
    const appointmentTimes = Array.isArray(ruleInput.appointmentTimesJson || ruleInput.appointmentTimes)
      ? ruleInput.appointmentTimesJson || ruleInput.appointmentTimes
      : ['09:00', '11:00'];
    const appointmentsPerDay =
      ruleInput.appointmentsPerDay !== undefined ? Number(ruleInput.appointmentsPerDay) : appointmentTimes.length;
    const capacityPerSlot = ruleInput.capacityPerSlot !== undefined ? Math.max(1, Number(ruleInput.capacityPerSlot)) : 1;
    const workingDays = Array.isArray(ruleInput.workingDaysJson || ruleInput.workingDays)
      ? (ruleInput.workingDaysJson || ruleInput.workingDays).map(Number)
      : [1, 2, 3, 4, 5];

    await tx.slotGenerationRule.upsert({
      where: { scheduleId: schedule.id },
      update: {
        appointmentsPerDay,
        appointmentTimesJson: appointmentTimes.slice(0, Math.max(1, appointmentsPerDay)),
        capacityPerSlot,
        workingDaysJson: workingDays,
        excludeWeekends: ruleInput.excludeWeekends !== undefined ? Boolean(ruleInput.excludeWeekends) : true,
        excludeLastDayOfMonth:
          ruleInput.excludeLastDayOfMonth !== undefined ? Boolean(ruleInput.excludeLastDayOfMonth) : true,
        excludePublicHolidays:
          ruleInput.excludePublicHolidays !== undefined ? Boolean(ruleInput.excludePublicHolidays) : true,
      },
      create: {
        scheduleId: schedule.id,
        appointmentsPerDay,
        appointmentTimesJson: appointmentTimes.slice(0, Math.max(1, appointmentsPerDay)),
        capacityPerSlot,
        workingDaysJson: workingDays,
        excludeWeekends: ruleInput.excludeWeekends !== undefined ? Boolean(ruleInput.excludeWeekends) : true,
        excludeLastDayOfMonth:
          ruleInput.excludeLastDayOfMonth !== undefined ? Boolean(ruleInput.excludeLastDayOfMonth) : true,
        excludePublicHolidays:
          ruleInput.excludePublicHolidays !== undefined ? Boolean(ruleInput.excludePublicHolidays) : true,
      },
    });

    await recordAppointmentAudit(
      actorId,
      'APPOINTMENT_SCHEDULE_CONFIGURED',
      { scheduleId: schedule.id, monthKey: schedule.monthKey, mode: schedule.managementMode },
      tx
    );

    return tx.appointmentSchedule.findUnique({
      where: { id: schedule.id },
      include: {
        country: true,
        provider: true,
        visaType: true,
        visaPurpose: true,
        generationRule: true,
        exceptions: true,
      },
    });
  });
}

async function computeScheduleGenerationPlan(scheduleId, overrideRule = null) {
  const schedule = await prisma.appointmentSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      country: true,
      provider: true,
      visaType: true,
      visaPurpose: true,
      generationRule: true,
    },
  });
  if (!schedule) {
    const err = new Error('Appointment Schedule not found');
    err.statusCode = 404;
    throw err;
  }

  const rule = overrideRule || schedule.generationRule || {
    appointmentsPerDay: 2,
    appointmentTimesJson: ['09:00', '11:00'],
    capacityPerSlot: 1,
    workingDaysJson: [1, 2, 3, 4, 5],
    excludeWeekends: true,
    excludeLastDayOfMonth: true,
    excludePublicHolidays: true,
  };

  const times = Array.isArray(rule.appointmentTimesJson) ? rule.appointmentTimesJson : ['09:00', '11:00'];
  const workingDaysSet = new Set(
    (Array.isArray(rule.workingDaysJson) ? rule.workingDaysJson : [1, 2, 3, 4, 5]).map(Number)
  );
  const excludeWeekends = rule.excludeWeekends !== false;
  const excludeLastDayOfMonth = rule.excludeLastDayOfMonth !== false;
  const excludePublicHolidays = rule.excludePublicHolidays !== false;
  const capacityPerSlot = Math.max(1, Number(rule.capacityPerSlot || 1));

  // Load all matching ScheduleExceptions for this month (Global + Country + Provider + Schedule)
  const exceptions = await prisma.scheduleException.findMany({
    where: {
      monthKey: schedule.monthKey,
      OR: [
        { scheduleId: schedule.id },
        { providerId: schedule.providerId },
        { countryId: schedule.countryId, providerId: null },
        { countryId: null, providerId: null },
      ],
    },
  });
  const exceptionMap = new Map();
  for (const ex of exceptions) {
    exceptionMap.set(ex.excludedDate, ex);
  }

  // Load existing slots for this provider + visaType + monthKey to detect conflicts/duplicates
  const existingSlots = await prisma.timeSlot.findMany({
    where: {
      providerId: schedule.providerId,
      visaTypeId: schedule.visaTypeId,
      monthKey: schedule.monthKey,
    },
  });
  const existingByKey = new Map();
  for (const s of existingSlots) {
    if (s.uniqueSlotKey) existingByKey.set(s.uniqueSlotKey, s);
    existingByKey.set(`${s.slotDate}_${s.startTime}`, s);
  }

  const { dates } = getMonthDateStrings(schedule.monthKey);
  const calendarDays = [];
  const excludedDates = [];
  const slotsToGenerate = [];
  const potentialConflicts = [];

  for (const d of dates) {
    const isWeekend = d.isoDayOfWeek === 6 || d.isoDayOfWeek === 7;
    const isWorkingDay = workingDaysSet.has(d.isoDayOfWeek) && !(excludeWeekends && isWeekend);
    const ex = exceptionMap.get(d.dateStr);

    if (!isWorkingDay) {
      calendarDays.push({
        date: d.dateStr,
        dayOfMonth: d.dayOfMonth,
        isoDayOfWeek: d.isoDayOfWeek,
        status: 'WEEKEND',
        reason: isWeekend ? 'WEEKEND' : 'NON_WORKING_DAY',
        slotsCount: 0,
        times: [],
      });
      continue;
    }

    // Standalone Rule 3.5: Exclude Last Day of Month even if it falls on a weekday!
    if (excludeLastDayOfMonth && d.isLastDayOfMonth) {
      const reasonObj = {
        date: d.dateStr,
        reason: 'LAST_DAY_OF_MONTH',
        note: 'Do not generate appointments on the last calendar day of the month.',
      };
      excludedDates.push(reasonObj);
      calendarDays.push({
        date: d.dateStr,
        dayOfMonth: d.dayOfMonth,
        isoDayOfWeek: d.isoDayOfWeek,
        status: 'EXCLUDED',
        reason: 'LAST_DAY_OF_MONTH',
        note: reasonObj.note,
        slotsCount: 0,
        times: [],
      });

      // Check if an existing booked slot conflicts with this exclusion
      const bookedOnDay = existingSlots.filter((s) => s.slotDate === d.dateStr && s.bookedCount > 0);
      if (bookedOnDay.length > 0) {
        potentialConflicts.push({
          date: d.dateStr,
          type: 'BOOKED_SLOT_ON_EXCLUDED_DATE',
          message: `${bookedOnDay.length} booked slot(s) already exist on last day ${d.dateStr}`,
        });
      }
      continue;
    }

    // Check ScheduleException / Public Holidays
    if (ex && (excludePublicHolidays || !ex.isPublicHoliday)) {
      const reasonObj = {
        date: d.dateStr,
        reason: ex.reason,
        note: ex.note || ex.reason,
      };
      excludedDates.push(reasonObj);
      calendarDays.push({
        date: d.dateStr,
        dayOfMonth: d.dayOfMonth,
        isoDayOfWeek: d.isoDayOfWeek,
        status: 'EXCLUDED',
        reason: ex.reason,
        note: ex.note,
        slotsCount: 0,
        times: [],
      });

      const bookedOnDay = existingSlots.filter((s) => s.slotDate === d.dateStr && s.bookedCount > 0);
      if (bookedOnDay.length > 0) {
        potentialConflicts.push({
          date: d.dateStr,
          type: 'BOOKED_SLOT_ON_HOLIDAY',
          message: `${bookedOnDay.length} booked slot(s) exist on excluded date ${d.dateStr} (${ex.reason})`,
        });
      }
      continue;
    }

    // Valid Working Day -> Generate configured times
    for (const t of times) {
      const normTime = String(t).trim();
      const uniqueSlotKey = buildUniqueSlotKey({
        providerId: schedule.providerId,
        visaTypeId: schedule.visaTypeId,
        visaPurposeId: schedule.visaPurposeId,
        slotDate: d.dateStr,
        startTime: normTime,
      });

      const existing = existingByKey.get(uniqueSlotKey) || existingByKey.get(`${d.dateStr}_${normTime}`);
      if (existing) {
        potentialConflicts.push({
          date: d.dateStr,
          time: normTime,
          type: 'EXISTING_SLOT_PRESERVED',
          message: `Existing slot at ${d.dateStr} ${normTime} will be preserved (no duplicate created).`,
        });
      }

      slotsToGenerate.push({
        date: d.utcDate,
        slotDate: d.dateStr,
        monthKey: schedule.monthKey,
        startTime: normTime,
        capacity: capacityPerSlot,
        bookedCount: 0,
        location: schedule.provider.displayName,
        countryId: schedule.countryId,
        providerId: schedule.providerId,
        scheduleId: schedule.id,
        visaTypeId: schedule.visaTypeId,
        visaPurposeId: schedule.visaPurposeId,
        timezone: schedule.timezone || schedule.provider.timezone || 'Asia/Baku',
        // CRITICAL INVARIANT: Generated slots start in DRAFT status and isActive=false until Admin clicks Publish Schedule!
        slotStatus: schedule.status === 'PUBLISHED' ? 'AVAILABLE' : 'DRAFT',
        isActive: schedule.status === 'PUBLISHED',
        isManual: false,
        uniqueSlotKey,
      });
    }

    calendarDays.push({
      date: d.dateStr,
      dayOfMonth: d.dayOfMonth,
      isoDayOfWeek: d.isoDayOfWeek,
      status: 'GENERATED',
      reason: null,
      slotsCount: times.length,
      capacityPerSlot,
      times,
    });
  }

  const workingDaysWithSlots = calendarDays.filter((c) => c.status === 'GENERATED');
  const summary = {
    scheduleId: schedule.id,
    monthKey: schedule.monthKey,
    scheduleStatus: schedule.status,
    managementMode: schedule.managementMode,
    timezone: schedule.timezone,
    totalWorkingDays: workingDaysWithSlots.length,
    excludedDatesCount: excludedDates.length,
    excludedDates,
    totalGeneratedSlots: slotsToGenerate.length,
    capacityPerSlot,
    totalMonthlyApplicantCapacity: slotsToGenerate.length * capacityPerSlot,
    firstAppointmentDate: workingDaysWithSlots[0]?.date || null,
    lastAppointmentDate: workingDaysWithSlots[workingDaysWithSlots.length - 1]?.date || null,
    potentialConflicts,
    calendarDays,
  };

  return { schedule, rule, summary, slotsToGenerate };
}

/**
 * Generates slots in DRAFT state (never immediately exposing to customers unless schedule was already PUBLISHED)
 * and NEVER deletes existing slots (idempotent merge).
 */
async function generateMonthlyScheduleSlots(scheduleId, actorId) {
  const { schedule, summary, slotsToGenerate } = await computeScheduleGenerationPlan(scheduleId);

  let createdCount = 0;
  let preservedCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const slotData of slotsToGenerate) {
      const existing = await tx.timeSlot.findFirst({
        where: {
          OR: [
            ...(slotData.uniqueSlotKey ? [{ uniqueSlotKey: slotData.uniqueSlotKey }] : []),
            {
              providerId: slotData.providerId,
              visaTypeId: slotData.visaTypeId,
              slotDate: slotData.slotDate,
              startTime: slotData.startTime,
            },
          ],
        },
      });

      if (existing) {
        preservedCount += 1;
        // Link scheduleId if not linked yet, without altering bookings or deleting
        if (!existing.scheduleId) {
          await tx.timeSlot.update({
            where: { id: existing.id },
            data: { scheduleId: schedule.id },
          });
        }
        continue;
      }

      await tx.timeSlot.create({ data: slotData });
      createdCount += 1;
    }

    if (schedule.generationRule) {
      await tx.slotGenerationRule.update({
        where: { scheduleId: schedule.id },
        data: {
          lastGeneratedAt: new Date(),
          lastSummaryJson: {
            ...summary,
            createdCount,
            preservedCount,
          },
        },
      });
    }

    await recordAppointmentAudit(
      actorId,
      'APPOINTMENT_SLOTS_GENERATED_DRAFT',
      {
        scheduleId: schedule.id,
        monthKey: schedule.monthKey,
        createdCount,
        preservedCount,
        status: schedule.status,
      },
      tx
    );
  });

  return {
    ...summary,
    createdCount,
    preservedCount,
  };
}

async function publishAppointmentSchedule(scheduleId, actorId) {
  return await prisma.$transaction(async (tx) => {
    const schedule = await tx.appointmentSchedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) {
      const err = new Error('Schedule not found');
      err.statusCode = 404;
      throw err;
    }

    const updatedSchedule = await tx.appointmentSchedule.update({
      where: { id: scheduleId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        publishedById: actorId || null,
      },
    });

    // Activate all DRAFT slots belonging to this schedule so customers can now book them
    const activated = await tx.timeSlot.updateMany({
      where: {
        scheduleId,
        slotStatus: 'DRAFT',
      },
      data: {
        slotStatus: 'AVAILABLE',
        isActive: true,
      },
    });

    await recordAppointmentAudit(
      actorId,
      'APPOINTMENT_SCHEDULE_PUBLISHED',
      { scheduleId, monthKey: schedule.monthKey, activatedSlotsCount: activated.count },
      tx
    );

    return {
      schedule: updatedSchedule,
      activatedSlotsCount: activated.count,
    };
  });
}

async function closeOrArchiveAppointmentSchedule(scheduleId, targetStatus, actorId) {
  if (!['CLOSED', 'ARCHIVED'].includes(targetStatus)) {
    const err = new Error('Invalid target schedule status. Must be CLOSED or ARCHIVED.');
    err.statusCode = 400;
    throw err;
  }

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.appointmentSchedule.update({
      where: { id: scheduleId },
      data: {
        status: targetStatus,
        ...(targetStatus === 'CLOSED' ? { closedAt: new Date() } : {}),
      },
    });

    // Close unbooked slots while preserving booked ones
    await tx.timeSlot.updateMany({
      where: {
        scheduleId,
        bookedCount: 0,
        slotStatus: { in: ['DRAFT', 'AVAILABLE'] },
      },
      data: {
        slotStatus: 'CLOSED',
      },
    });

    await recordAppointmentAudit(actorId, `APPOINTMENT_SCHEDULE_${targetStatus}`, { scheduleId }, tx);
    return updated;
  });
}

// ============================================================================
// 3. APPOINTMENT CALENDAR, DAILY SLOT DETAILS, EXCLUDED DATES & MANUAL SLOTS
// ============================================================================

async function getAppointmentCalendar({
  countryId,
  providerId,
  providerType,
  visaTypeId,
  visaPurposeId,
  monthKey,
  slotStatus,
} = {}) {
  const activeMonth = monthKey || new Date().toISOString().slice(0, 7);
  const { dates } = getMonthDateStrings(activeMonth);

  const slotWhere = { monthKey: activeMonth };
  if (countryId && countryId !== 'ALL') slotWhere.countryId = countryId;
  if (providerId && providerId !== 'ALL') slotWhere.providerId = providerId;
  if (providerType && providerType !== 'ALL') {
    slotWhere.provider = { providerType };
  }
  if (visaTypeId && visaTypeId !== 'ALL') slotWhere.visaTypeId = visaTypeId;
  if (visaPurposeId && visaPurposeId !== 'ALL') slotWhere.visaPurposeId = visaPurposeId;
  if (slotStatus && slotStatus !== 'ALL') {
    if (slotStatus === 'BOOKED') {
      slotWhere.bookedCount = { gt: 0 };
    } else {
      slotWhere.slotStatus = slotStatus;
    }
  }

  const [slots, exceptions, schedules] = await Promise.all([
    prisma.timeSlot.findMany({
      where: slotWhere,
      orderBy: [{ slotDate: 'asc' }, { startTime: 'asc' }],
      include: {
        provider: true,
        visaType: true,
        visaPurpose: true,
        appointments: {
          where: { status: { not: 'CANCELLED' } },
          include: { user: { select: { id: true, fullName: true, email: true, role: true } } },
        },
      },
    }),
    prisma.scheduleException.findMany({
      where: {
        monthKey: activeMonth,
        ...(countryId && countryId !== 'ALL' ? { OR: [{ countryId }, { countryId: null }] } : {}),
        ...(providerId && providerId !== 'ALL' ? { OR: [{ providerId }, { providerId: null }] } : {}),
      },
      orderBy: { excludedDate: 'asc' },
    }),
    prisma.appointmentSchedule.findMany({
      where: {
        monthKey: activeMonth,
        ...(countryId && countryId !== 'ALL' ? { countryId } : {}),
        ...(providerId && providerId !== 'ALL' ? { providerId } : {}),
        ...(visaTypeId && visaTypeId !== 'ALL' ? { visaTypeId } : {}),
      },
      include: { generationRule: true, provider: true, visaType: true },
    }),
  ]);

  const exceptionByDate = new Map();
  for (const ex of exceptions) {
    exceptionByDate.set(ex.excludedDate, ex);
  }

  const excludeLastDay = schedules.some((s) => s.generationRule?.excludeLastDayOfMonth !== false);

  const days = dates.map((d) => {
    const daySlots = slots.filter((s) => s.slotDate === d.dateStr);
    const ex = exceptionByDate.get(d.dateStr);
    const isWeekend = d.isoDayOfWeek === 6 || d.isoDayOfWeek === 7;
    const isLastDayExcluded = excludeLastDay && d.isLastDayOfMonth && daySlots.length === 0;

    const openSlotsCount = daySlots.filter(
      (s) => s.slotStatus === 'AVAILABLE' && s.bookedCount < s.capacity
    ).length;
    const draftSlotsCount = daySlots.filter((s) => s.slotStatus === 'DRAFT').length;
    const bookedSlotsCount = daySlots.filter((s) => s.bookedCount > 0).length;
    const blockedSlotsCount = daySlots.filter((s) => s.slotStatus === 'BLOCKED').length;
    const totalCapacity = daySlots.reduce((sum, s) => sum + s.capacity, 0);
    const totalBooked = daySlots.reduce((sum, s) => sum + s.bookedCount, 0);

    let dayState = 'EMPTY';
    if (ex) dayState = 'CLOSED';
    else if (isLastDayExcluded) dayState = 'CLOSED';
    else if (daySlots.length > 0 && openSlotsCount > 0) dayState = 'OPEN';
    else if (daySlots.length > 0 && draftSlotsCount > 0) dayState = 'DRAFT';
    else if (daySlots.length > 0 && totalBooked >= totalCapacity && totalCapacity > 0) dayState = 'FULL';
    else if (daySlots.length > 0 && blockedSlotsCount === daySlots.length) dayState = 'BLOCKED';
    else if (isWeekend) dayState = 'WEEKEND';

    return {
      date: d.dateStr,
      dayOfMonth: d.dayOfMonth,
      isoDayOfWeek: d.isoDayOfWeek,
      isWeekend,
      isLastDayOfMonth: d.isLastDayOfMonth,
      dayState,
      exception: ex || (isLastDayExcluded ? { reason: 'LAST_DAY_OF_MONTH', note: 'Last calendar day excluded' } : null),
      openSlotsCount,
      draftSlotsCount,
      bookedSlotsCount,
      blockedSlotsCount,
      totalSlotsCount: daySlots.length,
      totalCapacity,
      totalBooked,
      slots: daySlots,
    };
  });

  return {
    monthKey: activeMonth,
    schedules,
    exceptions,
    days,
    totalSlotsInMonth: slots.length,
  };
}

async function listScheduleExceptions({ countryId, providerId, scheduleId, monthKey } = {}) {
  const where = {};
  if (monthKey && monthKey !== 'ALL') where.monthKey = monthKey;
  if (scheduleId) where.scheduleId = scheduleId;
  if (countryId && countryId !== 'ALL') where.countryId = countryId;
  if (providerId && providerId !== 'ALL') where.providerId = providerId;

  return prisma.scheduleException.findMany({
    where,
    orderBy: { excludedDate: 'asc' },
    include: {
      country: { select: { id: true, code: true, nameEn: true, flagEmoji: true } },
      provider: { select: { id: true, displayName: true, providerType: true } },
    },
  });
}

async function createScheduleException(payload, actorId) {
  const excludedDate = String(payload.excludedDate || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(excludedDate)) {
    const err = new Error('Valid excludedDate (YYYY-MM-DD) is required.');
    err.statusCode = 400;
    throw err;
  }
  const monthKey = excludedDate.slice(0, 7);

  return await prisma.$transaction(async (tx) => {
    const created = await tx.scheduleException.create({
      data: {
        scheduleId: payload.scheduleId || null,
        providerId: payload.providerId || null,
        countryId: payload.countryId || null,
        excludedDate,
        monthKey,
        reason: payload.reason || 'PUBLIC_HOLIDAY',
        note: payload.note || null,
        isPublicHoliday: payload.reason === 'PUBLIC_HOLIDAY' || Boolean(payload.isPublicHoliday),
        createdByUserId: actorId || null,
      },
    });

    // Check existing slots on this date
    const slotFilter = {
      slotDate: excludedDate,
      ...(payload.providerId ? { providerId: payload.providerId } : {}),
      ...(payload.countryId ? { countryId: payload.countryId } : {}),
    };

    const bookedSlots = await tx.timeSlot.findMany({
      where: { ...slotFilter, bookedCount: { gt: 0 } },
    });

    // Auto-close unbooked slots on this excluded date
    const closedResult = await tx.timeSlot.updateMany({
      where: { ...slotFilter, bookedCount: 0 },
      data: { slotStatus: 'CLOSED' },
    });

    await recordAppointmentAudit(
      actorId,
      'APPOINTMENT_EXCLUDED_DATE_ADDED',
      {
        exceptionId: created.id,
        excludedDate,
        reason: created.reason,
        closedUnbookedSlots: closedResult.count,
        bookedConflictsCount: bookedSlots.length,
      },
      tx
    );

    return {
      exception: created,
      closedUnbookedSlots: closedResult.count,
      bookedConflictsCount: bookedSlots.length,
      warning:
        bookedSlots.length > 0
          ? `${bookedSlots.length} slot(s) on ${excludedDate} already have customer bookings. Please reschedule them.`
          : null,
    };
  });
}

async function deleteScheduleException(exceptionId, actorId) {
  const existing = await prisma.scheduleException.findUnique({ where: { id: exceptionId } });
  if (!existing) {
    const err = new Error('Excluded date not found');
    err.statusCode = 404;
    throw err;
  }
  await prisma.scheduleException.delete({ where: { id: exceptionId } });
  await recordAppointmentAudit(actorId, 'APPOINTMENT_EXCLUDED_DATE_DELETED', {
    exceptionId,
    excludedDate: existing.excludedDate,
  });
  return { deleted: true };
}

/**
 * Manual Slot Management (+ Add Extra Slot & Real Availability Entry)
 */
async function createManualSlot(payload, actorId) {
  const slotDate = String(payload.slotDate || payload.date || '').slice(0, 10);
  const startTime = String(payload.startTime || payload.time || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slotDate) || !startTime) {
    const err = new Error('Valid date (YYYY-MM-DD) and time (e.g. 15:00) are required.');
    err.statusCode = 400;
    throw err;
  }

  const provider = await prisma.appointmentProvider.findUnique({
    where: { id: payload.providerId },
  });
  if (!provider) {
    const err = new Error('Appointment Provider not found');
    err.statusCode = 404;
    throw err;
  }

  const monthKey = slotDate.slice(0, 7);
  const uniqueSlotKey = buildUniqueSlotKey({
    providerId: provider.id,
    visaTypeId: payload.visaTypeId,
    visaPurposeId: payload.visaPurposeId || null,
    slotDate,
    startTime,
  });

  // Technical Invariant #1: Prevent duplicate slot for same provider + visaType + date + time
  const duplicate = await prisma.timeSlot.findFirst({
    where: {
      OR: [
        ...(uniqueSlotKey ? [{ uniqueSlotKey }] : []),
        {
          providerId: provider.id,
          visaTypeId: payload.visaTypeId || null,
          slotDate,
          startTime,
        },
      ],
    },
  });
  if (duplicate) {
    const err = new Error(`A slot already exists for ${provider.displayName} on ${slotDate} at ${startTime}.`);
    err.statusCode = 409;
    throw err;
  }

  const [y, m, d] = slotDate.split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d, 9, 0, 0));

  const created = await prisma.timeSlot.create({
    data: {
      date: utcDate,
      slotDate,
      monthKey,
      startTime,
      capacity: Math.max(1, Number(payload.capacity || 1)),
      bookedCount: 0,
      location: provider.displayName,
      countryId: payload.countryId || provider.countryId,
      providerId: provider.id,
      scheduleId: payload.scheduleId || null,
      visaTypeId: payload.visaTypeId || null,
      visaPurposeId: payload.visaPurposeId || null,
      timezone: provider.timezone || 'Asia/Baku',
      slotStatus: payload.slotStatus || payload.status || 'AVAILABLE',
      isActive: (payload.slotStatus || payload.status || 'AVAILABLE') === 'AVAILABLE',
      isManual: true,
      notes: payload.notes || null,
      uniqueSlotKey,
    },
    include: {
      provider: true,
      visaType: true,
      visaPurpose: true,
    },
  });

  await recordAppointmentAudit(actorId, 'APPOINTMENT_MANUAL_SLOT_CREATED', {
    slotId: created.id,
    providerId: provider.id,
    slotDate,
    startTime,
    capacity: created.capacity,
  });

  return created;
}

async function dispatchAppointmentCustomerNotification(tx, {
  appointment,
  type,
  title,
  message,
  previousSlotIso = null,
  newSlotIso = null,
}) {
  const notif = await tx.appointmentNotification.create({
    data: {
      appointmentId: appointment.id,
      userId: appointment.userId,
      type,
      channel: 'IN_APP_AND_EMAIL',
      title,
      message,
      previousSlotIso,
      newSlotIso,
      deliveryStatus: 'SENT',
    },
  });

  const user = await tx.user.findUnique({
    where: { id: appointment.userId },
    select: { email: true, fullName: true },
  });

  if (user?.email) {
    await tx.outboundMessageLog.create({
      data: {
        channel: 'EMAIL',
        recipient: user.email,
        subject: title,
        body: message,
        template: type,
        payloadJson: {
          bookingCode: appointment.bookingCode,
          appointmentId: appointment.id,
          previousSlotIso,
          newSlotIso,
        },
        status: 'SENT',
        provider: 'EUROTECH_CONCIERGE_MAILER',
      },
    });
  }

  return notif;
}

async function updateSlot(slotId, payload, actorId) {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.timeSlot.findUnique({
      where: { id: slotId },
      include: {
        provider: true,
        appointments: {
          where: { status: { not: 'CANCELLED' } },
        },
      },
    });
    if (!existing) {
      const err = new Error('Time slot not found');
      err.statusCode = 404;
      throw err;
    }

    const nextSlotDate = payload.slotDate ? String(payload.slotDate).slice(0, 10) : existing.slotDate;
    const nextStartTime = payload.startTime ? String(payload.startTime).trim() : existing.startTime;
    const nextCapacity = payload.capacity !== undefined ? Math.max(1, Number(payload.capacity)) : existing.capacity;

    if (nextCapacity < existing.bookedCount) {
      const err = new Error(
        `Cannot reduce capacity (${nextCapacity}) below current booked count (${existing.bookedCount}).`
      );
      err.statusCode = 400;
      throw err;
    }

    const timeOrDateChanged = nextSlotDate !== existing.slotDate || nextStartTime !== existing.startTime;
    const nextUniqueKey = existing.providerId
      ? buildUniqueSlotKey({
          providerId: existing.providerId,
          visaTypeId: existing.visaTypeId,
          visaPurposeId: existing.visaPurposeId,
          slotDate: nextSlotDate,
          startTime: nextStartTime,
        })
      : existing.uniqueSlotKey;

    if (timeOrDateChanged && nextUniqueKey) {
      const conflict = await tx.timeSlot.findFirst({
        where: {
          uniqueSlotKey: nextUniqueKey,
          id: { not: slotId },
        },
      });
      if (conflict) {
        const err = new Error(`Another slot already exists on ${nextSlotDate} at ${nextStartTime}.`);
        err.statusCode = 409;
        throw err;
      }
    }

    let nextUtcDate = existing.date;
    if (nextSlotDate && /^\d{4}-\d{2}-\d{2}$/.test(nextSlotDate)) {
      const [y, m, d] = nextSlotDate.split('-').map(Number);
      nextUtcDate = new Date(Date.UTC(y, m - 1, d, 9, 0, 0));
    }

    const nextStatus = payload.slotStatus || payload.status || existing.slotStatus;

    const updated = await tx.timeSlot.update({
      where: { id: slotId },
      data: {
        date: nextUtcDate,
        slotDate: nextSlotDate,
        monthKey: nextSlotDate ? nextSlotDate.slice(0, 7) : existing.monthKey,
        startTime: nextStartTime,
        capacity: nextCapacity,
        slotStatus: nextStatus,
        isActive: nextStatus !== 'BLOCKED' && nextStatus !== 'CLOSED',
        ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
        uniqueSlotKey: nextUniqueKey,
      },
      include: { provider: true, visaType: true, visaPurpose: true },
    });

    // Batch 3 Image 6 Requirement: When Admin modifies date or time of a booked slot, notify all affected customers!
    const notificationsSent = [];
    if (timeOrDateChanged && existing.appointments.length > 0) {
      const prevIso = `${existing.slotDate || existing.date.toISOString().slice(0, 10)} ${existing.startTime}`;
      const newIso = `${nextSlotDate} ${nextStartTime}`;
      for (const appt of existing.appointments) {
        const notif = await dispatchAppointmentCustomerNotification(tx, {
          appointment: appt,
          type: 'SLOT_RESCHEDULED',
          title: `Appointment Time Updated (${appt.bookingCode || 'EUROTECH'})`,
          message: `Your consular appointment at ${existing.location} has been updated by the Consular Desk from ${prevIso} to ${newIso} (${existing.timezone}).`,
          previousSlotIso: prevIso,
          newSlotIso: newIso,
        });
        notificationsSent.push(notif);
      }
    }

    await recordAppointmentAudit(
      actorId,
      'APPOINTMENT_SLOT_UPDATED',
      {
        slotId,
        previous: { slotDate: existing.slotDate, startTime: existing.startTime, status: existing.slotStatus },
        updated: { slotDate: nextSlotDate, startTime: nextStartTime, status: nextStatus },
        notificationsSentCount: notificationsSent.length,
      },
      tx
    );

    return {
      slot: updated,
      notificationsSentCount: notificationsSent.length,
    };
  });
}

async function deleteSlot(slotId, actorId) {
  const existing = await prisma.timeSlot.findUnique({
    where: { id: slotId },
    include: {
      appointments: {
        where: { status: { not: 'CANCELLED' } },
      },
    },
  });

  if (!existing) {
    const err = new Error('Time slot not found');
    err.statusCode = 404;
    throw err;
  }

  // Technical Invariant #3: Booked slot can NEVER be deleted!
  if (existing.bookedCount > 0 || existing.appointments.length > 0) {
    const err = new Error('Rezervasiya olunmuş slot silinə bilməz! (Booked slot cannot be deleted).');
    err.statusCode = 409;
    throw err;
  }

  await prisma.timeSlot.delete({ where: { id: slotId } });
  await recordAppointmentAudit(actorId, 'APPOINTMENT_SLOT_DELETED', {
    slotId,
    slotDate: existing.slotDate,
    startTime: existing.startTime,
  });

  return { deleted: true, slotId };
}

// ============================================================================
// 4. BOOKINGS MANAGEMENT, STATUS WORKFLOW & ADMIN RESCHEDULE WITH NOTIFICATION
// ============================================================================

async function listBookings({ countryId, providerId, status, search, monthKey } = {}) {
  const where = {};
  if (status && status !== 'ALL') where.status = status;
  if (providerId && providerId !== 'ALL') {
    where.OR = [{ providerId }, { timeSlot: { providerId } }];
  }
  if (countryId && countryId !== 'ALL') {
    where.timeSlot = { ...(where.timeSlot || {}), countryId };
  }
  if (monthKey && monthKey !== 'ALL') {
    where.timeSlot = { ...(where.timeSlot || {}), monthKey };
  }
  if (search && String(search).trim()) {
    const q = String(search).trim();
    where.OR = [
      { bookingCode: { contains: q } },
      { user: { fullName: { contains: q } } },
      { user: { email: { contains: q } } },
      { dossier: { dossierNumber: { contains: q } } },
      { groupBatch: { code: { contains: q } } },
    ];
  }

  return prisma.appointment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, fullName: true, email: true, phone: true, role: true, companyName: true } },
      timeSlot: {
        include: {
          country: { select: { id: true, code: true, nameEn: true, nameAz: true, flagEmoji: true } },
          provider: true,
          visaType: true,
          visaPurpose: true,
        },
      },
      dossier: {
        select: {
          id: true,
          dossierNumber: true,
          portalType: true,
          status: true,
          paymentStatus: true,
          country: { select: { id: true, code: true, nameEn: true, flagEmoji: true } },
        },
      },
      groupBatch: {
        select: { id: true, code: true, name: true, portalType: true, status: true },
      },
      notifications: {
        orderBy: { sentAt: 'desc' },
        take: 5,
      },
    },
  });
}

async function updateBookingStatus(appointmentId, { status, adminNotes }, actorId) {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.appointment.findUnique({
      where: { id: appointmentId },
      include: { timeSlot: true },
    });
    if (!existing) {
      const err = new Error('Appointment booking not found');
      err.statusCode = 404;
      throw err;
    }

    const wasActive = existing.status !== 'CANCELLED';
    const willBeCancelled = status === 'CANCELLED';

    if (wasActive && willBeCancelled && existing.timeSlot) {
      const dec = Math.min(existing.timeSlot.bookedCount, existing.groupSize || 1);
      if (dec > 0) {
        await tx.timeSlot.update({
          where: { id: existing.timeSlotId },
          data: {
            bookedCount: { decrement: dec },
            ...(existing.timeSlot.slotStatus === 'FULL' ? { slotStatus: 'AVAILABLE' } : {}),
          },
        });
      }
    }

    const updated = await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        status,
        ...(adminNotes !== undefined ? { adminNotes } : {}),
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        timeSlot: { include: { country: true, provider: true, visaType: true } },
        dossier: true,
        groupBatch: true,
        notifications: { orderBy: { sentAt: 'desc' } },
      },
    });

    if (willBeCancelled && wasActive) {
      const slotIso = `${existing.timeSlot?.slotDate || ''} ${existing.timeSlot?.startTime || ''}`.trim();
      await dispatchAppointmentCustomerNotification(tx, {
        appointment: updated,
        type: 'BOOKING_CANCELLED',
        title: `Appointment Cancelled (${updated.bookingCode || 'EUROTECH'})`,
        message: `Your appointment (${updated.bookingCode || ''}) scheduled for ${slotIso} has been cancelled. ${adminNotes || ''}`.trim(),
        previousSlotIso: slotIso,
      });
    } else if (status === 'CONFIRMED' && existing.status === 'PENDING') {
      const slotIso = `${existing.timeSlot?.slotDate || ''} ${existing.timeSlot?.startTime || ''}`.trim();
      await dispatchAppointmentCustomerNotification(tx, {
        appointment: updated,
        type: 'BOOKING_CONFIRMED',
        title: `Appointment Confirmed (${updated.bookingCode || 'EUROTECH'})`,
        message: `Your consular appointment (${updated.bookingCode || ''}) for ${slotIso} is confirmed.`,
        newSlotIso: slotIso,
      });
    }

    await recordAppointmentAudit(
      actorId,
      'APPOINTMENT_BOOKING_STATUS_UPDATED',
      { appointmentId, bookingCode: existing.bookingCode, fromStatus: existing.status, toStatus: status },
      tx
    );

    return updated;
  });
}

async function adminRescheduleBooking(appointmentId, { newTimeSlotId, adminNotes, sendNotification = true }, actorId) {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.appointment.findUnique({
      where: { id: appointmentId },
      include: { timeSlot: true },
    });
    if (!existing) {
      const err = new Error('Booking not found');
      err.statusCode = 404;
      throw err;
    }

    const newSlot = await tx.timeSlot.findUnique({
      where: { id: newTimeSlotId },
      include: { provider: true },
    });
    if (!newSlot || !newSlot.isActive || ['BLOCKED', 'CLOSED', 'DRAFT'].includes(newSlot.slotStatus)) {
      const err = new Error('Target time slot is not available for booking.');
      err.statusCode = 400;
      throw err;
    }

    const neededSeats = existing.groupSize || 1;
    if (newSlot.bookedCount + neededSeats > newSlot.capacity) {
      const err = new Error(
        `Target slot does not have enough capacity (available: ${newSlot.capacity - newSlot.bookedCount}, needed: ${neededSeats}).`
      );
      err.statusCode = 409;
      throw err;
    }

    // Free seats on old slot
    if (existing.timeSlot && existing.status !== 'CANCELLED') {
      const dec = Math.min(existing.timeSlot.bookedCount, neededSeats);
      if (dec > 0) {
        await tx.timeSlot.update({
          where: { id: existing.timeSlotId },
          data: {
            bookedCount: { decrement: dec },
            ...(existing.timeSlot.slotStatus === 'FULL' ? { slotStatus: 'AVAILABLE' } : {}),
          },
        });
      }
    }

    // Reserve seats on new slot
    const newBookedCount = newSlot.bookedCount + neededSeats;
    await tx.timeSlot.update({
      where: { id: newSlot.id },
      data: {
        bookedCount: newBookedCount,
        slotStatus: newBookedCount >= newSlot.capacity ? 'FULL' : 'AVAILABLE',
      },
    });

    const updated = await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        rescheduledFromSlotId: existing.timeSlotId,
        timeSlotId: newSlot.id,
        providerId: newSlot.providerId || existing.providerId,
        visaTypeId: newSlot.visaTypeId || existing.visaTypeId,
        location: newSlot.location,
        status: 'CONFIRMED',
        ...(adminNotes !== undefined ? { adminNotes } : {}),
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        timeSlot: { include: { country: true, provider: true, visaType: true } },
        dossier: true,
        groupBatch: true,
      },
    });

    if (updated.dossierId) {
      await tx.dossier.update({
        where: { id: updated.dossierId },
        data: {
          appointmentDate: newSlot.date,
          appointmentLocation: newSlot.location,
        },
      });
    }

    const prevIso = `${existing.timeSlot?.slotDate || existing.timeSlot?.date?.toISOString().slice(0, 10) || ''} ${existing.timeSlot?.startTime || ''}`.trim();
    const newIso = `${newSlot.slotDate || newSlot.date.toISOString().slice(0, 10)} ${newSlot.startTime}`.trim();

    let notification = null;
    if (sendNotification !== false) {
      notification = await dispatchAppointmentCustomerNotification(tx, {
        appointment: updated,
        type: 'SLOT_RESCHEDULED',
        title: `Appointment Rescheduled (${updated.bookingCode || 'EUROTECH'})`,
        message: `Your consular appointment (${updated.bookingCode || ''}) has been rescheduled from ${prevIso} to ${newIso} at ${newSlot.location} (${newSlot.timezone || 'Asia/Baku'}). ${adminNotes ? `Note: ${adminNotes}` : ''}`.trim(),
        previousSlotIso: prevIso,
        newSlotIso: newIso,
      });
    }

    await recordAppointmentAudit(
      actorId,
      'APPOINTMENT_BOOKING_RESCHEDULED_BY_ADMIN',
      {
        appointmentId,
        bookingCode: updated.bookingCode,
        fromSlotId: existing.timeSlotId,
        toSlotId: newSlot.id,
        prevIso,
        newIso,
        notificationSent: Boolean(notification),
      },
      tx
    );

    return {
      booking: updated,
      notification,
    };
  });
}

// ============================================================================
// 5. CUSTOMER / PORTAL AVAILABLE SLOTS & NOTIFICATIONS
// ============================================================================

async function getCustomerPublishedSlots({
  countryId,
  visaTypeId,
  visaPurposeId,
  applicantCountryCode = 'AZ',
  monthKey,
  groupSize = 1,
} = {}) {
  // 1. Dynamically resolve which AppointmentProvider(s) serve this country + visaType (+ purpose)
  const providerWhere = {
    status: 'ACTIVE',
    ...(countryId ? { countryId } : {}),
    ...(applicantCountryCode ? { applicantCountryCode: String(applicantCountryCode).toUpperCase() } : {}),
  };

  let providers = await prisma.appointmentProvider.findMany({
    where: providerWhere,
    include: {
      country: true,
      embassy: true,
      visaApplicationCentre: true,
      servedVisaTypes: { where: { isActive: true }, include: { visaType: true } },
      servedPurposes: { where: { isActive: true }, include: { visaPurpose: true } },
    },
  });

  if (visaPurposeId) {
    const purposeSpecific = providers.filter((p) =>
      p.servedPurposes.some((sp) => sp.visaPurposeId === visaPurposeId)
    );
    if (purposeSpecific.length > 0) {
      providers = purposeSpecific;
    }
  }

  if (visaTypeId) {
    const typeSpecific = providers.filter((p) =>
      p.servedVisaTypes.some((svt) => svt.visaTypeId === visaTypeId)
    );
    if (typeSpecific.length > 0) {
      providers = typeSpecific;
    }
  }

  const providerIds = providers.map((p) => p.id);
  const todayStr = new Date().toISOString().slice(0, 10);

  // 2. Query ONLY PUBLISHED / AVAILABLE slots (never DRAFT, BLOCKED, or CLOSED!)
  const slotWhere = {
    isActive: true,
    slotStatus: 'AVAILABLE',
    ...(monthKey ? { monthKey } : {}),
    ...(countryId ? { countryId } : {}),
    ...(providerIds.length > 0 ? { providerId: { in: providerIds } } : {}),
    ...(visaTypeId ? { OR: [{ visaTypeId }, { visaTypeId: null }] } : {}),
    OR: [
      { scheduleId: null },
      { schedule: { status: 'PUBLISHED' } },
    ],
  };

  const rawSlots = await prisma.timeSlot.findMany({
    where: slotWhere,
    orderBy: [{ slotDate: 'asc' }, { date: 'asc' }, { startTime: 'asc' }],
    include: {
      provider: {
        include: {
          embassy: true,
          visaApplicationCentre: true,
        },
      },
      visaType: true,
      visaPurpose: true,
    },
  });

  const minSeats = Math.max(1, Number(groupSize || 1));
  const availableSlots = rawSlots
    .filter((s) => {
      const sDate = s.slotDate || new Date(s.date).toISOString().slice(0, 10);
      return sDate >= todayStr && s.capacity - s.bookedCount >= minSeats;
    })
    .map((s) => ({
      ...s,
      availableCapacity: Math.max(0, s.capacity - s.bookedCount),
      isFull: s.bookedCount >= s.capacity,
    }));

  return {
    providers,
    slots: availableSlots,
  };
}

async function listUserAppointmentNotifications(userId) {
  return prisma.appointmentNotification.findMany({
    where: { userId },
    orderBy: { sentAt: 'desc' },
    take: 30,
    include: {
      appointment: {
        include: {
          timeSlot: {
            include: { country: true, provider: true },
          },
        },
      },
    },
  });
}

async function markAppointmentNotificationRead(notificationId, userId) {
  return prisma.appointmentNotification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });
}

module.exports = {
  listAppointmentProviders,
  saveAppointmentProvider,
  updateProviderVisaMappings,
  listAppointmentSchedules,
  createOrUpdateMonthlySchedule,
  computeScheduleGenerationPlan,
  generateMonthlyScheduleSlots,
  publishAppointmentSchedule,
  closeOrArchiveAppointmentSchedule,
  getAppointmentCalendar,
  listScheduleExceptions,
  createScheduleException,
  deleteScheduleException,
  createManualSlot,
  updateSlot,
  deleteSlot,
  listBookings,
  updateBookingStatus,
  adminRescheduleBooking,
  getCustomerPublishedSlots,
  listUserAppointmentNotifications,
  markAppointmentNotificationRead,
  nextBookingCode,
};
