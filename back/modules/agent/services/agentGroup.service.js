const prisma = require('../../../config/db');
const { parseSafeDate, calculatePortalFees, getAgentCommissionRate } = require('../../../utils/finance.util');
const walletService = require('../../payment/wallet.service');
const { getPricingCatalog } = require('../../service/pricingConfig.service');
const { nextBookingCode } = require('../../vcms/services/codeGenerator.service');

function generateGroupCode() {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `GRP-${digits}`;
}

function parseAppointmentDateTime(dateStr, timeStr = '10:00', fieldLabel = 'Appointment Date') {
  const baseDate = parseSafeDate(dateStr, fieldLabel);
  if (!baseDate) return null;

  const rawTime = String(timeStr || '10:00').trim();
  const match = rawTime.match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridiem = match[3] ? match[3].toUpperCase() : null;
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      const dt = new Date(baseDate.getTime());
      dt.setUTCHours(hours, minutes, 0, 0);
      return dt;
    }
  }
  return baseDate;
}

/**
 * Synchronizes group dossier pricing and agent commission ledger entry inside a transaction (or prisma client).
 */
async function syncGroupFinancialsInTx(groupId, userId, tx = prisma) {
  const group = await tx.groupBatch.findUnique({
    where: { id: groupId },
    include: {
      dossiers: {
        include: {
          applicants: true,
          visaType: true,
          visaPurpose: true,
        },
      },
    },
  });

  if (!group) return null;

  const ownerId = userId || group.userId;
  const catalog = await getPricingCatalog(tx);
  const user = await tx.user.findUnique({
    where: { id: ownerId },
    select: { agentTier: true },
  });
  const tier = user?.agentTier || 'BRONZE';
  const ratePerPax = getAgentCommissionRate(tier, catalog);

  const allApplicants = group.dossiers.flatMap((d) => d.applicants || []);
  const totalApplicants = allApplicants.length;
  const paxForPricing = Math.max(1, totalApplicants);
  const pkg = group.packageTier || allApplicants[0]?.formDataJson?.package || 'standard';

  const primaryDossier = group.dossiers[0] || null;
  const baseConsularFee =
    primaryDossier?.visaPurpose?.consularFeeOverride ?? primaryDossier?.visaType?.defaultFeeEur;

  const fees = calculatePortalFees({
    portalType: 'GROUP_AGENT',
    paxCount: paxForPricing,
    activePackage: pkg,
    duration: group.duration || 'short',
    baseConsularFee: baseConsularFee !== undefined && baseConsularFee !== null ? Number(baseConsularFee) : undefined,
    catalog,
  });

  if (primaryDossier && primaryDossier.paymentStatus !== 'PAID') {
    await tx.dossier.update({
      where: { id: primaryDossier.id },
      data: {
        governmentFee: fees.govFeePerPax,
        serviceFee: fees.serviceFeePerPaxForDossier,
        extraServicesFee: fees.extraServicesTotalForDossier,
        totalAmount: fees.grandTotalEur,
      },
    });
  }

  const wallet = await walletService.getOrCreateWallet(ownerId, tx);
  const existingComm = await tx.walletTransaction.findFirst({
    where: {
      walletId: wallet.id,
      referenceType: 'COMMISSION',
      referenceId: group.code,
    },
  });

  const isPaid = group.dossiers.length > 0 && group.dossiers.every((d) => d.paymentStatus === 'PAID');
  if (isPaid && group.status === 'DRAFT') {
    await tx.groupBatch.update({
      where: { id: group.id },
      data: { status: 'PROCESSING' },
    });
    group.status = 'PROCESSING';
  }
  const isSettled = isPaid && ['PROCESSING', 'READY', 'COMPLETED'].includes(group.status);

  if (totalApplicants > 0) {
    const commissionAmount = Number((totalApplicants * ratePerPax).toFixed(2));
    const expectedStatus = isSettled ? 'PAID' : 'PENDING';
    const description =
      expectedStatus === 'PAID'
        ? `Commission: ${group.name} (${totalApplicants} Pax @ €${ratePerPax.toFixed(2)} [${tier}])`
        : `Pending Commission: ${group.name} (${totalApplicants} Pax @ €${ratePerPax.toFixed(2)} [${tier}])`;

    if (!existingComm) {
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: commissionAmount,
          type: 'CREDIT',
          referenceType: 'COMMISSION',
          referenceId: group.code,
          description,
          status: expectedStatus,
        },
      });
    } else if (
      existingComm.status !== expectedStatus ||
      Math.abs(Number(existingComm.amount) - commissionAmount) > 0.01 ||
      existingComm.description !== description
    ) {
      await tx.walletTransaction.update({
        where: { id: existingComm.id },
        data: {
          amount: commissionAmount,
          status: expectedStatus,
          description,
        },
      });
    }
  } else if (existingComm && existingComm.status === 'PENDING') {
    await tx.walletTransaction.delete({ where: { id: existingComm.id } });
  }

  await walletService.recalculateWalletBalances(wallet.id, tx);

  return {
    fees,
    tier,
    ratePerPax,
    totalApplicants,
    isPaid,
    isSettled,
    commissionAmount: Number((totalApplicants * ratePerPax).toFixed(2)),
  };
}

