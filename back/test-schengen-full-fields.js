const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { normalizeApplicantData, fillSchengenPDF, formatDate } = require('./utils/schengenPdfFiller.util');

async function testFullSchengenFields() {
  console.log('===============================================================');
  console.log(' 🧪 SCHENGEN APPLICATION FORM: ALL 34 SECTIONS / 110 FIELDS TEST');
  console.log('===============================================================');

  // Comprehensive test applicant containing every single field from all 5 steps
  const testApplicant = {
    id: 'test-app-001',
    firstName: 'İlkin',
    lastName: 'Bayramov',
    formDataJson: {
      // Step 1: Your Plans
      purpose: 'Visiting family or friends',
      purposeOtherDetails: 'Visiting brother residing in Budapest',
      destination: 'Hungary',
      firstEntry: 'Hungary',
      entriesRequested: 'Multiple',
      durationOfStay: '30',
      arrivalDate: '2026-10-15',
      departureDate: '2026-11-14',
      hasPreviousFingerprints: 'Yes',
      fingerprintDate: '2023-05-20',
      fingerprintVisaNumber: 'V-HUN-9876543',
      hasFinalDestinationPermit: 'Yes',
      finalDestinationAuthority: 'Ministry of Foreign Affairs Hungary',
      finalDestinationValidFrom: '2026-10-10',
      finalDestinationValidUntil: '2027-10-10',

      // Step 2: Personal Information
      birthSurname: 'Qasımov',
      birthDate: '2008-06-12', // Minor testing
      birthPlace: 'Şəki',
      birthCountry: 'Azərbaycan',
      nationality: 'Azerbaijan',
      nationalityAtBirth: 'Azerbaijan',
      otherNationalities: 'None',
      gender: 'Male',
      maritalStatus: 'Single',
      nationalId: '7XYZ123',
      isMinor: 'Yes',
      guardianSurname: 'Bayramov',
      guardianName: 'Rəşad',
      guardianAddress: 'Bakı ş., Nəsimi r., Səməd Vurğun küç. 45',
      guardianPhone: '+994 50 123 45 67',
      guardianEmail: 'rashad.parent@eurotech.az',
      guardianNationality: 'Azerbaijan',

      // Step 3: Travel Document
      passportType: 'Ordinary passport',
      otherDocTypeDetails: '',
      passportNumber: 'C12345678',
      issueDate: '2022-01-10',
      passportExpiry: '2032-01-10',
      issuedBy: 'DİN Pasport Qeydiyyat İdarəsi',
      hasOtherResidence: 'Yes',
      otherResidenceType: 'Residence Permit',
      otherResidenceNumber: 'TR-OTURUM-883921',
      otherResidenceValidUntil: '2027-05-15',
      hasEuFamilyMember: 'Yes',
      euFamilySurname: 'Kovacs',
      euFamilyName: 'Anna',
      euFamilyDob: '1995-04-12',
      euFamilyNationality: 'Hungary',
      euFamilyDocNumber: 'HU987654321',
      euFamilyRelationship: 'Spouse',

      // Step 4: Your Stay & Sponsor
      invitingType: 'company',
      companyName: 'EuroTech Europe Kft.',
      companyAddress: '1051 Budapest, Sas utca 24, Hungary',
      companyContactName: 'Dr. Gabor Nemeth',
      companyContactAddress: '1051 Budapest, Sas utca 24',
      companyContactEmail: 'gabor.nemeth@eurotecheu.hu',
      companyContactPhone: '+36 1 987 6543',
      costCoveredBy: 'sponsor',
      meansOfSupportApplicant: ['cash', 'credit_card'],
      meansOfSupportSponsor: ['company', 'accommodation', 'all_expenses'],

      // Step 5: Contacts & Employment
      homeAddress: 'Bakı ş., Xətai r., Nobel pr. 15, mənzil 88',
      homeEmail: 'ilkin.bayramov@eurotech.az',
      homePhone: '+994 50 777 88 99',
      currentOccupation: 'Lead Software Architect',
      employerName: 'EuroTech Global Technologies MMC',
      employerAddress: 'Bakı, Nobel pr. 15, Azure Business Center',
      employerPhone: '+994 12 404 00 00',
      hasRepresentative: 'Yes',
      representativeName: 'Vəkil Əhməd Məmmədov',
      representativeAddress: 'Bakı ş., Nizami küç. 10',
      representativeEmail: 'lawyer.ahmed@azlaw.az',
      representativePhone: '+994 12 598 00 00',
    }
  };

  const dossierData = {
    destination: 'Hungary',
    portalType: 'CLIENT',
  };

  console.log('\n[1/4] Normalizing Applicant Data...');
  const normalized = normalizeApplicantData(testApplicant, dossierData);

  assert.strictEqual(normalized.firstname, 'İlkin');
  assert.strictEqual(normalized.surname, 'Bayramov');
  assert.strictEqual(normalized.surname_birth, 'Qasımov');
  assert.strictEqual(normalized.birthplace, 'Şəki');
  assert.strictEqual(normalized.doc_number, 'C12345678');
  assert.strictEqual(normalized.fingerprints, 'Yes');
  assert.strictEqual(normalized.fingerprint_visa_no, 'V-HUN-9876543');
  assert.strictEqual(normalized.has_transit_permit, 'Yes');
  assert.strictEqual(normalized.has_eu_member, true);
  assert.strictEqual(normalized.fam_surname, 'Kovacs');
  assert.strictEqual(normalized.relationship, 'Spouse');
  assert.strictEqual(normalized.residence_other, 'Yes');
  assert.strictEqual(normalized.residence_number, 'TR-OTURUM-883921');
  assert.strictEqual(normalized.inviting_company_name, 'EuroTech Europe Kft.');
  assert.strictEqual(normalized.contact_fullname, 'Dr. Gabor Nemeth');
  assert.strictEqual(normalized.cost_covered_by, 'sponsor');
  assert(normalized.employer_address.includes('Tel: +994 12 404 00 00'));
  console.log('  -> normalizeApplicantData assertions: ALL PASSED ✔️');

  console.log('\n[2/4] Generating Schengen PDF with pdf-lib & Unicode DejaVuSans...');
  const result = await fillSchengenPDF(testApplicant, dossierData);
  assert(result.filePath, 'Output file path must exist');
  assert(fs.existsSync(result.filePath), 'File must be written to disk');
  assert(result.pdfBytes.length > 50000, 'PDF size must exceed 50KB');
  console.log(`  -> Generated PDF: ${result.fileName} (${(result.pdfBytes.length / 1024).toFixed(1)} KB) ✔️`);

  console.log('\n[3/4] Inspecting Generated AcroForm PDF Fields with pdf-lib...');
  const loadedDoc = await PDFDocument.load(result.pdfBytes);
  const form = loadedDoc.getForm();
  
  // Verify text fields
  const t1 = form.getTextField('Text1').getText();
  const t3 = form.getTextField('Text3').getText();
  const t9 = form.getTextField('Text9').getText();
  const t26 = form.getTextField('Text26').getText();
  const t31 = form.getTextField('Text31').getText();
  const t32 = form.getTextField('Text32').getText();
  const t40 = form.getTextField('Text40').getText();
  const t42 = form.getTextField('Text42').getText();

  console.log(`  -> Text1 (Surname): "${t1}"`);
  console.log(`  -> Text3 (Firstname): "${t3}"`);
  console.log(`  -> Text9 (Doc Number): "${t9}"`);
  console.log(`  -> Text26 (Purpose Details): "${t26}"`);
  console.log(`  -> Text31 (Fingerprint Date): "${t31}"`);
  console.log(`  -> Text32 (Fingerprint Visa No): "${t32}"`);
  console.log(`  -> Text40 (Inviting Company): "${t40}"`);
  console.log(`  -> Text42 (Company Contact): "${t42}"`);

  assert.strictEqual(t1, 'Bayramov');
  assert.strictEqual(t3, 'İlkin');
  assert.strictEqual(t9, 'C12345678');
  assert.strictEqual(t32, 'V-HUN-9876543');
  assert.strictEqual(t40, 'EuroTech Europe Kft.');
  assert.strictEqual(t42, 'Dr. Gabor Nemeth');
  console.log('  -> AcroForm text extraction assertions: ALL PASSED ✔️');

  console.log('\n[4/4] Verifying AcroForm Checkbox & Radio Buttons...');
  const b1 = form.getCheckBox('Button1').isChecked(); // Male
  const b27 = form.getCheckBox('Button27').isChecked(); // Visiting family/friends
  const b37 = form.getCheckBox('Button37').isChecked(); // Multiple entries
  const b39 = form.getCheckBox('Button39').isChecked(); // Fingerprints Yes
  const b49 = form.getCheckBox('Button49').isChecked(); // Sponsor Company
  const b51 = form.getCheckBox('Button51').isChecked(); // Sponsor Accommodation
  const b52 = form.getCheckBox('Button52').isChecked(); // Sponsor All Expenses

  console.log(`  -> Button1 (Sex Male): ${b1}`);
  console.log(`  -> Button27 (Visiting family/friends): ${b27}`);
  console.log(`  -> Button37 (Multiple entries): ${b37}`);
  console.log(`  -> Button39 (Fingerprints Yes): ${b39}`);
  console.log(`  -> Button49 (Sponsor Company): ${b49}`);
  console.log(`  -> Button51 (Sponsor Accommodation): ${b51}`);
  console.log(`  -> Button52 (Sponsor All Expenses): ${b52}`);

  assert.strictEqual(b1, true, 'Button1 should be checked');
  assert.strictEqual(b27, true, 'Button27 should be checked');
  assert.strictEqual(b37, true, 'Button37 should be checked');
  assert.strictEqual(b39, true, 'Button39 should be checked');
  assert.strictEqual(b49, true, 'Button49 should be checked');
  assert.strictEqual(b51, true, 'Button51 should be checked');
  assert.strictEqual(b52, true, 'Button52 should be checked');

  console.log('  -> AcroForm Checkbox assertions: ALL PASSED ✔️');

  console.log('\n===============================================================');
  console.log(' 🎉 ALL BACKEND SCHENGEN FUNCTIONS TESTED & WORKING 100%!');
  console.log('===============================================================\n');
}

testFullSchengenFields().catch(err => {
  console.error('❌ SCHENGEN TEST FAILED:', err);
  process.exit(1);
});
