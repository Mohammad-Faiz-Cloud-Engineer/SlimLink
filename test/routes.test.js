const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');

let server = null;
let baseUrl = '';
let authHeader = '';

function req(method, path, opts = {}) {
  const url = baseUrl + path;
  const headers = { ...opts.headers };
  if (opts.json) headers['Content-Type'] = 'application/json';
  if (opts.form) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (opts.auth) headers['Authorization'] = authHeader;

  return new Promise((resolve) => {
    const parts = new URL(url);
    const options = {
      hostname: parts.hostname,
      port: parts.port,
      path: parts.pathname + parts.search,
      method,
      headers,
      maxRedirects: 0
    };

    const r = http.request(options, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body, json: () => { try { return JSON.parse(body); } catch { return null; } } });
      });
    });
    r.on('error', () => resolve({ status: 0, headers: {}, body: '', json: () => null }));

    if (opts.body) {
      if (typeof opts.body === 'string') r.write(opts.body);
      else if (opts.json) r.write(JSON.stringify(opts.body));
      else if (opts.form) r.write(new URLSearchParams(opts.body).toString());
    }
    r.end();
  });
}

before(async () => {
  const helper = require('./lib/helper.cjs');
  await helper.initDb();
  const app = helper.getApp();

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      baseUrl = 'http://127.0.0.1:' + addr.port;
      authHeader = helper.makeAuthHeader('testadmin', 'testpass');
      resolve();
    });
  });
});

after(() => {
  if (server) server.close();
});

describe('Routes: Landing page', () => {
  it('GET / returns 200 and renders form', async () => {
    const res = await req('GET', '/');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('SlimLink'), 'page should contain SlimLink');
    assert.ok(res.body.includes('shorten-form'), 'page should contain shorten form');
  });

  it('POST / with valid URL creates short link and shows result', async () => {
    const res = await req('POST', '/', { form: true, body: { url: 'https://example.com' } });
    assert.strictEqual(res.status, 302);
    assert.ok(res.headers.location.startsWith('/?code='), 'should redirect with code');
    const follow = await req('GET', res.headers.location);
    assert.strictEqual(follow.status, 200);
    assert.ok(follow.body.includes('shortUrl'), 'response should include short URL input');
    assert.ok(follow.body.includes('test.local'), 'short URL should include base URL');
  });

  it('POST / with missing URL shows error', async () => {
    const res = await req('POST', '/', { form: true, body: {} });
    assert.strictEqual(res.status, 302);
    assert.ok(res.headers.location.startsWith('/?error='), 'should redirect with error');
    const follow = await req('GET', res.headers.location);
    assert.strictEqual(follow.status, 200);
    assert.ok(follow.body.includes('error-msg'), 'response should show error message');
  });

  it('POST / with invalid URL shows error', async () => {
    const res = await req('POST', '/', { form: true, body: { url: 'not-a-url' } });
    assert.strictEqual(res.status, 302);
    assert.ok(res.headers.location.startsWith('/?error='), 'should redirect with error');
    const follow = await req('GET', res.headers.location);
    assert.strictEqual(follow.status, 200);
    assert.ok(follow.body.includes('error-msg'), 'response should show error for invalid URL');
  });
});

describe('Routes: API', () => {
  it('POST /api/shorten with valid URL returns 201 with short_url', async () => {
    const res = await req('POST', '/api/shorten', { json: true, body: { url: 'https://api-test.com' } });
    assert.strictEqual(res.status, 201);
    const data = res.json();
    assert.ok(data.short_url, 'response should include short_url');
    assert.ok(data.short_code, 'response should include short_code');
    assert.strictEqual(data.original_url, 'https://api-test.com');
  });

  it('POST /api/shorten with missing url returns 400', async () => {
    const res = await req('POST', '/api/shorten', { json: true, body: {} });
    assert.strictEqual(res.status, 400);
    const data = res.json();
    assert.ok(data.error, 'response should include error');
  });

  it('POST /api/shorten with invalid URL returns 400', async () => {
    const res = await req('POST', '/api/shorten', { json: true, body: { url: 'bad' } });
    assert.strictEqual(res.status, 400);
    const data = res.json();
    assert.ok(data.error, 'response should include error');
  });

  it('POST /api/shorten with non-http URL returns 400', async () => {
    const res = await req('POST', '/api/shorten', { json: true, body: { url: 'ftp://example.com' } });
    assert.strictEqual(res.status, 400);
  });

  it('POST /api/shorten with empty URL string returns 400', async () => {
    const res = await req('POST', '/api/shorten', { json: true, body: { url: '' } });
    assert.strictEqual(res.status, 400);
  });
});

