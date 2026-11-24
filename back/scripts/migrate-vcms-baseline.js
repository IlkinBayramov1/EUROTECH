const prismaDefault = require('../config/db');
const { nextBookingCode, buildUniqueSlotKey } = require('../modules/vcms/services/codeGenerator.service');

const COUNTRY_PROFILES = {
  FR: { flagEmoji: 'FR', region: 'Europe', isSchengen: true, displayOrder: 1, processingDaysLabel: '15 business days' },
  DE: { flagEmoji: 'DE', region: 'Europe', isSchengen: true, displayOrder: 2, processingDaysLabel: '15 business days' },
  HU: { flagEmoji: 'HU', region: 'Europe', isSchengen: true, displayOrder: 3, processingDaysLabel: '15 business days' },
  AT: { flagEmoji: 'AT', region: 'Europe', isSchengen: true, displayOrder: 4, processingDaysLabel: '15 business days' },
  IT: { flagEmoji: 'IT', region: 'Europe', isSchengen: true, displayOrder: 5, processingDaysLabel: '15 business days' },
  ES: { flagEmoji: 'ES', region: 'Europe', isSchengen: true, displayOrder: 6, processingDaysLabel: '15 business days' },
  PL: { flagEmoji: 'PL', region: 'Europe', isSchengen: true, displayOrder: 7, processingDaysLabel: '15 business days' },
  CZ: { flagEmoji: 'CZ', region: 'Europe', isSchengen: true, displayOrder: 8, processingDaysLabel: '15 business days' },
  TR: { flagEmoji: 'TR', region: 'Europe / Asia', isSchengen: false, displayOrder: 9, processingDaysLabel: '10 business days' },
};

const DOCUMENT_CATEGORIES = [
  { code: 'IDENTITY', nameEn: 'Identity Documents', nameAz: 'Şəxsiyyət Sənədləri', nameRu: 'Удостоверения личности', displayOrder: 1 },
  { code: 'FINANCIAL', nameEn: 'Financial Documents', nameAz: 'Maliyyə Sənədləri', nameRu: 'Финансовые документы', displayOrder: 2 },
  { code: 'TRAVEL', nameEn: 'Travel & Insurance', nameAz: 'Səyahət və Sığorta', nameRu: 'Поездка и страховка', displayOrder: 3 },
  { code: 'ACCOMMODATION', nameEn: 'Accommodation Proof', nameAz: 'Qalacaq Yer Təsdiqi', nameRu: 'Подтверждение проживания', displayOrder: 4 },
  { code: 'EMPLOYMENT', nameEn: 'Employment & Income', nameAz: 'İş və Gəlir Sənədləri', nameRu: 'Работа и доходы', displayOrder: 5 },
  { code: 'EDUCATION', nameEn: 'Education & Study', nameAz: 'Təhsil Sənədləri', nameRu: 'Образование', displayOrder: 6 },
  { code: 'FAMILY', nameEn: 'Family & Civil Status', nameAz: 'Ailə Vəziyyəti Sənədləri', nameRu: 'Семейное положение', displayOrder: 7 },
  { code: 'PURPOSE_SPECIFIC', nameEn: 'Purpose-Specific Documents', nameAz: 'Məqsədə Uyğun Xüsusi Sənədlər', nameRu: 'Специальные документы по цели', displayOrder: 8 },
  { code: 'OTHER', nameEn: 'Additional Supporting Documents', nameAz: 'Əlavə Dəstəkləyici Sənədlər', nameRu: 'Дополнительные документы', displayOrder: 9 },
];

