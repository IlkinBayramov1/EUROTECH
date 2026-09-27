# 🚀 EUROTECH — 4 FAZALI MASTER PLAN VƏ FAZA 1 DƏRİN İCRA PLANI

> **Sənəd Növü:** Layihənin İnkişaf və Dəyişiklik Strategiyası  
> **Tarix:** 27 Sentyabr 2026  
> **Status:** İcraya Hazır  
> **Əlaqəli Portallar:** Fərdi Müştəri (B2C), Turizm Agenti (B2B Agent), Korporativ Şirkət (B2B Corporate), İnzibatçı & Konsulluq (Admin/Operator)

---

## 🧭 ÜMUMİ 4 FAZALI YOL XƏRİTƏSİ (İcmal)

Bütün 4 fazanı ardıcıllıqla icra edəcəyik. Bu bölmə digər fazaların unudulmaması üçün qeyd edilmişdir:

| Faza | Adı | Əhatə Dairəsi | Əsas Məqsəd |
| :---: | :--- | :--- | :--- |
| **FAZA 1** | **🛡️ Admin & Konsulluq Portalı (UI & Workflow)** | Frontend-də `/admin` portalı, İnzibatçı karkası (Layout), Dashboard metrikləri, Dosye reyestri, Sənəd ekspertizası (PDF/Şəkil önbaxış, Təsdiq/İmtina/Düzəliş), Yekun konsulluq qərarları, Sənəd arxivi (ZIP/PDF) | Backend-də hazır olan inzibatçı API-lərini tam vizual idarəetmə mərkəzinə çevirmək |
| **FAZA 2** | **⚙️ Portalların Biznes Məntiqlərinin Fərdiləşdirilməsi** | **Fərdi:** Pasport OCR/avtomatik tanıma, genişləndirilmiş anket sualları, ailə üzvləri əlaqəsi.<br>**Agent:** Tur paketlərinin dinamik qiymətləndirilməsi, avtomatik komissiya dərəcələri, qrup qaimələri.<br>**Korporativ:** Şöbələr üzrə səyahət büdcəsi, işçilərin pasport bitmə xəbərdarlıqları, kütləvi işçi idxalı (Excel CSV/XLSX). | Hər bir istifadəçi profilinin xüsusi biznes ehtiyaclarını və rahatlığını maksimuma çatdırmaq |
| **FAZA 3** | **🔌 Real Xarici İnteqrasiyalar (Real Servislər)** | Real SMTP E-poçt provayderi (Mailgun / SendGrid / Amazon SES), Real Ödəniş Gateway (Stripe Elements / Yerli Bank E-Commerce), SMS / WhatsApp bildiriş inteqrasiyası (Twilio / InfoBip) | Test və mock servislərdən çıxaraq real ödəniş və bildiriş dövriyyəsini təmin etmək |
| **FAZA 4** | **🌍 Çoxdillilik (i18n), Təhlükəsizlik və Production** | Bütün interfeysin 3 dildə (AZ / EN / RU) tam lokalizasiyası (`i18next`), CSRF/XSS və Rate Limiting auditi, MySQL indeksləmə, E2E testlərinin genişləndirilməsi, Docker və Cloud deploy | Enterprise səviyyəli qlobal istifadəyə və yüksək təhlükəsizliyə tam hazırlıq |

---

# 🛡️ FAZA 1: İNZİBATÇI VƏ KONSULLUQ PORTALI (ADMIN WORKSPACE) — GENİŞ İCRA PLANI

## 1. Problemin Mahiyyəti və Faza 1-in Məqsədi
Hazırda `back` sistemində:
- Admin üçün dashboard statistikaları (`GET /api/v1/admin/metrics`),
- Bütün müraciətlərin axtarış və filtrləmə API-si (`GET /api/v1/admin/dossiers`),
- Sənəd yoxlanışı və düzəliş qeydi (`PATCH /api/v1/documents/:documentId/review`),
- Müraciətçiyə e-poçtla bildiriş göndərilməsi (`POST /api/v1/documents/dossier/:dossierId/send-feedback`),
- Yekun konsulluq qərarı (`PATCH /api/v1/admin/dossier/:dossierId/decision`),
- Arxivləşdirmə və ZIP/PDF ixracı (`GET /api/v1/documents/dossier/:dossierId/export-checklist`)
**100% mövcuddur və backend testlərindən uğurla keçir.**

Lakin **Frontend-də (`front`) heç bir Admin interfeysi yoxdur.** Admin və ya Konsulluq operatoru sistemə daxil ola və ya sənədlərə baxa bilmir.

