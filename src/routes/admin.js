const { Router } = require('express');
const db = require('../db/queries');
const { adminAuth } = require('../middleware/auth');
const { generateShortCode } = require('../utils/shortener');
const { validateUrlForm } = require('../middleware/validate');
const config = require('../config');

const router = Router();

router.use(adminAuth);

router.get('/', (req, res) => {
  const totalLinks = db.getTotalLinks();
  const totalClicks = db.getTotalClicks();
  const recentClicks = db.getRecentClicks(10);

  res.render('admin/dashboard', {
    title: 'Dashboard',
    totalLinks: totalLinks.count,
    totalClicks: totalClicks.total,
    recentClicks
  });
});

router.get('/links', (req, res) => {
  const links = db.getAllLinks();
  res.render('admin/links', {
    title: 'Manage Links',
    links,
    baseUrl: config.baseUrl,
    error: null,
    success: null
  });
});

router.post('/links', validateUrlForm, (req, res) => {
  if (req.urlError) {
    const links = db.getAllLinks();
    return res.status(400).render('admin/links', {
      title: 'Manage Links',
      links,
      baseUrl: config.baseUrl,
      error: req.urlError,
      success: null
    });
  }

  try {
    const shortCode = generateShortCode();
    db.createLink(shortCode, req.validatedUrl);
    const links = db.getAllLinks();
    res.render('admin/links', {
      title: 'Manage Links',
      links,
      baseUrl: config.baseUrl,
      error: null,
      success: 'Link created: ' + config.baseUrl + '/' + shortCode
    });
  } catch (err) {
    const links = db.getAllLinks();
    res.status(500).render('admin/links', {
      title: 'Manage Links',
      links,
      baseUrl: config.baseUrl,
      error: 'Failed to create link: ' + err.message,
      success: null
    });
  }
});

router.get('/links/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).send('Invalid link ID');

  const link = db.findLinkById(id);
  if (!link) return res.status(404).send('Link not found');

  const perPage = 50;
  const totalResult = db.getClickCountByLinkId(id);
  const totalPages = Math.ceil(totalResult.count / perPage) || 1;
  const page = Math.min(Math.max(1, parseInt(req.query.page, 10) || 1), totalPages);
  const offset = (page - 1) * perPage;
  const clicks = db.getClicksByLinkId(id, perPage, offset);

  res.render('admin/link-detail', {
    title: 'Link: ' + link.short_code,
    link,
    clicks,
    baseUrl: config.baseUrl,
    page,
    totalPages
  });
});

router.post('/links/:id/delete', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).send('Invalid link ID');

  try {
    db.deleteLink(id);
    res.redirect('/admin/links');
  } catch (err) {
    res.status(500).send('Failed to delete link');
  }
});

module.exports = router;
