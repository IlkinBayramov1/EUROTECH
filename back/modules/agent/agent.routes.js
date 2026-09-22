const express = require('express');
const router = express.Router();
const agentController = require('./agent.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const { requireRoles } = require('../../middlewares/role.middleware');

router.use(authMiddleware);
router.use(requireRoles(['AGENT_TUR_OPERATOR', 'ADMIN', 'MANAGER']));

router.post('/groups', agentController.createGroup);
router.get('/groups', agentController.getAgentGroups);
router.get('/appointments', agentController.getAgentAppointments);
router.get('/groups/:groupId', agentController.getGroupById);
router.patch('/groups/:groupId', agentController.updateGroup);
router.delete('/groups/:groupId', agentController.deleteGroup);
router.post('/groups/:groupId/submit', agentController.submitGroup);
router.post('/groups/:groupId/applicants', agentController.addApplicant);
router.delete('/groups/:groupId/applicants/:applicantId', agentController.removeApplicant);
router.patch('/groups/:groupId/applicants/:applicantId/form', agentController.saveApplicantForm);

router.get('/wallet', agentController.getWallet);
router.post('/payout-request', agentController.requestPayout);
router.post('/wallet/bank-details', agentController.saveBankDetails);
router.get('/transactions/export-csv', agentController.exportCsv);

module.exports = router;

