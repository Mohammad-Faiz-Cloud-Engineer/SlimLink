const basicAuth = require('basic-auth');
const config = require('../config');

function adminAuth(req, res, next) {
  const credentials = basicAuth(req);

  if (!credentials ||
      credentials.name !== config.admin.username ||
      credentials.pass !== config.admin.password) {
    res.set('WWW-Authenticate', 'Basic realm="SlimLink Admin"');
    return res.status(401).render('login', { title: 'Admin Login' });
  }

  next();
}

module.exports = { adminAuth };
