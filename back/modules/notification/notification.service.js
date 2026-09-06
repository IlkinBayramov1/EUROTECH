const fs = require('fs');
const path = require('path');
const { sendEmail } = require('../../utils/email.util');

function loadTemplate(templateName, variables = {}) {
  const filePath = path.join(__dirname, 'emailTemplates', `${templateName}.html`);
  if (!fs.existsSync(filePath)) {
    return `<p>${JSON.stringify(variables)}</p>`;
  }

  let html = fs.readFileSync(filePath, 'utf8');
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    html = html.replace(regex, value || '');
  }

  return html;
}

async function sendOtpNotification(email, otpCode) {
  const html = loadTemplate('otpVerification', { otpCode });
  return sendEmail({
    to: email,
    subject: 'EuroTech - Təsdiq Kodu',
    html,
  });
}

async function sendSetPasswordNotification(email, fullName, username, rawToken) {
  const customerAppUrl = process.env.CUSTOMER_APP_URL || 'https://customer.eurotech.az';
  const setPasswordLink = `${customerAppUrl}/set-password?token=${rawToken}`;

  const html = loadTemplate('setPassword', {
    fullName,
    username,
    setPasswordLink,
  });

  return sendEmail({
    to: email,
    subject: `EuroTech Services — Hesabınız Yaradıldı (${username})`,
    html,
  });
}

async function sendDossierSubmittedNotification(email, fullName, dossierNumber) {
  const html = loadTemplate('dossierSubmitted', { fullName, dossierNumber });
  return sendEmail({
    to: email,
    subject: `EuroTech - Müraciətiniz Qəbul Olundu (${dossierNumber})`,
    html,
  });
}

async function sendDocumentCorrectionNotification(email, fullName, dossierNumber, operatorNotes) {
  const html = loadTemplate('documentCorrection', { fullName, dossierNumber, operatorNotes });
  return sendEmail({
    to: email,
    subject: `EuroTech Sənəd Düzəliş Tələbi - ${dossierNumber}`,
    html,
  });
}

async function sendDecisionNotification(email, fullName, dossierNumber, statusText, notes) {
  const html = loadTemplate('decisionNotification', { fullName, dossierNumber, statusText, notes });
  return sendEmail({
    to: email,
    subject: `EuroTech Dosye Status Yenilənməsi - ${dossierNumber}`,
    html,
  });
}

module.exports = {
  sendOtpNotification,
  sendSetPasswordNotification,
  sendDossierSubmittedNotification,
  sendDocumentCorrectionNotification,
  sendDecisionNotification,
};
