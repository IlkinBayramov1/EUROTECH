/**
 * ICAO 9303 TD3 (Passport) Machine Readable Zone (MRZ) Parser
 * Extracts passport number, surname, given names, nationality, birth date, gender, and expiration date.
 */

export interface ParsedMrzResult {
  rawLines: [string, string];
  documentType: string;
  issuingCountry: string;
  lastName: string;
  firstName: string;
  passportNumber: string;
  nationality: string;
  birthDate: string; // YYYY-MM-DD
  gender: 'M' | 'F' | 'OTHER';
  expiryDate: string; // YYYY-MM-DD
  isValid: boolean;
}

/**
 * Normalizes 2-digit year (YY) into 4-digit year (YYYY)
 * For birth year: YY > currentYear%100 assumes 19YY, else 20YY
 * For expiry year: assumes 20YY
 */
function parseDateYYMMDD(yymmdd: string, isBirthDate = false): string {
  if (yymmdd.length !== 6) return '';
  const yy = parseInt(yymmdd.substring(0, 2), 10);
  const mm = yymmdd.substring(2, 4);
  const dd = yymmdd.substring(4, 6);

  const currentYear2Digits = new Date().getFullYear() % 100;
  let fullYear: number;

  if (isBirthDate) {
    fullYear = yy > currentYear2Digits ? 1900 + yy : 2000 + yy;
  } else {
    fullYear = 2000 + yy;
  }

  return `${fullYear}-${mm}-${dd}`;
}

export function parseMrzLines(line1Raw: string, line2Raw: string): ParsedMrzResult | null {
  const line1 = line1Raw.trim().toUpperCase().replace(/\s+/g, '');
  const line2 = line2Raw.trim().toUpperCase().replace(/\s+/g, '');

  if (line1.length < 44 || line2.length < 44) {
    return null;
  }

  // --- Line 1 Analysis ---
  // P<AZEALIYEV<<ILKIN<<<<<<<<<<<<<<<<<<<<<<<<<
  const documentType = line1.substring(0, 1) === 'P' ? 'PASSPORT' : 'TRAVEL_DOCUMENT';
  const issuingCountry = line1.substring(2, 5).replace(/</g, '');

  // Extract Names: Surname << Given names
  const nameSection = line1.substring(5, 44);
  const nameParts = nameSection.split('<<');
  const lastName = (nameParts[0] || '').replace(/</g, ' ').trim();
  const firstName = (nameParts[1] || '').replace(/</g, ' ').trim();

  // --- Line 2 Analysis ---
  // C123456784AZE9001011M3001018<<<<<<<<<<<<<<02
  const passportNumber = line2.substring(0, 9).replace(/</g, '').trim();
  const nationality = line2.substring(10, 13).replace(/</g, '');
  const birthRaw = line2.substring(13, 19);
  const rawGender = line2.substring(20, 21);
  const expiryRaw = line2.substring(21, 27);

  const gender = rawGender === 'M' ? 'M' : rawGender === 'F' ? 'F' : 'OTHER';
  const birthDate = parseDateYYMMDD(birthRaw, true);
  const expiryDate = parseDateYYMMDD(expiryRaw, false);

  return {
    rawLines: [line1, line2],
    documentType,
    issuingCountry,
    lastName,
    firstName,
    passportNumber,
    nationality: nationality === 'AZE' ? 'Azerbaijan' : nationality,
    birthDate,
    gender,
    expiryDate,
    isValid: Boolean(passportNumber && lastName),
  };
}

/**
 * Searches and extracts MRZ text lines from any multiline string
 */
export function extractMrzFromText(text: string): ParsedMrzResult | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim().toUpperCase().replace(/[^A-Z0-9<]/g, ''))
    .filter((l) => l.length >= 40);

  for (let i = 0; i < lines.length - 1; i++) {
    const l1 = lines[i];
    const l2 = lines[i + 1];
    if (l1.startsWith('P<') || l1.startsWith('P')) {
      const parsed = parseMrzLines(l1, l2);
      if (parsed) return parsed;
    }
  }

  return null;
}
