const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const prisma = require('../config/db');

// Valid minimal PDF bytes (%PDF-1.4 header)
function getValidPdfBuffer() {
  return Buffer.from(
    `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources <<>> /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
72 712 Td
(EuroTech Consular Document Preview) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000216 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
310
%%EOF`
  );
}

// Valid minimal JPEG bytes (FF D8 FF)
function getValidJpgBuffer() {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
    0x00, 0xbf, 0x00, 0xff, 0xd9,
  ]);
}

// Valid minimal PNG bytes (89 50 4E 47)
function getValidPngBuffer() {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
}

async function ensureSampleFiles() {
  const uploadDir = path.resolve(env.UPLOAD_DIR);
  const archiveDir = path.resolve(env.ARCHIVE_DIR);

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }

  // Ensure .gitkeep in directories
  const keepUpload = path.join(uploadDir, '.gitkeep');
  if (!fs.existsSync(keepUpload)) fs.writeFileSync(keepUpload, '', 'utf8');

  const keepArchive = path.join(archiveDir, '.gitkeep');
  if (!fs.existsSync(keepArchive)) fs.writeFileSync(keepArchive, '', 'utf8');

  // Standard sample files needed across system modules
  const standardFiles = [
    { name: 'passport_scan_primary.pdf', type: 'pdf' },
    { name: 'biometric_photo_icao.jpg', type: 'jpg' },
    { name: 'travel_insurance_draft.pdf', type: 'pdf' },
    { name: 'wire_receipt.pdf', type: 'pdf' },
    { name: 'bank-slip-placeholder.pdf', type: 'pdf' },
    { name: 'bank-slip.pdf', type: 'pdf' },
    { name: 'sample_hotel.pdf', type: 'pdf' },
    { name: 'sample_passport.pdf', type: 'pdf' },
    { name: 'test_slip.pdf', type: 'pdf' },
    { name: 'bank_receipt_test.pdf', type: 'pdf' },
  ];

  for (const item of standardFiles) {
    const filePath = path.join(uploadDir, item.name);
    if (!fs.existsSync(filePath)) {
      const buffer = item.type === 'pdf' ? getValidPdfBuffer() : getValidJpgBuffer();
      fs.writeFileSync(filePath, buffer);
    }
  }

  // Cross-check all existing database files in ApplicantDocument & BankPaymentReceipt and ensure they exist on disk
  try {
    const docs = await prisma.applicantDocument.findMany({
      select: { id: true, fileName: true, fileUrl: true },
    });

    for (const doc of docs) {
      if (doc.fileUrl && doc.fileUrl.startsWith('/uploads/')) {
        const diskName = path.basename(doc.fileUrl);
        const fullPath = path.join(uploadDir, diskName);
        if (!fs.existsSync(fullPath)) {
          const ext = (doc.fileName || diskName).split('.').pop()?.toLowerCase();
          const buffer = ext === 'png' ? getValidPngBuffer() : ext === 'jpg' || ext === 'jpeg' ? getValidJpgBuffer() : getValidPdfBuffer();
          fs.writeFileSync(fullPath, buffer);
        }
      }
    }

    const slips = await prisma.bankPaymentReceipt.findMany({
      select: { id: true, fileName: true, fileUrl: true },
    });

    for (const slip of slips) {
      if (slip.fileUrl && slip.fileUrl.startsWith('/uploads/')) {
        const diskName = path.basename(slip.fileUrl);
        const fullPath = path.join(uploadDir, diskName);
        if (!fs.existsSync(fullPath)) {
          const ext = (slip.fileName || diskName).split('.').pop()?.toLowerCase();
          const buffer = ext === 'png' ? getValidPngBuffer() : ext === 'jpg' || ext === 'jpeg' ? getValidJpgBuffer() : getValidPdfBuffer();
          fs.writeFileSync(fullPath, buffer);
        }
      }
    }
  } catch (err) {
    // If DB is offline, continue without failure
  }

  console.log('[EuroTech Storage] Storage directories and sample files verified successfully.');
}

if (require.main === module) {
  ensureSampleFiles().then(() => process.exit(0));
}

module.exports = {
  ensureSampleFiles,
};

