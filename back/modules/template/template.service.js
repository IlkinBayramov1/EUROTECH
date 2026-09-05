const prisma = require('../../config/db');

async function getActiveCountries() {
  return prisma.country.findMany({
    where: { isActive: true },
    select: {
      id: true,
      code: true,
      nameAz: true,
      nameEn: true,
      nameRu: true,
      flagUrl: true,
    },
  });
}

async function getVisaCategoriesByCountry(countryId) {
  return prisma.visaCategory.findMany({
    where: { countryId },
    select: {
      id: true,
      code: true,
      nameAz: true,
      nameEn: true,
      nameRu: true,
      baseFee: true,
      descriptionAz: true,
      descriptionEn: true,
      descriptionRu: true,
    },
  });
}

async function getWizardSchema(visaCategoryId) {
  const visaCategory = await prisma.visaCategory.findUnique({
    where: { id: visaCategoryId },
    include: {
      dynamicFields: true,
      requiredDocTypes: true,
    },
  });

  if (!visaCategory) {
    throw new Error('Visa category not found');
  }

  return visaCategory;
}

module.exports = {
  getActiveCountries,
  getVisaCategoriesByCountry,
  getWizardSchema,
};
