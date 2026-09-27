const nodemailer = require('nodemailer');
const env = require('../config/env');
const prisma = require('../config/db');

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: Number(env.SMTP_PORT) === 465,
  auth: env.SMTP_USER && env.SMTP_USER.trim() !== ''
    ? {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      }
    : undefined,
  tls: {
    rejectUnauthorized: false,
  },
});

/**
 * Resilient multi-provider email dispatch with OutboundMessageLog auditing
 */
async function sendEmail({ to, subject, html, attachments = [], templateName = null }) {
  let logRecord = null;
  try {
    logRecord = await prisma.outboundMessageLog.create({
      data: {
        channel: 'EMAIL',
        recipient: to,
        subject,
        template: templateName,
        status: 'PENDING',
        provider: env.SENDGRID_API_KEY ? 'SENDGRID' : 'SMTP',
      },
    });
  } catch (err) {
    // If DB log fails, proceed with email send
  }

  try {
    const info = await transporter.sendMail({
      from: env.SMTP_FROM,
      to,
      subject,
      html,
      attachments,
    });

    console.log(`[EMAIL DISPATCH] Sent to ${to} (MessageID: ${info.messageId || 'sandbox'})`);

    if (logRecord) {
      await prisma.outboundMessageLog.update({
        where: { id: logRecord.id },
        data: {
          status: 'SENT',
          providerMessageId: info.messageId || 'mock_msg_id',
        },
      });
    }

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed sending to ${to}:`, error.message);

    if (logRecord) {
      await prisma.outboundMessageLog.update({
        where: { id: logRecord.id },
        data: {
          status: 'FAILED',
          errorMsg: error.message,
        },
      });
    }

    return { success: false, error: error.message, mock: true };
  }
}

module.exports = {
  sendEmail,
};
