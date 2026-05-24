const validator = require('validator');

function validateUrl(req, res, next) {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' });
  }

  const trimmed = url.trim();

  if (trimmed.length === 0) {
    return res.status(400).json({ error: 'URL is required' });
  }

  if (trimmed.length > 2048) {
    return res.status(400).json({ error: 'URL exceeds maximum length of 2048 characters' });
  }

  if (!validator.isURL(trimmed, { require_protocol: true, protocols: ['http', 'https'] })) {
    return res.status(400).json({ error: 'Invalid URL. Must be a valid http or https URL.' });
  }

  req.validatedUrl = trimmed;
  next();
}

function validateUrlForm(req, res, next) {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    req.urlError = 'URL is required';
    return next();
  }

  const trimmed = url.trim();

  if (trimmed.length === 0) {
    req.urlError = 'URL is required';
    return next();
  }

  if (trimmed.length > 2048) {
    req.urlError = 'URL exceeds maximum length of 2048 characters';
    return next();
  }

  if (!validator.isURL(trimmed, { require_protocol: true, protocols: ['http', 'https'] })) {
    req.urlError = 'Invalid URL. Must be a valid http or https URL.';
    return next();
  }

  req.validatedUrl = trimmed;
  next();
}

module.exports = { validateUrl, validateUrlForm };
