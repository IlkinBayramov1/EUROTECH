const fs = require('fs');
const path = require('path');
const prisma = require('./config/db');
const env = require('./config/env');
const { fillSchengenPDF } = require('./utils/schengenPdfFiller.util');
const { generateApplicationPdf } = require('./utils/pdf.util');

const PORT = 5003;
const API_BASE = `http://127.0.0.1:${PORT}/api/v1`;

async function runPhase3Tests() {
  console.log('--- STARTING FAZA 3 AUTOMATED VERIFICATION ---');
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // Start express server on port 5003 for testing
  const app = require('./app');
  const server = app.listen(PORT);

  try {
    // -------------------------------------------------------------
    // Test 1: Schengen 37-Point PDF Filler Generation
    // -------------------------------------------------------------
    console.log('\n[1] Testing 37-point Schengen AcroForm PDF Filler...');
    const dummyApplicant = {
      firstName: 'Ilkin',
      lastName: 'Aliyev',
      passportNumber: 'C12345678',
      birthDate: '1992-05-14',
      gender: 'Male',
      nationality: 'Azerbaijan',
      formDataJson: {
        address: 'Nizami street 42, Baku',
        homeEmail: 'ilkin.test@example.com',
        homePhone: '+994501234567',
        destination: 'Hungary',
        purpose: 'Tourism',
        costCoveredBy: 'applicant',
        meansOfSupportApplicant: ['cash', 'credit_card'],
        isMinor: 'No',
        hasEuFamilyMember: 'No',
      }
    };
    const dummyDossier = {
      dossierNumber: 'EUR-2026-TEST-001',
      country: { nameEn: 'Hungary', nameAz: 'Macarıstan', code: 'HU' },
      visaCategory: { nameEn: 'Tourist Schengen C', code: 'SCHENGEN_TOURIST' }
    };

    const pdfResult = await fillSchengenPDF(dummyApplicant, dummyDossier);
    assert(pdfResult && pdfResult.filePath && fs.existsSync(pdfResult.filePath), 'Schengen AcroForm PDF was created and exists on disk');
    assert(pdfResult.pdfBytes && pdfResult.pdfBytes.length > 5000, 'Schengen PDF has valid byte content (>5KB)');

    // -------------------------------------------------------------
    // Test 2: Unified pdf.util.js generateApplicationPdf
    // -------------------------------------------------------------
    console.log('\n[2] Testing pdf.util.js generateApplicationPdf integration...');
    const legacyUnifiedPdf = await generateApplicationPdf(dummyDossier, dummyApplicant);
    assert(legacyUnifiedPdf && (legacyUnifiedPdf.filePath || legacyUnifiedPdf.downloadUrl), 'generateApplicationPdf routes to fillSchengenPDF successfully');

    // -------------------------------------------------------------
    // Test 3: Notification API endpoints (GET & PATCH)
    // -------------------------------------------------------------
    console.log('\n[3] Testing Notification API endpoints...');
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'mammadov@gmail.com',
        password: 'user123',
      }),
    });
    const loginData = await loginRes.json();
    console.log('Login Response:', loginRes.status, loginData);
    const clientToken = loginData.data?.accessToken;
    const clientUser = loginData.data?.user;

    assert(clientToken, 'Client login successful for testing notifications');

    // Seed a notification
    await prisma.notification.create({
      data: {
        userId: clientUser.id,
        title: 'Consular Dossier Updated',
        message: 'Your biometric verification has been scheduled.',
        type: 'INFO',
        isRead: false,
      }
    });

    const notifsRes = await fetch(`${API_BASE}/notifications`, {
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    const notifsData = await notifsRes.json();
    assert(notifsRes.status === 200 && notifsData.success, 'GET /notifications returns 200 OK');
    assert(Array.isArray(notifsData.data?.notifications), 'Notifications returned as array');
    assert(notifsData.data?.unreadCount >= 1, 'Unread notification count matches database');

    const markAllRes = await fetch(`${API_BASE}/notifications/read-all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    const markAllData = await markAllRes.json();
    assert(markAllRes.status === 200 && markAllData.success, 'PATCH /notifications/read-all returns 200 OK');

    // -------------------------------------------------------------
    // Test 4: Bank Payment Slip Submission (POST /payments/bank-slip)
    // -------------------------------------------------------------
    console.log('\n[4] Testing Bank Transfer Slip Upload...');
    const userDossier = await prisma.dossier.findFirst({
      where: { userId: clientUser.id },
    });
    let testDossierId = userDossier?.id;
    if (!testDossierId) {
      const hu = await prisma.country.findFirst({ where: { code: 'HU' } });
      const vc = await prisma.visaCategory.findFirst({ where: { countryId: hu.id } });
      const created = await prisma.dossier.create({
        data: {
          dossierNumber: `EUR-${Date.now()}`,
          userId: clientUser.id,
          countryId: hu.id,
          visaCategoryId: vc.id,
          portalType: 'INDIVIDUAL',
        }
      });
      testDossierId = created.id;
    }

    const formData = new FormData();
    formData.append('dossierId', testDossierId);
    formData.append('amount', '157.25');
    formData.append('currency', 'AZN');
    formData.append('bankName', 'ABB (International Bank of Azerbaijan)');
    formData.append('senderName', 'Client Test User');
    formData.append('receiptNumber', `SLIP-${Date.now()}`);
    formData.append('purpose', 'Value-Added Services (Premium Lounge)');
    
    const fileBlob = new Blob(['%PDF-1.4 TEST OFFICIAL BANK SLIP RECEIPT CONTENT'], { type: 'application/pdf' });
    formData.append('slip', fileBlob, 'test-slip-receipt.pdf');

    const slipRes = await fetch(`${API_BASE}/payments/bank-slip`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${clientToken}`,
      },
      body: formData,
    });
    const slipData = await slipRes.json();

    assert(slipRes.status === 201, 'POST /payments/bank-slip returns 201 Created');
    const receiptObj = slipData.data?.receipt || slipData.data;
    assert(receiptObj && receiptObj.status === 'PENDING', 'Bank slip receipt saved with PENDING status');
    const uploadedPath = path.resolve(env.UPLOAD_DIR, path.basename(receiptObj.fileUrl));
    assert(fs.existsSync(uploadedPath), 'Uploaded slip physical file exists in uploads');

    // -------------------------------------------------------------
    // Test 5: GDPR Privacy Export (Passport masking)
    // -------------------------------------------------------------
    console.log('\n[5] Testing GDPR Privacy Export & Secure Masking...');
    const { exportUserData } = require('./modules/shared/services/privacyExport.service');
    const exportResult = await exportUserData(clientUser.id);
    assert(exportResult && exportResult.user, 'GDPR user data export completed');
    if (exportResult.user.dossiers && exportResult.user.dossiers.length > 0) {
      for (const d of exportResult.user.dossiers) {
        if (d.applicants && d.applicants.length > 0) {
          for (const a of d.applicants) {
            if (a.passportNumber && a.passportNumber !== 'N/A') {
              assert(a.passportNumber.includes('*'), `Passport is masked in GDPR export: ${a.passportNumber}`);
            }
          }
        }
      }
    }

    console.log(`\n========================================`);
    console.log(`FAZA 3 ALL ${passed}/${total} TESTS PASSED SUCCESSFULLY!`);
    console.log(`========================================\n`);
    process.exit(0);
  } finally {
    server.close();
  }
}

runPhase3Tests().catch((err) => {
  console.error('\nFAZA 3 TEST SUITE FAILED:', err);
  process.exit(1);
});
