# EUROTECH Backend — Tam və Ətraflı İcra Planı

Bu sənəd **yalnız backend (`back`)** sistemində icra ediləcək bütün işləri, verilənlər bazası dəyişikliklərini, yeni modulları, marşrutları, təhlükəsizlik və sənəd generasiyası məntiqini addım-addım əhatə edir. 

Frontend strukturunda gələcəkdə böyük dəyişikliklər olacağı üçün **frontend-ə toxunulmur**, lakin backend bütün ehtiyacları (Fərdi, Tur Agent, Korporativ HR, İnzibatçı) 100% qarşılayacaq şəkildə tam hazır vəziyyətə gətirilir.

---

## Mərhələ 1: Mövcud Kritik Boşluqların və Təhlükəsizlik Xətalarının Həlli

Bu mərhələdə mövcud sistemdə yarımçıq qalmış mexanizmlər tamamlanır:

### Addım 1.1: Sənəd Endirmə (Download) Marşrutu və Axını
* **Fayllar:** `modules/document/document.controller.js`, `modules/document/document.routes.js`
* **İcra:**
  * `document.service.js`-dəki 15 dəqiqəlik imzalanmış tokeni (`DOWNLOAD_SIGNED_URL`) qəbul edən `GET /api/v1/documents/:documentId/download?token=...` marşrutunun açılması.
  * Tokenin doğrulanması, sənədin mövcudluğunun yoxlanması və faylın `res.download` ilə təhlükəsiz ötürülməsi.
  * İcazəsiz və ya vaxtı keçmiş tokenlər üçün 401/403 xətalarının qaytarılması.

### Addım 1.2: GDPR Məxfilik (Privacy) Modulunun Aktivləşdirilməsi
* **Fayllar:** `modules/shared/privacy.controller.js` [YENİ], `modules/shared/privacy.routes.js` [YENİ], `routes/v1/index.js` [DƏYİŞDİRİLİR]
* **İcra:**
  * `POST /api/v1/privacy/anonymize` — İstifadəçinin öz hesabını və ərizəçilərini "Unudulmaq Hüququ"na uyğun anonimləşdirməsi.
  * `GET /api/v1/privacy/export-data` — İstifadəçinin bütün PII, dosye və tranzaksiya tarixçəsinin JSON formatında ixrac edilməsi.
  * Marşrutun `/api/v1/privacy` prefiksi ilə `routes/v1/index.js` daxilində qeydiyyatdan keçirilməsi.

### Addım 1.3: Yüklənən Faylların "Sehrli Baytlar" (Magic Bytes) ilə Yoxlanışı
* **Fayllar:** `modules/document/document.service.js`, `middlewares/upload.middleware.js`
* **İcra:**
  * `uploadDocument` funksiyasında fayl diskə yazıldıqdan dərhal sonra `inspectMagicBytes` çağırılaraq həqiqi ikili (binary) fayl başlığının (PDF `%PDF`, PNG, JPG) uzantı ilə uyğunluğu yoxlanılır.
  * Zərərli və ya saxta başlıqlı fayllar diskdən dərhal silinir və 400 təhlükəsizlik xətası qaytarılır.

---

## Mərhələ 2: Verilənlər Bazası Sxeminin Genişləndirilməsi (`prisma/schema.prisma`)

Backend-də çatışmayan bütün biznes subyektləri Prisma bazasına əlavə olunur və `npx prisma db push` (və ya migrate) edilir:

### Addım 2.1: Təqvim və Görüş Slotları Modelləri
* `TimeSlot`:
  * `id` (UUID), `date` (DateTime), `startTime` (String, məs: "10:30 AM"), `capacity` (Int, default 10), `bookedCount` (Int, default 0), `location` (String, məs: "EuroTech Main Center", "EuroTech Premium Lounge"), `isActive` (Boolean).
* `Appointment`:
  * `id` (UUID), `dossierId` (String?, Dossier ilə əlaqə), `groupBatchId` (String?, Qrup ilə əlaqə), `userId` (String), `timeSlotId` (String, TimeSlot ilə əlaqə), `status` (Enum: `CONFIRMED`, `PENDING_PAYMENT`, `CANCELLED`, `RESCHEDULED`), `notes` (String?).

### Addım 2.2: Qruplar və Partiyalar Modeli (`GroupBatch`)
* Həm Agent Qrupları (`GROUP_AGENT`), həm də Korporativ Partiyalar (`CORPORATE`) üçün vahid və güclü model:
  * `id` (UUID), `code` (String, unikal, məs: `GRP-8821` və ya `BCH-2026-101`), `portalType` (Enum: `GROUP_AGENT`, `CORPORATE`), `userId` (String, Agent və ya Korporativ HR), `name` (String, məs: "Vienna Summer Tour", "Vienna Summit Delegation"), `destination` (String), `travelDate` (DateTime), `duration` (String, "short" | "long"), `projectReason` (String), `status` (Enum: `DRAFT`, `PROCESSING`, `READY`, `COMPLETED`), `createdAt`, `updatedAt`.
  * `Dossier` ilə 1-to-N və ya 1-to-1 əlaqə.

