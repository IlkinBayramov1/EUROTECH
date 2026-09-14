const corporateService = require('./corporate.service');
const ApiResponse = require('../../core/api.response');

async function createBatch(req, res, next) {
  try {
    const batch = await corporateService.createBatch({
      userId: req.user.id,
      ...req.body,
    });
    return ApiResponse.success(res, { batch }, 'Corporate employee batch created successfully', 201);
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function getBatches(req, res, next) {
  try {
    const batches = await corporateService.getCorporateBatches(req.user.id);
    return ApiResponse.success(res, { batches }, 'Corporate batches retrieved successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function generateDelegationLink(req, res, next) {
  try {
    const { employeeId } = req.params;
    const { batchId } = req.body;
    const result = await corporateService.generateDelegationLink({
      corporateUserId: req.user.id,
      employeeId,
      batchId,
    });
    return ApiResponse.success(res, result, 'Delegation link generated successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function getDelegationProfile(req, res, next) {
  try {
    const { token } = req.query;
    const profile = await corporateService.getDelegationProfile(token);
    return ApiResponse.success(res, { profile }, 'Delegation profile retrieved');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function getEmployees(req, res, next) {
  try {
    const { search } = req.query;
    const employees = await corporateService.getEmployeeDirectory(req.user.id, search);
    return ApiResponse.success(res, { employees }, 'Employee directory retrieved successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function addEmployee(req, res, next) {
  try {
    const employee = await corporateService.addEmployeeToDirectory({
      corporateUserId: req.user.id,
      ...req.body,
    });
    return ApiResponse.success(res, { employee }, 'Employee added to directory', 201);
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function generateInvoice(req, res, next) {
  try {
    const { batchId } = req.params;
    const { amount } = req.body;
    const result = await corporateService.generateProformaInvoice({
      batchId,
      corporateUserId: req.user.id,
      amount,
    });
    return ApiResponse.success(res, result, 'Proforma invoice generated successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function payWithWallet(req, res, next) {
  try {
    const { batchId } = req.params;
    const { amount } = req.body;
    const result = await corporateService.payBatchWithWallet({
      batchId,
      corporateUserId: req.user.id,
      amount,
    });
    return ApiResponse.success(res, result, 'Batch paid from corporate wallet successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function getInvoices(req, res, next) {
  try {
    const invoices = await corporateService.getCorporateInvoices(req.user.id);
    return ApiResponse.success(res, { invoices }, 'Corporate invoices retrieved successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

module.exports = {
  createBatch,
  getBatches,
  generateDelegationLink,
  getDelegationProfile,
  getEmployees,
  addEmployee,
  generateInvoice,
  payWithWallet,
  getInvoices,
};
