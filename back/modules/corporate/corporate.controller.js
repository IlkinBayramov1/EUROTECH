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

async function remindEmployee(req, res, next) {
  try {
    const result = await corporateService.remindEmployee(req.user.id, req.params.employeeId);
    return ApiResponse.success(res, result, result.message);
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function topupWallet(req, res, next) {
  try {
    const { amount } = req.body;
    const result = await corporateService.topupCorporateWallet(req.user.id, amount);
    return ApiResponse.success(res, result, 'Corporate wallet balance topped up successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function submitBatch(req, res, next) {
  try {
    const result = await corporateService.submitBatch(req.user.id, req.params.batchId);
    return ApiResponse.success(res, result, 'Batch submitted for processing successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function saveEmployeeForm(req, res, next) {
  try {
    const result = await corporateService.saveEmployeeFormInBatch(
      req.user.id,
      req.params.batchId,
      req.params.employeeId,
      req.body.formData || req.body
    );
    return ApiResponse.success(res, result, 'Employee application form saved successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function getInvoicePdf(req, res, next) {
  try {
    const result = await corporateService.getInvoicePdf(req.user.id, req.params.invoiceId);
    return ApiResponse.success(res, result, 'Invoice PDF retrieved successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function updateBatch(req, res, next) {
  try {
    const result = await corporateService.updateCorporateBatch(req.user.id, req.params.batchId, req.body);
    return ApiResponse.success(res, result, 'Batch updated successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function deleteBatch(req, res, next) {
  try {
    const result = await corporateService.deleteCorporateBatch(req.user.id, req.params.batchId);
    return ApiResponse.success(res, result, 'Batch deleted successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function updateEmployee(req, res, next) {
  try {
    const employee = await corporateService.updateCorporateEmployee({
      corporateUserId: req.user.id,
      employeeId: req.params.employeeId,
      data: req.body,
    });
    return ApiResponse.success(res, { employee }, 'Employee updated successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function deleteEmployee(req, res, next) {
  try {
    const result = await corporateService.deleteCorporateEmployee({
      corporateUserId: req.user.id,
      employeeId: req.params.employeeId,
    });
    return ApiResponse.success(res, result, 'Employee deleted from directory successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function getWallet(req, res, next) {
  try {
    const wallet = await corporateService.getCorporateWallet(req.user.id);
    return ApiResponse.success(res, { wallet }, 'Corporate wallet retrieved successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function getDashboardStats(req, res, next) {
  try {
    const data = await corporateService.getCorporateDashboardStats(req.user.id);
    return ApiResponse.success(res, data, 'Corporate dashboard statistics retrieved successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function submitDelegationForm(req, res, next) {
  try {
    const { token, passportNumber, dob, passportExpiry, phone } = req.body;
    const result = await corporateService.submitDelegationForm({
      token,
      passportNumber,
      dob,
      passportExpiry,
      phone,
    });
    return ApiResponse.success(res, result, 'Employee delegation form submitted successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

module.exports = {
  createBatch,
  getBatches,
  updateBatch,
  deleteBatch,
  generateDelegationLink,
  getDelegationProfile,
  submitDelegationForm,
  getEmployees,
  addEmployee,
  updateEmployee,
  deleteEmployee,
  generateInvoice,
  payWithWallet,
  getInvoices,
  remindEmployee,
  topupWallet,
  getWallet,
  getDashboardStats,
  submitBatch,
  saveEmployeeForm,
  getInvoicePdf,
};

