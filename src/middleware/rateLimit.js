const rateLimit = require('express-rate-limit');
const config = require('../config');

const apiLimiter = rateLimit({
  windowMs: config.rateLimit.api.windowMs,
  max: config.rateLimit.api.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
});

const redirectLimiter = rateLimit({
  windowMs: config.rateLimit.redirect.windowMs,
  max: config.rateLimit.redirect.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests. Please try again later.'
});

module.exports = { apiLimiter, redirectLimiter };
