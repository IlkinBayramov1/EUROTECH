const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const errorMiddleware = require('./middlewares/error.middleware');
const apiRoutes = require('./routes');

const app = express();

// Global Security & Logging Middlewares
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
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

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'EUROTECH Visa & Immigration Enterprise Backend',
    timestamp: new Date(),
  });
});

// Global Central Error Handler
app.use(errorMiddleware);

module.exports = app;
