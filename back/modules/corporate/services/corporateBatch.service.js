const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const prisma = require('../../../config/db');
const env = require('../../../config/env');
const { generateSecureToken, hashToken } = require('../../../utils/token.util');
const { calculatePortalFees } = require('../../../utils/finance.util');
const { getPricingCatalog } = require('../../service/pricingConfig.service');
const walletService = require('../../payment/wallet.service');
const { nextBookingCode } = require('../../vcms/services/codeGenerator.service');

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
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `BCH-${year}-${digits}`;
}

async function createBatch({
  userId,
  name,
  destination,
  countryId,
  visaTypeId,
  visaPurposeId,
  travelDate,
  duration,
  projectReason,
  package: activePackage,
  packagePrice,
  appointmentDate,
  appointmentTime,
  timeSlotId,
  visaCenter,
  employees,
  totalAmount,
  paymentMethod,
}) {
  const code = generateBatchCode();
  const dest = destination || 'Europe / Schengen';
  const pkg = String(activePackage || 'standard').toLowerCase();
  const empList = Array.isArray(employees) ? employees : [];
  const batchSize = Math.max(1, empList.length);
  const catalog = await getPricingCatalog();

  return await prisma.$transaction(async (tx) => {
    // 1. Ölkə və Viza kateqoriyası / VCMS həlli
    let country = null;
    if (countryId) {
      country = await tx.country.findUnique({ where: { id: countryId } });
    }
    if (!country && dest) {
      country = await tx.country.findFirst({
        where: {
          OR: [
            { code: dest.toUpperCase() },
            { nameEn: { equals: dest } },
            { nameAz: { equals: dest } },
            { nameEn: { contains: dest } },
            { nameAz: { contains: dest } },
          ],
        },
      });
    }
    if (!country) {
      country =
        (await tx.country.findFirst({ where: { code: 'HU' } })) || (await tx.country.findFirst());
      if (!country) {
        country = await tx.country.create({
          data: { code: 'HU', nameAz: 'Macaristan', nameEn: 'Hungary', nameRu: 'Vengriya' },
        });
      }
    }

    let resolvedVisaPurpose = null;
    let resolvedVisaType = null;
    if (visaPurposeId) {
      resolvedVisaPurpose = await tx.visaPurpose.findUnique({
        where: { id: visaPurposeId },
        include: { visaType: true },
      });
      resolvedVisaType = resolvedVisaPurpose?.visaType || null;
    }
    if (!resolvedVisaType && visaTypeId) {
      resolvedVisaType = await tx.visaType.findUnique({ where: { id: visaTypeId } });
    }
    if (!resolvedVisaType && country) {
      const targetStay = String(duration || 'short').toLowerCase() === 'long' ? 'LONG' : 'SHORT';
      resolvedVisaType =
        (await tx.visaType.findFirst({
          where: { countryId: country.id, stayCategory: targetStay, status: 'ACTIVE' },
          orderBy: { displayOrder: 'asc' },
        })) ||
        (await tx.visaType.findFirst({
          where: { countryId: country.id, status: 'ACTIVE' },
          orderBy: { displayOrder: 'asc' },
        }));
    }
    if (!resolvedVisaPurpose && resolvedVisaType) {
      const reasonStr = String(projectReason || 'Business').trim();
      resolvedVisaPurpose =
        (await tx.visaPurpose.findFirst({
          where: {
            visaTypeId: resolvedVisaType.id,
            status: 'ACTIVE',
            OR: [
              { nameEn: { contains: reasonStr } },
              { nameAz: { contains: reasonStr } },
            ],
          },
          orderBy: { displayOrder: 'asc' },
        })) ||
        (await tx.visaPurpose.findFirst({
          where: { visaTypeId: resolvedVisaType.id, status: 'ACTIVE' },
          orderBy: { displayOrder: 'asc' },
        }));
    }

    let configurationVersionId = null;
    if (country?.id) {
      const latestVersion = await tx.configurationVersion.findFirst({
        where: { countryId: country.id, status: 'ACTIVE' },
        orderBy: { versionNumber: 'desc' },
      });
      if (latestVersion) configurationVersionId = latestVersion.id;
    }

    const baseConsularFee =
      resolvedVisaPurpose?.consularFeeOverride ?? resolvedVisaType?.defaultFeeEur;

    const fees = calculatePortalFees({
      portalType: 'CORPORATE',
      paxCount: batchSize,
      activePackage: pkg,
      duration: duration || (resolvedVisaType?.stayCategory === 'LONG' ? 'long' : 'short'),
      baseConsularFee: baseConsularFee !== undefined && baseConsularFee !== null ? Number(baseConsularFee) : undefined,
      catalog,
    });
    const pkgPrice = Number(packagePrice !== undefined ? packagePrice : fees.packageAddOnPerPax);
    const consularFeePP = Number((fees.govFeePerPax + fees.baseServiceFeePerPax).toFixed(2));
    const calculatedTotal = Number(totalAmount) || fees.grandTotalEur;

    // 2. GroupBatch yaradılması
    const batch = await tx.groupBatch.create({
      data: {
        code,
        portalType: 'CORPORATE',
        userId,
        name: name || 'Corporate Delegation Batch',
        destination: destination || country?.nameEn || dest,
        travelDate: travelDate ? new Date(travelDate) : null,
        duration: duration || (resolvedVisaType?.stayCategory === 'LONG' ? 'long' : 'short'),
        projectReason: projectReason || resolvedVisaPurpose?.nameEn || 'Business / Corporate',
        packageTier: pkg,
        status: 'DRAFT',
      },
    });

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
        visaTypeId: resolvedVisaType?.id || null,
        visaPurposeId: resolvedVisaPurpose?.id || null,
        configurationVersionId,
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
    if (appointmentDate || timeSlotId) {
      const apptDateObj = appointmentDate ? new Date(appointmentDate) : new Date();
      const startOfDay = new Date(new Date(apptDateObj).setHours(0, 0, 0, 0));
      const endOfDay = new Date(new Date(apptDateObj).setHours(23, 59, 59, 999));
      const timeStr = appointmentTime || '10:30 AM';

      let slot = null;
      if (timeSlotId) {
        slot = await tx.timeSlot.findUnique({ where: { id: timeSlotId } });
      }
      // If appointmentTime is a UUID or slot ID
      if (!slot && appointmentTime && (appointmentTime.length === 36 || (appointmentTime.includes('-') && appointmentTime.length > 20))) {
        slot = await tx.timeSlot.findUnique({ where: { id: appointmentTime } });
      }

      if (!slot && appointmentDate) {
        slot = await tx.timeSlot.findFirst({
          where: {
            date: { gte: startOfDay, lte: endOfDay },
            startTime: timeStr,
            isActive: true,
            slotStatus: 'AVAILABLE',
            ...(country?.id ? { OR: [{ countryId: country.id }, { countryId: null }] } : {}),
          },
        });
      }

      const defaultCorpLoc = visaCenter || 'EuroTech Main Center';

      if (slot) {
        if (['DRAFT', 'BLOCKED', 'CLOSED'].includes(slot.slotStatus)) {
          const err = new Error(`Selected time slot is not available for booking (Status: ${slot.slotStatus})`);
          err.statusCode = 400;
          throw err;
        }
        const remaining = slot.capacity - slot.bookedCount;
        if (remaining < batchSize) {
          const err = new Error(`Selected time slot has insufficient capacity (Available: ${remaining}, Batch size: ${batchSize})`);
          err.statusCode = 400;
          throw err;
        }
        const newBookedCount = slot.bookedCount + batchSize;
        slot = await tx.timeSlot.update({
          where: { id: slot.id },
          data: {
            bookedCount: newBookedCount,
            slotStatus: newBookedCount >= slot.capacity ? 'FULL' : 'AVAILABLE',
          },
        });
      } else {
        slot = await tx.timeSlot.create({
          data: {
            date: startOfDay,
            startTime: (timeStr && timeStr.length < 20) ? timeStr : '10:30 AM',
            capacity: Math.max(15, batchSize + 5),
            bookedCount: batchSize,
            slotStatus: 'AVAILABLE',
            countryId: country?.id || null,
            visaTypeId: resolvedVisaType?.id || null,
            visaPurposeId: resolvedVisaPurpose?.id || null,
            location: defaultCorpLoc,
            isActive: true,
          },
        });
      }

      const bookingCode = await nextBookingCode(tx);
      const resolvedLoc = slot.location || defaultCorpLoc;

      appointment = await tx.appointment.create({
        data: {
          bookingCode,
          userId,
          timeSlotId: slot.id,
          providerId: slot.providerId || null,
          visaTypeId: slot.visaTypeId || resolvedVisaType?.id || null,
          dossierId: dossier.id,
          groupBatchId: batch.id,
          groupSize: batchSize,
          status: 'PENDING_PAYMENT',
          location: resolvedLoc,
          notes: `Corporate Batch: ${batch.name} (${batch.code}) - ${batchSize} Pax`,
        },
        include: { timeSlot: true },
      });

      await tx.dossier.update({
        where: { id: dossier.id },
        data: {
          appointmentDate: slot.date,
          appointmentLocation: resolvedLoc,
          currentStep: 4,
        },
      });
    }

    // 6. Faktura və PDF generasiyası (Step 5)
    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
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

    let settledBatch = batch;
    let settledInvoice = invoice;
    let settledAppointment = appointment;

    // Auto-settle immediately if Corporate Partner chooses Pre-funded Wallet and balance is sufficient
    if (String(paymentMethod || '').toUpperCase() === 'WALLET') {
      try {
        const wallet = await walletService.getOrCreateWallet(userId, tx);
        const summary = await walletService.recalculateWalletBalances(wallet.id, tx);
        if (summary.balance >= calculatedTotal && calculatedTotal > 0) {
          const ref = `WLT-${batch.code}-${Date.now().toString().slice(-5)}`;
          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              amount: -calculatedTotal,
              type: 'DEBIT',
              referenceType: 'VISA_PAYMENT',
              referenceId: batch.code,
              description: `Corporate Batch Visa Fees: ${batch.name} (${batch.code})`,
              status: 'PAID',
            },
          });

          await walletService.settleGroupBatchInTx(tx, {
            groupBatchId: batch.id,
            payerUserId: userId,
            paymentProvider: 'WALLET',
            referenceCode: ref,
            explicitAmountEur: calculatedTotal,
          });

          await walletService.recalculateWalletBalances(wallet.id, tx);

          settledInvoice = await tx.corporateInvoice.findUnique({ where: { id: invoice.id } });
          settledBatch = await tx.groupBatch.findUnique({ where: { id: batch.id } });
          if (appointment) {
            settledAppointment = await tx.appointment.findUnique({
              where: { id: appointment.id },
              include: { timeSlot: true },
            });
          }
        }
      } catch (walletPayErr) {
        console.warn('Auto-settle wallet failed in createBatch, invoice left pending:', walletPayErr);
      }
    }

    try {
      await tx.auditLog.create({
        data: {
          userId,
          action: 'BATCH_CREATED',
          details: {
            batchId: batch.id,
            batchCode: batch.code,
            batchName: batch.name,
            employeesCount: createdApplicants.length,
            destination: dest,
            paymentMethod: paymentMethod || 'WALLET',
            isSettled: settledInvoice?.status === 'PAID',
            message: `New employee batch ${batch.name} (${batch.code}) registered`,
          },
        },
      });
    } catch (auditErr) {
      console.warn('Audit log creation failed for createBatch:', auditErr);
    }

    return {
      ...settledBatch,
      dossierId: dossier.id,
      totalEmployees: createdApplicants.length,
      employees: createdApplicants,
      appointment: settledAppointment,
      invoice: settledInvoice,
    };
  });
}

