const express = require('express');
const router = express.Router();
const v1Router = require('./v1');

router.use('/v1', v1Router);

// Forward top-level /api endpoints for backward compatibility
router.use('/', v1Router);

module.exports = router;
