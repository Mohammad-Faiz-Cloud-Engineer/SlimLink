process.env.PORT = '3099';
process.env.BASE_URL = 'http://test.local';
process.env.ADMIN_USERNAME = 'testadmin';
process.env.ADMIN_PASSWORD = 'testpass';
process.env.DB_PATH = './data/test_' + process.pid + '.db';
process.env.RATE_LIMIT_API_WINDOW_MS = '60000';
process.env.RATE_LIMIT_API_MAX = '1000';
process.env.RATE_LIMIT_REDIRECT_WINDOW_MS = '60000';
process.env.RATE_LIMIT_REDIRECT_MAX = '1000';

const fs = require('fs');
const path = require('path');

function cleanTestDb() {
  const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH);
  try { fs.unlinkSync(dbPath); } catch (e) { }
}

function getApp() {
  delete require.cache[require.resolve('../../src/app')];
  return require('../../src/app');
}

async function initDb() {
  cleanTestDb();
  const { initDb } = require('../../src/db/index');
  await initDb();
}

function makeAuthHeader(user, pass) {
  const b64 = Buffer.from(user + ':' + pass).toString('base64');
  return 'Basic ' + b64;
}

module.exports = { cleanTestDb, getApp, initDb, makeAuthHeader };
