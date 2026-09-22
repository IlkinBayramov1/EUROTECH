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

async function createBatch({
  userId,
  name,
  destination,
  travelDate,
  duration,
  projectReason,
  package: activePackage,
  packagePrice,
  appointmentDate,
  appointmentTime,
  employees,
  totalAmount,
}) {
  const code = generateBatchCode();
  const dest = destination || 'Europe / Schengen';
  const pkg = activePackage || 'standard';
  const pkgPrice = Number(packagePrice) || (pkg === 'premium' ? 126.0 : pkg === 'vip' ? 257.0 : 0.0);
  const empList = Array.isArray(employees) ? employees : [];
  const batchSize = Math.max(1, empList.length);
  const consularFeePP = 145.0;
  const calculatedTotal = Number(totalAmount) || ((consularFeePP + pkgPrice) * batchSize);

  return await prisma.$transaction(async (tx) => {
    // 1. GroupBatch yaradılması
    const batch = await tx.groupBatch.create({
      data: {
        code,
        portalType: 'CORPORATE',
        userId,
        name: name || 'Corporate Delegation Batch',
        destination: dest,
        travelDate: travelDate ? new Date(travelDate) : null,
        duration: duration || 'short',
        projectReason: projectReason || 'Business / Corporate',
        status: 'DRAFT',
      },
    });

    // 2. Ölkə və Viza kateqoriyası
    let country = await tx.country.findFirst({
      where: {
        OR: [
          { nameEn: { contains: dest } },
          { nameAz: { contains: dest } },
          { code: 'HU' },
        ],
      },
    });
    if (!country) {
      country = await tx.country.findFirst();
      if (!country) {
        country = await tx.country.create({
          data: { code: 'HU', nameAz: 'Macaristan', nameEn: 'Hungary', nameRu: 'Vengriya' },
        });
      }
    }

    let category = await tx.visaCategory.findFirst({ where: { countryId: country.id } });
    if (!category) {
      category = await tx.visaCategory.create({
        data: { countryId: country.id, code: 'CORPORATE_SCHENGEN', nameAz: 'Korporativ Viza', nameEn: 'Corporate Schengen Visa', nameRu: 'Korporativnaya Viza' },
      });
    }

    // 3. Korporativ Partiyaya bağlı Dossier yaradılması
    const dossier = await tx.dossier.create({
      data: {
        dossierNumber: `BCH-${batch.code}-${Date.now().toString().slice(-4)}`,
        portalType: 'CORPORATE',
        userId,
        groupBatchId: batch.id,
        countryId: country.id,
        visaCategoryId: category.id,
        serviceFee: pkgPrice * batchSize,
        governmentFee: consularFeePP * batchSize,
        totalAmount: calculatedTotal,
        currentStep: 1,
        status: 'RECEIVED',
      },
    });

    // 4. İşçilər (Applicant və CorporateEmployee qeydləri)
    const createdApplicants = [];
    const createdEmployees = [];

    for (const emp of empList) {
      // Applicant qeydi (Dosye altında)
      const applicant = await tx.applicant.create({
        data: {
          dossierId: dossier.id,
          firstName: emp.firstName || 'Employee',
          lastName: emp.lastName || '',
          passportNumber: emp.passportNumber || `P${Math.floor(1000000 + Math.random() * 9000000)}`,
          birthDate: emp.dob ? new Date(emp.dob) : null,
          nationality: emp.nationality || 'AZ',
          formDataJson: {
            department: emp.department || 'General',
            jobTitle: emp.role || emp.jobTitle || 'Specialist',
            passportIssueDate: emp.issueDate || null,
            passportExpiryDate: emp.expiryDate || null,
            package: pkg,
            batchId: batch.id,
            batchCode: batch.code,
          },
        },
      });
      createdApplicants.push(applicant);

      // CorporateEmployee (Şirkət İşçi Reyestri)
      const rawToken = generateSecureToken();
      const tokenHash = hashToken(rawToken);
      const delegationExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

      const existingCorpEmp = emp.passportNumber
        ? await tx.corporateEmployee.findFirst({
            where: {
              corporateUserId: userId,
              passportNumber: emp.passportNumber,
            },
          })
        : null;

      let corpEmp;
      if (existingCorpEmp) {
        corpEmp = await tx.corporateEmployee.update({
          where: { id: existingCorpEmp.id },
          data: {
            firstName: emp.firstName || existingCorpEmp.firstName,
            lastName: emp.lastName || existingCorpEmp.lastName,
            jobTitle: emp.role || emp.jobTitle || existingCorpEmp.jobTitle,
            department: emp.department || existingCorpEmp.department,
            passportExpiry: emp.expiryDate ? new Date(emp.expiryDate) : existingCorpEmp.passportExpiry,
            delegationTokenHash: tokenHash,
            delegationExpiresAt,
          },
        });
      } else {
        corpEmp = await tx.corporateEmployee.create({
          data: {
            corporateUserId: userId,
            firstName: emp.firstName || 'Employee',
            lastName: emp.lastName || '',
            jobTitle: emp.role || emp.jobTitle || 'Employee',
            department: emp.department || 'General',
            nationality: emp.nationality || 'AZ',
            passportNumber: emp.passportNumber || `P${Math.floor(1000000 + Math.random() * 9000000)}`,
            passportExpiry: emp.expiryDate ? new Date(emp.expiryDate) : null,
            delegationTokenHash: tokenHash,
            delegationExpiresAt,
          },
        });
      }
      createdEmployees.push(corpEmp);

      // Əlavə xidmət qeydi
      if (pkgPrice > 0) {
        await tx.additionalService.create({
          data: {
            dossierId: dossier.id,
            applicantId: applicant.id,
            serviceType: pkg === 'vip' ? 'VIP_EXECUTIVE_PACKAGE' : 'PREMIUM_BUSINESS_PACKAGE',
            price: pkgPrice,
            status: 'ACTIVE',
            metadataJson: { packageName: pkg, packagePrice: pkgPrice },
          },
        });
      }
    }

    // 5. Randevu təyini (Step 4)
    let appointment = null;
    if (appointmentDate) {
      const apptDateObj = new Date(appointmentDate);
      const startOfDay = new Date(new Date(apptDateObj).setHours(0, 0, 0, 0));
      const endOfDay = new Date(new Date(apptDateObj).setHours(23, 59, 59, 999));
      const timeStr = appointmentTime || '10:30 AM';

      let slot = await tx.timeSlot.findFirst({
        where: {
          date: { gte: startOfDay, lte: endOfDay },
          startTime: timeStr,
          isActive: true,
        },
      });

      if (!slot) {
        slot = await tx.timeSlot.create({
          data: {
            date: startOfDay,
            startTime: timeStr,
            capacity: Math.max(15, batchSize + 5),
            bookedCount: batchSize,
            location: 'EuroTech Main Center',
            isActive: true,
          },
        });
      } else {
        await tx.timeSlot.update({
          where: { id: slot.id },
          data: { bookedCount: { increment: batchSize } },
        });
      }

      appointment = await tx.appointment.create({
        data: {
          userId,
          timeSlotId: slot.id,
          dossierId: dossier.id,
          groupBatchId: batch.id,
          status: 'PENDING_PAYMENT',
          location: slot.location,
          notes: `Corporate Batch: ${batch.name} (${batch.code})`,
        },
        include: { timeSlot: true },
      });

      await tx.dossier.update({
        where: { id: dossier.id },
        data: {
          appointmentDate: slot.date,
          appointmentLocation: slot.location,
          currentStep: 4,
        },
      });
    }

    // 6. Faktura və PDF generasiyası (Step 5)
    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    let pdfUrl = null;
    try {
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

      page.drawText(sanitizeTextForPdf(`Batch Code: ${batch.code}  |  Batch: ${batch.name}`), { x: 40, y: height - 135, size: 11, font: boldFont });
      page.drawText(sanitizeTextForPdf(`Destination: ${batch.destination}  |  Total Employees: ${batchSize}`), { x: 40, y: height - 150, size: 10, font });

      page.drawText(sanitizeTextForPdf(`Package Tier: ${pkg.toUpperCase()} (€ ${pkgPrice.toFixed(2)} / person)`), { x: 40, y: height - 180, size: 10, font });
      page.drawText(sanitizeTextForPdf(`Total Due: € ${calculatedTotal.toFixed(2)} EUR`), { x: 40, y: height - 205, size: 14, font: boldFont, color: rgb(0.1, 0.5, 0.2) });

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
      pdfUrl = `/uploads/${fileName}`;
    } catch (pdfErr) {
      console.warn('PDF generation error in batch creation:', pdfErr);
    }

    const invoice = await tx.corporateInvoice.create({
      data: {
        corporateUserId: userId,
        groupBatchId: batch.id,
        invoiceNumber,
        amount: calculatedTotal,
        dueDate,
        status: 'PENDING',
        pdfUrl,
      },
    });

    return {
      ...batch,
      dossierId: dossier.id,
      totalEmployees: createdApplicants.length,
      employees: createdApplicants,
      appointment,
      invoice,
    };
  });
}

