const env = require('../config/env');
const prisma = require('../config/db');

/**
 * Normalizes phone numbers to standard E.164 format (+994XXXXXXXXX)
 */
function normalizePhoneNumber(rawPhone) {
  if (!rawPhone) return '';
  let cleaned = String(rawPhone).replace(/[^\d+]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '+994' + cleaned.substring(1);
  } else if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}

/**
 * Sends Official WhatsApp Business Cloud API Message
 */
async function sendWhatsAppTemplate({ to, templateName, languageCode = 'az', bodyParameters = [] }) {
  const normalizedPhone = normalizePhoneNumber(to);
  const recipientWaId = normalizedPhone.replace('+', '');

  let logRecord = null;
  try {
    logRecord = await prisma.outboundMessageLog.create({
      data: {
        channel: 'WHATSAPP',
        recipient: normalizedPhone,
        template: templateName,
        status: 'PENDING',
        provider: 'META_WHATSAPP',
      },
    });
  } catch (err) {}

  const hasLiveToken = env.META_WHATSAPP_TOKEN && env.META_WHATSAPP_TOKEN.length > 20;

  if (hasLiveToken) {
    try {
      const url = `https://graph.facebook.com/v19.0/${env.META_WHATSAPP_PHONE_ID}/messages`;
      const payload = {
        messaging_product: 'whatsapp',
        to: recipientWaId,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            {
              type: 'body',
              parameters: bodyParameters.map((param) => ({ type: 'text', text: String(param) })),
            },
          ],
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.META_WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ? data.error.message : 'Meta WhatsApp API Error');
      }

      if (logRecord) {
        await prisma.outboundMessageLog.update({
          where: { id: logRecord.id },
          data: {
            status: 'DELIVERED',
            providerMessageId: data.messages && data.messages[0] ? data.messages[0].id : 'meta_ok',
          },
        });
      }

      return { success: true, messageId: data.messages[0].id };
    } catch (err) {
      console.error('[WHATSAPP API ERROR]', err.message);
      if (logRecord) {
        await prisma.outboundMessageLog.update({
          where: { id: logRecord.id },
          data: { status: 'FAILED', errorMsg: err.message },
        });
      }
      return { success: false, error: err.message };
    }
  } else {
    // Sandbox / Development Simulator Mode
    const simulatedMsgId = `wamid.HBgL${Date.now()}`;
    console.log(`[WHATSAPP SANDBOX] Template '${templateName}' dispatched to ${normalizedPhone}: params=[${bodyParameters.join(', ')}]`);
    if (logRecord) {
      await prisma.outboundMessageLog.update({
        where: { id: logRecord.id },
        data: {
          status: 'SENT',
          providerMessageId: simulatedMsgId,
        },
      });
    }
    return { success: true, messageId: simulatedMsgId, simulated: true };
  }
}

/**
 * Sends SMS via Twilio or Local SMS Provider
 */
async function sendSms({ to, message }) {
  const normalizedPhone = normalizePhoneNumber(to);

  let logRecord = null;
  try {
    logRecord = await prisma.outboundMessageLog.create({
      data: {
        channel: 'SMS',
        recipient: normalizedPhone,
        subject: message.slice(0, 30),
        status: 'PENDING',
        provider: env.TWILIO_ACCOUNT_SID ? 'TWILIO' : 'LOCAL_SMS',
      },
    });
  } catch (err) {}

  const hasTwilio = env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN;

  if (hasTwilio) {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
      const body = new URLSearchParams({
        To: normalizedPhone,
        From: env.TWILIO_PHONE_NUMBER,
        Body: message,
      });

      const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Twilio SMS Error');
      }

      if (logRecord) {
        await prisma.outboundMessageLog.update({
          where: { id: logRecord.id },
          data: { status: 'DELIVERED', providerMessageId: data.sid },
        });
      }

      return { success: true, sid: data.sid };
    } catch (err) {
      console.error('[SMS API ERROR]', err.message);
      if (logRecord) {
        await prisma.outboundMessageLog.update({
          where: { id: logRecord.id },
          data: { status: 'FAILED', errorMsg: err.message },
        });
      }
      return { success: false, error: err.message };
    }
  } else {
    // Sandbox SMS Simulator
    const simulatedSid = `SM_sim_${Date.now()}`;
    console.log(`[SMS SANDBOX] Sent to ${normalizedPhone}: "${message}"`);
    if (logRecord) {
      await prisma.outboundMessageLog.update({
        where: { id: logRecord.id },
        data: { status: 'SENT', providerMessageId: simulatedSid },
      });
    }
    return { success: true, sid: simulatedSid, simulated: true };
  }
}

