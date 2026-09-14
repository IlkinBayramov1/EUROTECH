const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const prisma = require('../../config/db');
const env = require('../../config/env');
const { generateSecureToken, hashToken } = require('../../utils/token.util');

const uploadDir = path.resolve(env.UPLOAD_DIR);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

function sanitizeTextForPdf(text) {
  if (!text) return '';
  const charMap = {
    'ə': 'a', 'Ə': 'A',
    'ı': 'i', 'İ': 'I',
    'ş': 's', 'Ş': 'S',
    'ç': 'c', 'Ç': 'C',
    'ğ': 'g', 'Ğ': 'G',
    'ö': 'o', 'Ö': 'O',
    'ü': 'u', 'Ü': 'U',
  };
  return String(text).replace(/[əƏıİşŞçÇğĞöÖüÜ]/g, (m) => charMap[m] || m);
}

function generateBatchCode() {
  const year = new Date().getFullYear();
  const digits = Math.floor(100 + Math.random() * 900);
  return `BCH-${year}-${digits}`;
}

async function createBatch({ userId, name, destination, travelDate, duration, projectReason }) {
  const code = generateBatchCode();
  return prisma.groupBatch.create({
    data: {
      code,
      portalType: 'CORPORATE',
      userId,
      name,
      destination: destination || 'Europe / Schengen',
      travelDate: travelDate ? new Date(travelDate) : null,
      duration: duration || 'short',
      projectReason: projectReason || 'Business / Corporate',
      status: 'DRAFT',
    },
  });
}

