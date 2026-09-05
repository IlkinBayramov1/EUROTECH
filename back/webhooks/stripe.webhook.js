const stripe = require('stripe')(require('../config/env').STRIPE_SECRET_KEY);
const env = require('../config/env');
const paymentService = require('../modules/payment/payment.service');

async function handleStripeWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    if (sig && env.STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
    } else {
      event = req.body;
    }
  } catch (err) {
    console.error(`Webhook Signature Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    await paymentService.confirmPaymentSuccess(paymentIntent.id);
  }

  res.json({ received: true });
}

module.exports = {
  handleStripeWebhook,
};
