# 🛡️ EUROTECH VİZA VƏ KONSULLUQ SİSTEMİ — FAZA 4 MASTER PLAN
## Təhlükəsizlik Sərtləşdirməsi, Yüksək Performans, Monitorinq, DevOps və Production Hazırlığı

---

## 📌 Giriş və Faza 4-ün Məqsədi
**Faza 1** (İnzibati & Konsulluq Portalı), **Faza 2** (B2C Fərdi, B2B Turizm Agentliyi və B2B Korporativ HR dərin biznes məntiqləri) və **Faza 3** (Stripe, Yerli Bank, WhatsApp, SMS, S3 və Avtomatlaşdırılmış Cron İşçiləri) uğurla icra edilib və 100% testlərdən keçib.

**Faza 4-ün Əsas Hədəfi:** Sistemi kommersiya istismarına (Enterprise Production Deployment) tam hazır vəziyyətə gətirməkdir. Bura beynəlxalq təhlükəsizlik standartları (OWASP Top 10, Zero Trust, PII maskalanması), verilənlər bazası indeksləşdirməsi və keşləmə ilə yüksək performans, Prometheus/APM telemetriyası, Docker konteynerləşdirməsi, avtomatlaşdırılmış CI/CD boru kəməri, qəzadan bərpa (Disaster Recovery) və stres yük testləri daxildir.

---

```
                               ┌────────────────────────────────────────────────────────┐
                               │             FAZA 4: ENTERPRISE PRODUCTION ARCHITECTURE │
                               └──────────────────────────┬─────────────────────────────┘
                                                          │
          ┌───────────────────────┬───────────────────────┼───────────────────────┬───────────────────────┐
          ▼                       ▼                       ▼                       ▼                       ▼
  ┌───────────────┐       ┌───────────────┐       ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
  │ 1. ZERO TRUST │       │ 2. PERFORMANS │       │ 3. APM &      │       │ 4. DOCKER &   │       │ 5. BACKUP &   │
  │    SECURITY   │       │    VƏ İNDEKS  │       │    MONITORING │       │    DEVOPS     │       │    DR DRILL   │
  ├───────────────┤       ├───────────────┤       ├───────────────┤       ├───────────────┤       ├───────────────┤
  │• WAF / Rate   │       │• DB Kompozit  │       │• Prometheus   │       │• Multi-stage  │       │• Gündəlik     │
  │  Limiting 429 │       │  İndekslər    │       │  /api/metrics │       │  Dockerfile   │       │  mysqldump    │
  │• Bruteforce   │       │• Gzip / Brotl.│       │• X-Correlat-ID│       │• Nginx Alpine │       │  (Gzip+SHA256)│
  │  Lockout (15m)│       │  Sıxılma (70%)│       │• PII Maskinq  │       │• Docker       │       │• RPO < 15 dəq │
  │• Helmet CSP   │       │• HTTP Keş     │       │  (Pasport,    │       │  Compose      │       │• RTO < 1 saat │
  │• Strict CORS  │       │  ETag Headers │       │  Kart, Şifrə) │       │• CI/CD Pipeline│       │• Avtomatik   │
  │• HPP & Sanitiz│       │• Vite Code-   │       │• İnsident     │       │  (GitHub      │       │  Bərpa Skripti│
  │• PII Qorunması│       │  Splitting    │       │  Telemetriyası│       │  Actions)     │       │               │
  └───────────────┘       └───────────────┘       └───────────────┘       └───────────────┘       └───────────────┘
```

---

## 📑 FAZA 4 ƏTRAFLI MƏZMUN VƏ BÖLMƏLƏR

---

### BÖLMƏ 1: SIFIR ETİBAR (ZERO TRUST) VƏ MÜTƏŞƏKKİL TƏHLÜKƏSİZLİK

