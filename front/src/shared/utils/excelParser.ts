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
  expiryDate: string;
}

export interface ParseRosterResult {
  applicants: RosterApplicant[];
  errors: string[];
  duplicates: string[];
}

export const ROSTER_CSV_HEADER = 'First Name,Last Name,Passport Number,Date of Birth,Gender,Nationality,Passport Expiry';

export function generateRosterTemplateCsv(): string {
  const sampleRows = [
    'Ali,Mammadov,C10293847,1992-05-14,MALE,AZ,2031-05-14',
    'Leyla,Aliyeva,C20394857,1995-10-22,FEMALE,AZ,2032-10-22',
    'Rashad,Hasanov,C30495867,1988-03-30,MALE,AZ,2029-03-30',
  ];

  return [ROSTER_CSV_HEADER, ...sampleRows].join('\r\n');
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

export function parseRosterCsv(text: string): ParseRosterResult {
  const lines = text
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

  // Check if first line is header
  const startIndex = lines[0].toLowerCase().includes('passport') ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const rowNum = i + 1;
    const line = lines[i];

    // Handle standard CSV comma or semicolon separation
    const delimiter = line.includes(';') ? ';' : ',';
    const parts = line.split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, ''));

    if (parts.length < 3) {
      errors.push(`Row ${rowNum}: Insufficient columns. Minimum required: First Name, Last Name, Passport Number.`);
      continue;
    }

    const firstName = parts[0] || '';
    const lastName = parts[1] || '';
    const passportNumber = (parts[2] || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const dob = parts[3] || '1990-01-01';
    const rawGender = (parts[4] || 'MALE').toUpperCase();
    const gender: 'MALE' | 'FEMALE' = rawGender.startsWith('F') ? 'FEMALE' : 'MALE';
    const nationality = (parts[5] || 'AZ').toUpperCase();
    const expiryDate = parts[6] || '2030-01-01';

    if (!firstName || !lastName) {
      errors.push(`Row ${rowNum}: Missing first or last name for traveler.`);
      continue;
    }

    if (!passportNumber || passportNumber.length < 5) {
      errors.push(`Row ${rowNum}: Invalid or missing passport number for ${firstName} ${lastName}.`);
      continue;
    }

    // Check duplicate within the batch
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
      expiryDate,
    });
  }

  return { applicants, errors, duplicates };
}
