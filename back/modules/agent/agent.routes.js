const express = require('express');
const router = express.Router();
const agentController = require('./agent.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const { requireRoles } = require('../../middlewares/role.middleware');

router.use(authMiddleware);
router.use(requireRoles(['AGENT_TUR_OPERATOR', 'ADMIN', 'MANAGER']));

router.post('/groups', agentController.createGroup);
router.get('/groups', agentController.getAgentGroups);
router.get('/groups/:groupId', agentController.getGroupById);
router.post('/groups/:groupId/submit', agentController.submitGroup);

router.get('/wallet', agentController.getWallet);
router.post('/payout-request', agentController.requestPayout);
router.get('/transactions/export-csv', agentController.exportCsv);

module.exports = router;
