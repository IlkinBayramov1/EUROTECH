const bcrypt = require('bcryptjs');

const OFFICIAL_COUNTRIES = [
  { code: 'HU', nameAz: 'Macarıstan', nameEn: 'Hungary', nameRu: 'Венгрия', flagUrl: 'https://flagcdn.com/w80/hu.png' },
  { code: 'DE', nameAz: 'Almaniya', nameEn: 'Germany', nameRu: 'Германия', flagUrl: 'https://flagcdn.com/w80/de.png' },
  { code: 'AT', nameAz: 'Avstriya', nameEn: 'Austria', nameRu: 'Австрия', flagUrl: 'https://flagcdn.com/w80/at.png' },
  { code: 'IT', nameAz: 'İtaliya', nameEn: 'Italy', nameRu: 'Италия', flagUrl: 'https://flagcdn.com/w80/it.png' },
  { code: 'FR', nameAz: 'Fransa', nameEn: 'France', nameRu: 'Франция', flagUrl: 'https://flagcdn.com/w80/fr.png' },
  { code: 'ES', nameAz: 'İspaniya', nameEn: 'Spain', nameRu: 'Испания', flagUrl: 'https://flagcdn.com/w80/es.png' },
  { code: 'PL', nameAz: 'Polşa', nameEn: 'Poland', nameRu: 'Польша', flagUrl: 'https://flagcdn.com/w80/pl.png' },
  { code: 'CZ', nameAz: 'Çexiya', nameEn: 'Czech Republic', nameRu: 'Чехия', flagUrl: 'https://flagcdn.com/w80/cz.png' },
  { code: 'TR', nameAz: 'Türkiyə', nameEn: 'Turkey', nameRu: 'Турция', flagUrl: 'https://flagcdn.com/w80/tr.png' },
];

const OFFICIAL_DOCUMENT_TYPES = [
  { code: 'PASSPORT', nameAz: 'Xarici pasportun əsas səhifəsi', nameEn: 'Valid Passport Copy', nameRu: 'Копия паспорта', isRequired: true },
  { code: 'BIOMETRIC_PHOTO', nameAz: 'Biometrik fotoşəkil (3.5x4.5 sm)', nameEn: 'Biometric Photograph', nameRu: 'Биометрическое фото', isRequired: true },
  { code: 'BANK_STATEMENT', nameAz: 'Maddi vəziyyəti təsdiq edən bank çıxarışı (son 3 ay)', nameEn: 'Proof of Financial Means (Bank Statement)', nameRu: 'Выписка из банка (3 месяца)', isRequired: true },
  { code: 'EMPLOYMENT_LETTER', nameAz: 'İş yerindən arayış / Təhsil haqqında sənəd', nameEn: 'Employment / Student Verification Letter', nameRu: 'Справка с места работы / учебы', isRequired: true },
  { code: 'ACCOMMODATION', nameAz: 'Otel və ya qalacaq yer təsdiqi', nameEn: 'Proof of Accommodation', nameRu: 'Подтверждение бронирования жилья', isRequired: true },
  { code: 'FLIGHT_ITINERARY', nameAz: 'Uçuş bileti rezervasiyası', nameEn: 'Flight Itinerary / Roundtrip Ticket', nameRu: 'Бронь авиабилетов', isRequired: true },
  { code: 'INSURANCE', nameAz: 'Şengen zonası üzrə səyahət sığortası (€30,000)', nameEn: 'Travel Medical Insurance (€30,000 coverage)', nameRu: 'Медицинская страховка', isRequired: true },
];

const STANDARD_TIMES = [
  '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM'
];

const LOCATIONS = [
  'EuroTech Main Center',
  'EuroTech Premium Lounge',
  'Ganja Regional Center'
];

