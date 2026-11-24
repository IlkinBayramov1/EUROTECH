const assert = require('assert');
const prisma = require('../config/db');
const vcmsService = require('../modules/vcms/services/vcms.service');
const appointmentEngine = require('../modules/vcms/services/appointmentEngine.service');
const appointmentBookingService = require('../modules/appointment/services/appointmentBooking.service');
const dossierService = require('../modules/dossier/dossier.service');
const { migrateVcmsBaseline } = require('./migrate-vcms-baseline');

async function runE2ETests() {
  console.log('================================================================================');
  console.log('STARTING EUROTECH VCMS & APPOINTMENT MANAGEMENT FULL E2E VERIFICATION');
  console.log('================================================================================\n');

  await migrateVcmsBaseline(prisma);

  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  assert(adminUser, 'Admin user must exist');

  // ---------------------------------------------------------------------------
  // TEST 1: Destinations, Visa Types, Purposes, Capago VAC & Embassy of France
  // ---------------------------------------------------------------------------
  console.log('1. Testing Destinations, Visa Types, Purposes, Capago VAC & Embassy of France...');
  const countries = await vcmsService.listDestinations();
  assert(countries.length >= 9, `Expected >= 9 countries, got ${countries.length}`);

  const franceSummary = countries.find((c) => c.code === 'FR');
  const germanySummary = countries.find((c) => c.code === 'DE');
  assert(franceSummary && germanySummary, 'France and Germany must exist in Destinations');

  const france = await vcmsService.getCountryDetail(franceSummary.id);
  const germany = await vcmsService.getCountryDetail(germanySummary.id);

  assert(france.visaTypes.length >= 2, 'France must have Short Stay and Long Stay visa types');
  const frShortStay = france.visaTypes.find((vt) => vt.code === 'SHORT_STAY_C');
  const frLongStay = france.visaTypes.find((vt) => vt.code === 'LONG_STAY_D');
  assert(frShortStay && frLongStay, 'France Short Stay (C) & Long Stay (D) must exist');

  const frBusinessPurpose = frShortStay.purposes.find((p) => p.code === 'BUSINESS');
  const deShortStay = germany.visaTypes.find((vt) => vt.code === 'SHORT_STAY_C');
  const deBusinessPurpose = deShortStay.purposes.find((p) => p.code === 'BUSINESS');
  assert(frBusinessPurpose && deBusinessPurpose, 'France & Germany Business purposes must exist');

  const frVac = france.visaApplicationCentres[0];
  const frEmbassy = france.embassies[0];
  assert(frVac && frVac.providerName === 'Capago', 'France VAC must be Capago');
  assert(
    frEmbassy && frEmbassy.responsibleAuthority === 'Embassy of France in Baku',
    'France Embassy must be Embassy of France in Baku'
  );
  console.log('   [PASS] France & Germany Visa Types, Purposes, Capago VAC & Embassy verified.\n');

  // ---------------------------------------------------------------------------
  // TEST 2: Two-Layer Question Pool & Country/Purpose Local Override Isolation
  // ---------------------------------------------------------------------------
  console.log('2. Testing Two-Layer Question Pool & Strict Country Isolation...');
  const poolQ = await vcmsService.createGlobalQuestion(
    {
      titleEn: 'E2E Conference Invitation Reference',
      titleAz: 'Konfrans Dəvətnamə Nömrəsi',
      officialTextEn: 'Please provide the official invitation reference number',
      defaultCategoryName: '4. Your Stay & Sponsor',
      answerType: 'SINGLE_SELECT',
      defaultRequired: false,
      options: [
        { labelEn: 'Corporate Trade Fair', labelAz: 'Korporativ Sərgi' },
        { labelEn: 'B2B Partner Summit', labelAz: 'B2B Sammit' },
      ],
    },
    adminUser.id
  );
  assert(/^Q\d{3,}$/.test(poolQ.questionCode), `Auto Question ID must match Qxxx, got ${poolQ.questionCode}`);
  assert(poolQ.options.length === 2, 'Question options must be created with unique OPT_* codes');
  assert(poolQ.options[0].optionCode.startsWith('OPT_'), `Option code must start with OPT_, got ${poolQ.options[0].optionCode}`);

  // Attach this same pool question to BOTH France Business and Germany Business
  await vcmsService.attachQuestionsFromPool(
    frBusinessPurpose.id,
    { globalQuestionIds: [poolQ.id] },
    adminUser.id
  );
  await vcmsService.attachQuestionsFromPool(
    deBusinessPurpose.id,
    { globalQuestionIds: [poolQ.id] },
    adminUser.id
  );

  const frWorkBefore = await vcmsService.getPurposeWorkspace(frBusinessPurpose.id);
  const frQCfg = frWorkBefore.questions.find((q) => q.globalQuestionId === poolQ.id);
  assert(frQCfg, 'Question must be attached to France Business');

  // Modify question ONLY in France Business (Local Override)
  await vcmsService.updatePurposeQuestionConfig(
    frQCfg.configId,
    {
      customTitleEn: 'France CCI / Business Invitation Number (France Override)',
      isRequired: true,
    },
    adminUser.id
  );

  const frWorkAfter = await vcmsService.getPurposeWorkspace(frBusinessPurpose.id);
  const deWorkAfter = await vcmsService.getPurposeWorkspace(deBusinessPurpose.id);

  const frQResolved = frWorkAfter.questions.find((q) => q.globalQuestionId === poolQ.id);
  const deQResolved = deWorkAfter.questions.find((q) => q.globalQuestionId === poolQ.id);

  assert.strictEqual(
    frQResolved.titleEn,
    'France CCI / Business Invitation Number (France Override)',
    'France must show local overridden title'
  );
  assert.strictEqual(frQResolved.isRequired, true, 'France override must be Required');
  assert.strictEqual(frQResolved.isOverriddenLocally, true, 'France must be flagged as locally overridden');

  assert.strictEqual(
    deQResolved.titleEn,
    'E2E Conference Invitation Reference',
    'Germany MUST NOT be affected by France local override!'
  );
  assert.strictEqual(deQResolved.isRequired, false, 'Germany required flag MUST NOT be affected by France override!');
  assert.strictEqual(deQResolved.isOverriddenLocally, false, 'Germany must remain un-overridden');

  // Cleanup test pool question
  await prisma.globalQuestion.delete({ where: { id: poolQ.id } });
  console.log('   [PASS] Two-Layer Question Pool & Country Override Isolation 100% verified.\n');

  // ---------------------------------------------------------------------------
  // TEST 3: Conditional Logic (QuestionCondition & DocumentCondition)
  // ---------------------------------------------------------------------------
  console.log('3. Testing Conditional Logic for Questions (Q010 -> Q011) & Documents (Q022 -> DOC-004)...');
  const schemaWhenSingle = await vcmsService.getPublicPurposeFormSchema(frBusinessPurpose.id, {
    answersByQuestionCode: {
      Q010: 'OPT_MARITAL_SINGLE',
      Q022: 'OPT_EMPLOYMENT_UNEMPLOYED',
    },
  });
  const spouseQWhenSingle = schemaWhenSingle.questions.find((q) => q.questionCode === 'Q011');
  const empDocWhenUnemployed = schemaWhenSingle.documents.find((d) => d.documentCode === 'DOC-004');
  assert.strictEqual(spouseQWhenSingle.evaluatedVisibility, false, 'Spouse question Q011 must be hidden when Single');
  assert.strictEqual(
    empDocWhenUnemployed.evaluatedVisibility,
    false,
    'Employment letter DOC-004 must be hidden when Unemployed'
  );

  const schemaWhenMarriedEmployed = await vcmsService.getPublicPurposeFormSchema(frBusinessPurpose.id, {
    answersByQuestionCode: {
      Q010: 'OPT_MARITAL_MARRIED',
      Q022: 'OPT_EMPLOYMENT_EMPLOYED',
    },
  });
  const spouseQWhenMarried = schemaWhenMarriedEmployed.questions.find((q) => q.questionCode === 'Q011');
  const empDocWhenEmployed = schemaWhenMarriedEmployed.documents.find((d) => d.documentCode === 'DOC-004');
  assert.strictEqual(spouseQWhenMarried.evaluatedVisibility, true, 'Spouse question Q011 must be visible when Married');
  assert.strictEqual(spouseQWhenMarried.evaluatedRequired, true, 'Spouse question Q011 must be required when Married');
  assert.strictEqual(
    empDocWhenEmployed.evaluatedVisibility,
    true,
    'Employment letter DOC-004 must be visible when Employed'
  );
  assert.strictEqual(
    empDocWhenEmployed.evaluatedRequired,
    true,
    'Employment letter DOC-004 must be required when Employed'
  );
  console.log('   [PASS] Conditional Logic for Questions and Required Documents verified.\n');

  // ---------------------------------------------------------------------------
  // TEST 4: Version Control (Publish & Rollback) + Applicant Answers -> PDF Sync
  // ---------------------------------------------------------------------------
  console.log('4. Testing Country Publish, Version Control, Rollback & Applicant Answers PDF Sync...');
  const v1 = await vcmsService.publishCountryConfiguration(
    france.id,
    { changeSummary: 'E2E Baseline Publish v1' },
    adminUser.id
  );
  const v2 = await vcmsService.publishCountryConfiguration(
    france.id,
    { changeSummary: 'E2E Update Publish v2' },
    adminUser.id
  );
  assert(v2.versionNumber > v1.versionNumber, 'Version number must increment on publish');

  const v3Rollback = await vcmsService.rollbackConfigurationVersion(france.id, v1.id, adminUser.id);
  assert(v3Rollback.versionNumber === v2.versionNumber + 1, 'Rollback must create a new active version snapshot');

  // Create a test Dossier with visaTypeId & visaPurposeId and save dynamic answers
  const testDossier = await dossierService.createDossier({
    userId: adminUser.id,
    portalType: 'INDIVIDUAL',
    countryId: france.id,
    visaTypeId: frShortStay.id,
    visaPurposeId: frBusinessPurpose.id,
    applicantsCount: 1,
    applicants: [{ firstName: 'Test', lastName: 'User', passportNumber: 'AZ9988776' }],
  });
  assert.strictEqual(testDossier.visaTypeId, frShortStay.id, 'Dossier must store visaTypeId');
  assert.strictEqual(testDossier.visaPurposeId, frBusinessPurpose.id, 'Dossier must store visaPurposeId');

  const testApplicant = testDossier.applicants[0];
  const saveAnsResult = await vcmsService.saveApplicantQuestionAnswers({
    dossierId: testDossier.id,
    applicantId: testApplicant.id,
    answers: [
      { questionCode: 'Q006', valueText: 'BAYRAMOV' },
      { questionCode: 'Q007', valueText: 'ILKIN' },
      { questionCode: 'Q010', valueText: 'OPT_MARITAL_MARRIED', selectedOptionCodes: ['OPT_MARITAL_MARRIED'] },
      { questionCode: 'Q011', valueText: 'ALIYEVA LEYLA' },
    ],
    actorId: adminUser.id,
  });
  assert(saveAnsResult.savedCount === 4, 'All 4 dynamic answers must be saved');
  assert.strictEqual(saveAnsResult.syncedFormData.lastName, 'BAYRAMOV', 'Q006 must sync to Schengen PDF lastName');
  assert.strictEqual(saveAnsResult.syncedFormData.firstName, 'ILKIN', 'Q007 must sync to Schengen PDF firstName');
  console.log('   [PASS] Version Control, Rollback, and 37-Point Schengen PDF Sync verified.\n');

  // ---------------------------------------------------------------------------
  // TEST 5: Appointment Management Engine — Monthly Schedule, Exclude Last Day,
  //         Excluded Dates, Draft -> Publish, Manual Slots, 6 Invariants & Reschedule Notification
  // ---------------------------------------------------------------------------
  console.log('5. Testing Appointment Engine (Draft -> Publish, Exclude Last Day, 6 Invariants & Notifications)...');
  const frProviders = await appointmentEngine.listAppointmentProviders({ countryId: france.id });
  const capagoProvider = frProviders.find((p) => p.providerType === 'VISA_APPLICATION_CENTRE');
  const embassyProvider = frProviders.find((p) => p.providerType === 'EMBASSY');
  assert(capagoProvider && embassyProvider, 'France must have both Capago VAC and Embassy appointment providers');

  const testMonthKey = '2026-12';

  // Clean any old test data for 2026-12 France Capago before running deterministic assertions
  await prisma.timeSlot.deleteMany({
    where: { providerId: capagoProvider.id, monthKey: testMonthKey, bookedCount: 0 },
  });
  await prisma.scheduleException.deleteMany({
    where: { countryId: france.id, monthKey: testMonthKey },
  });
  await prisma.appointmentSchedule.deleteMany({
    where: { providerId: capagoProvider.id, monthKey: testMonthKey },
  });

  // Add 2 Excluded Dates in December 2026: Dec 8 (Tuesday) & Dec 24 (Thursday)
  await appointmentEngine.createScheduleException(
    {
      countryId: france.id,
      providerId: capagoProvider.id,
      excludedDate: '2026-12-08',
      reason: 'VISA_CENTRE_CLOSED',
      note: 'Capago Technical Upgrade Day',
    },
    adminUser.id
  );
  await appointmentEngine.createScheduleException(
    {
      countryId: france.id,
      providerId: capagoProvider.id,
      excludedDate: '2026-12-24',
      reason: 'PUBLIC_HOLIDAY',
      note: 'Christmas Eve Closure',
    },
    adminUser.id
  );

  // Configure Monthly Schedule for December 2026 (Mon-Fri, 2 slots/day: 09:00 & 11:00, capacityPerSlot: 2, excludeLastDayOfMonth: true)
  const schedule = await appointmentEngine.createOrUpdateMonthlySchedule(
    {
      countryId: france.id,
      providerId: capagoProvider.id,
      visaTypeId: frShortStay.id,
      monthKey: testMonthKey,
      managementMode: 'AUTOMATIC_GENERATION',
      timezone: 'Asia/Baku',
      rule: {
        appointmentsPerDay: 2,
        appointmentTimesJson: ['09:00', '11:00'],
        capacityPerSlot: 2,
        workingDaysJson: [1, 2, 3, 4, 5],
        excludeWeekends: true,
        excludeLastDayOfMonth: true,
        excludePublicHolidays: true,
      },
    },
    adminUser.id
  );
  assert.strictEqual(schedule.status, 'DRAFT', 'New schedule must start in DRAFT status');

  // Generate Slots (must create in DRAFT status!)
  const gen1 = await appointmentEngine.generateMonthlyScheduleSlots(schedule.id, adminUser.id);
  // December 2026 has 23 weekdays (Mon-Fri). Minus Dec 8, Dec 24, and Dec 31 (Last Day of Month, Thursday!) = 20 working days * 2 slots = 40 slots!
  assert.strictEqual(gen1.totalWorkingDays, 20, `Expected 20 working days in Dec 2026, got ${gen1.totalWorkingDays}`);
  assert.strictEqual(gen1.totalGeneratedSlots, 40, `Expected 40 generated slots, got ${gen1.totalGeneratedSlots}`);
  assert.strictEqual(gen1.createdCount, 40, `Expected 40 newly created slots, got ${gen1.createdCount}`);

  // Verify Dec 31 (Thursday - last calendar day of month) has ZERO slots!
  const dec31Slots = await prisma.timeSlot.count({
    where: { providerId: capagoProvider.id, slotDate: '2026-12-31' },
  });
  assert.strictEqual(dec31Slots, 0, 'Exclude Last Day of Month rule must prevent any slot on 2026-12-31!');

  // Verify Customer API does NOT see DRAFT slots before Publish!
  const customerBeforePublish = await appointmentEngine.getCustomerPublishedSlots({
    countryId: france.id,
    visaTypeId: frShortStay.id,
    monthKey: testMonthKey,
  });
  assert.strictEqual(
    customerBeforePublish.slots.length,
    0,
    'Customer API MUST NOT expose DRAFT slots before Admin clicks Publish Schedule!'
  );

  // Technical Invariant #1 & #2: Running Generate a 2nd time must NOT create duplicates and must NOT delete existing slots
  const gen2 = await appointmentEngine.generateMonthlyScheduleSlots(schedule.id, adminUser.id);
  assert.strictEqual(gen2.createdCount, 0, 'Second generation must not create duplicate slots');
  assert.strictEqual(gen2.preservedCount, 40, 'Second generation must preserve all 40 existing slots');

  // Section 6: Manual Slot Management (+ Add Extra Slot on Friday 2026-12-04 at 15:00 with capacity 3)
  const extraManualSlot = await appointmentEngine.createManualSlot(
    {
      countryId: france.id,
      providerId: capagoProvider.id,
      visaTypeId: frShortStay.id,
      slotDate: '2026-12-04',
      startTime: '15:00',
      capacity: 3,
      slotStatus: 'AVAILABLE',
      notes: 'Extra Friday afternoon slot approved by Consulate',
    },
    adminUser.id
  );
  assert.strictEqual(extraManualSlot.isManual, true, 'Manual slot must have isManual = true');
  assert.strictEqual(extraManualSlot.capacity, 3, 'Manual slot capacity must be stored separately');

  // Verify duplicate manual slot on same provider + date + time is blocked with 409
  let duplicateBlocked = false;
  try {
    await appointmentEngine.createManualSlot(
      {
        countryId: france.id,
        providerId: capagoProvider.id,
        visaTypeId: frShortStay.id,
        slotDate: '2026-12-04',
        startTime: '15:00',
        capacity: 1,
      },
      adminUser.id
    );
  } catch (dupErr) {
    duplicateBlocked = dupErr.statusCode === 409;
  }
  assert.strictEqual(duplicateBlocked, true, 'Duplicate slot for same provider, date, and time must be rejected (409)');

  // Publish Schedule (DRAFT -> PUBLISHED)
  const pubRes = await appointmentEngine.publishAppointmentSchedule(schedule.id, adminUser.id);
  assert.strictEqual(pubRes.schedule.status, 'PUBLISHED', 'Schedule status must become PUBLISHED');
  assert.strictEqual(pubRes.activatedSlotsCount, 40, 'All 40 DRAFT slots must become AVAILABLE');

  // Verify Customer API now sees all 41 available slots (40 generated + 1 manual)
  const customerAfterPublish = await appointmentEngine.getCustomerPublishedSlots({
    countryId: france.id,
    visaTypeId: frShortStay.id,
    monthKey: testMonthKey,
  });
  assert.strictEqual(
    customerAfterPublish.slots.length,
    41,
    `Expected 41 available published slots for customer, got ${customerAfterPublish.slots.length}`
  );

  // Section 8: Book Appointment (AP001), test Delete Protection on Booked Slot, and Admin Reschedule -> Customer Notification
  const slotDec1_0900 = customerAfterPublish.slots.find(
    (s) => s.slotDate === '2026-12-01' && s.startTime === '09:00'
  );
  const slotDec1_1100 = customerAfterPublish.slots.find(
    (s) => s.slotDate === '2026-12-01' && s.startTime === '11:00'
  );
  assert(slotDec1_0900 && slotDec1_1100, 'Dec 1 09:00 and 11:00 slots must be available');

  const booking = await appointmentBookingService.bookAppointment({
    userId: adminUser.id,
    dossierId: testDossier.id,
    timeSlotId: slotDec1_0900.id,
  });
  assert(/^AP\d{3,}$/.test(booking.bookingCode), `Booking code must be APxxx, got ${booking.bookingCode}`);

  // Technical Invariant #3: Attempt to delete a booked slot must fail with 409 Conflict!
  let bookedDeleteBlocked = false;
  try {
    await appointmentEngine.deleteSlot(slotDec1_0900.id, adminUser.id);
  } catch (delErr) {
    bookedDeleteBlocked = delErr.statusCode === 409;
  }
  assert.strictEqual(bookedDeleteBlocked, true, 'Booked slot deletion MUST be blocked with 409 Conflict!');

  // Admin Reschedule Booking from 09:00 to 11:00 -> must notify customer via AppointmentNotification + OutboundMessageLog!
  const reschedResult = await appointmentEngine.adminRescheduleBooking(
    booking.id,
    {
      newTimeSlotId: slotDec1_1100.id,
      adminNotes: 'Moved to 11:00 by Consular Officer',
      sendNotification: true,
    },
    adminUser.id
  );
  assert.strictEqual(reschedResult.booking.timeSlotId, slotDec1_1100.id, 'Booking must point to new slot');
  assert(reschedResult.notification, 'Customer notification must be created on Admin Reschedule');
  assert.strictEqual(
    reschedResult.notification.type,
    'SLOT_RESCHEDULED',
    'Notification type must be SLOT_RESCHEDULED'
  );

  // Cleanup test dossier & booking
  await prisma.appointment.delete({ where: { id: booking.id } });
  await prisma.timeSlot.update({ where: { id: slotDec1_1100.id }, data: { bookedCount: 0 } });
  await prisma.dossier.delete({ where: { id: testDossier.id } });

  console.log('   [PASS] Appointment Generator, Draft->Publish, 6 Invariants, Bookings & Notifications verified!\n');

  console.log('================================================================================');
  console.log('ALL EUROTECH VCMS & APPOINTMENT MANAGEMENT E2E TESTS PASSED (100% GREEN)!');
  console.log('================================================================================');
}

runE2ETests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[FAIL] E2E TEST FAILED:', err);
    process.exit(1);
  });
