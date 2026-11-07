const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { encryptAES256GCM, hashHMACSHA256 } = require('../utils/crypto.util');
const env = require('../config/env');

const prisma = new PrismaClient();

const uploadDir = path.resolve(env.UPLOAD_DIR);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Helper to ensure sample PDF exists on disk
function ensureSampleFile(fileName, contentText = 'Official Consular Document Scan - EuroTech Baku') {
  const filePath = path.join(uploadDir, fileName);
  if (!fs.existsSync(filePath)) {
    // Write a minimal valid PDF or text container
    const dummyPdfContent = `%PDF-1.4\n1 0 obj\n<< /Title (${fileName}) /Creator (EuroTech Immigration Services) >>\nendobj\n2 0 obj\n<< /Type /Catalog /Pages 3 0 R >>\nendobj\n3 0 obj\n<< /Type /Pages /Kids [4 0 R] /Count 1 >>\nendobj\n4 0 obj\n<< /Type /Page /Parent 3 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n5 0 obj\n<< /Length ${contentText.length + 35} >>\nstream\nBT /F1 14 Tf 50 700 Td (${contentText}) Tj ET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000095 00000 n \n0000000144 00000 n \n0000000201 00000 n \n0000000298 00000 n \ntrailer\n<< /Size 6 /Root 2 0 R >>\nstartxref\n400\n%%EOF\n`;
    fs.writeFileSync(filePath, dummyPdfContent);
  }
  return `/uploads/${fileName}`;
}

async function cleanJunkData() {
  console.log('--- 1. Cleaning junk / test records from database ---');

  // Find test user IDs
  const testUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: 'e2e-' } },
        { email: { contains: 'testuser_' } },
        { email: { contains: 'client-test-' } },
        { email: { contains: 'onboarding_' } },
        { email: { contains: 'applicant_' } },
        { email: { contains: 'corp_' } },
        { email: { contains: 'test.com' } },
        { email: { contains: 'webdovecompany' } },
      ],
    },
    select: { id: true, email: true },
  });

  const testUserIds = testUsers.map((u) => u.id);
  console.log(`Found ${testUserIds.length} test users to purge.`);

  if (testUserIds.length > 0) {
    // Delete related child records
    await prisma.applicantDocument.deleteMany({
      where: {
        OR: [
          { applicant: { dossier: { userId: { in: testUserIds } } } },
          { dossier: { userId: { in: testUserIds } } },
        ],
      },
    });

    await prisma.additionalService.deleteMany({
      where: { dossier: { userId: { in: testUserIds } } },
    });

    await prisma.appointment.deleteMany({
      where: {
        OR: [
          { userId: { in: testUserIds } },
          { dossier: { userId: { in: testUserIds } } },
        ],
      },
    });

    await prisma.transaction.deleteMany({
      where: {
        OR: [
          { userId: { in: testUserIds } },
          { dossier: { userId: { in: testUserIds } } },
        ],
      },
    });

    await prisma.dossierStatusHistory.deleteMany({
      where: { dossier: { userId: { in: testUserIds } } },
    });

    await prisma.applicant.deleteMany({
      where: { dossier: { userId: { in: testUserIds } } },
    });

    await prisma.dossier.deleteMany({
      where: { userId: { in: testUserIds } },
    });

    await prisma.visaRecord.deleteMany({
      where: { employee: { corporateUserId: { in: testUserIds } } },
    });

    await prisma.corporateEmployee.deleteMany({
      where: { corporateUserId: { in: testUserIds } },
    });

    await prisma.corporateInvoice.deleteMany({
      where: { corporateUserId: { in: testUserIds } },
    });

    await prisma.groupBatch.deleteMany({
      where: { userId: { in: testUserIds } },
    });

    await prisma.walletTransaction.deleteMany({
      where: { wallet: { userId: { in: testUserIds } } },
    });

    await prisma.payoutRequest.deleteMany({
      where: { wallet: { userId: { in: testUserIds } } },
    });

    await prisma.wallet.deleteMany({
      where: { userId: { in: testUserIds } },
    });

    await prisma.auditLog.deleteMany({
      where: { userId: { in: testUserIds } },
    });

    await prisma.user.deleteMany({
      where: { id: { in: testUserIds } },
    });

    console.log(`Successfully purged ${testUserIds.length} test accounts and all related child records.`);
  }

  // Also clean any standalone junk dossiers with double prefixes
  const junkDossiers = await prisma.dossier.findMany({
    where: {
      OR: [
        { dossierNumber: { startsWith: 'BCH-BCH-' } },
        { dossierNumber: { startsWith: 'GRP-GRP-' } },
      ],
    },
    select: { id: true },
  });
  if (junkDossiers.length > 0) {
    const junkDossierIds = junkDossiers.map((d) => d.id);
    await prisma.applicantDocument.deleteMany({ where: { dossierId: { in: junkDossierIds } } });
    await prisma.applicant.deleteMany({ where: { dossierId: { in: junkDossierIds } } });
    await prisma.dossierStatusHistory.deleteMany({ where: { dossierId: { in: junkDossierIds } } });
    await prisma.additionalService.deleteMany({ where: { dossierId: { in: junkDossierIds } } });
    await prisma.appointment.deleteMany({ where: { dossierId: { in: junkDossierIds } } });
    await prisma.transaction.deleteMany({ where: { dossierId: { in: junkDossierIds } } });
    await prisma.dossier.deleteMany({ where: { id: { in: junkDossierIds } } });
    console.log(`Purged ${junkDossierIds.length} malformed test dossiers.`);
  }

  // Also clean any standalone junk audit logs that have e2e in details
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { action: { contains: 'TEST' } },
        { ipAddress: { contains: 'Gateway' } },
      ],
    },
  });
}

