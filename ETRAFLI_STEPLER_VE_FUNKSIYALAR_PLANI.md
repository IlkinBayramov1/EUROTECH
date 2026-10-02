# 🇪🇺 EUROTECH VİZA SİSTEMİ: STEPLƏR VƏ FUNKSİYALAR ÜZRƏ ƏTRAFLI TEXNİKİ PLAN

Bu sənəd rəsmi 4 səhifəlik **Harmonised Schengen Visa Application Form**-da olan bütün 34 bənd və 110 sahənin (`Text1`–`Text46`, `Button1`–`Button54`) sistemdəki 5 mərhələli ərizə formasına (`ClientApplication.tsx`), köməkçi portallara və backend emal mühərrikinə tam inteqrasiyası üçün hazırlanmışdır.

---

## 📌 1. Layihənin Memarlıq Xülasəsi və Prinsipləri

1. **Mövcud Sənədlərə Dəyməmək:** Əvvəlki bütün sənədlər (Checklist PDF, Konsulluq Manifesti, Qrup Fakturası, Zəmanət Məktubu, Excel cədvəlləri) toxunulmaz qalır və dəyişdirilmir.
2. **Kondisional (Ağıllı) UI/UX:** Normal turist ərizəçisi üçün forma sadə qalır. Xüsusi bəndlər (məs. yetkinlik yaşına çatmayanlar üçün qəyyum, Aİ ailə üzvü, tranzit icazəsi, dəvət edən hüquqi şəxs) yalnız müvafiq keçid (toggle/checkbox) aktiv edildikdə açılır.
3. **100% Sahə Uyğunluğu:** Front-end formun 5 stepində daxil edilən hər bir detal backend-də birbaşa AcroForm şablonuna yazılır və yekun PDF-də tam əks olunur.
4. **Unicode və Azərbaycan Şriftləri:** `ə, ı, ş, ç, ğ, ö, ü` simvolları `DejaVuSans` şrifti ilə AcroForm daxilində qüsursuz render olunur.

---

## 🗂️ 2. Dəyişiklik Ediləcək Faylların Siyahısı

