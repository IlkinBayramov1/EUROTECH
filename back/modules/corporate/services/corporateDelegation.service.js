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

  const updatedEmployee = await prisma.corporateEmployee.update({
    where: { id: employee.id },
    data: {
      passportNumber: passportNumber || employee.passportNumber,
      passportExpiry: parsedExpiry,
      phone: phone || employee.phone,
    },
  });

  const parsedDob = dob && !isNaN(new Date(dob).getTime()) ? new Date(dob) : null;
  const targetPassport = passportNumber || employee.passportNumber;

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
            phone: phone || currentForm.phone,
            dob: dob || currentForm.dob,
            passportExpiry: passportExpiry || currentForm.passportExpiry,
            formProgress: 100,
          },
        },
      });
    }
  }

  // Token consumption: Invalidate one-time delegation token after successful submission
  await prisma.corporateEmployee.update({
    where: { id: employee.id },
    data: {
      delegationTokenHash: null,
      delegationExpiresAt: null,
    },
  });

  try {
    await prisma.auditLog.create({
      data: {
        userId: employee.corporateUserId,
        action: 'DELEGATION_SUBMITTED',
        details: {
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          passportNumber: targetPassport,
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