Faza 1-in məqsədi: **Frontend-də tam funksional, müasir Dark-Glassmorphism dizaynında Konsulluq & Admin Portalı qurmaqdır.**

---

## 2. Yaradılacaq və Dəyişdiriləcək Faylların Xəritəsi

```
front/
├── src/
│   ├── modules/
│   │   ├── admin/                                  # [YENİ QOVLUQ]
│   │   │   ├── pages/
│   │   │   │   ├── Dashboard/
│   │   │   │   │   ├── AdminDashboard.tsx          # Mərkəzi idarəetmə paneli və KPI metriklər
│   │   │   │   │   └── AdminDashboard.css          # Qaranlıq premium statistika stilləri
│   │   │   │   ├── Dossiers/
│   │   │   │   │   ├── AdminDossierList.tsx        # Bütün müraciətlərin cədvəli və filtr mərkəzi
│   │   │   │   │   ├── AdminDossierList.css        # Cədvəl, axtarış və status stilləri
│   │   │   │   │   ├── AdminDossierDetail.tsx      # Tək dosyenin konsulluq ekspertiza masası
│   │   │   │   │   └── AdminDossierDetail.css      # Sənəd önbaxış və qərar qəbulu stilləri
│   │   │   │   ├── AuditLogs/
│   │   │   │   │   ├── AdminAuditLogs.tsx          # Sistem təhlükəsizlik və hərəkət loqları
│   │   │   │   │   └── AdminAuditLogs.css
│   │   │   │   └── Settings/
│   │   │   │       ├── AdminSettings.tsx           # Ölkələr, rüsumlar və viza qaydaları tənzimləmələri
│   │   │   │       └── AdminSettings.css
│   │   │   └── components/
│   │   │       ├── DocumentReviewModal.tsx         # Sənədin PDF/Şəkil önbaxışı və status təyini
│   │   │       ├── ConsularDecisionModal.tsx       # Yekun Viza Verildi / İmtina modalı
│   │   │       └── DossierStatusBadge.tsx          # Vahid rəng kodlu status nişanı
│   │   ├── auth/pages/
│   │   │   ├── SelectProfile.tsx                   # [DƏYİŞDİRİLİR] 4-cü "Admin/Konsulluq" kartı əlavə edilir
│   │   │   └── AuthPage.tsx                        # [DƏYİŞDİRİLİR] Admin giriş modu dəstəklənir
│   ├── layouts/
│   │   └── AdminLayout/                            # [YENİ QOVLUQ]
│   │       ├── AdminLayout.tsx                     # Operator yan menyusu (Sidebar) və Header
│   │       └── AdminLayout.css                     # Xüsusi qırmızı/qızılı konsulluq çalarlı stillər
│   ├── shared/
│   │   ├── api/services/
│   │   │   ├── admin.service.ts                    # [YENİ] Bütün /api/v1/admin API çağırışları
│   │   │   └── index.ts                            # [DƏYİŞDİRİLİR] Export siyahısına əlavə
│   │   └── types/
│   │       ├── admin.types.ts                      # [YENİ] Admin metrik və dosye tipləri
│   │       └── auth.types.ts                       # [YOXLANILIR] ADMIN və OPERATOR rolları
│   └── App.tsx                                     # [DƏYİŞDİRİLİR] /admin marşrutları və ProtectedRoute
```

---

## 3. Faza 1-in Addım-Addım Texniki İcra Planı

### Addım 1.1: Tiplər və API Servisi (`admin.service.ts` & `admin.types.ts`)
1. `front/src/shared/types/admin.types.ts`:
   - `AdminMetrics`: `activeDossiers`, `underReviewCount`, `approvedThisMonth`, `totalRevenue`.
   - `AdminDossierFilter`: `status`, `portalType`, `search`, `page`, `limit`.
   - `DocumentReviewPayload`: `status: 'VERIFIED' | 'NEEDS_CORRECTION' | 'REJECTED'`, `operatorNotes?: string`.
   - `ConsularDecisionPayload`: `nextStatus: 'APPROVED' | 'REJECTED' | 'SUBMITTED_TO_CONSULATE' | 'UNDER_REVIEW'`, `notes?: string`.
2. `front/src/shared/api/services/admin.service.ts`:
   - `getMetrics()`: `GET /admin/metrics`
   - `getAllDossiers(params)`: `GET /admin/dossiers?status=...&portalType=...&search=...&page=...`
   - `getDossierById(dossierId)`: `GET /dossiers/${dossierId}`
   - `reviewDocument(docId, payload)`: `PATCH /documents/${docId}/review`
   - `sendDocumentFeedback(dossierId, notes)`: `POST /documents/dossier/${dossierId}/send-feedback`
   - `updateDossierDecision(dossierId, payload)`: `PATCH /admin/dossier/${dossierId}/decision`
   - `getChecklistPdf(dossierId)`: `GET /documents/dossier/${dossierId}/export-checklist`
   - `getAuditLogs()`: Sistem hərəkət tarixçəsi.