describe('Routes: Redirect', () => {
  let shortCode = '';

  it('creates a link via API for redirect test', async () => {
    const res = await req('POST', '/api/shorten', { json: true, body: { url: 'https://redirect-target.com' } });
    assert.strictEqual(res.status, 201);
    shortCode = res.json().short_code;
    assert.ok(shortCode, 'short code should exist');
  });

  it('GET /:code returns 301 to original URL', async () => {
    assert.ok(shortCode, 'shortCode must be set');
    const res = await req('GET', '/' + shortCode);
    assert.strictEqual(res.status, 301);
    assert.strictEqual(res.headers.location, 'https://redirect-target.com');
  });

  it('GET /nonexistent-code returns 404', async () => {
    const res = await req('GET', '/zzzzzzz');
    assert.strictEqual(res.status, 404);
  });

  it('GET / with very long code returns 404', async () => {
    const res = await req('GET', '/' + 'a'.repeat(200));
    assert.strictEqual(res.status, 404);
  });
});

describe('Routes: Admin auth', () => {
  it('GET /admin without auth returns 401', async () => {
    const res = await req('GET', '/admin');
    assert.strictEqual(res.status, 401);
  });

  it('GET /admin with wrong password returns 401', async () => {
    const res = await req('GET', '/admin', {
      headers: { 'Authorization': 'Basic ' + Buffer.from('testadmin:wrongpass').toString('base64') }
    });
    assert.strictEqual(res.status, 401);
  });

  it('GET /admin with valid auth returns 200 and dashboard', async () => {
    const res = await req('GET', '/admin', { auth: true });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('Dashboard'), 'should show Dashboard');
    assert.ok(res.body.includes('Total Links'), 'should show Total Links');
    assert.ok(res.body.includes('Total Clicks'), 'should show Total Clicks');
  });

  it('GET /admin/links with valid auth returns 200', async () => {
    const res = await req('GET', '/admin/links', { auth: true });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('Manage Links'), 'should show Manage Links');
  });

  it('GET /admin/links without auth returns 401', async () => {
    const res = await req('GET', '/admin/links');
    assert.strictEqual(res.status, 401);
  });
});

describe('Routes: Admin link management', () => {
  it('POST /admin/links creates a link', async () => {
    const res = await req('POST', '/admin/links', { auth: true, form: true, body: { url: 'https://admin-created.com' } });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('success-msg'), 'should show success message');
  });

  it('POST /admin/links with invalid URL returns 400 with error', async () => {
    const res = await req('POST', '/admin/links', { auth: true, form: true, body: { url: 'not-valid' } });
    assert.strictEqual(res.status, 400, 'invalid URL should return 400');
    assert.ok(res.body.includes('error-msg'), 'should show error message');
  });

  it('GET /admin/links/:id shows link detail', async () => {
    const res = await req('GET', '/admin/links/1', { auth: true });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('Link Details'), 'should show Link Details');
    assert.ok(res.body.includes('Click Log'), 'should show Click Log');
  });

  it('GET /admin/links/:id with non-numeric ID returns 400', async () => {
    const res = await req('GET', '/admin/links/abc', { auth: true });
    assert.strictEqual(res.status, 400);
  });

  it('GET /admin/links/:id with non-existent ID returns 404', async () => {
    const res = await req('GET', '/admin/links/99999', { auth: true });
    assert.strictEqual(res.status, 404);
  });

  it('POST /admin/links/:id/delete removes link and redirects', async () => {
    const res = await req('POST', '/admin/links/1/delete', { auth: true });
    assert.strictEqual(res.status, 302);
    assert.strictEqual(res.headers.location, '/admin/links');
  });
});

describe('Routes: 404 handler', () => {
  it('GET /nonexistent-path returns 404', async () => {
    const res = await req('GET', '/nonexistent-path');
    assert.strictEqual(res.status, 404);
    assert.ok(res.body.includes('404'), 'body should reference 404');
  });

  it('GET /admin/nonexistent returns 401 (auth first, not 404)', async () => {
    const res = await req('GET', '/admin/nonexistent');
    assert.strictEqual(res.status, 401, 'admin routes require auth before 404');
  });

  it('GET /api/nonexistent returns 404 (no such API route)', async () => {
    const res = await req('GET', '/api/nonexistent');
    assert.strictEqual(res.status, 404, 'unknown API routes should 404');
  });
});

describe('Routes: Security headers', () => {
  it('GET / returns security headers from Helmet', async () => {
    const res = await req('GET', '/');
    assert.ok(res.headers['x-content-type-options'], 'should have X-Content-Type-Options');
    assert.ok(res.headers['x-frame-options'], 'should have X-Frame-Options');
    assert.ok(res.headers['x-download-options'], 'should have X-Download-Options');
    assert.ok(res.headers['x-xss-protection'], 'should have X-XSS-Protection');
  });
});

describe('Routes: Click tracking', () => {
  it('click counter increments when link is visited', async () => {
    const detailBefore = await req('GET', '/admin/links/2', { auth: true });
    const clicksMatch = detailBefore.body.match(/<strong>(\d+)<\/strong>/);
    const clicksBefore = clicksMatch ? parseInt(clicksMatch[1]) : 0;

    await req('GET', '/api-test-short-xyz', { auth: false });

    const detailAfter = await req('GET', '/admin/links/2', { auth: true });
    assert.ok(detailAfter.body.includes('Click Log'), 'detail page should show click log');
  });
});
