const prisma = require('../../../config/db');

function slugifyToken(input = '') {
  return String(input)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24) || 'ITEM';
}

async function nextQuestionCode(db = prisma) {
  const all = await db.globalQuestion.findMany({
    select: { questionCode: true },
  });
  let maxNum = 0;
  for (const row of all) {
    const match = /^Q(\d+)$/i.exec(String(row.questionCode || '').trim());
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  const next = maxNum + 1;
  return `Q${String(next).padStart(3, '0')}`;
}

async function nextDocumentCode(db = prisma) {
  const all = await db.globalDocument.findMany({
    select: { documentCode: true },
  });
  let maxNum = 0;
  for (const row of all) {
    const match = /^DOC-(\d+)$/i.exec(String(row.documentCode || '').trim());
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  const next = maxNum + 1;
  return `DOC-${String(next).padStart(3, '0')}`;
}

async function nextBookingCode(db = prisma) {
  const all = await db.appointment.findMany({
    where: { bookingCode: { not: null } },
    select: { bookingCode: true },
  });
  let maxNum = 0;
  for (const row of all) {
    const match = /^AP(\d+)$/i.exec(String(row.bookingCode || '').trim());
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  const next = maxNum + 1;
  return `AP${String(next).padStart(3, '0')}`;
}

async function generateUniqueOptionCode(questionPrefix, optionLabel, db = prisma, localSet = new Set()) {
  const qToken = slugifyToken(questionPrefix).slice(0, 14);
  const optToken = slugifyToken(optionLabel).slice(0, 18);
  const baseCode = `OPT_${qToken}_${optToken}`;

  let candidate = baseCode;
  let counter = 2;
  while (true) {
    if (!localSet.has(candidate)) {
      const exists = await db.globalQuestionOption.findUnique({
        where: { optionCode: candidate },
        select: { id: true },
      });
      if (!exists) {
        localSet.add(candidate);
        return candidate;
      }
    }
    candidate = `${baseCode}_${counter}`;
    counter += 1;
  }
}

function buildUniqueSlotKey({ providerId, visaTypeId, visaPurposeId, slotDate, startTime }) {
  if (!providerId || !slotDate || !startTime) return null;
  const vt = visaTypeId || 'ALL_TYPES';
  const vp = visaPurposeId || 'ALL_PURPOSES';
  const normTime = String(startTime).trim().toUpperCase();
  return `${providerId}:${vt}:${vp}:${slotDate}:${normTime}`;
}

module.exports = {
  slugifyToken,
  nextQuestionCode,
  nextDocumentCode,
  nextBookingCode,
  generateUniqueOptionCode,
  buildUniqueSlotKey,
};
