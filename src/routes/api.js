const { Router } = require('express');
const db = require('../db/queries');
const { generateShortCode } = require('../utils/shortener');
const { validateUrl } = require('../middleware/validate');
const config = require('../config');

const router = Router();

router.post('/shorten', validateUrl, (req, res) => {
  try {
    const shortCode = generateShortCode();
    db.createLink(shortCode, req.validatedUrl);

    res.status(201).json({
      short_url: config.baseUrl + '/' + shortCode,
      short_code: shortCode,
      original_url: req.validatedUrl
    });
  } catch (err) {
    console.error('Shorten error:', err.message);
    res.status(500).json({ error: 'Failed to create short link' });
  }
});

module.exports = router;