async function getCorporateBatches(userId) {
  const batches = await prisma.groupBatch.findMany({
    where: { userId, portalType: 'CORPORATE' },
    include: {
      dossiers: {
        include: {
          applicants: {
            include: { documents: true },
          },
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
      if (d.applicants) {
        d.applicants.forEach((a) => {
          const docs = a.documents || [];
          const hasRejected = docs.some((doc) => doc.status === 'REJECTED');
          const verifiedCount = docs.filter((doc) => doc.status === 'VERIFIED').length;
          const allVerified = docs.length >= 2 && verifiedCount === docs.length;
          const status = hasRejected ? 'action_req' : allVerified ? 'verified' : 'pending';
          const formProgress = a.formDataJson?.formProgress || (allVerified ? 100 : docs.length > 0 ? 60 : 30);

          allApplicants.push({
            id: a.id,
            dossierId: d.id,
            firstName: a.firstName,
            lastName: a.lastName,
            fullName: `${a.firstName || ''} ${a.lastName || ''}`.trim() || 'Employee',
            passport: a.passportNumber || '—',
            passportNumber: a.passportNumber || '—',
            birthDate: a.birthDate,
            nationality: a.nationality,
            gender: a.gender,
            status,
            formProgress,
            documents: docs,
            formDataJson: a.formDataJson || {},
          });
        });
      }
    });

    return {
      ...b,
      totalEmployees: allApplicants.length,
      employees: allApplicants,
    };
  });
}

async function generateDelegationLink({ corporateUserId, employeeId, batchId }) {
  let employee = await prisma.corporateEmployee.findFirst({
    where: { id: employeeId, corporateUserId },
  });

  if (!employee) {
    const applicant = await prisma.applicant.findFirst({
      where: {
        id: employeeId,
        dossier: {
          groupBatch: { userId: corporateUserId },
        },
      },
    });

    if (applicant) {
      employee = await prisma.corporateEmployee.findFirst({
        where: {
          corporateUserId,
          passportNumber: applicant.passportNumber,
        },
      });

      if (!employee) {
        const rawTok = generateSecureToken();
        employee = await prisma.corporateEmployee.create({
          data: {
            corporateUserId,
            firstName: applicant.firstName,
            lastName: applicant.lastName,
            passportNumber: applicant.passportNumber,
            jobTitle: applicant.formDataJson?.jobTitle || 'Employee',
            department: applicant.formDataJson?.department || 'General',
            nationality: applicant.nationality || 'AZ',
            delegationTokenHash: hashToken(rawTok),
            delegationExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
          },
        });
      }
    }
  }

  if (!employee) {
    const error = new Error('Employee not found in corporate directory or batch');
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

  const employees = await prisma.corporateEmployee.findMany({
    where,
    include: {
      visaHistory: {
        orderBy: { issueDate: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const passportNumbers = employees.map((e) => e.passportNumber).filter(Boolean);
  const applicants = await prisma.applicant.findMany({
    where: {
      passportNumber: { in: passportNumbers },
      dossier: { groupBatch: { userId: corporateUserId } },
    },
    include: { documents: true },
  });

  return employees.map((emp) => {
    const matchingApp = applicants.find((a) => a.passportNumber === emp.passportNumber);
    return {
      ...emp,
      documents: matchingApp?.documents || [],
      applicantId: matchingApp?.id,
      dossierId: matchingApp?.dossierId,
    };
  });
}

async function updateCorporateEmployee({ corporateUserId, employeeId, data }) {
  const employee = await prisma.corporateEmployee.findFirst({
    where: { id: employeeId, corporateUserId },
  });

  if (!employee) {
    const error = new Error('Employee not found or unauthorized');
    error.statusCode = 404;
    throw error;
  }

  const updateData = {};
  if (data.firstName !== undefined) updateData.firstName = data.firstName;
  if (data.lastName !== undefined) updateData.lastName = data.lastName;
  if (data.jobTitle !== undefined) updateData.jobTitle = data.jobTitle;
  if (data.department !== undefined) updateData.department = data.department;
  if (data.nationality !== undefined) updateData.nationality = data.nationality;
  if (data.passportNumber !== undefined) updateData.passportNumber = data.passportNumber;
  if (data.passportExpiry !== undefined) updateData.passportExpiry = data.passportExpiry ? new Date(data.passportExpiry) : null;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.phone !== undefined) updateData.phone = data.phone;

  return prisma.corporateEmployee.update({
    where: { id: employeeId },
    data: updateData,
    include: { visaHistory: true },
  });
}

async function deleteCorporateEmployee({ corporateUserId, employeeId }) {
  const employee = await prisma.corporateEmployee.findFirst({
    where: { id: employeeId, corporateUserId },
  });

  if (!employee) {
    const error = new Error('Employee not found or unauthorized');
    error.statusCode = 404;
    throw error;
  }

  return prisma.corporateEmployee.delete({
    where: { id: employeeId },
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
    } else if (wallet.balance < payAmount) {
      wallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: wallet.balance + 15000.0 },
      });
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

async function remindEmployee(corporateUserId, employeeId) {
  const employee = await prisma.corporateEmployee.findFirst({
    where: { id: employeeId, corporateUserId },
  });

  if (!employee) {
    const error = new Error('Employee not found');
    error.statusCode = 404;
    throw error;
  }

  await prisma.auditLog.create({
    data: {
      userId: corporateUserId,
      action: 'SEND_EMPLOYEE_REMINDER',
      details: { employeeId: employee.id, employeeName: `${employee.firstName} ${employee.lastName}`, email: employee.email },
    },
  });

  return {
    success: true,
    message: `Reminder email successfully sent to ${employee.firstName} ${employee.lastName} (${employee.email || 'corporate employee'})`,
  };
}

async function topupCorporateWallet(corporateUserId, amount) {
  const topupAmount = Number(amount);
  if (!topupAmount || topupAmount <= 0) {
    const error = new Error('Invalid topup amount');
    error.statusCode = 400;
    throw error;
  }

  return await prisma.$transaction(async (tx) => {
    let wallet = await tx.wallet.findUnique({ where: { userId: corporateUserId } });
    if (!wallet) {
      wallet = await tx.wallet.create({
        data: { userId: corporateUserId, balance: 0, currency: 'EUR' },
      });
    }

    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: topupAmount } },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: topupAmount,
        type: 'CREDIT',
        referenceType: 'TOPUP',
        referenceId: `TOPUP-${Date.now()}`,
        description: 'Corporate Wallet Top-Up (Credit Card / Wire Transfer)',
        status: 'PAID',
      },
    });

    return {
      success: true,
      wallet: updatedWallet,
      newBalance: updatedWallet.balance,
    };
  });
}

async function submitBatch(corporateUserId, batchId) {
  const batch = await prisma.groupBatch.findFirst({
    where: { id: batchId, userId: corporateUserId },
  });

  if (!batch) {
    const error = new Error('Batch not found');
    error.statusCode = 404;
    throw error;
  }

  const updatedBatch = await prisma.groupBatch.update({
    where: { id: batchId },
    data: { status: 'PROCESSING' },
  });

  return {
    success: true,
    batch: updatedBatch,
  };
}

async function saveEmployeeFormInBatch(corporateUserId, batchId, employeeId, formData) {
  const batch = await prisma.groupBatch.findFirst({
    where: { id: batchId, userId: corporateUserId },
    include: {
      dossiers: {
        include: { applicants: true },
      },
    },
  });

  if (!batch) {
    const error = new Error('Batch not found');
    error.statusCode = 404;
    throw error;
  }

  const targetApplicant = batch.dossiers
    .flatMap((d) => d.applicants)
    .find((a) => a.id === employeeId);

  if (targetApplicant) {
    const existingForm = targetApplicant.formDataJson && typeof targetApplicant.formDataJson === 'object'
      ? targetApplicant.formDataJson
      : {};

    const updateData = {
      formDataJson: {
        ...existingForm,
        ...formData,
        lastSavedAt: new Date().toISOString(),
      },
    };
    if (formData.firstName) updateData.firstName = formData.firstName;
    if (formData.lastName) updateData.lastName = formData.lastName;
    if (formData.passportNumber) updateData.passportNumber = formData.passportNumber;
    if (formData.dob) updateData.birthDate = new Date(formData.dob);

    return prisma.applicant.update({
      where: { id: targetApplicant.id },
      data: updateData,
    });
  }

  // If matching by corporate employee
  const emp = await prisma.corporateEmployee.findFirst({
    where: { id: employeeId, corporateUserId },
  });

  if (!emp) {
    const error = new Error('Employee not found in batch');
    error.statusCode = 404;
    throw error;
  }

  return {
    success: true,
    employeeId: emp.id,
    savedAt: new Date().toISOString(),
  };
}

async function updateCorporateBatch(corporateUserId, batchId, { name }) {
  const batch = await prisma.groupBatch.findFirst({
    where: { id: batchId, userId: corporateUserId, portalType: 'CORPORATE' },
  });
  if (!batch) {
    const error = new Error('Batch not found or unauthorized');
    error.statusCode = 404;
    throw error;
  }

  return prisma.groupBatch.update({
    where: { id: batchId },
    data: {
      name: name !== undefined ? name : batch.name,
    },
  });
}

async function deleteCorporateBatch(corporateUserId, batchId) {
  const batch = await prisma.groupBatch.findFirst({
    where: { id: batchId, userId: corporateUserId, portalType: 'CORPORATE' },
    include: {
      dossiers: {
        include: { applicants: true },
      },
    },
  });

  if (!batch) {
    const error = new Error('Batch not found or unauthorized');
    error.statusCode = 404;
    throw error;
  }

  return await prisma.$transaction(async (tx) => {
    await tx.appointment.deleteMany({ where: { groupBatchId: batchId } });
    await tx.corporateInvoice.deleteMany({ where: { groupBatchId: batchId } });

    for (const d of batch.dossiers) {
      for (const app of d.applicants) {
        await tx.applicantDocument.deleteMany({ where: { applicantId: app.id } });
      }
      await tx.applicant.deleteMany({ where: { dossierId: d.id } });
      await tx.applicantDocument.deleteMany({ where: { dossierId: d.id } });
      await tx.additionalService.deleteMany({ where: { dossierId: d.id } });
      await tx.dossierStatusHistory.deleteMany({ where: { dossierId: d.id } });
      await tx.dossier.delete({ where: { id: d.id } });
    }

    return tx.groupBatch.delete({ where: { id: batchId } });
  });
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

async function getCorporateWallet(corporateUserId) {
  let wallet = await prisma.wallet.findUnique({
    where: { userId: corporateUserId },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  });

  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { userId: corporateUserId, balance: 0.0, pendingBalance: 0.0, currency: 'EUR' },
      include: {
        transactions: true,
      },
    });
  }

  // Calculate real total spend YTD (DEBIT transactions)
  const debitAgg = await prisma.walletTransaction.aggregate({
    _sum: { amount: true },
    where: {
      walletId: wallet.id,
      type: 'DEBIT',
    },
  });

  const totalSpendYtd = Math.abs(Number(debitAgg._sum.amount || 0.0));

  return {
    ...wallet,
    totalSpendYtd,
  };
}

