const ApiResponse = require('../core/api.response');

const rateLimitStore = new Map();

// Clean up expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

function createHybridRateLimiter(options = {}) {
  const windowMs = options.windowMs || 15 * 60 * 1000; // 15 mins
  const max = options.max || 10;
  const message = options.message || 'Too many requests. Please try again later.';

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const account = req.body?.email || req.body?.phone || 'anonymous';
    const endpoint = req.originalUrl || req.path;
    const userAgent = req.headers['user-agent'] || 'unknown-device';

    // Composite key: IP + Account + Endpoint + Device
    const compositeKey = `${ip}:${account}:${endpoint}:${userAgent}`;
    const now = Date.now();

    let record = rateLimitStore.get(compositeKey);
    if (!record || record.resetTime < now) {
      record = { count: 1, resetTime: now + windowMs };
      rateLimitStore.set(compositeKey, record);
      return next();
    }

    record.count += 1;
    if (record.count > max) {
      console.warn(`RATE LIMIT EXCEEDED: ${compositeKey} (count: ${record.count})`);
      return ApiResponse.error(res, message, 429);
    }

    next();
  };
}

const authRateLimiter = createHybridRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5, // Max 5 login attempts per 15 minutes
  message: 'Security Alert: Maximum login attempts exceeded. Please try again after 15 minutes.',
});

const otpRateLimiter = createHybridRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 3, // Max 3 OTP requests per 5 minutes
  message: 'Security Alert: Maximum OTP requests exceeded. Please wait 5 minutes.',
});

module.exports = {
  createHybridRateLimiter,
  authRateLimiter,
  otpRateLimiter,
};