### Addım 2.3: Korporativ İşçi Reyestri və Viza Tarixçəsi
* `CorporateEmployee`:
  * `id` (UUID), `corporateUserId` (String, HR istifadəçisi), `firstName` (String), `lastName` (String), `jobTitle` (String), `department` (String), `nationality` (String), `passportNumber` (String), `passportExpiry` (DateTime?), `email` (String?), `phone` (String?), `delegationTokenHash` (String?, birdəfəlik qonaq anket linki üçün), `delegationExpiresAt` (DateTime?).
* `VisaRecord`:
  * `id` (UUID), `employeeId` (String, CorporateEmployee ilə əlaqə), `country` (String), `type` (String, məs: "Schengen C (Business)"), `issueDate` (DateTime), `expiryDate` (DateTime), `status` (Enum: `ACTIVE`, `EXPIRED`, `PROCESSING`), `batchRef` (String?).

### Addım 2.4: Pul Kisəsi, Komissiyalar və Fakturalar
* `Wallet`:
  * `id` (UUID), `userId` (String, Agent və ya Korporativ), `balance` (Float, default 0.0), `pendingBalance` (Float, default 0.0), `currency` (String, default "EUR").
* `WalletTransaction`:
  * `id` (UUID), `walletId` (String), `amount` (Float), `type` (Enum: `CREDIT`, `DEBIT`), `referenceType` (Enum: `COMMISSION`, `PAYOUT`, `TOPUP`, `VISA_PAYMENT`), `referenceId` (String?), `description` (String), `status` (Enum: `COMPLETED`, `PENDING`, `REJECTED`).
* `PayoutRequest`:
  * `id` (UUID), `walletId` (String), `amount` (Float), `bankName` (String), `iban` (String), `swiftBic` (String), `status` (Enum: `PENDING`, `PROCESSED`, `REJECTED`), `processedAt` (DateTime?).
* `CorporateInvoice`:
  * `id` (UUID), `groupBatchId` (String?), `corporateUserId` (String), `invoiceNumber` (String, unikal, məs: `INV-2026-9012`), `amount` (Float), `dueDate` (DateTime), `status` (Enum: `PAID`, `PENDING`, `OVERDUE`), `pdfUrl` (String?).

### Addım 2.5: Xidmətlər Cədvəlinin Təkmilləşdirilməsi
* `AdditionalService` modelinə `applicantId String?` əlavə edilməsi (xidmətlərin hər bir sərnişinə fərdi seçilə bilməsi üçün).
* `config/constants.js` daxilinə yeni xidmət növlərinin və qiymətlərinin əlavə edilməsi (`PREMIUM_LOUNGE: 81.0`, `FILE_PREPARATION: 55.0`, `FORM_ASSIST: 24.0`, `BIOMETRIC_PHOTO: 12.0`).

---

## Mərhələ 3: Yeni Biznes Modullarının Yaradılması

Backend-də 3 yeni tamhüquqlu modul və köməkçi servislər qurulur:

### Modul 1: Təqvim və Görüş Modulu (`modules/appointment/`)
* **Struktur:** `appointment.service.js`, `appointment.controller.js`, `appointment.routes.js`
* **API Endpoint-lər:**
  1. `GET /api/v1/appointments/slots?date=YYYY-MM-DD&location=...` — Boş vaxt slotlarının və tutumlarının (`8/10`) siyahısı.
  2. `POST /api/v1/appointments/book` — Fərdi dosye və ya qrup/partiya üçün slot bron edilməsi (tutum 1 vahid artırılır).
  3. `PATCH /api/v1/appointments/:id/reschedule` — Mövcud görüş vaxtının başqa slota keçirilməsi.
  4. `DELETE /api/v1/appointments/:id/cancel` — Görüşün ləğv edilməsi və slot tutumunun azad edilməsi.
  5. `GET /api/v1/appointments/:id/manifest-pdf` — Qrup/partiya sərnişinlərinin rəsmi səfirlik manifesti (PDF) generasiyası və endirilməsi.

