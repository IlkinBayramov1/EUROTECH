# 🌐 EUROTECH VİZA VƏ KONSULLUQ SİSTEMİ — FAZA 3 MASTER PLAN
## Real Xarici İnteqrasiyalar (Real External Integrations & Automated Systems)

---

## 📌 Giriş və Faza 3-ün Məqsədi
**Faza 1** (İnzibati & Konsulluq Nəzarət Portalı) və **Faza 2** (B2C Fərdi, B2B Turizm Agentliyi və B2B Korporativ HR dərin biznes məntiqləri) uğurla icra edilib, tam test olunub və təhvil verilib.

**Faza 3-ün Əsas Hədəfi:** Sistemi xarici dünya ilə real, sənaye standartlarına uyğun (production-grade), təhlükəsiz və avtomatlaşdırılmış şəkildə birləşdirməkdir. Bura real ödəniş sistemləri, tranzaksiya e-poçtları, WhatsApp Business və SMS bildirişləri, S3 bulud fayl saxlama anbarı, arxa plan cron tapşırıqları və xarici inteqrasiyaların monitorinqi daxildir.

---

```
                               ┌────────────────────────────────────────────────────────┐
                               │           EUROTECH CORE SYSTEM (NODE + PRISMA)         │
                               └──────────────────────────┬─────────────────────────────┘
                                                          │
          ┌───────────────────────┬───────────────────────┼───────────────────────┬───────────────────────┐
          ▼                       ▼                       ▼                       ▼                       ▼
  ┌───────────────┐       ┌───────────────┐       ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
  │ 1. ÖDƏNİŞ     │       │ 2. E-POÇT     │       │ 3. WHATSAPP   │       │ 4. BULUD      │       │ 5. CRON &     │
  │    ŞLÜZLƏRİ   │       │    MÜHƏRRİKİ  │       │    & SMS API  │       │    YADDAŞI    │       │    QUEUE      │
  ├───────────────┤       ├───────────────┤       ├───────────────┤       ├───────────────┤       ├───────────────┤
  │• Stripe       │       │• SMTP/SendGrid│       │• Meta Cloud   │       │• AWS S3/MinIO │       │• Pasport      │
  │• Yerli Bank   │       │• HTML Şablon  │       │  WhatsApp API │       │• Presigned URL│       │  Radarı (08:00│
  │  (Azericard/  │       │• PDF Qoşmalar │       │• İkitərəfli   │       │• AES-256      │       │• Görüş T-24/2h│
  │  Kapital Pay) │       │• .ics Təqvim  │       │  Bot Sorğusu  │       │• Magic Bytes  │       │• Slottəmizləmə│
  │• Webhook Sec  │       │• İmtina /     │       │• SMS Gateway  │       │• Zip Stream   │       │• Webhook      │
  │• İdempotent   │       │  Təsdiq E-poçt│       │  (E.164)      │       │  Upload       │       │  Retry Queue  │
  └───────────────┘       └───────────────┘       └───────────────┘       └───────────────┘       └───────────────┘
```

---

## 📑 FAZA 3 ƏTRAFLI MƏZMUN VƏ BÖLMƏLƏR

---

### BÖLMƏ 1: REAL ÖDƏNİŞ ŞLÜZLƏRİ VƏ MALİYYƏ HESABLAŞMALARI

#### 1.1. Stripe PaymentIntent & Checkout Sistemi (Real SDK)
- **Təhlükəsizlik və Konfiqurasiya:**
  - `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` mühit dəyişənlərinin tənzimlənməsi.
  - Multi-valyuta dəstəyi: EUR (əsas Şengen rüsumları), USD, AZN (yerli xidmət haqları).
- **PaymentIntent Arxitekturası:**
  - `createPaymentIntent(dossierId, userId, currency, paymentMethodType)`:
    - Dosyenin ümumi məbləğinə əsasən dəqiq sent/qəpik hesablanması (`Math.round(amount * 100)`).
    - Metadata doldurulması: `dossierId`, `dossierNumber`, `userId`, `portalType`, `agentCommissionEligible`.
    - **İdempotentlik Açarı (Idempotency Key):** Şəbəkə qırılmaları zamanı müştərinin kartından təkrar pul çıxılmasının qarşısını almaq üçün unikal `idempotencyKey = "tx_dossier_${dossierId}_${timestamp}"` ötürülməsi.
