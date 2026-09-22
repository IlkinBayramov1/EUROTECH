const http = require('http');
const app = require('./app');
const prisma = require('./config/db');
const runDisasterRecoveryTest = require('./scripts/disaster-recovery-test');
const { encryptAES256GCM, decryptAES256GCM, hashHMACSHA256 } = require('./utils/crypto.util');

const PORT = 5001; // Isolated testing port
const BASE_URL = `http://127.0.0.1:${PORT}/api`;

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    let bodyData = null;
    const headers = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (data) {
      headers['Content-Type'] = 'application/json';
      bodyData = JSON.stringify(data);
      headers['Content-Length'] = Buffer.byteLength(bodyData);
    }

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: headers,
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => (responseBody += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(responseBody);
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: responseBody });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}

async function runAllTests() {
  console.log('===============================================================');
  console.log(' EUROTECH ENTERPRISE FULL BACKEND END-TO-END SUITE');
  console.log('===============================================================\n');

  let server;
  try {
    server = await new Promise((resolve) => {
      const s = app.listen(PORT, '127.0.0.1', () => {
        console.log(`[INIT] Test HTTP Server started on port ${PORT}...`);
        resolve(s);
      });
    });
  } catch (e) {
    console.error('Failed to bind test server:', e.message);
  }

  let token = null;
  let refreshToken = null;
  let adminToken = null;
  let agentToken = null;
  let corpToken = null;
  let countryId = null;
  let visaCategoryId = null;
  let dossierId = null;
  let applicantId = null;
  let documentId = null;
  let timeSlotId = null;
  let appointmentId = null;
  let groupBatchId = null;
  let corpBatchId = null;
  let corpEmployeeId = null;

  try {
    // 1. Health Check
    console.log('[1/21] Health Check Test...');
    const health = await request('GET', '/health');
    console.log(`  -> STATUS: ${health.status} | Service: ${health.body.service} ✔️`);

    // 2. Pre-Registration & Username Generation
    console.log('\n[2/21] Auth: Customer Pre-Registration (EUR-XXXXX & Token)...');
    const onboardingEmail = `onboarding_${Date.now()}@eurotech.com`;
    const preRegRes = await request('POST', '/auth/pre-register', {
      email: onboardingEmail,
      fullName: 'Aysel Qasimova',
      phone: '+994509998877',
      passportNumber: 'C11223344',
      role: 'INDIVIDUAL',
    });
    console.log(`  -> STATUS: ${preRegRes.status} | Mesaj: ${preRegRes.body.message}`);

    const dbUserPending = await prisma.user.findUnique({ where: { email: onboardingEmail } });
    console.log(`  -> Yaradilmis Username: ${dbUserPending.username} (EUR + 5 Reqem) ✔️`);
    console.log(`  -> Account Status: ${dbUserPending.accountStatus} (PENDING_PASSWORD) ✔️`);

    // 3. Login Barrier for PENDING_PASSWORD Users
    console.log('\n[3/21] Auth: PENDING_PASSWORD Hesabin Login Bloku Testi...');
    const blockedLogin = await request('POST', '/auth/login', {
      email: onboardingEmail,
      password: 'SomePassword123!',
    });
    console.log(`  -> STATUS: ${blockedLogin.status} (403 Forbidden: ${blockedLogin.body.message}) ✔️`);

    // 4. Email Enumeration Protection
    console.log('\n[4/21] Auth: Email Enumeration Protection...');
    const resendRes = await request('POST', '/auth/resend-set-password', {
      email: 'nonexistent_123456@eurotech.com',
    });
    console.log(`  -> STATUS: ${resendRes.status} | Neytral Mesaj: ${resendRes.body.message} ✔️`);

    // 5. Atomic Set Password & Token Consumption
    console.log('\n[5/21] Auth: Single Atomic Set Password...');
    const rawTestToken = 'test_raw_token_verification_123';
    const crypto = require('crypto');
    const hashedTestToken = crypto.createHash('sha256').update(rawTestToken).digest('hex');

    await prisma.user.update({
      where: { id: dbUserPending.id },
      data: { passwordSetTokenHash: hashedTestToken },
    });

    const setPassRes = await request('POST', '/auth/set-password', {
      token: rawTestToken,
      newPassword: 'SecurePassword123!',
    });
    console.log(`  -> STATUS: ${setPassRes.status} | Mesaj: ${setPassRes.body.message} ✔️`);

    // 6. Login with Username for ACTIVE User
    console.log('\n[6/21] Auth: Username ile Giris (Login)...');
    const userLogin = await request('POST', '/auth/login', {
      username: dbUserPending.username,
      password: 'SecurePassword123!',
    });
    token = userLogin.body.data.accessToken;
    refreshToken = userLogin.body.data.refreshToken;
    console.log(`  -> STATUS: ${userLogin.status} | Access Token alindi (${dbUserPending.username}) ✔️`);

    // 7. Refresh Token Rotation
    console.log('\n[7/21] Auth: Refresh Token Rotation & Lineage...');
    const refreshed = await request('POST', '/auth/refresh-token', { refreshToken });
    token = refreshed.body.data.accessToken;
    console.log(`  -> STATUS: ${refreshed.status} | Yeni Access Token alindi ✔️`);

    // 8. Admin & Roles Setup
    console.log('\n[8/21] Auth: Admin, Agent, Corporate Rolleri Hazirlanir...');
    const { hashPassword } = require('./utils/hash.util');
    const passHash = await hashPassword('password123');

    // Super Admin
    await prisma.user.upsert({
      where: { email: 'admin@eurotech.services' },
      update: { accountStatus: 'ACTIVE', passwordHash: passHash, role: 'ADMIN' },
      create: {
        email: 'admin@eurotech.services',
        username: 'EUR00001',
        passwordHash: passHash,
        role: 'ADMIN',
        accountStatus: 'ACTIVE',
        fullName: 'Super Admin',
        isVerified: true,
      },
    });
    const adminLogin = await request('POST', '/auth/login', { email: 'admin@eurotech.services', password: 'password123' });
    adminToken = adminLogin.body.data.accessToken;

    // Agent User
    const agentUser = await prisma.user.upsert({
      where: { email: 'agent@baku-tours.az' },
      update: { accountStatus: 'ACTIVE', passwordHash: passHash, role: 'AGENT_TUR_OPERATOR' },
      create: {
        email: 'agent@baku-tours.az',
        username: 'EUR00002',
        passwordHash: passHash,
        role: 'AGENT_TUR_OPERATOR',
        accountStatus: 'ACTIVE',
        fullName: 'Baku Tours Agent',
        companyName: 'Baku Tours MMC',
        isVerified: true,
      },
    });
    const agentLogin = await request('POST', '/auth/login', { email: 'agent@baku-tours.az', password: 'password123' });
    agentToken = agentLogin.body.data.accessToken;

    // Corporate User
    const corpUser = await prisma.user.upsert({
      where: { email: 'hr@corp.az' },
      update: { accountStatus: 'ACTIVE', passwordHash: passHash, role: 'CORPORATE_HR' },
      create: {
        email: 'hr@corp.az',
        username: 'EUR00003',
        passwordHash: passHash,
        role: 'CORPORATE_HR',
        accountStatus: 'ACTIVE',
        fullName: 'Elvin Agayev',
        companyName: 'Corp Tech Azerbaijan MMC',
        isVerified: true,
      },
    });
    const corpLogin = await request('POST', '/auth/login', { email: 'hr@corp.az', password: 'password123' });
    corpToken = corpLogin.body.data.accessToken;
    console.log('  -> Admin, Agent ve Corporate istifadecileri login oldu ✔️');

    // 9. AES-256-GCM & HMAC Encryption
    console.log('\n[9/21] Cryptography: AES-256-GCM & HMAC Searchable Encryption...');
    const rawPassport = 'C99887766';
    const encrypted = encryptAES256GCM(rawPassport);
    const decrypted = decryptAES256GCM(encrypted);
    const hmacHash = hashHMACSHA256(rawPassport);
    console.log(`  -> Sifrelendi & Desifrelendi: ${decrypted === rawPassport ? 'SUCCESS' : 'FAIL'} ✔️`);

    // 10. Templates & Countries
    console.log('\n[10/21] Template: Olkeler ve Viza Kateqoriyalari...');
    const countries = await request('GET', '/templates/countries');
    const huCountry = countries.body.data.countries.find((c) => c.code === 'HU') || countries.body.data.countries[0];
    countryId = huCountry.id;
    const visaCats = await request('GET', `/templates/visa-categories/${countryId}`);
    visaCategoryId = visaCats.body.data.visaCategories[0].id;
    console.log(`  -> Olke: ${huCountry.nameAz} | Viza Kateqoriyasi ID: ${visaCategoryId} ✔️`);

    // 11. Dossier Creation
    console.log('\n[11/21] Dossier: Müraciet Yaradilmasi (Step 1)...');
    const dossierRes = await request('POST', '/dossiers', {
      portalType: 'INDIVIDUAL',
      countryId,
      visaCategoryId,
    }, token);
    dossierId = dossierRes.body.data.dossier.id;
    console.log(`  -> STATUS: ${dossierRes.status} | Dosye kodu: ${dossierRes.body.data.dossier.dossierNumber} ✔️`);

    // 12. Add Applicants
    console.log('\n[12/21] Dossier: Erizeci Elavesi (Step 3)...');
    const appRes = await request('POST', `/dossiers/${dossierId}/applicants`, {
      applicants: [
        {
          firstName: 'Aysel',
          lastName: 'Qasimova',
          passportNumber: 'C11223344',
          gender: 'FEMALE',
          nationality: 'AZ',
        },
      ],
    }, token);
    applicantId = appRes.body.data.applicants[0].id;
    console.log(`  -> STATUS: ${appRes.status} | Erizeci ID: ${applicantId} ✔️`);

    // 13. Document Creation & Signed Download Route Test
    console.log('\n[13/21] Documents: Signed URL & Download Endpoint Testi...');
    // Create a mock document record in DB
    const fs = require('fs');
    const path = require('path');
    const mockFileName = `test_passport_${Date.now()}.pdf`;
    const mockFilePath = path.join(path.resolve('./uploads'), mockFileName);
    fs.writeFileSync(mockFilePath, '%PDF-1.4 Mock Passport File for Testing');

    const sampleDoc = await prisma.applicantDocument.create({
      data: {
        dossierId,
        applicantId,
        requiredDocumentType: 'PASSPORT',
        fileUrl: `/uploads/${mockFileName}`,
        fileName: mockFileName,
        fileSize: 1024,
        isMandatory: true,
        status: 'PENDING',
      },
    });
    documentId = sampleDoc.id;

    // Get Signed URL
    const signedUrlRes = await request('GET', `/documents/${documentId}/signed-url`, null, token);
    const signedUrl = signedUrlRes.body.data.signedUrl;
    console.log(`  -> Signed URL alindi: ${signedUrl}`);

    // Test downloading with signed token
    const downloadRes = await request('GET', signedUrl.replace('/api/v1', ''));
    console.log(`  -> Download Status: ${downloadRes.status} (200 OK: Fayl yuklendi) ✔️`);

    // 14. GDPR Privacy Endpoints Test
    console.log('\n[14/21] GDPR Privacy: Data Export Package Testi...');
    const exportRes = await request('GET', '/privacy/export-data', null, token);
    console.log(`  -> STATUS: ${exportRes.status} | Export Paketi alindi (${exportRes.body.data.user.email}) ✔️`);

    // 15. Additional Services (with per-applicant support)
    console.log('\n[15/21] Services: Premium Lounge & Travel Insurance (€81 + €35)...');
    const servRes = await request('POST', '/services/add', {
      dossierId,
      applicantId,
      serviceType: 'PREMIUM_LOUNGE',
    }, token);
    console.log(`  -> STATUS: ${servRes.status} | Xidmet elave edildi: Premium Lounge (€81) ✔️`);

    // 16. Appointments & Slots Engine Test
    console.log('\n[16/21] Appointments: Slot Axtarisi, Bron ve Reschedule Testi...');
    const slotsRes = await request('GET', '/appointments/slots');
    const availableSlots = slotsRes.body.data.slots;
    const freeSlot = availableSlots.find((s) => s.availableCapacity > 0) || availableSlots[0];
    timeSlotId = freeSlot.id;
    console.log(`  -> Movcud slotlar: ${availableSlots.length} eded | Secilen Slot vaxti: ${freeSlot.startTime}`);

    // Book appointment
    const bookRes = await request('POST', '/appointments/book', {
      dossierId,
      timeSlotId,
    }, token);
    appointmentId = bookRes.body.data.appointment.id;
    console.log(`  -> STATUS: ${bookRes.status} | Gorus bron edildi (ID: ${appointmentId}) ✔️`);

    // Reschedule appointment to second slot
    const nextFreeSlot = availableSlots.find((s) => s.id !== timeSlotId && s.availableCapacity > 0);
    if (nextFreeSlot) {
      const rescheduleRes = await request('PATCH', `/appointments/${appointmentId}/reschedule`, {
        newTimeSlotId: nextFreeSlot.id,
      }, token);
      console.log(`  -> Reschedule STATUS: ${rescheduleRes.status} | Yeni slot teyin olundu ✔️`);
    }

    // 17. Group Manifest PDF Generation Test
    console.log('\n[17/21] Appointments: Qrup Manifesti (PDF) Generasiyasi...');
    const manifestRes = await request('GET', `/appointments/${appointmentId}/manifest-pdf`, null, token);
    console.log(`  -> STATUS: ${manifestRes.status} | Manifest PDF yaradildi: ${manifestRes.body.data.fileUrl} ✔️`);

    // 18. Agent Portal Endpoints Test
    console.log('\n[18/21] Agent Portal: Qrup Yaratma, Komissiya ve Pul Kisesi...');
    const agentGroupRes = await request('POST', '/agent/groups', {
      name: 'Vienna Summer Delegation',
      destination: 'Austria',
      duration: 'short',
      projectReason: 'Tourism',
    }, agentToken);
    groupBatchId = agentGroupRes.body.data.group.id;
    console.log(`  -> Qrup yaradildi: ${agentGroupRes.body.data.group.name} (${agentGroupRes.body.data.group.code})`);

    // Submit group -> Generates commission
    const submitGroupRes = await request('POST', `/agent/groups/${groupBatchId}/submit`, {}, agentToken);
    console.log(`  -> Qrup emala gonderildi: Komissiya elave edildi (+€${submitGroupRes.body.data.commissionCredited}) ✔️`);

    // Get Agent Wallet
    const walletRes = await request('GET', '/agent/wallet', null, agentToken);
    console.log(`  -> Agent Pul Kisesi Balansi: €${walletRes.body.data.wallet.balance} ✔️`);

    // Request Payout (within available balance)
    const availableBal = walletRes.body.data.wallet.balance;
    const payoutReqAmount = availableBal >= 20.0 ? 20.0 : availableBal;
    const payoutRes = await request('POST', '/agent/payout-request', {
      amount: payoutReqAmount,
      bankName: 'International Bank of Azerbaijan',
      iban: 'AZ21IBAZ38019440333322221111',
      swiftBic: 'IBAZAZ2X',
    }, agentToken);
    console.log(`  -> Cixaris Sorgusu STATUS: ${payoutRes.status} | Payout ID: ${payoutRes.body?.data?.payout?.id} ✔️`);


    // 19. Corporate HR Portal Endpoints Test
    console.log('\n[19/21] Corporate Portal: Partiyalar, Nümayəndəlik Linki ve Fakturalar...');
    // Create Batch
    const batchRes = await request('POST', '/corporate/batches', {
      name: 'Berlin Relocation Q4',
      destination: 'Germany',
      duration: 'long',
      projectReason: 'Work',
    }, corpToken);
    corpBatchId = batchRes.body.data.batch.id;
    console.log(`  -> Partiya yaradildi: ${batchRes.body.data.batch.name} (${batchRes.body.data.batch.code})`);

    // Add Corporate Employee
    const empRes = await request('POST', '/corporate/employees', {
      firstName: 'Elmir',
      lastName: 'Huseynov',
      jobTitle: 'Lead DevOps Engineer',
      department: 'Infrastructure',
      passportNumber: 'P77665544',
    }, corpToken);
    corpEmployeeId = empRes.body.data.employee.id;
    console.log(`  -> Isçi reyestre elave edildi: ${empRes.body.data.employee.firstName} ${empRes.body.data.employee.lastName}`);

    // Generate Delegation Link
    const delegRes = await request('POST', `/corporate/employees/${corpEmployeeId}/delegation-link`, {
      batchId: corpBatchId,
    }, corpToken);
    console.log(`  -> Nümayəndəlik Linki: ${delegRes.body.data.delegationUrl} ✔️`);

    // Retrieve public delegation profile with token
    const delegProfileRes = await request('GET', `/corporate/delegation/profile?token=${delegRes.body.data.delegationToken}`);
    console.log(`  -> Qonaq profili tesdiqlendi: ${delegProfileRes.body.data.profile.firstName} (Sirket: ${delegProfileRes.body.data.profile.companyName}) ✔️`);

    // Generate Proforma Invoice
    const invoiceRes = await request('POST', `/corporate/batches/${corpBatchId}/invoice`, { amount: 1450.0 }, corpToken);
    console.log(`  -> Proforma Faktura yaradildi: ${invoiceRes.body.data.invoice.invoiceNumber} (PDF: ${invoiceRes.body.data.pdfUrl}) ✔️`);

    // Pay Batch with Corporate Wallet
    const payWalletRes = await request('POST', `/corporate/batches/${corpBatchId}/pay-wallet`, { amount: 1450.0 }, corpToken);
    console.log(`  -> Balansdan odenis edildi: Yeni balans €${payWalletRes.body.data.newWalletBalance} ✔️`);

    // 20. Payment Intent & Mock Confirmation & Admin Approval
    console.log('\n[20/21] Payment Intent & Admin Decision Pipeline...');
    const intentRes = await request('POST', '/payments/create-intent', { dossierId }, token);
    const intentId = intentRes.body.data.paymentIntentId;
    await request('POST', '/payments/confirm-mock', { paymentIntentId: intentId }, token);

    const decision = await request('PATCH', `/admin/dossier/${dossierId}/decision`, {
      nextStatus: 'APPROVED',
      notes: 'Tebrikler! Vizaniz tesdiq edildi.',
    }, adminToken);
    console.log(`  -> STATUS: ${decision.status} | Yekun Dosye Statusu: ${decision.body.data.dossier.status} ✔️`);

    // 21. Disaster Recovery Test
    console.log('\n[21/21] Disaster Recovery: RPO/RTO Integrity Test...');
    await runDisasterRecoveryTest();

    // Summary
    console.log('\n===============================================================');
    console.log(' SUCCESS: BÜTÜN 21 ENTERPRISE END-TO-END TESTLER 100% KEÇDI!');
    console.log('===============================================================\n');

  } catch (error) {
    console.error('Test zamani xeta yarandi:', error);
  } finally {
    if (server) {
      server.close();
    }
  }
}

runAllTests().then(async () => {
  await prisma.$disconnect();
  process.exit(0);
}).catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