### Modul 2: Tur Agent Modulu (`modules/agent/`)
* **Struktur:** `agent.service.js`, `agent.controller.js`, `agent.routes.js`
* **API Endpoint-lər:**
  1. `POST /api/v1/agent/groups` — Yeni tur qrupunun yaradılması (`name`, `destination`, `travelDate`, `duration`, `projectReason`).
  2. `GET /api/v1/agent/groups` — Agentin yaratdığı bütün qruplar və onların sərnişin tərəqqisi (`formProgress`).
  3. `GET /api/v1/agent/groups/:id` — Tək qrupun detalları və sərnişinləri.
  4. `POST /api/v1/agent/groups/:id/submit` — Qrupun emala göndərilməsi.
  5. `GET /api/v1/agent/wallet` — Agentin balans məlumatları (`Available`, `Pending`, `Total Earned`).
  6. `POST /api/v1/agent/payout-request` — Bank hesabına çıxarış tələbi açılması (IBAN, SWIFT).
  7. `GET /api/v1/agent/transactions/export-csv` — Maliyyə əməliyyatlarının CSV formatında endirilməsi.

### Modul 3: Korporativ HR Modulu (`modules/corporate/`)
* **Struktur:** `corporate.service.js`, `corporate.controller.js`, `corporate.routes.js`
* **API Endpoint-lər:**
  1. `POST /api/v1/corporate/batches` — Yeni işçi partiyasının yaradılması.
  2. `GET /api/v1/corporate/batches` — Aktiv və tamamlanmış partiyaların siyahısı.
  3. `POST /api/v1/corporate/batches/:batchId/delegation-link` — İşçi üçün 72 saatlıq təhlükəsiz nümayəndəlik linki tokeni formalaşdırılması.
  4. `GET /api/v1/corporate/delegation/:token` — İşçinin daxil olub öz anketini doldurması üçün ictimai/təhlükəsiz qonaq API-si.
  5. `POST /api/v1/corporate/delegation/:token/submit` — İşçinin öz pasport və sənədlərini birbaşa partiyaya təqdim etməsi.
  6. `GET /api/v1/corporate/employees` — Şirkətin işçi reyestri, axtarış və viza tarixçələri (`visaHistory`).
  7. `POST /api/v1/corporate/employees` — Yeni işçinin reyestrə əlavə edilməsi.
  8. `GET /api/v1/corporate/invoices` — Qaimə-fakturaların siyahısı.
  9. `POST /api/v1/corporate/batches/:batchId/pay-wallet` — Şirkət depozit balansından partiya rüsumunun silinməsi.
  10. `GET /api/v1/corporate/invoices/:id/pdf` — Proforma faktura PDF-nin generasiyası və endirilməsi.

---

## Mərhələ 4: Mərkəzi Router və Təhlükəsizlik Əlaqələndirilməsi

* **Fayl:** `routes/v1/index.js`
* Yeni açılan bütün marşrutlar mərkəzi API router-inə qoşulur:
  * `router.use('/appointments', appointmentRoutes)`
  * `router.use('/agent', agentRoutes)`
  * `router.use('/corporate', corporateRoutes)`
  * `router.use('/privacy', privacyRoutes)`
* Hər bir marşrut müvafiq RBAC rolları ilə qorunur (`requireRoles(['AGENT_TUR_OPERATOR'])`, `requireRoles(['CORPORATE_HR'])`).

---

## Mərhələ 5: Seed Məlumatları və İnteqrasiya Testləri

### Addım 5.1: İlkin Məlumatların Genişləndirilməsi (`prisma/seed.js`)
* Real sınaqlar üçün nümunə vaxt slotları (`TimeSlot`), nümunə tur qrupu, nümunə korporativ partiya və işçi profilləri əlavə olunur.
* Nümunə pul kisələri (`Wallet`) balanslarla təchiz edilir.

### Addım 5.2: Avtomatlaşdırılmış 20+ Addımlı İnteqrasiya Testi (`test-all.js`)
* `test-all.js` skripti genişləndirilərək bütün yeni funksiyaları test edir:
  1. Signed URL ilə sənədin fiziki endirilməsi (`Download 200 OK`).
  2. Sehrli baytlar yoxlanışı (saxta fayl uzantısının 400 ilə rədd edilməsi).
  3. GDPR anonimləşdirmə və məlumat ixracı.
  4. Təqvimdən slot axtarışı, bron etmə və vaxt dəyişmə.
  5. Qrup üçün Manifest PDF faylının generasiyası.
  6. Agent qrupunun yaradılması və komissiya daxilolması.
  7. Korporativ partiyanın yaradılması, nümayəndəlik linki və şirkət balansından ödəniş.

---

## Nəticə

Bu planın icrasından sonra backend tam şəkildə müstəqil, güclü, enterprise səviyyəli və gələcəkdə frontend necə dəyişirsə-dəyişsin, onun hər bir tələbini dərhal cavablandırmağa hazır olacaqdır.
