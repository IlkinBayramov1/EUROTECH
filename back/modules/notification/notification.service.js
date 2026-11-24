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
    templateName: 'decisionNotification',
  });
}

async function sendAppointmentConfirmedNotification({ email, fullName, dossierNumber, appointmentDate, appointmentTime, appointmentLocation, icsContent }) {
  const html = loadTemplate('appointmentConfirmed', {
    fullName,
    dossierNumber,
    appointmentDate,
    appointmentTime,
    appointmentLocation,
  });

  const attachments = [];
  if (icsContent) {
    attachments.push({
      filename: `appointment-${dossierNumber}.ics`,
      content: icsContent,
      contentType: 'text/calendar; charset=utf-8',
    });
  }

  return sendEmail({
    to: email,
    subject: `EuroTech - Görüş Təsdiqi və Təqvim (${appointmentDate})`,
    html,
    attachments,
    templateName: 'appointmentConfirmed',
  });
}

async function sendCorporateExpiryRadarNotification({ hrEmail, hrFullName, expiringEmployees }) {
  const employeeRows = expiringEmployees
    .map(
      (emp) => `
      <tr>
        <td><strong>${emp.fullName}</strong></td>
        <td>${emp.department || 'Ümumi'}</td>
        <td><code>${emp.passportNumber}</code></td>
        <td>${emp.passportExpiry ? new Date(emp.passportExpiry).toLocaleDateString() : 'N/A'}</td>
        <td><span class="${emp.isCritical ? 'badge-critical' : 'badge-warning'}">${emp.isCritical ? 'KRİTİK (<90 gün)' : 'XƏBƏRDARLIQ'}</span></td>
      </tr>`
    )
    .join('');

  const html = loadTemplate('corporateExpiryRadarAlert', {
    hrFullName,
    employeeRows,
  });

  return sendEmail({
    to: hrEmail,
    subject: `EuroTech Radar: ${expiringEmployees.length} Əməkdaşın Pasport Müddəti Bitir`,
    html,
    templateName: 'corporateExpiryRadarAlert',
  });
}

async function sendPasswordResetNotification(email, fullName, rawToken) {
  const customerAppUrl = process.env.CUSTOMER_APP_URL || 'https://customer.eurotech.az';
  const resetPasswordLink = `${customerAppUrl}/reset-password?token=${rawToken}`;

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0f172a; margin-bottom: 8px;">EuroTech Services — Şifrə Sıfırlama Sorğusu</h2>
      <p style="font-size: 15px;">Hörmətli <strong>${fullName || 'İstifadəçi'}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.6; color: #475569;">
        EuroTech portal hesabınız üçün şifrə sıfırlama sorğusu qəbul edildi. Şifrənizi yeniləmək üçün aşağıdakı təhlükəsiz düyməyə keçid edin:
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${resetPasswordLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          Şifrəni Yenilə
        </a>
      </div>
      <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
        Bu keçid 1 saat ərzində etibarlıdır. Əgər bu sorğunu siz göndərməmisinizsə, bu məktubu nəzərə almayın.
      </p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: 'EuroTech Services — Şifrə Sıfırlama',
    html,
  });
}

module.exports = {
  sendOtpNotification,
  sendSetPasswordNotification,
  sendPasswordResetNotification,
  sendDossierSubmittedNotification,
  sendDocumentCorrectionNotification,
  sendDecisionNotification,
  sendAppointmentConfirmedNotification,
  sendCorporateExpiryRadarNotification,
};

