# EUROTECH Frontend Application

<div align="center">

![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Design System](https://img.shields.io/badge/Design%20System-Vanilla%20CSS%20Tokens-002B49?style=for-the-badge)

**EuroTech Frontend** is a modern, high-performance Single Page Application (SPA) delivering specialized portals for Individual Visa Applicants, Travel Agency Tour Operators, and Corporate Mobility HR teams.

</div>

---

## 🚀 Portals & Features

### 1. Individual Client Portal (`/client`)
- **Dashboard (`/client/dashboard`)**: Current visa status hero, active step progress, and quick action bar.
- **Dynamic 5-Step Application Wizard (`/client/wizard`)**:
  - **Step 1 - Country & Purpose**: Country picker (Hungary, Germany, Poland, France, etc.), Visa category, Processing urgency.
  - **Step 2 - Services**: Premium Lounge (€81), Schengen Travel Insurance (€35), Certified Translation (€25).
  - **Step 3 - Applicant Details**: Detailed form with validation, passport dates, and auto-filled contact information.
  - **Step 4 - Appointment Selection**: Real-time calendar slot reservation at designated consular centers.
  - **Step 5 - Review & Payment**: Transparent price breakdown, credit card checkout simulation, and immediate dossier code creation.
- **Documents Hub (`/client/documents`)**: Upload passport, bank statements, photos with real-time status and temporary signed download links.
- **Appointments Hub (`/client/appointment`)**: View scheduled appointments, 1-click slot rescheduling, and official PDF Manifest download.
- **Live Tracker (`/client/tracking`)**: Step-by-step visual tracker with estimated processing milestones.
- **Privacy & GDPR (`/client/privacy`)**: Data export download and right-to-erasure account closure requests.

### 2. Travel Agency Portal (`/agent`)
- **Agency Dashboard (`/agent/dashboard`)**: Groups in-flight, total applicant count, commission revenue, and wallet balance.
- **Group Wizard (`/agent/wizard`)**: Step-by-step bulk visa application for tourist groups or family delegations.
- **Group Management (`/agent/groups`)**: Search, filter, and inspect traveler documents across group dossiers.
- **Agency Appointments (`/agent/appointments`)**: Delegation-level appointment scheduling.
- **Finance & Commission Wallet (`/agent/finance`)**: Commission ledger, payout request pipeline with instant IBAN verification.

### 3. Corporate Mobility Portal (`/corporate`)
- **Corporate Dashboard (`/corporate/dashboard`)**: Enterprise metrics, active batches, monthly relocation spend.
- **Batch Wizard (`/corporate/wizard`)**: Setup corporate visa batches for business trips, conferences, or employee relocations.
- **Employee Registry (`/corporate/employees`)**: Company employee directory with passport expiry tracking.
- **Employee Delegation (`/corporate/delegation`)**: Generate secure, single-use magic links allowing employees to upload their own personal records.
- **Corporate Finance (`/corporate/finance`)**: Proforma invoices (`INV-2026-XXXX`) and 1-click balance checkout from company credit funds.

---

## 🎨 Design System & Architecture

- **Tailwind-Free Vanilla CSS**: Built with custom CSS custom properties (design tokens in `src/shared/styles/tokens.css`).
- **Glassmorphism & Micro-animations**: Modern, sleek, dark/light balanced enterprise aesthetic with subtle elevation and smooth transitions.
- **Reusable UI Library**:
  - `Button`, `Input`, `Select`, `Modal`, `Card`, `Badge`, `Tabs`, `Table`, `Stepper`, `Spinner`, `Toast`, `StatCard`.
- **Custom Branding**: Vector-based EuroTech EU-star logo and comprehensive SVG icon pack.
- **Resilient Mock Fallbacks**: Every module gracefully falls back to interactive mock data when the backend API is offline.

---

## 📁 Directory Structure

```
front/src/
├── layouts/
│   ├── ClientLayout/            # Individual client portal layout with nav & sidebar
│   ├── AgentLayout/             # Agency portal layout with wallet balance widget
│   └── CorporateLayout/         # Corporate portal layout with batch indicators
├── modules/
│   ├── auth/                    # Multi-profile auth & profile selection
│   ├── client/                  # Client portal pages & 5-step wizard
│   ├── agent/                   # Agent portal pages & group wizard
│   └── corporate/               # Corporate portal pages, batches & delegation
└── shared/
    ├── api/                     # Typed API client with token interceptors
    ├── components/              # UI Component library & custom SVG icons
    ├── context/                 # AuthContext & ToastContext providers
    ├── hooks/                   # Custom utility hooks
    ├── styles/                  # Design tokens, reset, utilities
    ├── types/                   # TypeScript interfaces and domain types
    └── utils/                   # Formatters, validators, local storage
```

---

## 🛠 Available Scripts

In the `front/` directory, you can run:

### `npm run dev`
Runs the app in development mode at [http://localhost:5173](http://localhost:5173).

### `npm run build`
Runs TypeScript type check (`tsc -b`) and bundles the app for production using Vite into `front/dist/`.

### `npm run preview`
Locally previews the production build.
