const express = require('express');
const router = express.Router();

const authRoutes = require('../../modules/auth/auth.routes');
const templateRoutes = require('../../modules/template/template.routes');
const dossierRoutes = require('../../modules/dossier/dossier.routes');
const documentRoutes = require('../../modules/document/document.routes');
const serviceRoutes = require('../../modules/service/service.routes');
const paymentRoutes = require('../../modules/payment/payment.routes');
const adminRoutes = require('../../modules/admin/admin.routes');
const webhookRoutes = require('../../webhooks/webhook.routes');

router.use('/auth', authRoutes);
router.use('/templates', templateRoutes);
router.use('/dossiers', dossierRoutes);
router.use('/documents', documentRoutes);
router.use('/services', serviceRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);
router.use('/webhooks', webhookRoutes);

module.exports = router;
