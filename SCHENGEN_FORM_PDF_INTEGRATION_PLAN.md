# 📄 EUROTECH — Rəsmi Harmonizə Edilmiş Şengen Viza Ərizə Forması (PDF) və Anket Sistemi İnteqrasiya Planı

## 📌 1. Layihə Məqsədi və İcmal

Sistemdə müraciətçilərin (fərdi vətəndaşlar, turizm qruplarının sərnişinləri və korporativ ezamiyyət işçiləri) viza qeydiyyatı zamanı doldurduqları formuların **rəsmi Avropa İttifaqı Harmonizə Edilmiş Şengen Viza Ərizə Forması (`FORM-FILLED-SCHENGEN-FORM.pdf`)** standartına 100% uyğunlaşdırılması tələb olunur.

Form doldurulduqdan sonra sistem avtomatik olaraq bu 4 səhifəlik rəsmi PDF şablonunu yükləyəcək, formdakı məlumatları və işarələmələri (Text və Checkbox/Button sahələrini) Unicode dəstəyi ilə birbaşa PDF xanalarına dolduracaq və istifadəçiyə rəsmi çap/təqdimat üçün hazır PDF sənədi verəcəkdir.

Bu funksionallıq **hər 3 portala** eyni dəqiqliklə inteqrasiya olunacaq:
1. **👤 B2C Müştəri Portalı (Client Portal)**
2. **🏢 B2B Turizm Agenti Portalı (Tour Operator / Agent Portal)**
3. **🌐 B2B Korporativ Tərəfdaş Portalı (Corporate Partner Portal)**

> ⚠️ **Mühüm Qayda:** Əvvəlki mövcud PDF və Excel ixrac/idxal mexanizmlərinə (Sənəd yoxlama hesabatı, Qrup Manifesti, Qrup Vergi Fakturası, Korporativ Zəmanət Məktubu, Proforma Faktura və Excel Roster) toxunulmayacaq və onlar olduğu kimi qalacaq. Yalnız viza ərizə anketinin doldurulması və PDF generasiyası yeni rəsmi şablona bağlanacaq.

---

## 🏛 2. Şablon və Kriptoqrafik/Şrift Standartları

### 2.1. PDF Şablon Faylının Yerləşdirilməsi
* **Şablon Faylı:** `FORM-FILLED-SCHENGEN-FORM.pdf`
* **Saxlanma Yeri:** `back/templates/pdf/FORM-FILLED-SCHENGEN-FORM.pdf` (və ehtiyat üçün `front/public/pdf/FORM-FILLED-SCHENGEN-FORM.pdf`)
* **Struktur:** 4 səhifəlik rəsmi AcroForm (A-G bölmələri, Text1–Text46 və Button1–Button39 sahələri).

### 2.2. Unicode Şrift Dəstəyi (Azərbaycan və Xüsusi Simvollar üçün)
* Şrift faylı: `back/fonts/DejaVuSans.ttf` (və ya `Roboto-Regular.ttf`)
* `pdf-lib` ilə birlikdə `@pdf-lib/fontkit` (və ya `fontkit`) qeydiyyatdan keçirilir:
  ```javascript
  const fontkit = require('fontkit');
  pdfDoc.registerFontkit(fontkit);
  const unicodeFont = await pdfDoc.embedFont(fontBytes);
  ```
* Bütün `PDFTextField` sahələrinə `defaultUpdateAppearances(unicodeFont)` və `updateAppearances(unicodeFont)` tətbiq edilir ki, simvollar kəsilməsin və qüsursuz görünsün.

---

## 📋 3. Rəsmi Şengen Forması Məlumat Modeli (Data Schema & Mapping)

PDF-in 46 mətni və 39 seçim düyməsi aşağıdakı 7 məntiqi qrupa bölünür. Bütün bu məlumatlar verilənlər bazasında `Applicant.formDataJson` daxilində vahid JSON strukturu kimi saxlanacaq:

