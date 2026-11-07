const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const prisma = require('../../../config/db');
const env = require('../../../config/env');
const walletService = require('../../payment/wallet.service');

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

async function generateProformaInvoice({ batchId, corporateUserId, amount }) {
  const batch = await prisma.groupBatch.findUnique({
    where: { id: batchId },
    include: {
      user: true,
      dossiers: {
        include: { applicants: true },
      },
      invoices: true,
    },
  });

  if (!batch) {
    const error = new Error('Corporate batch not found');
    error.statusCode = 404;
    throw error;
  }

  // Əgər faktura artıq mövcuddursa və xüsusi yeni məbləğ göndərilməyibsə, mövcud fakturanı qaytar
  if (!amount && batch.invoices && batch.invoices.length > 0) {
    return {
      invoice: batch.invoices[0],
      pdfUrl: batch.invoices[0].pdfUrl,
    };
  }

  let finalAmount = amount ? Number(amount) : null;
  if (!finalAmount && batch.dossiers && batch.dossiers[0] && batch.dossiers[0].totalAmount) {
    finalAmount = Number(batch.dossiers[0].totalAmount);
  }
  if (!finalAmount) finalAmount = 1450.0;

  const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
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
  page.drawText(sanitizeTextForPdf(`Total Due: € ${finalAmount.toFixed(2)} EUR`), { x: 40, y: height - 200, size: 13, font: boldFont, color: rgb(0.1, 0.5, 0.2) });

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
      amount: finalAmount,
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

async function payBatchWithWallet({ batchId, corporateUserId }) {
  const result = await walletService.payWithWallet({
    userId: corporateUserId,
    userRole: 'CORPORATE_HR',
    groupBatchId: batchId,
  });

  return {
    success: true,
    batchStatus: 'PROCESSING',
    newWalletBalance: result.newBalance,
    paidAmountEur: result.paidAmountEur,
    reference: result.reference,
  };
}

async function topupCorporateWallet(corporateUserIdOrObj, amountArg, methodArg, refArg) {
  let corporateUserId;
  let amount;
  let currency = 'EUR';
  let method = 'CARD';
  let reference = null;

  if (typeof corporateUserIdOrObj === 'object' && corporateUserIdOrObj !== null) {
    corporateUserId = corporateUserIdOrObj.corporateUserId || corporateUserIdOrObj.userId;
    amount = corporateUserIdOrObj.amount;
    currency = corporateUserIdOrObj.currency || 'EUR';
    method = corporateUserIdOrObj.method || 'CARD';
    reference = corporateUserIdOrObj.reference || null;
  } else {
    corporateUserId = corporateUserIdOrObj;
    amount = amountArg;
    method = methodArg || 'CARD';
    reference = refArg || null;
  }

  const res = await walletService.topupWallet({
    userId: corporateUserId,
    amount,
    currency,
    method,
    reference,
  });

  return {
    success: true,
    wallet: res.wallet,
    newBalance: res.balance,
    balanceAzn: res.balanceAzn,
  };
}

async function getCorporateInvoices(corporateUserId) {
  const invoices = await prisma.corporateInvoice.findMany({
    where: { corporateUserId },
    include: {
      groupBatch: {
        include: {
          dossiers: {
            include: { applicants: { select: { id: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return invoices.map((inv) => {
    const paxCount = inv.groupBatch?.dossiers
      ? inv.groupBatch.dossiers.reduce((sum, d) => sum + (d.applicants?.length || 0), 0)
      : 1;
    return {
      ...inv,
      applicantsCount: Math.max(1, paxCount),
      groupBatch: inv.groupBatch
        ? {
            id: inv.groupBatch.id,
            code: inv.groupBatch.code,
            name: inv.groupBatch.name,
            destination: inv.groupBatch.destination,
            status: inv.groupBatch.status,
            totalEmployees: Math.max(1, paxCount),
          }
        : null,
    };
  });
}

async function getCorporateWallet(corporateUserId) {
  const wallet = await walletService.getOrCreateWallet(corporateUserId);
  const summary = await walletService.recalculateWalletBalances(wallet.id);
  const pendingBankSlips = await prisma.bankPaymentReceipt.findMany({
    where: { userId: corporateUserId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return {
    ...summary.wallet,
    balance: summary.balance,
    pendingBalance: summary.pendingBalance,
    totalSpendYtd: summary.totalSpent,
    totalTopups: summary.totalTopups,
    transactions: summary.transactions.slice(0, 50),
    pendingBankSlips,
  };
}

async function getInvoicePdf(corporateUserId, invoiceId) {
  const invoice = await prisma.corporateInvoice.findFirst({
    where: { id: invoiceId, corporateUserId },
  });

  if (!invoice) {
    const error = new Error('Invoice not found');
    error.statusCode = 404;
    throw error;
  }

  return {
    invoice,
    pdfUrl: invoice.pdfUrl,
  };
}

module.exports = {
  generateProformaInvoice,
  payBatchWithWallet,
  topupCorporateWallet,
  getCorporateInvoices,
  getCorporateWallet,
  getInvoicePdf,
};
