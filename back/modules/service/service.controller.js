const serviceService = require('./service.service');
const ApiResponse = require('../../core/api.response');

async function getServiceCatalog(req, res) {
  try {
    const catalog = await serviceService.getServiceCatalog();
    return ApiResponse.success(res, { catalog }, 'Service catalog retrieved successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function addService(req, res) {
  try {
    const { dossierId, applicantId, serviceType, metadataJson } = req.body;
    const service = await serviceService.addServiceToDossier({
      dossierId,
      applicantId,
      serviceType,
      metadataJson,
      user: req.user,
    });

    return ApiResponse.success(res, { service }, 'Service added successfully', 201);
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function checkoutServices(req, res) {
  try {
    const { dossierId, items, paymentMethod } = req.body;
    const result = await serviceService.checkoutServices({
      dossierId,
      user: req.user,
      items,
      paymentMethod: paymentMethod || null,
    });

    return ApiResponse.success(res, result, result.message || 'Services staged for payment', 201);
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function removeService(req, res) {
  try {
    const { serviceId } = req.params;
    const result = await serviceService.removeServiceFromDossier(serviceId, req.user);

    return ApiResponse.success(res, result, 'Service removed successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

module.exports = {
  getServiceCatalog,
  addService,
  checkoutServices,
  removeService,
};