- **Frontend Stripe Elements İnteqrasiyası:**
  - Kart nömrəsi, CVC, Bitmə tarixi üçün təhlükəsiz iFrame UI komponentləri.
  - 3D Secure (SCA - Strong Customer Authentication) təsdiqləmə pəncərəsi (OTP tələb edən banklar üçün).

#### 1.2. Kriptoqrafik Webhook Təsdiqlənməsi (Signature Verification)
- **Təhlükəsizlik Mexanizmi:**
  - `stripe.webhooks.constructEvent(rawBody, signature, endpointSecret)` vasitəsilə hər bir gələn sorğunun Stripe tərəfindən imzalandığının riyazi yoxlanışı.
  - `express.raw({ type: 'application/json' })` middleware vasitəsilə bədənin dəyişdirilmədən oxunması.
  - Replay Attack qorunması: 5 dəqiqədən köhnə timestamp-li webhook sorğularının dərhal rədd edilməsi.
- **İdarə olunan Əsas Hadisələr (Event Listeners):**
  - `payment_intent.succeeded`:
    - `Transaction` statusunu `PAID` edir.
    - Dosye statusunu `UNDER_REVIEW`-a keçirir.
    - Avtomatik 37-bəndlik Şengen Ərizə PDF-lərini yaradır və dosye arxiv ZIP faylını generasiya edir.
    - Əgər B2B Agent müraciətidirsə: Agentin balansına müvafiq komissiyanı (€20 - €32/adam) avtomatik əlavə edir.
    - Müştəriyə və İnzibatçıya dərhal ödəniş təsdiq e-poçtu və qəbzi göndərir.
  - `payment_intent.payment_failed`:
    - Tranzaksiya statusunu `FAILED` edir, xəta səbəbini (`insufficient_funds`, `card_declined` və s.) qeyd edir.
    - İstifadəçiyə fərqli kartla yenidən cəhd etmək üçün xəbərdarlıq bildirişi göndərir.
  - `charge.refunded`:
    - Konsulluq və ya Admin tərəfindən ödəniş geri qaytarıldıqda (`REFUNDED`) tranzaksiya tarixçəsinə qeyd olunması.
  - `customer.subscription.created / updated / deleted`:
    - Korporativ şirkətlərin aylıq SaaS abunəliklərinin avtomatlaşdırılması.

#### 1.3. Yerli Azərbaycan Bank Şlüzü Adapteri (Azericard / Kapital Pay / GoldenPay)
- **Pluggable Gateway Arxitekturası (`IPaymentGateway`):**
  - Həm beynəlxalq kartlar (Stripe), həm də yerli kartlar (Azericard/Kapital Bank) üçün vahid interfeys.
- **3D Secure v2 və E-Commerce API Akışı:**
  - Sifariş qeydiyyatı -> Bank Gateway URL-nə yönləndirmə (Redirect URL).
  - HMAC-SHA256 və ya RSA rəqəmsal imza ilə sorğunun imzalanması.
  - Bankın Callback və Merchant təsdiqləmə URL-lərinin qarşılanması və kriptoqrafik imzaların yoxlanılması.
- **Frontend Nəticə Səhifəsi (`/payment/callback`):**
  - Uğurlu / uğursuz ödəniş animasiyası, qəbz yükləmə düyməsi və status səhifəsinə yönləndirmə.

#### 1.4. Bank Köçürməsi (SWIFT / IBAN / MilliÖN / eManat) və Əl ilə Barışdırma
- **Proforma Faktura Generasiyası:**
  - Hər bir sifariş üçün unikal `REF-EUR-2026-XXXXX` ödəniş təyinatı kodu.
- **Ödəniş Qəbzi (Slip) Yükləmə Modulu:**
  - İstifadəçi bank köçürmə qəbzini (PDF/JPEG) sistemə yükləyir.
- **Admin Maliyyə Barışdırma UI (Finance Reconciliation):**
  - Mühasibat heyəti üçün daxil olan bank ödənişlərini təsdiq/imtina etmə interfeysi.
  - Təsdiqləndikdə avtomatik dosye aktivləşməsi.

---

### BÖLMƏ 2: REAL TRANZAKSİYA E-POÇT ÇATDIRILMA MÜHƏRRİKİ