const GLOBAL_DOCUMENTS_SEED = [
  {
    documentCode: 'DOC-001',
    nameEn: 'Passport',
    nameAz: 'Xarici pasportun əsas səhifəsi',
    nameRu: 'Заграничный паспорт',
    descriptionEn: 'Valid passport issued within the last 10 years, valid for at least 3 months beyond the planned return date, with at least two blank pages.',
    descriptionAz: 'Son 10 ildə verilmiş, səfərdən dönüş tarixindən sonra ən azı 3 ay etibarlı olan və ən azı 2 boş səhifəsi olan xarici pasport.',
    category: 'IDENTITY',
    defaultRequired: true,
    legacyDocCode: 'PASSPORT',
  },
  {
    documentCode: 'DOC-002',
    nameEn: 'Biometric Photograph',
    nameAz: 'Biometrik fotoşəkil (3.5x4.5 sm)',
    nameRu: 'Биометрическое фото (3.5x4.5 см)',
    descriptionEn: 'Two recent ICAO-compliant color biometric photos (35x45mm) on a white background taken within the last 6 months.',
    descriptionAz: 'Son 6 ayda ağ fonda çəkilmiş 3.5x4.5 sm ölçülü ICAO standartlı biometrik fotoşəkil.',
    category: 'IDENTITY',
    defaultRequired: true,
    legacyDocCode: 'BIOMETRIC_PHOTO',
  },
  {
    documentCode: 'DOC-003',
    nameEn: 'Bank Statement (Last 3 Months)',
    nameAz: 'Maddi vəziyyəti təsdiq edən bank çıxarışı (son 3 ay)',
    nameRu: 'Выписка из банка за последние 3 месяца',
    descriptionEn: 'Official stamped bank account statement showing transaction history and closing balance for the last 3 months.',
    descriptionAz: 'Son 3 ayın dövriyyəsini və cari qalığı göstərən möhürlü rəsmi bank arayışı və çıxarışı.',
    category: 'FINANCIAL',
    defaultRequired: true,
    legacyDocCode: 'BANK_STATEMENT',
  },
  {
    documentCode: 'DOC-004',
    nameEn: 'Employment Verification Letter',
    nameAz: 'İş yerindən arayış (vəzifə və əməkhaqqı göstərilməklə)',
    nameRu: 'Справка с места работы',
    descriptionEn: 'Official letter from employer on company letterhead stating position, salary, start date, and approved leave duration.',
    descriptionAz: 'İş yerindən rəsmi blankda vəzifə, maaş, işə başlama tarixi və məzuniyyət müddəti göstərilən arayış.',
    category: 'EMPLOYMENT',
    defaultRequired: true,
    legacyDocCode: 'EMPLOYMENT_LETTER',
  },
  {
    documentCode: 'DOC-005',
    nameEn: 'Proof of Accommodation',
    nameAz: 'Otel və ya qalacaq yer təsdiqi',
    nameRu: 'Подтверждение бронирования отеля / жилья',
    descriptionEn: 'Confirmed hotel reservation, rental agreement, or official host accommodation attestation covering the entire stay.',
    descriptionAz: 'Bütün səfər müddətini əhatə edən təsdiqlənmiş otel bronu və ya dəvət edən şəxsin ev təsdiqi.',
    category: 'ACCOMMODATION',
    defaultRequired: true,
    legacyDocCode: 'ACCOMMODATION',
  },
  {
    documentCode: 'DOC-006',
    nameEn: 'Flight Itinerary / Roundtrip Reservation',
    nameAz: 'Gediş-dönüş uçuş bileti rezervasiyası',
    nameRu: 'Бронь авиабилетов туда и обратно',
    descriptionEn: 'Roundtrip flight reservation or transport booking showing entry and exit dates for the destination.',
    descriptionAz: 'Gediş və dönüş tarixlərini əks etdirən təyyarə bileti bronu.',
    category: 'TRAVEL',
    defaultRequired: true,
    legacyDocCode: 'FLIGHT_ITINERARY',
  },
  {
    documentCode: 'DOC-007',
    nameEn: 'Travel Medical Insurance (€30,000 Coverage)',
    nameAz: 'Səyahət tibbi sığortası (minimum €30,000 təminatla)',
    nameRu: 'Медицинская страховка для путешествий (€30,000)',
    descriptionEn: 'Travel medical insurance valid across all Schengen states covering emergency medical care and repatriation up to €30,000.',
    descriptionAz: 'Bütün Şengen ölkələrində keçərli olan minimum €30,000 təminatlı tibbi səyahət sığortası.',
    category: 'TRAVEL',
    defaultRequired: true,
    legacyDocCode: 'INSURANCE',
  },
  {
    documentCode: 'DOC-008',
    nameEn: 'Business Invitation Letter',
    nameAz: 'Rəsmi işgüzar dəvətnamə (Business Invitation)',
    nameRu: 'Деловое приглашение от принимающей компании',
    descriptionEn: 'Signed invitation letter from the host company/organization in the destination country stating purpose, dates, and cost coverage.',
    descriptionAz: 'Qəbul edən şirkət və ya təşkilat tərəfindən imzalanmış, səfərin məqsədini və tarixlərini göstərən rəsmi işgüzar dəvətnamə.',
    category: 'PURPOSE_SPECIFIC',
    defaultRequired: true,
    legacyDocCode: 'BUSINESS_INVITATION',
  },
  {
    documentCode: 'DOC-009',
    nameEn: 'Private / Family Visit Invitation & Host ID',
    nameAz: 'Ailə / şəxsi dəvətnamə (Attestation d’accueil) və dəvətçinin sənədi',
    nameRu: 'Частное приглашение и документ принимающего лица',
    descriptionEn: 'Official municipal invitation (e.g., Attestation d’accueil) and copy of the host’s passport or residence permit.',
    descriptionAz: 'Bələdiyyə tərəfindən təsdiqlənmiş dəvətnamə və dəvət edən şəxsin pasport/yaşayış icazəsi surəti.',
    category: 'FAMILY',
    defaultRequired: true,
    legacyDocCode: 'FAMILY_INVITATION',
  },
  {
    documentCode: 'DOC-010',
    nameEn: 'Medical Institution Confirmation Letter',
    nameAz: 'Klinika / Xəstəxana qəbul təsdiqi və tibbi rəy',
    nameRu: 'Подтверждение из медицинского учреждения',
    descriptionEn: 'Official document from the receiving hospital/clinic confirming medical appointment, estimated duration, and treatment cost.',
    descriptionAz: 'Müalicə aparılacaq xəstəxana və ya klinikadan qəbul tarixi, müalicə müddəti və xərci barədə rəsmi təsdiq.',
    category: 'PURPOSE_SPECIFIC',
    defaultRequired: true,
    legacyDocCode: 'MEDICAL_LETTER',
  },
  {
    documentCode: 'DOC-011',
    nameEn: 'University Admission / Enrollment Certificate',
    nameAz: 'Universitet qəbul sənədi (Campus France / Admission Letter)',
    nameRu: 'Сертификат о зачислении в университет',
    descriptionEn: 'Official unconditional admission or enrollment certificate from an accredited educational institution.',
    descriptionAz: 'Akkreditə olunmuş ali təhsil müəssisəsindən rəsmi qəbul və ya qeydiyyat sənədi.',
    category: 'EDUCATION',
    defaultRequired: true,
    legacyDocCode: 'STUDY_ADMISSION',
  },
  {
    documentCode: 'DOC-012',
    nameEn: 'Work Contract & Ministry Work Permit Authorization',
    nameAz: 'Əmək müqaviləsi və rəsmi iş icazəsi təsdiqi',
    nameRu: 'Трудовой договор и разрешение на работу',
    descriptionEn: 'Signed employment contract and work authorization issued by the competent labor authority of the destination country.',
    descriptionAz: 'İmzalanmış əmək müqaviləsi və hədəf ölkənin müvafiq qurumu tərəfindən verilmiş iş icazəsi.',
    category: 'EMPLOYMENT',
    defaultRequired: true,
    legacyDocCode: 'WORK_CONTRACT',
  },
];

