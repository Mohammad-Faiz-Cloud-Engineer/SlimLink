require('dotenv').config();

if (!process.env.ADMIN_PASSWORD) {
  console.error('FATAL: ADMIN_PASSWORD not set. Copy .env.example to .env and set a secure password.');
  process.exit(1);
}

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD
  },
  rateLimit: {
    api: {
      windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS, 10) || 60000,
      max: parseInt(process.env.RATE_LIMIT_API_MAX, 10) || 100
    },
    redirect: {
      windowMs: parseInt(process.env.RATE_LIMIT_REDIRECT_WINDOW_MS, 10) || 60000,
      max: parseInt(process.env.RATE_LIMIT_REDIRECT_MAX, 10) || 1000
    }
  },
  db: {
    path: process.env.DB_PATH || './data/links.db'
  }
};

module.exports = config;