async function getCorporateBatches(userId) {
  const batches = await prisma.groupBatch.findMany({
    where: { userId, portalType: 'CORPORATE' },
    include: {
      dossiers: {
        include: {
          country: true,
          visaType: true,
          visaPurpose: true,
          applicants: {
            include: { documents: true },
          },
          documents: true,
        },
      },
      appointments: {
        include: {
          timeSlot: {
            include: {
              country: true,
              provider: {
                include: {
                  embassy: true,
                  visaApplicationCentre: true,
                },
              },
              visaType: true,
              visaPurpose: true,
            },
          },
          notifications: {
            orderBy: { sentAt: 'desc' },
            take: 5,
          },
        },
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

async function updateCorporateBatch(corporateUserId, batchId, { name, packageTier, package: pkg }) {
  const batch = await prisma.groupBatch.findFirst({
    where: { id: batchId, userId: corporateUserId, portalType: 'CORPORATE' },
    include: { dossiers: { include: { applicants: true } } },
  });
  if (!batch) {
    const error = new Error('Batch not found or unauthorized');
    error.statusCode = 404;
    throw error;
  }

  const nextPkg = packageTier || pkg;
  const updatedBatch = await prisma.groupBatch.update({
    where: { id: batchId },
    data: {
      name: name !== undefined ? name : batch.name,
      ...(nextPkg ? { packageTier: String(nextPkg).toLowerCase() } : {}),
    },
  });

  if (nextPkg) {
    const catalog = await getPricingCatalog();
    const allApps = batch.dossiers.flatMap((d) => d.applicants || []);
    const paxCount = Math.max(1, allApps.length);
    const fees = calculatePortalFees({
      portalType: 'CORPORATE',
      paxCount,
      activePackage: String(nextPkg).toLowerCase(),
      duration: batch.duration || 'short',
      catalog,
    });
    const primaryDossier = batch.dossiers[0];
    if (primaryDossier && primaryDossier.paymentStatus !== 'PAID') {
      await prisma.dossier.update({
        where: { id: primaryDossier.id },
        data: {
          governmentFee: fees.govFeePerPax,
          serviceFee: fees.serviceFeePerPaxForDossier,
          extraServicesFee: fees.extraServicesTotalForDossier,
          totalAmount: fees.grandTotalEur,
        },
      });
    }
    await prisma.corporateInvoice.updateMany({
      where: { groupBatchId: batchId, status: 'PENDING' },
      data: { amount: fees.grandTotalEur },
    });
  }

  return updatedBatch;
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
    if (formData.birthDate || formData.dob) {
      const parsedDate = new Date(formData.birthDate || formData.dob);
      if (!isNaN(parsedDate.getTime())) {
        updateData.birthDate = parsedDate;
      }
    }

    return prisma.applicant.update({
      where: { id: targetApplicant.id },
      data: updateData,
    });
  }

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

async function addEmployeeToBatch(corporateUserId, batchId, employeeData) {
  const batch = await prisma.groupBatch.findFirst({
    where: { id: batchId, userId: corporateUserId, portalType: 'CORPORATE' },
    include: {
      dossiers: {
        include: { applicants: true },
      },
      appointments: {
        include: { timeSlot: true },
      },
    },
  });

  if (!batch) {
    const error = new Error('Batch not found or unauthorized');
    error.statusCode = 404;
    throw error;
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Get or create dossier for this batch
    let dossier = batch.dossiers?.[0];
    if (!dossier) {
      let country = await tx.country.findFirst();
      let category = await tx.visaCategory.findFirst({ where: { countryId: country.id } });
      dossier = await tx.dossier.create({
        data: {
          dossierNumber: `BCH-${batch.code}-${Date.now().toString().slice(-4)}`,
          portalType: 'CORPORATE',
          userId: corporateUserId,
          groupBatchId: batch.id,
          countryId: country.id,
          visaCategoryId: category.id,
          totalAmount: 145.0,
          currentStep: 1,
          status: 'RECEIVED',
        },
      });
    }

    const passportNumber = employeeData.passportNumber || `P${Math.floor(1000000 + Math.random() * 9000000)}`;

    // 2. Create applicant under dossier
    const applicant = await tx.applicant.create({
      data: {
        dossierId: dossier.id,
        firstName: employeeData.firstName || 'Employee',
        lastName: employeeData.lastName || '',
        passportNumber,
        birthDate: employeeData.dob ? new Date(employeeData.dob) : null,
        nationality: employeeData.nationality || 'AZ',
        formDataJson: {
          department: employeeData.department || 'General',
          jobTitle: employeeData.role || employeeData.jobTitle || 'Specialist',
          passportIssueDate: employeeData.issueDate || null,
          passportExpiryDate: employeeData.expiryDate || null,
          batchId: batch.id,
          batchCode: batch.code,
        },
      },
    });

    // 3. Upsert CorporateEmployee in company directory
    let corpEmp = await tx.corporateEmployee.findFirst({
      where: { corporateUserId, passportNumber },
    });
    if (!corpEmp) {
      const rawToken = generateSecureToken();
      corpEmp = await tx.corporateEmployee.create({
        data: {
          corporateUserId,
          firstName: employeeData.firstName || 'Employee',
          lastName: employeeData.lastName || '',
          jobTitle: employeeData.role || employeeData.jobTitle || 'Specialist',
          department: employeeData.department || 'General',
          nationality: employeeData.nationality || 'AZ',
          passportNumber,
          passportExpiry: employeeData.expiryDate ? new Date(employeeData.expiryDate) : null,
          delegationTokenHash: hashToken(rawToken),
          delegationExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        },
      });
    }

    // 4. Update dossier totals
    const currentApplicants = await tx.applicant.count({ where: { dossierId: dossier.id } });
    const consularFeePP = 145.0;
    const newTotal = consularFeePP * currentApplicants;
    await tx.dossier.update({
      where: { id: dossier.id },
      data: {
        totalAmount: newTotal,
        governmentFee: newTotal,
      },
    });

    // 5. Update appointment bookedCount if exists
    for (const appt of batch.appointments) {
      if (appt.timeSlotId) {
        await tx.timeSlot.update({
          where: { id: appt.timeSlotId },
          data: { bookedCount: { increment: 1 } },
        });
      }
    }

    return {
      success: true,
      applicant,
      corporateEmployee: corpEmp,
    };
  });
}

async function removeEmployeeFromBatch(corporateUserId, batchId, employeeId) {
  const batch = await prisma.groupBatch.findFirst({
    where: { id: batchId, userId: corporateUserId, portalType: 'CORPORATE' },
    include: {
      dossiers: {
        include: { applicants: true },
      },
      appointments: true,
    },
  });

  if (!batch) {
    const error = new Error('Batch not found or unauthorized');
    error.statusCode = 404;
    throw error;
  }

  const dossier = batch.dossiers?.[0];
  const targetApplicant = dossier?.applicants.find(
    (a) => a.id === employeeId || a.passportNumber === employeeId
  );

  if (!targetApplicant) {
    const error = new Error('Employee not found in batch');
    error.statusCode = 404;
    throw error;
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Delete applicant documents and additional services
    await tx.applicantDocument.deleteMany({ where: { applicantId: targetApplicant.id } });
    await tx.additionalService.deleteMany({ where: { applicantId: targetApplicant.id } });
    await tx.applicant.delete({ where: { id: targetApplicant.id } });

    // 2. Decrement slot booked count if appointment exists
    for (const appt of batch.appointments) {
      if (appt.timeSlotId) {
        await tx.timeSlot.update({
          where: { id: appt.timeSlotId },
          data: { bookedCount: { decrement: 1 } },
        });
      }
    }

    // 3. Recalculate dossier totals
    const remainingCount = await tx.applicant.count({ where: { dossierId: dossier.id } });
    const newTotal = 145.0 * Math.max(1, remainingCount);
    await tx.dossier.update({
      where: { id: dossier.id },
      data: {
        totalAmount: newTotal,
        governmentFee: newTotal,
      },
    });

    return {
      success: true,
      removedId: targetApplicant.id,
      remainingCount,
    };
  });
}

module.exports = {
  createBatch,
  getCorporateBatches,
  submitBatch,
  updateCorporateBatch,
  deleteCorporateBatch,
  saveEmployeeFormInBatch,
  addEmployeeToBatch,
  removeEmployeeFromBatch,
};