async function createGroup({
  userId,
  name,
  destination,
  countryId,
  visaTypeId,
  visaPurposeId,
  travelDate,
  duration,
  projectReason,
  applicants,
  package: pkg,
  services,
  appointmentDate,
  appointmentTime,
  timeSlotId,
  visaCenter,
  paymentMethod,
}) {
  const code = generateGroupCode();
  const appList = Array.isArray(applicants) ? applicants : [];
  const paxCount = Math.max(1, appList.length);
  const selectedPackage = String(pkg || services?.activePackage || 'standard').toLowerCase();

  const safeTravelDate = parseSafeDate(travelDate, 'Travel Date');
  const safeApptDateTime = appointmentDate
    ? parseAppointmentDateTime(appointmentDate, appointmentTime || '10:00', 'Appointment Date')
    : null;

  const catalog = await getPricingCatalog();

  return await prisma.$transaction(async (tx) => {
    let country = null;
    if (countryId) {
      country = await tx.country.findUnique({ where: { id: countryId } });
    }
    if (!country && destination) {
      country = await tx.country.findFirst({
        where: {
          OR: [
            { code: destination.toUpperCase() },
            { nameEn: { equals: destination } },
            { nameAz: { equals: destination } },
            { nameEn: { contains: destination } },
            { nameAz: { contains: destination } },
          ],
        },
      });
    }
    if (!country) {
      country = (await tx.country.findFirst({ where: { code: 'HU' } })) || (await tx.country.findFirst());
    }
    if (!country) {
      country = await tx.country.create({
        data: { code: 'HU', nameAz: 'Macarıstan', nameEn: 'Hungary', nameRu: 'Vengriya' },
      });
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
      const reasonStr = String(projectReason || 'Tourism').trim();
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
      portalType: 'GROUP_AGENT',
      paxCount,
      activePackage: selectedPackage,
      services,
      duration: duration || (resolvedVisaType?.stayCategory === 'LONG' ? 'long' : 'short'),
      baseConsularFee: baseConsularFee !== undefined && baseConsularFee !== null ? Number(baseConsularFee) : undefined,
      catalog,
    });

    const group = await tx.groupBatch.create({
      data: {
        code,
        portalType: 'GROUP_AGENT',
        userId,
        name: (name || 'Tour Delegation').trim(),
        destination: destination || country?.nameEn || 'Europe / Schengen',
        travelDate: safeTravelDate,
        duration: duration || (resolvedVisaType?.stayCategory === 'LONG' ? 'long' : 'short'),
        projectReason: projectReason || resolvedVisaPurpose?.nameEn || 'Tourism',
        packageTier: selectedPackage,
        status: 'DRAFT',
      },
    });

    let category = await tx.visaCategory.findFirst({ where: { countryId: country.id } });
    if (!category) {
      category = await tx.visaCategory.create({
        data: {
          countryId: country.id,
          code: 'SCHENGEN_TOURIST',
          nameAz: 'Şengen Turist',
          nameEn: 'Schengen Tourist',
          nameRu: 'Schengen Tourist',
        },
      });
    }

    const defaultLocation = visaCenter || 'EuroTech Main Center, Port Baku Towers';

    const dossier = await tx.dossier.create({
      data: {
        dossierNumber: `${code}-${Date.now().toString().slice(-4)}`,
        portalType: 'GROUP_AGENT',
        userId,
        groupBatchId: group.id,
        countryId: country.id,
        visaCategoryId: category.id,
        visaTypeId: resolvedVisaType?.id || null,
        visaPurposeId: resolvedVisaPurpose?.id || null,
        configurationVersionId,
        status: 'RECEIVED',
        currentStep: 1,
        governmentFee: fees.govFeePerPax,
        serviceFee: fees.serviceFeePerPaxForDossier,
        extraServicesFee: fees.extraServicesTotalForDossier,
        totalAmount: fees.grandTotalEur,
        paymentStatus: 'PENDING',
        appointmentDate: safeApptDateTime,
        appointmentLocation: defaultLocation,
      },
    });

    for (const app of appList) {
      const safeDob = parseSafeDate(app.dob || app.birthDate, 'Applicant Date of Birth');
      await tx.applicant.create({
        data: {
          dossierId: dossier.id,
          firstName: (app.firstName || app.fullName?.split(' ')[0] || 'Applicant').trim(),
          lastName: (app.lastName || app.fullName?.split(' ').slice(1).join(' ') || '').trim(),
          passportNumber: (app.passportNumber || app.passport || 'P0000000').trim().toUpperCase(),
          birthDate: safeDob,
          nationality: app.nationality || 'AZ',
          gender: app.gender || null,
          formDataJson: {
            dob: safeDob ? safeDob.toISOString().split('T')[0] : app.dob || null,
            issueDate: app.issueDate || null,
            expiryDate: app.expiryDate || null,
            package: selectedPackage,
            ...(app.formDataJson || {}),
          },
        },
      });
    }

    if (safeApptDateTime || timeSlotId) {
      let timeSlot = null;
      if (timeSlotId) {
        timeSlot = await tx.timeSlot.findUnique({ where: { id: timeSlotId } });
      }

      const slotStartStr = appointmentTime || (timeSlot ? timeSlot.startTime : '10:00');
      if (!timeSlot && safeApptDateTime) {
        const startOfDay = new Date(safeApptDateTime.getTime());
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(safeApptDateTime.getTime());
        endOfDay.setUTCHours(23, 59, 59, 999);

        timeSlot = await tx.timeSlot.findFirst({
          where: {
            date: { gte: startOfDay, lte: endOfDay },
            startTime: slotStartStr,
            isActive: true,
            slotStatus: 'AVAILABLE',
            ...(country?.id ? { OR: [{ countryId: country.id }, { countryId: null }] } : {}),
          },
        });
      }

      if (timeSlot) {
        if (['DRAFT', 'BLOCKED', 'CLOSED'].includes(timeSlot.slotStatus)) {
          const err = new Error(`Selected time slot is not available for booking (Status: ${timeSlot.slotStatus})`);
          err.statusCode = 400;
          throw err;
        }
        const remaining = timeSlot.capacity - timeSlot.bookedCount;
        if (remaining < paxCount) {
          const err = new Error(`Selected time slot has insufficient capacity (Available: ${remaining}, Group size: ${paxCount})`);
          err.statusCode = 400;
          throw err;
        }
        const newBookedCount = timeSlot.bookedCount + paxCount;
        timeSlot = await tx.timeSlot.update({
          where: { id: timeSlot.id },
          data: {
            bookedCount: newBookedCount,
            slotStatus: newBookedCount >= timeSlot.capacity ? 'FULL' : 'AVAILABLE',
          },
        });
      } else if (safeApptDateTime) {
        timeSlot = await tx.timeSlot.create({
          data: {
            date: safeApptDateTime,
            startTime: slotStartStr,
            capacity: Math.max(30, paxCount + 10),
            bookedCount: paxCount,
            isActive: true,
            slotStatus: 'AVAILABLE',
            countryId: country?.id || null,
            visaTypeId: resolvedVisaType?.id || null,
            visaPurposeId: resolvedVisaPurpose?.id || null,
            location: defaultLocation,
          },
        });
      }

      if (timeSlot) {
        const bookingCode = await nextBookingCode(tx);
        const resolvedLoc = timeSlot.location || defaultLocation;
        await tx.appointment.create({
          data: {
            bookingCode,
            timeSlotId: timeSlot.id,
            providerId: timeSlot.providerId || null,
            visaTypeId: timeSlot.visaTypeId || resolvedVisaType?.id || null,
            userId,
            dossierId: dossier.id,
            groupBatchId: group.id,
            groupSize: paxCount,
            status: 'PENDING_PAYMENT',
            location: resolvedLoc,
            notes: `Group Batch: ${group.name} (${code}) - ${paxCount} Pax`,
          },
        });

        await tx.dossier.update({
          where: { id: dossier.id },
          data: {
            appointmentDate: timeSlot.date || safeApptDateTime,
            appointmentLocation: resolvedLoc,
          },
        });
      }
    }

    // Create Pending Commission entry immediately so Agent sees exact Pending Clearing balance
    await syncGroupFinancialsInTx(group.id, userId, tx);

    if (String(paymentMethod || '').toUpperCase() === 'WALLET') {
      const wallet = await walletService.getOrCreateWallet(userId, tx);
      const summary = await walletService.recalculateWalletBalances(wallet.id, tx);
      const totalDueEur = Number(fees.grandTotalEur || fees.totalAmount || 0);
      if (totalDueEur > 0) {
        if (summary.balance + 0.005 < totalDueEur) {
          const err = new Error(
            `Insufficient Agency Wallet balance. Available: €${summary.balance.toFixed(2)}, Required: €${totalDueEur.toFixed(2)}.`
          );
          err.statusCode = 400;
          throw err;
        }
        const ref = `WLT-${group.code}-${Date.now().toString().slice(-5)}`;
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: -totalDueEur,
            type: 'DEBIT',
            referenceType: 'VISA_PAYMENT',
            referenceId: group.code,
            description: `Tour Group Visa Fees: ${group.name} (${group.code})`,
            status: 'PAID',
          },
        });

        await walletService.settleGroupBatchInTx(tx, {
          groupBatchId: group.id,
          payerUserId: userId,
          paymentProvider: 'WALLET',
          referenceCode: ref,
          explicitAmountEur: totalDueEur,
        });

        await walletService.recalculateWalletBalances(wallet.id, tx);
      }
    }

    return await tx.groupBatch.findUnique({
      where: { id: group.id },
      include: {
        dossiers: {
          include: {
            applicants: {
              include: { documents: true },
            },
          },
        },
        appointments: {
          include: { timeSlot: true },
        },
      },
    });
  });
}