---

### Addım 1.2: Giriş və Autentifikasiya İnteqrasiyası (`SelectProfile` & `AuthPage`)
1. **`SelectProfile.tsx`**:
   - 4-cü profil kartı əlavə edilir: **"🛡️ Consular & Admin Desk"**.
   - Təsvir: *Sənəd ekspertizası, viza qərarları, konsulluq qəbul növbələri və sistem nəzarəti*.
   - Klikləndikdə `/login/admin` ünvanına yönləndirir.
2. **`AuthPage.tsx`**:
   - `AuthType` tipinə `'admin'` əlavə edilir.
   - Admin üçün xüsusi dizayn və təhlükəsizlik xəbərdarlığı: *"Restricted Diplomatic & Operator Gateway"*.
   - Uğurlu girişdən sonra istifadəçi birbaşa `/admin` portalına yönləndirilir.
3. **`App.tsx`**:
   - Giriş marşrutu: `<Route path="/login/admin" element={<AuthPage type="admin" />} />`
   - Qorunan Admin marşrutları:
     ```tsx
     <Route
       path="/admin"
       element={
         <ProtectedRoute allowedRoles={['ADMIN', 'OPERATOR', 'MANAGER']} redirectPath="/login/admin">
           <AdminLayout />
         </ProtectedRoute>
       }
     >
       <Route index element={<AdminDashboard />} />
       <Route path="dossiers" element={<AdminDossierList />} />
       <Route path="dossiers/:id" element={<AdminDossierDetail />} />
       <Route path="audit-logs" element={<AdminAuditLogs />} />
       <Route path="settings" element={<AdminSettings />} />
     </Route>
     ```

---

### Addım 1.3: İnzibatçı Karkası (`AdminLayout.tsx` & `.css`)
1. **Sol Menyu (Sidebar):**
   - EuroTech Konsulluq Logosu və "Official Review Center" statusu.
   - Menyu bəndləri:
     - 📊 **Dashboard** (`/admin`)
     - 📁 **All Applications** (`/admin/dossiers`) — yanında yeni daxil olan müraciətlərin sayı ilə canlı badge.
     - ⚖️ **Consular Review** (Aktiv yoxlanışda olanlar filtri ilə)
     - 📜 **Audit Logs** (`/admin/audit-logs`)
     - ⚙️ **System Settings** (`/admin/settings`)
   - Aşağı hissədə: Operatorun adı (`E. Abdullayev (ADMIN)`), növbə statusu və "Sign Out" düyməsi.
2. **Üst Zolaq (Header):**
   - Qlobal axtarış paneli (Dosye nömrəsi, pasport nömrəsi və ya ad ilə anında axtarış).
   - Real vaxt rejimində sistem saatı və konsulluq qəbul mərkəzinin statusu (Açıq / Qapalı).
   - Təcili bildirişlər və sənəd düzəliş gözləyənlər zəngi.

---

### Addım 1.4: Mərkəzi İdarəetmə Paneli (`AdminDashboard.tsx`)
1. **Statistika Kartları (KPI Cards):**
   - **Total Active Dossiers:** Sistemdə olan bütün aktiv müraciətlər.
   - **Under Review (Aktiv Ekspertizada):** Operator masasında olanlar.
   - **Visas Issued This Month:** Təsdiqlənmiş vizaların sayı və uğur faizi.
   - **Total Processed Fees:** Toplanmış rüsum məbləği (€).
2. **Təcili Fəaliyyət Növbəsi (Urgent Action Queue):**
   - Səfirlik randevusuna 24 saatdan az vaxt qalmış, lakin sənədləri hələ təsdiqlənməmiş müraciətlər.
3. **Portal Bölgüsü (Distribution Chart / Breakdown):**
   - Fərdi (B2C) vs Turizm Agentləri (B2B Agent) vs Korporativ Partiyalar (B2B Corporate) nisbəti.
4. **Son Əməliyyatlar Xətti:**
   - Kim hansı dosyenin statusunu dəyişdi və ya hansı sənədə düzəliş tələbi göndərdi.

---

