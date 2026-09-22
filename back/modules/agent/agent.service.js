const crypto = require('crypto');
const prisma = require('../../config/db');

function generateGroupCode() {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `GRP-${digits}`;
}

async function createGroup({ userId, name, destination, travelDate, duration, projectReason, applicants, package: pkg, appointmentDate, appointmentTime }) {
  const code = generateGroupCode();
  
  return await prisma.$transaction(async (tx) => {
    const group = await tx.groupBatch.create({
      data: {
        code,
        portalType: 'GROUP_AGENT',
        userId,
        name,
        destination: destination || 'Europe / Schengen',
        travelDate: travelDate ? new Date(travelDate) : null,
        duration: duration || 'short',
        projectReason: projectReason || 'Tourism',
        status: 'DRAFT',
      },
    });

    let country = await tx.country.findFirst({
      where: {
        OR: [
          { nameEn: { contains: destination || 'Hungary' } },
          { nameAz: { contains: destination || 'Macaristan' } },
          { code: 'HU' },
        ],
      },
    });
    if (!country) {
      country = await tx.country.findFirst();
    }
    if (!country) {
      country = await tx.country.create({
        data: { code: 'HU', nameAz: 'Macarıstan', nameEn: 'Hungary', nameRu: 'Vengriya' },
      });
    }

    let category = await tx.visaCategory.findFirst({ where: { countryId: country.id } });
    if (!category) {
      category = await tx.visaCategory.create({
        data: { countryId: country.id, code: 'SCHENGEN_TOURIST', nameAz: 'Şengen Turist', nameEn: 'Schengen Tourist', nameRu: 'Schengen Tourist' },
      });
    }

    const dossier = await tx.dossier.create({
      data: {
        dossierNumber: `GRP-${code}-${Date.now().toString().slice(-4)}`,
        portalType: 'GROUP_AGENT',
        userId,
        groupBatchId: group.id,
        countryId: country.id,
        visaCategoryId: category.id,
        status: 'RECEIVED',
        currentStep: 1,
        appointmentDate: appointmentDate ? new Date(appointmentDate) : null,
        appointmentLocation: 'EuroTech Main Center, Port Baku Towers',
      },
    });

    if (applicants && Array.isArray(applicants) && applicants.length > 0) {
      for (const app of applicants) {
        await tx.applicant.create({
          data: {
            dossierId: dossier.id,
            firstName: app.firstName || app.fullName?.split(' ')[0] || 'Applicant',
            lastName: app.lastName || app.fullName?.split(' ').slice(1).join(' ') || '',
            passportNumber: app.passportNumber || app.passport || 'P0000000',
            birthDate: app.dob ? new Date(app.dob) : null,
            formDataJson: {
              dob: app.dob,
              issueDate: app.issueDate,
              expiryDate: app.expiryDate,
              package: pkg || 'standard',
              ...(app.formDataJson || {}),
            },
          },
        });
      }
    }

    if (appointmentDate) {
      const apptDateTime = new Date(`${appointmentDate}T${appointmentTime || '10:00'}:00.000Z`);
      let timeSlot = await tx.timeSlot.findFirst({
        where: { isActive: true },
      });
      if (!timeSlot) {
        timeSlot = await tx.timeSlot.create({
          data: {
            date: apptDateTime,
            startTime: appointmentTime || '10:00',
            capacity: 20,
            bookedCount: 1,
            isActive: true,
            location: 'EuroTech Main Center, Port Baku Towers',
          },
        });
      }
      await tx.appointment.create({
        data: {
          timeSlotId: timeSlot.id,
          userId,
          dossierId: dossier.id,
          groupBatchId: group.id,
          status: 'CONFIRMED',
          location: 'EuroTech Main Center, Port Baku Towers',
          notes: `Group Batch: ${name} (${code})`,
        },
      });
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
        appointments: true,
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
          applicants: {
            include: { documents: true },
          },
        },
      },
      appointments: {
        include: { timeSlot: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return groups.map((g) => {
    let allApplicants = [];
    g.dossiers.forEach((d) => {
      if (d.applicants) allApplicants.push(...d.applicants);
    });

    const totalApplicants = allApplicants.length;
    const verifiedApplicants = allApplicants.filter((a) =>
      a.documents.length > 0 && a.documents.every((doc) => doc.status === 'VERIFIED')
    ).length;

    const formProgress = totalApplicants > 0 ? Math.round((verifiedApplicants / totalApplicants) * 100) : 0;

    return {
      ...g,
      totalApplicants,
      verifiedApplicants,
      formProgress,
      applicants: allApplicants,
    };
  });
}

async function getAgentAppointments(userId) {
  const appointments = await prisma.appointment.findMany({
    where: {
      OR: [
        { groupBatch: { userId } },
        { userId, groupBatchId: { not: null } },
      ],
      status: { not: 'CANCELLED' },
    },
    include: {
      timeSlot: true,
      groupBatch: {
        include: {
          dossiers: {
            include: {
              applicants: {
                include: { documents: true },
              },
            },
          },
        },
      },
      dossier: {
        include: {
          applicants: {
            include: { documents: true },
          },
        },
      },
    },
    orderBy: [
      { timeSlot: { date: 'asc' } },
      { timeSlot: { startTime: 'asc' } },
    ],
  });

  return appointments.map((appt) => {
    let applicants = [];
    if (appt.groupBatch?.dossiers) {
      appt.groupBatch.dossiers.forEach((d) => {
        if (d.applicants) applicants.push(...d.applicants);
      });
    }
    if (applicants.length === 0 && appt.dossier?.applicants) {
      applicants.push(...appt.dossier.applicants);
    }

    const totalApplicants = applicants.length;
    const verifiedApplicants = applicants.filter((a) =>
      a.documents?.length > 0 && a.documents.every((doc) => doc.status === 'VERIFIED')
    ).length;

    const group = appt.groupBatch;
    return {
      id: appt.id,
      timeSlotId: appt.timeSlotId,
      status: appt.status,
      location: appt.location || appt.timeSlot?.location || 'EuroTech Main Center, Port Baku Towers',
      notes: appt.notes,
      timeSlot: {
        id: appt.timeSlot?.id,
        date: appt.timeSlot?.date,
        startTime: appt.timeSlot?.startTime,
        capacity: appt.timeSlot?.capacity || 10,
        bookedCount: appt.timeSlot?.bookedCount || 0,
        location: appt.timeSlot?.location,
      },
      groupInfo: {
        id: group?.code || 'GROUP',
        dbId: group?.id,
        name: group?.name || 'Group Delegation',
        destination: group?.destination || '',
        package: group?.dossiers?.[0]?.applicants?.[0]?.formDataJson?.package || 'Standard',
        passportStatus: verifiedApplicants === totalApplicants && totalApplicants > 0 ? 'Documents Ready' : 'Pending Action',
        size: totalApplicants,
        applicants: applicants.map((a) => ({
          id: a.id,
          name: `${a.firstName || ''} ${a.lastName || ''}`.trim() || 'Applicant',
          passport: a.passportNumber || '—',
          docsStatus: a.documents?.length > 0 && a.documents.every((doc) => doc.status === 'VERIFIED') ? 'Verified' : 'Pending',
        })),
      },
    };
  });
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

    // Calculate commission: €20 per passenger
    let totalPassengers = 0;
    group.dossiers.forEach((d) => {
      totalPassengers += (d.applicants ? d.applicants.length : 0);
    });
    if (totalPassengers === 0) totalPassengers = 1; // Minimum base

    const commissionAmount = totalPassengers * 20.0;

    // Get or create wallet
    let wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await tx.wallet.create({
        data: { userId, balance: 0.0, pendingBalance: 0.0, currency: 'EUR' },
      });
    }

    // Credit commission
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: commissionAmount } },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: commissionAmount,
        type: 'CREDIT',
        referenceType: 'COMMISSION',
        referenceId: group.code,
        description: `Commission: ${group.name} (${totalPassengers} Applicants)`,
        status: 'PAID',
      },
    });

    return {
      group: updated,
      commissionCredited: commissionAmount,
    };
  });
}