async function getAgentGroups(userId) {
  const groups = await prisma.groupBatch.findMany({
    where: { userId, portalType: 'GROUP_AGENT' },
    include: {
      dossiers: {
        include: {
          country: true,
          visaType: true,
          visaPurpose: true,
          applicants: {
            include: { documents: true },
          },
        },
      },
      appointments: {
        include: { timeSlot: true, notifications: { orderBy: { sentAt: 'desc' }, take: 5 } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const [user, catalog] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { agentTier: true } }),
    getPricingCatalog(),
  ]);
  const tier = user?.agentTier || 'BRONZE';
  const ratePerPax = getAgentCommissionRate(tier, catalog);

  const results = [];
  for (const g of groups) {
    if (!g.dossiers || g.dossiers.length === 0) {
      await walletService.ensureGroupBatchPrimaryDossierInTx(prisma, g, catalog);
    }

    let allApplicants = [];
    g.dossiers.forEach((d) => {
      if (d.applicants) allApplicants.push(...d.applicants);
    });

    const totalApplicants = allApplicants.length;
    const verifiedApplicants = allApplicants.filter(
      (a) => a.documents.length > 0 && a.documents.every((doc) => doc.status === 'VERIFIED')
    ).length;

    const formProgress = totalApplicants > 0 ? Math.round((verifiedApplicants / totalApplicants) * 100) : 0;

    // Backfill legacy dossiers that had totalAmount = 0
    const primaryDossier = g.dossiers[0] || null;
    let totalAmount = primaryDossier ? Number(primaryDossier.totalAmount || 0) : 0;
    if (primaryDossier && totalAmount <= 0) {
      const pkg = g.packageTier || allApplicants[0]?.formDataJson?.package || 'standard';
      const fees = calculatePortalFees({
        portalType: 'GROUP_AGENT',
        paxCount: Math.max(1, totalApplicants),
        activePackage: pkg,
        catalog,
      });
      totalAmount = fees.grandTotalEur;
      await prisma.dossier.update({
        where: { id: primaryDossier.id },
        data: {
          governmentFee: fees.govFeePerPax,
          serviceFee: fees.serviceFeePerPaxForDossier,
          extraServicesFee: fees.extraServicesTotalForDossier,
          totalAmount: fees.grandTotalEur,
        },
      });
      primaryDossier.totalAmount = fees.grandTotalEur;
      primaryDossier.governmentFee = fees.govFeePerPax;
      primaryDossier.serviceFee = fees.serviceFeePerPaxForDossier;
    }

    results.push({
      ...g,
      totalApplicants,
      verifiedApplicants,
      formProgress,
      totalAmount,
      estimatedCommissionEur: Number((totalApplicants * ratePerPax).toFixed(2)),
      ratePerPax,
      agentTier: tier,
      applicants: allApplicants,
    });
  }

  return results;
}

async function getGroupById(groupId, userId, isStaff = false) {
  const group = await prisma.groupBatch.findUnique({
    where: { id: groupId },
    include: {
      dossiers: {
        include: {
          applicants: {
            include: { documents: true, services: true },
          },
          documents: true,
          services: true,
        },
      },
      appointments: {
        include: { timeSlot: true },
      },
    },
  });

  if (!group) {
    const error = new Error('Group not found');
    error.statusCode = 404;
    throw error;
  }

  if (!isStaff && group.userId !== userId) {
    const error = new Error('Access denied to this group');
    error.statusCode = 403;
    throw error;
  }

  return group;
}

async function submitGroup(groupId, userId) {
  return await prisma.$transaction(async (tx) => {
    const group = await tx.groupBatch.findUnique({
      where: { id: groupId },
      include: {
        dossiers: {
          include: { applicants: true },
        },
      },
    });

    if (!group) {
      const error = new Error('Group not found');
      error.statusCode = 404;
      throw error;
    }

    if (group.userId !== userId) {
      const error = new Error('Access denied');
      error.statusCode = 403;
      throw error;
    }

    const updated = await tx.groupBatch.update({
      where: { id: groupId },
      data: { status: 'PROCESSING' },
    });

    const syncRes = await syncGroupFinancialsInTx(groupId, userId, tx);

    return {
      group: updated,
      commissionAmount: syncRes.commissionAmount,
      commissionCredited: syncRes.isSettled ? syncRes.commissionAmount : 0,
      commissionPending: syncRes.isSettled ? 0 : syncRes.commissionAmount,
      paymentStatus: syncRes.isPaid ? 'PAID' : 'PENDING',
      totalFeeEur: syncRes.fees.grandTotalEur,
      tier: syncRes.tier,
      ratePerPax: syncRes.ratePerPax,
    };
  });
}

async function updateGroup(groupId, userId, data = {}, isStaff = false) {
  const group = await prisma.groupBatch.findFirst({
    where: { id: groupId, ...(isStaff ? {} : { userId }) },
    include: { dossiers: true },
  });
  if (!group) {
    const error = new Error('Group not found or unauthorized');
    error.statusCode = 404;
    throw error;
  }

  // Security: Only staff or payment webhooks can alter paymentStatus directly
  if (isStaff && data.paymentStatus && group.dossiers.length > 0) {
    await prisma.dossier.updateMany({
      where: { groupBatchId: groupId },
      data: { paymentStatus: data.paymentStatus },
    });
  }

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.travelDate !== undefined && data.travelDate) {
    updateData.travelDate = parseSafeDate(data.travelDate, 'Travel Date');
  }
  if (data.destination !== undefined) updateData.destination = data.destination;
  if (data.packageTier !== undefined || data.package !== undefined) {
    updateData.packageTier = String(data.packageTier || data.package || 'standard').toLowerCase();
  }

  const updated = await prisma.groupBatch.update({
    where: { id: groupId },
    data: updateData,
  });

  if (updateData.packageTier) {
    await syncGroupFinancialsInTx(groupId, group.userId, prisma);
  }

  return updated;
}

