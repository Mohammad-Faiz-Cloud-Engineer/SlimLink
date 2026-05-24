const { Router } = require('express');
const { generateShortCode } = require('../utils/shortener');
const { validateUrlForm } = require('../middleware/validate');
const db = require('../db/queries');
const config = require('../config');

const router = Router();

router.get('/', (req, res) => {
  let shortUrl = null;
  if (req.query.code) {
    const link = db.findLinkByCode(req.query.code);
    if (link) shortUrl = config.baseUrl + '/' + link.short_code;
  }
  res.render('index', {
    title: 'SlimLink',
    shortUrl,
    error: req.query.error || null
  });
});

router.post('/', validateUrlForm, (req, res) => {
  if (req.urlError) {
    return res.redirect('/?error=' + encodeURIComponent(req.urlError));
  }

  try {
    const shortCode = generateShortCode();
    db.createLink(shortCode, req.validatedUrl);
    res.redirect('/?code=' + shortCode);
  } catch (err) {
    res.redirect('/?error=' + encodeURIComponent(err.message));
  }
});

module.exports = router;