async function getAgentWallet(userId) {
  let wallet = await prisma.wallet.findUnique({
    where: { userId },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      payoutRequests: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { userId, balance: 0.0, pendingBalance: 0.0, currency: 'EUR' },
      include: {
        transactions: true,
        payoutRequests: true,
      },
    });
  }

  // Calculate real YTD earned from database CREDIT transactions
  const creditAgg = await prisma.walletTransaction.aggregate({
    _sum: { amount: true },
    where: { walletId: wallet.id, type: 'CREDIT' },
  });

  const totalEarnedYtd = creditAgg._sum.amount || 0.0;

  return {
    ...wallet,
    totalEarnedYtd,
  };
}

async function requestPayout({ userId, amount, bankName, iban, swiftBic }) {
  const payoutAmount = Number(amount);
  if (!payoutAmount || payoutAmount <= 0) {
    const error = new Error('Invalid payout amount');
    error.statusCode = 400;
    throw error;
  }

  return await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.balance < payoutAmount) {
      const error = new Error('Insufficient wallet balance for this payout');
      error.statusCode = 400;
      throw error;
    }

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: payoutAmount } },
    });

    const payout = await tx.payoutRequest.create({
      data: {
        walletId: wallet.id,
        amount: payoutAmount,
        bankName,
        iban,
        swiftBic: swiftBic || 'N/A',
        status: 'PENDING',
      },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: -payoutAmount,
        type: 'DEBIT',
        referenceType: 'PAYOUT',
        referenceId: payout.id,
        description: `Payout to ${bankName} (${iban.slice(-4)})`,
        status: 'PENDING',
      },
    });

    return payout;
  });
}

