const templateService = require('./template.service');
const ApiResponse = require('../../core/api.response');

async function getCountries(req, res, next) {
  try {
    const countries = await templateService.getActiveCountries();
    return ApiResponse.success(res, { countries });
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function getVisaCategories(req, res, next) {
  try {
    const { countryId } = req.params;
    const visaCategories = await templateService.getVisaCategoriesByCountry(countryId);
    return ApiResponse.success(res, { visaCategories });
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function getWizardSchema(req, res, next) {
  try {
    const { visaCategoryId } = req.params;
    const schema = await templateService.getWizardSchema(visaCategoryId);
    return ApiResponse.success(res, { schema });
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

module.exports = {
  getCountries,
  getVisaCategories,
  getWizardSchema,
};
