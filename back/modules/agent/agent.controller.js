const agentService = require('./agent.service');
const ApiResponse = require('../../core/api.response');

async function createGroup(req, res, next) {
  try {
    const group = await agentService.createGroup({
      userId: req.user.id,
      ...req.body,
    });
    return ApiResponse.success(res, { group }, 'Tour group created successfully', 201);
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function getAgentGroups(req, res, next) {
  try {
    const groups = await agentService.getAgentGroups(req.user.id);
    return ApiResponse.success(res, { groups }, 'Agent groups retrieved successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function getAgentAppointments(req, res, next) {
  try {
    const appointments = await agentService.getAgentAppointments(req.user.id);
    return ApiResponse.success(res, { appointments }, 'Agent appointments retrieved successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function getGroupById(req, res, next) {
  try {
    const isStaff = ['ADMIN', 'MANAGER', 'OPERATOR'].includes(req.user.role);
    const group = await agentService.getGroupById(req.params.groupId, req.user.id, isStaff);
    return ApiResponse.success(res, { group });
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function submitGroup(req, res, next) {
  try {
    const result = await agentService.submitGroup(req.params.groupId, req.user.id);
    return ApiResponse.success(res, result, 'Group successfully submitted for processing and commission credited');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function getWallet(req, res, next) {
  try {
    const wallet = await agentService.getAgentWallet(req.user.id);
    return ApiResponse.success(res, { wallet }, 'Agent wallet information retrieved');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function requestPayout(req, res, next) {
  try {
    const { amount, bankName, iban, swiftBic } = req.body;
    const payout = await agentService.requestPayout({
      userId: req.user.id,
      amount,
      bankName,
      iban,
      swiftBic,
    });
    return ApiResponse.success(res, { payout }, 'Payout request submitted successfully', 201);
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function exportCsv(req, res, next) {
  try {
    const csvData = await agentService.exportTransactionsCsv(req.user.id);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="agent_transactions.csv"');
    return res.send(csvData);
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function saveBankDetails(req, res, next) {
  try {
    const { bankName, iban, swiftBic, accountHolder } = req.body;
    const result = await agentService.saveBankDetails(req.user.id, { bankName, iban, swiftBic, accountHolder });
    return ApiResponse.success(res, result, 'Bank details updated successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function addApplicant(req, res, next) {
  try {
    const applicant = await agentService.addApplicantToGroup(req.params.groupId, req.user.id, req.body);
    return ApiResponse.success(res, { applicant }, 'Applicant added to group successfully', 201);
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function removeApplicant(req, res, next) {
  try {
    await agentService.removeApplicantFromGroup(req.params.groupId, req.params.applicantId, req.user.id);
    return ApiResponse.success(res, null, 'Applicant removed from group successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function saveApplicantForm(req, res, next) {
  try {
    const applicant = await agentService.saveApplicantFormInGroup(
      req.params.groupId,
      req.params.applicantId,
      req.body.formData || req.body,
      req.user.id
    );
    return ApiResponse.success(res, { applicant }, 'Applicant form saved successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function updateGroup(req, res, next) {
  try {
    const group = await agentService.updateGroup(req.params.groupId, req.user.id, req.body);
    return ApiResponse.success(res, { group }, 'Group updated successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function deleteGroup(req, res, next) {
  try {
    await agentService.deleteGroup(req.params.groupId, req.user.id);
    return ApiResponse.success(res, null, 'Group deleted successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

module.exports = {
  createGroup,
  getAgentGroups,
  getAgentAppointments,
  getGroupById,
  updateGroup,
  deleteGroup,
  submitGroup,
  getWallet,
  requestPayout,
  exportCsv,
  saveBankDetails,
  addApplicant,
  removeApplicant,
  saveApplicantForm,
};


