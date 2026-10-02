# 🚀 EUROTECH — Layihənin Klonlanması, `.env` Faylları və `.gitignore` Bələdçisi

Bu sənəd layihəni **GitHub-dan klonlayan komanda üzvləri** üçün hazırlanmışdır. Layihənin kompüterinizdə sıfırdan xətasız işə salınması üçün lazım olan bütün gizli / `.gitignore` olunan fayllar, `.env` dəyişənləri və quraşdırma addımları aşağıda ətraflı qeyd edilmişdir.

---

## 📂 1. `.gitignore` Tərəfindən İzlənməyən Bütün Məlumatlar

Git repozitoriyasında saxlanılmayan və yerli mühitdə manual olaraq yaradılmalı və ya sistem tərəfindən avtomatik generasiya olunan fayl və qovluqlar:

| Fayl / Qovluq | Yerləşdiyi Yer | Niyə Git-ə Atılmır? | Klonlayanda Nə Etmək Lazımdır? |
| :--- | :--- | :--- | :--- |
| **`.env`** | `back/.env` | Məxfi parollar, DB şifrələri, JWT açarları və API tokenləri ehtiva edir. | `back/.env.example` faylından nüsxələyib `.env` yaradın. |
| **`.env`** | `front/.env` | Frontend mühit konfiqurasiyası (API URL, timeout və s.). | `front/.env.example` faylından nüsxələyib `.env` yaradın. |
| **`node_modules/`** | `back/node_modules/` <br> `front/node_modules/` | Həcmi böyük olan paket asılılıqları. | Həm `back/`, həm də `front/` qovluğunda `npm install` icra edin. |
| **`uploads/`** | `back/uploads/` | İstifadəçilərin yüklədiyi pasportlar, bank qəbzləri və sənədlər (GDPR/Məxfilik). | Backend işə düşərkən bu qovluğu avtomatik yaradır. |
| **`archives/`** | `back/archives/` | Konsulluq üçün generasiya olunan arxiv `.zip` faylları. | Backend işə düşərkən avtomatik yaradır. |
| **`dist/`** | `front/dist/` | Frontend-in production üçün yığılmış (build) faylları. | `npm run build` əmri ilə avtomatik yaranır. |
| **`*.log`** | `back/`, `front/` | Sistem və server loqları. | Əməliyyat zamanı avtomatik generasiya olunur. |
| **`.vscode/`, `.idea`**| Root | Fərdi redaktor konfiqurasiyaları. | Fərdi tənzimləmələrdir, ehtiyac yoxdur. |

---

## 🔑 2. `.env` Faylları və İçindəki Məlumatların İzahı

Layihədə **2 ədəd** əsas `.env` faylı mövcuddur:

### A. Backend Mühiti: `back/.env`
* **Faylın yolu:** `back/.env`
* **Hazır şablon:** `back/.env.example`

```env
# ========================================================
# EUROTECH BACKEND ENVIRONMENT CONFIGURATION
# ========================================================

# Server Port və Mühit
PORT=5000
NODE_ENV=development

# MySQL Verilənlər Bazası Əlaqəsi (Prisma ORM)
# Format: mysql://USER:PASSWORD@HOST:PORT/DATABASE_NAME
# XAMPP/WAMP üçün default: root / şifrəsiz
DATABASE_URL="mysql://root:@localhost:3306/eurotech_db"

# JWT Autentikasiya Açarları
JWT_SECRET="eurotech_super_secret_jwt_key_2026_safe_and_secure"
JWT_EXPIRES_IN="7d"

# Stripe Ödəniş Sistemi (Test Açarları)
STRIPE_SECRET_KEY="sk_test_mock_eurotech_stripe_key"
STRIPE_PUBLISHABLE_KEY="pk_test_mock_eurotech_key"
STRIPE_WEBHOOK_SECRET="whsec_mock_eurotech_webhook_secret"

# Azərbaycan Daxili Bank Ödəniş Gateway-i (Mock/Real)
LOCAL_BANK_MERCHANT_ID="EUROTECH_MERCHANT_01"
LOCAL_BANK_TERMINAL_ID="EUROTECH_TERM_01"
LOCAL_BANK_SECRET_KEY="local_bank_super_secret_mac_key_2026"
LOCAL_BANK_GATEWAY_URL="https://bank-gateway.eurotech.services/pay"

# Email Bildirişləri (SMTP / Mailtrap)
SMTP_HOST="smtp.mailtrap.io"
SMTP_PORT=2525
SMTP_USER="mock_smtp_user"
SMTP_PASS="mock_smtp_pass"
SMTP_FROM="EuroTech Services <noreply@eurotech.services>"
SENDGRID_API_KEY=""

# WhatsApp Business Cloud API (Meta)
META_WHATSAPP_TOKEN=""
META_WHATSAPP_PHONE_ID="108823928192831"
META_WHATSAPP_BUSINESS_ACCOUNT_ID="992838192831023"
META_WHATSAPP_WEBHOOK_VERIFY_TOKEN="eurotech_wa_verify_token_2026"

# SMS Xidmətləri (Twilio və BulkSMS.az)
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_PHONE_NUMBER="+15005550006"
BULKSMS_AZ_API_KEY=""

# Lokal Fayl Saxlanc Qovluqları
UPLOAD_DIR="./uploads"
ARCHIVE_DIR="./archives"

# S3 / MinIO Obyekt Saxlanc Mühiti (Default: 'local')
STORAGE_DRIVER="local"
S3_ENDPOINT="http://localhost:9000"
S3_BUCKET_NAME="eurotech-documents"
S3_REGION="eu-central-1"
S3_ACCESS_KEY_ID="minioadmin"
S3_SECRET_ACCESS_KEY="minioadmin"
```

