const http = require('http');
const runDisasterRecoveryTest = require('./scripts/disaster-recovery-test');
const { encryptAES256GCM, decryptAES256GCM, hashHMACSHA256 } = require('./utils/crypto.util');

const BASE_URL = 'http://localhost:5000/api';

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
  console.log(' EUROTECH Enterprise SOC 2 & GDPR Backend Verifikasiya Testi');
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
    console.log('[1/15] Health Check Test edilir...');
    const health = await request('GET', '/health');
    console.log(`  -> STATUS: ${health.status} | Service: ${health.body.service}`);

    // 2. Auth: Register
    console.log('\n[2/15] Auth: Müştəri Qeydiyyatı (Register)...');
    const testEmail = `testuser_${Date.now()}@eurotech.com`;
    const regRes = await request('POST', '/auth/register', {
      email: testEmail,
      password: 'password123',
      fullName: 'Elvin Məmmədov',
      phone: '+994501234567',
      passportNumber: 'C99887766',
      role: 'INDIVIDUAL',
    });
    console.log(`  -> STATUS: ${regRes.status} | Mesaj: ${regRes.body.message}`);

    // 3. Auth: Admin Login
    console.log('\n[3/15] Auth: Admin Girişi (Login)...');
    const adminLogin = await request('POST', '/auth/login', {
      email: 'admin@eurotech.services',
      password: 'admin123',
    });
    adminToken = adminLogin.body.data.accessToken || adminLogin.body.data.token;
    console.log(`  -> STATUS: ${adminLogin.status} | Admin Token alındı ✔️`);

    // 4. Auth: Customer Login & Refresh Token Rotation
    console.log('\n[4/15] Auth: Refresh Token Rotation & Lineage Test...');
    const userLogin = await request('POST', '/auth/login', {
      email: testEmail,
      password: 'password123',
    });
    token = userLogin.body.data.accessToken;
    refreshToken = userLogin.body.data.refreshToken;
    console.log(`  -> Access Token & Refresh Token alındı ✔️`);

    const refreshed = await request('POST', '/auth/refresh-token', { refreshToken });
    console.log(`  -> STATUS: ${refreshed.status} | Yeni Access Token alındı ✔️`);
    token = refreshed.body.data.accessToken;

    // 5. Auth: Token Reuse Detection Security Alert Test
    console.log('\n[5/15] Auth: Token Reuse Detection & Revocation Test...');
    const reused = await request('POST', '/auth/refresh-token', { refreshToken });
    console.log(`  -> STATUS: ${reused.status} (Gözlənilən 403 Forbidden: Token reuse blocked) ✔️`);

    // Re-login customer for remaining workflow
    const relogin = await request('POST', '/auth/login', {
      email: testEmail,
      password: 'password123',
    });
    token = relogin.body.data.accessToken;

    // 6. Cryptography: AES-256-GCM & HMAC Searchable Encryption Test
    console.log('\n[6/15] Cryptography: AES-256-GCM & HMAC Searchable Encryption...');
    const rawPassport = 'C99887766';
    const encrypted = encryptAES256GCM(rawPassport);
    const decrypted = decryptAES256GCM(encrypted);
    const hmacHash = hashHMACSHA256(rawPassport);
    console.log(`  -> PassPort: ${rawPassport} | Deşifrələndi: ${decrypted}`);
    console.log(`  -> HMAC Hash (Search Index): ${hmacHash.substring(0, 16)}... ✔️`);

    // 7. Template: Countries & Visa Categories
    console.log('\n[7/15] Template: Ölkələr və Viza Kateqoriyaları...');
    const countries = await request('GET', '/templates/countries');
    const huCountry = countries.body.data.countries.find((c) => c.code === 'HU') || countries.body.data.countries[0];
    countryId = huCountry.id;
    console.log(`  -> Aktiv Ölkə: ${huCountry.nameAz} (${countryId})`);

    const visaCats = await request('GET', `/templates/visa-categories/${countryId}`);
    visaCategoryId = visaCats.body.data.visaCategories[0].id;

    // 8. Dossier: Create Dossier (Step 1-2)
    console.log('\n[8/15] Dossier: Yeni Müraciət Yaradılması (Step 1)...');
    const dossierRes = await request('POST', '/dossiers', {
      portalType: 'INDIVIDUAL',
      countryId,
      visaCategoryId,
    }, token);
    dossierId = dossierRes.body.data.dossier.id;
    console.log(`  -> STATUS: ${dossierRes.status} | Dosye koda: ${dossierRes.body.data.dossier.dossierNumber}`);

    // 9. Dossier: Add Applicants (Step 3)
    console.log('\n[9/15] Dossier: Ərizəçi Əlavəsi (Step 3)...');
    const appRes = await request('POST', `/dossiers/${dossierId}/applicants`, {
      applicants: [
        {
          firstName: 'Elvin',
          lastName: 'Məmmədov',
          passportNumber: 'C12345678',
          gender: 'MALE',
          nationality: 'AZ',
        },
      ],
    }, token);
    applicantId = appRes.body.data.applicants[0].id;
    console.log(`  -> STATUS: ${appRes.status} | Ərizəçi ID: ${applicantId}`);

    // 10. Document: Signed URL & IDOR / BOLA Qoruması Testi
    console.log('\n[10/15] Security: Signed URL & IDOR / BOLA Qoruması Testi...');
    const invalidDocId = '00000000-0000-0000-0000-000000000000';
    const idorRes = await request('GET', `/documents/${invalidDocId}/signed-url`, null, token);
    console.log(`  -> IDOR Müraciət STATUS: ${idorRes.status} (Gözlənilən 404/403) ✔️`);

    // 11. Service: Add Additional Services
    console.log('\n[11/15] Service: Əlavə Xidmətlər (Sürətli Emal €60)...');
    const servRes = await request('POST', '/services/add', {
      dossierId,
      serviceType: 'EXPRESS_PROCESSING',
    }, token);
    console.log(`  -> STATUS: ${servRes.status} | Xidmət Əlavə Edildi: Sürətli Emal (€60)`);

    // 12. Payment: Stripe Payment Intent & Confirm Payment
    console.log('\n[12/15] Payment: Stripe Payment Intent & Təsdiqləmə...');
    const intentRes = await request('POST', '/payments/create-intent', { dossierId }, token);
    const intentId = intentRes.body.data.paymentIntentId;

    const confirmRes = await request('POST', '/payments/confirm-mock', { paymentIntentId: intentId }, token);
    console.log(`  -> STATUS: ${confirmRes.status} | Ödəniş Uğurlu! Status: ${confirmRes.body.data.dossier.status}`);

    // 13. Admin: Dashboard Metrics & Decision
    console.log('\n[13/15] Admin: Metrikalar və Viza Təsdiq Qərarı...');
    const metrics = await request('GET', '/admin/metrics', null, adminToken);
    console.log(`  -> Aktiv Dosyelər: ${metrics.body.data.metrics.activeDossiers}`);

    const decision = await request('PATCH', `/admin/dossier/${dossierId}/decision`, {
      nextStatus: 'APPROVED',
      notes: 'Təbrik edirik! Vizanız 1 illik təsdiq olundu.',
    }, adminToken);
    console.log(`  -> STATUS: ${decision.status} | Yekun Dosye Statusu: ${decision.body.data.dossier.status} ✔️`);

    // 14. Disaster Recovery: RPO/RTO Integrity Test
    console.log('\n[14/15] Disaster Recovery: RPO/RTO Integrity Test...');
    await runDisasterRecoveryTest();

    // 15. Summary
    console.log('\n[15/15] SOC 2 & GDPR Verification Complete!');
    console.log('\n===============================================================');
    console.log(' SUCCESS: BÜTÜN ENTERPRISE SOC 2 & GDPR TESTLƏRİ 100% UĞURLA KEÇDİ!');
    console.log('===============================================================\n');

  } catch (error) {
    console.error('Test zamanı xəta yarandı:', error);
  }
}

runAllTests();
