# EUROTECH Visa & Immigration Digital Platform

<div align="center">

![EuroTech Banner](https://img.shields.io/badge/EUROTECH-Enterprise%20Immigration%20Platform-002B49?style=for-the-badge&logo=shield)

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io)
[![Tests](https://img.shields.io/badge/Tests-21%2F21%20Passing-brightgreen?style=flat-square&logo=checkmarx)](back/test-all.js)
[![Compliance](https://img.shields.io/badge/Compliance-GDPR%20%26%20SOC2-blue?style=flat-square)](PORTAL_ANALYSIS_AND_BACKEND_GAP_PLAN.md)

**EuroTech Services Platform** is an enterprise-grade digital ecosystem built for multi-country visa, residency, and consular application management. It streamlines end-to-end workflows for individual applicants, travel agencies, corporate HR departments, and back-office administrative teams.

[Architecture](#-system-architecture) • [Portals](#-portal-ecosystem) • [Tech Stack](#-technology-stack) • [Installation](#-getting-started) • [API Reference](#-api-endpoints-v1) • [Tests](#-testing--disaster-recovery)

</div>

---

## 🌟 System Overview

EUROTECH replaces fragmented visa processing with an integrated, automated platform:

1. **Individual B2C Applications**: Guided 5-step visa wizard, dynamic document checklist, appointment slot reservation, real-time application tracker, and GDPR self-service data management.
2. **B2B Travel Agency Operations**: Group dossier submissions, multi-applicant rosters, agent commission ledger, digital wallet, and payout request management.
3. **B2B Corporate Mobility (HR)**: Corporate employee directory, batch relocations/business trips, self-service employee delegation magic links, proforma invoicing, and corporate wallet balance settlements.
4. **Executive Back-Office & Consular Processing**: Document verification matrix (Verified / Correction Needed / Rejected), automated applicant email alerts, final consular visa decision pipeline, and automated archive packaging (PDFs & ZIP).

---

## 🏛 System Architecture

The repository is organized as a decoupled monorepo featuring a high-performance React 19 Single Page Application and a robust Node.js/Express modular monolith backend with Prisma ORM:

```
EUROTECH/
├── back/                             # Backend Service (Node.js, Express, Prisma ORM)
│   ├── config/                       # DB connection, security constants, and RBAC matrix
│   ├── core/                         # Base Controller, Service, and Repository patterns
│   ├── modules/                      # 11 Modular Business Domains
│   │   ├── admin/                    # Document verification & visa decision engine
│   │   ├── agent/                    # B2B Travel Agency groups, commissions & wallet
│   │   ├── appointment/              # Slot reservation, reschedule & embassy PDF manifest
│   │   ├── auth/                     # JWT authentication, auto-username & password setup
│   │   ├── corporate/                # B2B Corporate batches, delegation links & invoices
│   │   ├── document/                 # Multer uploads, signed download URLs, ZIP archiver
│   │   ├── dossier/                  # Multi-applicant dossiers & lifecycle state machine
│   │   ├── notification/             # Multi-channel emails (Nodemailer) & alerts
│   │   ├── payment/                  # Stripe PaymentIntents, webhooks & wallet billing
│   │   ├── service/                  # Add-on catalog (Lounge, Insurance, Translation)
│   │   ├── shared/                   # GDPR Privacy (Export package, Account erasure)
│   │   └── template/                 # Dynamic country requirements & form schemas
│   ├── middlewares/                  # JWT auth, RBAC permissions, audit logger, uploads
│   ├── prisma/                       # Database schema (schema.prisma) & seeders
│   ├── routes/v1/                    # Versioned RESTful API routes (/api/v1/*)
│   ├── utils/                        # PDF application builder, token generators, hashers
│   └── test-all.js                   # 21 End-to-end integration & DR test suite
│
├── front/                            # Frontend Service (React 19, TypeScript, Vite)
│   ├── public/                       # Static assets & SVG icons
│   ├── src/
│   │   ├── layouts/                  # Portal Layouts (Client, Agent, Corporate)
│   │   ├── modules/                  # Feature Modules
│   │   │   ├── auth/                 # Multi-profile login & profile selector
│   │   │   ├── client/               # Individual Portal (Dashboard, Wizard, Docs, Tracking)
│   │   │   ├── agent/                # Agent Portal (Groups, Wizard, Appointments, Finance)
│   │   │   └── corporate/            # Corporate Portal (Batches, Employees, Delegation)
│   │   ├── shared/
│   │   │   ├── api/                  # Typed API Client & Axios/fetch abstraction
│   │   │   ├── components/           # Reusable UI component library & SVG icons
│   │   │   ├── context/              # Auth and Toast notification providers
│   │   │   ├── styles/               # Design system tokens, utilities & reset
│   │   │   ├── types/                # Strict TypeScript contracts & domain models
│   │   │   └── utils/                # Validators, formatters, and local storage helpers
│   │   ├── App.tsx                   # Central router configuration
│   │   └── main.tsx                  # Application entry point
│   ├── index.html                    # HTML5 shell
│   ├── package.json                  # Frontend dependencies & scripts
│   └── vite.config.ts                # Vite build configuration with proxy rules
│
└── README.md                         # Master Documentation
```

---

## 🖥 Portal Ecosystem

### 1. Individual Client Portal (`/client`)
- **Dashboard**: Live active dossier status widget, immediate next actions, and visa tracking summary.
- **5-Step Application Wizard**:
  1. *Destination & Visa Type*: Country picker, purpose, and processing tier (Standard / Express / VIP).
  2. *Add-on Services*: Premium Lounge (€81), Schengen Travel Insurance (€35), Document Translation (€25).
  3. *Applicant Details*: Personal information, passport validity, and conditional questionnaire.
  4. *Appointment Slot Booking*: Real-time available embassy/consular date & time slot selection.
  5. *Review & Payment*: Transparent fee breakdown, card payment simulation, and immediate dossier code generation.
- **Document Manager**: Categorized file uploads with file-type/size guards, upload progress, status tracking (Pending / Verified / Correction Needed), and signed temporary download URLs.
- **Embassy Appointments**: View scheduled slots, instant 1-click reschedule within policy limits, and generate official PDF Appointment Manifests.
- **Real-Time Tracker**: Visual 6-stage milestone tracker (Draft → Submitted → Under Review → Biometrics → Consular Decision → Completed).
- **GDPR & Privacy Center**: Download complete JSON/ZIP data export package or initiate Right-to-Erasure account deletion.

### 2. Travel Agency / Tour Operator Portal (`/agent`)
- **Agent Dashboard**: High-level agency metrics (Active Groups, Total Travelers, Earned Commissions, Wallet Balance).
- **Group Wizard**: Batch submit tourist groups or family delegations under a single primary dossier.
- **Group Dossiers**: Filter by status, inspect traveler checklists, and monitor consular milestones.
- **Agency Appointments**: View grouped appointment schedules for entire delegations.
- **Finance & Commission Wallet**: Transparent ledger of earned referral commissions, commission tiers, and 1-click payout withdrawal requests.

### 3. Corporate Mobility Portal (`/corporate`)
- **Corporate Dashboard**: Enterprise metrics (Active Batches, Relocated Employees, Monthly Spend, Corporate Balance).
- **Batch Application Wizard**: Initiate company-sponsored relocation batches or business trip contingents.
- **Employee Registry**: Maintain an active roster of employees, job titles, and passport expiration dates.
- **Self-Service Delegation**: Generate secure, single-use magic delegation links allowing employees to directly fill in their visa questionnaires and upload personal documents.
- **Corporate Finance**: Download official PDF Proforma Invoices (`INV-2026-XXXX`) and execute payments directly from company credit lines or digital wallets.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v18.x` or later (LTS recommended)
- **npm**: `v9.x` or later
- **Database**: PostgreSQL (or SQLite for quick local development)

---

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd back
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env` file in the `back/` folder (or copy from existing environment):
   ```env
   PORT=5000
   NODE_ENV=development
   DATABASE_URL="postgresql://postgres:password@localhost:5432/eurotech_db?schema=public"
   JWT_SECRET="eurotech_enterprise_super_secret_jwt_key_2026"
   JWT_EXPIRES_IN="7d"
   STRIPE_SECRET_KEY="sk_test_..."
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT=587
   SMTP_USER="notifications@eurotech.com"
   SMTP_PASS="your_app_password"
   FRONTEND_URL="http://localhost:5173"
   ```

4. **Initialize database schema and seed demo records**:
   ```bash
   npx prisma db push
   npx prisma db seed
   ```

5. **Start backend development server**:
   ```bash
   npm run dev
   ```
   *The backend REST API will be available at `http://localhost:5000` (API base: `http://localhost:5000/api/v1`).*

---

### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd front
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env` file in the `front/` folder:
   ```env
   VITE_API_URL=http://localhost:5000/api/v1
   ```

4. **Start frontend development server**:
   ```bash
   npm run dev
   ```
   *The application will launch at `http://localhost:5173`.*

5. **Production Build**:
   ```bash
   npm run build
   ```

---

## 🔑 Pre-Configured Demo Accounts

For testing, seed data includes accounts for each portal:

| Role | Username / Email | Password | Target Portal |
| :--- | :--- | :--- | :--- |
| **Individual Client** | `client@eurotech.com` *(or auto-generated ID)* | `Password123!` | `/client/dashboard` |
| **Travel Agent** | `agent@eurotech.com` | `Password123!` | `/agent/dashboard` |
| **Corporate HR** | `corporate@eurotech.com` | `Password123!` | `/corporate/dashboard` |
| **System Admin** | `admin@eurotech.com` | `AdminSecure2026!` | `/admin` |

---

## 📡 API Endpoints (v1)

All endpoints are prefixed with `/api/v1` (with backward-compatibility aliases on `/api`):

| Domain | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/auth/login` | Authenticate and obtain JWT token |
| | `POST` | `/auth/register` | Register individual applicant (auto-generates EUR-ID) |
| | `POST` | `/auth/set-password` | Activate account via secure invitation token |
| **Dossiers** | `POST` | `/dossiers` | Create new multi-step application dossier |
| | `GET` | `/dossiers/:id` | Fetch dossier details, applicants, and status |
| | `POST` | `/dossiers/:id/applicants` | Add an applicant to an existing dossier |
| **Documents** | `POST` | `/documents/upload` | Upload document (Multer, SHA256 integrity) |
| | `GET` | `/documents/:id/signed-url` | Generate temporary signed URL for file access |
| | `GET` | `/documents/:id/download` | Secure file download with token validation |
| **Appointments** | `GET` | `/appointments/slots` | Fetch available embassy slots by country/date |
| | `POST` | `/appointments/book` | Reserve an appointment slot |
| | `PATCH` | `/appointments/:id/reschedule` | Reschedule existing appointment |
| | `GET` | `/appointments/:id/manifest-pdf` | Download official embassy appointment manifest |
| **Agent** | `POST` | `/agent/groups` | Create group dossier for agency clients |
| | `POST` | `/agent/groups/:id/submit` | Submit group for processing & credit commission |
| | `GET` | `/agent/wallet` | Fetch agency commission ledger and balance |
| | `POST` | `/agent/payout-request` | Request commission withdrawal |
| **Corporate** | `POST` | `/corporate/batches` | Create corporate mobility batch |
| | `POST` | `/corporate/employees` | Add employee to company registry |
| | `POST` | `/corporate/employees/:id/delegation-link` | Generate self-service delegation link |
| | `GET` | `/corporate/delegation/profile` | Validate guest employee token |
| | `POST` | `/corporate/batches/:id/invoice` | Generate proforma invoice (PDF) |
| | `POST` | `/corporate/batches/:id/pay-wallet` | Pay batch from corporate balance |
| **Services** | `GET` | `/services` | List active add-on service catalog |
| | `POST` | `/services/add` | Attach add-on service to dossier |
| **Privacy (GDPR)**| `GET` | `/privacy/export-data` | Export all applicant data (Right to Access) |
| | `POST` | `/privacy/erasure-request` | Request account data erasure (Right to be Forgotten) |
| **Payments** | `POST` | `/payments/create-intent` | Initialize Stripe PaymentIntent |
| | `POST` | `/payments/confirm-mock` | Confirm payment in local/test environment |
| **Admin** | `PATCH` | `/admin/documents/:id/verify` | Verify or reject uploaded document |
| | `PATCH` | `/admin/dossier/:id/decision` | Final consular decision (Approved / Rejected) |

---

## 🧪 Testing & Disaster Recovery

The backend features an automated end-to-end integration test runner validating 21 core enterprise requirements:

```bash
cd back
node test-all.js
```

### Verified Scenarios (21/21 Passing):
- [x] **01.** Automated Username Generation (`EUR12345`)
- [x] **02.** Set Password Token Creation & Verification
- [x] **03.** Single-Query Atomic Transaction Profile Updates
- [x] **04.** Role-Based Access Control (RBAC) Matrix
- [x] **05.** Multi-Factor & OTP Authentication Flow
- [x] **06.** Dynamic Country Requirements Engine
- [x] **07.** Multer File Upload & SHA256 Integrity Verification
- [x] **08.** Signed URLs for Secure Document Access
- [x] **09.** Operator Document Review (Verified / Correction / Rejected)
- [x] **10.** Automated PDF Dossier Application Builder
- [x] **11.** Multi-Document ZIP Archival Generator
- [x] **12.** Add-On Services (Premium Lounge, Insurance, Translation)
- [x] **13.** Appointment Slot Search & Live Booking
- [x] **14.** 1-Click Appointment Rescheduling Engine
- [x] **15.** Embassy Appointment Manifest PDF Generator
- [x] **16.** Travel Agency Group Dossiers & Commission Tiering
- [x] **17.** Agent Wallet & Instant Payout Pipeline
- [x] **18.** Corporate Employee Registry & Magic Delegation Links
- [x] **19.** Corporate Proforma Invoice & Wallet Direct Checkout
- [x] **20.** Stripe PaymentIntent & Mock Settlement
- [x] **21.** Disaster Recovery (DR) & Backup Integrity (RTO: 15ms vs 1hr target, RPO: 15min)

---

## 🔒 Security & Compliance

- **Authentication & RBAC**: Strict JWT signature verification with granular role guards (`CLIENT`, `AGENT`, `CORPORATE`, `ADMIN`, `SUPERADMIN`).
- **GDPR Compliance**: Dedicated `/privacy` endpoints for user data exports and account erasure requests.
- **Document Protection**: Documents are stored in protected storage; direct access is blocked. Downloads require short-lived HMAC-signed URLs.
- **Audit Logging**: Sensitive operations (document reviews, consular decisions, wallet payouts) produce immutable audit logs.
- **SQL Injection Prevention**: Safe, parameterized database operations powered by Prisma ORM.

---

## 🏢 Corporate Information

**EuroTech Services Kft. (Budapest)**  
Regional Representative Office: Baku, Azerbaijan  
*Confidential — For Internal & Authorized Client Operations Only.*
