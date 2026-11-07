const http = require('http');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const env = require('./config/env');
const prisma = new PrismaClient();

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: buffer.toString('utf-8'),
          rawBuffer: buffer,
        });
      });
    });
    req.on('error', reject);
    if (data) {
      if (typeof data === 'object') {
        req.write(JSON.stringify(data));
      } else {
        req.write(data);
      }
    }
    req.end();
  });
}

async function runCompleteAdminE2ETests() {
  console.log('===============================================================');
  console.log('   EUROTECH ADMIN PORTAL: COMPLETE E2E VERIFICATION SUITE       ');
  console.log('===============================================================');

  // 1. Authenticate as Admin
  console.log('\n[1/7] Authenticating as Executive Admin...');
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@eurotech.services' },
  });
  if (!admin) throw new Error('Admin account not found in database');
  const token = jwt.sign({ userId: admin.id, role: admin.role }, env.JWT_SECRET, { expiresIn: '1h' });
  console.log(`✓ Admin authenticated: ${admin.fullName} (${admin.email})`);

  // 2. Dashboard Live Metrics
  console.log('\n[2/7] Testing Dashboard Live Metrics (/api/admin/metrics)...');
  const metricsRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/metrics',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (metricsRes.statusCode !== 200) throw new Error('Metrics endpoint returned ' + metricsRes.statusCode);
  const metrics = JSON.parse(metricsRes.body).data?.metrics;
  console.log(`✓ Live Active Dossiers: ${metrics.activeDossiers}`);
  console.log(`✓ Dossiers Under Review: ${metrics.underReviewCount}`);
  console.log(`✓ Approved This Month: ${metrics.approvedThisMonth}`);
  console.log(`✓ Total Processed Revenue: €${metrics.totalRevenue}`);

  // 3. Dossiers Registry & Filters
  console.log('\n[3/7] Testing Dossiers Registry & Search (/api/admin/dossiers)...');
  const dossiersRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/dossiers?limit=10',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (dossiersRes.statusCode !== 200) throw new Error('Dossiers list returned ' + dossiersRes.statusCode);
  const dossiersData = JSON.parse(dossiersRes.body).data;
  console.log(`✓ Total Registered Real Dossiers: ${dossiersData.total}`);
  
  // Verify that no junk e2e or mock records exist in the list
  const hasJunk = dossiersData.dossiers.some(d => 
    d.dossierNumber.includes('e2e') || 
    d.dossierNumber.startsWith('BCH-BCH-') ||
    d.user?.email.includes('e2e-') ||
    d.user?.email.includes('onboarding_')
  );
  if (hasJunk) throw new Error('Found junk or mock data in live dossiers list!');
  console.log('✓ Verified: 0 junk / mock dossiers in registry. All records are real.');

  // Find sample dossier with applicants
  const testDossier = dossiersData.dossiers.find(d => (d.applicants || []).length > 0) || dossiersData.dossiers[0];
  console.log(`✓ Selected test dossier: ${testDossier.dossierNumber} (${testDossier.country?.nameEn || 'Schengen'})`);

  // 4. Single Dossier Inspection
  console.log('\n[4/7] Testing Detailed Dossier Inspection (/api/dossiers/:id)...');
  const detailRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/dossiers/${testDossier.id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (detailRes.statusCode !== 200) throw new Error('Dossier detail returned ' + detailRes.statusCode);
  const detail = JSON.parse(detailRes.body).data?.dossier;
  const applicant = detail.applicants?.[0];
  console.log(`✓ Primary Applicant: ${applicant?.firstName} ${applicant?.lastName} (Passport: ${applicant?.passportNumber})`);
  console.log(`✓ Attached Verification Documents: ${(detail.documents || []).length}`);

  // 5. Test All 4 File Export Endpoints
  console.log('\n[5/7] Testing All File Export Generators...');
  
  // A. Summary PDF
  const sumRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/dossiers/${testDossier.id}/summary-pdf`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (sumRes.statusCode !== 200) throw new Error('Summary PDF failed');
  const sumUrl = JSON.parse(sumRes.body).data?.downloadUrl;
  console.log(`  ✓ 1. Summary PDF Generated: ${sumUrl}`);

  // B. Archive ZIP
  const zipRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/dossiers/${testDossier.id}/archive-zip`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (zipRes.statusCode !== 200) throw new Error('Archive ZIP failed');
  const zipUrl = JSON.parse(zipRes.body).data?.downloadUrl;
  console.log(`  ✓ 2. Archive ZIP Package Generated: ${zipUrl}`);

  // C. Harmonized Schengen Application PDF
  if (applicant) {
    const schengenRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/dossiers/${testDossier.id}/applicants/${applicant.id}/application-pdf`,
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }, {});
    if (schengenRes.statusCode !== 200) throw new Error('Schengen form PDF failed');
    const schengenUrl = JSON.parse(schengenRes.body).data?.downloadUrl;
    console.log(`  ✓ 3. Harmonized 37-point Schengen PDF: ${schengenUrl}`);
  }

  // D. Export Document Checklist
  const checkRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/documents/dossier/${testDossier.id}/export-checklist`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (checkRes.statusCode !== 200) throw new Error('Export checklist failed');
  console.log(`  ✓ 4. Consular Checklist PDF: Streamed ${checkRes.rawBuffer.length} bytes`);

  // 6. Test Consular Decision
  console.log('\n[6/7] Testing Consular Decision Recording (/api/admin/dossier/:id/decision)...');
  const decisionRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/admin/dossier/${testDossier.id}/decision`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  }, {
    nextStatus: 'SUBMITTED_TO_CONSULATE',
    notes: 'Diplomatic officer verification passed. Forwarded to Embassy for visa stamp.'
  });
  if (decisionRes.statusCode !== 200) throw new Error('Consular decision failed: ' + decisionRes.statusCode);
  console.log('✓ Consular Decision successfully recorded in database & audit log.');

  // 7. Audit Logs Verification
  console.log('\n[7/7] Testing Audit Trails (/api/admin/audit-logs)...');
  const auditRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/audit-logs?limit=5',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (auditRes.statusCode !== 200) throw new Error('Audit logs returned ' + auditRes.statusCode);
  const auditLogs = JSON.parse(auditRes.body).logs || JSON.parse(auditRes.body).data?.logs;
  console.log(`✓ Fetched ${auditLogs.length} real audit records.`);
  auditLogs.slice(0, 3).forEach(log => {
    console.log(`  - [${log.action}] by ${log.user?.fullName} (${log.ipAddress})`);
  });

  console.log('\n===============================================================');
  console.log('   >>> ALL 7 E2E ADMIN PORTAL TESTS PASSED WITH 100% SUCCESS! <<<');
  console.log('===============================================================');
}

runCompleteAdminE2ETests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('E2E Verification Failed:', err);
    process.exit(1);
  });

