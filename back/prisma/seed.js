const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding EUROTECH initial database data...');

  // Create Users (Admin, Operator, Individual, Agent, Corporate)
  const adminPassword = await bcrypt.hash('admin123', 10);
  const operatorPassword = await bcrypt.hash('operator123', 10);
  const userPassword = await bcrypt.hash('user123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@eurotech.services' },
    update: {},
    create: {
      email: 'admin@eurotech.services',
      passwordHash: adminPassword,
      role: 'ADMIN',
      fullName: 'E. Abdullayev',
      phone: '+994501112233',
      companyName: 'EuroTech Services Kft.',
      preferredLanguage: 'az',
      isVerified: true,
    },
  });

  const operator = await prisma.user.upsert({
    where: { email: 'operator@eurotech.services' },
    update: {},
    create: {
      email: 'operator@eurotech.services',
      passwordHash: operatorPassword,
      role: 'OPERATOR',
      fullName: 'Rəşad Məmmədov',
      phone: '+994502223344',
      companyName: 'EuroTech Services',
      preferredLanguage: 'az',
      isVerified: true,
    },
  });

  const individualUser = await prisma.user.upsert({
    where: { email: 'mammadov@gmail.com' },
    update: {},
    create: {
      email: 'mammadov@gmail.com',
      passwordHash: userPassword,
      role: 'INDIVIDUAL',
      fullName: 'Reşad Məmmədov',
      phone: '+994503334455',
      preferredLanguage: 'az',
      passportNumber: 'C12345678',
      isVerified: true,
    },
  });

  const agentUser = await prisma.user.upsert({
    where: { email: 'agent@baku-tours.az' },
    update: {},
    create: {
      email: 'agent@baku-tours.az',
      passwordHash: userPassword,
      role: 'AGENT_TUR_OPERATOR',
      fullName: 'Baku Tours Agent',
      phone: '+994124445566',
      companyName: 'Baku Tours MMC',
      preferredLanguage: 'az',
      isVerified: true,
    },
  });

  const corporateUser = await prisma.user.upsert({
    where: { email: 'hr@corp.az' },
    update: {},
    create: {
      email: 'hr@corp.az',
      passwordHash: userPassword,
      role: 'CORPORATE_HR',
      fullName: 'Elvin Ağayev',
      phone: '+994505556677',
      companyName: 'Corp Tech Azerbaijan MMC',
      preferredLanguage: 'az',
      isVerified: true,
    },
  });

  // Seed Countries
  const hungary = await prisma.country.upsert({
    where: { code: 'HU' },
    update: {},
    create: {
      code: 'HU',
      nameAz: 'Macarıstan',
      nameEn: 'Hungary',
      nameRu: 'Венгрия',
      flagUrl: 'https://flagcdn.com/w80/hu.png',
      isActive: true,
    },
  });

  const germany = await prisma.country.upsert({
    where: { code: 'DE' },
    update: {},
    create: {
      code: 'DE',
      nameAz: 'Almaniya',
      nameEn: 'Germany',
      nameRu: 'Германия',
      flagUrl: 'https://flagcdn.com/w80/de.png',
      isActive: true,
    },
  });

  const czech = await prisma.country.upsert({
    where: { code: 'CZ' },
    update: {},
    create: {
      code: 'CZ',
      nameAz: 'Çexiya',
      nameEn: 'Czech Republic',
      nameRu: 'Чехия',
      flagUrl: 'https://flagcdn.com/w80/cz.png',
      isActive: true,
    },
  });

  const turkey = await prisma.country.upsert({
    where: { code: 'TR' },
    update: {},
    create: {
      code: 'TR',
      nameAz: 'Türkiyə',
      nameEn: 'Turkey',
      nameRu: 'Турция',
      flagUrl: 'https://flagcdn.com/w80/tr.png',
      isActive: true,
    },
  });

  // Seed Visa Category: Hungary Schengen Tourist (C)
  const huSchengenCategory = await prisma.visaCategory.create({
    data: {
      countryId: hungary.id,
      code: 'SCHENGEN_TOURIST',
      nameAz: 'Şengen turist (C)',
      nameEn: 'Schengen Tourist (C)',
      nameRu: 'Шенген турист (C)',
      baseFee: 80.0,
      descriptionAz: 'Qısamüddətli Şengen turist vizası müraciəti.',
      descriptionEn: 'Short-stay Schengen Tourist Visa application.',
      descriptionRu: 'Краткосрочная виза Шенген.',
      dynamicFields: {
        create: [
          {
            fieldName: 'travelPurpose',
            labelAz: 'Səfər məqsədi',
            labelEn: 'Purpose of Travel',
            labelRu: 'Цель поездки',
            fieldType: 'SELECT',
            isRequired: true,
            optionsJson: ['Turizm', 'Biznes', 'Ailə ziyarəti'],
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
        create: [
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
            nameAz: 'Otel/Itinerarium',
            nameEn: 'Hotel Booking / Itinerary',
            nameRu: 'Бронь отеля',
            isRequired: true,
          },
          {
            code: 'INSURANCE',
            nameAz: 'Sığorta polisi',
            nameEn: 'Travel Insurance Policy',
            nameRu: 'Страховой полис',
            isRequired: false,
          },
        ],
      },
    },
  });

  // Seed Sample Dossier (HU-AZ-2026-04891)
  const sampleDossier = await prisma.dossier.upsert({
    where: { dossierNumber: 'HU-AZ-2026-04891' },
    update: {},
    create: {
      dossierNumber: 'HU-AZ-2026-04891',
      portalType: 'INDIVIDUAL',
      userId: individualUser.id,
      countryId: hungary.id,
      visaCategoryId: huSchengenCategory.id,
      currentStep: 8,
      status: 'UNDER_REVIEW',
      appointmentDate: new Date('2026-08-19T10:15:00Z'),
      appointmentLocation: 'Budapeşt qəbul mərkəzi',
      governmentFee: 80.0,
      serviceFee: 120.0,
      extraServicesFee: 95.0, // €60 + €35
      totalAmount: 295.0,
      paymentStatus: 'PAID',
      applicants: {
        create: [
          {
            firstName: 'Reşad',
            lastName: 'Məmmədov',
            passportNumber: 'C12345678',
            formDataJson: { travelPurpose: 'Turizm', intendedEntryDate: '2026-09-15' },
          },
        ],
      },
    },
  });

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