async function getCorporateBatches(userId) {
  const batches = await prisma.groupBatch.findMany({
    where: { userId, portalType: 'CORPORATE' },
    include: {
      dossiers: {
        include: {
          applicants: true,
          documents: true,
        },
      },
      appointments: {
        include: { timeSlot: true },
      },
      invoices: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return batches.map((b) => {
    let allApplicants = [];
    b.dossiers.forEach((d) => {
      if (d.applicants) allApplicants.push(...d.applicants);
    });

    return {
      ...b,
      totalEmployees: allApplicants.length,
      employees: allApplicants,
    };
  });
}

async function generateDelegationLink({ corporateUserId, employeeId, batchId }) {
  const employee = await prisma.corporateEmployee.findFirst({
    where: { id: employeeId, corporateUserId },
  });

  if (!employee) {
    const error = new Error('Employee not found in corporate directory');
    error.statusCode = 404;
    throw error;
  }

  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 Hours

  await prisma.corporateEmployee.update({
    where: { id: employee.id },
    data: {
      delegationTokenHash: tokenHash,
      delegationExpiresAt: expiresAt,
    },
  });

  const appUrl = process.env.PORTAL_URL || 'http://localhost:5173';
  const delegationUrl = `${appUrl}/corporate/delegation?token=${rawToken}&batchId=${batchId || ''}`;

  return {
    employeeId: employee.id,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    delegationToken: rawToken,
    delegationUrl,
    expiresAt,
  };
}

async function getDelegationProfile(rawToken) {
  if (!rawToken) {
    const error = new Error('Delegation token is required');
    error.statusCode = 400;
    throw error;
  }

  const tokenHash = hashToken(rawToken);
  const employee = await prisma.corporateEmployee.findFirst({
    where: {
      delegationTokenHash: tokenHash,
      delegationExpiresAt: { gt: new Date() },
    },
    include: { corporateUser: { select: { companyName: true, fullName: true } } },
  });

  if (!employee) {
    const error = new Error('Invalid or expired delegation link');
    error.statusCode = 403;
    throw error;
  }

  return {
    id: employee.id,
    firstName: employee.firstName,
    lastName: employee.lastName,
    jobTitle: employee.jobTitle,
    department: employee.department,
    nationality: employee.nationality,
    passportNumber: employee.passportNumber,
    passportExpiry: employee.passportExpiry,
    email: employee.email,
    companyName: employee.corporateUser?.companyName || 'Corporate Employer',
  };
}

async function getEmployeeDirectory(corporateUserId, search = '') {
  const where = { corporateUserId };
  if (search) {
    where.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { passportNumber: { contains: search } },
      { department: { contains: search } },
    ];
  }

  return prisma.corporateEmployee.findMany({
    where,
    include: {
      visaHistory: {
        orderBy: { issueDate: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function addEmployeeToDirectory({
  corporateUserId,
  firstName,
  lastName,
  jobTitle,
  department,
  nationality,
  passportNumber,
  passportExpiry,
  email,
  phone,
  initialVisa = null,
}) {
  return prisma.corporateEmployee.create({
    data: {
      corporateUserId,
      firstName,
      lastName,
      jobTitle: jobTitle || 'Employee',
      department: department || 'General',
      nationality: nationality || 'AZ',
      passportNumber,
      passportExpiry: passportExpiry ? new Date(passportExpiry) : null,
      email,
      phone,
      visaHistory: initialVisa
        ? {
            create: {
              country: initialVisa.country || 'Europe',
              type: initialVisa.type || 'Schengen C (Business)',
              issueDate: initialVisa.issueDate ? new Date(initialVisa.issueDate) : new Date(),
              expiryDate: initialVisa.expiryDate ? new Date(initialVisa.expiryDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              status: initialVisa.status || 'ACTIVE',
              batchRef: initialVisa.batchRef || null,
            },
          }
        : undefined,
    },
    include: { visaHistory: true },
  });
}

async function generateProformaInvoice({ batchId, corporateUserId, amount = 1450.0 }) {
  const batch = await prisma.groupBatch.findUnique({
    where: { id: batchId },
    include: {
      user: true,
      dossiers: {
        include: { applicants: true },
      },
    },
  });

  if (!batch) {
    const error = new Error('Corporate batch not found');
    error.statusCode = 404;
    throw error;
  }

  const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Generate branded Invoice PDF
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();

  page.drawText('EUROTECH SERVICES KFT. - PROFORMA INVOICE', {
    x: 40,
    y: height - 50,
    size: 15,
    font: boldFont,
    color: rgb(0.1, 0.2, 0.4),
  });

  page.drawText(sanitizeTextForPdf(`Invoice Number: ${invoiceNumber}`), { x: 40, y: height - 80, size: 11, font: boldFont });
  page.drawText(sanitizeTextForPdf(`Date of Issue: ${new Date().toISOString().split('T')[0]}`), { x: 40, y: height - 95, size: 10, font });
  page.drawText(sanitizeTextForPdf(`Due Date: ${dueDate.toISOString().split('T')[0]}`), { x: 40, y: height - 110, size: 10, font });

  page.drawText(sanitizeTextForPdf(`Billed To: ${batch.user.companyName || batch.user.fullName}`), { x: 40, y: height - 135, size: 11, font: boldFont });
  page.drawText(sanitizeTextForPdf(`Email: ${batch.user.email}  |  Batch Ref: ${batch.code}`), { x: 40, y: height - 150, size: 10, font });

  page.drawText(sanitizeTextForPdf(`Service Description: Corporate Visa Processing for ${batch.name}`), { x: 40, y: height - 180, size: 10, font });
  page.drawText(sanitizeTextForPdf(`Total Due: € ${amount.toFixed(2)} EUR`), { x: 40, y: height - 200, size: 13, font: boldFont, color: rgb(0.1, 0.5, 0.2) });

  page.drawText('Wire Transfer Details: EuroTech Services Kft. - Bank of Hungary - IBAN: HU42117730161111222233334444', {
    x: 40,
    y: height - 240,
    size: 9,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  const fileName = `proforma_${invoiceNumber}.pdf`;
  const filePath = path.join(uploadDir, fileName);
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(filePath, pdfBytes);

  const invoice = await prisma.corporateInvoice.create({
    data: {
      corporateUserId,
      groupBatchId: batch.id,
      invoiceNumber,
      amount: Number(amount),
      dueDate,
      status: 'PENDING',
      pdfUrl: `/uploads/${fileName}`,
    },
  });

  return {
    invoice,
    pdfUrl: `/uploads/${fileName}`,
    filePath,
  };
}

async function payBatchWithWallet({ batchId, corporateUserId, amount = 1450.0 }) {
  const payAmount = Number(amount);

  return await prisma.$transaction(async (tx) => {
    let wallet = await tx.wallet.findUnique({ where: { userId: corporateUserId } });
    if (!wallet) {
      wallet = await tx.wallet.create({
        data: { userId: corporateUserId, balance: 12500.0, currency: 'EUR' },
      });
    }

    if (wallet.balance < payAmount) {
      const error = new Error('Insufficient corporate wallet balance');
      error.statusCode = 400;
      throw error;
    }

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: payAmount } },
    });

    const batch = await tx.groupBatch.update({
      where: { id: batchId },
      data: { status: 'PROCESSING' },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: -payAmount,
        type: 'DEBIT',
        referenceType: 'VISA_PAYMENT',
        referenceId: batch.code,
        description: `Visa Processing & Consular Fees: ${batch.name}`,
        status: 'PAID',
      },
    });

    // Confirm any pending appointments for this batch
    await tx.appointment.updateMany({
      where: { groupBatchId: batchId },
      data: { status: 'CONFIRMED' },
    });

    return {
      success: true,
      batchStatus: 'PROCESSING',
      newWalletBalance: wallet.balance - payAmount,
    };
  });
}

async function getCorporateInvoices(corporateUserId) {
  return prisma.corporateInvoice.findMany({
    where: { corporateUserId },
    include: { groupBatch: true },
    orderBy: { createdAt: 'desc' },
  });
}

module.exports = {
  createBatch,
  getCorporateBatches,
  generateDelegationLink,
  getDelegationProfile,
  getEmployeeDirectory,
  addEmployeeToDirectory,
  generateProformaInvoice,
  payBatchWithWallet,
  getCorporateInvoices,
};