#### 1.1. Qabaqcıl Rate Limiting və Bruteforce Lockout
- **Dinamik Hibrid Rate Limiter:**
  - `IP + İstifadəçi ID + Endpoint + Device Fingerprint` əsaslı kompozit açar.
  - Həssas ünvanlar üçün sərt limitlər:
    - `/api/v1/auth/login`: 15 dəqiqədə maksimum 5 cəhd (aşdıqda `429 Too Many Requests`).
    - `/api/v1/auth/pre-register` & OTP: 5 dəqiqədə maksimum 3 cəhd.
    - `/api/v1/payments/*`: 1 dəqiqədə maksimum 10 sorğu.
    - Ümumi API sorğuları: 1 dəqiqədə maksimum 120 sorğu.
- **Hesab Kilidlənməsi (Account Bruteforce Lockout):**
  - Eyni hesaba (email və ya username) ardıcıl 5 uğursuz şifrə daxil edildikdə hesab 15 dəqiqə müddətinə dondurulur.
  - Təhlükəsizlik hadisəsi kimi `AuditLog` cədvəlində `ACCOUNT_LOCKED_BRUTEFORCE` qeydiyyatı aparılır və istifadəçiyə xəbərdarlıq göndərilir.

#### 1.2. Veb Tətbiq Qorunması (WAF, Helmet CSP, CORS & HPP)
- **Helmet Content Security Policy (CSP):**
  - `default-src 'self'`
  - Skript icrası: Yalnız etibarlı domenlər (Stripe JS, Google Maps) və dinamik nonce.
  - Çərçivə (Frame) qorunması: Clickjacking hücumlarına qarşı `X-Frame-Options: DENY` (və ya səlahiyyətli konsulluq inteqrasiyaları üçün `frame-ancestors`).
  - MIME Sniffing bloklanması: `X-Content-Type-Options: nosniff`.
  - HSTS (HTTP Strict Transport Security): 1 il məcburi HTTPS (`max-age=31536000; includeSubDomains; preload`).
- **İstehsalat CORS Siyasəti (Strict Whitelist):**
  - Yalnız rəsmi subdomenlərə icazə: `customer.eurotech.az`, `agent.eurotech.az`, `corporate.eurotech.az`, `admin.eurotech.az`.
  - Hər hansı digər naməlum domendən gələn `Origin` dərhal bloklanır.
- **HTTP Parameter Pollution (HPP):**
  - Query və ya body parametrlərinin massiv şəklində göndərilərək arxa planı çaşdırmasının (məsələn `?role=INDIVIDUAL&role=ADMIN`) qarşısının alınması.

#### 1.3. PII (Fərdi Məlumatlar) Loq Maskalanması və Sanitizasiya
- **GDPR & ISO 27001 Uyğunluğu:**
  - Morgan, Winston və telemetriya loqlarında pasport nömrələri (`C12****45`), şifrələr, JWT tokenlər, kredit kartı rekvizitləri avtomatik maskalanır (`[MASKED]`).
  - Loq fayllarına icazəsiz baxış zamanı müştərilərin gizli viza və biometrik məlumatlarının sızması riski sıfıra endirilir.

---

### BÖLMƏ 2: VERİLƏNLƏR BAZASI VƏ SORĞU PERFORMANSI (DATABASE SCALING)

#### 2.1. Prisma Kompozit və Tək İndekslərin Əlavə Olunması
Verilənlər bazasında milyonlarla qeyd yarandıqda sorğuların 2-5 millisaniyə ərzində icra olunması üçün `prisma/schema.prisma` faylına xüsusi indekslər tətbiq olunur:
- **Dossier Cədvəli:**
  - `@@index([userId, status])` — İstifadəçinin aktiv müraciətlərini anlıq süzgəcdən keçirmək üçün.
  - `@@index([portalType, createdAt])` — Agent və korporativ qrup hesabatları üçün.
  - `@@index([paymentStatus])` — Maliyyə və təmizləmə işçiləri üçün.
  - `@@index([countryId, visaCategoryId])` — Konsulluq icmalları üçün.
- **Applicant Cədvəli:**
  - `@@index([dossierId])` — Dosyeyə bağlı ərizəçilərin sürətli yüklənməsi.
  - `@@index([passportNumberHash])` — Şifrələnmiş pasport nömrəsi üzrə anlıq axtarış.
- **Appointment Cədvəli:**
  - `@@index([timeSlotId, status])` — Görüş kvotası və rezervasiyaları üçün.
  - `@@index([userId, createdAt])` — Şəxsi təqvim sorğuları üçün.
