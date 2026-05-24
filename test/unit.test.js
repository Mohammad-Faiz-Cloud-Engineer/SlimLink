const { describe, it, before } = require('node:test');
const assert = require('node:assert');

before(() => {
  process.env.PORT = '3099';
  process.env.BASE_URL = 'http://test.local';
  process.env.ADMIN_USERNAME = 'testadmin';
  process.env.ADMIN_PASSWORD = 'testpass';
  process.env.DB_PATH = './data/test_unit_' + process.pid + '.db';
});

describe('Utils: shortener', () => {
  it('generateShortCode returns a 7-character string', async () => {
    const { initDb } = require('../src/db/index');
    const helper = require('./lib/helper.cjs');
    helper.cleanTestDb();
    await initDb();
    const { generateShortCode } = require('../src/utils/shortener');
    const code = generateShortCode();
    assert.ok(typeof code === 'string', 'code should be a string');
    assert.strictEqual(code.length, 7, 'code should be 7 chars');
    assert.ok(/^[A-Za-z0-9_-]+$/.test(code), 'code uses only URL-safe chars');
  });

  it('generateShortCode produces unique codes', async () => {
    const shortener = require('../src/utils/shortener');
    const codes = new Set();
    for (let i = 0; i < 50; i++) {
      const code = shortener.generateShortCode();
      assert.ok(!codes.has(code), 'duplicate short code generated');
      codes.add(code);
    }
  });
});

describe('Utils: tracker', () => {
  it('getClientIP returns x-forwarded-for when present', () => {
    const tracker = require('../src/utils/tracker');
    const req = { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }, ip: '192.168.1.1' };
    assert.strictEqual(tracker.getClientIP(req), '1.2.3.4');
  });

  it('getClientIP falls back to req.ip', () => {
    const tracker = require('../src/utils/tracker');
    const req = { headers: {}, ip: '10.0.0.1' };
    assert.strictEqual(tracker.getClientIP(req), '10.0.0.1');
  });

  it('getClientIP returns "unknown" when no IP available', () => {
    const tracker = require('../src/utils/tracker');
    const req = { headers: {}, socket: {} };
    assert.strictEqual(tracker.getClientIP(req), 'unknown');
  });

  it('parseUA returns browser, os, device info', () => {
    const tracker = require('../src/utils/tracker');
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';
    const result = tracker.parseUA(ua);
    assert.ok(result.browser.includes('Chrome'), 'browser should include Chrome');
    assert.ok(result.os.includes('Windows'), 'OS should include Windows');
    assert.strictEqual(result.deviceType, null, 'desktop should have null deviceType');
  });

  it('parseUA detects mobile device', () => {
    const tracker = require('../src/utils/tracker');
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
    const result = tracker.parseUA(ua);
    assert.strictEqual(result.deviceType, 'mobile', 'iPhone should be mobile');
    assert.ok(result.os.includes('iOS'), 'OS should include iOS');
  });

  it('parseUA returns nulls for empty user agent', () => {
    const tracker = require('../src/utils/tracker');
    const result = tracker.parseUA('');
    assert.strictEqual(result.browser, null);
    assert.strictEqual(result.os, null);
    assert.strictEqual(result.deviceType, null);
  });

  it('isPrivateIP detects 10.x.x.x ranges', () => {
    const tracker = require('../src/utils/tracker');
    assert.ok(tracker.isPrivateIP('10.0.0.1'));
    assert.ok(tracker.isPrivateIP('172.16.0.1'));
    assert.ok(tracker.isPrivateIP('192.168.1.1'));
    assert.ok(tracker.isPrivateIP('127.0.0.1'));
    assert.ok(tracker.isPrivateIP('::1'));
  });

  it('isPrivateIP returns false for public IPs', () => {
    const tracker = require('../src/utils/tracker');
    assert.ok(!tracker.isPrivateIP('8.8.8.8'));
    assert.ok(!tracker.isPrivateIP('1.1.1.1'));
    assert.ok(!tracker.isPrivateIP('203.0.113.1'));
  });

  it('getCountry returns null for localhost', () => {
    const tracker = require('../src/utils/tracker');
    assert.strictEqual(tracker.getCountry('127.0.0.1'), null);
    assert.strictEqual(tracker.getCountry('::1'), null);
  });

  it('lookupISP returns null for private IPs (no network call)', async () => {
    const tracker = require('../src/utils/tracker');
    const isp = await tracker.lookupISP('10.0.0.1');
    assert.strictEqual(isp, null);
  });
});

