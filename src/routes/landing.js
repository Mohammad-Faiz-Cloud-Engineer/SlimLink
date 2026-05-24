const { Router } = require('express');
const { generateShortCode } = require('../utils/shortener');
const { validateUrlForm } = require('../middleware/validate');
const db = require('../db/queries');
const config = require('../config');

const router = Router();

router.get('/', (req, res) => {
  res.render('index', {
    title: 'SlimLink',
    shortUrl: null,
    error: null
  });
});

router.post('/', validateUrlForm, (req, res) => {
  if (req.urlError) {
    return res.render('index', {
      title: 'SlimLink',
      shortUrl: null,
      error: req.urlError
    });
  }

  try {
    const shortCode = generateShortCode();
    db.createLink(shortCode, req.validatedUrl);
    const shortUrl = config.baseUrl + '/' + shortCode;
    res.render('index', {
      title: 'SlimLink',
      shortUrl,
      error: null
    });
  } catch (err) {
    res.render('index', {
      title: 'SlimLink',
      shortUrl: null,
      error: err.message
    });
  }
});

module.exports = router;
