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

  // Seed TimeSlots
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const slotTimes = ['09:00 AM', '10:30 AM', '14:00 PM', '16:00 PM'];
  for (let i = 0; i < 5; i++) {
    const slotDate = new Date(today.getTime() + (i + 1) * 24 * 60 * 60 * 1000);
    for (const timeStr of slotTimes) {
      await prisma.timeSlot.create({
        data: {
          date: slotDate,
          startTime: timeStr,
          capacity: 10,
          bookedCount: 0,
          location: i % 2 === 0 ? 'EuroTech Main Center' : 'EuroTech Premium Lounge',
          isActive: true,
        },
      });
    }
  }

  // Seed Agent Wallet
  await prisma.wallet.upsert({
    where: { userId: agentUser.id },
    update: {},
    create: {
      userId: agentUser.id,
      balance: 480.0,
      pendingBalance: 1250.0,
      currency: 'EUR',
      transactions: {
        create: [
          {
            amount: 480.0,
            type: 'CREDIT',
            referenceType: 'COMMISSION',
            referenceId: 'GRP-8821',
            description: 'Commission: TechTrade Delegation (24 App)',
            status: 'PAID',
          },
        ],
      },
    },
  });

  // Seed Corporate Wallet & Employees
  await prisma.wallet.upsert({
    where: { userId: corporateUser.id },
    update: {},
    create: {
      userId: corporateUser.id,
      balance: 12500.0,
      currency: 'EUR',
      transactions: {
        create: [
          {
            amount: 5000.0,
            type: 'CREDIT',
            referenceType: 'TOPUP',
            description: 'Wallet Top-Up (Wire Transfer)',
            status: 'PAID',
          },
        ],
      },
    },
  });

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
            issueDate: new Date('2026-10-20'),
            expiryDate: new Date('2027-10-20'),
            status: 'PROCESSING',
            batchRef: 'BCH-2026-101',
          },
        ],
      },
    },
  });

  console.log('Database seeding completed successfully with Slots, Batches, Wallets, and Employees!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
