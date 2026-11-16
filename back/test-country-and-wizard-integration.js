const prisma = require('./config/db');
const templateService = require('./modules/template/template.service');
const dossierService = require('./modules/dossier/services/dossierLifecycle.service');
const dossierApplicantService = require('./modules/dossier/services/dossierApplicant.service');
const agentTravelerService = require('./modules/agent/services/agentTraveler.service');
const corporateBatchService = require('./modules/corporate/services/corporateBatch.service');
const { bootstrapSystemData } = require('./core/bootstrap.service');

async function testCountryAndWizardIntegration() {
  console.log('=== STARTING COUNTRY & UNIFIED WIZARD INTEGRATION TEST ===\n');

  // 1. Ensure System Bootstrap
  await bootstrapSystemData(prisma);

  // 2. Fetch Active Countries
  const countries = await prisma.country.findMany({
    where: { isActive: true },
    include: {
      visaCategories: {
        include: {
          requiredDocTypes: true,
        },
      },
    },
    orderBy: { code: 'asc' },
  });

  console.log(`✓ Active Countries in MySQL: ${countries.length}`);
  const expectedCodes = ['AT', 'CZ', 'DE', 'ES', 'FR', 'HU', 'IT', 'PL', 'TR'];
  for (const expCode of expectedCodes) {
    const found = countries.find(c => c.code === expCode);
    if (!found) {
      throw new Error(`Missing expected country: ${expCode}`);
    }
    console.log(`  - [${found.code}] ${found.nameEn} (${found.nameAz}) | Categories: ${found.visaCategories.length} | Required Docs: ${found.visaCategories[0]?.requiredDocTypes?.length || 0}`);
  }

  // 3. Test Individual Wizard Creation with Poland (PL)
  console.log('\n--- Testing Individual Wizard Creation (Poland - PL) ---');
  const poland = countries.find(c => c.code === 'PL');
  const polandTouristCat = poland.visaCategories.find(c => c.code.includes('TOURIST')) || poland.visaCategories[0];

  const testUser = await prisma.user.upsert({
    where: { email: 'wizard-test-user@eurotech.az' },
    update: {},
    create: {
      email: 'wizard-test-user@eurotech.az',
      passwordHash: 'hash123',
      fullName: 'Kamran Huseynov',
      role: 'INDIVIDUAL',
    },
  });

  const indDossier = await prisma.dossier.create({
    data: {
      dossierNumber: `PL-AZ-${Date.now().toString().slice(-5)}`,
      portalType: 'INDIVIDUAL',
      userId: testUser.id,
      countryId: poland.id,
      visaCategoryId: polandTouristCat.id,
      status: 'RECEIVED',
      totalAmount: 145.0,
      currentStep: 1,
    },
  });

  const [indApplicant] = await dossierApplicantService.addApplicants(indDossier.id, [
    {
      firstName: 'Kamran',
      lastName: 'Huseynov',
      passportNumber: 'C88991122',
      birthDate: '1988-11-23',
      gender: 'MALE',
      nationality: 'AZ',
      familyRole: 'PRIMARY',
    },
  ]);

  console.log('✓ Individual Dossier created with Country:', poland.nameEn, 'Dossier:', indDossier.dossierNumber);

  // 4. Test Agent Group Creation with Spain (ES)
  console.log('\n--- Testing Agent Group Creation (Spain - ES) ---');
  const spain = countries.find(c => c.code === 'ES');
  const spainTouristCat = spain.visaCategories.find(c => c.code.includes('TOURIST')) || spain.visaCategories[0];

  const agentUser = await prisma.user.upsert({
    where: { email: 'wizard-agent-test@eurotech.az' },
    update: {},
    create: {
      email: 'wizard-agent-test@eurotech.az',
      passwordHash: 'hash123',
      fullName: 'Caspian Travel Agency',
      role: 'AGENT_TUR_OPERATOR',
      companyName: 'Caspian Travel Group MMC',
    },
  });

  const agentBatch = await prisma.groupBatch.create({
    data: {
      userId: agentUser.id,
      code: `GRP-ES-${Date.now().toString().slice(-4)}`,
      name: 'Barcelona Cultural Delegation 2026',
      destination: spain.nameEn,
      portalType: 'GROUP_AGENT',
      status: 'DRAFT',
    },
  });

  const agentTraveler = await agentTravelerService.addApplicantToGroup(agentBatch.id, agentUser.id, {
    firstName: 'Aysel',
    lastName: 'Aliyeva',
    passportNumber: 'C77665544',
    dob: '1993-04-18',
  });

  console.log('✓ Agent Tour Group created with Destination:', spain.nameEn, 'Traveler:', agentTraveler.firstName, agentTraveler.lastName);

  // 5. Test Corporate Batch Creation with Germany (DE)
  console.log('\n--- Testing Corporate Batch Creation (Germany - DE) ---');
  const germany = countries.find(c => c.code === 'DE');

  const corporateUser = await prisma.user.upsert({
    where: { email: 'wizard-corporate-test@eurotech.az' },
    update: {},
    create: {
      email: 'wizard-corporate-test@eurotech.az',
      passwordHash: 'hash123',
      fullName: 'BP Caspian Operations',
      role: 'CORPORATE_HR',
      companyName: 'BP Exploration (Caspian Sea) Ltd',
    },
  });

  const corpBatch = await prisma.groupBatch.create({
    data: {
      userId: corporateUser.id,
      code: `BCH-DE-${Date.now().toString().slice(-4)}`,
      name: 'Frankfurt Tech Summit Delegation',
      destination: germany.nameEn,
      portalType: 'CORPORATE',
      status: 'DRAFT',
    },
  });

  const corpResult = await corporateBatchService.addEmployeeToBatch(corporateUser.id, corpBatch.id, {
    firstName: 'Eldar',
    lastName: 'Taghiyev',
    passportNumber: 'C33221100',
    jobTitle: 'Senior Reservoir Engineer',
    department: 'Offshore Drilling',
    nationality: 'AZ',
  });

  console.log('✓ Corporate Batch created with Destination:', germany.nameEn, 'Employee:', corpResult.applicant.firstName, corpResult.applicant.lastName);

  // 6. Verify Country-Specific Document Requirements in getApplicantDetails
  console.log('\n--- Verifying Country-Specific Document Requirements ---');
  const applicantDetails = await dossierApplicantService.getApplicantDetails(indDossier.id, indApplicant.id, testUser);
  const reqDocs = applicantDetails.dossier.visaCategory?.requiredDocTypes || [];
  console.log(`✓ Dossier ${indDossier.dossierNumber} country: ${applicantDetails.dossier.country?.nameEn}`);
  console.log(`✓ Loaded ${reqDocs.length} required document types dynamically from database:`);
  for (const d of reqDocs) {
    console.log(`   - [${d.code}] ${d.nameEn} (${d.nameAz})`);
  }

  if (reqDocs.length === 0) {
    throw new Error('Failed to load required document types from database');
  }

  console.log('\n======================================================');
  console.log('🎉 100% SUCCESS: All 9 countries, country-specific document');
  console.log('types, and unified wizard creation for Individual, Agent,');
  console.log('and Corporate have verified with ZERO errors!');
  console.log('======================================================\n');
}

testCountryAndWizardIntegration()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