---

### B. Frontend Mühiti: `front/.env`
* **Faylın yolu:** `front/.env`
* **Hazır şablon:** `front/.env.example`

```env
# ========================================================
# EUROTECH FRONTEND ENVIRONMENT CONFIGURATION
# ========================================================

# Backend API Endpoint Ünvanı
VITE_API_URL=http://localhost:5000/api/v1

# Tətbiqin Brend Məlumatları
VITE_APP_NAME="EuroTech Immigration & Mobility"
VITE_APP_DESCRIPTION="Enterprise Visa, Consular & Global Mobility Management"
VITE_APP_ENV=development

# Portal Tənzimləmələri
VITE_DEFAULT_LANGUAGE=az
VITE_SUPPORT_EMAIL=support@eurotech.az
VITE_EMERGENCY_CONSULAR_HOTLINE="+994 12 400 00 00"

# Şəbəkə Sorğu Timeout Həddi (ms)
VITE_API_TIMEOUT=15000
```

---

## 🛠️ 3. Sıfırdan İşə Salma Təlimatı (Step-by-Step Setup)

Layihəni klonladıqdan sonra ardıcıllıqla bu addımları yerinə yetirin:

### Addım 1: Repozitoriyanı Klonlayın
```bash
git clone https://github.com/IlkinBayramov1/EUROTECH.git
cd EUROTECH
```

### Addım 2: `.env` Fayllarını Şablonlardan Nüsxələyin
**Windows (PowerShell və ya CMD):**
```powershell
copy back\.env.example back\.env
copy front\.env.example front\.env
```

**macOS / Linux:**
```bash
cp back/.env.example back/.env
cp front/.env.example front/.env
```

---

### Addım 3: Verilənlər Bazasını Hazırlayın (MySQL)
1. MySQL serverinizin (məs: XAMPP, WAMP, Docker və ya yerli MySQL) işlək olduğundan əmin olun.
2. `eurotech_db` adlı boş verilənlər bazası yaradın:
```sql
CREATE DATABASE eurotech_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

### Addım 4: Backend Paketlərini Yükləyin və Baza Sxemini Tətbiq Edin
```bash
cd back
npm install

# Prisma sxemini generasiya edin
npx prisma generate

# Baza cədvəllərini avtomatik qurun (Migration)
npx prisma migrate dev --name init

# Başlanğıc test istifadəçilərini, ölkələri və viza növlərini bazaya yükləyin (Seed)
npm run prisma:seed
```

---

### Addım 5: Frontend Paketlərini Yükləyin
Yeni bir terminal açıb `front` qovluğuna keçin:
```bash
cd front
npm install
```

---

### Addım 6: Layihəni İşə Salın

**Terminal 1 (Backend - Port 5000):**
```bash
cd back
npm run dev
```
*Backend server açılacaq:* `http://localhost:5000` (Sağlamlıq yoxlanışı: `http://localhost:5000/api/health`)

**Terminal 2 (Frontend - Port 5173):**
```bash
cd front
npm run dev
```
*Frontend portal açılacaq:* `http://localhost:5173`

---

## 👥 4. Hazır Test İstifadəçi Hesabları (Seed Data)

Bazanı seed etdikdə (`npm run prisma:seed`) avtomatik aşağıdakı test hesabları formalaşır:

| Rol | Portal / Giriş Səhifəsi | Email | Şifrə | Təsvir |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | `http://localhost:5173/admin` | `admin@eurotech.services` | `admin123` | Bütün müraciətlər, operatorlar və çıxarışlar |
| **Operator** | `http://localhost:5173/operator` | `operator@eurotech.services` | `operator123` | Sənəd yoxlanışı və konsulluq emalı |
| **Turizm Agenti (B2B)** | `http://localhost:5173/agent/finance` | `agent@baku-tours.az` | `user123` | Qrup müraciətləri, komissiya və çıxarışlar |
| **Korporativ HR** | `http://localhost:5173/corporate` | `hr@corp.az` | `user123` | Şirkət işçilərinin ezamiyyət vizaları |
| **Fərdi Müştəri** | `http://localhost:5173/client` | `mammadov@gmail.com` | `user123` | Fərdi Şengen və milli viza müraciətləri |

---

## 🛟 5. Tez-tez Rast Gəlinən Problemlər və Həlli

1. **`P1001: Can't reach database server` xətası:**
   - MySQL xidmətinin aktiv olduğunu yoxlayın.
   - `back/.env` faylında `DATABASE_URL` daxilindəki istifadəçi adı və şifrənin yerli MySQL-ə uyğun olduğunu dəqiqləşdirin.
2. **`listen EADDRINUSE: address already in use 0.0.0.0:5000` xətası:**
   - Port 5000 artıq başqa proses tərəfindən tutulub. Həmin prosesi dayandırın və ya `back/.env` daxilində `PORT=5001` edin (bu halda `front/.env`-də `VITE_API_URL`-i də uyğunlaşdırın).
3. **Sənəd yüklənməsi zamanı xəta:**
   - `back/uploads` və `back/archives` qovluqlarının mövcud olduğunu və yazma icazəsinin olduğunu yoxlayın.
