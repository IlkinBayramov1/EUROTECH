/**
 * Group Roster CSV/Excel Utility for B2B Travel Agents and Corporate Batches
 */

export interface RosterApplicant {
  firstName: string;
  lastName: string;
  passportNumber: string;
  dob: string;
  gender: 'MALE' | 'FEMALE';
  nationality: string;
  issueDate?: string;
  expiryDate: string;
  department?: string;
  role?: string;
}

export interface ParseRosterResult {
  applicants: RosterApplicant[];
  errors: string[];
  duplicates: string[];
}

export const ROSTER_CSV_HEADER = 'First Name,Last Name,Passport Number,Date of Birth,Gender,Nationality,Passport Expiry';
export const CORPORATE_ROSTER_CSV_HEADER =
  'First Name,Last Name,Passport Number,Date of Birth,Passport Issue,Passport Expiry,Department,Job Title';

export function normalizeCsvDate(rawVal: string | undefined, fallback = '1990-01-01'): string {
  if (!rawVal) return fallback;
  const trimmed = rawVal.trim();
  if (!trimmed) return fallback;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T00:00:00Z`);
    if (!isNaN(d.getTime())) return trimmed;
  }

  // DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
  const dmy = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmy) {
    const iso = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    const d = new Date(`${iso}T00:00:00Z`);
    if (!isNaN(d.getTime())) return iso;
  }

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime()) && parsed.getUTCFullYear() >= 1900 && parsed.getUTCFullYear() <= 2100) {
    return parsed.toISOString().slice(0, 10);
  }

  return fallback;
}

function looksLikeDate(val: string | undefined): boolean {
  if (!val) return false;
  const t = val.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) || /^\d{1,2}[./-]\d{1,2}[./-]\d{4}$/.test(t);
}

export function generateRosterTemplateCsv(): string {
  const sampleRows = [
    'Ali,Mammadov,C10293847,1992-05-14,MALE,AZ,2031-05-14',
    'Leyla,Aliyeva,C20394857,1995-10-22,FEMALE,AZ,2032-10-22',
    'Rashad,Hasanov,C30495867,1988-03-30,MALE,AZ,2029-03-30',
  ];

  return [ROSTER_CSV_HEADER, ...sampleRows].join('\r\n');
}

export function generateCorporateRosterTemplateCsv(): string {
  const sampleRows = [
    'Ali,Mammadov,C10293847,1992-05-14,2021-05-14,2031-05-14,Engineering,Senior Software Engineer',
    'Leyla,Aliyeva,C20394857,1995-10-22,2022-10-22,2032-10-22,Finance,Financial Controller',
    'Rashad,Hasanov,C30495867,1988-03-30,2019-03-30,2029-03-30,Operations,Mobility Manager',
  ];

  return [CORPORATE_ROSTER_CSV_HEADER, ...sampleRows].join('\r\n');
}

export function downloadRosterTemplate(filename = 'eurotech_group_roster_template.csv'): void {
  const content = '\uFEFF' + generateRosterTemplateCsv();
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadCorporateRosterTemplate(filename = 'eurotech_corporate_roster_template.csv'): void {
  const content = '\uFEFF' + generateCorporateRosterTemplateCsv();
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function parseRosterCsv(text: string): ParseRosterResult {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const errors: string[] = [];
  const applicants: RosterApplicant[] = [];
  const seenPassports = new Set<string>();
  const duplicates: string[] = [];

  if (lines.length === 0) {
    errors.push('The provided CSV file is empty.');
    return { applicants, errors, duplicates };
  }

  const firstDelimiter = lines[0].includes(';') ? ';' : ',';
  const rawHeaders = lines[0].split(firstDelimiter).map((h) => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
  const hasHeader = rawHeaders.some((h) => h.includes('first') || h.includes('passport') || h.includes('birth') || h.includes('name'));
  const startIndex = hasHeader ? 1 : 0;

  const findColIdx = (keywords: string[], fallbackIdx: number): number => {
    if (!hasHeader) return fallbackIdx;
    const found = rawHeaders.findIndex((h) => keywords.some((k) => h.includes(k)));
    return found >= 0 ? found : -1;
  };

  const idxFirst = findColIdx(['first'], 0);
  const idxLast = findColIdx(['last', 'surname'], 1);
  const idxPassport = findColIdx(['passport number', 'passport no', 'passport #'], -1);
  const idxDob = findColIdx(['birth', 'dob'], -1);
  const idxGender = findColIdx(['gender', 'sex'], -1);
  const idxNationality = findColIdx(['nation', 'country'], -1);
  const idxIssue = findColIdx(['issue'], -1);
  const idxExpiry = findColIdx(['expir'], -1);
  const idxDept = findColIdx(['depart', 'cost center', 'division'], -1);
  const idxRole = findColIdx(['job', 'title', 'role', 'position'], -1);

  for (let i = startIndex; i < lines.length; i++) {
    const rowNum = i + 1;
    const line = lines[i];

    const delimiter = line.includes(';') ? ';' : ',';
    const parts = line.split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, ''));

    if (parts.length < 3) {
      errors.push(`Row ${rowNum}: Insufficient columns. Minimum required: First Name, Last Name, Passport Number.`);
      continue;
    }

    const firstName = parts[idxFirst >= 0 ? idxFirst : 0] || '';
    const lastName = parts[idxLast >= 0 ? idxLast : 1] || '';

    // Smart detection if headers didn't disambiguate passport vs dob (cols 2 & 3)
    let rawPassport = idxPassport >= 0 ? parts[idxPassport] : '';
    let rawDob = idxDob >= 0 ? parts[idxDob] : '';

    if (!rawPassport && !rawDob) {
      if (looksLikeDate(parts[2]) && !looksLikeDate(parts[3])) {
        rawDob = parts[2];
        rawPassport = parts[3];
      } else {
        rawPassport = parts[2];
        rawDob = parts[3];
      }
    } else if (!rawPassport) {
      rawPassport = idxDob === 2 ? parts[3] : parts[2];
    } else if (!rawDob) {
      rawDob = idxPassport === 2 ? parts[3] : parts[2];
    }

    const passportNumber = (rawPassport || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const dob = normalizeCsvDate(rawDob, '1990-01-01');
    const rawGender = (idxGender >= 0 ? parts[idxGender] : (!hasHeader ? parts[4] : 'MALE') || 'MALE').toUpperCase();
    const gender: 'MALE' | 'FEMALE' = rawGender.startsWith('F') ? 'FEMALE' : 'MALE';
    const nationality = ((idxNationality >= 0 ? parts[idxNationality] : (!hasHeader ? parts[5] : 'AZ')) || 'AZ')
      .toUpperCase()
      .slice(0, 3);
    const issueDate = normalizeCsvDate(idxIssue >= 0 ? parts[idxIssue] : undefined, '2021-01-01');
    const expiryDate = normalizeCsvDate(
      idxExpiry >= 0 ? parts[idxExpiry] : (!hasHeader ? parts[6] : undefined),
      '2030-01-01'
    );
    const department = (idxDept >= 0 ? parts[idxDept] : undefined) || 'Engineering';
    const role = (idxRole >= 0 ? parts[idxRole] : undefined) || 'Specialist';

    if (!firstName || !lastName) {
      errors.push(`Row ${rowNum}: Missing first or last name for traveler.`);
      continue;
    }

    if (!passportNumber || passportNumber.length < 5) {
      errors.push(`Row ${rowNum}: Invalid or missing passport number for ${firstName} ${lastName}.`);
      continue;
    }

    if (seenPassports.has(passportNumber)) {
      duplicates.push(passportNumber);
      errors.push(`Row ${rowNum}: Duplicate passport number "${passportNumber}" found in this file.`);
      continue;
    }

    seenPassports.add(passportNumber);

    applicants.push({
      firstName,
      lastName,
      passportNumber,
      dob,
      gender,
      nationality,
      issueDate,
      expiryDate,
      department,
      role,
    });
  }

  return { applicants, errors, duplicates };
}
