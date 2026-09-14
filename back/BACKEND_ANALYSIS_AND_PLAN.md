# EUROTECH Backend — Tam Analiz və İcra Planı

Bu sənəd `back` qovluğunun dərin arxitektur analizini, mövcud funksionallıqları, aşkar edilmiş texniki çatışmazlıqları və addım-addım inkişaf planını əhatə edir.

---

## 1. Texnologiya Steki və Baza Strukturu

* **Runtime & Framework:** Node.js (v18+) + Express.js
* **Verilənlər Bazası:** MySQL + Prisma ORM (v5+)
* **Təhlükəsizlik:** JWT (Access Token) + Refresh Token Rotation sessiyaları, Helmet, CORS, fərdiləşdirilmiş Hybrid Rate Limiting, AES-256-GCM şifrələmə, HMAC axtarış indeksləri
* **Ödəniş Sistemi:** Stripe API + Webhook emalı
* **Sənəd Emalı:** Multer (fayl yükləmə), PDF-Lib (ərizə generasiyası), Archiver (ZIP arxivi)
* **Bildirişlər:** Nodemailer (çoxdilli HTML şablonları)
* **Lokalizasiya (i18n):** `az` (Azərbaycan), `en` (İngilis), `ru` (Rus)

---

## 2. Qovluq və Modul Analizi

### A. Əsas Biznes Modulları (`modules/`)
1. **Auth Modulu (`modules/auth/`):**
   * **Pre-Registration:** İstifadəçi birbaşa qeydiyyatdan keçmir; e-poçtuna 24 saatlıq şifrə təyini linki və avtomatik generasiya olunmuş `EUR` prefiksli istifadəçi adı (məs: `EUR84920`) göndərilir.
   * **Atomic Set Password:** Tək SQL sorğusu ilə yarış vəziyyətlərinə (race condition) qarşı qorunan şifrə təyini və tokenin ləğvi.
   * **Email Enumeration Protection:** `resendSetPasswordEmail` istifadəçinin varlığından asılı olmayaraq standart neytral cavab qaytarır.
   * **Giriş və Sessiya (Refresh Token Rotation):** Hər yenilənmədə yeni token ailəsi yaradılır; əgər köhnə token yenidən istifadə edilərsə (`Token Reuse Attack`), istifadəçinin bütün sessiyaları dərhal ləğv edilir və SOC 2 insidenti qeydə alınır.
   * **OTP Doğrulaması:** 5 dəqiqəlik etibarlılıq müddəti olan 6 rəqəmli OTP yoxlanışı.
   * **RBAC:** `INDIVIDUAL`, `AGENT_TUR_OPERATOR`, `CORPORATE_HR`, `OPERATOR`, `MANAGER`, `ADMIN`.

2. **Şablon Modulu (`modules/template/`):**
   * Aktiv ölkələr (Macarıstan, Almaniya, Çexiya, Türkiyə və s.).
   * Viza kateqoriyaları (Şengen Turist C, İş İcazəsi D, Tələbə və s.) və baza rüsumları.
   * 8 addımlı sehrbaz (Wizard) üçün dinamik form sahələri və məcburi sənəd tələbləri.

3. **Dosye Modulu (`modules/dossier/`):**
   * Unikal dosye nömrəsi generasiyası (məs: `HU-AZ-2026-04891`).
   * Çoxşaxəli qiymət siyasəti:
     * Fərdi: Xidmət haqqı 120 EUR
     * Tur Agent: Xidmət haqqı 90 EUR (hər sərnişin üçün)
     * Korporativ: Xidmət haqqı 150 EUR + Xərc Mərkəzi / Departament
   * Ərizəçilərin idarəsi və ümumi məbləğin dinamik hesablanması.
   * 8 addımlı prosesdə addım yenilənməsi və status tarixçəsi (`DossierStatusHistory`).

4. **Sənədlər Modulu (`modules/document/`):**
   * Multer ilə fayl yükləmə (PDF, PNG, JPG, maks. 10MB).
   * 15 dəqiqəlik Signed URL (İmzalanmış link) ilə IDOR və BOLA qorunması.
   * Operator tərəfindən sənədlərin yoxlanması (`VERIFIED`, `NEEDS_CORRECTION`, `REJECTED`).
   * Düzəliş tələb olunduqda müştəriyə avtomatik HTML bildiriş emailinin göndərilməsi.

5. **Əlavə Xidmətlər Modulu (`modules/service/`):**
   * Xidmətlər: Ekspress emal (€60), Səyahət sığortası (€35), Tərcümə/Apostil (€45), Kuryer (€25), Aviabilet bronu (€20), Otel bronu (€25).
   * Xidmət əlavə edildikdə və ya silindikdə dosyenin yekun məbləğinin avtomatik yenidən hesablanması.

