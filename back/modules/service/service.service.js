const prisma = require('../../config/db');
const { SERVICE_PRICES } = require('../../config/constants');

async function addServiceToDossier(dossierId, serviceType, metadataJson = {}) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: { services: true, applicants: true },
  });

  if (!dossier) {
    throw new Error('Dossier not found');
  }

  const price = SERVICE_PRICES[serviceType] || 30.0;

  const newService = await prisma.additionalService.create({
    data: {
      dossierId,
      serviceType,
      price,
      metadataJson,
    },
  });

  const allServices = await prisma.additionalService.findMany({
    where: { dossierId },
  });

  const totalExtraFee = allServices.reduce((sum, s) => sum + s.price, 0.0);
  const passengerMultiplier = dossier.portalType === 'GROUP_AGENT' ? Math.max(1, dossier.applicants.length) : 1;

  const baseTotal = (dossier.governmentFee + dossier.serviceFee) * passengerMultiplier;
  const updatedTotal = baseTotal + totalExtraFee;

  await prisma.dossier.update({
    where: { id: dossierId },
    data: {
      extraServicesFee: totalExtraFee,
      totalAmount: updatedTotal,
      currentStep: 6,
    },
  });

  return newService;
}

async function removeServiceFromDossier(serviceId) {
  const service = await prisma.additionalService.findUnique({ where: { id: serviceId } });
  if (!service) {
    throw new Error('Service not found');
  }

  await prisma.additionalService.delete({ where: { id: serviceId } });

  const dossierId = service.dossierId;
  const allServices = await prisma.additionalService.findMany({ where: { dossierId } });

  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: { applicants: true },
  });

  const totalExtraFee = allServices.reduce((sum, s) => sum + s.price, 0.0);
  const passengerMultiplier = dossier.portalType === 'GROUP_AGENT' ? Math.max(1, dossier.applicants.length) : 1;

  const baseTotal = (dossier.governmentFee + dossier.serviceFee) * passengerMultiplier;
  const updatedTotal = baseTotal + totalExtraFee;

  await prisma.dossier.update({
    where: { id: dossierId },
    data: {
      extraServicesFee: totalExtraFee,
      totalAmount: updatedTotal,
    },
  });

  return { message: 'Service removed successfully' };
}

module.exports = {
  addServiceToDossier,
  removeServiceFromDossier,
};