```typescript
export interface SchengenFormData {
  // A. ŞƏXSİ MƏLUMATLAR (Personal Information)
  surname: string;                 // Text1  - Soyad (Family name)
  surname_birth: string;           // Text2  - Doğulduqda soyadı (Surname at birth)
  firstname: string;               // Text3  - Ad(lar) (First name(s))
  dob: string;                     // Text4  - Doğum tarixi (DD/MM/YYYY)
  birthplace: string;              // Text5  - Doğum yeri (Place of birth)
  birthcountry: string;            // Text6  - Doğum ölkəsi (Country of birth)
  nationality: string;             // Text7  - Hazırkı vətəndaşlıq (Current nationality)
  sex: 'Male' | 'Female' | 'Other'; // Button1, Button2, Button3
  civil_status:                    // Button4 - Button10
    | 'Single' 
    | 'Married' 
    | 'Registered Partnership' 
    | 'Separated' 
    | 'Divorced' 
    | 'Widow(er)' 
    | 'Other';
  id_number: string;               // Text8  - Şəxsiyyət vəsiqəsi / FİN nömrəsi

  // B. SƏYAHƏT SƏNƏDİ (Travel Document)
  doc_type:                        // Button11 - Button16
    | 'Ordinary passport' 
    | 'Diplomatic passport' 
    | 'Service passport' 
    | 'Official passport' 
    | 'Special passport' 
    | 'Other (please specify below)';
  doc_number: string;              // Text9  - Pasport nömrəsi
  doc_issue: string;               // Text10 - Verilmə tarixi (DD/MM/YYYY)
  doc_valid: string;               // Text11 - Etibarlılıq bitmə tarixi (DD/MM/YYYY)
  doc_issuedby: string;            // Text12 - Verən ölkə/orqan

  // C. Aİ/AİM/İSVEÇRƏ/UK VƏTƏNDAŞININ AİLƏ ÜZVÜ (Family Member)
  fam_surname?: string;            // Text13
  fam_firstname?: string;          // Text14
  fam_dob?: string;                // Text15 (DD/MM/YYYY)
  fam_nat?: string;                // Text16
  fam_doc?: string;                // Text17
  relationship?:                   // Button17 - Button22
    | 'Spouse' 
    | 'Child' 
    | 'Grandchild' 
    | 'Ascendant' 
    | 'Registered Partner' 
    | 'Other';

  // D. ƏLAQƏ VƏ YAŞAYIŞ YERİ (Contact & Residence)
  email: string;                   // Text18 - E-poçt ünvanı
  address: string;                 // Text19 - Yaşayış ünvanı
  phone: string;                   // Text20 - Əlaqə telefonu
  residence_other: 'No' | 'Yes';   // Button23 (No), Button24 (Yes)
  residence_type?: string;         // Text21 - Yaşayış icazəsinin növü
  residence_number?: string;       // Text22 - Qeydiyyat nömrəsi
  residence_valid?: string;        // Text23 - Etibarlılıq tarixi (DD/MM/YYYY)

  // E. MƏŞĞULLUQ VƏ İŞ YERİ (Employment)
  occupation: string;              // Text24 - Peşə / Vəzifə
  employer: string;                // Text25 - İşəgötürənin adı, ünvanı və telefonu (Tələbələr üçün təhsil müəssisəsi)

  // F. SƏYAHƏT PLANI VƏ GİRİŞLƏR (Travel Plan)
  purpose:                         // Button25 - Button34
    | 'Tourism' 
    | 'Business' 
    | 'Visiting family or friends' 
    | 'Cultural' 
    | 'Sports' 
    | 'Official visit' 
    | 'Medical reasons' 
    | 'Study' 
    | 'Airport transit' 
    | 'Other';
  purpose_details?: string;        // Text26 - Səfər məqsədi barədə əlavə qeydlər
  destination_main: string;        // Text27 - Əsas təyinat ölkəsi
  first_entry: string;             // Text28 - İlk daxil olunacaq Şengen ölkəsi
  entries: 'Single' | 'Two entries' | 'Multiple'; // Button35, Button36, Button37
  arrival: string;                 // Text29 - Gəliş tarixi (DD/MM/YYYY)
  departure: string;               // Text30 - Gediş tarixi (DD/MM/YYYY)
  fingerprints: 'No' | 'Yes';      // Button38, Button39
  fingerprint_date?: string;       // Text31
  fingerprint_visa_no?: string;    // Text32
  entry_issuedby?: string;         // Text33
  entry_validfrom?: string;        // Text34
  entry_validuntil?: string;       // Text35

  // G. DƏVƏT EDƏN TƏRƏF VƏ YERLƏŞMƏ (Inviting Entity / Accommodation)
  inviting_person?: string;        // Text36 - Dəvət edən şəxs və ya otel adı
  inviting_address?: string;       // Text37 - Otel / Dəvət edənin ünvanı
  inviting_email?: string;         // Text38
  inviting_phone?: string;         // Text39
  inviting_company_name?: string;  // Text40 - Dəvət edən şirkətin adı
  inviting_company_address?: string;// Text41
  contact_fullname?: string;       // Text42 - Şirkətdəki əlaqələndirici şəxs
  contact_address?: string;        // Text43
  contact_email?: string;          // Text44
  contact_phone?: string;          // Text46
}
```

