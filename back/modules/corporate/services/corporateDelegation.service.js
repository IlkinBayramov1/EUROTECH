const prisma = require('../../../config/db');
const { generateSecureToken, hashToken } = require('../../../utils/token.util');

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

      const expiryFromApp = applicant.formDataJson?.passportExpiry || applicant.formDataJson?.passportExpiryDate || applicant.formDataJson?.expiryDate;
      const parsedExpiry = expiryFromApp && !isNaN(new Date(expiryFromApp).getTime()) ? new Date(expiryFromApp) : null;
      const phoneFromApp = applicant.formDataJson?.phone || applicant.formDataJson?.homePhone || applicant.formDataJson?.contactPhone || null;

      if (!employee) {
        const rawTok = generateSecureToken();
        employee = await prisma.corporateEmployee.create({
          data: {
            corporateUserId,
            firstName: applicant.firstName,
            lastName: applicant.lastName,
            passportNumber: applicant.passportNumber,
            passportExpiry: parsedExpiry,
            phone: phoneFromApp,
            jobTitle: applicant.formDataJson?.jobTitle || 'Employee',
            department: applicant.formDataJson?.department || 'General',
            nationality: applicant.nationality || 'AZ',
            delegationTokenHash: hashToken(rawTok),
            delegationExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
          },
        });
      } else if (!employee.passportExpiry && parsedExpiry) {
        await prisma.corporateEmployee.update({
          where: { id: employee.id },
          data: {
            passportExpiry: parsedExpiry,
            phone: employee.phone || phoneFromApp,
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

  // Find corresponding applicant in company's dossiers to retrieve full consular data (birthDate, etc.)
  const applicant = await prisma.applicant.findFirst({
    where: {
      dossier: { groupBatch: { userId: employee.corporateUserId } },
      OR: [
        { passportNumber: employee.passportNumber },
        {
          AND: [
            { firstName: employee.firstName },
            { lastName: employee.lastName },
          ],
        },
      ],
    },
    include: {
      dossier: {
        include: {
          groupBatch: true,
          country: true,
        },
      },
    },
    orderBy: { id: 'desc' },
  });

  const appForm = applicant?.formDataJson && typeof applicant.formDataJson === 'object' ? applicant.formDataJson : {};

  let birthDate = '';
  if (applicant?.birthDate && !isNaN(new Date(applicant.birthDate).getTime())) {
    birthDate = new Date(applicant.birthDate).toISOString().split('T')[0];
  } else if (appForm.birthDate || appForm.dob) {
    birthDate = String(appForm.birthDate || appForm.dob).split('T')[0];
  }

  let passportExpiry = '';
  if (employee.passportExpiry && !isNaN(new Date(employee.passportExpiry).getTime())) {
    passportExpiry = new Date(employee.passportExpiry).toISOString().split('T')[0];
  } else {
    const exp = appForm.passportExpiry || appForm.passportExpiryDate || appForm.expiryDate;
    if (exp) passportExpiry = String(exp).split('T')[0];
  }

  const phone = employee.phone || appForm.homePhone || appForm.phone || appForm.contactPhone || '';

  return {
    id: employee.id,
    applicantId: applicant?.id || null,
    dossierId: applicant?.dossierId || null,
    batchId: applicant?.dossier?.groupBatchId || null,
    batchName: applicant?.dossier?.groupBatch?.name || '',
    firstName: employee.firstName || applicant?.firstName || '',
    lastName: employee.lastName || applicant?.lastName || '',
    jobTitle: employee.jobTitle || appForm.jobTitle || 'Specialist',
    department: employee.department || appForm.department || 'General',
    nationality: employee.nationality || applicant?.nationality || 'AZ',
    passportNumber: employee.passportNumber || applicant?.passportNumber || '',
    passportExpiry,
    dob: birthDate,
    birthDate,
    phone,
    email: employee.email || appForm.homeEmail || appForm.email || '',
    companyName: employee.corporateUser?.companyName || employee.corporateUser?.fullName || 'Corporate Employer',
    destination: applicant?.dossier?.country?.nameEn || applicant?.dossier?.groupBatch?.destination || 'Europe / Schengen',
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

  const parsedExpiry = passportExpiry && !isNaN(new Date(passportExpiry).getTime())
    ? new Date(passportExpiry)
    : employee.passportExpiry;

  const targetPassport = (passportNumber || employee.passportNumber || '').trim().toUpperCase();
  const cleanDobStr = dob ? String(dob).split('T')[0] : '';
  const cleanExpiryStr = passportExpiry ? String(passportExpiry).split('T')[0] : '';
  const cleanPhoneStr = phone ? String(phone).trim() : (employee.phone || '');

  const updatedEmployee = await prisma.corporateEmployee.update({
    where: { id: employee.id },
    data: {
      passportNumber: targetPassport || employee.passportNumber,
      passportExpiry: parsedExpiry,
      phone: cleanPhoneStr || employee.phone,
    },
  });

  const parsedDob = dob && !isNaN(new Date(dob).getTime()) ? new Date(dob) : null;

  if (targetPassport) {
    const applicants = await prisma.applicant.findMany({
      where: {
        dossier: {
          groupBatch: {
            userId: employee.corporateUserId,
          },
        },
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
      const currentForm = (app.formDataJson && typeof app.formDataJson === 'object') ? app.formDataJson : {};
      await prisma.applicant.update({
        where: { id: app.id },
        data: {
          passportNumber: targetPassport,
          birthDate: parsedDob || app.birthDate,
          formDataJson: {
            ...currentForm,
            // Synchronize all field aliases so every module & form step finds its key:
            dob: cleanDobStr || currentForm.dob,
            birthDate: cleanDobStr || currentForm.birthDate,
            passportExpiry: cleanExpiryStr || currentForm.passportExpiry,
            passportExpiryDate: cleanExpiryStr || currentForm.passportExpiryDate,
            expiryDate: cleanExpiryStr || currentForm.expiryDate,
            phone: cleanPhoneStr || currentForm.phone,
            homePhone: cleanPhoneStr || currentForm.homePhone,
            contactPhone: cleanPhoneStr || currentForm.contactPhone,
            passportNumber: targetPassport,
            formProgress: 100,
            lastSavedAt: new Date().toISOString(),
          },
        },
      });
    }
  }

  try {
    await prisma.auditLog.create({
      data: {
        userId: employee.corporateUserId,
        action: 'DELEGATION_SUBMITTED',
        details: {
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          passportNumber: targetPassport,
          dob: cleanDobStr,
          passportExpiry: cleanExpiryStr,
          phone: cleanPhoneStr,
          message: `${employee.firstName} ${employee.lastName} completed corporate delegation consular data`,
        },
      },
    });
  } catch (auditErr) {
    console.warn('Audit log creation failed for delegation submit:', auditErr);
  }

  return {
    success: true,
    employeeId: updatedEmployee.id,
    message: 'Information successfully submitted to HR',
  };
}

module.exports = {
  generateDelegationLink,
  getDelegationProfile,
  submitDelegationForm,
};