describe('Middleware: validation', () => {
  it('validateUrl rejects missing URL', () => {
    const { validateUrl } = require('../src/middleware/validate');
    const req = { body: {} };
    const res = { status: function(c) { this.code = c; return this; }, json: function(o) { this.body = o; } };
    validateUrl(req, res, () => {});
    assert.strictEqual(res.code, 400);
    assert.ok(res.body.error.includes('required'));
  });

  it('validateUrl rejects empty URL', () => {
    const { validateUrl } = require('../src/middleware/validate');
    const req = { body: { url: '   ' } };
    const res = { status: function(c) { this.code = c; return this; }, json: function(o) { this.body = o; } };
    validateUrl(req, res, () => {});
    assert.strictEqual(res.code, 400);
  });

  it('validateUrl rejects invalid URL', () => {
    const { validateUrl } = require('../src/middleware/validate');
    const req = { body: { url: 'not-a-url' } };
    const res = { status: function(c) { this.code = c; return this; }, json: function(o) { this.body = o; } };
    validateUrl(req, res, () => {});
    assert.strictEqual(res.code, 400);
  });

  it('validateUrl rejects URL without protocol', () => {
    const { validateUrl } = require('../src/middleware/validate');
    const req = { body: { url: 'example.com/test' } };
    const res = { status: function(c) { this.code = c; return this; }, json: function(o) { this.body = o; } };
    validateUrl(req, res, () => {});
    assert.strictEqual(res.code, 400);
  });

  it('validateUrl rejects overly long URL', () => {
    const { validateUrl } = require('../src/middleware/validate');
    const req = { body: { url: 'https://x.com/' + 'a'.repeat(2048) } };
    const res = { status: function(c) { this.code = c; return this; }, json: function(o) { this.body = o; } };
    validateUrl(req, res, () => {});
    assert.strictEqual(res.code, 400);
  });

  it('validateUrl accepts valid http URL', () => {
    const { validateUrl } = require('../src/middleware/validate');
    const req = { body: { url: 'http://example.com' } };
    let nextCalled = false;
    const res = { status: function() { return this; }, json: function() {} };
    validateUrl(req, res, () => { nextCalled = true; });
    assert.ok(nextCalled, 'next() should be called');
    assert.strictEqual(req.validatedUrl, 'http://example.com');
  });

  it('validateUrl accepts valid https URL', () => {
    const { validateUrl } = require('../src/middleware/validate');
    const req = { body: { url: 'https://example.com/path?q=1' } };
    let nextCalled = false;
    const res = { status: function() { return this; }, json: function() {} };
    validateUrl(req, res, () => { nextCalled = true; });
    assert.ok(nextCalled);
    assert.strictEqual(req.validatedUrl, 'https://example.com/path?q=1');
  });

  it('validateUrlForm sets req.urlError on missing URL', () => {
    const { validateUrlForm } = require('../src/middleware/validate');
    const req = { body: {} };
    validateUrlForm(req, {}, () => {});
    assert.ok(req.urlError);
  });

  it('validateUrlForm accepts valid URL', () => {
    const { validateUrlForm } = require('../src/middleware/validate');
    const req = { body: { url: 'https://example.com' } };
    validateUrlForm(req, {}, () => {});
    assert.ok(!req.urlError);
    assert.strictEqual(req.validatedUrl, 'https://example.com');
  });
});

describe('Middleware: auth', () => {
  it('adminAuth rejects missing credentials', () => {
    const { adminAuth } = require('../src/middleware/auth');
    const req = { headers: {} };
    const res = {
      code: 0, headers: {},
      set: function(k, v) { this.headers[k] = v; },
      status: function(c) { this.code = c; return this; },
      render: function() {}
    };
    adminAuth(req, res, () => {});
    assert.strictEqual(res.code, 401);
    assert.ok(res.headers['WWW-Authenticate']);
  });

  it('adminAuth rejects wrong password', () => {
    const { adminAuth } = require('../src/middleware/auth');
    const req = { headers: { authorization: 'Basic ' + Buffer.from('testadmin:wrongpass').toString('base64') } };
    const res = {
      code: 0, headers: {},
      set: function(k, v) { this.headers[k] = v; },
      status: function(c) { this.code = c; return this; },
      render: function() {}
    };
    adminAuth(req, res, () => {});
    assert.strictEqual(res.code, 401);
  });

  it('adminAuth accepts correct credentials', () => {
    const { adminAuth } = require('../src/middleware/auth');
    const req = { headers: { authorization: 'Basic ' + Buffer.from('testadmin:testpass').toString('base64') } };
    let nextCalled = false;
    const res = {
      set: function() {}, status: function() { return this; }, render: function() {}
    };
    adminAuth(req, res, () => { nextCalled = true; });
    assert.ok(nextCalled);
  });
});

describe('Middleware: rate limiting', () => {
  it('rateLimit module exports both limiters', () => {
    const { apiLimiter, redirectLimiter } = require('../src/middleware/rateLimit');
    assert.ok(typeof apiLimiter === 'function', 'apiLimiter should be a function');
    assert.ok(typeof redirectLimiter === 'function', 'redirectLimiter should be a function');
  });
});

describe('Config', () => {
  it('config loads with correct env values', () => {
    const config = require('../src/config');
    assert.strictEqual(config.port, 3099);
    assert.strictEqual(config.baseUrl, 'http://test.local');
    assert.strictEqual(config.admin.username, 'testadmin');
    assert.strictEqual(config.admin.password, 'testpass');
    assert.ok(typeof config.rateLimit.api.windowMs === 'number');
    assert.ok(typeof config.rateLimit.api.max === 'number');
    assert.ok(typeof config.rateLimit.redirect.windowMs === 'number');
    assert.ok(typeof config.rateLimit.redirect.max === 'number');
  });
});