async function exportTransactionsCsv(userId) {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const rows = ['Transaction ID,Date,Reference,Description,Amount,Status'];
  if (wallet && wallet.transactions) {
    wallet.transactions.forEach((tx) => {
      const dateStr = new Date(tx.createdAt).toISOString().split('T')[0];
      rows.push(`"${tx.id}","${dateStr}","${tx.referenceId || ''}","${tx.description.replace(/"/g, '""')}","${tx.amount}","${tx.status}"`);
    });
  }

  return rows.join('\n');
}

async function saveBankDetails(userId, { bankName, iban, swiftBic, accountHolder }) {
  let wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: {
        userId,
        balance: 0.0,
        pendingBalance: 0.0,
        currency: 'EUR',
        bankName,
        iban,
        swiftBic,
        accountHolder,
      },
    });
  } else {
    wallet = await prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        bankName,
        iban,
        swiftBic,
        accountHolder,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'UPDATE_BANK_DETAILS',
      details: { bankName, iban: iban ? `***${iban.slice(-4)}` : '', swiftBic, accountHolder },
    },
  });

  return {
    success: true,
    bankName: wallet.bankName,
    iban: wallet.iban,
    swiftBic: wallet.swiftBic,
    accountHolder: wallet.accountHolder,
  };
}

