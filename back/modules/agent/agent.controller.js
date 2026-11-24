const agentService = require('./agent.service');
const ApiResponse = require('../../core/api.response');
const documentService = require('../document/document.service');
const { sendDownloadSafely } = require('../../utils/download.util');

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
    return ApiResponse.success(res, { ...wallet, wallet }, 'Agent wallet information retrieved');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function topupWallet(req, res, next) {
  try {
    if (req.body?.promoCode && String(req.body.promoCode).trim()) {
      return ApiResponse.error(res, 'Promo codes cannot be applied to wallet top-up deposits.', 400);
    }
    const result = await agentService.topupAgentWallet(req.user.id, req.body || {});
    return ApiResponse.success(res, result, 'Agency wallet topped up successfully', 201);
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function payGroupWithWallet(req, res, next) {
  try {
    const { groupId } = req.params;
    const { promoCode, source } = req.body || {};
    const result = await agentService.payGroupWithWallet(groupId, req.user.id, req.user.role, {
      promoCode: promoCode || null,
      source: source || null,
    });
    return ApiResponse.success(res, result, 'Group consular fees settled from Agency Wallet and commission credited');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function requestPayout(req, res, next) {
  try {
    const { amount, currency, bankName, iban, swiftBic, accountHolder } = req.body || {};
    const payout = await agentService.requestPayout({
      userId: req.user.id,
      amount,
      currency: currency || 'EUR',
      bankName,
      iban,
      swiftBic,
      accountHolder,
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

async function getGroupInvoicePdf(req, res, next) {
  try {
    const { groupId } = req.params;
    const isStaff = ['ADMIN', 'MANAGER', 'OPERATOR'].includes(req.user.role);
    const result = await agentService.generateGroupInvoicePdf(groupId, req.user.id, isStaff);
    if (req.query.download === 'true' || req.query.download === '1') {
      return sendDownloadSafely(res, {
        filePath: result.filePath,
        fileName: result.fileName,
        contentType: 'application/pdf',
      });
    }
    return ApiResponse.success(res, result, 'Group invoice PDF generated');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function getCustomerSelfFillData(req, res, next) {
  try {
    const { groupId, applicantId } = req.params;
    const data = await agentService.getCustomerSelfFillData(groupId, applicantId);
    return ApiResponse.success(res, data, 'Traveler self-fill details retrieved successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function submitCustomerSelfFill(req, res, next) {
  try {
    const { groupId, applicantId } = req.params;
    const applicant = await agentService.submitCustomerSelfFill(groupId, applicantId, req.body);
    return ApiResponse.success(res, { applicant }, 'Traveler details saved successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function uploadCustomerDoc(req, res, next) {
  try {
    const { groupId, applicantId } = req.params;
    const { requiredDocumentType, purposeDocumentConfigId, globalDocumentCode } = req.body;
    if (!req.file) {
      return ApiResponse.error(res, 'No file uploaded', 400);
    }
    const data = await agentService.getCustomerSelfFillData(groupId, applicantId);
    const doc = await documentService.uploadDocument({
      dossierId: data.applicant.dossierId,
      applicantId,
      requiredDocumentType: requiredDocumentType || globalDocumentCode || 'DOCUMENT',
      purposeDocumentConfigId: purposeDocumentConfigId || null,
      globalDocumentCode: globalDocumentCode || null,
      file: req.file,
    });
    return ApiResponse.success(res, { document: doc }, 'Document uploaded successfully', 201);
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function setGroupAppointment(req, res, next) {
  try {
    const { timeSlotId, appointmentDate, appointmentTime, location } = req.body;
    const appointment = await agentService.setGroupAppointment(
      req.params.groupId,
      req.user.id,
      {
        timeSlotId,
        appointmentDate,
        appointmentTime,
        location,
      },
      req.user
    );
    return ApiResponse.success(res, { appointment }, 'Group appointment scheduled successfully');
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
  topupWallet,
  payGroupWithWallet,
  requestPayout,
  exportCsv,
  saveBankDetails,
  addApplicant,
  removeApplicant,
  saveApplicantForm,
  getGroupInvoicePdf,
  getCustomerSelfFillData,
  submitCustomerSelfFill,
  uploadCustomerDoc,
  setGroupAppointment,
};
