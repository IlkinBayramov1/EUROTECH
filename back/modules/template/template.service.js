const prisma = require('../../config/db');
const cacheService = require('../../services/cache.service');
const { bootstrapSystemData } = require('../../core/bootstrap.service');

async function getActiveCountries() {
  return cacheService.getOrSet(
    'templates:countries:active',
    async () => {
      let countries = await prisma.country.findMany({
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

      if (!countries || countries.length === 0) {
        await bootstrapSystemData(prisma);
        countries = await prisma.country.findMany({
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

      return countries;
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
        include: {
          requiredDocTypes: true,
          dynamicFields: true,
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
