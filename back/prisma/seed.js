const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

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
  console.log('Seeding EUROTECH production database (Core Admin & System Config only)...');

  // 1. Single Master Admin Account
  const adminPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@eurotech.services' },
    update: {
      accountStatus: 'ACTIVE',
      isVerified: true,
      role: 'ADMIN',
      fullName: 'E. Abdullayev',
      passwordHash: adminPassword,
    },
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
  console.log(`[Admin] Ensured active master admin account: ${adminUser.email}`);

  // 2. Seed Destination Countries
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
  console.log(`[Countries] Ensured ${countriesData.length} European destination countries.`);

  // 3. Seed Visa Categories & Dynamic Fields
  for (const code of ['HU', 'DE', 'AT', 'CZ']) {
    await ensureVisaCategory(countriesMap[code].id, {
      code: 'SCHENGEN_TOURIST',
      nameAz: 'Şengen turist (C)',
      nameEn: 'Schengen Tourist (C)',
      nameRu: 'Шенген турист (C)',
      baseFee: 80.0,
      descriptionAz: 'Qısamüddətli Şengen turist vizası müraciəti.',
      descriptionEn: 'Short-stay Schengen Tourist Visa application.',
      descriptionRu: 'Краткосрочная туристическая виза Шенген.',
    });

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
  console.log('[VisaCategories] Ensured Schengen Tourist, Business & National D visa categories.');

  // 4. Seed Essential System Settings (Only Non-Pricing Core Flags; All Fees & Packages Managed by Admin)
  const defaultSettings = [
    { key: 'BASE_CURRENCY', value: 'EUR', valueType: 'STRING', description: 'Sistemin baza hesablama valyutası' },
    { key: 'ENABLE_OTP_VERIFICATION', value: 'false', valueType: 'BOOLEAN', description: 'Qeydiyyat zamanı məcburi OTP doğrulaması' },
  ];

  for (const s of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }
  console.log('[SystemSettings] Ensured core system parameters (Pricing & Packages are managed via Admin Panel).');

  // 5. Seed Clean Biometric TimeSlots (Next 14 Days, completely unbooked)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const slotTimes = ['09:00 AM', '10:30 AM', '14:00 PM', '16:00 PM'];
  const centers = ['EuroTech Main Center', 'EuroTech Premium Lounge', 'Ganja Regional Center'];

  let slotsCreated = 0;
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
          slotsCreated++;
        }
      }
    }
  }
  console.log(`[TimeSlots] Ensured clean appointment slots across all 3 centers (${slotsCreated} new slots).`);

  console.log('--- Production database seed finished successfully! No dummy or mock data created. ---');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