#### 2.1. Çoxlu Provayderli Dayanıqlı SMTP Arxitekturası (Resilient Fallback)
- **Əsas Provayderlər:**
  - Əsas: SendGrid / Mailgun / AWS SES / Brevo API.
  - Ehtiyat (Fallback): Yerli təhlükəsiz korporativ SMTP serveri (`nodemailer` bağlantısı ilə).
  - **Circuit Breaker:** Əgər əsas provayder ardıcıl 3 dəfə xəta verərsə, sistem kəsilmədən ehtiyat SMTP-yə keçir və idarəçiyə xəbərdarlıq göndərir.

#### 2.2. Korporativ Brendinqli Responsiv HTML Şablonları
Bütün e-poçtlar peşəkar, mobil və masaüstü uyğun, dark mode dəstəkli EuroTech dizaynında tərtib olunur:
1. `welcome_verify_otp.html`: Yeni istifadəçi salamlama və 6 rəqəmli təhlükəsiz OTP kodu.
2. `dossier_submitted.html`: Müraciətin qəbulu, unikal dosye nömrəsi, icra qrafiki və izləmə linki.
3. `document_correction_required.html`: Konsul və ya operator tərəfindən imtina edilmiş sənədlərin qırmızı vurğulanması və düzəliş təlimatları.
4. `appointment_ticket_confirmed.html`: Təyin olunmuş görüşün tarixi, vizas mərkəzinin ünvanı, xəritə linki və tələb olunan fiziki sənədlərin siyahısı.
5. `consular_decision_approved.html` / `consular_decision_rejected.html`: Rəsmi viza nəticəsi və pasport təhvil təlimatı.
6. `corporate_expiry_radar_alert.html`: Korporativ HR-lar üçün pasport müddəti 90 gündən az qalan əməkdaşların cədvəl xülasəsi.

#### 2.3. Avtomatlaşdırılmış PDF və Təqvim (.ics) Qoşmaları
- **Görüş Təqvimi (.ics İnteqrasiyası):**
  - Görüş təsdiq e-poçtuna Google Calendar, Apple Calendar və Outlook üçün standart `.ics` faylının qoşulması.
- **Dinamik PDF Qoşmaları:**
  - Rəsmi 37-bəndlik Şengen Ərizəsi PDF-i.
  - Qrup Turizm Agentlikləri üçün ƏDV-li Vergi Fakturası PDF-i.
  - Korporativ Şirkətlər üçün Zəmanət Məktubu (Guarantee Letter) PDF-i.
  - Maliyyə ödəniş qəbzi PDF-i.

#### 2.4. E-poçt Çatdırılma Vəziyyətinin İzlənməsi (Delivery Tracking)
- E-poçtların açılması (Open Tracking) və kliklənməsi (Click Tracking).
- Yanlış və ya mövcud olmayan e-poçtlar üçün Bounce Webhook qəbulu və istifadəçi profilində "Email Bounce" bayrağının qaldırılması.

---

### BÖLMƏ 3: REAL SMS VƏ WHATSAPP BUSINESS PLATFORM APİ

#### 3.1. Meta WhatsApp Business Cloud API (Graph API v19+)
- **İnteqrasiya Parametrləri:**
  - `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_ACCESS_TOKEN`.
- **Rəsmi Təsdiqlənmiş Mesaj Şablonları (Pre-approved Templates):**
  - `eurotech_dossier_status_update`: Viza müraciətinin hər status dəyişikliyində (Sənəd yoxlanışı, Konsulluqda baxılma, Nəticə) anlıq WhatsApp mesajı.
  - `eurotech_appointment_reminder_24h`: Görüşə 24 saat qalmış xatırlatma və mərkəz koordinatları.
  - `eurotech_urgent_document_request`: Təcili sənəd çatışmazlığı xəbərdarlığı və birbaşa yükləmə linki.
- **İkitərəfli İnteraktiv Webhook və Ağıllı Sorğu Botu:**
  - İstifadəçi WhatsApp-dan `STATUS EUR-2026-0001` və ya sadəcə `STATUS` yazdıqda:
  - Webhook sorğunu qəbul edir, telefon nömrəsinə uyğun aktiv dosyenin vəziyyətini tapır və interaktiv düymələrlə dərhal cavab qaytarır:
    - 🟢 *Status:* SƏFİRLİKDƏ İCRAATDADIR
    - 📅 *Təxmini bitmə:* 3 iş günü
    - 🔗 *Portal linki:* [İzlə]

