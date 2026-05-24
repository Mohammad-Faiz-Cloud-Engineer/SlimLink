const { getDb } = require('./index');

function findLinkByCode(shortCode) {
  const { db } = getDb();
  const stmt = db.prepare('SELECT * FROM links WHERE short_code = ?');
  stmt.bind([shortCode]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
}

function findLinkById(id) {
  const { db } = getDb();
  const stmt = db.prepare('SELECT * FROM links WHERE id = ?');
  stmt.bind([id]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
}

function getAllLinks() {
  const { db } = getDb();
  const stmt = db.prepare('SELECT * FROM links ORDER BY created_at DESC');
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function createLink(shortCode, originalUrl) {
  const { db, save } = getDb();
  db.run('INSERT INTO links (short_code, original_url) VALUES (?, ?)', [shortCode, originalUrl]);
  save();
}

function getTotalLinks() {
  const { db } = getDb();
  const stmt = db.prepare('SELECT COUNT(*) as count FROM links');
  stmt.step();
  const row = stmt.getAsObject();
  stmt.free();
  return row;
}

function getTotalClicks() {
  const { db } = getDb();
  const stmt = db.prepare('SELECT COALESCE(SUM(clicks), 0) as total FROM links');
  stmt.step();
  const row = stmt.getAsObject();
  stmt.free();
  return row;
}

function incrementClickCount(linkId) {
  const { db, save } = getDb();
  db.run('UPDATE links SET clicks = clicks + 1 WHERE id = ?', [linkId]);
  save();
}

function recordClick(linkId, ip, userAgent, referrer, country, browser, os, deviceType, deviceVendor, deviceModel) {
  const { db, save } = getDb();
  db.run(
    'INSERT INTO clicks (link_id, ip, user_agent, referrer, country, browser, os, device_type, device_vendor, device_model) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [linkId, ip, userAgent, referrer, country, browser, os, deviceType, deviceVendor, deviceModel]
  );
  save();
  const result = db.exec('SELECT last_insert_rowid()');
  return result[0].values[0][0];
}

function updateClickISP(clickId, isp) {
  const { db, save } = getDb();
  db.run('UPDATE clicks SET isp = ? WHERE id = ?', [isp, clickId]);
  save();
}

function getClicksByLinkId(linkId, limit, offset) {
  const { db } = getDb();
  const stmt = db.prepare('SELECT * FROM clicks WHERE link_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?');
  stmt.bind([linkId, limit, offset]);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function getClickCountByLinkId(linkId) {
  const { db } = getDb();
  const stmt = db.prepare('SELECT COUNT(*) as count FROM clicks WHERE link_id = ?');
  stmt.bind([linkId]);
  stmt.step();
  const row = stmt.getAsObject();
  stmt.free();
  return row;
}

function deleteLink(id) {
  const { db, save } = getDb();
  db.run('DELETE FROM clicks WHERE link_id = ?', [id]);
  db.run('DELETE FROM links WHERE id = ?', [id]);
  save();
}

function getRecentClicks(limit) {
  const { db } = getDb();
  const stmt = db.prepare(
    'SELECT c.*, l.short_code, l.original_url FROM clicks c JOIN links l ON c.link_id = l.id ORDER BY c.created_at DESC LIMIT ?'
  );
  stmt.bind([limit]);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

module.exports = {
  createLink, findLinkByCode, findLinkById, getAllLinks,
  getTotalLinks, getTotalClicks, incrementClickCount, recordClick, updateClickISP,
  getClicksByLinkId, getClickCountByLinkId, deleteLink, getRecentClicks
};
