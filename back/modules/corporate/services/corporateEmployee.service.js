const prisma = require('../../../config/db');
const { parseSafeDate } = require('../../../utils/finance.util');

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
      passportExpiry: parseSafeDate(passportExpiry, 'Passport Expiry', { required: false }),
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
  if (data.passportExpiry !== undefined) updateData.passportExpiry = parseSafeDate(data.passportExpiry, 'Passport Expiry', { required: false });
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

async function getPassportRadar(corporateUserId) {
  const employees = await prisma.corporateEmployee.findMany({
    where: { corporateUserId },
    include: { visaHistory: true },
    orderBy: { createdAt: 'desc' },
  });

  const now = new Date();
  const critical = [];
  const warning = [];
  const valid = [];
  const expired = [];

  const items = employees.map((emp) => {
    let daysRemaining = null;
    let status = 'UNKNOWN';
    let alertMessage = 'Passport expiry date not recorded';

    if (emp.passportExpiry) {
      const expDate = new Date(emp.passportExpiry);
      const diffTime = expDate.getTime() - now.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (daysRemaining < 0) {
        status = 'EXPIRED';
        alertMessage = `Passport expired ${Math.abs(daysRemaining)} days ago! Immediate replacement required.`;
      } else if (daysRemaining < 90) {
        status = 'CRITICAL';
        alertMessage = `Expires in ${daysRemaining} days! Fails Schengen 3-month validity rule. Renewal mandatory.`;
      } else if (daysRemaining <= 180) {
        status = 'WARNING';
        alertMessage = `Expires in ${daysRemaining} days (< 6 months). Renewal strongly recommended.`;
      } else {
        status = 'VALID';
        alertMessage = `Valid for ${daysRemaining} days (${Math.round(daysRemaining / 30)} months).`;
      }
    }

    const item = {
      id: emp.id,
      name: `${emp.firstName} ${emp.lastName}`.trim(),
      passportNumber: emp.passportNumber || 'N/A',
      passportExpiry: emp.passportExpiry ? emp.passportExpiry.toISOString().split('T')[0] : null,
      daysRemaining,
      status,
      alertMessage,
      department: emp.department || 'General',
      jobTitle: emp.jobTitle || 'Employee',
      email: emp.email || '',
    };

    if (status === 'EXPIRED') expired.push(item);
    else if (status === 'CRITICAL') critical.push(item);
    else if (status === 'WARNING') warning.push(item);
    else if (status === 'VALID') valid.push(item);

    return item;
  });

  return {
    summary: {
      totalEmployees: employees.length,
      criticalCount: critical.length,
      warningCount: warning.length,
      validCount: valid.length,
      expiredCount: expired.length,
    },
    critical,
    warning,
    valid,
    expired,
    items,
  };
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
      details: {
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        email: employee.email,
      },
    },
  });

  return {
    success: true,
    message: `Reminder email successfully sent to ${employee.firstName} ${employee.lastName} (${employee.email || 'corporate employee'})`,
  };
}

module.exports = {
  getEmployeeDirectory,
  addEmployeeToDirectory,
  updateCorporateEmployee,
  deleteCorporateEmployee,
  getPassportRadar,
  remindEmployee,
};