---

## 🛠 4. İcra Addımları və Arxitektura Dəyişiklikləri

### Mərhələ 1: Backend Mühərrikinin Quraşdırılması (`back/`)

1. **Şablon və Asılılıqların Təmin Edilməsi:**
   - `back/package.json`-a `fontkit` paketinin əlavə edilməsi.
   - `back/templates/pdf/FORM-FILLED-SCHENGEN-FORM.pdf` şablonunun və `back/fonts/DejaVuSans.ttf` şriftinin qovluğa yerləşdirilməsi.

2. **Doldurma Xidmətinin Yaradılması (`back/utils/schengenPdfFiller.util.js`):**
   - İstifadəçinin təqdim etdiyi `fillSchengenPDF(applicantData)` kodunun genişləndirilməsi:
     - `Applicant` və `Dossier` məlumatlarını (ad, soyad, pasport nömrəsi, doğum tarixi, vətəndaşlıq, ünvan və `formDataJson`-dakı bütün dəyərləri) avtomatik xəritələyən (mapping adapter) funksiya.
     - Tarixləri standart `DD/MM/YYYY` formatına çevirən təhlükəsiz formatlayıcı.
     - Çıxış faylının unikal adla `uploads/schengen_form_[applicantId]_[timestamp].pdf` kimi generasiya edilməsi.

3. **Mövcud Endpoint-lərin Bağlanması (`dossier.service.js` və `dossier.routes.js`):**
   - `generateApplicationFormPdf` funksiyasında köhnə manual rəsm blokunun yerinə birbaşa yeni `schengenPdfFiller.util.js` çağırılır.
   - `GET /api/v1/dossiers/:dossierId/applicants/:applicantId/schengen-form-pdf` çağırıldıqda birbaşa bu rəsmi doldurulmuş PDF təqdim edilir.
   - Həmçinin birbaşa JSON qəbul edib dolduran `POST /api/v1/dossiers/schengen-form-pdf/preview` endpoint-i əlavə edilir (anında canlı önbaxış üçün).

---

### Mərhələ 2: B2C Müştəri Portalının Uyğunlaşdırılması (`/client`)

1. **Form Redaktoru (`front/src/modules/client/pages/Application/ClientApplication.tsx`):**
   - Mövcud anket forması A-G bölmələrinə uyğunlaşdırılır (Şəxsi məlumatlar, Səyahət sənədi, Əlaqə & Yaşayış, İş yeri, Səyahət planı, Dəvət edən tərəf/otel).
   - "Rəsmi Şengen Forması (PDF)" düyməsinə kliklədikdə birbaşa generasiya olunmuş rəsmi doldurulmuş PDF endirilir və ya yeni tabda açılır.
2. **Sihirbaz İnteqrasiyası (`front/src/modules/client/wizard/Steps/Step3Applicant.tsx`):**
   - MRZ skaneri pasportu oxuduqda `surname`, `firstname`, `doc_number`, `dob`, `doc_valid`, `nationality` və `sex` sahələrini anında doldurur.

---

### Mərhələ 3: B2B Turizm Agentliyi Portalının Uyğunlaşdırılması (`/agent`)

1. **Qrup Sərnişin Reyestri (`front/src/modules/agent/pages/Groups/AgentGroups.tsx`):**
   - Qrup daxilindəki hər bir sərnişin kartına/sətrinə **"📄 Rəsmi Şengen Forması (PDF)"** düyməsi əlavə olunur.
   - Agent istənilən sərnişinin anketini redaktə edib dərhal rəsmi PDF-ni çap edə bilir.
2. **Turistin Özünədoldurma Səhifəsi (`front/src/modules/agent/pages/ApplicantFill/AgentApplicantFill.tsx`):**
   - Linklə daxil olan turist üçün anket A-G bölmələri ilə zənginləşdirilir və məlumatlar təqdim edildikdən sonra turistə özünün doldurulmuş Şengen PDF-ni endirmək imkanı təqdim olunur.

---

