const paymentService = require('../modules/payment/payment.service');

async function handleStripeWebhook(req, res) {
  try {
    const signatureHeader = req.headers['stripe-signature'];
    const result = await paymentService.handleStripeWebhook({
      rawBody: req.rawBody || req.body,
      signatureHeader,
      eventBody: req.body,
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error(`Stripe Webhook Handler Error: ${err.message}`);
    return res.status(err.statusCode || 400).json({ error: err.message });
  }
}

module.exports = {
  handleStripeWebhook,
};
