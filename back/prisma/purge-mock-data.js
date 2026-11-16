const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const env = require('../config/env');

const prisma = new PrismaClient();

const MOCK_EMAILS = [
  'operator@eurotech.services',
  'manager@eurotech.services',
  'mammadov@gmail.com',
  'agent@baku-tours.az',
  'hr@corp.az',
  'anar.quliyev@gmail.com',
  'leyla.mammadova@box.az',
  'tural.huseynov@gmail.com',
  'nigar.aliyeva@code.az',
  'booking@pashatravel.az',
  'agent@silkwaytravel.az',
  'b2b@bht.az',
  'hr.mobility@socar.az',
  'global.mobility@azercell.com',
  'hr@pasha-life.az',
];

const MOCK_DOSSIER_NUMBERS = [
  'HU-AZ-2026-04891',
  'HU-AZ-2026-1029',
  'DE-AZ-2026-3041',
  'AT-AZ-2026-5512',
  'CZ-AZ-2026-7840',
  'GRP-2026-9041',
  'BCH-2026-8802',
];

const DUMMY_FILES = [
  'passport_scan_C1029384.pdf',
  'hotel_reservation_budapest.pdf',
  'flight_reservation_wizz.pdf',
  'pasha_insurance_schengen.pdf',
  'bank_statement_pasha_bank.pdf',
];

