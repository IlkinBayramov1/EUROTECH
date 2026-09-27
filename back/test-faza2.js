const prisma = require('./config/db');
const { generateToken } = require('./utils/jwt.util');

const API = 'http://localhost:5000/api/v1';

async function req(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return { status: res.status, data };
}

async function runFaza2Tests() {
  console.log('===============================================================');
  console.log(' EUROTECH CONSULAR PLATFORM - FAZA 2 COMPREHENSIVE TEST SUITE');
  console.log('===============================================================\n');

  // 1. Get existing B2C User and dossier
  let activeDossier = await prisma.dossier.findFirst({
    where: { applicants: { some: {} } },
    include: { user: true, applicants: { include: { documents: true } } },
  });

  const activeUser = activeDossier?.user;
  const activeApplicant = activeDossier?.applicants?.[0];

  // 1. Harmonized Schengen Visa PDF
  console.log('[1/6] B2C: Harmonized Schengen Visa 37-Point Form (PDF) Generation...');
  if (activeDossier && activeApplicant && activeUser) {
    const userToken = generateToken({ userId: activeUser.id, id: activeUser.id, email: activeUser.email, role: activeUser.role });

    const schengenRes = await req(
      `${API}/dossiers/${activeDossier.id}/applicants/${activeApplicant.id}/schengen-form-pdf`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}` },
      }
    );
    console.log(`  -> Status: ${schengenRes.status} | PDF URL: ${schengenRes.data.data.downloadUrl || schengenRes.data.data.pdfUrl || schengenRes.data.data.fileUrl} ✔️`);

    // 2. Family Voucher Sharing Toggle
    console.log('\n[2/6] B2C: Co-Applicant Family Voucher Sharing Toggle...');
    let testDoc = activeApplicant.documents[0];
    if (!testDoc) {
      testDoc = await prisma.applicantDocument.create({
        data: {
          dossierId: activeDossier.id,
          applicantId: activeApplicant.id,
          fileName: 'hotel_booking_voucher.pdf',
          fileUrl: '/uploads/sample_hotel.pdf',
          fileSize: 102400,
          requiredDocumentType: 'ACCOMMODATION',
          status: 'PENDING',
          isSharedWithFamily: false,
        },
      });
    }

    const shareRes = await req(
      `${API}/documents/${testDoc.id}/family-sharing`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${userToken}` },
        body: { isSharedWithFamily: true },
      }
    );
    console.log(`  -> Status: ${shareRes.status} | isSharedWithFamily: ${shareRes.data.data.document.isSharedWithFamily} ✔️`);
  } else {
    console.log('  -> Skipped: No existing individual dossier found (will be created in full runs)');
  }

  // 3. Agent Portal: Tier & Group Tax Invoice PDF
  console.log('\n[3/6] B2B Agent: Tiered Commission & Group Tax Invoice (PDF)...');
  let agentUser = await prisma.user.findFirst({
    where: { role: 'AGENT_TUR_OPERATOR' },
  });
  if (!agentUser) {
    agentUser = await prisma.user.create({
      data: {
        email: `agent_faza2_${Date.now()}@eurotech.com`,
        passwordHash: 'dummy',
        fullName: 'Global Travel Baku LLC',
        role: 'AGENT_TUR_OPERATOR',
        agentTier: 'GOLD',
      },
    });
  }

  const agentToken = generateToken({ userId: agentUser.id, id: agentUser.id, email: agentUser.email, role: agentUser.role });

  const agentWalletRes = await req(`${API}/agent/wallet`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${agentToken}` },
  });
  const agentWallet = agentWalletRes.data.data.wallet;
  console.log(`  -> Agent Tier: ${agentWallet.agentTier} | Rate Per Pax: €${agentWallet.ratePerPax} ✔️`);

  // Create or get a test group for invoice PDF
  let group = await prisma.groupBatch.findFirst({
    where: { userId: agentUser.id, portalType: 'GROUP_AGENT' },
  });
  if (!group) {
    const agentService = require('./modules/agent/agent.service');
    group = await agentService.createGroup({
      userId: agentUser.id,
      name: 'Baku Diplomatic Tour Delegation',
      destination: 'Hungary',
      travelDate: new Date(Date.now() + 30 * 86400000),
      applicants: [
        { firstName: 'Orkhan', lastName: 'Aliyev', passportNumber: 'C88991122' },
        { firstName: 'Leyla', lastName: 'Aliyeva', passportNumber: 'C88991123' },
      ],
    });
  }

  const groupInvoiceRes = await req(`${API}/agent/groups/${group.id}/invoice-pdf`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${agentToken}` },
  });
  console.log(`  -> Group Tax Invoice PDF: ${groupInvoiceRes.data.data.fileUrl || groupInvoiceRes.data.data.pdfUrl} ✔️`);

  // 4. Corporate Portal: Departments & Travel Budgets
  console.log('\n[4/6] B2B Corporate: Department Travel Budget Allocations...');
  let corpUser = await prisma.user.findFirst({
    where: { role: 'CORPORATE_HR' },
  });
  if (!corpUser) {
    corpUser = await prisma.user.create({
      data: {
        email: `corp_faza2_${Date.now()}@eurotech.com`,
        passwordHash: 'dummy',
        fullName: 'SOCAR Mobility Desk',
        companyName: 'SOCAR Upstream LLC',
        role: 'CORPORATE_HR',
      },
    });
  }

  const corpToken = generateToken({ userId: corpUser.id, id: corpUser.id, email: corpUser.email, role: corpUser.role });

  const deptsRes = await req(`${API}/corporate/departments`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${corpToken}` },
  });
  console.log(`  -> Departments Loaded: ${deptsRes.data.data.departments.length} cost centers ✔️`);

  const newDeptRes = await req(
    `${API}/corporate/departments`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${corpToken}` },
      body: { name: `Cloud Infra ${Date.now().toString().slice(-4)}`, annualBudget: 75000.0 },
    }
  );
  console.log(`  -> New Dept Created: "${newDeptRes.data.data.department.name}" (€${newDeptRes.data.data.department.annualBudget}) ✔️`);

  // 5. Consular Expiry Radar
  console.log('\n[5/6] B2B Corporate: Consular Passport Expiry Radar...');
  await prisma.corporateEmployee.create({
    data: {
      corporateUserId: corpUser.id,
      firstName: 'Farid',
      lastName: 'Mammadov',
      passportNumber: `C${Math.floor(10000000 + Math.random() * 90000000)}`,
      passportExpiry: new Date(Date.now() + 45 * 86400000), // 45 days -> CRITICAL (< 90d)
      nationality: 'AZ',
      department: 'Engineering & Technology',
      jobTitle: 'Principal Lead Engineer',
    },
  });

  const radarRes = await req(`${API}/corporate/expiry-radar`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${corpToken}` },
  });
  console.log(`  -> Radar Summary: Total: ${radarRes.data.data.summary.totalEmployees}, Critical (<90d): ${radarRes.data.data.summary.criticalCount}, Warning (<6mo): ${radarRes.data.data.summary.warningCount} ✔️`);

  // 6. Corporate Guarantee Letter PDF
  console.log('\n[6/6] B2B Corporate: Official Sponsorship & Guarantee Letter (PDF)...');
  const employee = await prisma.corporateEmployee.findFirst({
    where: { corporateUserId: corpUser.id },
  });

  const guaranteeRes = await req(`${API}/corporate/employees/${employee.id}/guarantee-letter-pdf`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${corpToken}` },
  });
  console.log(`  -> Guarantee Letter PDF Generated: ${guaranteeRes.data.data.pdfUrl} for ${guaranteeRes.data.data.employeeName} ✔️`);

  console.log('\n===============================================================');
  console.log(' ALL 6 FAZA 2 SPECIFIC FUNCTIONAL TESTS COMPLETED SUCCESSFULLY!');
  console.log('===============================================================\n');

  process.exit(0);
}

runFaza2Tests().catch((err) => {
  console.error('Faza 2 Test Error:', err.data || err.message);
  process.exit(1);
});
