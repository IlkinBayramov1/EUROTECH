const prisma = require('../../../config/db');

async function getCorporateDepartments(corporateUserId) {
  let departments = await prisma.corporateDepartment.findMany({
    where: { corporateUserId },
    orderBy: { createdAt: 'asc' },
  });

  if (departments.length === 0) {
    const defaults = [
      { name: 'Engineering & Technology', annualBudget: 60000.0, spentBudget: 14500.0 },
      { name: 'Executive & Board', annualBudget: 85000.0, spentBudget: 22300.0 },
      { name: 'Commercial & Global Sales', annualBudget: 45000.0, spentBudget: 8750.0 },
      { name: 'Operations & Legal', annualBudget: 30000.0, spentBudget: 3200.0 },
    ];

    for (const d of defaults) {
      await prisma.corporateDepartment.create({
        data: {
          corporateUserId,
          name: d.name,
          annualBudget: d.annualBudget,
          spentBudget: d.spentBudget,
          currency: 'EUR',
        },
      });
    }

    departments = await prisma.corporateDepartment.findMany({
      where: { corporateUserId },
      orderBy: { createdAt: 'asc' },
    });
  }

  const employees = await prisma.corporateEmployee.findMany({
    where: { corporateUserId },
    select: { department: true },
  });

  return departments.map((dept) => {
    const empCount = employees.filter(
      (e) => e.department && e.department.toLowerCase() === dept.name.toLowerCase()
    ).length;
    const remaining = Math.max(0, dept.annualBudget - dept.spentBudget);
    const percentUsed = dept.annualBudget > 0 ? Math.min(100, Math.round((dept.spentBudget / dept.annualBudget) * 100)) : 0;

    return {
      ...dept,
      employeeCount: empCount,
      remainingBudget: remaining,
      percentUsed,
    };
  });
}

async function createCorporateDepartment(corporateUserId, { name, annualBudget, currency = 'EUR' }) {
  if (!name || !name.trim()) {
    const error = new Error('Department name is required');
    error.statusCode = 400;
    throw error;
  }

  const budget = Number(annualBudget) || 50000.0;

  return prisma.corporateDepartment.create({
    data: {
      corporateUserId,
      name: name.trim(),
      annualBudget: budget,
      spentBudget: 0.0,
      currency: currency || 'EUR',
    },
  });
}

async function updateCorporateDepartment(corporateUserId, departmentId, data) {
  const dept = await prisma.corporateDepartment.findFirst({
    where: { id: departmentId, corporateUserId },
  });

  if (!dept) {
    const error = new Error('Department not found or unauthorized');
    error.statusCode = 404;
    throw error;
  }

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.annualBudget !== undefined) updateData.annualBudget = Number(data.annualBudget);
  if (data.spentBudget !== undefined) updateData.spentBudget = Number(data.spentBudget);
  if (data.currency !== undefined) updateData.currency = data.currency;

  return prisma.corporateDepartment.update({
    where: { id: departmentId },
    data: updateData,
  });
}

async function deleteCorporateDepartment(corporateUserId, departmentId) {
  const dept = await prisma.corporateDepartment.findFirst({
    where: { id: departmentId, corporateUserId },
  });

  if (!dept) {
    const error = new Error('Department not found or unauthorized');
    error.statusCode = 404;
    throw error;
  }

  return prisma.corporateDepartment.delete({
    where: { id: departmentId },
  });
}

module.exports = {
  getCorporateDepartments,
  createCorporateDepartment,
  updateCorporateDepartment,
  deleteCorporateDepartment,
};
