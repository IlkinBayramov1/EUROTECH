const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { encryptAES256GCM, hashHMACSHA256 } = require('../utils/crypto.util');

const prisma = new PrismaClient();

const REQUIRED_DOCS_TEMPLATE = [
  {
    code: 'PASSPORT',
    nameAz: 'Pasport surəti',
    nameEn: 'Passport Copy',
    nameRu: 'Копия паспорта',
    isRequired: true,
  },
  {
    code: 'PHOTO',
    nameAz: 'Biometrik foto',
    nameEn: 'Biometric Photo',
    nameRu: 'Биометрическое фото',
    isRequired: true,
  },
  {
    code: 'FORM',
    nameAz: 'Doldurulmuş ərizə forması',
    nameEn: 'Completed Application Form',
    nameRu: 'Заполненная анкета',
    isRequired: true,
  },
  {
    code: 'BANK_STATEMENT',
    nameAz: 'Bank çıxarışı (3 ay)',
    nameEn: 'Bank Statement (3 months)',
    nameRu: 'Выписка из банка (3 месяца)',
    isRequired: true,
  },
  {
    code: 'HOTEL_ITINERARY',
    nameAz: 'Otel/İtinerarium',
    nameEn: 'Hotel Booking / Itinerary',
    nameRu: 'Бронь отеля',
    isRequired: true,
  },
  {
    code: 'INSURANCE',
    nameAz: 'Səyahət sığortası polisi',
    nameEn: 'Travel Insurance Policy',
    nameRu: 'Страховой полис',
    isRequired: false,
  },
];

async function ensureVisaCategory(countryId, categoryDef) {
  let existing = await prisma.visaCategory.findFirst({
    where: { countryId, code: categoryDef.code },
  });

  if (!existing) {
    existing = await prisma.visaCategory.create({
      data: {
        countryId,
        code: categoryDef.code,
        nameAz: categoryDef.nameAz,
        nameEn: categoryDef.nameEn,
        nameRu: categoryDef.nameRu,
        baseFee: categoryDef.baseFee,
        descriptionAz: categoryDef.descriptionAz,
        descriptionEn: categoryDef.descriptionEn,
        descriptionRu: categoryDef.descriptionRu,
        dynamicFields: {
          create: [
            {
              fieldName: 'travelPurpose',
              labelAz: 'Səfər məqsədi',
              labelEn: 'Purpose of Travel',
              labelRu: 'Цель поездки',
              fieldType: 'SELECT',
              isRequired: true,
              optionsJson: ['Tourism', 'Business', 'Visiting Family or Friends'],
            },
            {
              fieldName: 'intendedEntryDate',
              labelAz: 'Planlaşdırılan daxilolma tarixi',
              labelEn: 'Intended Entry Date',
              labelRu: 'Планируемая дата въезда',
              fieldType: 'DATE',
              isRequired: true,
            },
          ],
        },
        requiredDocTypes: {
          create: REQUIRED_DOCS_TEMPLATE,
        },
      },
    });
  }
  return existing;
}

