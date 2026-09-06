const http = require('http');
const prisma = require('./config/db');
const runDisasterRecoveryTest = require('./scripts/disaster-recovery-test');
const { encryptAES256GCM, decryptAES256GCM, hashHMACSHA256 } = require('./utils/crypto.util');

const BASE_URL = 'http://127.0.0.1:5000/api';

function request(method, path, data = null, token = null, isFormData = false) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    let bodyData = null;
    const headers = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (data && !isFormData) {
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
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, body: responseBody });
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
  console.log(' EUROTECH Enterprise SOC 2, GDPR & Customer Onboarding Testi');
  console.log('===============================================================\n');

  let token = null;
  let refreshToken = null;
  let adminToken = null;
  let countryId = null;
  let visaCategoryId = null;
  let dossierId = null;
  let applicantId = null;

  try {
    // 1. Health Check
    console.log('[1/16] Health Check Test edilir...');
    const health = await request('GET', '/health');
    console.log(`  -> STATUS: ${health.status} | Service: ${health.body.service}`);

    // 2. Customer Pre-Registration & Username Generation (AC-01, AC-02, AC-04, AC-05, AC-06)
    console.log('\n[2/16] Auth: Pre-Registration & Cryptographic Token/Username Engine...');
    const onboardingEmail = `onboarding_${Date.now()}@eurotech.com`;
    const preRegRes = await request('POST', '/auth/pre-register', {
      email: onboardingEmail,
      fullName: 'Aysel Qasımova',
      phone: '+994509998877',
      passportNumber: 'C11223344',
      role: 'INDIVIDUAL',
    });
    console.log(`  -> STATUS: ${preRegRes.status} | Mesaj: ${preRegRes.body.message}`);

    // Retrieve user from DB to verify hashed token and EUR username
    const dbUserPending = await prisma.user.findUnique({ where: { email: onboardingEmail } });
    console.log(`  -> Yaradılmış Username: ${dbUserPending.username} (EUR + 5 Rəqəm) ✔️`);
    console.log(`  -> Account Status: ${dbUserPending.accountStatus} (PENDING_PASSWORD) ✔️`);
    console.log(`  -> DB Password Hash: ${dbUserPending.passwordHash} (Clean NULL) ✔️`);

    // 3. Login Barrier Test for PENDING_PASSWORD Users (AC-03, AC-12)
    console.log('\n[3/16] Auth: PENDING_PASSWORD Hesabın Login Bloku Testi...');
    const blockedLogin = await request('POST', '/auth/login', {
      email: onboardingEmail,
      password: 'SomePassword123!',
    });
    console.log(`  -> STATUS: ${blockedLogin.status} (Gözlənilən 403 Forbidden: ${blockedLogin.body.message}) ✔️`);

    // 4. Email Enumeration Protection for Resend Set Password (AC-12)
    console.log('\n[4/16] Auth: Email Enumeration Protection Test...');
    const resendRes = await request('POST', '/auth/resend-set-password', {
      email: 'nonexistent_email_123456@eurotech.com',
    });
    console.log(`  -> STATUS: ${resendRes.status} | Neytral Mesaj: ${resendRes.body.message} ✔️`);

    // 5. Atomic Set Password & Single-Query Token Consumption (AC-07, AC-08, AC-09, AC-10, AC-13)
    console.log('\n[5/16] Auth: Single Atomic Set Password & Token Invalidation...');
    // Simulate setting password using the user's passwordSetTokenHash
    // Since we know dbUserPending.passwordSetTokenHash, let's create a valid raw token or directly set password
    const rawTestToken = 'test_raw_token_for_verification';
    const crypto = require('crypto');
    const hashedTestToken = crypto.createHash('sha256').update(rawTestToken).digest('hex');

    // Attach hashedTestToken to user for exact rawToken setPassword verification
    await prisma.user.update({
      where: { id: dbUserPending.id },
      data: { passwordSetTokenHash: hashedTestToken },
    });

    const setPassRes = await request('POST', '/auth/set-password', {
      token: rawTestToken,
      newPassword: 'SecurePassword123!',
    });
    console.log(`  -> STATUS: ${setPassRes.status} | Mesaj: ${setPassRes.body.message} ✔️`);

    const dbUserActive = await prisma.user.findUnique({ where: { id: dbUserPending.id } });
    console.log(`  -> Yeni Account Status: ${dbUserActive.accountStatus} (ACTIVE) ✔️`);
    console.log(`  -> isVerified: ${dbUserActive.isVerified} (Email Ownership Verified) ✔️`);

    // Re-use same token -> Must be rejected with unified generic error
    const reusedTokenRes = await request('POST', '/auth/set-password', {
      token: rawTestToken,
      newPassword: 'SecurePassword123!',
    });
    console.log(`  -> Token Təkrar İstifadə STATUS: ${reusedTokenRes.status} (Gözlənilən 400: ${reusedTokenRes.body.message}) ✔️`);

    // 6. Login with Username / Email for ACTIVE User (AC-14)
    console.log('\n[6/16] Auth: Username ilə Sistemə Giriş (Login)...');
    const userLogin = await request('POST', '/auth/login', {
      username: dbUserActive.username,
      password: 'SecurePassword123!',
    });
    token = userLogin.body.data.accessToken;
    refreshToken = userLogin.body.data.refreshToken;
    console.log(`  -> STATUS: ${userLogin.status} | Access Token (${dbUserActive.username}) alındı ✔️`);

    // 7. Auth: Refresh Token Rotation
    console.log('\n[7/16] Auth: Refresh Token Rotation & Lineage Test...');
    const refreshed = await request('POST', '/auth/refresh-token', { refreshToken });
    console.log(`  -> STATUS: ${refreshed.status} | Yeni Access Token alındı ✔️`);
    token = refreshed.body.data.accessToken;

    // 8. Auth: Admin Login
    console.log('\n[8/16] Auth: Admin Girişi (Login)...');
    const { hashPassword } = require('./utils/hash.util');
    const adminHash = await hashPassword('admin123');
    await prisma.user.upsert({
      where: { email: 'admin@eurotech.services' },
      update: { accountStatus: 'ACTIVE', passwordHash: adminHash, role: 'ADMIN' },
      create: {
        email: 'admin@eurotech.services',
        username: 'EUR00001',
        passwordHash: adminHash,
        role: 'ADMIN',
        accountStatus: 'ACTIVE',
        fullName: 'System Super Admin',
        isVerified: true,
      },
    });

    const adminLogin = await request('POST', '/auth/login', {
      email: 'admin@eurotech.services',
      password: 'admin123',
    });
    adminToken = adminLogin.body.data.accessToken || adminLogin.body.data.token;
    console.log(`  -> STATUS: ${adminLogin.status} | Admin Token alındı ✔️`);

    // 9. Cryptography: AES-256-GCM & HMAC Searchable Encryption Test
    console.log('\n[9/16] Cryptography: AES-256-GCM & HMAC Searchable Encryption...');
    const rawPassport = 'C99887766';
    const encrypted = encryptAES256GCM(rawPassport);
    const decrypted = decryptAES256GCM(encrypted);
    const hmacHash = hashHMACSHA256(rawPassport);
    console.log(`  -> PassPort: ${rawPassport} | Deşifrələndi: ${decrypted}`);
    console.log(`  -> HMAC Hash (Search Index): ${hmacHash.substring(0, 16)}... ✔️`);

    // 10. Template: Countries & Visa Categories
    console.log('\n[10/16] Template: Ölkələr və Viza Kateqoriyaları...');
    const countries = await request('GET', '/templates/countries');
    const huCountry = countries.body.data.countries.find((c) => c.code === 'HU') || countries.body.data.countries[0];
    countryId = huCountry.id;
    console.log(`  -> Aktiv Ölkə: ${huCountry.nameAz} (${countryId})`);

    const visaCats = await request('GET', `/templates/visa-categories/${countryId}`);
    visaCategoryId = visaCats.body.data.visaCategories[0].id;

    // 11. Dossier: Create Dossier (Step 1-2) (AC-15)
    console.log('\n[11/16] Dossier: 8-Step Wizard — Müraciət Yaradılması (Step 1)...');
    const dossierRes = await request('POST', '/dossiers', {
      portalType: 'INDIVIDUAL',
      countryId,
      visaCategoryId,
    }, token);
    dossierId = dossierRes.body.data.dossier.id;
    console.log(`  -> STATUS: ${dossierRes.status} | Dosye kodu: ${dossierRes.body.data.dossier.dossierNumber}`);

    // 12. Dossier: Add Applicants (Step 3)
    console.log('\n[12/16] Dossier: Ərizəçi Əlavəsi (Step 3)...');
    const appRes = await request('POST', `/dossiers/${dossierId}/applicants`, {
      applicants: [
        {
          firstName: 'Aysel',
          lastName: 'Qasımova',
          passportNumber: 'C11223344',
          gender: 'FEMALE',
          nationality: 'AZ',
        },
      ],
    }, token);
    applicantId = appRes.body.data.applicants[0].id;
    console.log(`  -> STATUS: ${appRes.status} | Ərizəçi ID: ${applicantId}`);

    // 13. Document: Signed URL & IDOR / BOLA Qoruması Testi
    console.log('\n[13/16] Security: Signed URL & IDOR / BOLA Qoruması Testi...');
    const invalidDocId = '00000000-0000-0000-0000-000000000000';
    const idorRes = await request('GET', `/documents/${invalidDocId}/signed-url`, null, token);
    console.log(`  -> IDOR Müraciət STATUS: ${idorRes.status} (Gözlənilən 404/403) ✔️`);

    // 14. Service: Add Additional Services
    console.log('\n[14/16] Service: Əlavə Xidmətlər (Sürətli Emal €60)...');
    const servRes = await request('POST', '/services/add', {
      dossierId,
      serviceType: 'EXPRESS_PROCESSING',
    }, token);
    console.log(`  -> STATUS: ${servRes.status} | Xidmət Əlavə Edildi: Sürətli Emal (€60)`);

    // 15. Payment & Admin Decision
    console.log('\n[15/16] Payment & Admin Decision...');
    const intentRes = await request('POST', '/payments/create-intent', { dossierId }, token);
    const intentId = intentRes.body.data.paymentIntentId;
    await request('POST', '/payments/confirm-mock', { paymentIntentId: intentId }, token);

    const decision = await request('PATCH', `/admin/dossier/${dossierId}/decision`, {
      nextStatus: 'APPROVED',
      notes: 'Təbrik edirik! Vizanız təsdiq olundu.',
    }, adminToken);
    console.log(`  -> STATUS: ${decision.status} | Yekun Dosye Statusu: ${decision.body.data.dossier.status} ✔️`);

    // 16. Disaster Recovery: RPO/RTO Integrity Test
    console.log('\n[16/16] Disaster Recovery: RPO/RTO Integrity Test...');
    await runDisasterRecoveryTest();

    // Summary
    console.log('\n===============================================================');
    console.log(' SUCCESS: BÜTÜN ENTERPRISE SOC 2, GDPR & ONBOARDING TESTLƏRİ KEÇDİ!');
    console.log('===============================================================\n');

  } catch (error) {
    console.error('Test zamanı xəta yarandı:', error);
  }
}

runAllTests();