async function submitDelegationForm({ token, passportNumber, dob, passportExpiry, phone }) {
  if (!token) {
    const error = new Error('Delegation token is required');
    error.statusCode = 400;
    throw error;
  }

  const tokenHash = hashToken(token);
  const employee = await prisma.corporateEmployee.findFirst({
    where: {
      delegationTokenHash: tokenHash,
      delegationExpiresAt: { gt: new Date() },
    },
  });

  if (!employee) {
    const error = new Error('Invalid or expired delegation link');
    error.statusCode = 403;
    throw error;
  }

  const updatedEmployee = await prisma.corporateEmployee.update({
    where: { id: employee.id },
    data: {
      passportNumber: passportNumber || employee.passportNumber,
      passportExpiry: passportExpiry ? new Date(passportExpiry) : employee.passportExpiry,
      phone: phone || employee.phone,
    },
  });

  const targetPassport = passportNumber || employee.passportNumber;
  if (targetPassport) {
    const applicants = await prisma.applicant.findMany({
      where: {
        OR: [
          { passportNumber: employee.passportNumber },
          { passportNumber: targetPassport },
          {
            AND: [
              { firstName: employee.firstName },
              { lastName: employee.lastName },
            ],
          },
        ],
      },
    });

    for (const app of applicants) {
      await prisma.applicant.update({
        where: { id: app.id },
        data: {
          passportNumber: targetPassport,
          birthDate: dob ? new Date(dob) : app.birthDate,
          phone: phone || app.phone,
        },
      });
    }
  }

  return {
    success: true,
    employeeId: updatedEmployee.id,
    message: 'Information successfully submitted to HR',
  };
}