#### 3.2. Çoxkanallı SMS Şlüzü (Twilio / Infobip / BulkSMS Azərbaycan)
- **Telefon Nömrələrinin Standartlaşdırılması:**
  - `libphonenumber-js` kitabxanası vasitəsilə bütün nömrələrin beynəlxalq E.164 formatına çevrilməsi (`+994XXXXXXXXX`).
- **SMS Failover:**
  - Əgər istifadəçinin WhatsApp hesabı yoxdursa və ya mesaj çatmazsa, sistem dərhal SMS şlüzünə keçir.
- **Yüksək Prioritetli OTP:**
  - Giriş və təsdiq kodları üçün 3-5 saniyə ərzində çatdırılma zəmanəti olan prioritetli SMS kanalı.

---

### BÖLMƏ 4: BULUD SƏNƏD YADDAŞI VƏ TƏHLÜKƏSİZLİK (S3 / MINIO)

#### 4.1. S3-Uyğun Bulud Saxlama Arxitekturası (AWS S3 / MinIO / DigitalOcean)
- **Vahid Saxlama İnterfeysi (`StorageService`):**
  - Lokal fayl sistemi (development üçün) və S3 Bulud anbarı (production üçün) arasında çevik keçid.
  - AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`) istifadəsi.

#### 4.2. Təhlükəsiz Giriş: Qısaömürlü Presigned URL Arxitekturası
- **İctimai Girişin Qadağan Edilməsi (Zero Public Access):**
  - S3 bucket tamamilə qapalı (private) saxlanılır.
- **Presigned Upload URL (Müştəridən Birbaşa S3-ə Yükləmə):**
  - 50MB-a qədər böyük pasport və bank çıxarışları yükləndikdə serverin RAM və CPU-sunu yükləməmək üçün:
  - Backend 15 dəqiqə etibarlı xüsusi imzalanmış URL yaradır, brauzer faylı birbaşa təhlükəsiz S3 bucket-inə yükləyir.
- **Presigned Download URL (Müvəqqəti Oxuma İcazəsi):**
  - Yalnız səlahiyyətli istifadəçi və ya konsulluq operatoru sənədə baxmaq istədikdə 15 dəqiqəlik şifrəli link yaradılır.

#### 4.3. Fayl Təhlükəsizliyi və Kriptoqrafiya
- **Server-Side Encryption:** Sənədlər buludda AES-256 (və ya AWS KMS) ilə şifrələnmiş şəkildə saxlanılır.
- **Fayl Başlığı və Magic Bytes Yoxlanışı:**
  - Fayl uzantısının dəyişdirilməsi ilə zərərli skriptlərin (məsələn `.exe` və ya `.php` faylının `.pdf` edilməsi) sistemə daxil olmasının qarşısının alınması.
- **Stream ilə ZIP Arxivlənməsi:**
  - Konsulluq üçün sənədlər paketlənərkən fayllar yaddaşda deyil, Node.js Stream vasitəsilə birbaşa S3-də ZIP formatına salınır.

---

### BÖLMƏ 5: AVTOMATLAŞDIRILMIŞ ARXA PLAN İCRAÇILARI (CRON JOBS & SCHEDULERS)

#### 5.1. Tapşırıqlar Mühərriki (Queue & Scheduler Engine)
- `node-cron` və verilənlər bazası əsaslı tapşırıq qeydiyyatı (`CronExecutionLog`).
- Server yenidən başladıqda itməyən, qəzalara qarşı dayanıqlı (fault-tolerant) sistem.

#### 5.2. Konkret Avtomatlaşdırılmış İşçilər (Automated Background Workers)

| İşçi (Worker) Adı | İcra Qrafiki | Məqsəd və Funksionallıq |
| :--- | :--- | :--- |
| **1. Konsulluq Pasport Radarı** | Hər gün saat **08:00** | Bütün korporativ işçilərin pasportlarını skan edir. <90 gün qalanlar üçün **Kritik**, 90-180 gün qalanlar üçün **Xəbərdarlıq** statusu qoyur. HR menecerə icmal e-poçtu, işçiyə SMS göndərir. |
| **2. Görüş Xatırlatma İşçisi** | Hər saatın tamamında | T-24 saat və T-2 saat qalmış görüşləri aşkarlayır. Ərizəçiyə WhatsApp və SMS ilə viza mərkəzinin ünvanını, zəruri sənədlər siyahısını göndərir. |
| **3. Ödənilməmiş Dosye Təmizləyicisi** | Hər **6 saatdan bir** | 48 saat ərzində ödənişi edilməmiş və ya yarımçıq qalmış müraciətləri aşkarlayır. Rezerv olunmuş görüş vaxtlarını sistemə qaytarır (boşaldır) və istifadəçiyə xəbərdarlıq edir. |
| **4. Webhook & Bildiriş Retry Queue** | Hər **15 dəqiqədən bir** | Şəbəkə xətası səbəbindən uğursuz olmuş e-poçt, SMS və ya ödəniş webhook-larını eksponensial fasilələrlə (1 dəq, 5 dəq, 30 dəq, 2 saat) təkrar icra edir. |
| **5. Gündəlik Maliyyə & Dosye İcmalı** | Hər gecə saat **23:59** | Gün ərzində toplanan rüsumları, Stripe və Bank tranzaksiyalarını, Agent komissiyalarını hesablayır və Baş İnzibatçı / Mühasibə PDF hesabat göndərir. |

---

### BÖLMƏ 6: İNTEQRASİYA SAĞLAMLIQ MONİTORİNQİ VƏ TEST STRATEGİYASI

#### 6.1. Sistem Sağlamlıq Paneli (Integrations Health Dashboard)
- Endpoint: `GET /api/health/integrations`
  - 🟢 **Stripe API:** Canlı bağlantı və gizli açar statusu.
  - 🟢 **S3 / MinIO Storage:** Bucket oxuma/yazma testi.
  - 🟢 **SMTP Mail Server:** E-poçt soket bağlantı testi.
  - 🟢 **WhatsApp / SMS Gateway:** API token etibarlılıq statusu.
  - 🟢 **Verilənlər Bazası və Cron:** Aktiv tapşırıqların heartbeat siqnalı.

#### 6.2. Test və Doğrulama Planı
1. **Bölmə Testləri (Unit Tests):**
   - Webhook imza doğrulayıcılarının testləri (düzgün və saxta imzalarla).
   - E.164 nömrə formatlama funksiyalarının yoxlanması.
2. **Ucdan-Uca İnteqrasiya Testləri (E2E Tests):**
   - Tam ödəniş ssenarisi: Intent yaradılması -> Webhook qəbulu -> Avtomatik PDF generasiyası -> Agent balansının artması -> Bildiriş çatdırılması.
   - S3 sənəd axını: Presigned URL alınması -> Sənədin yüklənməsi -> Magic bytes təsdiqi -> Şifrəli saxlanma.
   - Cron simulyasiyası: Pasport Radarı və Görüş Xatırlatmasının vaxtından əvvəl çağırılaraq icrasının yoxlanması.

---

## 🛠️ İCRA MƏRHƏLƏLƏRİ VƏ ARDICILLIQ

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ADIM 1: Ətraf Mühit & Konfiqurasiya (env.js, Stripe, S3, SMTP, Meta SDK-lar)│
├─────────────────────────────────────────────────────────────────────────────┤
│ ADIM 2: Ödəniş Modulu (Stripe Real Webhook + Yerli Bank + İdempotentlik)    │
├─────────────────────────────────────────────────────────────────────────────┤
│ ADIM 3: E-poçt & Sənəd Çatdırılma (SMTP/SES + HTML Şablonlar + PDF Qoşmalar)│
├─────────────────────────────────────────────────────────────────────────────┤
│ ADIM 4: WhatsApp Cloud API & SMS Şlüzü (İkitərəfli Status Botu + Bildirişlər)│
├─────────────────────────────────────────────────────────────────────────────┤
│ ADIM 5: S3/MinIO Bulud Yaddaşı (Presigned URL-lər + AES-256 Şifrələmə)      │
├─────────────────────────────────────────────────────────────────────────────┤
│ ADIM 6: Avtomatlaşdırılmış Cron İşçiləri (Radar, Xatırlatma, Təmizləmə)     │
├─────────────────────────────────────────────────────────────────────────────┤
│ ADIM 7: İnteqrasiya Sağlamlıq Paneli & Hərtərəfli Avtomatlaşdırılmış Testlər│
└─────────────────────────────────────────────────────────────────────────────┘
```

Bu plan layihənin bütün xarici əlaqələrini ən yüksək təhlükəsizlik və keyfiyyət standartları ilə təmin etmək üçün tam hazır vəziyyətdə tərtib olunmuşdur.
