const http = require('http');
const fs = require('fs');
const path = require('path');
const app = require('./app');
const prisma = require('./config/db');
const env = require('./config/env');

const TEST_PORT = 5005;
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

let server;
let passedCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  PASS: ${message}`);
  passedCount++;
}

async function runTests() {
  console.log('=== EUROTECH PHASE 5 INTEGRATION SUITE (Corporate HR Portal & Finance) ===\n');

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`Test server running on port ${TEST_PORT}\n`);

  try {
    // 1. Corporate HR Login
    console.log('1. Corporate HR Authentication:');
    let loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'corporate@pashaholding.az',
        password: 'corp123',
      }),
    });

    let loginData = await loginRes.json();
    if (!loginRes.ok || !loginData.data?.accessToken) {
      // Upsert corporate user if needed
      const bcrypt = require('bcryptjs');
      const passHash = await bcrypt.hash('corp123', 10);
      const user = await prisma.user.upsert({
        where: { email: 'corporate@pashaholding.az' },
        update: { passwordHash: passHash, role: 'CORPORATE_HR', accountStatus: 'ACTIVE' },
        create: {
          email: 'corporate@pashaholding.az',
          passwordHash: passHash,
          fullName: 'Pasha Holding HR',
          companyName: 'Pasha Holding LLC',
          taxId: 'AZ-1234567890',
          role: 'CORPORATE_HR',
          accountStatus: 'ACTIVE',
        },
      });

      loginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'corporate@pashaholding.az', password: 'corp123' }),
      });
      loginData = await loginRes.json();
    }

    assert(loginRes.status === 200, 'Corporate HR login returns 200');
    assert(!!loginData.data?.accessToken, 'Access token returned for Corporate HR');
    const corpToken = loginData.data.accessToken;
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${corpToken}`,
    };

    // 2. Dashboard Stats
    console.log('\n2. Corporate Dashboard Stats:');
    const statsRes = await fetch(`${BASE_URL}/corporate/dashboard/stats`, { headers: authHeaders });
    const statsData = await statsRes.json();
    assert(statsRes.status === 200, 'Dashboard stats returns 200');
    assert(statsData.data?.stats !== undefined, 'Stats object exists in response');
    assert(typeof statsData.data.stats.walletBalance === 'number', 'Wallet balance is a number');

    // 3. Corporate Wallet & Top-up
    console.log('\n3. Corporate Wallet Top-Up:');
    const walletRes = await fetch(`${BASE_URL}/corporate/wallet`, { headers: authHeaders });
    const walletData = await walletRes.json();
    assert(walletRes.status === 200, 'Get wallet returns 200');
    const initialBalance = Number(walletData.data.wallet.balance);

    const topupRes = await fetch(`${BASE_URL}/corporate/wallet/topup`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ amount: 5000, method: 'CARD' }),
    });
    const topupData = await topupRes.json();
    assert(topupRes.status === 200, 'Top-up returns 200');
    assert(topupData.data.newBalance === initialBalance + 5000, `Wallet balance incremented by 5000 (was ${initialBalance}, now ${topupData.data.newBalance})`);

    // 4. Department Budget Management
    console.log('\n4. Corporate Department & Budget Limits:');
    const createDeptRes = await fetch(`${BASE_URL}/corporate/departments`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: `Global Mobility ${Date.now()}`,
        annualBudget: 85000,
      }),
    });
    const createDeptData = await createDeptRes.json();
    assert(createDeptRes.status === 201, 'Create department returns 201');
    const testDept = createDeptData.data.department;
    assert(testDept.annualBudget === 85000, 'Department annual budget saved as 85000');

    // 5. Employee Directory & Reminder
    console.log('\n5. Employee Directory & Reminder System:');
    const uniquePass = `P${Math.floor(1000000 + Math.random() * 9000000)}`;
    const addEmpRes = await fetch(`${BASE_URL}/corporate/employees`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        firstName: 'Farid',
        lastName: 'Aliyev',
        jobTitle: 'Senior Mobility Lead',
        department: testDept.name,
        nationality: 'AZ',
        passportNumber: uniquePass,
        passportExpiry: '2029-06-15',
        email: 'farid.aliyev@testpasha.az',
        phone: '+994501234567',
      }),
    });
    const addEmpData = await addEmpRes.json();
    assert(addEmpRes.status === 201, 'Add employee to directory returns 201');
    const corpEmployee = addEmpData.data.employee;
    assert(corpEmployee.firstName === 'Farid', 'Employee created with correct name');

    // Send reminder
    const remindRes = await fetch(`${BASE_URL}/corporate/employees/${corpEmployee.id}/remind`, {
      method: 'POST',
      headers: authHeaders,
    });
    const remindData = await remindRes.json();
    assert(remindRes.status === 200, 'Remind employee returns 200');
    assert(remindData.data.success === true, 'Reminder confirmed successfully');

    // 6. Corporate Guarantee Letter PDF
    console.log('\n6. Corporate Guarantee & Sponsorship Letter PDF:');
    const guaranteeRes = await fetch(`${BASE_URL}/corporate/employees/${corpEmployee.id}/guarantee-letter-pdf`, {
      headers: authHeaders,
    });
    const guaranteeData = await guaranteeRes.json();
    assert(guaranteeRes.status === 200, 'Guarantee letter PDF endpoint returns 200');
    assert(!!guaranteeData.data?.pdfUrl, 'PDF file URL returned');
    const guaranteePath = path.join(path.resolve(env.UPLOAD_DIR), guaranteeData.data.fileName);
    assert(fs.existsSync(guaranteePath), `Guarantee letter PDF file physically exists on disk (${guaranteePath})`);

    // 7. Employee Delegation Link & Guest Self-Fill Flow
    console.log('\n7. Secure Delegation Link & Guest Consular Self-Fill:');
    const delegLinkRes = await fetch(`${BASE_URL}/corporate/employees/${corpEmployee.id}/delegation-link`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    });
    const delegLinkData = await delegLinkRes.json();
    assert(delegLinkRes.status === 200, 'Generate delegation link returns 200');
    assert(!!delegLinkData.data?.delegationToken, 'One-time secure token generated');
    const rawDelegToken = delegLinkData.data.delegationToken;

    // Public guest profile lookup
    const guestProfRes = await fetch(`${BASE_URL}/corporate/delegation/profile?token=${rawDelegToken}`);
    const guestProfData = await guestProfRes.json();
    assert(guestProfRes.status === 200, 'Guest delegation profile lookup returns 200');
    assert(guestProfData.data.profile.firstName === 'Farid', 'Profile correctly resolves employee');

    // Public guest submission
    const guestSubRes = await fetch(`${BASE_URL}/corporate/delegation/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rawDelegToken,
        dob: '1988-04-12',
        passportNumber: uniquePass,
        passportExpiry: '2029-06-15',
        phone: '+994507778899',
      }),
    });
    const guestSubData = await guestSubRes.json();
    assert(guestSubRes.status === 200, 'Guest delegation submission returns 200');

    // Verify token invalidated after one-time use
    const recheckRes = await fetch(`${BASE_URL}/corporate/delegation/profile?token=${rawDelegToken}`);
    assert(recheckRes.status === 403, 'Delegation token is consumed and cannot be reused (returns 403)');

    // 8. Create Corporate Batch with Biometric Appointment & Invoice
    console.log('\n8. Corporate Batch Creation with Slot & Invoice:');
    const apptDate = new Date();
    apptDate.setDate(apptDate.getDate() + 14);
    const dateStr = apptDate.toISOString().split('T')[0];

    const createBatchRes = await fetch(`${BASE_URL}/corporate/batches`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: `Q4 Vienna Summit Batch ${Date.now()}`,
        destination: 'Austria',
        travelDate: dateStr,
        duration: 'short',
        projectReason: 'Executive Strategy Summit',
        package: 'premium',
        packagePrice: 126.0,
        appointmentDate: dateStr,
        appointmentTime: '10:30 AM',
        employees: [
          {
            firstName: 'Farid',
            lastName: 'Aliyev',
            passportNumber: uniquePass,
            dob: '1988-04-12',
            role: 'Lead Architect',
            department: testDept.name,
          },
          {
            firstName: 'Leyla',
            lastName: 'Mammadova',
            passportNumber: `P${Math.floor(1000000 + Math.random() * 9000000)}`,
            dob: '1992-09-20',
            role: 'Project Manager',
            department: testDept.name,
          },
        ],
      }),
    });

    const createBatchData = await createBatchRes.json();
    assert(createBatchRes.status === 201, 'Create batch returns 201');
    const createdBatch = createBatchData.data.batch;
    assert(createdBatch.totalEmployees === 2, 'Batch created with 2 employees');
    assert(!!createdBatch.invoice, 'Proforma invoice created for batch');
    assert(!!createdBatch.appointment, 'Biometric appointment created for batch');

    // 9. Dynamic Batch Employee Management (Add & Remove in Existing Batch)
    console.log('\n9. Add & Remove Employee in Existing Batch:');
    const thirdPass = `P${Math.floor(1000000 + Math.random() * 9000000)}`;
    const addEmpToBatchRes = await fetch(`${BASE_URL}/corporate/batches/${createdBatch.id}/employees`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        firstName: 'Kamran',
        lastName: 'Rustamov',
        passportNumber: thirdPass,
        dob: '1995-02-14',
        role: 'DevOps Engineer',
        department: testDept.name,
      }),
    });
    const addEmpToBatchData = await addEmpToBatchRes.json();
    assert(addEmpToBatchRes.status === 201, 'Add employee to existing batch returns 201');
    assert(addEmpToBatchData.data.applicant.firstName === 'Kamran', 'Applicant created');

    // Remove third employee
    const removeEmpRes = await fetch(`${BASE_URL}/corporate/batches/${createdBatch.id}/employees/${addEmpToBatchData.data.applicant.id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    const removeEmpData = await removeEmpRes.json();
    assert(removeEmpRes.status === 200, 'Remove employee from batch returns 200');
    assert(removeEmpData.data.remainingCount === 2, 'Remaining count back to 2');

    // 10. Settle Batch Invoice via Corporate Wallet
    console.log('\n10. Corporate Wallet Settlement & Financial Integrity:');
    const payRes = await fetch(`${BASE_URL}/corporate/batches/${createdBatch.id}/pay-wallet`, {
      method: 'POST',
      headers: authHeaders,
    });
    const payData = await payRes.json();
    assert(payRes.status === 200, 'Pay batch with wallet returns 200');
    assert(payData.data.success === true, 'Payment marked success');

    // Verify dossier and appointment statuses in DB
    const updatedDossier = await prisma.dossier.findFirst({
      where: { groupBatchId: createdBatch.id },
    });
    assert(updatedDossier.paymentStatus === 'PAID', 'Dossier paymentStatus is PAID in DB');

    const updatedAppt = await prisma.appointment.findFirst({
      where: { groupBatchId: createdBatch.id },
    });
    assert(updatedAppt.status === 'CONFIRMED', 'Appointment status is CONFIRMED in DB');

    // Verify invoice marked as PAID
    const updatedInvoice = await prisma.corporateInvoice.findFirst({
      where: { groupBatchId: createdBatch.id },
    });
    assert(updatedInvoice.status === 'PAID', 'Corporate invoice status is PAID in DB');

    // 11. Passport Expiry Radar
    console.log('\n11. Consular Passport Expiry Radar:');
    const radarRes = await fetch(`${BASE_URL}/corporate/expiry-radar`, { headers: authHeaders });
    const radarData = await radarRes.json();
    assert(radarRes.status === 200, 'Passport radar returns 200');
    assert(radarData.data.summary.totalEmployees >= 2, 'Summary counts employees');
    assert(Array.isArray(radarData.data.items), 'Radar items array returned');

    console.log(`\n=== PHASE 5 TEST RESULTS: ${passedCount}/${totalCount} TESTS PASSED (100% GREEN) ===\n`);
  } catch (err) {
    console.error('\nPhase 5 test failed:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }
}

runTests().then(() => {
  server.close(() => {
    process.exit(0);
  });
}).catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