/**
 * Handles Incoming Meta WhatsApp Webhook and Two-Way Interactive Status Inquiries
 */
async function handleWhatsAppWebhook(payload) {
  try {
    const entry = payload.entry && payload.entry[0];
    const changes = entry && entry.changes && entry.changes[0];
    const value = changes && changes.value;
    const messages = value && value.messages;

    if (!messages || messages.length === 0) {
      return { status: 'NO_MESSAGES' };
    }

    const incoming = messages[0];
    const fromPhone = incoming.from; // e.g. "994501234567"
    const textBody = (incoming.text && incoming.text.body ? incoming.text.body.trim() : '').toUpperCase();

    console.log(`[WHATSAPP INBOUND] Message from ${fromPhone}: "${textBody}"`);

    // Interactive Two-Way Bot: Check Status
    if (textBody.includes('STATUS')) {
      // Extract dossier number if user typed: "STATUS HU-AZ-2026-04891"
      const parts = textBody.split(' ');
      let dossierNumber = parts.length > 1 ? parts[1] : null;

      let dossier = null;
      if (dossierNumber) {
        dossier = await prisma.dossier.findUnique({
          where: { dossierNumber },
          include: { country: true, appointments: { include: { timeSlot: true } } },
        });
      } else {
        // Find latest dossier for user matching this phone
        const user = await prisma.user.findFirst({
          where: { phone: { contains: fromPhone.slice(-7) } },
          include: { dossiers: { include: { country: true, appointments: { include: { timeSlot: true } } }, orderBy: { createdAt: 'desc' } } },
        });
        if (user && user.dossiers.length > 0) {
          dossier = user.dossiers[0];
        }
      }

      let responseText = '';
      if (dossier) {
        const appointmentInfo = dossier.appointments && dossier.appointments.length > 0
          ? `${new Date(dossier.appointments[0].timeSlot.date).toLocaleDateString()} (${dossier.appointments[0].timeSlot.startTime})`
          : 'Hələ təyin olunmayıb';

        responseText = `Hörmətli müştəri, Viza müraciətinizin cari vəziyyəti:\n\n` +
          `📌 Dosye: ${dossier.dossierNumber}\n` +
          `🌍 Ölkə: ${dossier.country ? dossier.country.nameAz : 'Şengen'}\n` +
          `📊 Status: ${dossier.status}\n` +
          `📅 Görüş: ${appointmentInfo}\n` +
          `💳 Ödəniş: ${dossier.paymentStatus}\n\n` +
          `EuroTech Şəxsi Kabinet: https://customer.eurotech.az`;
      } else {
        responseText = `Hörmətli müştəri, telefon nömrənizə və ya daxil etdiyiniz koda uyğun aktiv dosye tapılmadı. Zəhmət olmasa "STATUS <DOSYE_NÖMRƏSİ>" formatında göndərin (Məsələn: STATUS HU-AZ-2026-04891).`;
      }

      // Dispatch automated reply
      await sendSms({ to: '+' + fromPhone, message: responseText });
      return { status: 'REPLIED', to: fromPhone, dossierNumber: dossier ? dossier.dossierNumber : null };
    }

    return { status: 'PROCESSED' };
  } catch (error) {
    console.error('Error handling incoming WhatsApp webhook:', error);
    return { status: 'ERROR', error: error.message };
  }
}

module.exports = {
  normalizePhoneNumber,
  sendWhatsAppTemplate,
  sendSms,
  handleWhatsAppWebhook,
};