async function addApplicantToGroup(groupId, userId, applicantData) {
  const group = await prisma.groupBatch.findFirst({
    where: { id: groupId, userId },
    include: { dossiers: true },
  });

  if (!group) {
    const error = new Error('Group not found or unauthorized');
    error.statusCode = 404;
    throw error;
  }

  let dossier = group.dossiers[0];
  if (!dossier) {
    let country = await prisma.country.findFirst();
    if (!country) {
      country = await prisma.country.create({
        data: { code: 'HU', nameAz: 'Macaristan', nameEn: 'Hungary', nameRu: 'Vengriya' },
      });
    }
    let category = await prisma.visaCategory.findFirst({ where: { countryId: country.id } });
    if (!category) {
      category = await prisma.visaCategory.create({
        data: { countryId: country.id, code: 'SCHENGEN_TOURIST', nameAz: 'Sengen Turist', nameEn: 'Schengen Tourist', nameRu: 'Sengen Turist' },
      });
    }

    dossier = await prisma.dossier.create({
      data: {
        dossierNumber: `GRP-${group.code}-${Date.now().toString().slice(-4)}`,
        portalType: 'GROUP_AGENT',
        userId,
        groupBatchId: group.id,
        countryId: country.id,
        visaCategoryId: category.id,
      },
    });
  }

  const applicant = await prisma.applicant.create({
    data: {
      dossierId: dossier.id,
      firstName: applicantData.firstName || applicantData.name?.split(' ')[0] || 'Applicant',
      lastName: applicantData.lastName || applicantData.name?.split(' ').slice(1).join(' ') || '',
      passportNumber: applicantData.passportNumber || applicantData.passport || 'P0000000',
      formDataJson: applicantData.formData || null,
    },
  });

  return applicant;
}

async function removeApplicantFromGroup(groupId, applicantId, userId) {
  const group = await prisma.groupBatch.findFirst({
    where: { id: groupId, userId },
    include: { dossiers: { include: { applicants: true } } },
  });

  if (!group) {
    const error = new Error('Group not found');
    error.statusCode = 404;
    throw error;
  }

  const belongs = group.dossiers.some((d) => d.applicants.some((a) => a.id === applicantId));
  if (!belongs) {
    const error = new Error('Applicant does not belong to this group');
    error.statusCode = 404;
    throw error;
  }

  return prisma.applicant.delete({
    where: { id: applicantId },
  });
}

async function saveApplicantFormInGroup(groupId, applicantId, formData, userId) {
  const group = await prisma.groupBatch.findFirst({
    where: { id: groupId, userId },
    include: { dossiers: { include: { applicants: true } } },
  });

  if (!group) {
    const error = new Error('Group not found');
    error.statusCode = 404;
    throw error;
  }

  const targetApplicant = group.dossiers
    .flatMap((d) => d.applicants)
    .find((a) => a.id === applicantId);

  if (!targetApplicant) {
    const error = new Error('Applicant not found in this group');
    error.statusCode = 404;
    throw error;
  }

  const existingForm = targetApplicant.formDataJson && typeof targetApplicant.formDataJson === 'object'
    ? targetApplicant.formDataJson
    : {};

  return prisma.applicant.update({
    where: { id: applicantId },
    data: {
      formDataJson: {
        ...existingForm,
        ...formData,
        lastSavedAt: new Date().toISOString(),
      },
    },
  });
}

async function updateGroup(groupId, userId, { name }) {
  const group = await prisma.groupBatch.findFirst({
    where: { id: groupId, userId },
  });
  if (!group) {
    const error = new Error('Group not found or unauthorized');
    error.statusCode = 404;
    throw error;
  }
  return prisma.groupBatch.update({
    where: { id: groupId },
    data: {
      name: name !== undefined ? name : group.name,
    },
  });
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

    for (const d of group.dossiers) {
      for (const app of d.applicants) {
        await tx.applicantDocument.deleteMany({ where: { applicantId: app.id } });
      }
      await tx.applicant.deleteMany({ where: { dossierId: d.id } });
      await tx.applicantDocument.deleteMany({ where: { dossierId: d.id } });
      await tx.additionalService.deleteMany({ where: { dossierId: d.id } });
      await tx.dossierStatusHistory.deleteMany({ where: { dossierId: d.id } });
      await tx.dossier.delete({ where: { id: d.id } });
    }

    return tx.groupBatch.delete({ where: { id: groupId } });
  });
}

module.exports = {
  createGroup,
  getAgentGroups,
  getAgentAppointments,
  getGroupById,
  updateGroup,
  deleteGroup,
  submitGroup,
  getAgentWallet,
  requestPayout,
  exportTransactionsCsv,
  saveBankDetails,
  addApplicantToGroup,
  removeApplicantFromGroup,
  saveApplicantFormInGroup,
};