6. **Ödəniş Modulu (`modules/payment/`):**
   * Stripe Payment Intent generasiyası və tranzaksiya izlənməsi.
   * Ödəniş təsdiqləndikdə hər ərizəçi üçün rəsmi ərizə formasının PDF generasiyası (`pdf.util.js`).
   * Bütün sənədlərin və ərizə formalarının tək ZIP arxivində cəmlənməsi (`zip.util.js`).
   * Korporativ SaaS abunəliklərinin aktivləşdirilməsi (BASIC, PRO, ENTERPRISE).

7. **İnzibatçı Modulu (`modules/admin/`):**
   * İcraçı Dashboard metrikaları (Aktiv dosyelər, baxışdakı müraciətlər, cari ayın təsdiqləri, ümumi gəlir).
   * Süzgəcli və səhifələnmiş dosye siyahısı.
   * Viza qərarının verilməsi (Konsulluq mərhələsi / Təsdiq / İmtina) və müştəriyə nəticə emailinin göndərilməsi.

8. **Bildiriş Modulu (`modules/notification/`):**
   * Çoxdilli HTML şablonları: OTP, Şifrə Təyini, Dosye Qəbulu, Sənəd Düzəlişi, Yekun Qərar.

9. **Məxfilik və GDPR Modulu (`modules/shared/privacy.service.js`):**
   * "Unudulmaq Hüququ" (Right to be Forgotten) — istifadəçinin və ərizəçilərin PII məlumatlarının anonimləşdirilməsi.
   * "Məlumat İxracı" (Data Portability) — bütün sistem məlumatlarının JSON şəklində təqdim edilməsi.

---

## 3. Aşkar Edilmiş Boşluqlar və Zəif Nöqtələr

1. **Sənəd Endirmə (Download) Marşrutunun Olmaması:**
   * `document.service.js` faylında `/api/v1/documents/:documentId/download?token=...` linki qaytarılır, lakin `document.routes.js` daxilində belə bir marşrut və axın mövcud deyil.
2. **GDPR / Privacy Marşrutlarının Çatışmaması:**
   * `privacy.service.js` servisi hazırdır, lakin Controller və Route faylları yoxdur və `routes/v1/index.js` daxilində marşrutlaşdırılmayıb.
3. **Faylların Sehrli Baytlarının (Magic Bytes) Yoxlanışının Tətbiq Edilməməsi:**
   * `upload.middleware.js` daxilində `inspectMagicBytes` funksiyası mövcuddur, lakin Multer və ya Controller axınında işə salınmır.
4. **Yaddaş Daxili (In-Memory) Rate Limiter və Sessiyalar:**
   * Server çoxsaylı nüsxələrlə (cluster/load balancer) işlədikdə və ya restart olunduqda rate limit yaddaşı sıfırlanır (Redis inteqrasiyası tələb olunur).
5. **Sihirbaz Baryeri (Wizard Barrier) Boşluğu:**
   * İstifadəçi məcburi sənədləri yükləmədən birbaşa ödəniş endpoint-inə müraciət edə bilir; bu yoxlanış ödəniş yaratma mərhələsində də tətbiq olunmalıdır.

---

## 4. Addım-addım İcra Planı (Implementation Roadmap)

### Mərhələ 1: Təcili Texniki Boşluqların Aradan Qaldırılması
* **Addım 1.1:** `document.controller.js` və `document.routes.js` fayllarına `downloadDocument` marşrutunun əlavə edilməsi (imzalanmış token yoxlanışı və `res.download`).
* **Addım 1.2:** `privacy.controller.js` və `privacy.routes.js` fayllarının yaradılaraq `routes/v1/index.js` daxilində `/privacy` olaraq qeydiyyatdan keçirilməsi.
* **Addım 1.3:** `uploadDocument` funksiyasında `inspectMagicBytes` yoxlanışının aktivləşdirilməsi (saxta fayl uzantılarının qarşısının alınması).

### Mərhələ 2: Təhlükəsizlik və Biznes Məntiqi Təkmilləşdirməsi
* **Addım 2.1:** `POST /payments/create-intent` marşrutuna `wizardBarrierMiddleware(6)` əlavə edilməsi (sənədlər təqdim edilmədən ödəniş qadağan edilir).
* **Addım 2.2:** Rate Limiter və Token Qara Siyahısı (Revocation) üçün Redis adapter dəstəyinin hazırlanması (Fallback olaraq In-Memory).

### Mərhələ 3: Portal Frontend İnteqrasiyası və Sənədləşdirmə
* **Addım 3.1:** `EUROTECH Portal` React/Vite tətbiqinin API client modulları ilə backend endpoint-lərinin tam sinxronlaşdırılması.
* **Addım 3.2:** Swagger/OpenAPI interaktiv sənədləşdirməsinin (`/api/docs`) qoşulması.

### Mərhələ 4: İstehsalata Hazırlıq (DevOps və Avtomatlaşdırma)
* **Addım 4.1:** `Dockerfile` və `docker-compose.yml` (Node.js + MySQL + Redis) hazırlanması.
* **Addım 4.2:** `test-all.js` skriptinə yeni ssenarilərin (Download, Privacy, Magic Bytes) inteqrasiya olunması.
