const assert = require('assert');
const prisma = require('./config/db');
const { bootstrapSystemData } = require('./core/bootstrap.service');
const authService = require('./modules/auth/auth.service');
const dossierService = require('./modules/dossier/dossier.service');
const templateService = require('./modules/template/template.service');
const appointmentService = require('./modules/appointment/appointment.service');
const documentService = require('./modules/document/document.service');
const path = require('path');
const fs = require('fs');

async function runZeroUserTest() {
  console.log('--- STARTING ZERO-STATE USER END-TO-END VERIFICATION ---');

  // 1. Run bootstrap to ensure MySQL has all reference data
  console.log('1. Verifying system bootstrap in MySQL...');
  await bootstrapSystemData(prisma);

  // 2. Register a brand new user from 0
  const uniqueId = Date.now();
  const testEmail = `zerouser_${uniqueId}@eurotech.az`;
  const testPassword = 'Password123!';
  const testFullName = 'Elvin Qasımov';
  const testPassport = `C${Math.floor(10000000 + Math.random() * 90000000)}`;

  console.log(`2. Registering new fresh user from zero: ${testEmail}...`);
  const registeredUser = await authService.register({
    email: testEmail,
    password: testPassword,
    fullName: testFullName,
    phone: '+994509998877',
    role: 'INDIVIDUAL',
    passportNumber: testPassport,
    preferredLanguage: 'az',
  });
  assert(registeredUser && registeredUser.id, 'User registration failed');
  console.log(`   ✓ User created with MySQL ID: ${registeredUser.id}`);

  // 3. User logs in
  console.log('3. User authenticates & fetches initial dashboard state...');
  const loginRes = await authService.login({ email: testEmail, password: testPassword });
  assert(loginRes && (loginRes.accessToken || loginRes.token), 'Login failed');

  // Verify user has 0 dossiers initially
  const initialDossiers = await dossierService.getUserDossiers(registeredUser.id);
  assert.strictEqual(initialDossiers.length, 0, 'New user should have exactly 0 dossiers');
  console.log('   ✓ Verified new user has exactly 0 dossiers in MySQL');

  // 4. Fetch available destination countries from real MySQL
  console.log('4. Fetching destination countries from database...');
  const countries = await templateService.getActiveCountries();
  assert(countries && countries.length >= 5, 'Should have at least 5 active countries in MySQL');
  const targetCountry = countries.find(c => c.code === 'HU') || countries[0];
  console.log(`   ✓ Found ${countries.length} destination countries. Selected: ${targetCountry.nameEn} (${targetCountry.code})`);

  // 5. Fetch visa categories for selected country from MySQL
  console.log(`5. Fetching visa categories for ${targetCountry.nameEn}...`);
  const categories = await templateService.getVisaCategoriesByCountry(targetCountry.id);
  assert(categories && categories.length > 0, 'Should have visa categories in MySQL');
  const targetCategory = categories.find(c => c.code === 'SCHENGEN_TOURIST') || categories[0];
  console.log(`   ✓ Found ${categories.length} categories. Selected: ${targetCategory.nameEn}`);
  assert(targetCategory.requiredDocTypes && targetCategory.requiredDocTypes.length > 0, 'Category should have real requiredDocTypes');
  console.log(`   ✓ Category includes ${targetCategory.requiredDocTypes.length} official required document types in MySQL`);

  // 6. User submits Wizard: creates dossier with primary applicant & co-applicant
  console.log('6. Submitting application wizard to MySQL...');
  const createdDossier = await dossierService.createDossier({
    userId: registeredUser.id,
    portalType: 'INDIVIDUAL',
    countryId: targetCountry.id,
    visaCategoryId: targetCategory.id,
    package: 'standard',
    applicants: [
      {
        firstName: 'Elvin',
        lastName: 'Qasımov',
        passportNumber: testPassport,
        nationality: 'AZ',
        gender: 'MALE',
        birthDate: '1995-04-12',
      },
      {
        firstName: 'Aysel',
        lastName: 'Qasımova',
        passportNumber: 'C87654321',
        nationality: 'AZ',
        gender: 'FEMALE',
        birthDate: '1998-08-25',
        familyRole: 'SPOUSE',
      }
    ]
  });

  assert(createdDossier && createdDossier.id, 'Dossier creation failed');
  assert(createdDossier.dossierNumber.startsWith('HU-AZ-2026-'), 'Dossier number format invalid');
  assert.strictEqual(createdDossier.applicants.length, 2, 'Dossier should have 2 applicants in MySQL');
  const primaryApp = createdDossier.applicants[0];
  const coApp = createdDossier.applicants[1];
  assert.strictEqual(primaryApp.firstName, 'Elvin', 'Primary applicant first name mismatch');
  assert.strictEqual(coApp.firstName, 'Aysel', 'Co-applicant first name mismatch');
  console.log(`   ✓ Dossier ${createdDossier.dossierNumber} created with 2 real applicants in MySQL`);

  // 7. Update primary applicant's consular form questionnaire
  console.log('7. Saving consular application questionnaire to MySQL...');
  const updatedApplicant = await dossierService.updateApplicantForm(createdDossier.id, primaryApp.id, {
    destination: targetCountry.nameEn,
    purpose: 'Tourism',
    firstEntry: targetCountry.nameEn,
    entriesRequested: 'Single',
    arrivalDate: '2026-12-01',
    departureDate: '2026-12-15',
    formProgress: 100,
  });
  assert(updatedApplicant.formDataJson && updatedApplicant.formDataJson.destination === targetCountry.nameEn, 'Form data not saved');
  console.log('   ✓ Consular questionnaire form draft saved to MySQL');

  // 8. Upload a real file for primary applicant
  console.log('8. Uploading official document to MySQL & disk...');
  const dummyFilePath = path.join(__dirname, 'test-temp-doc.pdf');
  // Minimal valid PDF binary
  const minimalPdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000102 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n';
  fs.writeFileSync(dummyFilePath, minimalPdf);

  const uploadedDoc = await documentService.uploadDocument({
    dossierId: createdDossier.id,
    applicantId: primaryApp.id,
    requiredDocumentType: 'PASSPORT',
    isMandatory: true,
    file: {
      path: dummyFilePath,
      filename: `passport_${uniqueId}.pdf`,
      originalname: 'Scan_Passport_Elvin.pdf',
      size: Buffer.byteLength(minimalPdf)
    }
  });
  assert(uploadedDoc && uploadedDoc.id, 'Document upload failed');
  console.log(`   ✓ Document ${uploadedDoc.fileName} saved to MySQL ApplicantDocument table`);
  if (fs.existsSync(dummyFilePath)) fs.unlinkSync(dummyFilePath);

  // 9. Book biometric appointment slot from real MySQL slots
  console.log('9. Booking biometric appointment slot in MySQL...');
  const availableSlots = await appointmentService.getAvailableSlots(new Date(), 'EuroTech Main Center');
  assert(availableSlots && availableSlots.length > 0, 'No appointment slots available in MySQL');
  const targetSlot = availableSlots[0];

  const appointment = await appointmentService.bookAppointment({
    userId: registeredUser.id,
    dossierId: createdDossier.id,
    timeSlotId: targetSlot.id,
  });
  assert(appointment && appointment.id, 'Appointment booking failed');
  console.log(`   ✓ Appointment booked for slot ${targetSlot.startTime} at ${targetSlot.location}`);

  // 10. Generate official Schengen PDF
  console.log('10. Generating Schengen Application Form PDF from database...');
  const pdfResult = await dossierService.generateApplicationFormPdf(createdDossier.id, primaryApp.id);
  assert(pdfResult && pdfResult.pdfBytes && pdfResult.pdfBytes.length > 1000, 'Schengen PDF generation failed');
  console.log(`   ✓ Schengen PDF AcroForm generated (${pdfResult.pdfBytes.length} bytes)`);

  // 11. Final verification: getUserDossiers returns fully populated real dossier
  console.log('11. Verifying user dashboard data from MySQL...');
  const finalDossiers = await dossierService.getUserDossiers(registeredUser.id);
  assert.strictEqual(finalDossiers.length, 1, 'User should now have exactly 1 active dossier');
  const userDossier = finalDossiers[0];
  assert.strictEqual(userDossier.applicants.length, 2, 'Should have 2 applicants');
  assert.strictEqual(userDossier.documents.length, 1, 'Should have 1 uploaded document');
  assert(userDossier.appointments && userDossier.appointments.length > 0, 'Should have booked appointment');
  console.log(`   ✓ Complete dossier verification passed! Dossier: ${userDossier.dossierNumber}`);

  // 12. Cleanup test data
  console.log('12. Cleaning up test user and dossier from MySQL...');
  await prisma.applicantDocument.deleteMany({ where: { dossierId: createdDossier.id } });
  await prisma.appointment.deleteMany({ where: { dossierId: createdDossier.id } });
  await prisma.applicant.deleteMany({ where: { dossierId: createdDossier.id } });
  await prisma.dossierStatusHistory.deleteMany({ where: { dossierId: createdDossier.id } });
  await prisma.dossier.delete({ where: { id: createdDossier.id } });
  await prisma.wallet.deleteMany({ where: { userId: registeredUser.id } });
  await prisma.user.delete({ where: { id: registeredUser.id } });
  console.log('   ✓ Test data purged cleanly.');

  console.log('\n======================================================');
  console.log('🎉 100% SUCCESS: ZERO-STATE REAL DATABASE USER JOURNEY PASSED!');
  console.log('======================================================\n');
}

runZeroUserTest()
  .then(() => {
    prisma.$disconnect();
    process.exit(0);
  })
  .catch((err) => {
    console.error('E2E TEST FAILURE:', err);
    prisma.$disconnect();
    process.exit(1);
  });
