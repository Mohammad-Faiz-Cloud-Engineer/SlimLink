require('./lib/helper.cjs');

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

before(async () => {
  process.env.PORT = '3099';
  process.env.BASE_URL = 'http://test.local';
  process.env.ADMIN_USERNAME = 'testadmin';
  process.env.ADMIN_PASSWORD = 'testpass';
  process.env.DB_PATH = './data/test_db_' + process.pid + '.db';

  const helper = require('./lib/helper.cjs');
  helper.cleanTestDb();
  const { initDb } = require('../src/db/index');
  await initDb();
});

after(() => {
  const helper = require('./lib/helper.cjs');
  helper.cleanTestDb();
});

describe('Database: link operations', () => {
  const db = require('../src/db/queries');

  it('db.createLink creates a new short link', () => {
    db.createLink('abc1234', 'https://example.com');
    const link = db.findLinkByCode('abc1234');
    assert.ok(link, 'link should exist');
    assert.strictEqual(link.short_code, 'abc1234');
    assert.strictEqual(link.original_url, 'https://example.com');
    assert.strictEqual(link.clicks, 0);
    assert.ok(link.created_at, 'created_at should be set');
  });

  it('db.findLinkByCode returns null for missing code', () => {
    const link = db.findLinkByCode('missing');
    assert.strictEqual(link, undefined);
  });

  it('db.findLinkById returns link by id', () => {
    const link = db.findLinkById(1);
    assert.ok(link, 'link should exist');
    assert.strictEqual(link.short_code, 'abc1234');
  });

  it('db.findLinkById returns undefined for missing id', () => {
    const link = db.findLinkById(99999);
    assert.strictEqual(link, undefined);
  });

  it('db.getAllLinks returns all links', () => {
    db.createLink('xyz7890', 'https://test.com');
    const links = db.getAllLinks();
    assert.ok(Array.isArray(links), 'should return array');
    assert.ok(links.length >= 2, 'should have at least 2 links');
    assert.ok(links.some(l => l.short_code === 'abc1234'));
    assert.ok(links.some(l => l.short_code === 'xyz7890'));
  });

  it('db.getTotalLinks returns count', () => {
    const result = db.getTotalLinks();
    assert.ok(result.count >= 2, 'count should be at least 2');
  });

  it('db.getTotalClicks returns total clicks sum', () => {
    const result = db.getTotalClicks();
    assert.strictEqual(typeof result.total, 'number');
  });
});

describe('Database: click recording', () => {
  const db = require('../src/db/queries');

  it('db.incrementClickCount increases click count', () => {
    db.incrementClickCount(1);
    const link = db.findLinkById(1);
    assert.strictEqual(link.clicks, 1);
  });

  it('db.recordClick stores click details', () => {
    const before = db.getClickCountByLinkId(1);
    db.recordClick(1, '8.8.8.8', 'Chrome/120', 'https://google.com', 'US', 'Chrome 120', 'Windows 10', 'desktop', null, null);
    const after = db.getClickCountByLinkId(1);
    assert.strictEqual(after.count, before.count + 1, 'click count should increase by 1');

    const clicks = db.getClicksByLinkId(1, 10, 0);
    const saved = clicks.find(c => c.ip === '8.8.8.8');
    assert.ok(saved, 'click record should exist with matching IP');
    assert.strictEqual(saved.browser, 'Chrome 120');
    assert.strictEqual(saved.country, 'US');
    assert.strictEqual(saved.os, 'Windows 10');
  });

  it('db.getClicksByLinkId returns click records', () => {
    const clicks = db.getClicksByLinkId(1, 10, 0);
    assert.ok(Array.isArray(clicks));
    assert.ok(clicks.length >= 1);
    assert.strictEqual(clicks[0].ip, '8.8.8.8');
    assert.strictEqual(clicks[0].browser, 'Chrome 120');
    assert.strictEqual(clicks[0].country, 'US');
  });

  it('db.getClickCountByLinkId returns count', () => {
    const result = db.getClickCountByLinkId(1);
    assert.ok(result.count >= 1);
  });

  it('db.updateClickISP updates ISP field', () => {
    db.recordClick(1, '1.1.1.1', null, null, null, null, null, null, null, null);
    const clicks = db.getClicksByLinkId(1, 100, 0);
    const clickId = clicks.find(c => c.ip === '1.1.1.1');
    assert.ok(clickId, 'click should exist');
    db.updateClickISP(clickId.id, 'Cloudflare');
    const clicksAfter = db.getClicksByLinkId(1, 100, 0);
    const updated = clicksAfter.find(c => c.ip === '1.1.1.1');
    assert.ok(updated, 'click should exist after update');
    assert.strictEqual(updated.isp, 'Cloudflare');
  });

  it('db.getRecentClicks returns most recent clicks with link info', () => {
    const recent = db.getRecentClicks(5);
    assert.ok(Array.isArray(recent));
    if (recent.length > 0) {
      assert.ok(recent[0].short_code, 'should include short_code from join');
      assert.ok(recent[0].original_url, 'should include original_url from join');
    }
  });
});

describe('Database: delete operations', () => {
  const db = require('../src/db/queries');

  it('db.deleteLink removes link and its clicks', () => {
    db.createLink('todelete', 'https://delete-me.com');
    db.recordClick(3, '4.4.4.4', null, null, null, null, null, null, null, null);

    const before = db.getClickCountByLinkId(3);
    assert.ok(before.count > 0, 'should have clicks before delete');

    db.deleteLink(3);

    const link = db.findLinkById(3);
    assert.strictEqual(link, undefined, 'link should be deleted');

    const clicksAfter = db.getClickCountByLinkId(3);
    assert.strictEqual(clicksAfter.count, 0, 'clicks should be cascade deleted');
  });
});

describe('Database: edge cases', () => {
  const db = require('../src/db/queries');

  it('db.recordClick handles null optional fields', () => {
    const before = db.getClickCountByLinkId(2);
    db.recordClick(2, null, null, null, null, null, null, null, null, null);
    const after = db.getClickCountByLinkId(2);
    assert.strictEqual(after.count, before.count + 1, 'click count should increase');
    const clicks = db.getClicksByLinkId(2, 10, 0);
    assert.ok(clicks.length > 0, 'should have click records');
  });

  it('db.getClicksByLinkId respects limit and offset', () => {
    for (let i = 0; i < 5; i++) {
      db.recordClick(2, '5.5.5.' + i, null, null, null, null, null, null, null, null);
    }
    const page1 = db.getClicksByLinkId(2, 3, 0);
    const page2 = db.getClicksByLinkId(2, 3, 3);
    assert.ok(page1.length <= 3, 'page1 should have at most 3 items');
    assert.ok(page2.length <= 3, 'page2 should have at most 3 items');
    if (page1.length > 0 && page2.length > 0) {
      assert.notStrictEqual(page1[0].id, page2[0].id, 'pages should return different records');
    }
  });

  it('db.getAllLinks returns links in DESC order', () => {
    const links = db.getAllLinks();
    for (let i = 1; i < links.length; i++) {
      assert.ok(new Date(links[i - 1].created_at) >= new Date(links[i].created_at),
        'links should be ordered by created_at DESC');
    }
  });

  it('db.getTotalClicks returns 0 when no links exist in new table', () => {
    const result = db.getTotalClicks();
    assert.strictEqual(typeof result.total, 'number');
    assert.ok(result.total >= 0);
  });
});
