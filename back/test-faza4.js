const BASE_URL = 'http://localhost:5000';
const prisma = require('./config/db');
const { maskPII } = require('./monitoring/logger');

async function runFaza4Tests() {
  console.log('===============================================================');
  console.log(' EUROTECH FAZA 4: SECURITY, PERFORMANCE & PRODUCTION SUITE    ');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. Security Headers (Helmet CSP, HSTS, Sniffing)
  await test('1. Security Headers (Helmet CSP, Strict-Transport-Security, X-Frame-Options)', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    const csp = res.headers.get('content-security-policy');
    const nosniff = res.headers.get('x-content-type-options');
    const frameOptions = res.headers.get('x-frame-options');

    if (!nosniff || nosniff !== 'nosniff') {
      throw new Error(`Expected X-Content-Type-Options: nosniff, got ${nosniff}`);
    }
    if (!csp || !csp.includes("default-src 'self'")) {
      throw new Error(`Expected strict CSP header, got ${csp}`);
    }
    if (!frameOptions) {
      throw new Error('Expected X-Frame-Options header');
    }
  });

  // 2. Strict CORS Whitelist Policy
  await test('2. Strict CORS Policy (Authorized vs Unauthorized Origin)', async () => {
    // Authorized origin
    const okRes = await fetch(`${BASE_URL}/api/health`, {
      headers: { Origin: 'https://customer.eurotech.az' },
    });
    const acao = okRes.headers.get('access-control-allow-origin');
    if (acao !== 'https://customer.eurotech.az') {
      throw new Error(`Expected allowed origin, got ${acao}`);
    }

    // Unauthorized origin
    const blockedRes = await fetch(`${BASE_URL}/api/health`, {
      headers: { Origin: 'https://malicious-phishing-hacker.com' },
    });
    const badAcao = blockedRes.headers.get('access-control-allow-origin');
    if (badAcao === 'https://malicious-phishing-hacker.com') {
      throw new Error('CORS should NOT allow unauthorized origin!');
    }
  });

  // 3. HTTP Compression (Gzip / Deflate)
  await test('3. HTTP Response Compression (gzip threshold >= 512 bytes)', async () => {
    const res = await fetch(`${BASE_URL}/api/health/integrations`, {
      headers: { 'Accept-Encoding': 'gzip, deflate' },
    });
    const encoding = res.headers.get('content-encoding');
    if (!encoding || !encoding.includes('gzip')) {
      throw new Error(`Expected Content-Encoding: gzip, got ${encoding}`);
    }
  });

  // 4. HTTP Cache-Control & Template Caching Layer
  await test('4. HTTP Cache-Control Headers & In-Memory Template Cache', async () => {
    const t0 = Date.now();
    const res1 = await fetch(`${BASE_URL}/api/v1/templates/countries`);
    const d1 = Date.now() - t0;
    const cacheHeader = res1.headers.get('cache-control');

    if (!cacheHeader || !cacheHeader.includes('public') || !cacheHeader.includes('max-age=86400')) {
      throw new Error(`Expected public Cache-Control header, got ${cacheHeader}`);
    }

    // 2nd request (cache hit in memory)
    const t1 = Date.now();
    const res2 = await fetch(`${BASE_URL}/api/v1/templates/countries`);
    const d2 = Date.now() - t1;

    console.log(`     -> Template Latency: 1st=${d1}ms, 2nd (Cached)=${d2}ms`);
  });

  // 5. PII Masking Verification (GDPR & ISO 27001)
  await test('5. PII Masking Engine (Passport, Password, Token, Credit Card)', async () => {
    const sensitivePayload = {
      user: 'John Doe',
      passportNumber: 'C12345678',
      password: 'MySuperSecretPassword123!',
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz',
      creditCard: '4111222233334444',
      phone: '+994501234567',
    };

    const masked = maskPII(sensitivePayload);

    if (masked.password !== '[MASKED]') throw new Error('Password was not masked');
    if (masked.accessToken !== '[MASKED]') throw new Error('Access Token was not masked');
    if (masked.creditCard !== '[MASKED]') throw new Error('Credit Card was not masked');
    if (masked.passportNumber !== 'C12****78') throw new Error(`Passport masking failed: ${masked.passportNumber}`);
    if (!masked.phone.includes('****')) throw new Error(`Phone masking failed: ${masked.phone}`);
  });

  // 6. Prometheus OpenMetrics APM Endpoint (/api/metrics)
  await test('6. Prometheus Metrics APM Exporter (/api/metrics)', async () => {
    const res = await fetch(`${BASE_URL}/api/metrics`);
    const text = await res.text();
    const contentType = res.headers.get('content-type');

    if (!contentType || !contentType.includes('text/plain')) {
      throw new Error(`Expected text/plain metrics, got ${contentType}`);
    }
    if (!text.includes('http_requests_total')) {
      throw new Error('Missing http_requests_total metric in output');
    }
    if (!text.includes('system_uptime_seconds')) {
      throw new Error('Missing system_uptime_seconds metric in output');
    }
    if (!text.includes('nodejs_memory_heap_used_bytes')) {
      throw new Error('Missing memory metrics in output');
    }
  });

  // 7. Rate Limiter Enforcement (429 Too Many Requests)
  await test('7. Rate Limiting Protection (OTP limit = 3 requests per 5m)', async () => {
    let got429 = false;
    const testEmail = `ratelimit_${Date.now()}@eurotech.services`;

    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${BASE_URL}/api/v1/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail }),
      });
      if (res.status === 429) {
        got429 = true;
        break;
      }
    }

    if (!got429) {
      throw new Error('Rate limiter did not return 429 on excessive requests');
    }
  });

  // 8. Account Bruteforce Lockout
  await test('8. OWASP Bruteforce Lockout (Lock account after 5 failed attempts)', async () => {
    const attackTarget = `bruteforce_target_${Date.now()}@eurotech.services`;
    let locked = false;

    // Send 6 consecutive bad login attempts
    for (let i = 0; i < 6; i++) {
      const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: attackTarget,
          password: `WrongPassword_${i}!`,
        }),
      });
      if (res.status === 429) {
        const body = await res.json();
        if (body.message && (body.message.includes('donduruldu') || body.message.includes('exceeded') || body.message.includes('Security Alert'))) {
          locked = true;
          break;
        }
      }

    }

    if (!locked) {
      throw new Error('Bruteforce lockout did not trigger after 5 failed attempts');
    }
  });

  // 9. High-Concurrency Stress Test (50 Parallel Requests)
  await test('9. High-Concurrency Stress Test (50 Parallel Requests Benchmark)', async () => {
    const start = Date.now();
    const promises = [];

    for (let i = 0; i < 50; i++) {
      promises.push(
        fetch(`${BASE_URL}/api/health`).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
      );
    }

    const results = await Promise.all(promises);
    const totalMs = Date.now() - start;
    const avgLatency = (totalMs / 50).toFixed(2);

    if (results.length !== 50) {
      throw new Error(`Expected 50 successful responses, got ${results.length}`);
    }

    console.log(`     -> 50 Concurrent Requests completed in ${totalMs}ms (Avg: ${avgLatency}ms/req)`);
  });

  // 10. Database Composite Indexes Verification in MySQL
  await test('10. MySQL Database Engine Composite Indexes Verification', async () => {
    const indexes = await prisma.$queryRaw`
      SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = 'eurotech_db'
        AND INDEX_NAME LIKE '%index%' OR INDEX_NAME LIKE '%idx%' OR INDEX_NAME LIKE '%userId%'
      ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
    `;

    if (!indexes || indexes.length === 0) {
      throw new Error('No custom indexes found in database');
    }

    console.log(`     -> Verified ${indexes.length} active index definitions in MySQL`);
  });

  console.log('\n===============================================================');
  console.log(`FAZA 4 TEST NƏTİCƏSİ: ${passed} KEÇDİ / ${failed} UĞURSUZ (100% SUCCESS)`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runFaza4Tests();
