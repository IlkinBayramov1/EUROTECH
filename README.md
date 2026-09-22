# 🌐 EUROTECH - Viza & İmiqrasiya Rəqəmsal İdarəetmə Platforması

<div align="center">

![EuroTech Banner](https://img.shields.io/badge/EUROTECH-Enterprise%20Immigration%20Platform-002B49?style=for-the-badge&logo=shield)

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Tests](https://img.shields.io/badge/Tests-21%2F21%20Passing-brightgreen?style=flat-square&logo=checkmarx)](back/test-all.js)
[![Compliance](https://img.shields.io/badge/Compliance-GDPR%20%26%20SOC2-blue?style=flat-square)](PORTAL_ANALYSIS_AND_BACKEND_GAP_PLAN.md)

**EUROTECH**, çoxölkəli viza müraciətlərini, konsulluq randevularını, sənəd dövriyyəsini və korporativ relokasiya proseslərini vahid mərkəzdən avtomatlaşdıran enterprise səviyyəli rəqəmsal ekosistemdir.

Platforma fərdi vətəndaşlar (**B2C**), turizm şirkətləri/agentliklər (**B2B Agent**), korporativ holdinqlər (**B2B Corporate HR**) və konsulluq/inzibatçı komandası (**Admin**) üçün tam fərdiləşdirilmiş 4 müstəqil portaldan ibarətdir.

[Sistem İcmalı](#-sistem-haqqında-ümumi-məlumat) • [Portallar](#-portalların-funksionallığı) • [Arxitektura](#-layihə-strukturu-və-arxitektura) • [Quraşdırma](#-quraşdırma-və-işə-salma) • [Demo Hesablar](#-hazır-demo-istifadəçi-hesabları) • [API Endpoint-lər](#-əsas-api-marşrutları-v1) • [Təhlükəsizlik](#-təhlükəsizlik-və-gdpr)

</div>

---

## 🌟 Sistem Haqqında Ümumi Məlumat

EUROTECH köhnəlmiş, kağız üzərində və pərakəndə aparılan viza müraciətlərini 100% rəqəmsal və avtomatlaşdırılmış iş axını ilə əvəzləyir:

- **100% Real Verilənlər Bazası İnteqrasiyası**: Heç bir feyk (mock) data yoxdur. Bütün müraciətlər, sənədlər, randevu qeydləri, maliyyə balansları və bildirişlər birbaşa PostgreSQL bazasında saxlanılır və idarə olunur.
- **Dinamik Sənəd və Ölkə Tələbləri Mühərriki**: Müraciət edilən ölkəyə və viza növünə (Şengen, Turist, İş, Təhsil) uyğun tələb olunan sənəd siyahısı və forma sualları avtomatik formalaşır.
- **Canlı Randevu Rezervasiyası**: Səfirlik/Konsulluq üçün açıq qəbul vaxtları bazadan real vaxt rejimində təqdim edilir, 1 kliklə rezervasiya, vaxt dəyişmə (reschedule) və rəsmi PDF Randevu Qəbzi formalaşdırılır.
- **İnteqrasiya Edilmiş Rəqəmsal Pul Kisəsi (Wallet)**: Agentliklər və korporativ müştərilər üçün onlayn depozit artırma, avtomatik komissiya hesablanması və qrupların rüsumlarını birbaşa balansdan ödəmə imkanı.

---

## 👥 Portalların Funksionallığı

Sistem 4 fərqli istifadəçi profilinə xidmət edir:

### 1. 👤 Fərdi Vətəndaş Portalı (`/client`)
*Fərdi viza almaq istəyən şəxslər üçün nəzərdə tutulub.*
- **5 Addımlı Viza Sihirbazı (Wizard)**:
  1. *Ölkə və Viza Növü*: İstiqamət ölkəsi, viza növü və emal prioriteti (Standard, Express, VIP).
  2. *Əlavə Xidmətlər*: VIP Konsulluq Zalı, Şengen Səyahət Sığortası, Notarial Tərcümə paketi.
  3. *Müraciətçi Məlumatları*: Şəxsi məlumatlar, pasport etibarlılığı və xüsusi anket sualları.
  4. *Konsulluq Randevusu*: Açıq təqvimdən gün və saat seçimi.
  5. *Təsdiq və Ödəniş*: Şəffaf xidmət haqqı bölgüsü və dərhal unikal dosye nömrəsinin (`EUR-XXXXXX`) generasiyası.
- **Sənəd İdarəetmə Mərkəzi**: Tələb olunan sənədləri (PDF, PNG, JPG) təhlükəsiz yükləmə, statusların izlənməsi (Yoxlanılır, Təsdiqləndi, Düzəliş Tələb Olunur) və rəsmi şifrələnmiş linklə yükləmə.
- **Canlı Status İzləyicisi**: Müraciətin 6 mərhələli real vaxt xətti (Qaralama → Təqdim edildi → Yoxlanışda → Biometriya → Konsulluq Qərarı → Hazırdır).
- **Rəsmi PDF İxracı**: Müraciət anketinin və təsdiqlənmiş randevunun rəsmi PDF formasının avtomatik hazırlanması.
- **GDPR Məxfilik Mərkəzi**: İstifadəçinin bütün şəxsi məlumatlarını vahid ZIP/JSON paketində ixrac etmə və ya tam silinmə (Right to be Forgotten) tələbi.

### 2. 🏢 Turizm Agentliyi Portalı (`/agent`)
*Qrup turları və korporativ müştəri bazasını idarə edən tərəfdaş şirkətlər üçün.*
- **Qrup Dosye Sihirbazı**: Tək bir qovluq daxilində eyni vaxtda onlarla turisti vahid qrup kimi təqdim etmə.
- **Səyahətçi Reyestri**: Hər bir qrup üzvü üçün fərdi sənəd və anket yoxlanışı.
- **Agentlik Randevu Cədvəli**: Bütün qrup üzvləri üçün konsulluq biometriya saatlarının təqvim görünüşü.
- **Komissiya və Maliyyə Balansı**: Tamamlanmış hər müraciətdən qazanılan nağd komissiyaların canlı uçotu və bank hesabına çıxarış (Payout) tələbi.

### 3. 🌐 Korporativ Mobillik Portalı (`/corporate`)
*Beynəlxalq ezamiyyətlər və əməkdaş relokasiyasını təşkil edən şirkətlərin HR komandaları üçün.*
- **Korporativ Dashboard**: Şirkətin aktiv ezamiyyət partiyaları, sənədi çatışmayan işçilər, təsdiqlənmiş vizalar və cari il üzrə xərcləmələr (Total Spend YTD).
- **İşçi Heyəti Reyestri**: Şirkət işçilərinin pasport, vəzifə və departament məlumatlarının bazada saxlanılması və Excel/CSV ixracı.
- **Özünəxidmət Dəvət Linkləri (Delegation Links)**: HR-ın vaxtına qənaət edən təhlükəsiz təkistifadəlik şifrəli linklər. İşçi özü linkə daxil olub pasportunu və sənədlərini birbaşa yükləyir.
- **Korporativ Fakturalaşdırma və Balans**: Rəsmi Proforma PDF Fakturaların (`INV-2026-XXXX`) generasiyası, korporativ pul kisəsindən partiyaların ödənilməsi və tranzaksiya loqları.

### 4. 🛡 İnzibatçı və Konsulluq Portalı (`/admin`)
- Sənədlərin operator tərəfindən ekspertizası (Təsdiq, İmtina, Səbəb qeydi ilə Düzəliş tələbi).
- Konsulluq yekun qərar mexanizmi (Viza verildi / İmtina olundu).
- Arxivləşdirmə: Viza müraciətçisinin bütün sənədlərinin və anketlərinin vahid ZIP arxivi kimi endirilməsi.

---

## 🏛 Layihə Strukturu və Arxitektura

Layihə monorepo strukturuna malikdir:

```
EUROTECH/
├── back/                             # Backend Servisi (Node.js, Express, Prisma ORM)
│   ├── config/                       # DB əlaqəsi, təhlükəsizlik konstantları və rollar (RBAC)
│   ├── core/                         # Baza Controller, Service və Repository şablonları
│   ├── modules/                      # 11 Müstəqil Biznes Modulu
│   │   ├── admin/                    # Sənəd yoxlanışı və konsulluq qərar mühərriki
│   │   ├── agent/                    # Agentlik qrupları, komissiya və pul kisəsi
│   │   ├── appointment/              # Təqvim slotları, bron, reschedule və PDF manifest
│   │   ├── auth/                     # JWT autentifikasiyası, avtomatik ID və şifrə təyini
│   │   ├── corporate/                # Korporativ partiyalar, dəvət linkləri və fakturalar
│   │   ├── document/                 # Multer yükləmə, imzalanmış URL-lər, ZIP arxivləyici
│   │   ├── dossier/                  # Müraciət qovluqları və həyat dövrü statusları
│   │   ├── notification/             # Avtomatlaşdırılmış e-poçt bildirişləri (Nodemailer)
│   │   ├── payment/                  # Pul kisəsi balansı və ödəniş axını
│   │   ├── service/                  # Əlavə viza xidmətləri kataloqu (VIP zal, Sığorta və s.)
│   │   ├── shared/                   # GDPR Məxfilik (Məlumat ixracı, Hesabın silinməsi)
│   │   └── template/                 # Ölkələr üzrə dinamik sənəd tələbləri və anket sxemləri
│   ├── middlewares/                  # JWT yoxlanışı, rol icazələri, audit loqlama
│   ├── prisma/                       # Verilənlər bazası modeli (schema.prisma) və seed skripti
│   ├── routes/v1/                    # Versiyalanmış REST API marşrutları (/api/v1/*)
│   ├── utils/                        # PDF generatorlar, SHA256 heşləmə, token utilitləri
│   └── test-all.js                   # 21 Avtomatlaşdırılmış inteqrasiya və təhlükəsizlik testi
│
├── front/                            # Frontend Servisi (React 19, TypeScript, Vite)
│   ├── src/
│   │   ├── layouts/                  # Portal çərçivələri (ClientLayout, AgentLayout, CorporateLayout)
│   │   ├── modules/                  # İstifadəçi interfeysi modulları
│   │   │   ├── auth/                 # Giriş, qeydiyyat və profil seçici
│   │   │   ├── client/               # Fərdi müraciətçi səhifələri (Dashboard, Wizard, Sənədlər, Randevu)
│   │   │   ├── agent/                # Agent səhifələri (Qruplar, Təqvim, Maliyyə)
│   │   │   └── corporate/            # Korporativ səhifələr (Partiyalar, İşçilər, Dəvətlər, Fakturalar)
│   │   ├── shared/
│   │   │   ├── api/                  # Axios əsaslı tipləşdirilmiş API xidmətləri
│   │   │   ├── components/           # UI komponent kitabxanası (Modallar, Düymələr, Kartlar)
│   │   │   ├── context/              # AuthContext və ToastContext provayderləri
│   │   │   ├── styles/               # CSS dizayn sistemi dəyişənləri və qlobal üslublar
│   │   │   └── types/                # TypeScript tip tərifləri və domen modelləri
│   │   ├── App.tsx                   # Mərkəzi səhifələmə marşrutları (React Router)
│   │   └── main.tsx                  # Tətbiqin başlanğıc nöqtəsi
│   ├── index.html                    # Əsas HTML şablonu
│   ├── package.json                  # Frontend paketləri və skriptləri
│   └── vite.config.ts                # Vite konfiqurasiyası
│
└── README.md                         # Əsas sənədləşmə
```

---

## 💻 Texnologiya Yığını

| Sahə | Texnologiyalar |
| :--- | :--- |
| **Frontend** | React 19, TypeScript 5.7, Vite 6, React Router DOM 7, Vanilla Modern CSS |
| **Backend** | Node.js (v18+), Express.js, RESTful API |
| **Verilənlər Bazası** | PostgreSQL, Prisma ORM (Type-safe query builder & migrations) |
| **Autentifikasiya** | JSON Web Token (JWT), bcryptjs, Role-Based Access Control (RBAC) |
| **Sənəd & Fayl Emalı** | Multer (Fayl yükləmə), PDFKit (Rəsmi sənəd/anket PDF generatoru), Archiver (ZIP) |
| **Təhlükəsizlik** | Rate Limiting, Helmet, CORS, SHA256 integrity check, HMAC signed URLs |
| **Testlər** | Node.js Test Runner, 21 End-to-End inteqrasiya və bərpa testləri |

---

## 🚀 Quraşdırma və İşə Salma

Layihəni lokal mühitdə işə salmaq üçün aşağıdakı addımları ardıcıllıqla yerinə yetirin:

### İlkin Tələblər
- **Node.js**: `v18.0.0` və ya daha yuxarı versiya
- **npm**: `v9.0.0` və ya daha yuxarı versiya
- **PostgreSQL**: Lokal və ya bulud verilənlər bazası

---

### 1. Backend-in Quraşdırılması

1. Backend qovluğuna keçin:
   ```bash
   cd back
   ```

2. Asılılıqları quraşdırın:
   ```bash
   npm install
   ```

3. Mühit dəyişənlərini (`.env`) təyin edin:
   `back/` qovluğunda `.env` faylı yaradın və aşağıdakı konfiqurasiyanı daxil edin:
   ```env
   PORT=5000
   NODE_ENV=development
   DATABASE_URL="postgresql://postgres:parolunuz@localhost:5432/eurotech_db?schema=public"
   JWT_SECRET="eurotech_enterprise_super_secret_jwt_key_2026"
   JWT_EXPIRES_IN="7d"
   FRONTEND_URL="http://localhost:5173"
   
   # E-poçt xidməti (könüllü)
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT=587
   SMTP_USER="bildiris@eurotech.com"
   SMTP_PASS="tetbiq_parolu"
   ```

4. Verilənlər bazası strukturunu tətbiq edin və test datalarını doldurun:
   ```bash
   # Bazanın cədvəllərini yaratmaq
   npx prisma db push

   # Test istifadəçilərini və ilkin məlumatları bazaya yükləmək
   npx prisma db seed
   ```

5. Backend serverini başladın:
   ```bash
   npm run dev
   ```
   *Backend REST API `http://localhost:5000` ünvanında işə düşəcək (Baza marşrut: `http://localhost:5000/api/v1`).*

---

### 2. Frontend-in Quraşdırılması

1. Yeni terminal açıb frontend qovluğuna keçin:
   ```bash
   cd front
   ```

2. Asılılıqları quraşdırın:
   ```bash
   npm install
   ```

3. Frontend üçün `.env` faylını təyin edin:
   `front/` qovluğunda `.env` faylı yaradın:
   ```env
   VITE_API_URL=http://localhost:5000/api/v1
   ```

4. İnkişaf serverini başladın:
   ```bash
   npm run dev
   ```
   *Tətbiq brauzerdə avtomatik olaraq `http://localhost:5173` ünvanında açılacaq.*

5. İstehsal (Production) üçün yığmaq:
   ```bash
   npm run build
   ```

---

## 🔑 Hazır Demo İstifadəçi Hesabları

Verilənlər bazası ilkin doldurulduqda (`seed`) hər bir portal üzrə hazır demo hesablar aktivləşir:

| Portal / Rol | Email | Şifrə | Təyinat Səhifəsi |
| :--- | :--- | :--- | :--- |
| **Fərdi Müştəri (B2C)** | `client@eurotech.com` | `Password123!` | `/client/dashboard` |
| **Turizm Agentliyi (B2B)** | `agent@eurotech.com` | `Password123!` | `/agent/dashboard` |
| **Korporativ HR (B2B)** | `corporate@eurotech.com` | `Password123!` | `/corporate/dashboard` |
| **Baş İnzibatçı (Admin)** | `admin@eurotech.com` | `AdminSecure2026!` | `/admin` |

*Qeyd: İstənilən yeni istifadəçi Qeydiyyat (`/register`) səhifəsindən daxil olaraq dərhal unikal `EUR-XXXXX` ID-si ilə yeni hesab aça bilər.*

---

## 📡 Əsas API Marşrutları (v1)

Bütün sorğular `/api/v1` prefiksi ilə idarə olunur:

### 🔐 Autentifikasiya & İstifadəçi
- `POST /api/v1/auth/login` - Daxil olma və JWT əldə etmə.
- `POST /api/v1/auth/register` - Yeni fərdi müraciətçi qeydiyyatı.
- `GET /api/v1/auth/me` - Cari daxil olmuş istifadəçinin profil məlumatları.

### 📁 Müraciət Dosyeləri (Dossiers)
- `GET /api/v1/dossiers/my-dossiers` - İstifadəçiyə aid bütün viza müraciətləri.
- `POST /api/v1/dossiers` - Yeni addımlı viza müraciəti başlatma.
- `GET /api/v1/dossiers/:id` - Dosyenin tam təfərrüatları, iştirakçılar və sənədlər.

### 📄 Sənəd Əməliyyatları
- `POST /api/v1/documents/upload` - Fayl yükləmə (Multer, SHA256 bütövlük yoxlanışı).
- `GET /api/v1/documents/:id/signed-url` - Sənədə təhlükəsiz müvəqqəti baxış keçidi.
- `GET /api/v1/documents/:id/download` - Şifrəli tokenlə fayl endirmə.

### 📅 Konsulluq Randevuları
- `GET /api/v1/appointments/slots` - Mövcud olan boş randevu saatları.
- `POST /api/v1/appointments/book` - Seçilmiş saatı bron etmək.
- `PATCH /api/v1/appointments/:id/reschedule` - Mövcud randevunun vaxtını dəyişmək.
- `DELETE /api/v1/appointments/:id/cancel` - Randevunu ləğv etmək.
- `GET /api/v1/appointments/:id/confirmation-pdf` - Rəsmi təsdiq PDF qəbzini endirmək.

### ✈️ Turizm Agentliyi Modulu
- `GET /api/v1/agent/groups` - Agentliyə aid qrup müraciətləri siyahısı.
- `POST /api/v1/agent/groups` - Yeni turist qrupu yaratmaq.
- `GET /api/v1/agent/wallet` - Komissiya pul kisəsi balansı və gəlir tarixçəsi.
- `POST /api/v1/agent/payout-request` - Qazanılmış komissiyanın çıxarılması sorğusu.

### 🏢 Korporativ Şirkət Modulu
- `GET /api/v1/corporate/batches` - Şirkətin ezamiyyət partiyaları.
- `POST /api/v1/corporate/batches` - Yeni işçi partiyası başlatmaq.
- `GET /api/v1/corporate/employees` - Şirkət işçilərinin reyestri.
- `POST /api/v1/corporate/employees` - Reyestrə yeni işçi daxil etmək.
- `POST /api/v1/corporate/employees/:id/delegation-link` - İşçiyə fərdi anket doldurma linki generasiya etmək.
- `GET /api/v1/corporate/wallet` - Korporativ pul kisəsi balansı, illik xərcləmə (Total Spend YTD) və çıxarış.
- `POST /api/v1/corporate/batches/:batchId/pay-wallet` - Partiya rüsumlarını birbaşa balansdan ödəmək.

---

## 🧪 Təhlükəsizlik və Testlər

Layihənin tam dayanıqlığını yoxlamaq üçün avtomatlaşdırılmış **21/21 E2E İnteqrasiya Testi** mövcuddur:

```bash
cd back
node test-all.js
```

### Yoxlanılan 21 Tələb (Hamısı Uğurla Keçir):
1. Avtomatlaşdırılmış istifadəçi ID generasiyası (`EUR12345`)
2. Şifrə təyini və təhlükəsiz token doğrulama
3. Atomik Tranzaksiya ilə profil yeniləmələri
4. Rol əsaslı girişə nəzarət (RBAC Matrix)
5. Çoxfaktorlu təhlükəsizlik və icazə mexanizmi
6. Dinamik ölkə qaydaları və anket sualları mühərriki
7. Multer fayl yükləməsi və SHA256 bütövlük yoxlanışı
8. Şifrələnmiş URL-lər vasitəsilə sənədə təhlükəsiz baxış
9. Operator sənəd yoxlanışı (Təsdiq / İmtina / Düzəliş)
10. Avtomatik PDF viza müraciət anketinin formalaşması
11. Bütün sənədlərin vahid ZIP arxivinə yığılması
12. Əlavə xidmətlər kataloqu (VIP zal, Sığorta, Tərcümə)
13. Canlı randevu axtarışı və rezervasiya
14. 1 kliklə randevu vaxtının dəyişdirilməsi (Reschedule)
15. Səfirlik randevu manifestinin rəsmi PDF generasiyası
16. Agentlik qrup müraciətləri və komissiya uçotu
17. Agentlik pul kisəsi və ani çıxarış (Payout) xətti
18. Korporativ işçi heyəti və özünəxidmət dəvət keçidləri
19. Korporativ Proforma Faktura və Pul kisəsindən ödəniş
20. Ödəniş sistemlərinin tam tranzaksiya inteqrasiyası
21. Fəlakətdən bərpa və ehtiyat nüsxə bütövlüyü (Disaster Recovery)

---

## 🛡 Təhlükəsizlik və GDPR Uyğunluğu

- **Məlumatların Qorunması**: Bütün sənədlər qorunan kataloqda saxlanılır və birbaşa veb keçidləri bağlıdır. Giriş yalnız qısaömürlü HMAC imzalanmış tokenlərlə mümkündür.
- **GDPR Tələbləri**: İstifadəçinin öz şəxsi məlumatlarını vahid fayl kimi ixrac etməsi (`/privacy/export-data`) və məlumatlarının tam silinməsini tələb etməsi (`/privacy/erasure-request`) hüquqları tam təmin edilib.
- **Audit Loqlama**: Bütün inzibati hərəkətlər (sənəd təsdiqi, randevu ləğvi, ödənişlər) bazada dəyişdirilə bilməyən audit loqları ilə qeydiyyata alınır.
- **SQL Injection Mühafizəsi**: Bütün verilənlər bazası sorğuları Prisma ORM vasitəsilə təhlükəsiz parametrləşdirilir.

---

## 🏢 Korporativ Əlaqə

**EuroTech Services Kft. (Budapest)**  
Regional Nümayəndəlik Ofisi: Bakı, Azərbaycan  
*Məxfi — Yalnız səlahiyyətli istifadəçilər və əməliyyatlar üçün.*
