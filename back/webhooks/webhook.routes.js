const express = require('express');
const router = express.Router();
const { handleStripeWebhook } = require('./stripe.webhook');
const messagingService = require('../services/messaging.service');
const paymentService = require('../modules/payment/payment.service');
const env = require('../config/env');

// Stripe Cryptographic Webhook
router.post('/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Meta WhatsApp Verification Challenge (GET)
router.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      console.log('[WHATSAPP WEBHOOK] Challenge verified successfully');
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  }
  return res.sendStatus(400);
});

// Meta WhatsApp Incoming Message Event (POST)
router.post('/whatsapp', async (req, res) => {
  try {
    const result = await messagingService.handleWhatsAppWebhook(req.body);
    return res.status(200).json(result);
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Local Bank Callback Webhook
router.post('/local-bank', async (req, res) => {
  try {
    const result = await paymentService.confirmLocalBankPayment(req.body);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message });
  }
});

module.exports = router;