const GLOBAL_QUESTIONS_SEED = [
  // Category 1: Your Plans
  {
    questionCode: 'Q001',
    titleEn: 'Planned Arrival Date',
    titleAz: 'Planlaşdırılan Gəliş Tarixi',
    officialTextEn: 'Intended date of arrival in the destination / Schengen area',
    officialTextAz: 'Hədəf ölkəyə / Şengen zonasına planlaşdırılan giriş tarixi',
    defaultCategoryName: '1. Your Plans',
    categoryCode: 'YOUR_PLANS',
    answerType: 'DATE',
    defaultRequired: true,
    schengenPdfFieldKey: 'arrivalDate',
    order: 1,
  },
  {
    questionCode: 'Q002',
    titleEn: 'Planned Departure Date',
    titleAz: 'Planlaşdırılan Çıxış Tarixi',
    officialTextEn: 'Intended date of departure from the destination / Schengen area',
    officialTextAz: 'Hədəf ölkədən / Şengen zonasından planlaşdırılan çıxış tarixi',
    defaultCategoryName: '1. Your Plans',
    categoryCode: 'YOUR_PLANS',
    answerType: 'DATE',
    defaultRequired: true,
    schengenPdfFieldKey: 'departureDate',
    order: 2,
  },
  {
    questionCode: 'Q003',
    titleEn: 'Number of Entries Requested',
    titleAz: 'Tələb Olunan Giriş Sayı',
    officialTextEn: 'Number of entries requested',
    officialTextAz: 'Tələb olunan girişlərin sayı',
    defaultCategoryName: '1. Your Plans',
    categoryCode: 'YOUR_PLANS',
    answerType: 'SINGLE_SELECT',
    defaultRequired: true,
    schengenPdfFieldKey: 'numberOfEntries',
    order: 3,
    options: [
      { optionCode: 'OPT_ENTRY_SINGLE', labelEn: 'Single Entry', labelAz: 'Tək giriş (Single)' },
      { optionCode: 'OPT_ENTRY_TWO', labelEn: 'Two Entries', labelAz: 'İki giriş (Two)' },
      { optionCode: 'OPT_ENTRY_MULTIPLE', labelEn: 'Multiple Entries', labelAz: 'Çoxsaylı giriş (Multiple)' },
    ],
  },
  {
    questionCode: 'Q004',
    titleEn: 'Member State of First Entry',
    titleAz: 'İlk Giriş Ediləcək Üzv Ölkə',
    officialTextEn: 'Member State of first entry into the Schengen area',
    officialTextAz: 'Şengen zonasına ilk giriş ediləcək ölkə',
    defaultCategoryName: '1. Your Plans',
    categoryCode: 'YOUR_PLANS',
    answerType: 'COUNTRY_SELECT',
    defaultRequired: true,
    schengenPdfFieldKey: 'firstEntryCountry',
    order: 4,
  },
  {
    questionCode: 'Q005',
    titleEn: 'Previous Schengen Fingerprints Collected',
    titleAz: 'Əvvəl Şengen Viza Üçün Barmaq İzi Verilibmi?',
    officialTextEn: 'Have your fingerprints been collected previously for the purpose of applying for a Schengen visa?',
    officialTextAz: 'Əvvəllər Şengen vizası müraciəti üçün barmaq iziniz götürülübmü?',
    defaultCategoryName: '1. Your Plans',
    categoryCode: 'YOUR_PLANS',
    answerType: 'YES_NO',
    defaultRequired: true,
    schengenPdfFieldKey: 'fingerprintsTaken',
    order: 5,
  },

  // Category 2: Your Information
  {
    questionCode: 'Q006',
    titleEn: 'Surname (Family Name)',
    titleAz: 'Soyad (Pasportdakı kimi)',
    officialTextEn: 'Surname (Family name) exactly as shown in travel document',
    officialTextAz: 'Soyadınız (xarici pasportda göstərildiyi kimi)',
    defaultCategoryName: '2. Your Information',
    categoryCode: 'YOUR_INFORMATION',
    answerType: 'TEXT',
    defaultRequired: true,
    schengenPdfFieldKey: 'lastName',
    order: 6,
  },
  {
    questionCode: 'Q007',
    titleEn: 'First Name(s) (Given Names)',
    titleAz: 'Ad (Pasportdakı kimi)',
    officialTextEn: 'First name(s) (Given name(s)) exactly as shown in travel document',
    officialTextAz: 'Adınız (xarici pasportda göstərildiyi kimi)',
    defaultCategoryName: '2. Your Information',
    categoryCode: 'YOUR_INFORMATION',
    answerType: 'TEXT',
    defaultRequired: true,
    schengenPdfFieldKey: 'firstName',
    order: 7,
  },
  {
    questionCode: 'Q008',
    titleEn: 'Date of Birth',
    titleAz: 'Doğum Tarixi',
    officialTextEn: 'Date of birth (day-month-year)',
    officialTextAz: 'Doğum tarixi (gün-ay-il)',
    defaultCategoryName: '2. Your Information',
    categoryCode: 'YOUR_INFORMATION',
    answerType: 'DATE',
    defaultRequired: true,
    schengenPdfFieldKey: 'birthDate',
    order: 8,
  },
  {
    questionCode: 'Q009',
    titleEn: 'Gender / Sex',
    titleAz: 'Cins',
    officialTextEn: 'Sex',
    officialTextAz: 'Cinsiniz',
    defaultCategoryName: '2. Your Information',
    categoryCode: 'YOUR_INFORMATION',
    answerType: 'SINGLE_SELECT',
    defaultRequired: true,
    schengenPdfFieldKey: 'gender',
    order: 9,
    options: [
      { optionCode: 'OPT_GENDER_MALE', labelEn: 'Male', labelAz: 'Kişi' },
      { optionCode: 'OPT_GENDER_FEMALE', labelEn: 'Female', labelAz: 'Qadın' },
    ],
  },
  {
    questionCode: 'Q010',
    titleEn: 'Marital Status',
    titleAz: 'Ailə Vəziyyəti',
    officialTextEn: 'Civil / Marital status',
    officialTextAz: 'Ailə vəziyyətiniz',
    defaultCategoryName: '2. Your Information',
    categoryCode: 'YOUR_INFORMATION',
    answerType: 'SINGLE_SELECT',
    defaultRequired: true,
    schengenPdfFieldKey: 'maritalStatus',
    order: 10,
    options: [
      { optionCode: 'OPT_MARITAL_SINGLE', labelEn: 'Single', labelAz: 'Subay' },
      { optionCode: 'OPT_MARITAL_MARRIED', labelEn: 'Married', labelAz: 'Evli' },
      { optionCode: 'OPT_MARITAL_DIVORCED', labelEn: 'Divorced', labelAz: 'Boşanmış' },
      { optionCode: 'OPT_MARITAL_WIDOWED', labelEn: 'Widowed', labelAz: 'Dul' },
    ],
  },
  {
    questionCode: 'Q011',
    titleEn: 'Spouse Full Name',
    titleAz: 'Həyat Yoldaşının Tam Adı və Soyadı',
    officialTextEn: 'Spouse’s full name (if married)',
    officialTextAz: 'Həyat yoldaşınızın ad və soyadı (əgər evlisinizsə)',
    defaultCategoryName: '2. Your Information',
    categoryCode: 'YOUR_INFORMATION',
    answerType: 'TEXT',
    defaultRequired: false,
    schengenPdfFieldKey: 'spouseName',
    order: 11,
  },
  {
    questionCode: 'Q012',
    titleEn: 'National Identity Number (FIN / PIN)',
    titleAz: 'FİN Kod (Şəxsiyyət vəsiqəsi)',
    officialTextEn: 'National identity number, where applicable',
    officialTextAz: 'Milli şəxsiyyət vəsiqəsinin FİN kodu',
    defaultCategoryName: '2. Your Information',
    categoryCode: 'YOUR_INFORMATION',
    answerType: 'TEXT',
    defaultRequired: true,
    schengenPdfFieldKey: 'nationalIdNumber',
    order: 12,
  },

  // Category 3: Travel Document
  {
    questionCode: 'Q013',
    titleEn: 'Type of Travel Document',
    titleAz: 'Səyahət Sənədinin Növü',
    officialTextEn: 'Type of travel document',
    officialTextAz: 'Pasportun / səyahət sənədinin növü',
    defaultCategoryName: '3. Travel Document',
    categoryCode: 'TRAVEL_DOCUMENT',
    answerType: 'SINGLE_SELECT',
    defaultRequired: true,
    schengenPdfFieldKey: 'passportType',
    order: 13,
    options: [
      { optionCode: 'OPT_DOC_ORDINARY_PASSPORT', labelEn: 'Ordinary Passport', labelAz: 'Ümumvətəndaş pasportu' },
      { optionCode: 'OPT_DOC_DIPLOMATIC_PASSPORT', labelEn: 'Diplomatic Passport', labelAz: 'Diplomatik pasport' },
      { optionCode: 'OPT_DOC_SERVICE_PASSPORT', labelEn: 'Service / Official Passport', labelAz: 'Xidməti pasport' },
    ],
  },
  {
    questionCode: 'Q014',
    titleEn: 'Passport Number',
    titleAz: 'Xarici Pasportun Seriya və Nömrəsi',
    officialTextEn: 'Number of travel document',
    officialTextAz: 'Səyahət sənədinin (pasportun) nömrəsi',
    defaultCategoryName: '3. Travel Document',
    categoryCode: 'TRAVEL_DOCUMENT',
    answerType: 'TEXT',
    defaultRequired: true,
    schengenPdfFieldKey: 'passportNumber',
    order: 14,
  },
  {
    questionCode: 'Q015',
    titleEn: 'Passport Issue Date',
    titleAz: 'Pasportun Verilmə Tarixi',
    officialTextEn: 'Date of issue of travel document',
    officialTextAz: 'Pasportun verilmə tarixi',
    defaultCategoryName: '3. Travel Document',
    categoryCode: 'TRAVEL_DOCUMENT',
    answerType: 'DATE',
    defaultRequired: true,
    schengenPdfFieldKey: 'passportIssueDate',
    order: 15,
  },
  {
    questionCode: 'Q016',
    titleEn: 'Passport Expiry Date',
    titleAz: 'Pasportun Bitmə (Etibarlılıq) Tarixi',
    officialTextEn: 'Valid until (expiry date of travel document)',
    officialTextAz: 'Pasportun etibarlılıq müddətinin bitmə tarixi',
    defaultCategoryName: '3. Travel Document',
    categoryCode: 'TRAVEL_DOCUMENT',
    answerType: 'DATE',
    defaultRequired: true,
    schengenPdfFieldKey: 'passportExpiryDate',
    order: 16,
  },

  // Category 4: Your Stay & Sponsor
  {
    questionCode: 'Q017',
    titleEn: 'Hotel / Host Name & Address in Destination',
    titleAz: 'Qalacağınız Otelin və ya Dəvətçinin Ünvanı',
    officialTextEn: 'Surname and first name of the inviting person(s) in the Member State(s) or name of hotel(s) or temporary accommodation(s)',
    officialTextAz: 'Qəbul edən şəxsin / şirkətin və ya otelin adı və tam ünvanı',
    defaultCategoryName: '4. Your Stay & Sponsor',
    categoryCode: 'YOUR_STAY_AND_SPONSOR',
    answerType: 'ADDRESS',
    defaultRequired: true,
    schengenPdfFieldKey: 'accommodationName',
    order: 17,
  },
  {
    questionCode: 'Q018',
    titleEn: 'Travel & Living Costs Sponsor',
    titleAz: 'Səfər və Yaşayış Xərclərini Kim Qarşılayır?',
    officialTextEn: 'Cost of travelling and living during the applicant’s stay is covered by',
    officialTextAz: 'Səfər və qalma xərcləri kim tərəfindən qarşılanır?',
    defaultCategoryName: '4. Your Stay & Sponsor',
    categoryCode: 'YOUR_STAY_AND_SPONSOR',
    answerType: 'SINGLE_SELECT',
    defaultRequired: true,
    schengenPdfFieldKey: 'fundingSource',
    order: 18,
    options: [
      { optionCode: 'OPT_SPONSOR_SELF', labelEn: 'By the applicant himself/herself', labelAz: 'Müraciətçinin özü tərəfindən' },
      { optionCode: 'OPT_SPONSOR_HOST', labelEn: 'By a sponsor (host, relative)', labelAz: 'Sponsor / dəvət edən şəxs tərəfindən' },
      { optionCode: 'OPT_SPONSOR_INVITING_COMPANY', labelEn: 'By the inviting company / organization', labelAz: 'Dəvət edən şirkət / təşkilat tərəfindən' },
    ],
  },

  // Category 5: Contacts & Job
  {
    questionCode: 'Q019',
    titleEn: 'Applicant Home Address & Email',
    titleAz: 'Faktiki Yaşayış Ünvanı',
    officialTextEn: 'Applicant’s home address and e-mail address',
    officialTextAz: 'Müraciətçinin faktiki yaşayış ünvanı',
    defaultCategoryName: '5. Contacts & Job',
    categoryCode: 'CONTACTS_AND_JOB',
    answerType: 'TEXTAREA',
    defaultRequired: true,
    schengenPdfFieldKey: 'homeAddress',
    order: 19,
  },
  {
    questionCode: 'Q020',
    titleEn: 'Applicant Email Address',
    titleAz: 'Elektron Poçt Ünvanı (Email)',
    officialTextEn: 'E-mail address',
    officialTextAz: 'Əlaqə üçün elektron poçt ünvanı',
    defaultCategoryName: '5. Contacts & Job',
    categoryCode: 'CONTACTS_AND_JOB',
    answerType: 'EMAIL',
    defaultRequired: true,
    schengenPdfFieldKey: 'email',
    order: 20,
  },
  {
    questionCode: 'Q021',
    titleEn: 'Mobile Telephone Number',
    titleAz: 'Mobil Telefon Nömrəsi',
    officialTextEn: 'Telephone number(s)',
    officialTextAz: 'Əlaqə telefon nömrəsi',
    defaultCategoryName: '5. Contacts & Job',
    categoryCode: 'CONTACTS_AND_JOB',
    answerType: 'PHONE',
    defaultRequired: true,
    schengenPdfFieldKey: 'phone',
    order: 21,
  },
  {
    questionCode: 'Q022',
    titleEn: 'Current Occupation / Employment Status',
    titleAz: 'Hazırkı Məşğulluq Statusu',
    officialTextEn: 'Current occupation / employment status',
    officialTextAz: 'Hazırkı peşə və məşğulluq vəziyyəti',
    defaultCategoryName: '5. Contacts & Job',
    categoryCode: 'CONTACTS_AND_JOB',
    answerType: 'SINGLE_SELECT',
    defaultRequired: true,
    schengenPdfFieldKey: 'currentOccupation',
    order: 22,
    options: [
      { optionCode: 'OPT_EMPLOYMENT_EMPLOYED', labelEn: 'Employed', labelAz: 'İşləyir (Muzdlu işçi)' },
      { optionCode: 'OPT_EMPLOYMENT_SELF_EMPLOYED', labelEn: 'Self-Employed / Business Owner', labelAz: 'Fərdi sahibkar / Özünüməşğul' },
      { optionCode: 'OPT_EMPLOYMENT_STUDENT', labelEn: 'Student', labelAz: 'Tələbə' },
      { optionCode: 'OPT_EMPLOYMENT_RETIRED', labelEn: 'Retired', labelAz: 'Təqaüdçü' },
      { optionCode: 'OPT_EMPLOYMENT_UNEMPLOYED', labelEn: 'Unemployed', labelAz: 'İşsiz' },
    ],
  },
  {
    questionCode: 'Q023',
    titleEn: 'Employer or Educational Institution Name & Address',
    titleAz: 'İş Yerinin və ya Təhsil Müəssisəsinin Adı, Ünvanı və Telefonu',
    officialTextEn: 'Employer and employer’s address and telephone number. For students, name and address of educational establishment',
    officialTextAz: 'İşəgötürənin (tələbələr üçün təhsil müəssisəsinin) adı, ünvanı və telefonu',
    defaultCategoryName: '5. Contacts & Job',
    categoryCode: 'CONTACTS_AND_JOB',
    answerType: 'TEXT',
    defaultRequired: false,
    schengenPdfFieldKey: 'employerName',
    order: 23,
  },
];

