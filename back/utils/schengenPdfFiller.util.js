const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const env = require('../config/env');

const uploadDir = path.resolve(env.UPLOAD_DIR || './uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Format any date-like value as DD/MM/YYYY
 */
function formatDate(input) {
  if (!input) return '';
  try {
    const d = new Date(input);
    if (isNaN(d.getTime())) return String(input);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(input);
  }
}

/**
 * Resolves the AcroForm template path or generates a standard base template if not found
 */
async function getOrInitTemplateDoc() {
  const possiblePaths = [
    path.join(process.cwd(), 'public', 'pdf', 'FORM-FILLED-SCHENGEN-FORM.pdf'),
    path.join(process.cwd(), 'templates', 'pdf', 'FORM-FILLED-SCHENGEN-FORM.pdf'),
    path.join(__dirname, '..', 'public', 'pdf', 'FORM-FILLED-SCHENGEN-FORM.pdf'),
    path.join(__dirname, '..', 'templates', 'pdf', 'FORM-FILLED-SCHENGEN-FORM.pdf'),
    path.join(__dirname, '..', '..', 'front', 'public', 'pdf', 'FORM-FILLED-SCHENGEN-FORM.pdf'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      const bytes = fs.readFileSync(p);
      return await PDFDocument.load(bytes);
    }
  }

  // If no physical template exists yet on disk, create an official 4-page AcroForm structure
  const pdfDoc = await PDFDocument.create();
  const form = pdfDoc.getForm();

  // Create 4 standard A4 pages
  for (let pageNum = 1; pageNum <= 4; pageNum++) {
    const page = pdfDoc.addPage([595.28, 841.89]); // Standard A4

    // Top Header
    page.drawText(`Harmonised application form - Application for Schengen Visa (Page ${pageNum} of 4)`, {
      x: 35,
      y: 815,
      size: 9,
      color: rgb(0.2, 0.2, 0.3),
    });
  }

  // Define Text fields Text1 - Text46
  for (let i = 1; i <= 46; i++) {
    try {
      form.createTextField(`Text${i}`);
    } catch {}
  }

  // Define Radio/Checkbox Buttons Button1 - Button39
  for (let b = 1; b <= 39; b++) {
    try {
      form.createCheckBox(`Button${b}`);
    } catch {}
  }

  // Cache template so subsequent calls load fast
  const defaultTemplatePath = possiblePaths[0];
  try {
    const defaultDir = path.dirname(defaultTemplatePath);
    if (!fs.existsSync(defaultDir)) fs.mkdirSync(defaultDir, { recursive: true });
    const savedBytes = await pdfDoc.save();
    fs.writeFileSync(defaultTemplatePath, savedBytes);
    return await PDFDocument.load(savedBytes);
  } catch {
    return pdfDoc;
  }
}

function transliterate(str = '') {
  const map = {
    'ə': 'e', 'Ə': 'E', 'ı': 'i', 'I': 'I', 'İ': 'I',
    'ş': 'sh', 'Ş': 'Sh', 'ç': 'ch', 'Ç': 'Ch',
    'ğ': 'gh', 'Ğ': 'Gh', 'ö': 'o', 'Ö': 'O',
    'ü': 'u', 'Ü': 'U'
  };
  return String(str).split('').map(c => map[c] || c).join('');
}

/**
 * Normalizes applicant and dossier properties into standard Schengen form keys
 */
function normalizeApplicantData(applicantData = {}, dossierData = {}) {
  const rawForm = applicantData.formDataJson || applicantData.formData || {};
  const m = { ...applicantData, ...rawForm };

  const country = dossierData.country?.nameEn || dossierData.country?.nameAz || dossierData.destination || m.destination_main || m.destination || m.country || 'Hungary';

  const firstName = m.firstname || m.firstName || applicantData.firstName || '';
  const lastName = m.surname || m.lastName || applicantData.lastName || '';
  const passportNumber = (m.doc_number || m.passportNumber || applicantData.passportNumber || '').toUpperCase();
  const birthDate = m.dob || m.birthDate || applicantData.birthDate || '';

  // Determine sex
  let sex = m.sex;
  if (!sex) {
    const rawGender = String(m.gender || applicantData.gender || '').toUpperCase();
    if (rawGender.startsWith('F') || rawGender.startsWith('Q')) sex = 'Female';
    else if (rawGender.startsWith('M') || rawGender.startsWith('K')) sex = 'Male';
    else if (rawGender.includes('OTHER') || rawGender.includes('DIGER')) sex = 'Other';
    else sex = 'Male';
  }

  // Determine civil status
  let civil_status = m.civil_status || m.maritalStatus || 'Single';
  const csUpper = String(civil_status).toUpperCase();
  if (csUpper.includes('MARRIED') || csUpper.includes('EVLI')) civil_status = 'Married';
  else if (csUpper.includes('DIVORCED') || csUpper.includes('BOŞAN')) civil_status = 'Divorced';
  else if (csUpper.includes('WIDOW') || csUpper.includes('DUL')) civil_status = 'Widow(er)';
  else if (csUpper.includes('SEPARAT')) civil_status = 'Separated';
  else if (csUpper.includes('PARTNER')) civil_status = 'Registered Partnership';
  else if (csUpper.includes('OTHER') || csUpper.includes('DIGER')) civil_status = 'Other';
  else civil_status = 'Single';

  // Determine purpose
  let purpose = m.purpose;
  if (!purpose) {
    const visaCode = (dossierData.visaCategory?.code || '').toUpperCase();
    if (visaCode.includes('WORK') || visaCode.includes('CORP') || dossierData.portalType === 'CORPORATE') {
      purpose = 'Business';
    } else {
      purpose = 'Tourism';
    }
  }

  // Cost coverage
  let costCoveredBy = (m.cost_covered_by || m.costCoveredBy || (dossierData.portalType === 'CORPORATE' ? 'sponsor' : 'applicant')).toLowerCase();
  if (costCoveredBy.includes('sponsor')) costCoveredBy = 'sponsor';
  else costCoveredBy = 'applicant';

  // Parse Means of support arrays/strings
  const parseSupportList = (val) => {
    if (Array.isArray(val)) return val.map(s => String(s).toLowerCase());
    if (typeof val === 'string') return val.split(',').map(s => s.trim().toLowerCase());
    return [];
  };

  const meansApplicantList = parseSupportList(m.meansOfSupportApplicant || m.means_applicant || m.meansOfSupport);
  const meansSponsorList = parseSupportList(m.meansOfSupportSponsor || m.means_sponsor || m.meansOfSupport);

  const isCompany = m.invitingType === 'company' || !!m.companyName || !!m.inviting_company_name || dossierData.portalType === 'CORPORATE';

  const employerAddr = m.employerAddress || m.employer_address || '';
  const employerPhone = m.employerPhone || m.employer_phone || '';
  const fullEmployerInfo = employerAddr && employerPhone 
    ? `${employerAddr}, Tel: ${employerPhone}` 
    : (employerAddr || (employerPhone ? `Tel: ${employerPhone}` : ''));

  return {
    surname: lastName,
    surname_birth: m.surname_birth || m.birthSurname || lastName,
    firstname: firstName,
    dob: birthDate,
    birthplace: m.birthplace || m.birthPlace || 'Baku',
    birthcountry: m.birthcountry || m.birthCountry || 'Azerbaijan',
    nationality: m.nationality || applicantData.nationality || 'Azerbaijan',
    nationality_at_birth: m.nationalityAtBirth || m.nationality_at_birth || '',
    other_nationalities: m.otherNationalities || m.other_nationalities || '',
    sex,
    civil_status,
    id_number: m.id_number || m.nationalId || '',

    // Minor Parental Authority / Legal Guardian (Box 10)
    is_minor: m.isMinor === true || m.isMinor === 'Yes' || m.is_minor === true || m.is_minor === 'Yes',
    guardian_surname: m.guardianSurname || m.guardian_surname || '',
    guardian_name: m.guardianName || m.guardian_name || '',
    guardian_address: m.guardianAddress || m.guardian_address || '',
    guardian_phone: m.guardianPhone || m.guardian_phone || '',
    guardian_email: m.guardianEmail || m.guardian_email || '',
    guardian_nationality: m.guardianNationality || m.guardian_nationality || '',

    // Document
    doc_type: m.doc_type || m.passportType || 'Ordinary passport',
    doc_other_details: m.otherDocTypeDetails || m.doc_other_details || '',
    doc_number: passportNumber,
    doc_issue: m.doc_issue || m.issueDate || '',
    doc_valid: m.doc_valid || m.passportExpiry || m.expiryDate || '',
    doc_issuedby: m.doc_issuedby || m.issuedBy || 'Ministry of Internal Affairs',

    // Family Member of EU/EEA/CH/UK citizen (Boxes 30-31)
    has_eu_member: m.hasEuFamilyMember === true || m.hasEuFamilyMember === 'Yes' || m.has_eu_member === true || m.has_eu_member === 'Yes',
    fam_surname: m.euFamilySurname || m.fam_surname || '',
    fam_firstname: m.euFamilyName || m.fam_firstname || '',
    fam_dob: m.euFamilyDob || m.fam_dob || '',
    fam_nat: m.euFamilyNationality || m.fam_nat || '',
    fam_doc: m.euFamilyDocNumber || m.fam_doc || '',
    relationship: m.euFamilyRelationship || m.relationship || '',

    // Contact & Residence (Box 17 & Box 20)
    email: m.email || m.homeEmail || applicantData.email || dossierData.user?.email || '',
    address: m.address || m.homeAddress || '',
    phone: m.phone || m.homePhone || m.contactPhone || applicantData.phone || dossierData.user?.phone || '',
    residence_other: (m.hasOtherResidence === true || m.hasOtherResidence === 'Yes' || m.residence_other === true || m.residence_other === 'Yes') ? 'Yes' : 'No',
    residence_type: m.otherResidenceType || m.residence_type || '',
    residence_number: m.otherResidenceNumber || m.residence_number || '',
    residence_valid: m.otherResidenceValidUntil || m.residence_valid || '',

    // Employment (Boxes 21-22)
    occupation: m.occupation || m.currentOccupation || m.jobTitle || 'Specialist',
    employer: m.employer || m.employerName || (dossierData.user?.companyName ? `${dossierData.user.companyName}, Baku` : ''),
    employer_address: fullEmployerInfo,
    employer_phone: employerPhone,

    // Travel Plan (Boxes 21, 23, 24, 25, 27)
    purpose,
    purpose_details: m.purposeOtherDetails || m.purposeDetails || m.purpose_details || m.specialNotes || '',
    destination_main: country,
    first_entry: m.first_entry || m.firstEntry || country,
    entries: m.entries || m.entriesRequested || 'Single',
    arrival: m.arrival || m.arrivalDate || m.travelDate || dossierData.travelDate || '',
    departure: m.departure || m.departureDate || '',
    fingerprints: (m.hasPreviousFingerprints === true || m.hasPreviousFingerprints === 'Yes' || m.fingerprints === true || m.fingerprints === 'Yes') ? 'Yes' : 'No',
    fingerprint_date: m.fingerprintDate || m.fingerprint_date || '',
    fingerprint_visa_no: m.fingerprintVisaNumber || m.fingerprint_visa_no || '',
    has_transit_permit: (m.hasFinalDestinationPermit === true || m.hasFinalDestinationPermit === 'Yes' || m.has_transit_permit === true || m.has_transit_permit === 'Yes') ? 'Yes' : 'No',
    entry_issuedby: m.finalDestinationAuthority || m.entry_issuedby || '',
    entry_validfrom: m.finalDestinationValidFrom || m.entry_validfrom || '',
    entry_validuntil: m.finalDestinationValidUntil || m.entry_validuntil || '',

    // Inviting Entity / Accommodation (Boxes 30, 31)
    inviting_type: isCompany ? 'company' : 'individual',
    inviting_person: isCompany ? '' : (m.invitingParty || m.inviting_person || m.hotelAccommodation || 'Confirmed Hotel Reservation'),
    inviting_address: isCompany ? '' : (m.inviting_address || m.address || m.hotelAddress || `${country} Central Area`),
    inviting_email: isCompany ? '' : (m.stayEmail || m.inviting_email || ''),
    inviting_phone: isCompany ? '' : (m.stayPhone || m.inviting_phone || ''),
    inviting_company_name: isCompany ? (m.companyName || m.inviting_company_name || m.invitingParty || '') : '',
    inviting_company_address: isCompany ? (m.companyAddress || m.inviting_company_address || m.address || '') : '',
    contact_fullname: isCompany ? (m.companyContactName || m.contact_fullname || '') : '',
    contact_address: isCompany ? (m.companyContactAddress || m.contact_address || '') : '',
    contact_email: isCompany ? (m.companyContactEmail || m.contact_email || '') : '',
    contact_phone: isCompany ? (m.companyContactPhone || m.contact_phone || '') : '',

    // Cost coverage & Means of Support (Box 32)
    cost_covered_by: costCoveredBy,
    sponsor_type: m.sponsorType || m.sponsor_type || 'referred',
    sponsor_name_details: m.sponsorNameDetails || m.sponsor_name_details || '',
    means_applicant_list: meansApplicantList,
    means_sponsor_list: meansSponsorList,
    means_of_support: m.means_of_support || m.meansOfSupport || 'Cash, Credit card',

    // Person filling form / Representative (Box 34)
    has_rep: (m.hasRepresentative === true || m.hasRepresentative === 'Yes' || m.has_rep === true || m.has_rep === 'Yes'),
    rep_name: m.representativeName || m.rep_name || '',
    rep_address: m.representativeAddress || m.rep_address || '',
    rep_email: m.representativeEmail || m.rep_email || '',
    rep_phone: m.representativePhone || m.rep_phone || '',
  };
}

/**
 * Fills the official Harmonised Schengen Visa Application Form
 */
async function fillSchengenPDF(applicantData, dossierData = {}) {
  try {
    const applicant = normalizeApplicantData(applicantData, dossierData);
    const pdfDoc = await getOrInitTemplateDoc();

    // Register fontkit and embed Unicode font
    let unicodeFont;
    try {
      const fontkit = require('fontkit');
      pdfDoc.registerFontkit(fontkit);

      const fontPaths = [
        path.join(process.cwd(), 'fonts', 'DejaVuSans.ttf'),
        path.join(process.cwd(), 'fonts', 'arial.ttf'),
        path.join(__dirname, '..', 'fonts', 'DejaVuSans.ttf'),
        path.join(__dirname, '..', 'fonts', 'arial.ttf'),
        'C:\\Windows\\Fonts\\arial.ttf',
      ];

      for (const fp of fontPaths) {
        if (fs.existsSync(fp)) {
          const fontBytes = fs.readFileSync(fp);
          unicodeFont = await pdfDoc.embedFont(fontBytes);
          break;
        }
      }
    } catch (fontErr) {
      console.warn('Unicode fontkit load notice, using standard font fallback:', fontErr.message);
    }

    if (!unicodeFont) {
      unicodeFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    const form = pdfDoc.getForm();

    // Override default updateAppearances to force Unicode font
    form.getFields().forEach((f) => {
      try {
        if (f.constructor.name === 'PDFTextField') {
          f.defaultUpdateAppearances(unicodeFont);
        }
      } catch {
        // ignore
      }
    });

    // ===============================
    // MAP FIELDS
    // ===============================
    const fields = {
      /* A. PERSONAL INFORMATION */
      Text1: applicant.surname,
      Text2: applicant.surname_birth,
      Text3: applicant.firstname,
      Text4: formatDate(applicant.dob),
      Text5: applicant.birthplace,
      Text6: applicant.birthcountry,
      Text7: applicant.nationality,

      Button1: applicant.sex === 'Male' ? 'On' : 'Off',
      Button2: applicant.sex === 'Female' ? 'On' : 'Off',
      Button3: applicant.sex === 'Other' ? 'On' : 'Off',

      Button4: applicant.civil_status === 'Single' ? 'On' : 'Off',
      Button5: applicant.civil_status === 'Married' ? 'On' : 'Off',
      Button6: applicant.civil_status === 'Registered Partnership' ? 'On' : 'Off',
      Button7: applicant.civil_status === 'Separated' ? 'On' : 'Off',
      Button8: applicant.civil_status === 'Divorced' ? 'On' : 'Off',
      Button9: applicant.civil_status === 'Widow(er)' ? 'On' : 'Off',
      Button10: applicant.civil_status === 'Other' ? 'On' : 'Off',

      Text8: applicant.id_number,

      /* B. TRAVEL DOCUMENT */
      Button11: applicant.doc_type === 'Ordinary passport' ? 'On' : 'Off',
      Button12: applicant.doc_type === 'Diplomatic passport' ? 'On' : 'Off',
      Button13: applicant.doc_type === 'Service passport' ? 'On' : 'Off',
      Button14: applicant.doc_type === 'Official passport' ? 'On' : 'Off',
      Button15: applicant.doc_type === 'Special passport' ? 'On' : 'Off',
      Button16: applicant.doc_type === 'Other (please specify below)' || applicant.doc_type === 'Other' ? 'On' : 'Off',

      Text9: applicant.doc_number,
      Text10: formatDate(applicant.doc_issue),
      Text11: formatDate(applicant.doc_valid),
      Text12: applicant.doc_issuedby,

      /* C. FAMILY MEMBER */
      Text13: applicant.fam_surname,
      Text14: applicant.fam_firstname,
      Text15: formatDate(applicant.fam_dob),
      Text16: applicant.fam_nat,
      Text17: applicant.fam_doc,

      Button17: applicant.relationship === 'Spouse' ? 'On' : 'Off',
      Button18: applicant.relationship === 'Child' ? 'On' : 'Off',
      Button19: applicant.relationship === 'Grandchild' ? 'On' : 'Off',
      Button20: applicant.relationship === 'Ascendant' ? 'On' : 'Off',
      Button21: applicant.relationship === 'Registered Partner' ? 'On' : 'Off',
      Button22: applicant.relationship === 'Other' ? 'On' : 'Off',

      /* D. CONTACT & RESIDENCE */
      Text18: applicant.email,
      Text19: applicant.address,
      Text20: applicant.phone,

      Button23: applicant.residence_other === 'No' ? 'On' : 'Off',
      Button24: applicant.residence_other === 'Yes' ? 'On' : 'Off',

      Text21: applicant.residence_type,
      Text22: applicant.residence_number,
      Text23: formatDate(applicant.residence_valid),

      /* E. EMPLOYMENT */
      Text24: applicant.occupation,
      Text25: applicant.employer_address || applicant.employer,

      /* F. TRAVEL PLAN */
      Button25: applicant.purpose === 'Tourism' ? 'On' : 'Off',
      Button26: applicant.purpose === 'Business' ? 'On' : 'Off',
      Button27: applicant.purpose === 'Visiting family or friends' || applicant.purpose === 'Visiting family/friends' ? 'On' : 'Off',
      Button28: applicant.purpose === 'Cultural' ? 'On' : 'Off',
      Button29: applicant.purpose === 'Sports' ? 'On' : 'Off',
      Button30: applicant.purpose === 'Official visit' ? 'On' : 'Off',
      Button31: applicant.purpose === 'Medical reasons' ? 'On' : 'Off',
      Button32: applicant.purpose === 'Study' ? 'On' : 'Off',
      Button33: applicant.purpose === 'Airport transit' || applicant.purpose === 'Transit' ? 'On' : 'Off',
      Button34: applicant.purpose === 'Other' ? 'On' : 'Off',

      Text26: applicant.purpose_details,
      Text27: applicant.destination_main,
      Text28: applicant.first_entry,

      Button35: applicant.entries === 'Single' ? 'On' : 'Off',
      Button36: applicant.entries === 'Two entries' || applicant.entries === 'Two' ? 'On' : 'Off',
      Button37: applicant.entries === 'Multiple' ? 'On' : 'Off',

      Text29: formatDate(applicant.arrival),
      Text30: formatDate(applicant.departure),

      Button38: applicant.fingerprints === 'No' ? 'On' : 'Off',
      Button39: applicant.fingerprints === 'Yes' ? 'On' : 'Off',

      Text31: formatDate(applicant.fingerprint_date),
      Text32: applicant.fingerprint_visa_no,

      Text33: applicant.entry_issuedby,
      Text34: formatDate(applicant.entry_validfrom),
      Text35: formatDate(applicant.entry_validuntil),

      /* G. INVITING ENTITY */
      Text36: applicant.inviting_person,
      Text37: applicant.inviting_address,
      Text38: applicant.inviting_email,
      Text39: applicant.inviting_phone,
      Text40: applicant.inviting_company_name,
      Text41: applicant.inviting_company_address,
      Text42: applicant.contact_fullname,
      Text43: applicant.contact_address,
      Text44: applicant.contact_email,
      Text46: applicant.contact_phone,

      /* H. MEANS OF SUPPORT / COST COVERAGE (Box 32) */
      // Applicant Support:
      Button40: (applicant.cost_covered_by === 'applicant' && (applicant.means_applicant_list.length === 0 || applicant.means_applicant_list.some(x => x.includes('cash') || x.includes('nağd')))) ? 'On' : 'Off',
      Button41: (applicant.cost_covered_by === 'applicant' && applicant.means_applicant_list.some(x => x.includes('cheque'))) ? 'On' : 'Off',
      Button42: (applicant.cost_covered_by === 'applicant' && (applicant.means_applicant_list.length === 0 || applicant.means_applicant_list.some(x => x.includes('credit') || x.includes('kart')))) ? 'On' : 'Off',
      Button43: (applicant.cost_covered_by === 'applicant' && applicant.means_applicant_list.some(x => x.includes('prepaid_accom') || x.includes('accommodation'))) ? 'On' : 'Off',
      Button44: (applicant.cost_covered_by === 'applicant' && applicant.means_applicant_list.some(x => x.includes('prepaid_trans') || x.includes('transport'))) ? 'On' : 'Off',
      Button45: (applicant.cost_covered_by === 'applicant' && applicant.means_applicant_list.some(x => x.includes('other'))) ? 'On' : 'Off',

      // Sponsor Support:
      Button46: (applicant.cost_covered_by === 'sponsor' && (applicant.sponsor_type !== 'other' || applicant.has_eu_member)) ? 'On' : 'Off',
      Button47: (applicant.cost_covered_by === 'sponsor' && applicant.sponsor_type === 'other') ? 'On' : 'Off',
      Button48: (applicant.cost_covered_by === 'sponsor' && applicant.inviting_type === 'individual') ? 'On' : 'Off',
      Button49: (applicant.cost_covered_by === 'sponsor' && applicant.inviting_type === 'company') ? 'On' : 'Off',
      Button50: (applicant.cost_covered_by === 'sponsor' && (applicant.means_sponsor_list.length === 0 || applicant.means_sponsor_list.some(x => x.includes('cash') || x.includes('nağd')))) ? 'On' : 'Off',
      Button51: (applicant.cost_covered_by === 'sponsor' && (applicant.means_sponsor_list.length === 0 || applicant.means_sponsor_list.some(x => x.includes('accom')))) ? 'On' : 'Off',
      Button52: (applicant.cost_covered_by === 'sponsor' && (applicant.means_sponsor_list.length === 0 || applicant.means_sponsor_list.some(x => x.includes('all_expense') || x.includes('allexpenses') || x.includes('all')))) ? 'On' : 'Off',
      Button53: (applicant.cost_covered_by === 'sponsor' && applicant.means_sponsor_list.some(x => x.includes('trans'))) ? 'On' : 'Off',
      Button54: (applicant.cost_covered_by === 'sponsor' && applicant.means_sponsor_list.some(x => x.includes('other'))) ? 'On' : 'Off',
    };

    // Fill fields safely
    for (const [key, value] of Object.entries(fields)) {
      if (!value) continue;
      try {
        const field = form.getFieldMaybe ? form.getFieldMaybe(key) : form.getField(key);
        if (!field) continue;

        if (field.check && value === 'On') {
          field.check();
          continue;
        }

        if (field.setText) {
          if (field.defaultUpdateAppearances) {
            field.defaultUpdateAppearances(unicodeFont);
          }
          field.setText(String(value));
          field.updateAppearances(unicodeFont);
        }
      } catch (err) {
        // Safe field fill skip
      }
    }

    // Save Output PDF
    const safeFirst = transliterate(applicant.firstname || 'Applicant').trim().replace(/[^a-zA-Z0-9]/g, '_');
    const safeLast = transliterate(applicant.surname || 'Dossier').trim().replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = Date.now();
    const fileName = `Application_Form_${safeFirst}_${safeLast}_${timestamp}.pdf`;
    const outputPath = path.join(uploadDir, fileName);

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);

    return {
      filePath: outputPath,
      fileName,
      downloadUrl: `/uploads/${fileName}`,
      pdfBytes,
      applicant,
    };
  } catch (err) {
    console.error('[SCHENGEN PDF FILLER ERROR]', err);
    throw err;
  }
}

module.exports = {
  fillSchengenPDF,
  normalizeApplicantData,
  formatDate,
};
