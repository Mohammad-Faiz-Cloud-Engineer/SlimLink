const { Router } = require('express');
const db = require('../db/queries');
const tracker = require('../utils/tracker');

const router = Router();

router.get('/:code', function(req, res) {
  const code = req.params.code;

  if (!code || code.length > 100) {
    return res.status(404).render('404', { title: 'Not Found' });
  }

  const link = db.findLinkByCode(code);

  if (!link) {
    return res.status(404).render('404', { title: 'Not Found' });
  }

  const ip = tracker.getClientIP(req);
  const country = tracker.getCountry(ip);
  const userAgent = req.headers['user-agent'] || null;
  const referrer = req.headers['referer'] || null;
  const device = tracker.parseUA(userAgent);

  try {
    db.incrementClickCount(link.id);
    let clickId = db.recordClick(
      link.id, ip, userAgent, referrer, country,
      device.browser, device.os, device.deviceType,
      device.deviceVendor, device.deviceModel
    );

    res.redirect(301, link.original_url);

    if (ip && !tracker.isPrivateIP(ip)) {
      tracker.lookupISP(ip).then(function(isp) {
        if (isp) db.updateClickISP(clickId, isp);
      }).catch(function(err) { console.error('ISP lookup failed:', err.message); });
    }
  } catch (err) {
    console.error('Click tracking error:', err.message);
    if (!res.headersSent) res.redirect(301, link.original_url);
  }
});

module.exports = router;