async function purgeMockData() {
  console.log('=== STARTING PURGE OF MOCK & LOCAL SEED DATA ===');

  // 1. Identify mock users (strictly protecting admin and real users)
  const candidateUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { in: MOCK_EMAILS } },
        { email: { endsWith: '@eurotech.az' } },
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
    select: { id: true, email: true, role: true },
  });

  // Filter out any protected users (Admin and real users)
  const mockUsers = candidateUsers.filter((u) => {
    if (u.email.toLowerCase() === 'admin@eurotech.services') return false;
    if (u.email.toLowerCase().includes('bayramovilkin')) return false;
    return true;
  });

  const mockUserIds = mockUsers.map((u) => u.id);
  console.log(`[Users] Found ${mockUserIds.length} mock / test user accounts to purge:`);
  mockUsers.forEach((u) => console.log(`  - ${u.email} (${u.role})`));

  // 2. Identify mock dossiers
  const candidateDossiers = await prisma.dossier.findMany({
    where: {
      OR: [
        { dossierNumber: { in: MOCK_DOSSIER_NUMBERS } },
        { dossierNumber: { startsWith: 'BCH-BCH-' } },
        { dossierNumber: { startsWith: 'GRP-GRP-' } },
        { userId: { in: mockUserIds } },
        { groupBatch: { userId: { in: mockUserIds } } },
      ],
    },
    select: { id: true, dossierNumber: true },
  });
  const mockDossierIds = candidateDossiers.map((d) => d.id);
  console.log(`[Dossiers] Found ${mockDossierIds.length} mock dossiers to purge.`);

  // 3. Cascade Delete Child Records
  if (mockDossierIds.length > 0 || mockUserIds.length > 0) {
    // A. Applicant Documents
    const delDocs = await prisma.applicantDocument.deleteMany({
      where: {
        OR: [
          { dossierId: { in: mockDossierIds } },
          { applicant: { dossier: { userId: { in: mockUserIds } } } },
          { corporateEmployee: { corporateUserId: { in: mockUserIds } } },
        ],
      },
    });
    console.log(`[Purged] Deleted ${delDocs.count} mock applicant documents.`);

    // B. Applicants
    const delApps = await prisma.applicant.deleteMany({
      where: {
        OR: [
          { dossierId: { in: mockDossierIds } },
          { dossier: { userId: { in: mockUserIds } } },
        ],
      },
    });
    console.log(`[Purged] Deleted ${delApps.count} mock applicant profiles.`);

    // C. Additional Services
    const delServices = await prisma.additionalService.deleteMany({
      where: {
        OR: [
          { dossierId: { in: mockDossierIds } },
          { dossier: { userId: { in: mockUserIds } } },
        ],
      },
    });
    console.log(`[Purged] Deleted ${delServices.count} mock additional services.`);

    // D. Appointments
    const delAppts = await prisma.appointment.deleteMany({
      where: {
        OR: [
          { dossierId: { in: mockDossierIds } },
          { userId: { in: mockUserIds } },
        ],
      },
    });
    console.log(`[Purged] Deleted ${delAppts.count} mock appointments.`);

    // E. Status History
    const delHist = await prisma.dossierStatusHistory.deleteMany({
      where: {
        OR: [
          { dossierId: { in: mockDossierIds } },
          { changedByUserId: { in: mockUserIds } },
        ],
      },
    });
    console.log(`[Purged] Deleted ${delHist.count} mock status history entries.`);

    // F. Transactions
    const delTx = await prisma.transaction.deleteMany({
      where: {
        OR: [
          { dossierId: { in: mockDossierIds } },
          { userId: { in: mockUserIds } },
        ],
      },
    });
    console.log(`[Purged] Deleted ${delTx.count} mock dossier transactions.`);

    // G. Bank Payment Receipts
    const delReceipts = await prisma.bankPaymentReceipt.deleteMany({
      where: {
        OR: [
          { dossierId: { in: mockDossierIds } },
          { userId: { in: mockUserIds } },
        ],
      },
    });
    console.log(`[Purged] Deleted ${delReceipts.count} mock bank receipts.`);

    // H. Dossiers
    const delDossiers = await prisma.dossier.deleteMany({
      where: {
        OR: [
          { id: { in: mockDossierIds } },
          { userId: { in: mockUserIds } },
        ],
      },
    });
    console.log(`[Purged] Deleted ${delDossiers.count} mock dossiers.`);

    // I. Corporate Employees & Visa Records
    await prisma.visaRecord.deleteMany({
      where: { employee: { corporateUserId: { in: mockUserIds } } },
    });
    const delEmps = await prisma.corporateEmployee.deleteMany({
      where: { corporateUserId: { in: mockUserIds } },
    });
    console.log(`[Purged] Deleted ${delEmps.count} mock corporate employees.`);

    // J. Corporate Invoices & Departments
    const delInvs = await prisma.corporateInvoice.deleteMany({
      where: { corporateUserId: { in: mockUserIds } },
    });
    const delDepts = await prisma.corporateDepartment.deleteMany({
      where: { corporateUserId: { in: mockUserIds } },
    });
    console.log(`[Purged] Deleted ${delInvs.count} mock corporate invoices and ${delDepts.count} departments.`);

    // K. Group Batches
    const delBatches = await prisma.groupBatch.deleteMany({
      where: { userId: { in: mockUserIds } },
    });
    console.log(`[Purged] Deleted ${delBatches.count} mock group batches.`);

    // L. Wallets & Wallet Transactions
    const delWtx = await prisma.walletTransaction.deleteMany({
      where: { wallet: { userId: { in: mockUserIds } } },
    });
    const delPayouts = await prisma.payoutRequest.deleteMany({
      where: { wallet: { userId: { in: mockUserIds } } },
    });
    const delWallets = await prisma.wallet.deleteMany({
      where: { userId: { in: mockUserIds } },
    });
    console.log(`[Purged] Deleted ${delWallets.count} mock wallets and ${delWtx.count} wallet transactions.`);

    const mockUserEmails = mockUsers.map((u) => u.email);

    // M. Auth Sessions, Tokens & Notifications
    await prisma.notification.deleteMany({ where: { userId: { in: mockUserIds } } });
    await prisma.refreshTokenSession.deleteMany({ where: { userId: { in: mockUserIds } } });
    await prisma.passwordResetToken.deleteMany({ where: { userId: { in: mockUserIds } } });
    await prisma.otpToken.deleteMany({ where: { email: { in: mockUserEmails } } });
    await prisma.corporateSubscription.deleteMany({ where: { userId: { in: mockUserIds } } });

    // N. Audit Logs
    const delLogs = await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { userId: { in: mockUserIds } },
          { action: { contains: 'TEST' } },
        ],
      },
    });
    console.log(`[Purged] Deleted ${delLogs.count} mock audit logs.`);

    // O. Finally Delete Mock Users
    const delUsers = await prisma.user.deleteMany({
      where: { id: { in: mockUserIds } },
    });
    console.log(`[Purged] Deleted ${delUsers.count} mock user accounts.`);
  }

  // 4. Remove Dummy Files from uploads/
  const uploadDir = path.resolve(env.UPLOAD_DIR || './uploads');
  if (fs.existsSync(uploadDir)) {
    let filesRemoved = 0;
    for (const f of DUMMY_FILES) {
      const fullPath = path.join(uploadDir, f);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
          filesRemoved++;
        } catch (e) {
          console.warn(`Could not delete file ${fullPath}:`, e.message);
        }
      }
    }
    console.log(`[Files] Cleaned ${filesRemoved} dummy PDF files from disk.`);
  }

  // 5. Reset booked counts on any orphan time slots
  await prisma.timeSlot.updateMany({
    where: { bookedCount: { gt: 0 } },
    data: { bookedCount: 0 },
  });

  console.log('=== PURGE COMPLETED SUCCESSFULLY! Database is clean. ===');
}

purgeMockData()
  .catch((e) => {
    console.error('Purge error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