async function bootstrapSystemData(prisma) {
  try {
    // 1. Ensure Official Countries exist in MySQL
    for (const c of OFFICIAL_COUNTRIES) {
      const country = await prisma.country.upsert({
        where: { code: c.code },
        update: { nameAz: c.nameAz, nameEn: c.nameEn, nameRu: c.nameRu, flagUrl: c.flagUrl, isActive: true },
        create: { code: c.code, nameAz: c.nameAz, nameEn: c.nameEn, nameRu: c.nameRu, flagUrl: c.flagUrl, isActive: true },
      });

      // 2. Ensure Schengen Tourist Category
      let touristCat = await prisma.visaCategory.findFirst({
        where: { countryId: country.id, code: 'SCHENGEN_TOURIST' }
      });
      if (!touristCat) {
        touristCat = await prisma.visaCategory.create({
          data: {
            countryId: country.id,
            code: 'SCHENGEN_TOURIST',
            nameAz: 'Şengen turist (C)',
            nameEn: 'Schengen Tourist (C)',
            nameRu: 'Шенген турист (C)',
            baseFee: 80.0,
            descriptionAz: 'Qısamüddətli Şengen turist vizası müraciəti.',
            descriptionEn: 'Short-stay Schengen Tourist Visa application.',
            descriptionRu: 'Краткосрочная туристическая виза Шенген.',
          }
        });
      }

      // Ensure Schengen Business Category
      let businessCat = await prisma.visaCategory.findFirst({
        where: { countryId: country.id, code: 'SCHENGEN_BUSINESS' }
      });
      if (!businessCat) {
        businessCat = await prisma.visaCategory.create({
          data: {
            countryId: country.id,
            code: 'SCHENGEN_BUSINESS',
            nameAz: 'Şengen biznes / ezamiyyət (C)',
            nameEn: 'Schengen Business (C)',
            nameRu: 'Шенген бизнес (C)',
            baseFee: 80.0,
            descriptionAz: 'İşgüzar səfər və korporativ ezamiyyət vizası.',
            descriptionEn: 'Short-stay Schengen Business & Corporate Mobility Visa.',
            descriptionRu: 'Деловая шенгенская виза.',
          }
        });
      }

      // Ensure National Long-Stay Category (D)
      let nationalCat = await prisma.visaCategory.findFirst({
        where: { countryId: country.id, code: 'NATIONAL_D' }
      });
      if (!nationalCat) {
        nationalCat = await prisma.visaCategory.create({
          data: {
            countryId: country.id,
            code: 'NATIONAL_D',
            nameAz: 'Milli uzunmüddətli viza (D)',
            nameEn: 'National Long-Stay Visa (D)',
            nameRu: 'Национальная долгосрочная виза (D)',
            baseFee: 90.0,
            descriptionAz: 'Uzunmüddətli milli iş və təhsil vizası müraciəti.',
            descriptionEn: 'Long-stay National D Visa application for employment/study.',
            descriptionRu: 'Долгосрочная национальная виза.',
          }
        });
      }

      // 3. Ensure Required Document Types for all categories of this country
      for (const cat of [touristCat, businessCat, nationalCat]) {
        if (!cat) continue;
        for (const docType of OFFICIAL_DOCUMENT_TYPES) {
          const existingDoc = await prisma.requiredDocumentType.findFirst({
            where: { visaCategoryId: cat.id, code: docType.code }
          });
          if (!existingDoc) {
            await prisma.requiredDocumentType.create({
              data: {
                visaCategoryId: cat.id,
                code: docType.code,
                nameAz: docType.nameAz,
                nameEn: docType.nameEn,
                nameRu: docType.nameRu,
                isRequired: docType.isRequired,
                allowedFormats: 'pdf,jpg,png,jpeg'
              }
            });
          }
        }
      }
    }

    // 4. Ensure Future Appointment TimeSlots exist for the upcoming 60 days
    const now = new Date();
    const futureLimit = new Date();
    futureLimit.setDate(futureLimit.getDate() + 60);

    const existingSlotsCount = await prisma.timeSlot.count({
      where: {
        date: { gte: now, lte: futureLimit },
        isActive: true
      }
    });

    if (existingSlotsCount < 20) {
      console.log('[BOOTSTRAP] Generating upcoming biometric appointment slots in MySQL...');
      const slotsToCreate = [];
      for (let dayOffset = 1; dayOffset <= 45; dayOffset++) {
        const slotDate = new Date();
        slotDate.setDate(slotDate.getDate() + dayOffset);
        slotDate.setHours(0, 0, 0, 0);

        // Skip weekends (Saturday = 6, Sunday = 0)
        const dayOfWeek = slotDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        for (const location of LOCATIONS) {
          for (const time of STANDARD_TIMES) {
            slotsToCreate.push({
              date: slotDate,
              startTime: time,
              capacity: 10,
              bookedCount: 0,
              location,
              isActive: true
            });
          }
        }
      }

      if (slotsToCreate.length > 0) {
        await prisma.timeSlot.createMany({
          data: slotsToCreate,
          skipDuplicates: true
        });
      }
    }

    // 5. Ensure Default Admin User exists
    const existingAdmin = await prisma.user.findFirst({
      where: { email: 'admin@eurotech.services' }
    });

    if (!existingAdmin) {
      const adminPasswordHash = await bcrypt.hash('admin123', 10);
      await prisma.user.create({
        data: {
          email: 'admin@eurotech.services',
          username: 'EURADMIN',
          passwordHash: adminPasswordHash,
          role: 'ADMIN',
          fullName: 'E. Abdullayev',
          phone: '+994501112233',
          companyName: 'EuroTech Consular Administration',
          accountStatus: 'ACTIVE',
          isVerified: true,
          preferredLanguage: 'az'
        }
      });
    }

    // 6. Ensure Base System Settings
    const baseSettings = [
      { key: 'EUR_TO_AZN_RATE', value: '1.80', valueType: 'NUMBER', description: 'Official EUR to AZN conversion rate' },
      { key: 'BASE_CURRENCY', value: 'EUR', valueType: 'STRING', description: 'Primary consular accounting currency' },
      { key: 'INDIVIDUAL_SERVICE_FEE', value: '120.00', valueType: 'NUMBER', description: 'Standard individual filing fee' },
      { key: 'CONSULAR_BASE_FEE', value: '80.00', valueType: 'NUMBER', description: 'Schengen government consular tariff' },
    ];

    for (const s of baseSettings) {
      await prisma.systemSetting.upsert({
        where: { key: s.key },
        update: { value: s.value, valueType: s.valueType, description: s.description },
        create: { key: s.key, value: s.value, valueType: s.valueType, description: s.description },
      });
    }

    console.log('[BOOTSTRAP] System reference data 100% verified & operational in MySQL.');
  } catch (error) {
    console.error('[BOOTSTRAP ERROR] Failed to bootstrap database:', error);
  }
}

module.exports = { bootstrapSystemData };

