const prisma = require('../../config/db');
const cacheService = require('../../services/cache.service');

async function getActiveCountries() {
  return cacheService.getOrSet(
    'templates:countries:active',
    async () => {
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
    },
    3600 // 1 hour TTL
  );
}

async function getVisaCategoriesByCountry(countryId) {
  return cacheService.getOrSet(
    `templates:visa_categories:${countryId}`,
    async () => {
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
    },
    3600 // 1 hour TTL
  );
}

async function getWizardSchema(visaCategoryId) {
  return cacheService.getOrSet(
    `templates:wizard_schema:${visaCategoryId}`,
    async () => {
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
    },
    3600 // 1 hour TTL
  );
}

module.exports = {
  getActiveCountries,
  getVisaCategoriesByCountry,
  getWizardSchema,
};