### Addım 1.5: Bütün Müraciətlərin Reyestri (`AdminDossierList.tsx`)
1. **Çoxşaxəli Filtrləmə Paneli:**
   - **Portal Tipi üzrə:** All, Individual, Agent Groups, Corporate Batches.
   - **Status üzrə:** Received, Under Review, Needs Correction, Submitted to Embassy, Approved, Rejected.
   - **Ölkə üzrə:** Hungary, Germany, Poland, Czechia, Austria və s.
   - **Tarix aralığı və Mətn axtarışı:** Dosye kodu (`HU-AZ-2026-XXXXX`), Müştəri adı və ya Pasport No.
2. **İnteraktiv Məlumat Cədvəli (DataTable):**
   - Dosye nömrəsi və portal tipi nişanı.
   - Əsas müraciətçi və əlaqə məlumatı.
   - Təyinat ölkəsi və viza növü (Schengen Tourist, Business C, Work Permit D).
   - Tələb olunan sənədlərin vəziyyəti (Məs: `4/4 Təsdiqləndi` və ya `1 Düzəliş Lazımdır`).
   - Randevu tarixi və məkanı.
   - Status indikatoru və **"Review Dossier"** əməliyyat düyməsi.
3. **Səhifələmə (Pagination):** Sürətli keçidlər və hər səhifədə 10 / 25 / 50 sətir seçimi.

---

### Addım 1.6: Konsulluq Ekspertiza Masası (`AdminDossierDetail.tsx`)
*Bu səhifə inzibatçı portalının ən vacib və ən zəngin iş mühitidir.*

1. **Başlıq Paneli:**
   - Dosye nömrəsi, yaradılma tarixi, ölkə bayrağı və hazırkı rəsmi status.
   - **Sürətli Əməliyyatlar:** "Export ZIP Archive" (Bütün sənədləri vahid arxiv kimi yükləmək), "Export Checklist PDF", "Print Consular Dossier".
2. **Tab 1: Müraciətçilər və Konsulluq Ərizə Anketi:**
   - Əsas ərizəçi və varsa birgə müraciət edənlər (co-applicants).
   - 5 addımlı anketin tam təfərrüatları: Şəxsi məlumatlar, pasport detalları, səyahət tarixləri, hotel/dəvət edən tərəf, maliyyə təminatı.
3. **Tab 2: Sənədlərin Ekspertizası (Document Review Station):**
   - Hər bir sənəd növü üçün kart (Pasport surəti, Sığorta, Bank çıxarışı, Foto, İş yerindən arayış və s.).
   - Sənədə kliklədikdə açılan **İntellektual Önbaxış Modalı (`DocumentReviewModal.tsx`)**:
     - Sol tərəfdə: Yüksək keyfiyyətli PDF və ya Şəkil baxışı (Zoom, Rotate imkanları ilə).
     - Sağ tərəfdə: Operator qərar paneli:
       - 🟢 **Verify (Təsdiqlə):** Sənəd tələblərə cavab verir.
       - 🟡 **Request Correction (Düzəliş Tələb Et):** Sənəd qeyri-dəqiqdir. Operator qeyd yazır (Məs: *"Bank çıxarışında möhür görünmür, son 3 ayın yenilənmiş çıxarışını yükləyin"*). Bu qeyd dərhal müştərinin portalında görünür və ona e-poçt bildirişi gedir.
       - 🔴 **Reject (İmtina):** Sənəd saxtadır və ya qəbul olunmur.
4. **Tab 3: Randevu və Biometriya:**
   - Konsulluq mərkəzindəki qəbul vaxtı, statusu (`CONFIRMED`), vaxt dəyişmə və ya yenidən təyin etmə.
5. **Yekun Konsulluq Qərarı Paneli (`ConsularDecisionModal.tsx`):**
   - Bütün sənədlər təsdiqləndikdən sonra aktivləşən rəsmi qərar bloku:
     - 🛂 **Mark as "Submitted to Consulate"** — Dosyenin səfirliyə təhvil verilməsi.
     - ✅ **Approve Visa Application** — Viza uğurla verildi (Viza nömrəsi, etibarlılıq müddəti və konsulluq qeydləri ilə).
     - ❌ **Reject Application** — Rəsmi imtina (Səbəb bəndləri seçimi ilə: Məqsəd aydın deyil, maliyyə çatışmazlığı və s.).
   - Qərar verildiyi anda müştərinin canlı izləmə səhifəsi (`ClientTracking.tsx`) dərhal yenilənir.

---

### Addım 1.7: Sistem Tarixçəsi və Ayarlar (`AuditLogs` & `Settings`)
1. **Audit Loqları (`AdminAuditLogs.tsx`):**
   - Sistemdə baş verən bütün mühüm hadisələrin cədvəli (Kim daxil oldu, kim statusu dəyişdi, hansı sənəd yükləndi, IP ünvanı və zaman damğası).
