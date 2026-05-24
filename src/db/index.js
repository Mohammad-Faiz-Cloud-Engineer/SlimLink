const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const config = require('../config');

let state = null;

function getDb() {
  if (!state) throw new Error('Database not initialized');
  return state;
}

async function initDb() {
  const SQL = await initSqlJs();

  const dbDir = path.dirname(config.db.path);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  let db;
  if (fs.existsSync(config.db.path)) {
    db = new SQL.Database(fs.readFileSync(config.db.path));
  } else {
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    short_code TEXT NOT NULL UNIQUE,
    original_url TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    clicks INTEGER NOT NULL DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS clicks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id INTEGER NOT NULL,
    ip TEXT,
    user_agent TEXT,
    referrer TEXT,
    country TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
  )`);

  db.run('CREATE INDEX IF NOT EXISTS idx_links_short_code ON links(short_code)');
  db.run('CREATE INDEX IF NOT EXISTS idx_clicks_link_id ON clicks(link_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_clicks_created_at ON clicks(created_at)');

  const migrations = [
    "ALTER TABLE clicks ADD COLUMN browser TEXT",
    "ALTER TABLE clicks ADD COLUMN os TEXT",
    "ALTER TABLE clicks ADD COLUMN device_type TEXT",
    "ALTER TABLE clicks ADD COLUMN device_vendor TEXT",
    "ALTER TABLE clicks ADD COLUMN device_model TEXT",
    "ALTER TABLE clicks ADD COLUMN isp TEXT"
  ];
  for (const sql of migrations) {
    try { db.run(sql); } catch (e) { /* column exists */ }
  }

  function save() {
    fs.writeFileSync(config.db.path, Buffer.from(db.export()));
  }

  state = { db, save };
  return state;
}

module.exports = { initDb, getDb };
