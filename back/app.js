const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

const env = require('./config/env');
const errorMiddleware = require('./middlewares/error.middleware');
const telemetryMiddleware = require('./monitoring/telemetry');
const { metricsMiddleware, metricsService } = require('./monitoring/metrics.service');
const apiRoutes = require('./routes');
const { getIntegrationsHealth } = require('./modules/shared/health.controller');
const authMiddleware = require('./middlewares/auth.middleware');
const { requireRoles } = require('./middlewares/role.middleware');

const app = express();

// Trust reverse proxy (Nginx, Docker, Cloudflare)
app.set('trust proxy', 1);

// Gzip / Brotli HTTP Response Compression
app.use(compression({ threshold: 512 }));

// Enterprise Security Middlewares: Helmet CSP & HSTS
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://js.stripe.com'],
        frameSrc: ["'self'", 'https://js.stripe.com', 'https://hooks.stripe.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", 'https://api.stripe.com', 'https://*.eurotech.az', 'http://localhost:*', 'http://127.0.0.1:*'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

// Strict CORS Policy
const allowedOrigins = [
  'https://eurotech.az',
  'https://customer.eurotech.az',
  'https://agent.eurotech.az',
  'https://corporate.eurotech.az',
  'https://admin.eurotech.az',
];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('CORS policy: Not allowed by CORS'));
    },
    credentials: true,
    exposedHeaders: ['X-Correlation-ID', 'Content-Disposition'],
  })
);

app.use(morgan('dev'));
app.use(telemetryMiddleware);

// Metrics middleware mounted BEFORE routes so all requests are tracked
app.use(metricsMiddleware);

// HTTP Cache Headers for Static Lookup Templates
app.use('/api/v1/templates', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
  next();
});

app.use(
  express.json({
    verify: (req, res, buf) => {
      if (req.originalUrl && (req.originalUrl.includes('/webhook') || req.originalUrl.includes('/callback'))) {
        req.rawBody = buf;
      }
    },
  })
);
app.use(express.urlencoded({ extended: true }));

// Language Middleware
app.use((req, res, next) => {
  req.lang = req.headers['accept-language'] || req.query.lang || 'az';
  next();
});

// Secure static uploads & archives with cross-origin & framing support
const allowCrossOriginAssetHeaders = (allowWildcardOrigin = false) => (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  if (allowWildcardOrigin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.removeHeader('X-Frame-Options');
  next();
};

app.use(
  '/uploads',
  allowCrossOriginAssetHeaders(true),
  express.static(env.UPLOAD_DIR),
  (req, res) => {
    res.status(404).json({
      success: false,
      message: 'Physical file not found on server storage. If uploaded in another environment, please re-upload or run "npm run seed:files".',
      requestedFile: req.path,
    });
  }
);
app.use(
  '/archives',
  allowCrossOriginAssetHeaders(false),
  authMiddleware,
  requireRoles(['ADMIN', 'MANAGER', 'OPERATOR']),
  express.static(env.ARCHIVE_DIR)
);

// API Routes Mounting
app.use('/api', apiRoutes);

// Health Check Endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'EUROTECH Visa & Immigration Enterprise Backend',
    timestamp: new Date(),
  });
});

app.get('/api/health/integrations', authMiddleware, requireRoles(['ADMIN', 'MANAGER', 'OPERATOR']), getIntegrationsHealth);

// Prometheus OpenMetrics APM Endpoint (Staff only or internal monitoring)
app.get('/api/metrics', async (req, res) => {
  const metrics = await metricsService.generatePrometheusMetrics();
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(metrics);
});

// Global Central Error Handler
app.use(errorMiddleware);

module.exports = app;
