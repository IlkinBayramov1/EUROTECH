const fs = require('fs');
const path = require('path');
const prisma = require('./config/db');
const env = require('./config/env');
const { generateManifestPdf } = require('./modules/appointment/services/appointmentManifestPdf.service');

const PORT = 5004;
const API_BASE = `http://127.0.0.1:${PORT}/api/v1`;

async function runPhase4Tests() {
  console.log('--- STARTING FAZA 4 AUTOMATED VERIFICATION ---');
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

  const app = require('./app');
  const server = app.listen(PORT);

  try {
    // -------------------------------------------------------------
    // Test 1: Agent Authentication & Role Validation
    // -------------------------------------------------------------
    console.log('\n[1] Testing Agent Login & Profile...');
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'agent@baku-tours.az',
        password: 'user123',
      }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200 && loginData.success, 'Agent login returns 200 OK');
    const agentToken = loginData.data?.accessToken;
    const agentUser = loginData.data?.user;
    assert(agentUser && agentUser.role === 'AGENT_TUR_OPERATOR', 'Authenticated user has AGENT_TUR_OPERATOR role');

    // -------------------------------------------------------------
    // Test 2: Group Creation with Non-HU Destination (e.g. Austria AT)
    // -------------------------------------------------------------
    console.log('\n[2] Testing Group Creation with Custom Country (Austria)...');
    const atCountry = await prisma.country.findFirst({ where: { code: 'AT' } });
    assert(atCountry, 'Austria (AT) country exists in database');

    const groupPayload = {
      name: `Alps Ski Tour ${Date.now()}`,
      destination: 'Austria',
      travelDate: '2026-12-15',
      duration: 'short',
      projectReason: 'Tourism',
    };

    const groupRes = await fetch(`${API_BASE}/agent/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentToken}`,
      },
      body: JSON.stringify(groupPayload),
    });
    const groupData = await groupRes.json();
    assert(groupRes.status === 201 && groupData.success, 'POST /agent/groups returns 201 Created');
    const createdGroup = groupData.data?.group;
    assert(createdGroup && createdGroup.destination === 'Austria', 'Created group destination matches input (Austria)');

    // Verify dossier country linked to group is Austria (not hardcoded Hungary!)
    const groupDossier = await prisma.dossier.findFirst({
      where: { groupBatchId: createdGroup.id },
      include: { country: true },
    });
    assert(groupDossier && groupDossier.country?.code === 'AT', 'Group dossier is correctly linked to Austria (AT), eliminating hardcoded HU bug');

    // -------------------------------------------------------------
    // Test 3: Passenger Addition & Form Sync
    // -------------------------------------------------------------
    console.log('\n[3] Testing Passenger Addition & Profile Sync...');
    const passengerRes = await fetch(`${API_BASE}/agent/groups/${createdGroup.id}/applicants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentToken}`,
      },
      body: JSON.stringify({
        firstName: 'Samir',
        lastName: 'Guliyev',
        passportNumber: 'C88776655',
        birthDate: '1995-04-10',
        nationality: 'Azerbaijan',
        gender: 'Male',
      }),
    });
    const passengerData = await passengerRes.json();
    assert(passengerRes.status === 200 || passengerRes.status === 201, 'Passenger created in agent group');

    // -------------------------------------------------------------
    // Test 4: Time Slot Booking with Group Size & Capacity Check
    // -------------------------------------------------------------
    console.log('\n[4] Testing Group Appointment & Slot Capacity Deduction...');
    const testSlotDate = '2026-11-20';
    const timeSlot = await prisma.timeSlot.create({
      data: {
        date: new Date(`${testSlotDate}T09:00:00.000Z`),
        startTime: '09:00',
        capacity: 10,
        bookedCount: 0,
        isActive: true,
        location: 'EuroTech Main Center, Port Baku Towers',
      },
    });

    const apptRes = await fetch(`${API_BASE}/agent/groups/${createdGroup.id}/appointment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentToken}`,
      },
      body: JSON.stringify({
        timeSlotId: timeSlot.id,
        appointmentDate: testSlotDate,
        appointmentTime: '09:00',
        location: 'EuroTech Main Center, Port Baku Towers',
      }),
    });
    const apptData = await apptRes.json();
    if (apptRes.status !== 200) console.log('Appointment error:', apptData);
    assert(apptRes.status === 200 && apptData.success, 'POST /agent/groups/:id/appointment returns 200 OK');

    const updatedSlot = await prisma.timeSlot.findUnique({ where: { id: timeSlot.id } });
    assert(updatedSlot.bookedCount >= 1, `TimeSlot bookedCount incremented by group size (Now: ${updatedSlot.bookedCount})`);

    // -------------------------------------------------------------
    // Test 5: Wallet Balance & Pending Debit Protection
    // -------------------------------------------------------------
    console.log('\n[5] Testing Agent Wallet Balance & Financial Protection...');
    const walletRes = await fetch(`${API_BASE}/agent/wallet`, {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    const walletData = await walletRes.json();
    assert(walletRes.status === 200 && walletData.success, 'GET /agent/wallet returns 200 OK');
    const wallet = walletData.data?.wallet || walletData.data;
    assert(wallet !== undefined, 'Wallet data structure present');

    // Verify un-paid group commission remains PENDING (does not inflate paid balance)
    const unpaidGroupTx = wallet.transactions.find((t) => t.referenceId === createdGroup.code);
    if (unpaidGroupTx) {
      assert(unpaidGroupTx.status === 'PENDING', 'Commission for unpaid group remains PENDING');
    }

    // -------------------------------------------------------------
    // Test 6: Multi-Page Group Manifest PDF Generation
    // -------------------------------------------------------------
    console.log('\n[6] Testing Group Appointment Manifest PDF Generator...');
    const manifestResult = await generateManifestPdf({
      groupBatchId: createdGroup.id,
      currentUser: agentUser,
    });
    assert(manifestResult && manifestResult.filePath && fs.existsSync(manifestResult.filePath), 'Manifest PDF generated successfully and exists on disk');

    console.log(`\n========================================`);
    console.log(`FAZA 4 ALL ${passed}/${total} TESTS PASSED SUCCESSFULLY!`);
    console.log(`========================================\n`);
    process.exit(0);
  } finally {
    server.close();
  }
}

runPhase4Tests().catch((err) => {
  console.error('\nFAZA 4 TEST SUITE FAILED:', err);
  process.exit(1);
});