| № | Fayl Yolu | Rolu və Məqsədi | Əlavə Olunacaq Əsas Elementlər |
|---|-----------|-----------------|--------------------------------|
| 1 | [ClientApplication.tsx](file:///c:/Users/lenovo/Desktop/EUROTECH/front/src/modules/client/pages/Application/ClientApplication.tsx) | B2C Müştəri Portalı Ərizə Forması (5 Step) | 18 yeni funksiya/handler, yeni dövlət state-ləri, kondisional UI blokları |
| 2 | [ClientApplication.css](file:///c:/Users/lenovo/Desktop/EUROTECH/front/src/modules/client/pages/Application/ClientApplication.css) | Formanın vizual stilləri | Kondisional kartlar, grid düzülüşləri, multi-checkbox qutuları, keçid animasiyaları |
| 3 | [AgentApplicantFill.tsx](file:///c:/Users/lenovo/Desktop/EUROTECH/front/src/modules/agent/pages/ApplicantFill/AgentApplicantFill.tsx) | B2B Tur Agent Qrup Müştəriləri Özünü-Doldurma Forması | Ərizəçinin əlavə pasport, qohum və iş yeri məlumatlarının qəbul funksiyaları |
| 4 | [CorporateDelegation.tsx](file:///c:/Users/lenovo/Desktop/EUROTECH/front/src/modules/corporate/pages/Delegation/CorporateDelegation.tsx) | Korporativ Nümayəndə heyəti forması | Dəvət edən xarici şirkət və işgüzar təfərrüatların avtomatik doldurulması funksiyaları |
| 5 | [excelParser.ts](file:///c:/Users/lenovo/Desktop/EUROTECH/front/src/shared/utils/excelParser.ts) | Qrup Excel Roster Yükləmə köməkçisi | Yeni sahələrin (əvvəlki soyad, doğum ölkəsi, qəyyum, iş nömrəsi) sütun xəritələnməsi |
| 6 | [schengenPdfFiller.util.js](file:///c:/Users/lenovo/Desktop/EUROTECH/back/utils/schengenPdfFiller.util.js) | Backend AcroForm PDF Doldurma Mühərriki | `normalizeApplicantData` genişləndirilməsi, `Text1`–`Text46`, `Button1`–`Button54` 100% xəritələnməsi |
| 7 | [dossier.service.js](file:///c:/Users/lenovo/Desktop/EUROTECH/back/modules/dossier/dossier.service.js) | Backend Dosye və Ərizəçi Xidməti | `generateApplicationFormPdf` funksiyasında dərin JSON birləşdirməsi və korporativ sponsor məlumatlarının inyeksiyası |
| 8 | [test-schengen-full-fields.js](file:///c:/Users/lenovo/Desktop/EUROTECH/back/test/test-schengen-full-fields.js) | Avtomatlaşdırılmış Test Skripti | Bütün 34 bəndin və sahələrin test edilməsi və faylın generaiyası |

---

## 🧩 3. Mərhələlər (Steplər) Üzrə Əlavə Olunacaq Funksiyalar və Sahələr

---

### 🔹 STEP 1: SƏFƏR PLANLARI (YOUR PLANS)
> **Məqsəd:** Rəsmi formanın 21, 23, 24, 25, 27 və 28-ci bəndlərini tam əhatə etmək.

#### 1. Əlavə Olunacaq Sahələr:
* **Box 21 (Səfərin Məqsədi):**
  * `Visiting family or friends` (Ailə/Dost ziyarəti) seçimi (`Button27`)
  * `Other` seçildikdə əlavə açıqlama mətni sahəsi (`Text26`)
* **Box 24 (Səfərin əlavə təfərrüatları):**
  * `purposeDetails` mətni (Səfərin xüsusi motivasiyası - `Text26`)
* **Box 27 (Əvvəlki Biometrik Barmaq İzləri):**
  * Keçid: `hasPreviousFingerprints` (Bəli / Xeyr) -> `Button38` (Xeyr), `Button39` (Bəli)
  * Əgər Bəli: Barmaq izi verilmə tarixi `fingerprintDate` (`Text31`)
  * Viza stiker nömrəsi (məlumdursa) `fingerprintVisaNumber` (`Text32`)
* **Box 25 (Son Təyinat Ölkəsinə Giriş İcazəsi - Tranzit Halında):**
  * Keçid: `hasFinalDestinationPermit` (Bəli / Xeyr)
  * Əgər Bəli: İcazə verən orqan `finalDestinationAuthority` (`Text33`)
  * Etibarlılıq başlanğıcı `finalDestinationValidFrom` (`Text34`)
  * Etibarlılıq bitməsi `finalDestinationValidUntil` (`Text35`)

#### 2. Əlavə Olunacaq Funksiyalar və Handler-lər ([ClientApplication.tsx](file:///c:/Users/lenovo/Desktop/EUROTECH/front/src/modules/client/pages/Application/ClientApplication.tsx)):
```typescript
// 1. Səfər məqsədi dəyişmə funksiyası
const handlePurposeChange = (purposeValue: string) => {
    handleFieldChange('purpose', purposeValue);
    if (purposeValue !== 'Other') {
        handleFieldChange('purposeOtherDetails', '');
    }
};

// 2. Əvvəlki barmaq izi keçid funksiyası
const handleFingerprintToggle = (hasFingerprints: boolean) => {
    handleFieldChange('hasPreviousFingerprints', hasFingerprints ? 'Yes' : 'No');
    if (!hasFingerprints) {
        handleFieldChange('fingerprintDate', '');
        handleFieldChange('fingerprintVisaNumber', '');
    }
};

// 3. Son təyinat icazəsi (Tranzit) keçid funksiyası
const handleTransitPermitToggle = (hasPermit: boolean) => {
    handleFieldChange('hasFinalDestinationPermit', hasPermit ? 'Yes' : 'No');
    if (!hasPermit) {
        handleFieldChange('finalDestinationAuthority', '');
        handleFieldChange('finalDestinationValidFrom', '');
        handleFieldChange('finalDestinationValidUntil', '');
    }
};
```

---

### 🔹 STEP 2: ŞƏXSİ MƏLUMATLAR (YOUR INFORMATION)
> **Məqsəd:** Rəsmi formanın 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 və 11-ci bəndlərini tamamlamaq.

#### 1. Əlavə Olunacaq Sahələr:
* **Box 2 (Doğulanda Soyad / Əvvəlki Soyad):** `birthSurname` (`Text2`)
* **Box 7 (Doğulanda Vətəndaşlıq):** `nationalityAtBirth` (əgər indiki vətəndaşlıqdan fərqlidirsə)
* **Box 7 (Digər Vətəndaşlıqlar):** `otherNationalities` (ikili vətəndaşlıq halında)
* **Box 8 (Cins):** `Other` seçimi əlavə edilməsi (`Button3`)
* **Box 9 (Ailə Vəziyyəti):** `Registered Partnership` (`Button6`) və `Other` (`Button10`)
* **Box 10 (Yetkinlik Yaşına Çatmayanlar üçün Qəyyum/Valideyn İcazəsi):**
  * Keçid: `isMinor` (Avtomatik: doğum tarixi 18 yaşdan kiçikdirsə və ya əl ilə seçilərsə)
  * Qəyyum Soyadı `guardianSurname`
  * Qəyyum Adı `guardianName`
  * Qəyyum Yaşayış Ünvanı `guardianAddress` (ərizəçidən fərqlidirsə)
  * Qəyyum Telefonu `guardianPhone`
  * Qəyyum E-poçtu `guardianEmail`
  * Qəyyum Vətəndaşlığı `guardianNationality`

#### 2. Əlavə Olunacaq Funksiyalar və Handler-lər ([ClientApplication.tsx](file:///c:/Users/lenovo/Desktop/EUROTECH/front/src/modules/client/pages/Application/ClientApplication.tsx)):
```typescript
// 1. Yaş hesablama və qəyyum sahəsini təyin etmə köməkçisi
const checkIsMinor = (birthDateString: string): boolean => {
    if (!birthDateString) return false;
    const dob = new Date(birthDateString);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    return age < 18;
};

// 2. Doğum tarixi dəyişdikdə qəyyum bölməsini reaktiv açma funksiyası
const handleBirthDateChange = (val: string) => {
    handleFieldChange('birthDate', val);
    const minorDetected = checkIsMinor(val);
    if (minorDetected) {
        handleFieldChange('isMinor', 'Yes');
    }
};

// 3. Qəyyum məlumatlarını qrup halında yeniləmə funksiyası
const handleGuardianChange = (field: string, val: string) => {
    handleFieldChange(`guardian_${field}`, val);
};
```

---

### 🔹 STEP 3: SƏYAHƏT SƏNƏDİ (TRAVEL DOCUMENT)
> **Məqsəd:** Rəsmi formanın 12, 13, 14, 15, 16, 17, 18, 19, 20 və 30/31-ci bəndlərini əhatə etmək.

#### 1. Əlavə Olunacaq Sahələr:
* **Box 12 (Sənədin Növü):** `Other travel document` seçildikdə açıqlama sahəsi `otherDocTypeDetails` (`Button16`)
* **Box 20 (Digər Ölkədə Yaşama İcazəsi - Oturum):**
  * Keçid: `hasOtherResidence` (Bəli / Xeyr) -> `Button23` (Xeyr), `Button24` (Bəli)
  * Əgər Bəli: İcazə növü `otherResidenceType` (`Text21`)
  * İcazə sənədinin nömrəsi `otherResidenceNumber` (`Text22`)
  * Bitmə tarixi `otherResidenceValidUntil` (`Text23`)
* **Box 30 & 31 (Aİ / AİB / İsveçrə / Böyük Britaniya Vətəndaşı Olan Ailə Üzvü):**
  * Keçid: `hasEuFamilyMember` (Bəli / Xeyr)
  * Əgər Bəli:
    * Ailə üzvünün Soyadı `euFamilySurname` (`Text13`)
    * Ailə üzvünün Adı `euFamilyName` (`Text14`)
    * Doğum tarixi `euFamilyDob` (`Text15`)
    * Vətəndaşlığı `euFamilyNationality` (`Text16`)
    * Sənəd nömrəsi `euFamilyDocNumber` (`Text17`)
    * Qohumluq əlaqəsi (`Button17`–`Button22`):
      * `Spouse` (Həyat yoldaşı) -> `Button17`
      * `Child` (Övlad) -> `Button18`
      * `Grandchild` (Nəvə) -> `Button19`
      * `Dependent Ascendant` (Valideyn/Himayədə olan) -> `Button20`
      * `Registered Partner` -> `Button21`
      * `Other` -> `Button22`

#### 2. Əlavə Olunacaq Funksiyalar və Handler-lər ([ClientApplication.tsx](file:///c:/Users/lenovo/Desktop/EUROTECH/front/src/modules/client/pages/Application/ClientApplication.tsx)):
```typescript
// 1. Başqa ölkədə oturum icazəsi keçid funksiyası
const handleOtherResidenceToggle = (hasResidence: boolean) => {
    handleFieldChange('hasOtherResidence', hasResidence ? 'Yes' : 'No');
    if (!hasResidence) {
        handleFieldChange('otherResidenceType', '');
        handleFieldChange('otherResidenceNumber', '');
        handleFieldChange('otherResidenceValidUntil', '');
    }
};

// 2. Aİ vətəndaşı ailə üzvü keçid funksiyası
const handleEuFamilyToggle = (hasEuMember: boolean) => {
    handleFieldChange('hasEuFamilyMember', hasEuMember ? 'Yes' : 'No');
    if (!hasEuMember) {
        handleFieldChange('euFamilySurname', '');
        handleFieldChange('euFamilyName', '');
        handleFieldChange('euFamilyDob', '');
        handleFieldChange('euFamilyNationality', '');
        handleFieldChange('euFamilyDocNumber', '');
        handleFieldChange('euFamilyRelationship', '');
    }
};
```

---

### 🔹 STEP 4: QALMA YERİ VƏ MALİYYƏ TƏMİNATI (YOUR STAY & SPONSOR)
> **Məqsəd:** Rəsmi formanın 30, 31, 32 və 33-cü bəndlərini tam əhatə etmək.

#### 1. Əlavə Olunacaq Sahələr:
* **Dəvət Edən Tərəfin Kateqoriyası:**
  * Seçim: `invitingType` ('individual' | 'company')
  * **Əgər Fiziki Şəxs və ya Oteldirsə:**
    * Ad və Soyad / Otel Adı `invitingParty` (`Text36`)
    * Ünvan `address` (`Text37`)
    * E-poçt `stayEmail` (`Text38`)
    * Telefon `stayPhone` (`Text39`)
  * **Əgər Şirkət və ya Təşkilatdırsa:**
    * Dəvət edən Şirkətin Adı `companyName` (`Text40`)
    * Şirkətin Hüquqi Ünvanı `companyAddress` (`Text41`)
    * Şirkətdə Əlaqəli Şəxsin Adı və Soyadı `companyContactName` (`Text42`)
    * Əlaqəli şəxsin ünvanı `companyContactAddress` (`Text43`)
    * Əlaqəli şəxsin e-poçtu `companyContactEmail` (`Text44`)
    * Əlaqəli şəxsin telefonu `companyContactPhone` (`Text46`)
* **Box 32 (Xərclərin Ödənilməsi və Maliyyə Vasitələri - Çoxlu Seçim):**
  * **Ərizəçinin Özü tərəfindən ödənilirsə:**
    * Nağd vəsait (`Button40`)
    * Yol çekləri (`Button41`)
    * Kredit kartı (`Button42`)
    * Əvvəlcədən ödənilmiş yerləşmə (`Button43`)
    * Əvvəlcədən ödənilmiş nəqliyyat (`Button44`)
    * Digər (`Button45`)
  * **Sponsor (Dəvət edən şəxs və ya şirkət) tərəfindən ödənilirsə:**
    * Dəvət edən qeyd olunub (`Button46`)
    * Digər sponsor (`Button47`)
    * Otel/Host (`Button48`)
    * Şirkət tərəfindən (`Button49`)
    * Nağd vəsait təmin olunur (`Button50`)
    * Yerləşmə təmin olunur (`Button51`)
    * Bütün xərclər tam qarşılanır (`Button52`)
    * Əvvəlcədən ödənilmiş nəqliyyat (`Button53`)
    * Digər sponsor təminatı (`Button54`)

#### 2. Əlavə Olunacaq Funksiyalar və Handler-lər ([ClientApplication.tsx](file:///c:/Users/lenovo/Desktop/EUROTECH/front/src/modules/client/pages/Application/ClientApplication.tsx)):
```typescript
// 1. Dəvət edən tərəfin tipini dəyişmə funksiyası
const handleInvitingTypeChange = (type: 'individual' | 'company') => {
    handleFieldChange('invitingType', type);
};

// 2. Maliyyə təminatı çoxlu seçim (Multi-Checkbox) idarəedici funksiyası
const handleMeansOfSupportToggle = (category: 'applicant' | 'sponsor', key: string) => {
    const fieldName = category === 'applicant' ? 'meansOfSupportApplicant' : 'meansOfSupportSponsor';
    const currentList: string[] = Array.isArray(formData[fieldName]) ? [...formData[fieldName]] : [];
    
    const index = currentList.indexOf(key);
    if (index > -1) {
        currentList.splice(index, 1);
    } else {
        currentList.push(key);
    }
    
    handleFieldChange(fieldName, currentList);
};
```

---

### 🔹 STEP 5: ƏLAQƏ VƏ İŞ YERİ (CONTACTS & JOB)
> **Məqsəd:** Rəsmi formanın 17, 18, 19, 22 və 34-cü bəndlərini tamamlamaq.

#### 1. Əlavə Olunacaq Sahələr:
* **Box 22 (İş Yeri / Təhsil Müəssisəsi Əlaqə Nömrəsi):**
  * `employerPhone` (İş yerinin rəsmi telefon nömrəsi - fərdi mobil telefondan ayrı saxlanılır)
* **Box 34 (Formu Ərizəçinin Əvəzinə Dolduran Şəxs / Müvəkkil Nümayəndə):**
  * Keçid: `hasRepresentative` (Bəli / Xeyr)
  * Əgər Bəli:
    * Formu dolduranın Adı və Soyadı `representativeName`
    * Yaşayış Ünvanı `representativeAddress`
    * Əlaqə E-poçtu `representativeEmail`
    * Telefon Nömrəsi `representativePhone`

#### 2. Əlavə Olunacaq Funksiyalar və Handler-lər ([ClientApplication.tsx](file:///c:/Users/lenovo/Desktop/EUROTECH/front/src/modules/client/pages/Application/ClientApplication.tsx)):
```typescript
// 1. Müvəkkil nümayəndə keçid funksiyası
const handleRepresentativeToggle = (hasRep: boolean) => {
    handleFieldChange('hasRepresentative', hasRep ? 'Yes' : 'No');
    if (!hasRep) {
        handleFieldChange('representativeName', '');
        handleFieldChange('representativeAddress', '');
        handleFieldChange('representativeEmail', '');
        handleFieldChange('representativePhone', '');
    }
};

// 2. Form tərəqqi faizini hesablamaq funksiyasının təkmilləşdirilməsi
function calculateFormProgress(form: Record<string, any>): number {
    if (!form || Object.keys(form).length === 0) return 0;
    let score = 0;
    // Step 1: Trip Particulars
    if (form.purpose && (form.arrivalDate || form.departureDate || form.destination)) score += 20;
    // Step 2: Identification
    if (form.firstName && form.lastName && (form.birthDate || form.nationality)) score += 20;
    // Step 3: Travel Document
    if (form.passportNumber && (form.issueDate || form.passportExpiry || form.issuedBy)) score += 20;
    // Step 4: Stay & Accommodation
    if ((form.invitingParty || form.companyName || form.address) && form.costCoveredBy) score += 20;
    // Step 5: Contacts & Employment
    if (form.homeAddress || form.homeEmail || form.homePhone || form.currentOccupation) score += 20;

    return Math.min(100, score);
}
```

---

## ⚙️ 4. Backend Mühərriki və Dəyişiklik Funksiyaları

### [schengenPdfFiller.util.js](file:///c:/Users/lenovo/Desktop/EUROTECH/back/utils/schengenPdfFiller.util.js)

#### 1. `normalizeApplicantData(applicantData, dossierData)` funksiyasında dəyişiklik:
Yeni qəbul edilən bütün JSON açarlarını AcroForm sahələrinə çevirir:
```javascript
function normalizeApplicantData(applicantData = {}, dossierData = {}) {
  const rawForm = applicantData.formDataJson || applicantData.formData || {};
  const m = { ...applicantData, ...rawForm };

  // Dəvət edən tərəf fərqləndirilməsi
  const isCompany = m.invitingType === 'company' || !!m.companyName || dossierData.portalType === 'CORPORATE';

  return {
    // 1-ci səhifə şəxsi məlumatlar
    surname: m.surname || m.lastName || applicantData.lastName || '',
    surname_birth: m.surname_birth || m.birthSurname || m.lastName || '',
    firstname: m.firstname || m.firstName || applicantData.firstName || '',
    dob: m.dob || m.birthDate || applicantData.birthDate || '',
    birthplace: m.birthplace || m.birthPlace || 'Baku',
    birthcountry: m.birthcountry || m.birthCountry || 'Azerbaijan',
    nationality: m.nationality || applicantData.nationality || 'Azerbaijan',
    nationality_at_birth: m.nationality_at_birth || m.nationalityAtBirth || '',
    sex: m.sex || (m.gender === 'Female' ? 'Female' : m.gender === 'Other' ? 'Other' : 'Male'),
    civil_status: m.maritalStatus || m.civil_status || 'Single',
    id_number: m.id_number || m.nationalId || '',

    // Qəyyum (yetkinlik yaşına çatmayanlar)
    guardian_surname: m.guardian_surname || m.guardianSurname || '',
    guardian_name: m.guardian_name || m.guardianName || '',
    guardian_address: m.guardian_address || m.guardianAddress || '',
    guardian_phone: m.guardian_phone || m.guardianPhone || '',
    guardian_email: m.guardian_email || m.guardianEmail || '',
    guardian_nationality: m.guardian_nationality || m.guardianNationality || '',

    // Pasport və Digər Yaşayış İcazəsi
    doc_type: m.passportType || m.doc_type || 'Ordinary passport',
    doc_other_details: m.otherDocTypeDetails || '',
    doc_number: (m.passportNumber || m.doc_number || applicantData.passportNumber || '').toUpperCase(),
    doc_issue: m.issueDate || m.doc_issue || '',
    doc_valid: m.passportExpiry || m.doc_valid || '',
    doc_issuedby: m.issuedBy || m.doc_issuedby || 'Ministry of Internal Affairs',
    residence_other: m.hasOtherResidence === 'Yes' || m.residence_other === 'Yes' ? 'Yes' : 'No',
    residence_type: m.otherResidenceType || m.residence_type || '',
    residence_number: m.otherResidenceNumber || m.residence_number || '',
    residence_valid: m.otherResidenceValidUntil || m.residence_valid || '',

    // Aİ vətəndaşı ailə üzvü
    has_eu_member: m.hasEuFamilyMember === 'Yes' ? 'Yes' : 'No',
    fam_surname: m.euFamilySurname || m.fam_surname || '',
    fam_firstname: m.euFamilyName || m.fam_firstname || '',
    fam_dob: m.euFamilyDob || m.fam_dob || '',
    fam_nat: m.euFamilyNationality || m.fam_nat || '',
    fam_doc: m.euFamilyDocNumber || m.fam_doc || '',
    relationship: m.euFamilyRelationship || m.relationship || '',

    // Əlaqə və İş Yeri
    address: m.homeAddress || m.address || '',
    email: m.homeEmail || m.email || applicantData.email || dossierData.user?.email || '',
    phone: m.homePhone || m.phone || m.contactPhone || '',
    occupation: m.currentOccupation || m.occupation || 'Specialist',
    employer: m.employerName || m.employer || '',
    employer_address_phone: m.employerAddress ? `${m.employerAddress}${m.employerPhone ? ' Tel: ' + m.employerPhone : ''}` : (m.employerPhone ? `Tel: ${m.employerPhone}` : ''),

    // Səfər Planı və Barmaq İzi
    purpose: m.purpose || 'Tourism',
    purpose_details: m.purposeOtherDetails || m.purposeDetails || m.purpose_details || '',
    destination_main: dossierData.country?.nameEn || m.destination || 'Hungary',
    first_entry: m.firstEntry || m.first_entry || 'Hungary',
    entries: m.entriesRequested || m.entries || 'Single',
    arrival: m.arrivalDate || m.arrival || '',
    departure: m.departureDate || m.departure || '',
    fingerprints: m.hasPreviousFingerprints === 'Yes' || m.fingerprints === 'Yes' ? 'Yes' : 'No',
    fingerprint_date: m.fingerprintDate || m.fingerprint_date || '',
    fingerprint_visa_no: m.fingerprintVisaNumber || m.fingerprint_visa_no || '',
    has_transit_permit: m.hasFinalDestinationPermit === 'Yes' ? 'Yes' : 'No',
    entry_issuedby: m.finalDestinationAuthority || m.entry_issuedby || '',
    entry_validfrom: m.finalDestinationValidFrom || m.entry_validfrom || '',
    entry_validuntil: m.finalDestinationValidUntil || m.entry_validuntil || '',

    // Dəvət edən tərəf
    inviting_type: isCompany ? 'company' : 'individual',
    inviting_person: isCompany ? '' : (m.invitingParty || 'Hotel Sas Budapest'),
    inviting_address: isCompany ? '' : (m.address || 'Budapest, Hungary'),
    inviting_email: isCompany ? '' : (m.stayEmail || ''),
    inviting_phone: isCompany ? '' : (m.stayPhone || ''),
    inviting_company_name: isCompany ? (m.companyName || m.invitingCompany || m.invitingParty || '') : '',
    inviting_company_address: isCompany ? (m.companyAddress || m.address || '') : '',
    contact_fullname: isCompany ? (m.companyContactName || '') : '',
    contact_address: isCompany ? (m.companyContactAddress || '') : '',
    contact_email: isCompany ? (m.companyContactEmail || '') : '',
    contact_phone: isCompany ? (m.companyContactPhone || '') : '',

    // Xərclərin Ödənilməsi
    cost_covered_by: (m.costCoveredBy || (dossierData.portalType === 'CORPORATE' ? 'sponsor' : 'applicant')).toLowerCase(),
    means_applicant: Array.isArray(m.meansOfSupportApplicant) ? m.meansOfSupportApplicant : ['cash', 'credit_card'],
    means_sponsor: Array.isArray(m.meansOfSupportSponsor) ? m.meansOfSupportSponsor : ['accommodation', 'all_expenses'],

    // Müvəkkil Şəxs
    rep_name: m.representativeName || '',
    rep_address: m.representativeAddress || '',
    rep_email: m.representativeEmail || '',
    rep_phone: m.representativePhone || '',
  };
}
```

#### 2. `fillSchengenPDF(applicantData, dossierData)` funksiyasında `fields` xəritəsinin genişləndirilməsi:
```javascript
// Checkbox və RadioButton-ların dəqiq xəritələnməsi:
Button40: applicant.means_applicant.includes('cash') ? 'On' : 'Off',
Button41: applicant.means_applicant.includes('cheque') ? 'On' : 'Off',
Button42: applicant.means_applicant.includes('credit_card') ? 'On' : 'Off',
Button43: applicant.means_applicant.includes('prepaid_accom') ? 'On' : 'Off',
Button44: applicant.means_applicant.includes('prepaid_trans') ? 'On' : 'Off',
Button45: applicant.means_applicant.includes('other') ? 'On' : 'Off',

Button46: applicant.cost_covered_by === 'sponsor' && applicant.has_eu_member === 'Yes' ? 'On' : 'Off',
Button47: applicant.cost_covered_by === 'sponsor' ? 'On' : 'Off',
Button48: applicant.inviting_type === 'individual' && applicant.cost_covered_by === 'sponsor' ? 'On' : 'Off',
Button49: applicant.inviting_type === 'company' && applicant.cost_covered_by === 'sponsor' ? 'On' : 'Off',
Button50: applicant.means_sponsor.includes('cash') ? 'On' : 'Off',
Button51: applicant.means_sponsor.includes('accommodation') ? 'On' : 'Off',
Button52: applicant.means_sponsor.includes('all_expenses') ? 'On' : 'Off',
Button53: applicant.means_sponsor.includes('prepaid_trans') ? 'On' : 'Off',
Button54: applicant.means_sponsor.includes('other') ? 'On' : 'Off',
```

---

## 📊 5. İnteqrasiya və İcra Sırası (Step-by-Step Execution Plan)

Aşağıdakı ardıcıllıqla icra həyata keçiriləcək:

1. **Addım 1:** [ClientApplication.tsx](file:///c:/Users/lenovo/Desktop/EUROTECH/front/src/modules/client/pages/Application/ClientApplication.tsx) daxilində `DEFAULT_FORM_DATA` obyektinə yeni sahələrin standart dəyərlərinin əlavə edilməsi və `calculateFormProgress` alqoritminin yenilənməsi.
2. **Addım 2:** [ClientApplication.tsx](file:///c:/Users/lenovo/Desktop/EUROTECH/front/src/modules/client/pages/Application/ClientApplication.tsx) Step 1 JSX blokuna Visiting family, Barmaq izi və Tranzit bölmələrinin əlavə edilməsi.
3. **Addım 3:** [ClientApplication.tsx](file:///c:/Users/lenovo/Desktop/EUROTECH/front/src/modules/client/pages/Application/ClientApplication.tsx) Step 2 JSX blokuna Doğulanda vətəndaşlıq, Qəyyum və cinsiyyət seçimlərinin inteqrasiyası.
4. **Addım 4:** [ClientApplication.tsx](file:///c:/Users/lenovo/Desktop/EUROTECH/front/src/modules/client/pages/Application/ClientApplication.tsx) Step 3 JSX blokuna Oturum icazəsi və Aİ vətəndaşı ailə üzvü bloklarının inteqrasiyası.
5. **Addım 5:** [ClientApplication.tsx](file:///c:/Users/lenovo/Desktop/EUROTECH/front/src/modules/client/pages/Application/ClientApplication.tsx) Step 4 JSX blokuna Dəvət edən Şirkət və Maliyyə Təminatı Vasitələri (Multi-checkbox) bölmələrinin əlavə edilməsi.
6. **Addım 6:** [ClientApplication.tsx](file:///c:/Users/lenovo/Desktop/EUROTECH/front/src/modules/client/pages/Application/ClientApplication.tsx) Step 5 JSX blokuna İş yeri telefonu və Müvəkkil nümayəndə bölməsinin əlavə edilməsi.
7. **Addım 7:** [ClientApplication.css](file:///c:/Users/lenovo/Desktop/EUROTECH/front/src/modules/client/pages/Application/ClientApplication.css) faylına kondisional kartlar, radio-group və checkbox qutuları üçün stillərin yazılması.
8. **Addım 8:** [schengenPdfFiller.util.js](file:///c:/Users/lenovo/Desktop/EUROTECH/back/utils/schengenPdfFiller.util.js) faylında `normalizeApplicantData` və `fillSchengenPDF` funksiyalarının yenilənməsi.
9. **Addım 9:** Bütün sistemin test edilməsi (`npm run build` və `node test-all.js`).

---

## 🛡️ 6. Təhlükəsizlik və Geri Uyğunluq Zəmanəti
* Mövcud qeydiyyatdan keçmiş istifadəçilərin `formDataJson` strukturu zədələnmir, çatışmayan sahələr üçün `DEFAULT_FORM_DATA` default dəyərləri avtomatik fallback edir.
* Heç bir mövcud router, API endpoint URL-i və ya status klanı dəyişdirilmir.
* Hər iki tərəfdə (front-end TypeScript və back-end Node.js) 0 xəta ilə qurulma (build) təmin edilir.
