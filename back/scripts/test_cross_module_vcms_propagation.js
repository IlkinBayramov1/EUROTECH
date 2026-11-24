const assert = require('assert');
const prisma = require('../config/db');
const vcmsService = require('../modules/vcms/services/vcms.service');
const appointmentEngine = require('../modules/vcms/services/appointmentEngine.service');
const appointmentBookingService = require('../modules/appointment/services/appointmentBooking.service');
const dossierService = require('../modules/dossier/dossier.service');
const agentGroupService = require('../modules/agent/services/agentGroup.service');
const agentAppointmentService = require('../modules/agent/services/agentAppointment.service');
const agentTravelerService = require('../modules/agent/services/agentTraveler.service');
const corporateBatchService = require('../modules/corporate/services/corporateBatch.service');
const corporateDelegationService = require('../modules/corporate/services/corporateDelegation.service');
const { migrateVcmsBaseline } = require('./migrate-vcms-baseline');

async function runCrossModulePropagationTests() {
  console.log('================================================================================');
  console.log('STARTING CROSS-MODULE VCMS & APPOINTMENT PROPAGATION E2E VERIFICATION');
  console.log('   (Admin -> Individual + Tour Operator + Corporate Partner + 5-Step Wizard)');
  console.log('================================================================================\n');

  await migrateVcmsBaseline(prisma);

  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const agentUser =
    (await prisma.user.findFirst({ where: { role: 'AGENT_TUR_OPERATOR' } })) || adminUser;
  const corporateUser =
    (await prisma.user.findFirst({ where: { role: 'CORPORATE_HR' } })) || adminUser;
  const individualUser =
    (await prisma.user.findFirst({ where: { role: 'INDIVIDUAL' } })) || adminUser;

  assert(adminUser, 'Admin user must exist');

  // ---------------------------------------------------------------------------
  // TEST 1: Admin Adds a Custom Purpose with Custom Fee (€105) + Custom Question + Custom Document
  // ---------------------------------------------------------------------------
  console.log('1. Testing Admin VCMS Custom Purpose (€105 Fee), Question & Document Creation...');
  const countries = await vcmsService.listDestinations();
  const franceSummary = countries.find((c) => c.code === 'FR');
  assert(franceSummary, 'France must exist');
  const france = await vcmsService.getCountryDetail(franceSummary.id);
  const frShortStay = france.visaTypes.find((vt) => vt.code === 'SHORT_STAY_C');
  assert(frShortStay, 'France Short Stay C must exist');

  // Cleanup any leftover test purpose from previous interrupted runs
  await prisma.visaPurpose.deleteMany({
    where: { visaTypeId: frShortStay.id, code: 'TECH_EXPO_DELEGATION' },
  });

  // Create a custom Question in Pool (AnswerType: MULTIPLE_SELECT) & a custom Document in Pool
  const customPoolQ = await vcmsService.createGlobalQuestion(
    {
      titleEn: 'Cross-Module Tech Expo Sectors',
      titleAz: 'Texnologiya Sərgisi Sektorları',
      officialTextEn: 'Select all technology sectors you will represent at VivaTech Paris',
      defaultCategoryName: '1. Your Plans',
      answerType: 'MULTIPLE_SELECT',
      defaultRequired: true,
      options: [
        { labelEn: 'AI & Robotics', labelAz: 'Süni İntellekt' },
        { labelEn: 'FinTech & Banking', labelAz: 'FinTex' },
        { labelEn: 'GreenTech & Energy', labelAz: 'Yaşıl Enerji' },
      ],
    },
    adminUser.id
  );

  const customPoolDoc = await vcmsService.createGlobalDocument(
    {
      nameEn: 'VivaTech Paris Exhibitor Pass',
      nameAz: 'VivaTech Paris İştirakçı Bilet Təsdiqi',
      descriptionEn: 'Official QR accreditation pass issued by VivaTech Paris organizers.',
      category: 'PURPOSE_SPECIFIC',
      defaultRequired: true,
    },
    adminUser.id
  );

  // Create or update a custom Purpose under France Short Stay with €105 consularFeeOverride
  const customPurpose = await vcmsService.createVisaPurpose(
    frShortStay.id,
    {
      code: 'TECH_EXPO_DELEGATION',
      nameEn: 'Tech Expo & Innovation Summit',
      nameAz: 'Texnologiya Sərgisi və İnnovasiya Sammiti',
      descriptionEn: 'Special short-stay delegation for VivaTech Paris.',
      consularFeeOverride: 105.0,
      status: 'ACTIVE',
    },
    adminUser.id
  );
  assert.strictEqual(Number(customPurpose.consularFeeOverride), 105, 'Custom purpose fee override must be €105');

  // Attach standard baseline questions/docs + our new custom question & document
  await vcmsService.attachQuestionsFromPool(
    customPurpose.id,
    { globalQuestionIds: [customPoolQ.id] },
    adminUser.id
  );
  await vcmsService.attachDocumentsFromPool(
    customPurpose.id,
    { globalDocumentIds: [customPoolDoc.id] },
    adminUser.id
  );

  // Publish France configuration -> creates new ConfigurationVersion
  const pubVersion = await vcmsService.publishCountryConfiguration(
    france.id,
    { changeSummary: 'Added Tech Expo Purpose with €105 override' },
    adminUser.id
  );
  assert(pubVersion && pubVersion.id, 'Published ConfigurationVersion must be created');
  console.log(`   [PASS] Created Purpose "${customPurpose.nameEn}" (€105), ${customPoolQ.questionCode}, ${customPoolDoc.documentCode}, Version v${pubVersion.versionNumber}.\n`);

  // ---------------------------------------------------------------------------
  // TEST 2: DRAFT Slot Protection Leak Fix & Published Manual Slot Multi-Pax Capacity
  // ---------------------------------------------------------------------------
  console.log('2. Testing DRAFT Slot Protection across Legacy & VCMS Endpoints...');
  const frProviders = await appointmentEngine.listAppointmentProviders({ countryId: france.id });
  const capagoProvider = frProviders.find((p) => p.providerType === 'VISA_APPLICATION_CENTRE');
  assert(capagoProvider, 'Capago provider must exist');

  const testMonthKey = '2027-01';
  await prisma.appointment.deleteMany({
    where: { timeSlot: { providerId: capagoProvider.id, monthKey: testMonthKey } },
  });
  await prisma.timeSlot.deleteMany({
    where: { providerId: capagoProvider.id, monthKey: testMonthKey },
  });
  await prisma.appointmentSchedule.deleteMany({
    where: { providerId: capagoProvider.id, monthKey: testMonthKey },
  });

  const draftSchedule = await appointmentEngine.createOrUpdateMonthlySchedule(
    {
      countryId: france.id,
      providerId: capagoProvider.id,
      visaTypeId: frShortStay.id,
      monthKey: testMonthKey,
      managementMode: 'AUTOMATIC_GENERATION',
      timezone: 'Asia/Baku',
      rule: {
        appointmentsPerDay: 2,
        appointmentTimesJson: ['09:30', '11:30'],
        capacityPerSlot: 5,
        workingDaysJson: [1, 2, 3, 4, 5],
        excludeWeekends: true,
        excludeLastDayOfMonth: true,
        excludePublicHolidays: true,
      },
    },
    adminUser.id
  );

  await appointmentEngine.generateMonthlyScheduleSlots(draftSchedule.id, adminUser.id);

  // Check BOTH getCustomerPublishedSlots AND legacy appointmentBookingService.getAvailableSlots
  const vcmsSlotsWhileDraft = await appointmentEngine.getCustomerPublishedSlots({
    countryId: france.id,
    visaTypeId: frShortStay.id,
    monthKey: testMonthKey,
  });
  assert.strictEqual(vcmsSlotsWhileDraft.slots.length, 0, 'VCMS endpoint must return 0 slots while schedule is DRAFT');

  const legacySlotsWhileDraft = await appointmentBookingService.getAvailableSlots(undefined, undefined, {
    countryId: france.id,
    visaTypeId: frShortStay.id,
  });
  const leakedDraftSlots = legacySlotsWhileDraft.filter((s) => s.monthKey === testMonthKey);
  assert.strictEqual(
    leakedDraftSlots.length,
    0,
    'Legacy /appointments/slots endpoint MUST NOT leak DRAFT schedule slots!'
  );

  // Now Publish Schedule!
  await appointmentEngine.publishAppointmentSchedule(draftSchedule.id, adminUser.id);
  const vcmsSlotsAfterPublish = await appointmentEngine.getCustomerPublishedSlots({
    countryId: france.id,
    visaTypeId: frShortStay.id,
    monthKey: testMonthKey,
    groupSize: 2,
  });
  assert(vcmsSlotsAfterPublish.slots.length > 0, 'Published slots must be visible after publish');
  const slotForIndividual = vcmsSlotsAfterPublish.slots[0];
  const slotForAgentGroup = vcmsSlotsAfterPublish.slots[1];
  const slotForCorporateBatch = vcmsSlotsAfterPublish.slots[2];
  const slotForReschedule = vcmsSlotsAfterPublish.slots[3];
  console.log(`   [PASS] DRAFT slots strictly hidden from all endpoints; ${vcmsSlotsAfterPublish.slots.length} slots visible after Publish.\n`);

  // ---------------------------------------------------------------------------
  // TEST 3: Individual Portal — Dossier Creation, €105 Fee, Multi-Applicant VCMS Answers Isolation
  // ---------------------------------------------------------------------------
  console.log('3. Testing Individual Portal Propagation (Dynamic Fee €105 + Multi-Applicant VCMS Answer Isolation)...');
  const indDossier = await dossierService.createDossier({
    userId: individualUser.id,
    portalType: 'INDIVIDUAL',
    countryId: france.id,
    visaTypeId: frShortStay.id,
    visaPurposeId: customPurpose.id,
    package: 'standard',
    applicantsCount: 2,
    applicants: [
      { firstName: 'Orxan', lastName: 'Memmedov', passportNumber: 'AZ100001' },
      { firstName: 'Nigar', lastName: 'Memmedova', passportNumber: 'AZ100002', familyRole: 'SPOUSE' },
    ],
  });
  assert.strictEqual(indDossier.visaTypeId, frShortStay.id, 'Individual dossier must store visaTypeId');
  assert.strictEqual(indDossier.visaPurposeId, customPurpose.id, 'Individual dossier must store visaPurposeId');
  assert.strictEqual(Number(indDossier.governmentFee), 105, 'Individual dossier governmentFee must use €105 override');
  assert.strictEqual(indDossier.applicants.length, 2, 'Individual dossier must have 2 applicants');

  const app1 = indDossier.applicants[0];
  const app2 = indDossier.applicants[1];

  // Save different VCMS answers for Applicant #1 and Applicant #2
  await vcmsService.saveApplicantQuestionAnswers({
    dossierId: indDossier.id,
    applicantId: app1.id,
    answers: [
      {
        questionCode: customPoolQ.questionCode,
        valueText: 'AI & Robotics, FinTech & Banking',
        selectedOptionCodes: [customPoolQ.options[0].optionCode, customPoolQ.options[1].optionCode],
      },
    ],
    actorId: individualUser.id,
  });
  await vcmsService.saveApplicantQuestionAnswers({
    dossierId: indDossier.id,
    applicantId: app2.id,
    answers: [
      {
        questionCode: customPoolQ.questionCode,
        valueText: 'GreenTech & Energy',
        selectedOptionCodes: [customPoolQ.options[2].optionCode],
      },
    ],
    actorId: individualUser.id,
  });

  const app1Loaded = await vcmsService.getApplicantAnswersAndSchema({
    dossierId: indDossier.id,
    applicantId: app1.id,
  });
  const app2Loaded = await vcmsService.getApplicantAnswersAndSchema({
    dossierId: indDossier.id,
    applicantId: app2.id,
  });

  assert.deepStrictEqual(
    app1Loaded.answersByQuestionCode[customPoolQ.questionCode].selectedOptionCodes,
    [customPoolQ.options[0].optionCode, customPoolQ.options[1].optionCode],
    'Applicant #1 answers must be isolated and intact'
  );
  assert.deepStrictEqual(
    app2Loaded.answersByQuestionCode[customPoolQ.questionCode].selectedOptionCodes,
    [customPoolQ.options[2].optionCode],
    'Applicant #2 answers must be isolated and not overwrite Applicant #1'
  );
  assert(
    app1Loaded.schema.documents.some((d) => d.documentCode === customPoolDoc.documentCode),
    'Individual applicant schema must include Admin custom document VivaTech Pass'
  );

  const indBooking = await appointmentBookingService.bookAppointment({
    userId: individualUser.id,
    dossierId: indDossier.id,
    timeSlotId: slotForIndividual.id,
  });
  assert(/^AP\d{3,}$/.test(indBooking.bookingCode), 'Individual booking must receive APxxx bookingCode');
  console.log(`   [PASS] Individual Portal received €105 fee, ${customPoolQ.questionCode}, ${customPoolDoc.documentCode}, isolated multi-applicant answers & booking ${indBooking.bookingCode}.\n`);

  // ---------------------------------------------------------------------------
  // TEST 4: Tour Operator (Travel Agent) Portal — createGroup with VCMS, Booking APxxx, Self-Fill VCMS
  // ---------------------------------------------------------------------------
  console.log('4. Testing Tour Operator (Agent) Portal Propagation (createGroup + APxxx + Guest Self-Fill VCMS)...');
  const createdGroup = await agentGroupService.createGroup({
    userId: agentUser.id,
    name: 'VivaTech Paris Tour Group',
    destination: 'France',
    countryId: france.id,
    visaTypeId: frShortStay.id,
    visaPurposeId: customPurpose.id,
    travelDate: '2027-01-20',
    duration: 'short',
    projectReason: customPurpose.nameEn,
    package: 'standard',
    timeSlotId: slotForAgentGroup.id,
    visaCenter: 'Capago Visa Application Centre',
    paymentMethod: 'INVOICE',
    applicants: [
      { firstName: 'Kamran', lastName: 'Aliyev', passportNumber: 'AZ200001' },
      { firstName: 'Aysel', lastName: 'Aliyeva', passportNumber: 'AZ200002' },
    ],
  });

  const groupDossier = createdGroup.dossiers[0];
  assert.strictEqual(groupDossier.countryId, france.id, 'Agent group dossier must link to France countryId');
  assert.strictEqual(groupDossier.visaTypeId, frShortStay.id, 'Agent group dossier must link to France Short Stay visaTypeId');
  assert.strictEqual(groupDossier.visaPurposeId, customPurpose.id, 'Agent group dossier must link to custom visaPurposeId');
  assert.strictEqual(Number(groupDossier.governmentFee), 105, 'Agent group dossier must use €105 consularFeeOverride per pax');

  const groupAppt = createdGroup.appointments[0];
  assert(groupAppt && /^AP\d{3,}$/.test(groupAppt.bookingCode), `Agent group appointment must have APxxx bookingCode, got ${groupAppt?.bookingCode}`);
  assert.strictEqual(groupAppt.groupSize, 2, 'Agent group appointment groupSize must be 2');

  // Verify Traveler Guest Self-Fill returns VCMS schema & saves VCMS answers
  const groupTraveler = groupDossier.applicants[0];
  const selfFillData = await agentTravelerService.getCustomerSelfFillData(createdGroup.id, groupTraveler.id);
  assert(selfFillData.vcms && selfFillData.vcms.schema, 'Guest self-fill must receive VCMS schema');
  assert(
    selfFillData.vcms.schema.questions.some((q) => q.questionCode === customPoolQ.questionCode),
    'Guest self-fill must include Admin custom question'
  );
  assert(
    selfFillData.vcms.schema.documents.some((d) => d.documentCode === customPoolDoc.documentCode),
    'Guest self-fill must include Admin custom required document'
  );

  await agentTravelerService.submitCustomerSelfFill(createdGroup.id, groupTraveler.id, {
    firstName: 'Kamran',
    lastName: 'Aliyev',
    passportNumber: 'AZ200001',
    vcmsAnswers: [
      {
        questionCode: customPoolQ.questionCode,
        valueText: 'AI & Robotics',
        selectedOptionCodes: [customPoolQ.options[0].optionCode],
      },
    ],
  });

  const verifySelfFill = await vcmsService.getApplicantAnswersAndSchema({
    dossierId: groupDossier.id,
    applicantId: groupTraveler.id,
  });
  assert.strictEqual(
    verifySelfFill.answersByQuestionCode[customPoolQ.questionCode]?.valueText,
    'AI & Robotics',
    'Traveler self-fill VCMS answer must be persisted in database'
  );
  console.log(`   [PASS] Tour Operator Group linked to VCMS (€105/pax), booked ${groupAppt.bookingCode} (2 pax), and guest self-fill saved ${customPoolQ.questionCode}.\n`);

  // ---------------------------------------------------------------------------
  // TEST 5: Corporate Partner Portal — createBatch with VCMS, groupSize, APxxx, Employee Delegation VCMS
  // ---------------------------------------------------------------------------
  console.log('5. Testing Corporate Partner Portal Propagation (createBatch + groupSize + APxxx + Delegation VCMS)...');
  const createdBatch = await corporateBatchService.createBatch({
    userId: corporateUser.id,
    name: 'SOCAR VivaTech Corporate Delegation',
    destination: 'France',
    countryId: france.id,
    visaTypeId: frShortStay.id,
    visaPurposeId: customPurpose.id,
    travelDate: '2027-01-22',
    duration: 'short',
    projectReason: customPurpose.nameEn,
    package: 'standard',
    timeSlotId: slotForCorporateBatch.id,
    visaCenter: 'Capago Visa Application Centre',
    paymentMethod: 'INVOICE',
    employees: [
      { firstName: 'Rashad', lastName: 'Hasanov', passportNumber: 'AZ300001', role: 'CTO', department: 'IT' },
      { firstName: 'Sabina', lastName: 'Hasanova', passportNumber: 'AZ300002', role: 'Lead AI', department: 'IT' },
      { firstName: 'Farid', lastName: 'Quliyev', passportNumber: 'AZ300003', role: 'VP', department: 'Management' },
    ],
  });

  const corpDossier = await prisma.dossier.findUnique({ where: { id: createdBatch.dossierId } });
  assert.strictEqual(corpDossier.countryId, france.id, 'Corporate dossier must link to France countryId');
  assert.strictEqual(corpDossier.visaTypeId, frShortStay.id, 'Corporate dossier must link to France Short Stay visaTypeId');
  assert.strictEqual(corpDossier.visaPurposeId, customPurpose.id, 'Corporate dossier must link to custom visaPurposeId');

  const corpAppt = createdBatch.appointment;
  assert(corpAppt && /^AP\d{3,}$/.test(corpAppt.bookingCode), `Corporate appointment must have APxxx bookingCode, got ${corpAppt?.bookingCode}`);
  assert.strictEqual(corpAppt.groupSize, 3, 'Corporate appointment groupSize MUST be 3 (batchSize)');

  // Test Corporate Employee Delegation Link & VCMS propagation
  const firstCorpApplicant = createdBatch.employees[0];
  const delLink = await corporateDelegationService.generateDelegationLink({
    corporateUserId: corporateUser.id,
    employeeId: firstCorpApplicant.id,
    batchId: createdBatch.id,
  });
  const delProfile = await corporateDelegationService.getDelegationProfile(delLink.delegationToken);
  assert(delProfile.vcms && delProfile.vcms.schema, 'Corporate delegation profile must include VCMS schema');
  assert(
    delProfile.vcms.schema.questions.some((q) => q.questionCode === customPoolQ.questionCode),
    'Corporate delegation profile must include Admin custom question'
  );

  await corporateDelegationService.submitDelegationForm({
    token: delLink.delegationToken,
    passportNumber: 'AZ300001',
    dob: '1990-05-15',
    passportExpiry: '2031-05-15',
    phone: '+994501112233',
    vcmsAnswers: [
      {
        questionCode: customPoolQ.questionCode,
        valueText: 'FinTech & Banking',
        selectedOptionCodes: [customPoolQ.options[1].optionCode],
      },
    ],
  });

  const verifyCorpAns = await vcmsService.getApplicantAnswersAndSchema({
    dossierId: corpDossier.id,
    applicantId: firstCorpApplicant.id,
  });
  assert.strictEqual(
    verifyCorpAns.answersByQuestionCode[customPoolQ.questionCode]?.valueText,
    'FinTech & Banking',
    'Corporate employee delegation VCMS answer must be saved on Applicant'
  );

  // Test Admin Reschedule of Corporate Appointment -> Notification visible to Corporate Partner
  const reschedCorp = await appointmentEngine.adminRescheduleBooking(
    corpAppt.id,
    {
      newTimeSlotId: slotForReschedule.id,
      adminNotes: 'Moved corporate batch to next available Capago slot',
      sendNotification: true,
    },
    adminUser.id
  );
  assert.strictEqual(reschedCorp.notification.type, 'SLOT_RESCHEDULED', 'Corporate reschedule notification must be emitted');

  const agentAppts = await agentAppointmentService.getAgentAppointments(agentUser.id);
  const foundAgentAppt = agentAppts.find((a) => a.id === groupAppt.id);
  assert(foundAgentAppt && foundAgentAppt.bookingCode === groupAppt.bookingCode, 'getAgentAppointments must return bookingCode');

  console.log(`   [PASS] Corporate Batch linked to VCMS, booked ${corpAppt.bookingCode} (groupSize=3), delegation saved ${customPoolQ.questionCode}, and reschedule notification verified.\n`);

  // ---------------------------------------------------------------------------
  // CLEANUP TEST ARTIFACTS
  // ---------------------------------------------------------------------------
  await agentGroupService.deleteGroup(createdGroup.id, agentUser.id);
  await corporateBatchService.deleteCorporateBatch(corporateUser.id, createdBatch.id);
  await prisma.appointment.deleteMany({ where: { dossierId: indDossier.id } });
  await prisma.dossier.delete({ where: { id: indDossier.id } });
  await prisma.timeSlot.deleteMany({
    where: { providerId: capagoProvider.id, monthKey: testMonthKey },
  });
  await prisma.appointmentSchedule.deleteMany({
    where: { providerId: capagoProvider.id, monthKey: testMonthKey },
  });
  await prisma.visaPurpose.delete({ where: { id: customPurpose.id } });
  await prisma.globalQuestion.delete({ where: { id: customPoolQ.id } });
  await prisma.globalDocument.delete({ where: { id: customPoolDoc.id } });

  console.log('================================================================================');
  console.log('ALL CROSS-MODULE VCMS & APPOINTMENT PROPAGATION E2E TESTS PASSED (100% GREEN)!');
  console.log('================================================================================');
}

runCrossModulePropagationTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[FAIL] CROSS-MODULE E2E TEST FAILED:', err);
    process.exit(1);
  });