2. **Konsulluq Ayarları (`AdminSettings.tsx`):**
   - Ölkələrin aktiv/deaktiv edilməsi.
   - Viza kateqoriyaları üzrə dövlət və xidmət haqlarının konfiqurasiyası.
   - Konsulluq qəbul mərkəzlərinin ünvanları və iş saatları.

---

## 4. Faza 1-in Yoxlanılması və Test Kriteriyaları (Acceptance Criteria)

Faza 1-in tamamlandığını necə təsdiqləyəcəyik?
1. **Giriş Testi:** `admin@eurotech.services` / `admin123` ilə `/login/admin` səhifəsindən daxil olmaq və avtomatik `/admin` dashboard-una keçmək.
2. **Rol Qoruması Testi:** Fərdi müştəri və ya Tur agenti hesabı ilə `/admin` səhifəsinə daxil olmağa cəhd edildikdə avtomatik qovulması (403 / Redirect).
3. **Məlumat Axını Testi:** Fərdi müştərinin yaratdığı yeni dosyenin dərhal Admin-in `/admin/dossiers` cədvəlində peyda olması.
4. **Sənəd Ekspertizası Testi:** Müştərinin yüklədiyi pasport və sığorta faylını admin panelində açıb baxmaq, "Düzəliş Tələb Et" düyməsi ilə səbəb yazmaq və həmin səbəbin müştərinin portalında canlı görünməsini təsdiqləmək.
5. **Yekun Qərar Testi:** Dosyeni "APPROVED" statusuna keçirmək, müştərinin izləmə səhifəsində viza təsdiqinin yaşıl rəngdə açıldığını və randevu/manifest PDF-lərinin problemsiz endirildiyini görmək.

---

## 📌 GƏLƏCƏK FAZALARIN DETALLARI (Yaddan Çıxmasın Deyə)

### 📌 FAZA 2: Portalların Fərdiləşdirilməsi və Dərinləşdirilməsi
- **Fərdi Müştəri (B2C):**
  - Pasport skanından MRZ kodunun oxunması (avtomatik doldurma).
  - Viza anketinin PDF-ə tam Şengen formatında rəsmi şəkildə basılması.
  - Ailə və qrup müraciətlərində birgə sənəd paylaşımı (məs: eyni hotel bronu bütün ailə üçün keçərli olsun).
- **Turizm Agenti (B2B Agent):**
  - Qrup iştirakçılarının Excel faylı (CSV/XLSX) ilə 1 kliklə kütləvi yüklənməsi.
  - Qrup üzrə xüsusi endirimlər və tərəfdaş komissiya dərəcələrinin fərdiləşdirilməsi.
  - Qrup üçün vahid konsulluq manifestinin avtomatik formatlaşdırılması.
- **Korporativ Şirkət (B2B Corporate):**
  - Şirkət şöbələri (IT, Satış, Rəhbərlik) üzrə illik viza büdcəsi və limitləri.
  - İşçilərin pasport etibarlılıq müddətinin bitməsinə 6 ay qalmış HR menecerə avtomatik xəbərdarlıq.
  - Şirkət daxili ezamiyyət əmrlərinin (Mission Order) avtomatik şablonlaşdırılması.

### 📌 FAZA 3: Real Xarici İnteqrasiyalar
- **Real E-poçt Sistemi (SMTP):**
  - SendGrid və ya AWS SES qoşulması.
  - Düzəliş tələbləri, randevu təsdiqləri və fakturalar üçün təhlükəsiz gözəl HTML şablonların canlı göndərilməsi.
- **Real Ödəniş Gateway:**
  - Stripe Checkout və ya yerli bankların (Kapital / Pasha Bank E-Commerce) kart inteqrasiyası.
  - Avtomatik 3D Secure yoxlanışı və fiskal elektron qəbzlərin göndərilməsi.
- **Canlı SMS / WhatsApp Bildirişləri:**
  - Randevu vaxtına 24 saat qalmış müştəriyə SMS xatırlatması.

### 📌 FAZA 4: Çoxdillilik, Təhlükəsizlik Auditi və Production
- **Tam i18n Lokalizasiyası:**
  - Bütün 4 portal üçün Azərbaycan, İngilis və Rus dillərində vahid dil dəyişdirici.
- **Təhlükəsizlik və GDPR:**
  - Həssas pasport məlumatlarının bazada tam AES-256-GCM ilə şifrələnməsinin təftişi.
  - Brute-force hücumlarına qarşı IP əsaslı bloklama.
- **Deploy & Canlı Yayım:**
  - Nginx, PM2, Docker konteynerləşdirməsi və SSL sertifikatlaşdırması.
