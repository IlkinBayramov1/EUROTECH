const serviceService = require('./service.service');
const ApiResponse = require('../../core/api.response');

async function addService(req, res, next) {
  try {
    const { dossierId, serviceType, metadataJson } = req.body;
    const service = await serviceService.addServiceToDossier(dossierId, serviceType, metadataJson);

    return ApiResponse.success(res, { service }, 'Service added successfully', 201);
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function removeService(req, res, next) {
  try {
    const { serviceId } = req.params;
    const result = await serviceService.removeServiceFromDossier(serviceId);

    return ApiResponse.success(res, result, 'Service removed successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

module.exports = {
  addService,
  removeService,
};