### Mərhələ 4: B2B Korporativ HR Portalının Uyğunlaşdırılması (`/corporate`)

1. **İşçi Partiyaları (`front/src/modules/corporate/pages/Batches/CorporateBatches.tsx`):**
   - Partiya daxilindəki işçilərin anket tabı (`manageTab === 'form'`) tam Şengen A-G strukturuna uyğunlaşdırılır (vəzifə, şirkət zəmanəti, səfər məqsədi `Business`).
   - Hər bir əməkdaş üçün **"📄 Şengen Ərizəsi (PDF)"** endirmə düyməsi aktivləşdirilir.
2. **İşçiyə Dəvət Linki (`front/src/modules/corporate/pages/Delegation/CorporateDelegation.tsx`):**
   - 72 saatlıq təkistifadəlik linkə daxil olan əməkdaş pasport və anket sahələrini doldurduqda məlumatlar partiya bazasına oturur və rəsmi forma tam hazır olur.

---

## 🔒 5. Təhlükəsizlik və Məlumat Bütövlüyü

1. **AcroForm Flattening / Tamamlama:**
   - İnzibati və ya konsulluq təqdimatından əvvəl müraciətçi məlumatlarının dəyişdirilməsinin qarşısını almaq üçün istəyə uyğun olaraq sahələrin dondurulması (`form.flatten()`) seçimi təmin olunur.
2. **Xüsusi Simvolların Escape Edilməsi:**
   - Boş və ya `undefined` dəyərlər PDF-də xəta yaratmasın deyə bütün sahələr `String(value || '')` ilə təmizlənir.
3. **Audit Loqlama:**
   - Hər bir Şengen PDF generasiyası `AuditLog` cədvəlində `SCHENGEN_PDF_EXPORTED` hadisəsi ilə qeyd olunur.

---

## 📅 6. İcra Cədvəli və Addımların Ardıcıllığı

| Addım | Məzmun | Təsir Sahəsi | Gözlənilən Nəticə |
| :--- | :--- | :--- | :--- |
| **Addım 1** | `FORM-FILLED-SCHENGEN-FORM.pdf` və `DejaVuSans.ttf` fayllarının inteqrasiyası, `fontkit` paketinin quraşdırılması | Backend Fayl Sistemi | PDF şablonu və Unicode şrifti backend-də hazır olur. |
| **Addım 2** | `back/utils/schengenPdfFiller.util.js` generatorunun hazırlanması | Backend Utilləri | İstənilən müraciətçi obyektini qəbul edib rəsmi 4 səhifəlik doldurulmuş PDF yaradan mühərrik. |
| **Addım 3** | Backend API endpoint-lərinin əlaqələndirilməsi (`dossier.routes.js`, `dossier.service.js`) | Backend API | `/api/v1/dossiers/:dossierId/applicants/:applicantId/schengen-form-pdf` yeni şablonu qaytarır. |
| **Addım 4** | Client Portalında (`ClientApplication.tsx`) anket və PDF endirmə inteqrasiyası | Frontend Client | Fərdi müştəri formu doldurub rəsmi PDF-i əldə edir. |
| **Addım 5** | Agent Portalında (`AgentGroups.tsx` & `AgentApplicantFill.tsx`) inteqrasiya | Frontend Agent | Tur agent hər bir turist üçün rəsmi Şengen forması çıxarır. |
| **Addım 6** | Corporate Portalında (`CorporateBatches.tsx` & `CorporateDelegation.tsx`) inteqrasiya | Frontend Corporate | HR hər bir işçi üçün rəsmi biznes Şengen forması çıxarır. |
| **Addım 7** | Avtomatlaşdırılmış inteqrasiya testləri və PDF bütövlük yoxlaması | Test Suite | 3 portalın hər birindən çıxan PDF-lərin sahələri və vizual keyfiyyəti təsdiqlənir. |

---

## 🎯 Nəticə

Bu plan tam icra olunduqdan sonra:
- Viza müraciətçisinin daxil etdiyi bütün məlumatlar birbaşa Avropa İttifaqının rəsmi 4 səhifəlik Şengen anketinin müvafiq xanalarına oturacaq.
- Fərdi vətəndaş, Turizm agenti və Korporativ HR üçün vahid, mükəmməl və rəsmi konsulluq tələblərinə tam cavab verən sənəd generasiyası təmin ediləcək.
- Mövcud digər PDF və Excel hesabatları toxunulmaz qalacaq.