const COUNTRY_OFFICES_SEED = {
  FR: {
    vac: {
      providerName: 'Capago',
      centreName: 'Capago France Visa Application Centre — Baku',
      city: 'Baku',
      locationCountryCode: 'AZ',
      locationCountryName: 'Azerbaijan',
      address: 'Globus Center, 609 Jafar Jabbarli Street, 14th Floor, Baku, Azerbaijan',
      telephone: '+994 12 310 07 10',
      email: 'infofrance-az@capago.eu',
      officialWebsite: 'https://www.capago.eu/',
      appointmentBookingUrl: 'https://fr-az.capago.eu/',
      workingHours: 'Mon–Fri 09:00 – 17:00',
    },
    embassy: {
      responsibleAuthority: 'Embassy of France in Baku',
      city: 'Baku',
      locationCountryCode: 'AZ',
      locationCountryName: 'Azerbaijan',
      address: '9 Rasul Rza Street, Baku, Azerbaijan',
      telephone: '+994 12 490 81 00',
      email: 'visas.bakou-amba@diplomatie.gouv.fr',
      officialWebsite: 'https://az.ambafrance.org/',
      visaInformationUrl: 'https://france-visas.gouv.fr/',
      consularHours: 'Mon–Fri 09:00 – 12:30',
    },
  },
  DE: {
    vac: {
      providerName: 'Visametric',
      centreName: 'Visametric Germany Visa Application Centre — Baku',
      city: 'Baku',
      locationCountryCode: 'AZ',
      locationCountryName: 'Azerbaijan',
      address: 'Dilara Aliyeva Street 235A, Baku, Azerbaijan',
      telephone: '+994 12 599 88 12',
      email: 'info.baku@visametric.com',
      officialWebsite: 'https://www.visametric.com/Azerbaijan/Germany/',
      appointmentBookingUrl: 'https://www.visametric.com/Azerbaijan/Germany/en/appointment',
      workingHours: 'Mon–Fri 08:30 – 16:30',
    },
    embassy: {
      responsibleAuthority: 'Embassy of the Federal Republic of Germany in Baku',
      city: 'Baku',
      locationCountryCode: 'AZ',
      locationCountryName: 'Azerbaijan',
      address: 'ISR Plaza, Nizami Street 69, Baku, Azerbaijan',
      telephone: '+994 12 465 41 00',
      email: 'visa@baku.diplo.de',
      officialWebsite: 'https://baku.diplo.de/',
      visaInformationUrl: 'https://baku.diplo.de/az-az/service/05-VisaEinreise',
      consularHours: 'Mon–Fri 09:00 – 12:00',
    },
  },
};

