const BASE_URL = 'http://localhost:5000';
let adminToken = '';
let agentToken = '';
let individualToken = '';
let createdDossierId = '';
let createdApplicantId = '';

async function runTests() {
  console.log('====================================================');
  console.log('   EUROTECH FAZA 3 İNTEQRASİYA VƏ SİSTEM TESTLƏRİ   ');
  console.log('====================================================\n');

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

  // 1. Health Integrations
  await test('1. Health Check Endpoint (/api/health/integrations)', async () => {
    const res = await fetch(`${BASE_URL}/api/health/integrations`);
    const data = await res.json();
    if (!res.ok || data.status !== 'HEALTHY') {
      throw new Error(`Expected HEALTHY, got ${JSON.stringify(data)}`);
    }
    if (!data.integrations.database || data.integrations.database.status !== 'UP') {
      throw new Error('Database is not UP');
    }
    if (data.integrations.backgroundSchedulers.activeWorkersCount !== 5) {
      throw new Error('Expected 5 active cron workers');
    }
  });

  // 2. Auth Tokens (Admin, Individual, Agent)
  await test('2. Auth Tokens (Admin, Individual, Agent)', async () => {
    const prisma = require('./config/db');
    const { generateToken } = require('./utils/jwt.util');

    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    const agent = await prisma.user.findFirst({ where: { role: 'AGENT_TUR_OPERATOR' } });
    const individual = await prisma.user.findFirst({ where: { role: 'INDIVIDUAL' } });

    if (!admin || !agent || !individual) {
      throw new Error('Required seeded users not found in DB');
    }

    adminToken = generateToken({ userId: admin.id, id: admin.id, email: admin.email, role: admin.role });
    agentToken = generateToken({ userId: agent.id, id: agent.id, email: agent.email, role: agent.role });
    individualToken = generateToken({ userId: individual.id, id: individual.id, email: individual.email, role: individual.role });

    if (!adminToken || !agentToken || !individualToken) {
      throw new Error('Failed to generate authentication tokens');
    }
  });


  // Setup a test dossier
  await test('3. Setup Dossier & Applicant for Payment Tests', async () => {
    const prisma = require('./config/db');
    const category = await prisma.visaCategory.findFirst({ include: { country: true } });
    if (!category || !category.country) {
      throw new Error('Visa category or linked country not found in DB');
    }
    const country = category.country;


    const dRes = await fetch(`${BASE_URL}/api/v1/dossiers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentToken}`,
      },
      body: JSON.stringify({
        countryId: country.id,
        visaCategoryId: category.id,
        portalType: 'GROUP_AGENT',
      }),
    });
    const dData = await dRes.json();
    if (!dData || !dData.data || !dData.data.dossier) {
      throw new Error(`Dossier create failed: ${JSON.stringify(dData)}`);
    }
    createdDossierId = dData.data.dossier.id;

    // Add applicant
    const aRes = await fetch(`${BASE_URL}/api/v1/dossiers/${createdDossierId}/applicants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentToken}`,
      },
      body: JSON.stringify({
        applicants: [
          {
            firstName: 'Nizami',
            lastName: 'Ganjavi',
            passportNumber: 'C10293847',
            nationality: 'AZE',
            familyRole: 'PRIMARY',
          },
        ],
      }),
    });
    const aData = await aRes.json();
    if (!aData || !aData.data || !aData.data.applicants) {
      throw new Error(`Applicant create failed: ${JSON.stringify(aData)}`);
    }
    createdApplicantId = aData.data.applicants[0].id;
  });



  // 4. Payment Intent & Idempotency
  await test('4. Stripe Payment Intent with Idempotency Key', async () => {
    const idempKey = `idemp_test_${Date.now()}`;
    const res1 = await fetch(`${BASE_URL}/api/v1/payments/create-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentToken}`,
      },
      body: JSON.stringify({
        dossierId: createdDossierId,
        idempotencyKey: idempKey,
      }),
    });
    const data1 = await res1.json();
    if (!res1.ok || !data1.data.clientSecret) {
      throw new Error('Failed to create payment intent');
    }

    // Call again with same idempotency key
    const res2 = await fetch(`${BASE_URL}/api/v1/payments/create-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentToken}`,
      },
      body: JSON.stringify({
        dossierId: createdDossierId,
        idempotencyKey: idempKey,
      }),
    });
    const data2 = await res2.json();
    if (data1.data.clientSecret !== data2.data.clientSecret) {
      throw new Error('Idempotency failure: client secrets do not match');
    }
  });

  // 5. Stripe Webhook & Agent Commission Fulfill
  await test('5. Stripe Webhook (payment_intent.succeeded) & Commission Settlement', async () => {
    // Read initial agent wallet balance
    const w1Res = await fetch(`${BASE_URL}/api/v1/agent/wallet`, {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    const w1Data = await w1Res.json();
    const initialBalance = w1Data.data.wallet.balance;

    // Create a new unique intent for this test
    const intentRes = await fetch(`${BASE_URL}/api/v1/payments/create-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentToken}`,
      },
      body: JSON.stringify({ dossierId: createdDossierId }),
    });
    const intentData = await intentRes.json();
    const piId = intentData.data.paymentIntentId;

    // Dispatch Webhook Event
    const whRes = await fetch(`${BASE_URL}/api/v1/webhooks/stripe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: piId,
            amount: 20000,
            currency: 'eur',
          },
        },
      }),
    });
    const whData = await whRes.json();
    if (!whRes.ok || !whData.received) {
      throw new Error(`Webhook failed: ${JSON.stringify(whData)}`);
    }

    // Check agent wallet balance increased by commission (€20.0 for Bronze tier)
    const w2Res = await fetch(`${BASE_URL}/api/v1/agent/wallet`, {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    const w2Data = await w2Res.json();
    const newBalance = w2Data.data.wallet.balance;
    if (newBalance <= initialBalance) {
      throw new Error(`Agent commission was not credited! Was ${initialBalance}, now ${newBalance}`);
    }
  });

  // 6. Local Bank Gateway Flow (Azericard / Kapital Pay)
  await test('6. Local Bank Gateway (Order Creation & HMAC Callback)', async () => {
    const orderRes = await fetch(`${BASE_URL}/api/v1/payments/local-bank/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentToken}`,
      },
      body: JSON.stringify({
        dossierId: createdDossierId,
        returnUrl: 'https://eurotech.services/payment/callback',
      }),
    });
    const orderData = await orderRes.json();
    if (!orderRes.ok || !orderData.data.params.signature) {
      throw new Error(`Failed to create local bank order: ${JSON.stringify(orderData)}`);
    }

    const orderRef = orderData.data.orderReference;
    const amount = orderData.data.params.amount;

    // Simulate Bank Server Callback
    const cbRes = await fetch(`${BASE_URL}/api/v1/webhooks/local-bank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderReference: orderRef,
        amount,
        currency: 'AZN',
        status: 'APPROVED',
        timestamp: Date.now().toString(),
        signature: 'mock_bank_valid_sig',
      }),
    });
    const cbData = await cbRes.json();
    if (!cbRes.ok || cbData.paymentStatus !== 'PAID') {
      throw new Error(`Local bank callback failed: ${JSON.stringify(cbData)}`);
    }
  });

  // 7. Bank Slip Upload & Admin Reconciliation
  await test('7. Bank Wire Slip Upload & Admin Reconciliation', async () => {
    const slipRes = await fetch(`${BASE_URL}/api/v1/payments/bank-slip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentToken}`,
      },
      body: JSON.stringify({
        dossierId: createdDossierId,
        amount: 200.0,
        referenceCode: 'REF-TEST-IBAN-8899',
        fileUrl: '/uploads/wire_receipt.pdf',
        fileName: 'wire_receipt.pdf',
      }),
    });
    const slipData = await slipRes.json();
    if (!slipRes.ok || !slipData.data.receipt.id) {
      throw new Error('Failed to submit bank slip');
    }

    const receiptId = slipData.data.receipt.id;

    // Admin approves slip
    const reviewRes = await fetch(`${BASE_URL}/api/v1/payments/bank-slip/${receiptId}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        action: 'APPROVE',
        adminNotes: 'IBAN köçürməsi bank hesabımızda təsdiqləndi',
      }),
    });
    const reviewData = await reviewRes.json();
    if (!reviewRes.ok || reviewData.data.result.status !== 'PAID') {
      throw new Error(`Failed to approve bank slip: ${JSON.stringify(reviewData)}`);
    }
  });

  // 8. Cloud Object Storage Presigned URLs
  await test('8. Cloud Storage Presigned Upload & Download URLs', async () => {
    // Presigned upload
    const uRes = await fetch(`${BASE_URL}/api/v1/documents/presigned-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentToken}`,
      },
      body: JSON.stringify({
        dossierId: createdDossierId,
        fileName: 'passport_scan.pdf',
        contentType: 'application/pdf',
      }),
    });
    const uData = await uRes.json();
    if (!uRes.ok || !uData.data.uploadUrl || !uData.data.fileKey) {
      throw new Error(`Failed presigned upload: ${JSON.stringify(uData)}`);
    }

    // 2. Presigned download (create a document record in DB to test secure presigned download link)
    const prisma = require('./config/db');
    const doc = await prisma.applicantDocument.create({
      data: {
        dossierId: createdDossierId,
        applicantId: createdApplicantId,
        requiredDocumentType: 'PASSPORT',
        fileUrl: '/uploads/sample_passport.pdf',
        fileName: 'sample_passport.pdf',
        fileSize: 1024,
        status: 'PENDING',
      },
    });

    const dRes = await fetch(`${BASE_URL}/api/v1/documents/${doc.id}/presigned-download`, {
      headers: {
        Authorization: `Bearer ${agentToken}`,
      },
    });
    const dData = await dRes.json();
    if (!dRes.ok || !dData.data.downloadUrl) {
      throw new Error(`Failed presigned download: ${JSON.stringify(dData)}`);
    }
  });


  // 9. Meta WhatsApp Cloud API Verification & Inbound Bot
  await test('9. WhatsApp Webhook (Meta Challenge & Status Bot)', async () => {
    // 1. Challenge verification
    const challengeRes = await fetch(
      `${BASE_URL}/api/v1/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=eurotech_wa_verify_token_2026&hub.challenge=test_challenge_code`
    );
    const challengeText = await challengeRes.text();
    if (challengeText !== 'test_challenge_code') {
      throw new Error(`Challenge mismatch, got: ${challengeText}`);
    }

    // 2. Inbound interactive status message
    const botRes = await fetch(`${BASE_URL}/api/v1/webhooks/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: '994501234567',
                      text: { body: 'STATUS' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }),
    });
    const botData = await botRes.json();
    if (!botRes.ok || botData.status !== 'REPLIED') {
      throw new Error(`Bot reply failed: ${JSON.stringify(botData)}`);
    }
  });

  // 10. Background Cron Workers On-Demand
  await test('10. Automated Cron Jobs (Radar, Reminders, Reconciliation)', async () => {
    // Passport radar
    const r1 = await fetch(`${BASE_URL}/api/v1/cron/run/passport-radar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const d1 = await r1.json();
    if (!r1.ok || !d1.data.success) {
      throw new Error(`Radar job failed: ${JSON.stringify(d1)}`);
    }

    // Appointment reminders
    const r2 = await fetch(`${BASE_URL}/api/v1/cron/run/appointment-reminder`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const d2 = await r2.json();
    if (!r2.ok || !d2.data.success) {
      throw new Error(`Appointment job failed: ${JSON.stringify(d2)}`);
    }

    // Daily reconciliation
    const r3 = await fetch(`${BASE_URL}/api/v1/cron/run/daily-reconciliation`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const d3 = await r3.json();
    if (!r3.ok || !d3.data.success) {
      throw new Error(`Daily reconciliation failed: ${JSON.stringify(d3)}`);
    }

    // Check logs endpoint
    const logsRes = await fetch(`${BASE_URL}/api/v1/cron/logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const logsData = await logsRes.json();
    if (!logsRes.ok || logsData.data.logs.length < 3) {
      throw new Error(`Expected at least 3 cron logs, got ${logsData.data.logs.length}`);
    }
  });

  console.log('\n====================================================');
  console.log(`FAZA 3 TEST NƏTİCƏSİ: ${passed} KEÇDİ / ${failed} UĞURSUZ`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
