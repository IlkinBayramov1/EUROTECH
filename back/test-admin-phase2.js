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

async function runPhase2Tests() {
  console.log('=== RUNNING ADMIN PHASE 2 AUTOMATED TEST SUITE ===');

  // 1. Get an Admin user
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@eurotech.services' },
  });
  if (!admin) throw new Error('Admin user not found');

  const token = jwt.sign({ userId: admin.id, role: admin.role }, env.JWT_SECRET, { expiresIn: '1h' });

  // 2. Test Admin Metrics
  console.log('\n[1/5] Testing GET /api/admin/metrics...');
  const metricsRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/metrics',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Metrics status:', metricsRes.statusCode);
  const metricsJson = JSON.parse(metricsRes.body);
  console.log('Active dossiers:', metricsJson.data?.metrics?.activeDossiers);
  if (metricsRes.statusCode !== 200) throw new Error('Metrics endpoint failed');

  // 3. Test All Dossiers
  console.log('\n[2/5] Testing GET /api/admin/dossiers...');
  const dossiersRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/dossiers?limit=5',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Dossiers list status:', dossiersRes.statusCode);
  const dossiersJson = JSON.parse(dossiersRes.body);
  const sampleDossier = dossiersJson.data?.dossiers?.[0];
  if (!sampleDossier) throw new Error('No dossier found for testing');
  console.log(`Using sample dossier: ${sampleDossier.dossierNumber} (${sampleDossier.id})`);

  // 4. Test Summary PDF Generation
  console.log('\n[3/5] Testing GET /api/dossiers/:dossierId/summary-pdf...');
  const summaryRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/dossiers/${sampleDossier.id}/summary-pdf`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Summary PDF status:', summaryRes.statusCode);
  const summaryJson = JSON.parse(summaryRes.body);
  console.log('Summary PDF URL:', summaryJson.data?.downloadUrl);
  if (summaryRes.statusCode !== 200 || !summaryJson.data?.downloadUrl) {
    throw new Error('Summary PDF endpoint failed');
  }

  // 5. Test Archive ZIP Generation
  console.log('\n[4/5] Testing GET /api/dossiers/:dossierId/archive-zip...');
  const zipRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/dossiers/${sampleDossier.id}/archive-zip`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Archive ZIP status:', zipRes.statusCode);
  const zipJson = JSON.parse(zipRes.body);
  console.log('Archive ZIP URL:', zipJson.data?.downloadUrl);
  if (zipRes.statusCode !== 200 || !zipJson.data?.downloadUrl) {
    throw new Error('Archive ZIP endpoint failed');
  }

  // 6. Test Document Checklist Export
  console.log('\n[5/5] Testing GET /api/documents/dossier/:dossierId/export-checklist...');
  const checklistRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/documents/dossier/${sampleDossier.id}/export-checklist`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Checklist status:', checklistRes.statusCode, 'Content-Type:', checklistRes.headers['content-type'], 'Bytes:', checklistRes.rawBuffer.length);
  if (checklistRes.statusCode !== 200 || checklistRes.rawBuffer.length < 100) {
    throw new Error('Checklist export failed');
  }

  console.log('\n>>> ALL 5 PHASE 2 AUTOMATED TESTS PASSED SUCCESSFULLY! <<<');
}

runPhase2Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test Suite Failed:', err.message);
    process.exit(1);
  });

