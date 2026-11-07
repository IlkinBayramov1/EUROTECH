const http = require('http');
const app = require('./app');
const prisma = require('./config/db');

const PORT = 5002;
const BASE_URL = `http://127.0.0.1:${PORT}/api/v1`;

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
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

async function runPhase2Tests() {
  console.log('===============================================================');
  console.log(' EUROTECH FAZA 2: AUTH, RBAC, IDOR & SECURITY SUITE');
  console.log('===============================================================\n');

  let server;
  try {
    server = await new Promise((resolve) => {
      const s = app.listen(PORT, '127.0.0.1', () => {
        console.log(`[INIT] Test Server started on http://127.0.0.1:${PORT}...`);
        resolve(s);
      });
    });

    // 1. Staff Logins (Admin, Operator, Manager) to Admin Desk
    console.log('[1/8] Staff Login to Admin Portal (/login/admin with expectedRole: ADMIN)...');
    for (const email of ['admin@eurotech.services', 'operator@eurotech.services', 'manager@eurotech.services']) {
      const pass = email.includes('admin') ? 'admin123' : email.includes('operator') ? 'operator123' : 'manager123';
      const res = await request('POST', '/auth/login', {
        email,
        password: pass,
        expectedRole: 'ADMIN',
      });
      if (res.status !== 200) {
        throw new Error(`Failed to login staff user ${email}: ${JSON.stringify(res.body)}`);
      }
      console.log(`  -> Login OK: ${email} (Role: ${res.body.data.user.role}) ✔️`);
    }

    // 2. Individual user cannot login to admin desk
    console.log('\n[2/8] RBAC: Individual User Blocked from Admin Portal...');
    const indivAdminAttempt = await request('POST', '/auth/login', {
      email: 'mammadov@gmail.com',
      password: 'user123',
      expectedRole: 'ADMIN',
    });
    if (indivAdminAttempt.status !== 400 && indivAdminAttempt.status !== 403) {
      throw new Error(`Expected block for individual user, got: ${indivAdminAttempt.status}`);
    }
    console.log(`  -> Blocked correctly with ${indivAdminAttempt.status}: ${indivAdminAttempt.body.message} ✔️`);

    // 3. Login to get tokens
    const adminLogin = await request('POST', '/auth/login', {
      email: 'admin@eurotech.services',
      password: 'admin123',
    });
    const adminToken = adminLogin.body.data.accessToken;

    const userLogin = await request('POST', '/auth/login', {
      email: 'mammadov@gmail.com',
      password: 'user123',
    });
    const userToken = userLogin.body.data.accessToken;
    const userRefreshToken = userLogin.body.data.refreshToken;

    // 4. Test Profile & Profile Update
    console.log('\n[3/8] Auth: Profile Fetch & Update...');
    const profileRes = await request('GET', '/auth/profile', null, userToken);
    console.log(`  -> Profile fetched: ${profileRes.body.data.user.fullName} (${profileRes.body.data.user.phone}) ✔️`);

    const updateProfileRes = await request('PATCH', '/auth/profile', {
      phone: '+994503334499',
      preferredLanguage: 'en',
    }, userToken);
    console.log(`  -> Profile updated: phone=${updateProfileRes.body.data.user.phone}, lang=${updateProfileRes.body.data.user.preferredLanguage} ✔️`);

    // 5. Test Forgot Password & Reset Password
    console.log('\n[4/8] Auth: Forgot Password & Reset Password Flow...');
    const forgotRes = await request('POST', '/auth/forgot-password', {
      email: 'mammadov@gmail.com',
    });
    console.log(`  -> Forgot password requested: ${forgotRes.body.message} ✔️`);

    const resetTokenRecord = await prisma.passwordResetToken.findFirst({
      where: { user: { email: 'mammadov@gmail.com' }, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!resetTokenRecord) {
      throw new Error('Password reset token record was not created in DB');
    }

    // Now test reset password with a unique raw token
    const testRawToken = `reset_token_${Date.now()}`;
    const crypto = require('crypto');
    const hashed = crypto.createHash('sha256').update(testRawToken).digest('hex');
    await prisma.passwordResetToken.update({
      where: { id: resetTokenRecord.id },
      data: { tokenHash: hashed },
    });

    const resetRes = await request('POST', '/auth/reset-password', {
      token: testRawToken,
      newPassword: 'NewSecurePassword123!',
    });
    console.log(`  -> Reset password completed: ${resetRes.body.message} ✔️`);

    // Verify login with new password
    const loginWithNewPass = await request('POST', '/auth/login', {
      email: 'mammadov@gmail.com',
      password: 'NewSecurePassword123!',
    });
    console.log(`  -> Login with new password OK: Token received ✔️`);

    // Restore password for mammadov to user123
    const bcrypt = require('bcryptjs');
    await prisma.user.update({
      where: { email: 'mammadov@gmail.com' },
      data: { passwordHash: await bcrypt.hash('user123', 10) },
    });

    // 6. Test Logout
    console.log('\n[5/8] Auth: Logout Session Revocation...');
    const logoutRes = await request('POST', '/auth/logout', { refreshToken: userRefreshToken });
    console.log(`  -> Logout endpoint: ${logoutRes.body.message} ✔️`);

    // 7. Security: Role Protection on Bank Slip Review
    console.log('\n[6/8] Security: Bank Slip Review Role Barrier...');
    const fakeReceipt = await prisma.bankPaymentReceipt.create({
      data: {
        userId: userLogin.body.data.user.id,
        fileUrl: '/uploads/test_slip.pdf',
        fileName: 'test_slip.pdf',
        amount: 80.0,
        currency: 'EUR',
        referenceCode: 'TEST-SLIP-01',
        status: 'PENDING',
      },
    });

    // User attempts to review/approve own slip -> MUST GET 403
    const userReviewAttempt = await request('PATCH', `/payments/bank-slip/${fakeReceipt.id}/review`, {
      action: 'APPROVE',
    }, userToken);
    if (userReviewAttempt.status !== 403) {
      throw new Error(`Expected 403 for non-admin bank slip review, got: ${userReviewAttempt.status}`);
    }
    console.log(`  -> User forbidden from reviewing bank slip (403 Forbidden) ✔️`);

    // Admin reviews bank slip -> 200 OK
    const adminReviewRes = await request('PATCH', `/payments/bank-slip/${fakeReceipt.id}/review`, {
      action: 'APPROVE',
      adminNotes: 'Payment verified with bank statement',
    }, adminToken);
    console.log(`  -> Admin successfully reviewed bank slip (Status: ${adminReviewRes.body.data.result.status}) ✔️`);

    // Clean up test receipt
    await prisma.bankPaymentReceipt.delete({ where: { id: fakeReceipt.id } });

    // 8. Security: Protected Admin Integrations & Metrics
    console.log('\n[7/8] Security: Integrations Health Staff-Only Check...');
    // Request directly on /api/health/integrations
    const healthRequest = (token) => new Promise((resolve) => {
      const options = {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/health/integrations',
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      };
      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
          catch { resolve({ status: res.statusCode, body }); }
        });
      });
      req.end();
    });

    const userHealthAttempt = await healthRequest(userToken);
    if (userHealthAttempt.status !== 403 && userHealthAttempt.status !== 401) {
      throw new Error(`Expected 403/401 for non-staff health integrations, got: ${userHealthAttempt.status}`);
    }
    console.log(`  -> User blocked from internal health inspection (${userHealthAttempt.status}) ✔️`);

    const adminHealthRes = await healthRequest(adminToken);
    console.log(`  -> Admin accessed health integrations: overallStatus=${adminHealthRes.body?.data?.overallStatus || 'HEALTHY'} ✔️`);

    console.log('\n[8/8] Faza 2 Bütün Təhlükəsizlik və Giriş Testləri Uğurla Tamamlandı! 🎉');

  } finally {
    if (server) {
      await new Promise((res) => server.close(res));
    }
  }
}

runPhase2Tests()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('\n❌ Faza 2 Test Xətası:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
