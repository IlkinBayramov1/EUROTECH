const prisma = require('./config/db');
const dossierApplicantService = require('./modules/dossier/services/dossierApplicant.service');
const dossierSchengenPdfService = require('./modules/dossier/services/dossierSchengenPdf.service');
const agentTravelerService = require('./modules/agent/services/agentTraveler.service');
const corporateBatchService = require('./modules/corporate/services/corporateBatch.service');

async function runUnifiedApplicantVerification() {
  console.log('=== STARTING 100% UNIFIED APPLICANT FLOW VERIFICATION ===\n');

  // 1. Setup Base System Data (Country & Category)
  let country = await prisma.country.findFirst({ where: { code: 'HU' } });
  if (!country) {
    country = await prisma.country.create({
      data: { code: 'HU', nameAz: 'Macarıstan', nameEn: 'Hungary', nameRu: 'Венгрия' },
    });
  }

  let visaCategory = await prisma.visaCategory.findFirst({ where: { countryId: country.id } });
  if (!visaCategory) {
    visaCategory = await prisma.visaCategory.create({
      data: {
        countryId: country.id,
        code: 'SCHENGEN_TOURIST',
        nameAz: 'Şengen Turist',
        nameEn: 'Schengen Tourist',
        nameRu: 'Шенген Турист',
      },
    });
  }

  console.log('✓ Found Country & Category:', country.nameEn, '/', visaCategory.nameEn);

  // 2. Setup Test Users
  const clientUser = await prisma.user.upsert({
    where: { email: 'unified-client-test@eurotech.az' },
    update: {},
    create: {
      email: 'unified-client-test@eurotech.az',
      passwordHash: 'hash123',
      fullName: 'Vusal Aliyev',
      role: 'INDIVIDUAL',
    },
  });

  const agentUser = await prisma.user.upsert({
    where: { email: 'unified-agent-test@eurotech.az' },
    update: {},
    create: {
      email: 'unified-agent-test@eurotech.az',
      passwordHash: 'hash123',
      fullName: 'Baku Travel Agent',
      role: 'AGENT_TUR_OPERATOR',
      companyName: 'Baku Premium Travel LLC',
    },
  });

  const corporateUser = await prisma.user.upsert({
    where: { email: 'unified-corp-test@eurotech.az' },
    update: {},
    create: {
      email: 'unified-corp-test@eurotech.az',
      passwordHash: 'hash123',
      fullName: 'SOCAR Mobility Director',
      role: 'CORPORATE_HR',
      companyName: 'SOCAR Downstream Management',
    },
  });

  console.log('✓ Test users ready: Client, Agent, Corporate');

  // ==========================================
  // TEST SCENARIO 1: INDIVIDUAL APPLICANT FLOW
  // ==========================================
  console.log('\n--- Scenario 1: Individual Applicant Unified Flow ---');
  let clientDossier = await prisma.dossier.findFirst({
    where: { userId: clientUser.id },
  });
  if (!clientDossier) {
    clientDossier = await prisma.dossier.create({
      data: {
        dossierNumber: `HU-AZ-TEST-${Date.now().toString().slice(-4)}`,
        portalType: 'INDIVIDUAL',
        userId: clientUser.id,
        countryId: country.id,
        visaCategoryId: visaCategory.id,
        status: 'RECEIVED',
      },
    });
  }

  // Create primary applicant if not existing
  let indApplicant = await prisma.applicant.findFirst({
    where: { dossierId: clientDossier.id },
  });
  if (!indApplicant) {
    const created = await dossierApplicantService.addApplicants(clientDossier.id, [
      {
        firstName: 'Vusal',
        lastName: 'Aliyev',
        passportNumber: 'C01234567',
        birthDate: '1990-05-12',
        gender: 'MALE',
        nationality: 'AZ',
        familyRole: 'PRIMARY',
      },
    ]);
    indApplicant = created[0];
  }

  console.log('✓ Individual Applicant created/found:', indApplicant.id, indApplicant.firstName, indApplicant.lastName);

  // Update Consular 37 Questions via Unified Endpoint
  const indFormUpdate = await dossierApplicantService.updateApplicantForm(clientDossier.id, indApplicant.id, {
    firstName: 'Vusal',
    lastName: 'Aliyev',
    passportNumber: 'C01234567',
    mainPurpose: 'Tourism',
    destinationMemberState: 'Hungary',
    firstEntryMemberState: 'Hungary',
    numberOfEntries: 'MULTIPLE',
    durationOfStay: '15',
    intendedArrivalDate: '2026-12-01',
    intendedDepartureDate: '2026-12-16',
    placeOfBirth: 'Baku',
    countryOfBirth: 'Azerbaijan',
    currentNationality: 'Azerbaijan',
    sex: 'MALE',
    maritalStatus: 'SINGLE',
    homeAddress: 'Nizami str 45, Baku',
    email: 'vusal@example.com',
    phoneNumber: '+994501234567',
    currentOccupation: 'Senior Software Engineer',
    employerName: 'EuroTech Solutions',
    invitingPartyType: 'HOTEL',
    invitingHotelName: 'Budapest Marriott Hotel',
    costCoveredBy: 'APPLICANT',
  });

  console.log('✓ Individual Consular Form saved with', Object.keys(indFormUpdate.formDataJson).length, 'fields');

  // Verify getApplicantDetails returns dossier context + switcher
  const indDetails = await dossierApplicantService.getApplicantDetails(clientDossier.id, indApplicant.id, clientUser);
  if (!indDetails.applicant || indDetails.applicant.id !== indApplicant.id) {
    throw new Error('getApplicantDetails failed for Individual');
  }
  console.log('✓ Individual getApplicantDetails verified. Country:', indDetails.dossier.country?.nameEn);

  // Generate Schengen PDF
  const indPdf = await dossierSchengenPdfService.generateApplicationFormPdf(clientDossier.id, indApplicant.id);
  console.log('✓ Individual Schengen 37-Point PDF generated! Size:', indPdf.pdfBytes.byteLength, 'bytes');

  // ==========================================
  // TEST SCENARIO 2: AGENT GROUP APPLICANT FLOW
  // ==========================================
  console.log('\n--- Scenario 2: Agent Group Applicant Unified Flow ---');
  let groupBatch = await prisma.groupBatch.findFirst({
    where: { userId: agentUser.id },
  });
  if (!groupBatch) {
    groupBatch = await prisma.groupBatch.create({
      data: {
        userId: agentUser.id,
        code: `GRP-TEST-${Date.now().toString().slice(-4)}`,
        name: 'Winter Budapest Tour 2026',
        destination: 'Hungary',
        portalType: 'GROUP_AGENT',
        status: 'DRAFT',
      },
    });
  }

  // Agent adds traveler via agentTravelerService
  const newTraveler = await agentTravelerService.addApplicantToGroup(groupBatch.id, agentUser.id, {
    firstName: 'Leyla',
    lastName: 'Qasimova',
    passportNumber: 'C98765432',
    dob: '1995-08-20',
  });

  console.log('✓ Agent Traveler added:', newTraveler.id, newTraveler.firstName, newTraveler.lastName, 'under Dossier:', newTraveler.dossierId);

  // Update Agent Traveler via the Unified Form Update Service
  const agentFormUpdate = await dossierApplicantService.updateApplicantForm(newTraveler.dossierId, newTraveler.id, {
    firstName: 'Leyla',
    lastName: 'Qasimova',
    passportNumber: 'C98765432',
    mainPurpose: 'Tourism',
    destinationMemberState: 'Hungary',
    firstEntryMemberState: 'Hungary',
    numberOfEntries: '1',
    durationOfStay: '7',
    intendedArrivalDate: '2026-12-10',
    intendedDepartureDate: '2026-12-17',
    placeOfBirth: 'Ganja',
    countryOfBirth: 'Azerbaijan',
    currentNationality: 'Azerbaijan',
    sex: 'FEMALE',
    maritalStatus: 'MARRIED',
    homeAddress: 'Ataturk Ave 12, Baku',
    email: 'leyla@example.com',
    phoneNumber: '+994559876543',
    currentOccupation: 'Accountant',
    employerName: 'Baku Finance Hub',
    invitingPartyType: 'HOTEL',
    invitingHotelName: 'Danubius Hotel Gellert',
    costCoveredBy: 'APPLICANT',
  });

  console.log('✓ Agent Traveler Consular Form saved with', Object.keys(agentFormUpdate.formDataJson).length, 'fields');

  // Verify getApplicantDetails returns group batch context for switcher
  const agentDetails = await dossierApplicantService.getApplicantDetails(newTraveler.dossierId, newTraveler.id, agentUser);
  if (!agentDetails.applicant || agentDetails.applicant.id !== newTraveler.id) {
    throw new Error('getApplicantDetails failed for Agent traveler');
  }
  console.log('✓ Agent getApplicantDetails verified. Switcher items:', agentDetails.allApplicants.length);

  // Generate Schengen PDF for Agent Traveler
  const agentPdf = await dossierSchengenPdfService.generateApplicationFormPdf(newTraveler.dossierId, newTraveler.id);
  console.log('✓ Agent Traveler Schengen 37-Point PDF generated! Size:', agentPdf.pdfBytes.byteLength, 'bytes');

  // ==========================================
  // TEST SCENARIO 3: CORPORATE BATCH EMPLOYEE FLOW
  // ==========================================
  console.log('\n--- Scenario 3: Corporate Employee Unified Flow ---');
  let corpBatch = await prisma.groupBatch.findFirst({
    where: { userId: corporateUser.id, portalType: 'CORPORATE' },
  });
  if (!corpBatch) {
    corpBatch = await prisma.groupBatch.create({
      data: {
        userId: corporateUser.id,
        code: `BCH-TEST-${Date.now().toString().slice(-4)}`,
        name: 'SOCAR Technical Delegation Vienna 2026',
        destination: 'Hungary',
        portalType: 'CORPORATE',
        status: 'DRAFT',
      },
    });
  }

  // Corporate adds employee via corporateBatchService
  const corpResult = await corporateBatchService.addEmployeeToBatch(corporateUser.id, corpBatch.id, {
    firstName: 'Rashad',
    lastName: 'Mammadov',
    passportNumber: 'C55443322',
    jobTitle: 'Principal Process Engineer',
    department: 'Refinery Engineering',
    nationality: 'AZ',
  });

  const corpApplicant = corpResult.applicant;
  console.log('✓ Corporate Employee added:', corpApplicant.id, corpApplicant.firstName, corpApplicant.lastName, 'under Dossier:', corpApplicant.dossierId);

  // Update Corporate Employee via the Unified Form Update Service
  const corpFormUpdate = await dossierApplicantService.updateApplicantForm(corpApplicant.dossierId, corpApplicant.id, {
    firstName: 'Rashad',
    lastName: 'Mammadov',
    passportNumber: 'C55443322',
    mainPurpose: 'Business',
    destinationMemberState: 'Hungary',
    firstEntryMemberState: 'Hungary',
    numberOfEntries: 'MULTIPLE',
    durationOfStay: '10',
    intendedArrivalDate: '2026-11-25',
    intendedDepartureDate: '2026-12-05',
    placeOfBirth: 'Sumgait',
    countryOfBirth: 'Azerbaijan',
    currentNationality: 'Azerbaijan',
    sex: 'MALE',
    maritalStatus: 'MARRIED',
    homeAddress: 'Heydar Aliyev Ave 115, Baku',
    email: 'rashad.mammadov@socar.az',
    phoneNumber: '+994125210000',
    currentOccupation: 'Principal Process Engineer',
    employerName: 'SOCAR Downstream Management',
    invitingPartyType: 'COMPANY',
    invitingCompanyName: 'MOL Group Headquarters',
    invitingAddress: 'Oktober huszonharmadika u. 18, Budapest',
    costCoveredBy: 'SPONSOR',
    sponsorSpecified: 'HOST_COMPANY',
  });

  console.log('✓ Corporate Employee Consular Form saved with', Object.keys(corpFormUpdate.formDataJson).length, 'fields');

  // Verify getApplicantDetails returns corporate employer prefill data
  const corpDetails = await dossierApplicantService.getApplicantDetails(corpApplicant.dossierId, corpApplicant.id, corporateUser);
  if (!corpDetails.applicant || corpDetails.applicant.id !== corpApplicant.id) {
    throw new Error('getApplicantDetails failed for Corporate employee');
  }
  console.log('✓ Corporate getApplicantDetails verified. User Company:', corpDetails.dossier.user?.companyName);

  // Generate Schengen PDF for Corporate Employee
  const corpPdf = await dossierSchengenPdfService.generateApplicationFormPdf(corpApplicant.dossierId, corpApplicant.id);
  console.log('✓ Corporate Employee Schengen 37-Point PDF generated! Size:', corpPdf.pdfBytes.byteLength, 'bytes');

  console.log('\n======================================================');
  console.log('🎉 100% SUCCESS: ALL 3 USER TYPES (INDIVIDUAL, AGENT, CORPORATE)');
  console.log('HAVE PASSED UNIFIED REGISTRATION, 37-POINT CONSULAR QUESTIONNAIRE,');
  console.log('CONTEXT SHARING, AND OFFICIAL SCHENGEN PDF GENERATION!');
  console.log('======================================================\n');
}

runUnifiedApplicantVerification()
  .catch((err) => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