- **Transaction Cədvəli:**
  - `@@index([stripePaymentIntentId])` — Webhook cavab sürətini 10 qat artırmaq üçün.
  - `@@index([paymentProvider, status])` — Gündəlik maliyyə barışdırması üçün.
- **CorporateEmployee Cədvəli:**
  - `@@index([corporateUserId, department])` — Departament büdcə və heyət təhlili üçün.
  - `@@index([passportExpiry])` — Gündəlik Pasport Radarı skanının 5 saniyədən az çəkməsi üçün.
- **OutboundMessageLog & CronTaskLog:**
  - `@@index([status, retryCount])` — Təkrar göndərmə növbəsinin (Retry Queue) sürəti üçün.
  - `@@index([taskName, startedAt])` — Monitorinq jurnalı üçün.

#### 2.2. Statik Şablon Məlumatlarının Keşlənməsi (In-Memory / Redis Caching)
- Dəyişməyən məlumatlar (`Country`, `VisaCategory`, `DynamicField`, `RequiredDocumentType`) üçün keş qatı:
  - İlk sorğuda bazadan oxunur, sonrakı sorğularda yaddaşdan (RAM) 0.2ms ərzində dərhal qaytarılır.
  - İnzibatçı tərəfindən tarif və ya ölkə dəyişdirildikdə keş avtomatik təmizlənir (`Cache Invalidation`).

#### 2.3. Verilənlər Bazası Bağlantı Hovuzu (Connection Pool Tuning)
- MySQL üçün optimal Prisma bağlantı parametrləri:
  - `connection_limit=25`, `pool_timeout=10` saniyə.
  - Serverin eyni vaxtda 1000+ paralel sorğunu kəsilmədən emal etmə qabiliyyəti.

---

### BÖLMƏ 3: YÜKSƏK ŞƏBƏKƏ SÜRƏTİ, GZIP SIXILMA VƏ FRONTEND OPTİMİZASİYASI

#### 3.1. Gzip və Brotli HTTP Sıxılması
- `compression` middleware vasitəsilə:
  - JSON cavabları, SVG nişanlar, böyük dosye siyahıları şəbəkə üzərindən 70%-dən çox sıxılaraq ötürülür.
  - Mobil cihazlarda yüklənmə vaxtı 3 dəfə sürətlənir, şəbəkə trafiki qənaət olunur.

#### 3.2. HTTP Keş Başlıqları (ETag & Cache-Control)
- API endpointləri üzrə fərqləndirilmiş keş idarəetməsi:
  - Dinamik məlumatlar (şəxsi kabinet, ödənişlər): `Cache-Control: no-store, no-cache, must-revalidate`.
  - Statik resurslar (ölkə bayraqları, rəsmi form şablonları): `Cache-Control: public, max-age=86400, stale-while-revalidate=3600`.
  - Şəbəkə sorğularının təkrar generasiyasının qarşısını almaq üçün avtomatik `ETag` (HTTP 304 Not Modified) cavabları.

#### 3.3. Frontend Bundle Optimallaşdırılması və Kod Parçalanması (Code Splitting)
- Vite istehsalat yığımında `manualChunks` konfiqurasiyası:
  - `vendor-react`: `react`, `react-dom`, `react-router-dom` (ayrıca keşlənir).
  - `vendor-pdf`: `pdf-lib` (yalnız PDF səhifələri açıldıqda yüklənir).
  - `vendor-ui`: İkon və köməkçi kitabxanalar.
- Saytın ilkin yüklənmə ölçüsü (Initial JS Bundle) 150KB-dan aşağı endirilir.

---

### BÖLMƏ 4: TAM MÜŞAHİDƏOLUNMA, APM VƏ PROMETHEUS METRİKLƏRİ

