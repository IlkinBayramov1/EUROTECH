# EUROTECH Visa & Immigration Digital Ecosystem

## Overview

EuroTech Services Platform is an enterprise digital ecosystem for multi-country visa and immigration applications. It unifies individual clients, travel agencies, corporate HR departments, and administrative back-office management.

- **Frontend Ecosystem**: Client Portals (Individual, Group Agent, Corporate HR) and Admin Dashboard
- **Backend Architecture**: Modular Monolith Node.js/Express service with Prisma ORM, PostgreSQL/MySQL database, Stripe Payment Intent integration, PDF application generator, and multi-language notification service.

## Project Structure

```
EUROTECH/
├── back/                       # Enterprise Backend Service (Node.js, Express, Prisma)
│   ├── config/                 # Environment, DB, and RBAC matrix
│   ├── core/                   # Base Controller, Service, and Repository classes
│   ├── modules/                # 8 Core Business Modules (Auth, Template, Dossier, Document, Service, Payment, Admin, Notification)
│   ├── middlewares/            # JWT, Role, Upload, and Wizard Barrier middlewares
│   ├── prisma/                 # Prisma Schema & Database Seeders
│   ├── routes/                 # Versioned REST API Routes (/api/v1/*)
│   ├── utils/                  # Code Generator, PDF Form Builder, ZIP Archiver
│   ├── i18n/                   # Multi-language translations (AZ, EN, RU)
│   └── test-all.js             # End-to-end integration test runner
└── README.md                   # Root Documentation
```

## Core Features

1. **Multi-Profile Authentication**: Individual Applicant, Tour Operator Agent, and Corporate HR profiles with OTP verification.
2. **8-Step Dynamic Wizard**: Destination selection, applicant roster management, dynamic form engine, document uploads, and add-on service selection.
3. **Operator Verification Toggles**: Back-office document approval matrix (Verified, Correction Needed, Rejected) with automated email feedback.
4. **Automated Archival & PDF Generation**: Automatic PDF application creation and document ZIP packaging upon payment confirmation.
5. **Stripe Payments & SaaS Subscriptions**: Online card payments and monthly B2B corporate subscriptions.
6. **Executive Admin Dashboard**: Operational metrics, status pipelines, and visa decision management (Approved / Rejected).

## Getting Started

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd back
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables in `back/.env`:
   ```env
   PORT=5000
   NODE_ENV=development
   DATABASE_URL="postgresql://user:password@localhost:5432/eurotech_db?schema=public"
   JWT_SECRET="your_jwt_secret"
   STRIPE_SECRET_KEY="sk_test_..."
   ```

4. Push database schema and run initial seeders:
   ```bash
   npx prisma db push
   npx prisma db seed
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Run the integration test suite:
   ```bash
   node test-all.js
   ```

## Corporate Information

EuroTech Services Kft. (Budapest) · Regional Office Baku  
Confidential — For Internal Application Use Only.
