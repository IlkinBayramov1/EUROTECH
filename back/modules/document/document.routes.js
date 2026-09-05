const express = require('express');
const router = express.Router();
const documentController = require('./document.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const { requireRoles } = require('../../middlewares/role.middleware');
const upload = require('../../middlewares/upload.middleware');

router.use(authMiddleware);

router.post('/upload', upload.single('file'), documentController.uploadDocument);
router.get('/:documentId/signed-url', documentController.getSignedUrl);
router.patch(
  '/:documentId/review',
  requireRoles(['OPERATOR', 'MANAGER', 'ADMIN']),
  documentController.reviewDocument
);
router.post(
  '/dossier/:dossierId/send-feedback',
  requireRoles(['OPERATOR', 'MANAGER', 'ADMIN']),
  documentController.sendFeedback
);

module.exports = router;