#### 4.1. Prometheus Metriklər İxracatçısı (`/api/metrics`)
- Standart OpenMetrics / Prometheus formatında canlı telemetriya çıxışı:
  - `http_requests_total{method, route, status}` — Ümumi sorğu sayğacı.
  - `http_request_duration_seconds{route}` — Cavab müddəti paylanması (Latency P50, P95, P99).
  - `dossiers_created_total{portal_type}` — Portal üzrə yeni müraciət sayı.
  - `dossiers_status_total{status}` — Təsdiq və imtina olunan vizaların canlı nisbəti.
  - `payments_volume_eur_total{provider}` — Toplanan vəsaitin həcmi.
  - `cron_jobs_duration_seconds{job_name}` — Arxa plan işçilərinin icra vaxtı və xəta sayı.
  - `database_query_latency_ms` — Verilənlər bazasının sağlamlıq vəziyyəti.

#### 4.2. Korrelyasiya ID Zənciri (Distributed Tracing)
- Hər bir HTTP sorğusuna unikal `X-Correlation-ID` verilir.
- Müştəri brauzerində yaranan xəta bu ID ilə server loqlarında, e-poçt bildirişlərində və baza əməliyyatlarında addım-addım təqib olunur.

---

### BÖLMƏ 5: KONTEYNERLƏŞDİRMƏ, DOCKER COMPOSE VƏ DEVOPS ORKESTRASİYASI

#### 5.1. İstehsalat Standartlı Multi-Stage Dockerfile-lar
- **Backend Dockerfile (`back/Dockerfile`):**
  - Mərhələ 1 (Builder): Asılılıqların quraşdırılması, Prisma client generasiyası.
  - Mərhələ 2 (Runner): Yüngül `node:22-alpine` əsasında, root olmayan `USER nodejs` istifadəçisi ilə, `dumb-init` siqnal idarəetməsi ilə təhlükəsiz işləmə. Yekun imic ölçüsü < 160MB.
- **Frontend Dockerfile (`front/Dockerfile`):**
  - Mərhələ 1 (Builder): Node mühitində `npm run build` ilə minifikasiya.
  - Mərhələ 2 (Runner): Ultra-yüngül `nginx:alpine` serveri ilə statik faylların paylanması, Gzip və SPA routing (`try_files $uri /index.html`).

#### 5.2. Docker Compose Tam Ekosistem Orkestrasiyası (`docker-compose.yml`)
Bütün layihəni bir əmrlə (`docker compose up -d`) qaldırmaq üçün 5 xidmət:
1. `eurotech-backend`: Express REST API və Cron Scheduler.
2. `eurotech-frontend`: Nginx üzərində React SPA.
3. `eurotech-mysql`: MySQL 8.0 bazası, `utf8mb4_unicode_ci`, persistent data volume və avtomatik healthcheck.
4. `eurotech-redis`: Keşləmə və paylanmış rate limiter üçün Redis 7.0.
5. `eurotech-gateway`: SSL sertifikatları, reverse proxy, DDoS qorunması və yük balanslaşdırıcısı (Load Balancer).

#### 5.3. Avtomatlaşdırılmış CI/CD Pipeline Konfiqurasiyası (`.github/workflows/ci-cd.yml`)
- Kod hər dəfə `main` budağına push edildikdə avtomatik işə düşür:
  - 1. Addım: Statik analiz və TypeScript tip yoxlanışı (`tsc --noEmit`).
  - 2. Addım: Bütün test dəstlərinin paralel icrası (Faza 1 + Faza 2 + Faza 3 + Faza 4).
  - 3. Addım: Docker imiclərinin yığılması və təhlükəsizlik zəifliklərinin skan edilməsi (Trivy skan).
  - 4. Addım: Uğurlu olduqda istehsalat serverinə avtomatik sıfır fasiləli (Zero-Downtime Rolling Update) yerləşdirmə.

---

### BÖLMƏ 6: AVTOMATLAŞDIRILMIŞ EHTİYAT NÜSXƏLƏNMƏ VƏ QƏZADAN BƏRPA (DISASTER RECOVERY)