async function deleteGroup(groupId, userId) {
  const group = await prisma.groupBatch.findFirst({
    where: { id: groupId, userId },
    include: { dossiers: { include: { applicants: true } } },
  });
  if (!group) {
    const error = new Error('Group not found or unauthorized');
    error.statusCode = 404;
    throw error;
  }

  return await prisma.$transaction(async (tx) => {
    await tx.appointment.deleteMany({ where: { groupBatchId: groupId } });

    // Clean up pending commission if group was unpaid/draft
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (wallet) {
      await tx.walletTransaction.deleteMany({
        where: {
          walletId: wallet.id,
          referenceType: 'COMMISSION',
          referenceId: group.code,
          status: 'PENDING',
        },
      });
      await walletService.recalculateWalletBalances(wallet.id, tx);
    }

    for (const d of group.dossiers) {
      for (const app of d.applicants) {
        await tx.applicantDocument.deleteMany({ where: { applicantId: app.id } });
      }
      await tx.applicant.deleteMany({ where: { dossierId: d.id } });
      await tx.applicantDocument.deleteMany({ where: { dossierId: d.id } });
      await tx.additionalService.deleteMany({ where: { dossierId: d.id } });
      await tx.dossierStatusHistory.deleteMany({ where: { dossierId: d.id } });
      await tx.transaction.deleteMany({ where: { dossierId: d.id, status: 'PENDING' } });
      await tx.dossier.delete({ where: { id: d.id } });
    }

    return tx.groupBatch.delete({ where: { id: groupId } });
  });
}

module.exports = {
  generateGroupCode,
  parseAppointmentDateTime,
  syncGroupFinancialsInTx,
  createGroup,
  getAgentGroups,
  getGroupById,
  submitGroup,
  updateGroup,
  deleteGroup,
};