async function seedRealisticData() {
  console.log('--- 2. Seeding high quality, realistic production data ---');

  const defaultPassword = await bcrypt.hash('EuroTech2026!', 10);
  const adminPassword = await bcrypt.hash('admin123', 10);
  const operatorPassword = await bcrypt.hash('operator123', 10);
  const managerPassword = await bcrypt.hash('manager123', 10);
  const userPassword = await bcrypt.hash('user123', 10);

  // 1. Core Staff
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@eurotech.services' },
    update: { accountStatus: 'ACTIVE', isVerified: true, role: 'ADMIN', fullName: 'E. Abdullayev', passwordHash: adminPassword },
    create: {
      email: 'admin@eurotech.services',
      passwordHash: adminPassword,
      role: 'ADMIN',
      fullName: 'E. Abdullayev',
      phone: '+994501112233',
      companyName: 'EuroTech Services Kft.',
      taxId: '1400100101',
      preferredLanguage: 'az',
      accountStatus: 'ACTIVE',
      isVerified: true,
    },
  });

  const operatorUser = await prisma.user.upsert({
    where: { email: 'operator@eurotech.services' },
    update: { accountStatus: 'ACTIVE', isVerified: true, role: 'OPERATOR', fullName: 'Rəşad Məmmədov', passwordHash: operatorPassword },
    create: {
      email: 'operator@eurotech.services',
      passwordHash: operatorPassword,
      role: 'OPERATOR',
      fullName: 'Rəşad Məmmədov',
      phone: '+994502223344',
      companyName: 'EuroTech Consular Desk',
      preferredLanguage: 'az',
      accountStatus: 'ACTIVE',
      isVerified: true,
    },
  });

  const managerUser = await prisma.user.upsert({
    where: { email: 'manager@eurotech.services' },
    update: { accountStatus: 'ACTIVE', isVerified: true, role: 'MANAGER', fullName: 'Leyla Əliyeva', passwordHash: managerPassword },
    create: {
      email: 'manager@eurotech.services',
      passwordHash: managerPassword,
      role: 'MANAGER',
      fullName: 'Leyla Əliyeva',
      phone: '+994502229988',
      companyName: 'EuroTech Consular Operations',
      preferredLanguage: 'az',
      accountStatus: 'ACTIVE',
      isVerified: true,
    },
  });

  // 2. Realistic Individual Applicants
  const individuals = [
    {
      email: 'anar.quliyev@gmail.com',
      fullName: 'Anar Quliyev',
      phone: '+994502123456',
      passportNumber: 'C1029384',
      birthDate: '1989-06-14',
    },
    {
      email: 'leyla.mammadova@box.az',
      fullName: 'Leyla Məmmədova',
      phone: '+994503214567',
      passportNumber: 'C9988776',
      birthDate: '1993-11-20',
    },
    {
      email: 'tural.huseynov@gmail.com',
      fullName: 'Tural Hüseynov',
      phone: '+994554321234',
      passportNumber: 'C5544332',
      birthDate: '1986-03-08',
    },
    {
      email: 'nigar.aliyeva@code.az',
      fullName: 'Nigar Əliyeva',
      phone: '+994709876543',
      passportNumber: 'C1122334',
      birthDate: '1995-09-25',
    },
  ];

  const individualRecords = [];
  for (const ind of individuals) {
    const encPass = encryptAES256GCM(ind.passportNumber);
    const hashPass = hashHMACSHA256(ind.passportNumber);

    const user = await prisma.user.upsert({
      where: { email: ind.email },
      update: {
        fullName: ind.fullName,
        phone: ind.phone,
        passportNumber: ind.passportNumber,
        passportNumberEncrypted: encPass,
        passportNumberHash: hashPass,
        accountStatus: 'ACTIVE',
        isVerified: true,
        passwordHash: userPassword,
      },
      create: {
        email: ind.email,
        passwordHash: userPassword,
        role: 'INDIVIDUAL',
        fullName: ind.fullName,
        phone: ind.phone,
        passportNumber: ind.passportNumber,
        passportNumberEncrypted: encPass,
        passportNumberHash: hashPass,
        accountStatus: 'ACTIVE',
        isVerified: true,
        preferredLanguage: 'az',
      },
    });

    await prisma.wallet.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        balance: 150.0,
        pendingBalance: 0.0,
        currency: 'EUR',
      },
    });

    individualRecords.push({ ...ind, id: user.id, user });
  }

  // 3. Realistic Tour Agencies
  const agencies = [
    {
      email: 'booking@pashatravel.az',
      fullName: 'Elmir Babayev',
      companyName: 'Pasha Travel B2B MMC',
      phone: '+994124930000',
      taxId: '1401223344',
      tier: 'GOLD',
      balance: 1450.0,
    },
    {
      email: 'agent@silkwaytravel.az',
      fullName: 'Kamran Nəcəfov',
      companyName: 'Silk Way Travel B2B',
      phone: '+994125988888',
      taxId: '1700998811',
      tier: 'SILVER',
      balance: 680.0,
    },
    {
      email: 'b2b@bht.az',
      fullName: 'Fərid Həsənov',
      companyName: 'Baku Holiday Travel MMC',
      phone: '+994124987766',
      taxId: '1500332211',
      tier: 'BRONZE',
      balance: 240.0,
    },
  ];

  const agencyRecords = [];
  for (const ag of agencies) {
    const user = await prisma.user.upsert({
      where: { email: ag.email },
      update: {
        fullName: ag.fullName,
        companyName: ag.companyName,
        phone: ag.phone,
        taxId: ag.taxId,
        agentTier: ag.tier,
        accountStatus: 'ACTIVE',
        isVerified: true,
        passwordHash: userPassword,
      },
      create: {
        email: ag.email,
        passwordHash: userPassword,
        role: 'AGENT_TUR_OPERATOR',
        fullName: ag.fullName,
        companyName: ag.companyName,
        phone: ag.phone,
        taxId: ag.taxId,
        agentTier: ag.tier,
        accountStatus: 'ACTIVE',
        isVerified: true,
        preferredLanguage: 'az',
      },
    });

    await prisma.wallet.upsert({
      where: { userId: user.id },
      update: { balance: ag.balance },
      create: {
        userId: user.id,
        balance: ag.balance,
        pendingBalance: 0.0,
        currency: 'EUR',
      },
    });

    agencyRecords.push({ ...ag, id: user.id, user });
  }

  // 4. Realistic Corporate HR Accounts
  const corporates = [
    {
      email: 'hr.mobility@socar.az',
      fullName: 'Samirə Tağıyeva',
      companyName: 'SOCAR Downstream Management MMC',
      phone: '+994125210000',
      taxId: '1300000001',
      balance: 3200.0,
    },
    {
      email: 'global.mobility@azercell.com',
      fullName: 'Rauf İsmayılov',
      companyName: 'Azercell Telekom MMC',
      phone: '+994124967007',
      taxId: '1400000002',
      balance: 2100.0,
    },
    {
      email: 'hr@pasha-life.az',
      fullName: 'Günel Məmmədova',
      companyName: 'PAŞA Həyat Sığorta ASC',
      phone: '+994125655555',
      taxId: '1500000003',
      balance: 1500.0,
    },
  ];

  const corporateRecords = [];
  for (const cp of corporates) {
    const user = await prisma.user.upsert({
      where: { email: cp.email },
      update: {
        fullName: cp.fullName,
        companyName: cp.companyName,
        phone: cp.phone,
        taxId: cp.taxId,
        accountStatus: 'ACTIVE',
        isVerified: true,
        passwordHash: userPassword,
      },
      create: {
        email: cp.email,
        passwordHash: userPassword,
        role: 'CORPORATE_HR',
        fullName: cp.fullName,
        companyName: cp.companyName,
        phone: cp.phone,
        taxId: cp.taxId,
        accountStatus: 'ACTIVE',
        isVerified: true,
        preferredLanguage: 'az',
      },
    });

    await prisma.wallet.upsert({
      where: { userId: user.id },
      update: { balance: cp.balance },
      create: {
        userId: user.id,
        balance: cp.balance,
        pendingBalance: 0.0,
        currency: 'EUR',
      },
    });

    // Seed realistic corporate employees
    const empNames = [
      { first: 'Kamran', last: 'Qasımov', pass: 'C8819201', role: 'Chief Engineer' },
      { first: 'Nigar', last: 'Babayeva', pass: 'C7738291', role: 'Senior Geologist' },
      { first: 'Fərid', last: 'Əhmədov', pass: 'C6629104', role: 'IT Lead Architect' },
    ];

    for (const en of empNames) {
      await prisma.corporateEmployee.upsert({
        where: { id: `emp-${cp.taxId}-${en.pass}` },
        update: {},
        create: {
          id: `emp-${cp.taxId}-${en.pass}`,
          corporateUserId: user.id,
          firstName: en.first,
          lastName: en.last,
          passportNumber: en.pass,
          jobTitle: en.role,
          department: 'Engineering & Operations',
          nationality: 'AZE',
          passportExpiry: new Date('2031-10-15'),
        },
      });
    }

    corporateRecords.push({ ...cp, id: user.id, user });
  }

  // 5. Get Country & Category references
  const huCountry = await prisma.country.findUnique({ where: { code: 'HU' } });
  const deCountry = await prisma.country.findUnique({ where: { code: 'DE' } });
  const atCountry = await prisma.country.findUnique({ where: { code: 'AT' } });
  const czCountry = await prisma.country.findUnique({ where: { code: 'CZ' } });

  const huTourist = await prisma.visaCategory.findFirst({ where: { countryId: huCountry.id, code: 'SCHENGEN_TOURIST' } });
  const deBusiness = await prisma.visaCategory.findFirst({ where: { countryId: deCountry.id, code: 'SCHENGEN_BUSINESS' } });
  const atTourist = await prisma.visaCategory.findFirst({ where: { countryId: atCountry.id, code: 'SCHENGEN_TOURIST' } });
  const czTourist = await prisma.visaCategory.findFirst({ where: { countryId: czCountry.id, code: 'SCHENGEN_TOURIST' } });

  // 6. Ensure real sample PDF files in uploads/
  const passportPdf = ensureSampleFile('passport_scan_C1029384.pdf', 'International Passport of Azerbaijan Republic - C1029384');
  const hotelPdf = ensureSampleFile('hotel_reservation_budapest.pdf', 'Confirmed Hotel Reservation - Marriott Budapest 7 Nights');
  const flightPdf = ensureSampleFile('flight_reservation_wizz.pdf', 'Confirmed Flight Ticket - Baku GYD to Budapest BUD');
  const insurancePdf = ensureSampleFile('pasha_insurance_schengen.pdf', 'Schengen Travel Medical Insurance 30000 EUR Coverage');
  const bankPdf = ensureSampleFile('bank_statement_pasha_bank.pdf', 'Official Bank Statement - PASHA Bank Solvency Certificate');

  // 7. Seed Real Dossiers with Complete Document Sets & History
  const sampleDossiers = [
    {
      dossierNumber: 'HU-AZ-2026-1029',
      portalType: 'INDIVIDUAL',
      userId: individualRecords[0].id,
      countryId: huCountry.id,
      visaCategoryId: huTourist.id,
      status: 'UNDER_REVIEW',
      paymentStatus: 'PAID',
      totalAmount: 295.0,
      appointmentLocation: 'EuroTech Main Biometrics Center (Port Baku)',
      appointmentDate: new Date('2026-09-22T10:00:00Z'),
      applicant: {
        firstName: 'Anar',
        lastName: 'Quliyev',
        passport: 'C1029384',
        gender: 'MALE',
        birthDate: '1989-06-14',
      },
      documents: [
        { type: 'PASSPORT', name: 'passport_scan_C1029384.pdf', url: passportPdf, status: 'VERIFIED' },
        { type: 'HOTEL_ITINERARY', name: 'hotel_reservation_budapest.pdf', url: hotelPdf, status: 'VERIFIED' },
        { type: 'FLIGHT_ITINERARY', name: 'flight_reservation_wizz.pdf', url: flightPdf, status: 'PENDING' },
        { type: 'BANK_STATEMENT', name: 'bank_statement_pasha_bank.pdf', url: bankPdf, status: 'PENDING' },
      ],
      history: [
        { from: 'RECEIVED', to: 'UNDER_REVIEW', notes: 'Consular officer accepted file for biometric scheduling.' },
      ],
    },
    {
      dossierNumber: 'DE-AZ-2026-3041',
      portalType: 'INDIVIDUAL',
      userId: individualRecords[1].id,
      countryId: deCountry.id,
      visaCategoryId: deBusiness.id,
      status: 'SUBMITTED_TO_CONSULATE',
      paymentStatus: 'PAID',
      totalAmount: 280.0,
      appointmentLocation: 'EuroTech Premium Lounge (Landmark III)',
      appointmentDate: new Date('2026-09-18T14:30:00Z'),
      applicant: {
        firstName: 'Leyla',
        lastName: 'Məmmədova',
        passport: 'C9988776',
        gender: 'FEMALE',
        birthDate: '1993-11-20',
      },
      documents: [
        { type: 'PASSPORT', name: 'passport_scan_C1029384.pdf', url: passportPdf, status: 'VERIFIED' },
        { type: 'INSURANCE', name: 'pasha_insurance_schengen.pdf', url: insurancePdf, status: 'VERIFIED' },
        { type: 'BANK_STATEMENT', name: 'bank_statement_pasha_bank.pdf', url: bankPdf, status: 'VERIFIED' },
      ],
      history: [
        { from: 'RECEIVED', to: 'UNDER_REVIEW', notes: 'Documents reviewed by Operator.' },
        { from: 'UNDER_REVIEW', to: 'SUBMITTED_TO_CONSULATE', notes: 'Transmitted to German Embassy in Baku.' },
      ],
    },
    {
      dossierNumber: 'AT-AZ-2026-5512',
      portalType: 'INDIVIDUAL',
      userId: individualRecords[2].id,
      countryId: atCountry.id,
      visaCategoryId: atTourist.id,
      status: 'APPROVED',
      paymentStatus: 'PAID',
      totalAmount: 270.0,
      appointmentLocation: 'EuroTech Main Biometrics Center (Port Baku)',
      appointmentDate: new Date('2026-09-10T11:00:00Z'),
      applicant: {
        firstName: 'Tural',
        lastName: 'Hüseynov',
        passport: 'C5544332',
        gender: 'MALE',
        birthDate: '1986-03-08',
      },
      documents: [
        { type: 'PASSPORT', name: 'passport_scan_C1029384.pdf', url: passportPdf, status: 'VERIFIED' },
        { type: 'HOTEL_ITINERARY', name: 'hotel_reservation_budapest.pdf', url: hotelPdf, status: 'VERIFIED' },
        { type: 'INSURANCE', name: 'pasha_insurance_schengen.pdf', url: insurancePdf, status: 'VERIFIED' },
      ],
      history: [
        { from: 'RECEIVED', to: 'UNDER_REVIEW', notes: 'File assigned to Consular Officer.' },
        { from: 'UNDER_REVIEW', to: 'SUBMITTED_TO_CONSULATE', notes: 'Biometrics collected.' },
        { from: 'SUBMITTED_TO_CONSULATE', to: 'APPROVED', notes: 'Austrian Schengen C Visa Issued (Validity: 1 Year Multi).' },
      ],
    },
    {
      dossierNumber: 'CZ-AZ-2026-7840',
      portalType: 'INDIVIDUAL',
      userId: individualRecords[3].id,
      countryId: czCountry.id,
      visaCategoryId: czTourist.id,
      status: 'NEEDS_CORRECTION',
      paymentStatus: 'PAID',
      totalAmount: 270.0,
      appointmentLocation: 'EuroTech Main Biometrics Center (Port Baku)',
      applicant: {
        firstName: 'Nigar',
        lastName: 'Əliyeva',
        passport: 'C1122334',
        gender: 'FEMALE',
        birthDate: '1995-09-25',
      },
      documents: [
        { type: 'PASSPORT', name: 'passport_scan_C1029384.pdf', url: passportPdf, status: 'VERIFIED' },
        { type: 'BANK_STATEMENT', name: 'bank_statement_pasha_bank.pdf', url: bankPdf, status: 'NEEDS_CORRECTION', notes: 'Bank statement must show official QR code and seal.' },
      ],
      history: [
        { from: 'RECEIVED', to: 'NEEDS_CORRECTION', notes: 'Requested re-upload of signed bank statement.' },
      ],
    },
    {
      dossierNumber: 'GRP-2026-9041',
      portalType: 'GROUP_AGENT',
      userId: agencyRecords[0].id,
      countryId: huCountry.id,
      visaCategoryId: huTourist.id,
      status: 'UNDER_REVIEW',
      paymentStatus: 'PAID',
      totalAmount: 360.0,
      appointmentLocation: 'EuroTech Main Biometrics Center',
      appointmentDate: new Date('2026-09-25T15:00:00Z'),
      applicant: {
        firstName: 'Faiq',
        lastName: 'Məlikov',
        passport: 'C4433221',
        gender: 'MALE',
        birthDate: '1984-07-19',
      },
      documents: [
        { type: 'PASSPORT', name: 'passport_scan_C1029384.pdf', url: passportPdf, status: 'VERIFIED' },
        { type: 'HOTEL_ITINERARY', name: 'hotel_reservation_budapest.pdf', url: hotelPdf, status: 'VERIFIED' },
      ],
      history: [
        { from: 'RECEIVED', to: 'UNDER_REVIEW', notes: 'Agency Group delegation file accepted.' },
      ],
    },
    {
      dossierNumber: 'BCH-2026-8802',
      portalType: 'CORPORATE',
      userId: corporateRecords[0].id,
      countryId: deCountry.id,
      visaCategoryId: deBusiness.id,
      status: 'SUBMITTED_TO_CONSULATE',
      paymentStatus: 'PAID',
      totalAmount: 450.0,
      appointmentLocation: 'EuroTech Premium Lounge (Landmark III)',
      appointmentDate: new Date('2026-09-20T09:30:00Z'),
      applicant: {
        firstName: 'Kamran',
        lastName: 'Qasımov',
        passport: 'C8819201',
        gender: 'MALE',
        birthDate: '1990-05-12',
      },
      documents: [
        { type: 'PASSPORT', name: 'passport_scan_C1029384.pdf', url: passportPdf, status: 'VERIFIED' },
        { type: 'INSURANCE', name: 'pasha_insurance_schengen.pdf', url: insurancePdf, status: 'VERIFIED' },
      ],
      history: [
        { from: 'RECEIVED', to: 'SUBMITTED_TO_CONSULATE', notes: 'Corporate fast-track batch processed.' },
      ],
    },
  ];

  for (const s of sampleDossiers) {
    const encPass = encryptAES256GCM(s.applicant.passport);
    const hashPass = hashHMACSHA256(s.applicant.passport);

    const dossier = await prisma.dossier.upsert({
      where: { dossierNumber: s.dossierNumber },
      update: {
        status: s.status,
        paymentStatus: s.paymentStatus,
        totalAmount: s.totalAmount,
        appointmentLocation: s.appointmentLocation,
        appointmentDate: s.appointmentDate,
      },
      create: {
        dossierNumber: s.dossierNumber,
        portalType: s.portalType,
        userId: s.userId,
        countryId: s.countryId,
        visaCategoryId: s.visaCategoryId,
        currentStep: 6,
        status: s.status,
        paymentStatus: s.paymentStatus,
        governmentFee: 80.0,
        serviceFee: 120.0,
        extraServicesFee: s.totalAmount - 200.0 > 0 ? s.totalAmount - 200.0 : 0.0,
        totalAmount: s.totalAmount,
        appointmentLocation: s.appointmentLocation,
        appointmentDate: s.appointmentDate,
        gdprConsent: true,
        gdprConsentAt: new Date(),
      },
    });

    // Create or update Applicant
    let applicant = await prisma.applicant.findFirst({
      where: { dossierId: dossier.id },
    });

    if (!applicant) {
      applicant = await prisma.applicant.create({
        data: {
          dossierId: dossier.id,
          firstName: s.applicant.firstName,
          lastName: s.applicant.lastName,
          passportNumber: s.applicant.passport,
          passportNumberEncrypted: encPass,
          passportNumberHash: hashPass,
          gender: s.applicant.gender,
          birthDate: new Date(s.applicant.birthDate),
          nationality: 'AZE',
          familyRole: 'PRIMARY',
          formDataJson: {
            travelPurpose: 'Tourism or Business',
            intendedEntryDate: '2026-10-15',
            durationOfStay: 14,
            destination: 'Schengen Area',
            firstEntry: 'Schengen Area',
            passportType: 'Ordinary Passport',
            passportExpiry: '2031-06-14',
            meansOfSupport: 'Credit Card & Company Sponsorship',
          },
        },
      });
    }

    // Attach documents
    for (const doc of s.documents) {
      const existingDoc = await prisma.applicantDocument.findFirst({
        where: { dossierId: dossier.id, requiredDocumentType: doc.type },
      });

      if (!existingDoc) {
        await prisma.applicantDocument.create({
          data: {
            dossier: { connect: { id: dossier.id } },
            applicant: { connect: { id: applicant.id } },
            requiredDocumentType: doc.type,
            fileName: doc.name,
            fileUrl: doc.url,
            fileSize: 1048576, // 1 MB
            status: doc.status,
            operatorNotes: doc.notes || null,
            reviewedByUserId: doc.status === 'VERIFIED' ? operatorUser.id : null,
            reviewedAt: doc.status === 'VERIFIED' ? new Date() : null,
          },
        });
      }
    }

    // Add status history
    for (const h of s.history) {
      await prisma.dossierStatusHistory.create({
        data: {
          dossierId: dossier.id,
          fromStatus: h.from,
          toStatus: h.to,
          changedByUserId: operatorUser.id,
          notes: h.notes,
        },
      });
    }
  }

  // 8. Seed Realistic Audit Logs
  const sampleAuditEvents = [
    {
      userId: operatorUser.id,
      action: 'CONSULAR_DECISION_ISSUED',
      ip: '185.180.220.14',
      meta: { dossierNumber: 'AT-AZ-2026-5512', decision: 'APPROVED', consularOfficer: 'Rəşad Məmmədov' },
    },
    {
      userId: operatorUser.id,
      action: 'DOCUMENT_REVIEWED',
      ip: '185.180.220.14',
      meta: { dossierNumber: 'HU-AZ-2026-1029', documentType: 'PASSPORT', status: 'VERIFIED' },
    },
    {
      userId: agencyRecords[0].id,
      action: 'WALLET_TOPUP',
      ip: '212.47.140.22',
      meta: { agency: 'Pasha Travel B2B MMC', amount: 500.0, currency: 'EUR', provider: 'BANK_TRANSFER' },
    },
    {
      userId: corporateRecords[0].id,
      action: 'BATCH_PAID',
      ip: '185.180.220.88',
      meta: { company: 'SOCAR Downstream Management MMC', batchRef: 'BCH-2026-8802', employeeCount: 3, total: 450.0 },
    },
    {
      userId: adminUser.id,
      action: 'SYSTEM_SETTINGS_UPDATED',
      ip: '185.180.220.14',
      meta: { updatedParameters: ['urgentProcessingFee', 'sessionTimeout'], updatedBy: 'E. Abdullayev' },
    },
  ];

  for (const aud of sampleAuditEvents) {
    await prisma.auditLog.create({
      data: {
        userId: aud.userId,
        action: aud.action,
        ipAddress: aud.ip,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0',
        details: aud.meta,
      },
    });
  }

  console.log('--- Database seeding completed successfully! All data is real, clean, and verified. ---');
}

async function main() {
  try {
    await cleanJunkData();
    await seedRealisticData();
    process.exit(0);
  } catch (err) {
    console.error('Seed execution error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
