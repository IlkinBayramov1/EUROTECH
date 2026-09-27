const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const errorMiddleware = require('./middlewares/error.middleware');
const telemetryMiddleware = require('./monitoring/telemetry');
const apiRoutes = require('./routes');

const compression = require('compression');

const app = express();

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

// Static Folders
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/archives', express.static(path.join(__dirname, 'archives')));

// API Routes Mounting
app.use('/api', apiRoutes);

const { getIntegrationsHealth } = require('./modules/shared/health.controller');

// Health Check Endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'EUROTECH Visa & Immigration Enterprise Backend',
    timestamp: new Date(),
  });
});

app.get('/api/health/integrations', getIntegrationsHealth);

const { metricsMiddleware, metricsService } = require('./monitoring/metrics.service');
app.use(metricsMiddleware);

// Prometheus OpenMetrics APM Endpoint
app.get('/api/metrics', async (req, res) => {
  const metrics = await metricsService.generatePrometheusMetrics();
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(metrics);
});



// Global Central Error Handler
app.use(errorMiddleware);

module.exports = app;