#### 6.1. Ehtiyat Nüsxələnmə (Automated Backup Script)
- `scripts/backup-db.sh` & `scripts/backup-db.ps1`:
  - Hər gecə saat 03:00-da işə düşür.
  - Bütün verilənlər bazasını `mysqldump --single-transaction --quick` ilə kilidləmədən çıxarır.
  - Gzip ilə sıxır, `SHA256` yoxlama cəmini hesablayır və fayl adını `backup_eurotech_YYYYMMDD_HHMMSS.sql.gz` edir.
  - 30 gündən köhnə nüsxələri avtomatik silir (Disk dolmasının qarşısını alır).
  - Təhlükəsiz şəkildə soyuq bulud anbarına (S3 / MinIO) kopyalayır.

#### 6.2. Qəzadan Bərpa (Disaster Recovery Drill)
- `scripts/restore-db.sh` & `scripts/restore-db.ps1`:
  - Qəza zamanı bazanı verilmiş nüsxə faylından tək əmrlə bərpa edir.
  - RPO (Recovery Point Objective): Maksimum 15 dəqiqə məlumat itkisi hədəfi.
  - RTO (Recovery Time Objective): Maksimum 1 saat ərzində xidmətin tam bərpası hədəfi.

---

### BÖLMƏ 7: YÜK TESTİ VƏ TƏHLÜKƏSİZLİK AUDİT PAKETİ (STRESS & SECURITY TEST)

#### 7.1. Avtomatlaşdırılmış Faza 4 Test Skripti (`test-faza4.js`)
Test proqramı aşağıdakı mürəkkəb ssenariləri avtomatik yoxlayır:
1. **Rate Limiting Testi:** Login ünvanına ardıcıl 6 sorğu göndərir — 6-cı sorğunun dəqiq `429 Too Many Requests` qaytarmasını təsdiqləyir.
2. **Bruteforce Lockout Testi:** 5 yanlış şifrə ilə hesaba hücum simulyasiyası edir və hesabın müvəqqəti kilidləndiyini yoxlayır.
3. **PII Maskalanma Testi:** Pasport və şifrə göndərilən sorğu loqlarını skan edir — gizli məlumatların loqda ulduzlandığını (`***`) təsdiqləyir.
4. **Gzip Sıxılma Testi:** `Accept-Encoding: gzip` başlığı ilə sorğu edir — `Content-Encoding: gzip` qaytarıldığını və fayl ölçüsünün kiçildiyini təsdiqləyir.
5. **Prometheus Metrics Testi:** `/api/metrics` ünvanına müraciət edir — standart göstəricilərin mövcudluğunu yoxlayır.
6. **Yüksək Konkurentlik Stres Testi:** Eyni anda 50 asinxron paralel sorğu göndərir — sistemin qırılmadan və gecikmədən (Latency < 200ms) cavab verdiyini sübut edir.

---

## 🛠️ İCRA MƏRHƏLƏLƏRİ VƏ ARDICILLIQ

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ADIM 1: Təhlükəsizlik Sərtləşdirməsi (WAF, Helmet CSP, CORS, PII Maskinq)  │
├─────────────────────────────────────────────────────────────────────────────┤
│ ADIM 2: Baza İndeksləri & Keşləmə (Prisma Composite Indexes, Cache Layer)  │
├─────────────────────────────────────────────────────────────────────────────┤
│ ADIM 3: Şəbəkə Performansı (Gzip Compression, HTTP ETag & Cache Headers)    │
├─────────────────────────────────────────────────────────────────────────────┤
│ ADIM 4: Telemetriya & APM (Prometheus Metrics /api/metrics, Correlation ID) │
├─────────────────────────────────────────────────────────────────────────────┤
│ ADIM 5: DevOps & Konteynerləşdirmə (Dockerfiles, Nginx Conf, Docker Compose)│
├─────────────────────────────────────────────────────────────────────────────┤
│ ADIM 6: Ehtiyat Nüsxə & Qəzadan Bərpa Skriptləri (Backup & Restore Shell)   │
├─────────────────────────────────────────────────────────────────────────────┤
│ ADIM 7: Yük və Təhlükəsizlik Auditi (test-faza4.js İcraatı və Təsdiqi)      │
└─────────────────────────────────────────────────────────────────────────────┘
```

Bu plan EUROTECH sistemini qlobal səviyyədə ən yüksək təhlükəsizlik, performans və etibarlılıq dərəcəsinə çatdırmaq üçün hazırlanmışdır.