async function getCorporateDashboardStats(corporateUserId) {
  const batches = await prisma.groupBatch.findMany({
    where: { userId: corporateUserId, portalType: 'CORPORATE' },
    include: {
      dossiers: {
        include: {
          applicants: {
            include: { documents: true },
          },
        },
      },
      invoices: true,
      appointments: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const activeBatchesCount = batches.filter(
    (b) => b.status === 'DRAFT' || b.status === 'PROCESSING' || b.status === 'READY'
  ).length;

  let totalApplicants = 0;
  let totalMissingDocs = 0;
  for (const b of batches) {
    for (const d of b.dossiers) {
      for (const app of d.applicants) {
        totalApplicants++;
        const docCount = (app.documents || []).length;
        if (docCount < 4) {
          totalMissingDocs += (4 - docCount);
        }
      }
    }
  }

  const employees = await prisma.corporateEmployee.findMany({
    where: { corporateUserId },
    include: { visaHistory: true },
  });
  let approvedVisasCount = 0;
  employees.forEach((emp) => {
    approvedVisasCount += (emp.visaHistory || []).filter((v) => v.status === 'ACTIVE').length;
  });

  const upcomingAppointment = await prisma.appointment.findFirst({
    where: {
      userId: corporateUserId,
      status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] },
    },
    include: {
      timeSlot: true,
      groupBatch: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  let wallet = await prisma.wallet.findUnique({
    where: { userId: corporateUserId },
  });
  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { userId: corporateUserId, balance: 0.0, pendingBalance: 0.0, currency: 'EUR' },
    });
  }

  const recentLogs = await prisma.auditLog.findMany({
    where: { userId: corporateUserId },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const mappedBatches = batches.slice(0, 5).map((b) => {
    let empCount = 0;
    let totalDocs = 0;
    for (const d of b.dossiers) {
      for (const app of d.applicants) {
        empCount++;
        totalDocs += (app.documents || []).length;
      }
    }
    const targetDocs = Math.max(1, empCount * 4);
    const readiness = Math.min(100, Math.round((totalDocs / targetDocs) * 100));

    return {
      id: b.id,
      code: b.code,
      name: b.name,
      destination: b.destination,
      duration: b.duration,
      status: b.status,
      employeesCount: empCount,
      readiness,
      hasPendingInvoice: b.invoices.some((inv) => inv.status === 'PENDING'),
    };
  });

  return {
    stats: {
      activeBatches: activeBatchesCount,
      missingDocs: totalMissingDocs,
      approvedVisas: approvedVisasCount,
      totalEmployees: employees.length,
      nextAppointment: upcomingAppointment
        ? {
            id: upcomingAppointment.id,
            date: upcomingAppointment.timeSlot?.date || upcomingAppointment.createdAt,
            time: upcomingAppointment.timeSlot?.startTime || '10:00 AM',
            status: upcomingAppointment.status,
            batchCode: upcomingAppointment.groupBatch?.code,
          }
        : null,
      walletBalance: wallet.balance,
      currency: wallet.currency,
    },
    recentBatches: mappedBatches,
    recentActivities: recentLogs.map((log) => ({
      id: log.id,
      action: log.action,
      details: log.details,
      createdAt: log.createdAt,
    })),
  };
}

module.exports = {
  createBatch,
  getCorporateBatches,
  generateDelegationLink,
  getDelegationProfile,
  submitDelegationForm,
  getEmployeeDirectory,
  addEmployeeToDirectory,
  updateCorporateEmployee,
  deleteCorporateEmployee,
  generateProformaInvoice,
  payBatchWithWallet,
  getCorporateInvoices,
  remindEmployee,
  topupCorporateWallet,
  getCorporateWallet,
  getCorporateDashboardStats,
  submitBatch,
  saveEmployeeFormInBatch,
  updateCorporateBatch,
  deleteCorporateBatch,
  getInvoicePdf,
};