const STANDARD_CATEGORIES_FOR_PURPOSE = [
  { code: 'YOUR_PLANS', nameEn: '1. Your Plans', nameAz: '1. Səyahət Planınız', nameRu: '1. Ваши планы', displayOrder: 1 },
  { code: 'YOUR_INFORMATION', nameEn: '2. Your Information', nameAz: '2. Şəxsi Məlumatlarınız', nameRu: '2. Личные данные', displayOrder: 2 },
  { code: 'TRAVEL_DOCUMENT', nameEn: '3. Travel Document', nameAz: '3. Səyahət Sənədi (Pasport)', nameRu: '3. Проездной документ', displayOrder: 3 },
  { code: 'YOUR_STAY_AND_SPONSOR', nameEn: '4. Your Stay & Sponsor', nameAz: '4. Qalacaq Yer və Sponsor', nameRu: '4. Проживание и спонсор', displayOrder: 4 },
  { code: 'CONTACTS_AND_JOB', nameEn: '5. Contacts & Job', nameAz: '5. Əlaqə və İş Məlumatları', nameRu: '5. Контакты и работа', displayOrder: 5 },
];

async function migrateVcmsBaseline(prisma = prismaDefault) {
  try {
    // 1. Seed Document Categories
    const docCatMap = {};
    for (const dc of DOCUMENT_CATEGORIES) {
      const cat = await prisma.documentCategory.upsert({
        where: { code: dc.code },
        update: { nameEn: dc.nameEn, nameAz: dc.nameAz, nameRu: dc.nameRu, displayOrder: dc.displayOrder },
        create: dc,
      });
      docCatMap[dc.code] = cat;
    }

    // 2. Seed Global Document Pool (DOC-001 .. DOC-012)
    const globalDocMap = {};
    for (const gd of GLOBAL_DOCUMENTS_SEED) {
      const doc = await prisma.globalDocument.upsert({
        where: { documentCode: gd.documentCode },
        update: {
          documentCategoryId: docCatMap[gd.category]?.id || null,
          legacyDocCode: gd.legacyDocCode,
        },
        create: {
          documentCode: gd.documentCode,
          nameEn: gd.nameEn,
          nameAz: gd.nameAz,
          nameRu: gd.nameRu,
          descriptionEn: gd.descriptionEn,
          descriptionAz: gd.descriptionAz,
          category: gd.category,
          documentCategoryId: docCatMap[gd.category]?.id || null,
          defaultRequired: gd.defaultRequired,
          isReusable: true,
          allowedFormats: 'pdf,jpg,jpeg,png',
          maxFileSizeMb: 15,
          legacyDocCode: gd.legacyDocCode,
          status: 'ACTIVE',
        },
      });
      globalDocMap[gd.documentCode] = doc;
      if (gd.legacyDocCode) {
        globalDocMap[gd.legacyDocCode] = doc;
      }
    }

    // 3. Seed Global Question Pool (Q001 .. Q023) & Options (OPT_*)
    const globalQuestionMap = {};
    for (const gq of GLOBAL_QUESTIONS_SEED) {
      const question = await prisma.globalQuestion.upsert({
        where: { questionCode: gq.questionCode },
        update: {
          schengenPdfFieldKey: gq.schengenPdfFieldKey,
        },
        create: {
          questionCode: gq.questionCode,
          titleEn: gq.titleEn,
          titleAz: gq.titleAz,
          officialTextEn: gq.officialTextEn,
          officialTextAz: gq.officialTextAz,
          defaultCategoryName: gq.defaultCategoryName,
          answerType: gq.answerType,
          defaultRequired: gq.defaultRequired,
          isReusable: true,
          isRepeatable: false,
          schengenPdfFieldKey: gq.schengenPdfFieldKey,
          status: 'ACTIVE',
        },
      });
      globalQuestionMap[gq.questionCode] = { ...question, categoryCode: gq.categoryCode, order: gq.order };

      if (Array.isArray(gq.options)) {
        for (let i = 0; i < gq.options.length; i++) {
          const opt = gq.options[i];
          await prisma.globalQuestionOption.upsert({
            where: { optionCode: opt.optionCode },
            update: {
              labelEn: opt.labelEn,
              labelAz: opt.labelAz,
              displayOrder: i + 1,
            },
            create: {
              globalQuestionId: question.id,
              optionCode: opt.optionCode,
              labelEn: opt.labelEn,
              labelAz: opt.labelAz,
              displayOrder: i + 1,
              isActive: true,
            },
          });
        }
      }
    }

    // 4. Upgrade all Countries, create VisaTypes, VisaPurposes, Question/Document configs, Visa Offices & Appointment Providers
    const countries = await prisma.country.findMany({
      include: { visaCategories: true },
    });

    for (const country of countries) {
      const profile = COUNTRY_PROFILES[country.code] || {
        flagEmoji: country.code || 'EU',
        region: 'Europe',
        isSchengen: country.code !== 'TR',
        displayOrder: 10,
        processingDaysLabel: '15 business days',
      };

      await prisma.country.update({
        where: { id: country.id },
        data: {
          flagEmoji: profile.flagEmoji,
          region: country.region || profile.region,
          isSchengen: profile.isSchengen,
          status: country.isActive ? 'ACTIVE' : 'INACTIVE',
          displayOrder: country.displayOrder || profile.displayOrder,
          processingDaysLabel: country.processingDaysLabel || profile.processingDaysLabel,
        },
      });

      const touristLegacyCat = country.visaCategories.find((c) => c.code === 'SCHENGEN_TOURIST') || country.visaCategories[0];
      const businessLegacyCat = country.visaCategories.find((c) => c.code === 'SCHENGEN_BUSINESS') || touristLegacyCat;
      const nationalLegacyCat = country.visaCategories.find((c) => c.code === 'NATIONAL_D') || touristLegacyCat;

      // 4.1 Ensure Short Stay Visa (C)
      const shortStayType = await prisma.visaType.upsert({
        where: { countryId_code: { countryId: country.id, code: 'SHORT_STAY_C' } },
        update: {},
        create: {
          countryId: country.id,
          code: 'SHORT_STAY_C',
          nameEn: country.code === 'TR' ? 'Short Stay Visitor Visa' : 'Short Stay Visa (Type C)',
          nameAz: country.code === 'TR' ? 'Qısamüddətli Ziyarət Vizası' : 'Qısamüddətli Şengen Vizası (C)',
          nameRu: 'Краткосрочная виза (C)',
          descriptionEn: 'Short-stay visa for stays up to 90 days within any 180-day period.',
          descriptionAz: '180 gün ərzində 90 günədək qısamüddətli səfərlər üçün viza.',
          stayCategory: 'SHORT',
          maxDurationDays: 90,
          maxDurationLabel: 'Up to 90 days in any 180-day period',
          defaultFeeEur: 80.0,
          status: 'ACTIVE',
          displayOrder: 1,
        },
      });

      // 4.2 Ensure Long Stay Visa (D)
      const longStayType = await prisma.visaType.upsert({
        where: { countryId_code: { countryId: country.id, code: 'LONG_STAY_D' } },
        update: {},
        create: {
          countryId: country.id,
          code: 'LONG_STAY_D',
          nameEn: 'Long Stay / National Visa (Type D)',
          nameAz: 'Uzunmüddətli Milli Viza (D)',
          nameRu: 'Долгосрочная национальная виза (D)',
          descriptionEn: 'National long-stay visa for stays exceeding 90 days (study, employment, family reunification).',
          descriptionAz: '90 gündən artıq təhsil, iş və ailə birləşməsi məqsədli milli viza.',
          stayCategory: 'LONG',
          maxDurationDays: 365,
          maxDurationLabel: 'More than 90 days (National D)',
          defaultFeeEur: 99.0,
          status: 'ACTIVE',
          displayOrder: 2,
        },
      });

      // 4.3 Purposes under Short Stay & Long Stay
      const purposesSpec = [
        {
          visaTypeId: shortStayType.id,
          code: 'TOURISM',
          nameEn: 'Tourism',
          nameAz: 'Turizm',
          nameRu: 'Туризм',
          descriptionEn: 'Leisure travel, sightseeing, and holiday visits.',
          legacyVisaCategoryId: touristLegacyCat?.id || null,
          displayOrder: 1,
          extraDocs: [],
        },
        {
          visaTypeId: shortStayType.id,
          code: 'BUSINESS',
          nameEn: 'Business',
          nameAz: 'Biznes / İşgüzar Səfər',
          nameRu: 'Бизнес / Деловая поездка',
          descriptionEn: 'Business meetings, conferences, trade fairs, and corporate negotiations.',
          legacyVisaCategoryId: businessLegacyCat?.id || null,
          displayOrder: 2,
          extraDocs: ['DOC-008'],
        },
        {
          visaTypeId: shortStayType.id,
          code: 'FAMILY_PRIVATE',
          nameEn: 'Family / Private Visit',
          nameAz: 'Ailə və ya Dost Ziyarəti',
          nameRu: 'Посещение семьи / друзей',
          descriptionEn: 'Visiting family members, relatives, or friends legally residing in the destination country.',
          legacyVisaCategoryId: touristLegacyCat?.id || null,
          displayOrder: 3,
          extraDocs: ['DOC-009'],
        },
        {
          visaTypeId: shortStayType.id,
          code: 'MEDICAL',
          nameEn: 'Medical Treatment',
          nameAz: 'Tibbi Müalicə',
          nameRu: 'Лечение',
          descriptionEn: 'Short-term medical consultation, diagnostics, or hospital treatment.',
          legacyVisaCategoryId: touristLegacyCat?.id || null,
          displayOrder: 4,
          extraDocs: ['DOC-010'],
        },
        {
          visaTypeId: longStayType.id,
          code: 'STUDY',
          nameEn: 'Study / Higher Education',
          nameAz: 'Təhsil (Universitet / Kollec)',
          nameRu: 'Учеба / Высшее образование',
          descriptionEn: 'Long-term academic study, university degree programs, or student exchange.',
          legacyVisaCategoryId: nationalLegacyCat?.id || null,
          displayOrder: 1,
          extraDocs: ['DOC-011'],
        },
        {
          visaTypeId: longStayType.id,
          code: 'EMPLOYMENT',
          nameEn: 'Employment / Work Permit',
          nameAz: 'Əmək Fəaliyyəti / İş Vizası',
          nameRu: 'Трудоустройство / Рабочая виза',
          descriptionEn: 'Salaried employment under an approved work contract.',
          legacyVisaCategoryId: nationalLegacyCat?.id || null,
          displayOrder: 2,
          extraDocs: ['DOC-012'],
        },
      ];

      for (const pSpec of purposesSpec) {
        const purpose = await prisma.visaPurpose.upsert({
          where: { visaTypeId_code: { visaTypeId: pSpec.visaTypeId, code: pSpec.code } },
          update: { legacyVisaCategoryId: pSpec.legacyVisaCategoryId },
          create: {
            visaTypeId: pSpec.visaTypeId,
            code: pSpec.code,
            nameEn: pSpec.nameEn,
            nameAz: pSpec.nameAz,
            nameRu: pSpec.nameRu,
            descriptionEn: pSpec.descriptionEn,
            legacyVisaCategoryId: pSpec.legacyVisaCategoryId,
            status: 'ACTIVE',
            displayOrder: pSpec.displayOrder,
          },
        });

        // Create 5 Question Categories for this purpose if none exist yet (batched for fast cold bootstrap)
        const existingQCount = await prisma.purposeQuestionConfig.count({
          where: { visaPurposeId: purpose.id },
        });

        if (existingQCount === 0) {
          await prisma.questionCategory.createMany({
            data: STANDARD_CATEGORIES_FOR_PURPOSE.map((catSpec) => ({
              visaPurposeId: purpose.id,
              code: catSpec.code,
              nameEn: catSpec.nameEn,
              nameAz: catSpec.nameAz,
              nameRu: catSpec.nameRu,
              displayOrder: catSpec.displayOrder,
              isActive: true,
            })),
            skipDuplicates: true,
          });

          const qCats = await prisma.questionCategory.findMany({
            where: { visaPurposeId: purpose.id },
          });
          const catMap = {};
          for (const qCat of qCats) {
            catMap[qCat.code] = qCat;
          }

          // Bind Global Questions (Q001..Q023) to this purpose in one batched insert
          const pqRows = [];
          for (const gq of GLOBAL_QUESTIONS_SEED) {
            const globalQ = globalQuestionMap[gq.questionCode];
            const qCat = catMap[gq.categoryCode];
            if (!globalQ || !qCat) continue;

            let conditionalLogicJson = undefined;
            if (gq.questionCode === 'Q011') {
              conditionalLogicJson = {
                operator: 'AND',
                action: 'SHOW_AND_REQUIRE',
                rules: [{ questionCode: 'Q010', comparator: 'EQUALS', value: 'OPT_MARITAL_MARRIED' }],
              };
            } else if (gq.questionCode === 'Q023') {
              conditionalLogicJson = {
                operator: 'OR',
                action: 'SHOW_AND_REQUIRE',
                rules: [
                  { questionCode: 'Q022', comparator: 'EQUALS', value: 'OPT_EMPLOYMENT_EMPLOYED' },
                  { questionCode: 'Q022', comparator: 'EQUALS', value: 'OPT_EMPLOYMENT_SELF_EMPLOYED' },
                  { questionCode: 'Q022', comparator: 'EQUALS', value: 'OPT_EMPLOYMENT_STUDENT' },
                ],
              };
            }

            pqRows.push({
              visaPurposeId: purpose.id,
              categoryId: qCat.id,
              globalQuestionId: globalQ.id,
              isRequired: gq.defaultRequired,
              isRepeatable: false,
              officialFormOrder: gq.order,
              conditionalLogicJson,
              isActive: true,
            });
          }

          if (pqRows.length > 0) {
            await prisma.purposeQuestionConfig.createMany({
              data: pqRows,
              skipDuplicates: true,
            });

            // Attach relational QuestionCondition rows for Q011 and Q023
            const q11Id = globalQuestionMap.Q011?.id;
            const q23Id = globalQuestionMap.Q023?.id;
            const condTargets = await prisma.purposeQuestionConfig.findMany({
              where: {
                visaPurposeId: purpose.id,
                globalQuestionId: { in: [q11Id, q23Id].filter(Boolean) },
              },
              select: { id: true, globalQuestionId: true },
            });

            const conditionRows = [];
            for (const target of condTargets) {
              if (target.globalQuestionId === q11Id) {
                conditionRows.push({
                  purposeQuestionConfigId: target.id,
                  groupOperator: 'AND',
                  action: 'SHOW_AND_REQUIRE',
                  triggerQuestionCode: 'Q010',
                  comparator: 'EQUALS',
                  triggerValue: 'OPT_MARITAL_MARRIED',
                  displayOrder: 1,
                });
              } else if (target.globalQuestionId === q23Id) {
                conditionRows.push({
                  purposeQuestionConfigId: target.id,
                  groupOperator: 'OR',
                  action: 'SHOW_AND_REQUIRE',
                  triggerQuestionCode: 'Q022',
                  comparator: 'IN',
                  triggerValue: JSON.stringify(['OPT_EMPLOYMENT_EMPLOYED', 'OPT_EMPLOYMENT_SELF_EMPLOYED', 'OPT_EMPLOYMENT_STUDENT']),
                  displayOrder: 1,
                });
              }
            }
            if (conditionRows.length > 0) {
              await prisma.questionCondition.createMany({ data: conditionRows });
            }
          }
        }

        // Bind Required Documents to this purpose if none exist yet (batched for fast cold bootstrap)
        const existingDocCount = await prisma.purposeDocumentConfig.count({
          where: { visaPurposeId: purpose.id },
        });

        if (existingDocCount === 0) {
          const baseDocCodes = ['DOC-001', 'DOC-002', 'DOC-003', 'DOC-004', 'DOC-005', 'DOC-006', 'DOC-007', ...pSpec.extraDocs];
          const docRows = [];
          for (let idx = 0; idx < baseDocCodes.length; idx++) {
            const dCode = baseDocCodes[idx];
            const gDoc = globalDocMap[dCode];
            if (!gDoc) continue;
            docRows.push({
              visaPurposeId: purpose.id,
              globalDocumentId: gDoc.id,
              isRequired: true,
              displayOrder: idx + 1,
              isActive: true,
            });
          }

          if (docRows.length > 0) {
            await prisma.purposeDocumentConfig.createMany({
              data: docRows,
              skipDuplicates: true,
            });

            // Conditional rule on DOC-004 (Employment Letter): required when Q022 == OPT_EMPLOYMENT_EMPLOYED
            const doc004Id = globalDocMap['DOC-004']?.id;
            if (doc004Id) {
              const pDoc004 = await prisma.purposeDocumentConfig.findFirst({
                where: { visaPurposeId: purpose.id, globalDocumentId: doc004Id },
                select: { id: true },
              });
              if (pDoc004) {
                await prisma.documentCondition.create({
                  data: {
                    purposeDocumentConfigId: pDoc004.id,
                    groupOperator: 'AND',
                    action: 'SHOW_AND_REQUIRE',
                    triggerQuestionCode: 'Q022',
                    comparator: 'EQUALS',
                    triggerValue: 'OPT_EMPLOYMENT_EMPLOYED',
                  },
                });
              }
            }
          }
        }
      }

      // 4.4 Ensure Visa Application Centre, Embassy, CountryApplicationLocation (AZ), and AppointmentProviders
      const officeSeed = COUNTRY_OFFICES_SEED[country.code] || {
        vac: {
          providerName: 'VFS Global',
          centreName: `VFS Global ${country.nameEn} Visa Application Centre — Baku`,
          city: 'Baku',
          locationCountryCode: 'AZ',
          locationCountryName: 'Azerbaijan',
          address: ' Khojaly Avenue 37, Demirchi Tower, Baku, Azerbaijan',
          telephone: '+994 12 404 76 38',
          email: `info.${country.code.toLowerCase()}az@vfshelpline.com`,
          officialWebsite: 'https://www.vfsglobal.com/',
          appointmentBookingUrl: 'https://www.vfsglobal.com/',
          workingHours: 'Mon–Fri 09:00 – 16:00',
        },
        embassy: {
          responsibleAuthority: `Embassy of ${country.nameEn} in Baku`,
          city: 'Baku',
          locationCountryCode: 'AZ',
          locationCountryName: 'Azerbaijan',
          address: `Diplomatic Quarter, Baku, Azerbaijan (${country.nameEn} Consular Section)`,
          telephone: '+994 12 497 51 84',
          email: `consular.${country.code.toLowerCase()}@embassy-baku.org`,
          officialWebsite: `https://baku.embassy.${country.code.toLowerCase()}/`,
          visaInformationUrl: `https://baku.embassy.${country.code.toLowerCase()}/visas`,
          consularHours: 'Mon–Fri 09:30 – 12:30',
        },
      };

      let vac = await prisma.visaApplicationCentre.findFirst({
        where: { countryId: country.id, locationCountryCode: 'AZ' },
      });
      if (!vac) {
        vac = await prisma.visaApplicationCentre.create({
          data: {
            countryId: country.id,
            ...officeSeed.vac,
            status: 'ACTIVE',
            isPrimary: true,
          },
        });
      }

      let embassy = await prisma.embassy.findFirst({
        where: { countryId: country.id, locationCountryCode: 'AZ' },
      });
      if (!embassy) {
        embassy = await prisma.embassy.create({
          data: {
            countryId: country.id,
            ...officeSeed.embassy,
            status: 'ACTIVE',
            isPrimary: true,
          },
        });
      }

      await prisma.countryApplicationLocation.upsert({
        where: {
          destinationCountryId_applicantCountryCode: {
            destinationCountryId: country.id,
            applicantCountryCode: 'AZ',
          },
        },
        update: {
          visaApplicationCentreId: vac.id,
          embassyId: embassy.id,
        },
        create: {
          destinationCountryId: country.id,
          applicantCountryCode: 'AZ',
          applicantCountryName: 'Azerbaijan',
          visaApplicationCentreId: vac.id,
          embassyId: embassy.id,
          isDefault: true,
          status: 'ACTIVE',
        },
      });

      // 4.5 Ensure Appointment Providers (Embassy & Visa Centre) + ProviderVisaType Mappings
      let vacProvider = await prisma.appointmentProvider.findFirst({
        where: { countryId: country.id, providerType: 'VISA_APPLICATION_CENTRE', applicantCountryCode: 'AZ' },
      });
      if (!vacProvider) {
        vacProvider = await prisma.appointmentProvider.create({
          data: {
            countryId: country.id,
            providerType: 'VISA_APPLICATION_CENTRE',
            visaApplicationCentreId: vac.id,
            displayName: `${vac.providerName} Visa Centre (${vac.city})`,
            applicantCountryCode: 'AZ',
            timezone: 'Asia/Baku',
            defaultManagementMode: 'AUTOMATIC_GENERATION',
            status: 'ACTIVE',
          },
        });
      }

      await prisma.providerVisaType.upsert({
        where: { providerId_visaTypeId: { providerId: vacProvider.id, visaTypeId: shortStayType.id } },
        update: { isActive: true },
        create: {
          providerId: vacProvider.id,
          visaTypeId: shortStayType.id,
          isDefault: true,
          isActive: true,
        },
      });

      let embassyProvider = await prisma.appointmentProvider.findFirst({
        where: { countryId: country.id, providerType: 'EMBASSY', applicantCountryCode: 'AZ' },
      });
      if (!embassyProvider) {
        embassyProvider = await prisma.appointmentProvider.create({
          data: {
            countryId: country.id,
            providerType: 'EMBASSY',
            embassyId: embassy.id,
            displayName: embassy.responsibleAuthority,
            applicantCountryCode: 'AZ',
            timezone: 'Asia/Baku',
            defaultManagementMode: 'AUTOMATIC_GENERATION',
            status: 'ACTIVE',
          },
        });
      }

      await prisma.providerVisaType.upsert({
        where: { providerId_visaTypeId: { providerId: embassyProvider.id, visaTypeId: longStayType.id } },
        update: { isActive: true },
        create: {
          providerId: embassyProvider.id,
          visaTypeId: longStayType.id,
          isDefault: true,
          isActive: true,
        },
      });
    }

    // 5. Backfill bookingCode (AP001...) on existing Appointments without bookingCode
    const appointmentsWithoutCode = await prisma.appointment.findMany({
      where: { bookingCode: null },
      orderBy: { createdAt: 'asc' },
    });
    for (const appt of appointmentsWithoutCode) {
      const code = await nextBookingCode(prisma);
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { bookingCode: code },
      });
    }

    // 6. Backfill globalDocumentCode on existing ApplicantDocuments where missing
    const docsWithoutGlobalCode = await prisma.applicantDocument.findMany({
      where: { globalDocumentCode: null },
      select: { id: true, requiredDocumentType: true },
    });
    for (const ad of docsWithoutGlobalCode) {
      const matched = globalDocMap[ad.requiredDocumentType];
      if (matched) {
        await prisma.applicantDocument.update({
          where: { id: ad.id },
          data: { globalDocumentCode: matched.documentCode },
        });
      }
    }

    console.log('[VCMS BASELINE] Central Question Pool, Document Pool, Countries, Visa Offices & Appointment Providers verified.');
  } catch (err) {
    console.error('[VCMS BASELINE ERROR]:', err);
  }
}

if (require.main === module) {
  migrateVcmsBaseline()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = {
  migrateVcmsBaseline,
  STANDARD_CATEGORIES_FOR_PURPOSE,
  buildUniqueSlotKey,
};
