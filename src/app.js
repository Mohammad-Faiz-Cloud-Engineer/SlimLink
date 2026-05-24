const express = require('express');
const path = require('path');
const helmet = require('helmet');
const { apiLimiter, redirectLimiter } = require('./middleware/rateLimit');

const landingRoutes = require('./routes/landing');
const redirectRoutes = require('./routes/redirect');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.locals.fmtDate = function fmtDate(d) {
  if (!d) return '-';
  var dt = new Date(d.replace(' ', 'T') + 'Z');
  if (isNaN(dt.getTime())) return d;
  var dd = String(dt.getDate()).padStart(2, '0');
  var mm = String(dt.getMonth() + 1).padStart(2, '0');
  var yyyy = dt.getFullYear();
  var h = dt.getHours();
  var m = String(dt.getMinutes()).padStart(2, '0');
  var ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return dd + '/' + mm + '/' + yyyy + ' ' + h + ':' + m + ' ' + ampm;
};

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/api', apiLimiter, apiRoutes);
app.use('/admin', adminRoutes);
app.use('/', landingRoutes);
app.use('/', redirectLimiter, redirectRoutes);

app.use((req, res) => {
  res.status(404).render('404', { title: 'Not Found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).send('Internal server error');
});

module.exports = app;
