require('./lib/helper.cjs');

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

describe('Build / Load verification', () => {
  it('all source .js files parse without syntax errors', () => {
    const srcDir = path.resolve(__dirname, '..', 'src');
    const files = [];

    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.js')) files.push(full);
      }
    }
    walk(srcDir);

    for (const file of files) {
      assert.doesNotThrow(() => {
        new Function(fs.readFileSync(file, 'utf8'));
      }, `${path.relative(srcDir, file)} has syntax errors`);
    }
  });

  it('all template .ejs files exist and are readable', () => {
    const viewsDir = path.resolve(__dirname, '..', 'src', 'views');
    const expected = [
      'index.ejs', '404.ejs', 'login.ejs',
      'includes/head.ejs', 'includes/foot.ejs',
      'admin/dashboard.ejs', 'admin/links.ejs', 'admin/link-detail.ejs'
    ];
    for (const tpl of expected) {
      const full = path.join(viewsDir, tpl.replace(/\//g, path.sep));
      assert.ok(fs.existsSync(full), `Missing template: ${tpl}`);
      assert.ok(fs.statSync(full).size > 0, `Empty template: ${tpl}`);
    }
  });

  it('all require() paths in source resolve correctly', () => {
    const srcDir = path.resolve(__dirname, '..', 'src');
    const resolved = new Set();

    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.js')) {
          const content = fs.readFileSync(full, 'utf8');
          const requireRe = /require\(['"]([^'"]+)['"]\)/g;
          let match;
          while ((match = requireRe.exec(content)) !== null) {
            const mod = match[1];
            if (mod.startsWith('.')) {
              const dir2 = path.dirname(full);
              const target = path.resolve(dir2, mod);
              try {
                const r = require.resolve(target);
                if (!resolved.has(r)) {
                  resolved.add(r);
                  require(r);
                }
              } catch (e) {
                assert.fail(`Cannot resolve ${mod} from ${path.relative(srcDir, full)}: ${e.message}`);
              }
            }
          }
        }
      }
    }
    walk(srcDir);
  });

  it('public/css/style.css exists and has content', () => {
    const cssPath = path.resolve(__dirname, '..', 'public', 'css', 'style.css');
    assert.ok(fs.existsSync(cssPath), 'Missing style.css');
    const content = fs.readFileSync(cssPath, 'utf8');
    assert.ok(content.length > 1000, 'style.css is too short');
    assert.ok(content.includes(':root'), 'style.css missing :root');
    assert.ok(content.includes('admin-layout'), 'style.css missing admin-layout');
  });

  it('.env.example has all required keys', () => {
    const envPath = path.resolve(__dirname, '..', '.env.example');
    assert.ok(fs.existsSync(envPath), 'Missing .env.example');
    const content = fs.readFileSync(envPath, 'utf8');
    const required = ['PORT', 'BASE_URL', 'ADMIN_USERNAME', 'ADMIN_PASSWORD', 'DB_PATH'];
    for (const key of required) {
      assert.ok(content.includes(key + '='), `.env.example missing ${key}`);
    }
  });

  it('package.json scripts include start, dev, test, quality, build', () => {
    const pkg = require('../package.json');
    assert.ok(pkg.scripts.start, 'Missing start script');
    assert.ok(pkg.scripts.dev, 'Missing dev script');
    assert.ok(pkg.scripts.test, 'Missing test script');
    assert.ok(pkg.scripts.quality, 'Missing quality script');
    assert.ok(pkg.scripts.build, 'Missing build script');
  });

  it('all dependencies in package.json are used in source', () => {
    const pkg = require('../package.json');
    const deps = Object.keys(pkg.dependencies);
    const srcDir = path.resolve(__dirname, '..', 'src');
    const appJs = fs.readFileSync(path.resolve(srcDir, 'app.js'), 'utf8');
    let allSource = appJs;
    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.js')) allSource += fs.readFileSync(full, 'utf8');
      }
    }
    walk(srcDir);
    const indirectLoaders = {
      'ejs': /view engine.*ejs|ejs.*view engine/
    };
    for (const dep of deps) {
      if (indirectLoaders[dep]) {
        assert.ok(indirectLoaders[dep].test(allSource), `Dependency '${dep}' not loaded via Express view engine`);
        continue;
      }
      const escaped = dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`require\\(['"\`]${escaped}['"\`]\\)|require\\(['"\`]${escaped}/`);
      assert.ok(re.test(allSource), `Dependency '${dep}' installed but never required in src/`);
    }
  });
});
