# EUROTECH Visa & Immigration Platform — Backend Architecture

## Overview

EuroTech Services Backend is an enterprise-grade digital platform designed for handling multi-country visa and immigration services. The system provides a unified ecosystem for individual applicants, tour operators, corporate clients, and administrative managers. Built on a Modular Monolith architecture, it ensures scalability, security, clean domain separation, and auditability.

## Technology Stack

- **Runtime**: Node.js (v22+)
- **Framework**: Express.js
- **Database & ORM**: PostgreSQL / MySQL with Prisma ORM (v5+)
- **Authentication**: JSON Web Tokens (JWT) with Role-Based Access Control (RBAC)
- **Payment Processing**: Stripe API with Webhook verification
- **File & Document Processing**: Multer, PDF-Lib, Archiver (ZIP generation)
- **Notifications**: Nodemailer with HTML templates
- **API Architecture**: RESTful API with unified response formats and centralized error handling

## Architecture Structure

```
back/
├── server.js                   # Entry point for HTTP server
├── app.js                      # Express configuration & global middleware
├── config/                     # System-wide environment & DB configurations
│   ├── env.js                  # Centralized environment variable reader
│   ├── db.js                   # Prisma Client singleton
│   ├── permissions.js          # Role-Based Access Control (RBAC) matrix
│   └── constants.js            # Financial and service rate constants
├── core/                       # Base OOP classes & standardized handlers
│   ├── base.controller.js
│   ├── base.service.js
│   ├── base.repository.js
│   ├── api.error.js
│   └── api.response.js
├── prisma/                     # Database schemas and seeders
│   ├── schema.prisma
│   └── seed.js
├── modules/                    # Business modules (Modular Monolith)
│   ├── auth/                   # Registration, login, OTP verification
│   ├── template/               # Countries, visa categories, 8-step engine
│   ├── dossier/                # Dossier management & applicant rosters
│   ├── document/               # File uploads, operator verification toggles
│   ├── service/                # Add-on services (Express, Insurance, Courier)
│   ├── payment/                # Stripe Intents, subscriptions, receipts
│   ├── admin/                  # Dashboard metrics, decisions, review pipeline
│   └── notification/           # Multi-language HTML email notification service
├── routes/                     # Centralized API routing layer
│   ├── index.js
│   └── v1/
├── middlewares/                # Custom Express middlewares
│   ├── auth.middleware.js
│   ├── role.middleware.js
│   ├── wizardBarrier.middleware.js
│   ├── upload.middleware.js
│   ├── validate.middleware.js
│   └── error.middleware.js
├── webhooks/                   # Webhook integration handlers
│   └── stripe.webhook.js
└── utils/                      # Helper utilities
    ├── jwt.util.js
    ├── hash.util.js
    ├── email.util.js
    ├── dossierCode.util.js
    ├── pdf.util.js
    └── zip.util.js
```

## Modules Summary

1. **Auth Module**: Registration, login, OTP verification, and JWT issuance for Individual, Agent, and Corporate HR profiles.
2. **Template Module**: Country listings, visa category schemas, and 8-step wizard form definitions.
3. **Dossier Module**: Dossier creation, applicant roster management, and wizard step navigation.
4. **Document Module**: Mandatory document uploads, operator verification toggles, and re-upload requests.
5. **Service Module**: Optional add-on services including express processing, health insurance, apostille, and courier delivery.
6. **Payment Module**: Stripe payment intent creation, webhook processing, PDF form generation, and ZIP archival.
7. **Admin Module**: Executive dashboard metrics, dossier review queue, status transitions, and visa approval decisions.
8. **Notification Module**: Multi-language HTML email delivery for OTPs, dossier submissions, correction requests, and final decisions.

## Installation & Setup

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL or MySQL database instance
- NPM or YARN package manager

### Environment Configuration

Create a `.env` file in the root directory of the backend with the following variables:

```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://user:password@localhost:5432/eurotech_db?schema=public"
JWT_SECRET="your_secure_jwt_secret"
JWT_EXPIRES_IN="7d"
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your_email@gmail.com"
SMTP_PASS="your_app_password"
UPLOAD_DIR="./uploads"
ARCHIVE_DIR="./archives"
```

### Steps

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run database migrations / synchronization:
   ```bash
   npx prisma db push
   ```

3. Seed initial database records:
   ```bash
   npx prisma db seed
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## API Documentation

- **Health Check**: `GET /api/health`
- **Auth Routes**: `/api/v1/auth/*`
- **Templates**: `/api/v1/templates/*`
- **Dossiers**: `/api/v1/dossiers/*`
- **Documents**: `/api/v1/documents/*`
- **Services**: `/api/v1/services/*`
- **Payments**: `/api/v1/payments/*`
- **Admin**: `/api/v1/admin/*`

## Verification & Testing

An end-to-end integration test runner is available to verify all 8 modules:

```bash
node test-all.js
```

## Corporate Notice

EuroTech Services Kft. (Budapest) · Regional Office Baku  
Confidential — For Internal Application Use Only.
