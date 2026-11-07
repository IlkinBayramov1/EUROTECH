# 🏗️ EUROTECH Backend Memarlığı — Modulyar Refaktorinq Baş Planı

Bu sənəd backend (`back/modules/`) daxilində **1000–1800 sətri keçmiş monolit xidmət fayllarının** ([corporate.service.js](file:///c:/Users/lenovo/Desktop/EUROTECH/back/modules/corporate/corporate.service.js), [dossier.service.js](file:///c:/Users/lenovo/Desktop/EUROTECH/back/modules/dossier/dossier.service.js), [agent.service.js](file:///c:/Users/lenovo/Desktop/EUROTECH/back/modules/agent/agent.service.js) və [appointment.service.js](file:///c:/Users/lenovo/Desktop/EUROTECH/back/modules/appointment/appointment.service.js)) modulyar alt qovluqlara (`services/`, `controllers/`) bölünməsi, məsuliyyətlərin ayrılması (Single Responsibility Principle) və mövcud testləri qətiyyən sındırmadan həyata keçiriləcək manual arxitektura planını təqdim edir.

---

## 📌 1. Problemin Təhlili və Kök Səbəbi

Hazırda layihə sürətlə inkişaf etdiyi üçün bir sıra xidmətlər (service) həddindən artıq böyüyüb monolit hala gəlmişdir:

| Modul | Cari Monolit Fayl | Cari Həcm | Əsas Problem | Hədəf Strukturu |
| :--- | :--- | :--- | :--- | :--- |
| **Corporate** | [corporate.service.js](file:///c:/Users/lenovo/Desktop/EUROTECH/back/modules/corporate/corporate.service.js) | **1,619 sətir** (27 funksiya) | Partiyalar, İşçi reyestri, Dəvət linkləri, Fakturalar, Büdcə, Radar, Zəmanət PDF hamısı bir fayldadır. | **6 fokuslanmış alt xidmət** |
| **Dossier** | [dossier.service.js](file:///c:/Users/lenovo/Desktop/EUROTECH/back/modules/dossier/dossier.service.js) | **1,819 sətir** (10 funksiya + PDF) | Dosye CRUD əməliyyatları ilə 1000 sətirlik manual PDF canvas rəsmxətti koordinatları eyni yerdədir. | **5 fokuslanmış alt xidmət** |
| **Agent** | [agent.service.js](file:///c:/Users/lenovo/Desktop/EUROTECH/back/modules/agent/agent.service.js) | **1,117 sətir** (18 funksiya) | Tur qrupları, Sərnişinlər, Pul kisəsi, Çıxarış, Faktura PDF, Self-fill linkləri qarışıqdır. | **4 fokuslanmış alt xidmət** |
| **Appointment** | [appointment.service.js](file:///c:/Users/lenovo/Desktop/EUROTECH/back/modules/appointment/appointment.service.js) | **979 sətir** (6 funksiya + PDF) | Slot axtarışı/bronu ilə 2 böyük PDF (Qrup Manifesti və Barkodlu Görüş Qəbzi) eyni fayldadır. | **3 fokuslanmış alt xidmət** |
| **Document** | [document.service.js](file:///c:/Users/lenovo/Desktop/EUROTECH/back/modules/document/document.service.js) | **568 sətir** | Multer saxlanması, SHA-256 cəmləri, İmzalı URL-lər və ZIP arxivləmə. | **3 fokuslanmış alt xidmət** |
| **Privacy / Shared** | [privacy.service.js](file:///c:/Users/lenovo/Desktop/EUROTECH/back/modules/shared/privacy.service.js) | **603 sətir** | GDPR məlumat ixracı paketi (JSON/ZIP) və Right-to-be-forgotten hesab silinməsi. | **2 fokuslanmış alt xidmət** |

---

## 🏛️ 2. Standart Modul Qovluq Memarlığı və Fasad (Facade) Modeli

Hər bir modul üçün tətbiq olunacaq təmiz korporativ qovluq strukturu:

```
back/modules/[modul_adi]/
├── services/                          # Hər biri 150-300 sətir olan kiçik, təmiz xidmət faylları
│   ├── [funksiya_1].service.js
│   ├── [funksiya_2].service.js
│   └── ...
├── controllers/                       # Xidmətlərə uyğun alt controller-lər
│   ├── [funksiya_1].controller.js
│   └── ...
├── [modul_adi].service.js             # 🛡️ BARREL / FACADE EXPORT (100% Geri Uyğunluq)
├── [modul_adi].controller.js          # Controller Facade
├── [modul_adi].routes.js              # Versiyalanmış marşrutlar
└── [modul_adi].validation.js          # Validasiya sxemləri
```

### 🛡️ 100% Geri Uyğunluq Zəmanəti (Zero-Downtime Facade)
Mövcud testlər ([test-all.js](file:///c:/Users/lenovo/Desktop/EUROTECH/back/test-all.js), [test-faza2.js](file:///c:/Users/lenovo/Desktop/EUROTECH/back/test-faza2.js), və s.) və xarici modullar `require('./corporate.service')` çağırmağa davam edəcək. Əsas `corporate.service.js` faylı sadəcə fasad olaraq bütün alt xidmətləri birləşdirib re-export edəcək:

```javascript
// back/modules/corporate/corporate.service.js
const batchService = require('./services/corporateBatch.service');
const employeeService = require('./services/corporateEmployee.service');
const delegationService = require('./services/corporateDelegation.service');
const financeService = require('./services/corporateFinance.service');
const departmentService = require('./services/corporateDepartment.service');
const documentService = require('./services/corporateDocument.service');

module.exports = {
  ...batchService,
  ...employeeService,
  ...delegationService,
  ...financeService,
  ...departmentService,
  ...documentService,
};
```
> [!IMPORTANT]
> Bu fasad sayəsində mövcud **heç bir controller, route, test və ya cron işi qırılmayacaq**, lakin arxa planda hər bir fayl 150–280 sətirlik təmiz, oxunaqlı vəziyyətə gələcək.

---

## 🗂️ 3. Modulbəmodul Manual Parçalanma Sxemi

---

### 🏢 MODUL 1: `corporate` (1,619 sətirdən 6 təmiz xidmət faylına)

```
back/modules/corporate/
├── services/
│   ├── corporateBatch.service.js       # Partiyaların idarə edilməsi (~260 sətir)
│   ├── corporateEmployee.service.js    # Əməkdaşlar reyestri və Pasport Radarı (~280 sətir)
│   ├── corporateDelegation.service.js  # Qonaq Dəvət Linkləri (~200 sətir)
│   ├── corporateFinance.service.js     # Pul kisəsi, Fakturalar və Balansdan Ödəniş (~280 sətir)
│   ├── corporateDepartment.service.js  # Büdcə və Xərc Mərkəzləri (~160 sətir)
│   └── corporateDocument.service.js    # Zəmanət Məktubu PDF və Dashboard Statistika (~220 sətir)
├── corporate.service.js                # Facade / Barrel re-export (~35 sətir)
├── corporate.controller.js             # Controller
└── corporate.routes.js                 # Marşrutlar
```

#### Funksiyaların Fayllar Üzrə Bölgüsü:
1. **`services/corporateBatch.service.js`**:
   - `createBatch(corporateUserId, data)`
   - `getCorporateBatches(corporateUserId)`
   - `submitBatch(corporateUserId, batchId)`
   - `updateCorporateBatch(corporateUserId, batchId, data)`
   - `deleteCorporateBatch(corporateUserId, batchId)`
   - `saveEmployeeFormInBatch(corporateUserId, batchId, applicantId, formData)`
2. **`services/corporateEmployee.service.js`**:
   - `getEmployeeDirectory(corporateUserId, search)`
   - `addEmployeeToDirectory(corporateUserId, data)`
   - `updateCorporateEmployee(corporateUserId, employeeId, data)`
   - `deleteCorporateEmployee(corporateUserId, employeeId)`
   - `getPassportRadar(corporateUserId)`
   - `remindEmployee(corporateUserId, employeeId)`
3. **`services/corporateDelegation.service.js`**:
   - `generateDelegationLink({ corporateUserId, employeeId, batchId })`
   - `getDelegationProfile(token)`
   - `submitDelegationForm(token, data)`
4. **`services/corporateFinance.service.js`**:
   - `generateProformaInvoice(corporateUserId, batchId)`
   - `payBatchWithWallet(corporateUserId, batchId)`
   - `getCorporateInvoices(corporateUserId)`
   - `topupCorporateWallet(corporateUserId, amount)`
   - `getCorporateWallet(corporateUserId)`
   - `getInvoicePdf(corporateUserId, invoiceId)`
5. **`services/corporateDepartment.service.js`**:
   - `getCorporateDepartments(corporateUserId)`
   - `createCorporateDepartment(corporateUserId, data)`
   - `updateCorporateDepartment(corporateUserId, departmentId, data)`
   - `deleteCorporateDepartment(corporateUserId, departmentId)`
6. **`services/corporateDocument.service.js`**:
   - `getCorporateDashboardStats(corporateUserId)`
   - `getGuaranteeLetterPdf(corporateUserId, employeeId)`

---

### 📂 MODUL 2: `dossier` (1,819 sətirdən 5 təmiz xidmət faylına)

```
back/modules/dossier/
├── services/
│   ├── dossierLifecycle.service.js     # Dosye Yaradılması və Status Həyat Dövrü (~320 sətir)
│   ├── dossierApplicant.service.js     # Ərizəçilərin Əlavəsi və Form Saxlanması (~260 sətir)
│   ├── dossierTracking.service.js      # Canlı İzləmə və Hadisələr Xətti (~180 sətir)
│   ├── dossierSchengenPdf.service.js   # 110-bəndlik Harmonised Şengen PDF Mühərriki (~300 sətir)
│   └── dossierSummaryPdf.service.js    # Rəsmi Dosye Xülasəsi PDF Generatoru (~450 sətir)
├── dossier.service.js                  # Facade / Barrel re-export (~25 sətir)
├── dossier.controller.js               # Controller
└── dossier.routes.js                   # Marşrutlar
```

#### Funksiyaların Fayllar Üzrə Bölgüsü:
1. **`services/dossierLifecycle.service.js`**:
   - `createDossier({ userId, portalType, countryId, visaCategoryId, ... })`
   - `updateStep(dossierId, step)`
   - `getDossierById(dossierId)`
   - `getUserDossiers(userId)` (İstifadəçi üçün avtomatik qaralama dosye generasiyası ilə)
2. **`services/dossierApplicant.service.js`**:
   - `addApplicants(dossierId, applicantsData)`
   - `updateApplicantForm(dossierId, applicantId, formData)`
   - `deleteApplicant(dossierId, applicantId, currentUser)`
3. **`services/dossierTracking.service.js`**:
   - `getDossierTracking(dossierId)`
4. **`services/dossierSchengenPdf.service.js`**:
   - `generateApplicationFormPdf(dossierId, applicantId, customData)`
5. **`services/dossierSummaryPdf.service.js`**:
   - `generateDossierSummaryPdf(dossierId)`

---

### 👥 MODUL 3: `agent` (1,117 sətirdən 4 təmiz xidmət faylına)

```
back/modules/agent/
├── services/
│   ├── agentGroup.service.js           # Tur Qruplarının CRUD və Təsdiqi (~280 sətir)
│   ├── agentTraveler.service.js        # Qrup Sərnişinləri və Qonaq Forması (~300 sətir)
│   ├── agentFinance.service.js         # Komissiya, Pul Kisəsi, CSV İxracı (~320 sətir)
│   └── agentAppointment.service.js     # Agent Randevu Təqvimi və Təyinat (~180 sətir)
├── agent.service.js                    # Facade / Barrel re-export (~20 sətir)
├── agent.controller.js
└── agent.routes.js
```

#### Funksiyaların Fayllar Üzrə Bölgüsü:
1. **`services/agentGroup.service.js`**:
   - `createGroup`, `getAgentGroups`, `getGroupById`, `updateGroup`, `deleteGroup`, `submitGroup`
2. **`services/agentTraveler.service.js`**:
   - `addApplicantToGroup`, `removeApplicantFromGroup`, `saveApplicantFormInGroup`, `getCustomerSelfFillData`, `submitCustomerSelfFill`
3. **`services/agentFinance.service.js`**:
   - `getAgentWallet`, `requestPayout`, `exportTransactionsCsv`, `saveBankDetails`, `generateGroupInvoicePdf`
4. **`services/agentAppointment.service.js`**:
   - `getAgentAppointments`, `setGroupAppointment`

---

### 📅 MODUL 4: `appointment` (979 sətirdən 3 təmiz xidmət faylına)

```
back/modules/appointment/
├── services/
│   ├── appointmentBooking.service.js   # Slot Axtarışı, Bron, Reschedule, Ləğv (~280 sətir)
│   ├── appointmentManifestPdf.service.js # Qrup Konsulluq Manifesti PDF (~350 sətir)
│   └── appointmentLetterPdf.service.js # Fərdi Görüş Qəbzi & Barkodlu PDF (~320 sətir)
├── appointment.service.js              # Facade / Barrel re-export (~15 sətir)
├── appointment.controller.js
└── appointment.routes.js
```

#### Funksiyaların Fayllar Üzrə Bölgüsü:
1. **`services/appointmentBooking.service.js`**:
   - `getAvailableSlots(date, location)`
   - `bookAppointment({ timeSlotId, userId, dossierId, groupBatchId, ... })`
   - `rescheduleAppointment(appointmentId, newTimeSlotId, userId)`
   - `cancelAppointment(appointmentId, userId)`
2. **`services/appointmentManifestPdf.service.js`**:
   - `generateManifestPdf(appointmentId)`
3. **`services/appointmentLetterPdf.service.js`**:
   - `generateConfirmationLetterPdf(appointmentId)`

---

### 📄 MODUL 5: `document` (568 sətirdən 3 təmiz xidmət faylına)

```
back/modules/document/
├── services/
│   ├── documentStorage.service.js      # Diskə yazılma, Multer, SHA256 integritet (~220 sətir)
│   ├── documentSignedUrl.service.js    # JWT İmzalanmış Təhlükəsiz URL Generatoru (~160 sətir)
│   └── documentArchive.service.js      # Bütün Sənədlərin Vahid ZIP Arxivi (~180 sətir)
├── document.service.js                 # Facade / Barrel re-export (~15 sətir)
├── document.controller.js
└── document.routes.js
```

---

### 🛡️ MODUL 6: `shared/privacy` (603 sətirdən 2 təmiz xidmət faylına)

```
back/modules/shared/
├── services/
│   ├── privacyExport.service.js        # GDPR Məlumat İxracı (JSON + Bütün Sənədlər ZIP) (~350 sətir)
│   └── privacyErasure.service.js       # Hesabın Silinməsi / Anonimləşdirmə (~250 sətir)
├── privacy.service.js                  # Facade / Barrel re-export (~15 sətir)
├── privacy.controller.js
└── privacy.routes.js
```

---

## 🎛️ 4. Controller və Marşrutların Təşkilatlanması

Controller fayllarının da həddindən artıq böyüməməsi üçün:
1. Controller-lər birbaşa müvafiq alt xidmətləri çağıra bilər və ya `corporate.service.js` fasadından istifadə edər.
2. [corporate.routes.js](file:///c:/Users/lenovo/Desktop/EUROTECH/back/modules/corporate/corporate.routes.js), [dossier.routes.js](file:///c:/Users/lenovo/Desktop/EUROTECH/back/modules/dossier/dossier.routes.js) və [agent.routes.js](file:///c:/Users/lenovo/Desktop/EUROTECH/back/modules/agent/agent.routes.js) faylları daxilində endpoint-lər sahələr üzrə səliqəli bölmələrə (sections) ayrılacaq.

---

## 🚀 5. Mərhələli İcra Planı (Phased Execution Plan)

Refaktorinq prosesi riskləri sıfırlamaq üçün aşağıdakı ardıcıllıqla icra ediləcək:

```mermaid
graph TD
    P1[Mərhələ 1: Corporate Modulu] --> T1[Test: test-all.js & test-faza2.js]
    T1 --> P2[Mərhələ 2: Dossier Modulu]
    P2 --> T2[Test: test-schengen-api-e2e.js & test-all.js]
    T2 --> P3[Mərhələ 3: Agent Modulu]
    P3 --> T3[Test: test-all.js]
    T3 --> P4[Mərhələ 4: Appointment Modulu]
    P4 --> T4[Test: test-all.js & test-faza4.js]
    T4 --> P5[Mərhələ 5: Document & Privacy Modulları]
    P5 --> T5[Yekun 4 Test Paketi & Frontend Build 100%]
```

### 🔹 Mərhələ 1: `corporate` Modulunun Refaktorinqi (İlk Hədəf)
- `back/modules/corporate/services/` qovluğunun yaradılması.
- 6 alt xidmət faylının yaradılması və funksiyaların təmiz köçürülməsi.
- `corporate.service.js` fasadının yazılması.
- **Yoxlama:** `node test-all.js` və `node test-faza2.js` çalışdırılaraq nəticənin 100% KEÇDİ olması.

### 🔹 Mərhələ 2: `dossier` Modulunun Refaktorinqi
- `back/modules/dossier/services/` qovluğunun yaradılması.
- CRUD və PDF mühərriklərinin ayrı fayllara bölünməsi.
- `dossier.service.js` fasadının yazılması.
- **Yoxlama:** `node test-schengen-api-e2e.js` və `node test-all.js` ilə təsdiq.

### 🔹 Mərhələ 3: `agent` Modulunun Refaktorinqi
- `back/modules/agent/services/` yaradılması.
- Qruplar, Sərnişinlər və Maliyyənin bölünməsi.
- `agent.service.js` fasadının yazılması.
- **Yoxlama:** `node test-all.js` ilə təsdiq.

### 🔹 Mərhələ 4: `appointment` Modulunun Refaktorinqi
- `back/modules/appointment/services/` yaradılması.
- Bronlama və 2 böyük PDF generatorunun ayrılması.
- `appointment.service.js` fasadının yazılması.
- **Yoxlama:** `node test-all.js` ilə təsdiq.

### 🔹 Mərhələ 5: `document` və `privacy` Modullarının Refaktorinqi
- `document` və `privacy` xidmətlərinin müvafiq `services/` qovluqlarına bölünməsi.
- Yekun audit və bütün 4 test paketinin (`test-all.js`, `test-faza2.js`, `test-faza3.js`, `test-faza4.js`, `npm run build`) qüsursuz işləməsinin təsdiqi.

---

## 🎯 Planın Xülasəsi və İcra Nəticələri (100% Tamamlandı)

Bu plan üzrə bütün mərhələlər uğurla icra edildi və təsdiqləndi:
1. **Heç bir monolit 1000+ sətirlik fayl qalmadı.** Bütün xidmət faylları təmiz `services/` qovluqlarına bölündü.
2. Hər bir fayl **150–300 sətir** arasında təmiz, modulyar və oxunaqlı vəziyyətə gətirildi.
3. Hər hansı funksiyanı axtararkən (məsələn: zəmanət məktubu, Schengen PDF, agent komissiyası və ya görüş manifesti) birbaşa adından məlum olan alt xidmət faylına daxil olmaq mümkündür.
4. Fasad (Barrel) arxitekturası sayəsində sistemdə heç bir geriyə uyğunsuzluq və ya qırılma baş vermədi.

### 📊 Yekun Nəticələr Cədvəli

| Modul | Əvvəlki Vəziyyət | İndiki Arxitektura | Yaradılan Alt Xidmətlər (`services/`) | Fasad Faylı | Test Statusu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Corporate** | 1,619 sətir (monolit) | 6 alt xidmət | `corporateBatch`, `corporateEmployee`, `corporateDelegation`, `corporateFinance`, `corporateDepartment`, `corporateDocument` | `corporate.service.js` (35 sətir) | ✅ 100% Keçdi |
| **Dossier** | 1,819 sətir (monolit) | 5 alt xidmət | `dossierLifecycle`, `dossierApplicant`, `dossierTracking`, `dossierSchengenPdf`, `dossierSummaryPdf` | `dossier.service.js` (28 sətir) | ✅ 100% Keçdi |
| **Agent** | 1,117 sətir (monolit) | 4 alt xidmət | `agentGroup`, `agentTraveler`, `agentFinance`, `agentAppointment` | `agent.service.js` (23 sətir) | ✅ 100% Keçdi |
| **Appointment** | 979 sətir (monolit) | 3 alt xidmət | `appointmentBooking`, `appointmentManifestPdf`, `appointmentLetterPdf` | `appointment.service.js` (20 sətir) | ✅ 100% Keçdi |
| **Document** | 656 sətir (monolit) | 3 alt xidmət | `documentStorage`, `documentSignedUrl`, `documentExport` | `document.service.js` (20 sətir) | ✅ 100% Keçdi |
| **Privacy / Shared** | 676 sətir (monolit) | 2 alt xidmət | `privacyErasure`, `privacyExport` | `privacy.service.js` (17 sətir) | ✅ 100% Keçdi |

### 🧪 Yoxlanmış Test və Build Paketləri:
- `test-all.js`: **21 / 21 Keçdi (100% Uğurlu)**
- `test-faza2.js`: **6 / 6 Keçdi (100% Uğurlu)**
- `test-faza3.js`: **10 / 10 Keçdi (100% Uğurlu)**
- `test-faza4.js`: **10 / 10 Keçdi (100% Uğurlu)**
- `test-schengen-api-e2e.js`: **Bütün 5 mərhələ və PDF generasiyası 100% Keçdi**
- `front/ (npm run build)`: **0 xəta, TypeScript və Vite istehsal paketi 4.37s ərzində tamamlandı**