async function main() {
  console.log('Seeding EUROTECH initial database data...');

  const adminPassword = await bcrypt.hash('admin123', 10);
  const operatorPassword = await bcrypt.hash('operator123', 10);
  const managerPassword = await bcrypt.hash('manager123', 10);
  const userPassword = await bcrypt.hash('user123', 10);

  const encryptedSamplePassport = encryptAES256GCM('C12345678');
  const hashedSamplePassport = hashHMACSHA256('C12345678');

  await prisma.user.upsert({
    where: { email: 'admin@eurotech.services' },
    update: { accountStatus: 'ACTIVE', isVerified: true, role: 'ADMIN', passwordHash: adminPassword },
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

  await prisma.user.upsert({
    where: { email: 'operator@eurotech.services' },
    update: { accountStatus: 'ACTIVE', isVerified: true, role: 'OPERATOR', passwordHash: operatorPassword },
    create: {
      email: 'operator@eurotech.services',
      passwordHash: operatorPassword,
      role: 'OPERATOR',
      fullName: 'Rəşad Məmmədov',
      phone: '+994502223344',
      companyName: 'EuroTech Services',
      preferredLanguage: 'az',
      accountStatus: 'ACTIVE',
      isVerified: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'manager@eurotech.services' },
    update: { accountStatus: 'ACTIVE', isVerified: true, role: 'MANAGER', passwordHash: managerPassword },
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

  const individualUser = await prisma.user.upsert({
    where: { email: 'mammadov@gmail.com' },
    update: {
      passwordHash: userPassword,
      accountStatus: 'ACTIVE',
      isVerified: true,
      passportNumberEncrypted: encryptedSamplePassport,
      passportNumberHash: hashedSamplePassport,
    },
    create: {
      email: 'mammadov@gmail.com',
      passwordHash: userPassword,
      role: 'INDIVIDUAL',
      fullName: 'Reşad Məmmədov',
      phone: '+994503334455',
      preferredLanguage: 'az',
      passportNumber: 'C12345678',
      passportNumberEncrypted: encryptedSamplePassport,
      passportNumberHash: hashedSamplePassport,
      accountStatus: 'ACTIVE',
      isVerified: true,
    },
  });

  const agentUser = await prisma.user.upsert({
    where: { email: 'agent@baku-tours.az' },
    update: { passwordHash: userPassword, accountStatus: 'ACTIVE', isVerified: true, agentTier: 'SILVER', taxId: '1400293841' },
    create: {
      email: 'agent@baku-tours.az',
      passwordHash: userPassword,
      role: 'AGENT_TUR_OPERATOR',
      fullName: 'Baku Tours Agent',
      phone: '+994124445566',
      companyName: 'Baku Tours MMC',
      taxId: '1400293841',
      agentTier: 'SILVER',
      preferredLanguage: 'az',
      accountStatus: 'ACTIVE',
      isVerified: true,
    },
  });

  const corporateUser = await prisma.user.upsert({
    where: { email: 'hr@corp.az' },
    update: { passwordHash: userPassword, accountStatus: 'ACTIVE', isVerified: true, taxId: '1701992831' },
    create: {
      email: 'hr@corp.az',
      passwordHash: userPassword,
      role: 'CORPORATE_HR',
      fullName: 'Elvin Ağayev',
      phone: '+994505556677',
      companyName: 'Corp Tech Azerbaijan MMC',
      taxId: '1701992831',
      preferredLanguage: 'az',
      accountStatus: 'ACTIVE',
      isVerified: true,
    },
  });

  // Seed Countries (including Austria AT!)
  const countriesData = [
    { code: 'HU', nameAz: 'Macarıstan', nameEn: 'Hungary', nameRu: 'Венгрия', flagUrl: 'https://flagcdn.com/w80/hu.png' },
    { code: 'DE', nameAz: 'Almaniya', nameEn: 'Germany', nameRu: 'Германия', flagUrl: 'https://flagcdn.com/w80/de.png' },
    { code: 'AT', nameAz: 'Avstriya', nameEn: 'Austria', nameRu: 'Австрия', flagUrl: 'https://flagcdn.com/w80/at.png' },
    { code: 'CZ', nameAz: 'Çexiya', nameEn: 'Czech Republic', nameRu: 'Чехия', flagUrl: 'https://flagcdn.com/w80/cz.png' },
    { code: 'TR', nameAz: 'Türkiyə', nameEn: 'Turkey', nameRu: 'Турция', flagUrl: 'https://flagcdn.com/w80/tr.png' },
  ];

  const countriesMap = {};
  for (const c of countriesData) {
    countriesMap[c.code] = await prisma.country.upsert({
      where: { code: c.code },
      update: { nameAz: c.nameAz, nameEn: c.nameEn, nameRu: c.nameRu, flagUrl: c.flagUrl },
      create: { ...c, isActive: true },
    });
  }

  // Seed Visa Categories for all countries idempotently
  let huSchengenCategory = null;
  for (const code of ['HU', 'DE', 'AT', 'CZ']) {
    const touristCat = await ensureVisaCategory(countriesMap[code].id, {
      code: 'SCHENGEN_TOURIST',
      nameAz: 'Şengen turist (C)',
      nameEn: 'Schengen Tourist (C)',
      nameRu: 'Шенген турист (C)',
      baseFee: 80.0,
      descriptionAz: 'Qısamüddətli Şengen turist vizası müraciəti.',
      descriptionEn: 'Short-stay Schengen Tourist Visa application.',
      descriptionRu: 'Краткосрочная туристическая виза Шенген.',
    });
    if (code === 'HU') huSchengenCategory = touristCat;

    await ensureVisaCategory(countriesMap[code].id, {
      code: 'SCHENGEN_BUSINESS',
      nameAz: 'Şengen biznes / ezamiyyət (C)',
      nameEn: 'Schengen Business (C)',
      nameRu: 'Шенген бизнес (C)',
      baseFee: 80.0,
      descriptionAz: 'İşgüzar səfər və korporativ ezamiyyət vizası.',
      descriptionEn: 'Short-stay Schengen Business & Corporate Mobility Visa.',
      descriptionRu: 'Деловая шенгенская виза.',
    });
  }

  await ensureVisaCategory(countriesMap.TR.id, {
    code: 'WORK_PERMIT',
    nameAz: 'Milli iş / təhsil vizası (D)',
    nameEn: 'National Work / Study Visa (D)',
    nameRu: 'Национальная виза (D)',
    baseFee: 90.0,
    descriptionAz: 'Uzunmüddətli milli viza müraciəti.',
    descriptionEn: 'Long-stay National D Visa application.',
    descriptionRu: 'Долгосрочная национальная виза.',
  });

  // Seed System Settings
  const defaultSettings = [
    { key: 'BASE_CURRENCY', value: 'EUR', valueType: 'STRING', description: 'Sistemin baza hesablama valyutası' },
    { key: 'EUR_TO_AZN_RATE', value: '1.85', valueType: 'NUMBER', description: '1 EUR üçün AZN konvertasiya məzənnəsi' },
    { key: 'INDIVIDUAL_SERVICE_FEE', value: '120.00', valueType: 'NUMBER', description: 'Fərdi müraciət xidmət haqqı (EUR)' },
    { key: 'AGENT_SERVICE_FEE', value: '90.00', valueType: 'NUMBER', description: 'Tur agent qrup xidmət haqqı (EUR)' },
    { key: 'CORPORATE_SERVICE_FEE', value: '150.00', valueType: 'NUMBER', description: 'Korporativ ezamiyyət xidmət haqqı (EUR)' },
    { key: 'EXPRESS_PROCESSING_FEE', value: '60.00', valueType: 'NUMBER', description: 'Sürətləndirilmiş baxılma rüsumu (EUR)' },
    { key: 'ENABLE_OTP_VERIFICATION', value: 'false', valueType: 'BOOLEAN', description: 'Qeydiyyat zamanı məcburi OTP doğrulaması' },
  ];

  for (const s of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }

  // Seed Sample Dossier (HU-AZ-2026-04891)
  await prisma.dossier.upsert({
    where: { dossierNumber: 'HU-AZ-2026-04891' },
    update: {},
    create: {
      dossierNumber: 'HU-AZ-2026-04891',
      portalType: 'INDIVIDUAL',
      userId: individualUser.id,
      countryId: countriesMap.HU.id,
      visaCategoryId: huSchengenCategory.id,
      currentStep: 8,
      status: 'UNDER_REVIEW',
      appointmentDate: new Date('2026-08-19T10:15:00Z'),
      appointmentLocation: 'EuroTech Main Center',
      governmentFee: 80.0,
      serviceFee: 120.0,
      extraServicesFee: 95.0,
      totalAmount: 295.0,
      paymentStatus: 'PAID',
      gdprConsent: true,
      gdprConsentAt: new Date(),
      applicants: {
        create: [
          {
            firstName: 'Reşad',
            lastName: 'Məmmədov',
            passportNumber: 'C12345678',
            passportNumberEncrypted: encryptedSamplePassport,
            passportNumberHash: hashedSamplePassport,
            familyRole: 'PRIMARY',
            formDataJson: { travelPurpose: 'Tourism', intendedEntryDate: '2026-09-15' },
          },
        ],
      },
    },
  });

  // Seed TimeSlots idempotently for next 14 days across all 3 Visa Centers
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const slotTimes = ['09:00 AM', '10:30 AM', '14:00 PM', '16:00 PM'];
  const centers = ['EuroTech Main Center', 'EuroTech Premium Lounge', 'Ganja Regional Center'];

  for (let i = 1; i <= 14; i++) {
    const slotDate = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    if (slotDate.getDay() === 0) continue; // Skip Sundays
    for (const location of centers) {
      for (const timeStr of slotTimes) {
        const exists = await prisma.timeSlot.findFirst({
          where: { date: slotDate, startTime: timeStr, location },
        });
        if (!exists) {
          await prisma.timeSlot.create({
            data: {
              date: slotDate,
              startTime: timeStr,
              capacity: location === 'EuroTech Premium Lounge' ? 8 : 20,
              bookedCount: 0,
              location,
              isActive: true,
            },
          });
        }
      }
    }
  }

  // Seed Agent Wallet
  await prisma.wallet.upsert({
    where: { userId: agentUser.id },
    update: {},
    create: {
      userId: agentUser.id,
      balance: 480.0,
      pendingBalance: 0.0,
      currency: 'EUR',
      transactions: {
        create: [
          {
            amount: 480.0,
            type: 'CREDIT',
            referenceType: 'COMMISSION',
            referenceId: 'SEED-GRP-8821',
            description: 'Commission: Seed Partner Group (24 Pax)',
            status: 'PAID',
          },
        ],
      },
    },
  });

  // Seed Corporate Wallet, Departments & Initial Employee idempotently
  await prisma.wallet.upsert({
    where: { userId: corporateUser.id },
    update: {},
    create: {
      userId: corporateUser.id,
      balance: 5000.0,
      currency: 'EUR',
      transactions: {
        create: [
          {
            amount: 5000.0,
            type: 'CREDIT',
            referenceType: 'TOPUP',
            description: 'Initial Corporate Retainer (Wire Transfer)',
            status: 'PAID',
          },
        ],
      },
    },
  });

  const defaultDepts = [
    { name: 'Engineering', annualBudget: 60000 },
    { name: 'Sales & Business Development', annualBudget: 45000 },
    { name: 'Executive Management', annualBudget: 40000 },
    { name: 'Operations', annualBudget: 35000 },
  ];
  for (const dept of defaultDepts) {
    const existingDept = await prisma.corporateDepartment.findFirst({
      where: { corporateUserId: corporateUser.id, name: dept.name },
    });
    if (!existingDept) {
      await prisma.corporateDepartment.create({
        data: {
          corporateUserId: corporateUser.id,
          name: dept.name,
          annualBudget: dept.annualBudget,
          spentBudget: 0,
          currency: 'EUR',
        },
      });
    }
  }

  const existingEmp = await prisma.corporateEmployee.findFirst({
    where: { corporateUserId: corporateUser.id, passportNumber: 'P1234567' },
  });
  if (!existingEmp) {
    await prisma.corporateEmployee.create({
      data: {
        corporateUserId: corporateUser.id,
        firstName: 'David',
        lastName: 'Smith',
        jobTitle: 'Senior Software Engineer',
        department: 'Engineering',
        nationality: 'United Kingdom',
        passportNumber: 'P1234567',
        passportExpiry: new Date('2030-05-14'),
        email: 'd.smith@corp.az',
        phone: '+44 7700 900077',
        visaHistory: {
          create: [
            {
              country: 'Austria',
              type: 'Schengen C (Business)',
              issueDate: new Date('2026-06-01'),
              expiryDate: new Date('2027-06-01'),
              status: 'ACTIVE',
              batchRef: 'BCH-2026-101',
            },
          ],
        },
      },
    });
  }

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
