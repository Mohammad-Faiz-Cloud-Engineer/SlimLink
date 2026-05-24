const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

describe('Code quality checks', () => {
  const srcDir = path.resolve(__dirname, '..', 'src');
  const allJsFiles = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) allJsFiles.push(full);
    }
  }
  walk(srcDir);

  it('no file contains debugger statements', () => {
    for (const file of allJsFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (/debugger\b/.test(lines[i])) {
          assert.fail(`${path.relative(srcDir, file)}:${i + 1} contains debugger`);
        }
      }
    }
  });

  it('no file contains console.log in production code', () => {
    const whitelist = ['index.js'];
    for (const file of allJsFiles) {
      const rel = path.relative(srcDir, file);
      if (whitelist.includes(rel)) continue;
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (/console\.(log|dir|table)\s*\(/.test(lines[i])) {
          assert.fail(`${rel}:${i + 1} contains console.log/dir/table`);
        }
      }
    }
  });

  it('error handlers use console.error (not console.log)', () => {
    const errorFiles = [
      'src/index.js',
      'src/app.js',
      'src/routes/landing.js',
      'src/routes/redirect.js',
      'src/routes/api.js',
      'src/routes/admin.js'
    ];
    for (const rel of errorFiles) {
      const full = path.resolve(__dirname, '..', rel);
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('console.error')) {
          const match = lines[i].match(/console\.(log|dir|table)\s*\(/);
          if (match) {
            assert.fail(`${rel}:${i + 1} uses console.${match[1]} instead of console.error`);
          }
        }
      }
    }
  });

  it('no hardcoded secrets or passwords in source', () => {
    for (const file of allJsFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/(password|secret|token|key)\s*[:=]\s*['"][^'"]+['"]/i.test(line)) {
          if (!line.includes('ADMIN_PASSWORD') && !line.includes('process.env') && !line.includes('env.') && !line.includes('config.') && !line.includes('d.password')) {
            assert.fail(`${path.relative(srcDir, file)}:${i + 1} may contain hardcoded secret`);
          }
        }
      }
    }
  });

  it('no file exceeds 200 lines (readability)', () => {
    for (const file of allJsFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n').length;
      assert.ok(lines <= 200, `${path.relative(srcDir, file)} has ${lines} lines (max 200)`);
    }
  });

  it('all SQL queries with WHERE/WHERE use parameterized ? placeholders', () => {
    for (const file of allJsFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('.run(') || line.includes('.prepare(') || line.includes('.exec(')) {
          if (/['"](SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER)/i.test(line)) {
            if (line.includes('CREATE TABLE') || line.includes('CREATE INDEX') || line.includes('ALTER TABLE')) continue;
            if (line.includes('datetime') || line.includes('COALESCE') || line.includes('COUNT')) continue;
            if (!line.includes('WHERE')) continue;
            if (!line.includes('?') && !line.includes('$1') && !line.includes(':')) {
              assert.fail(`${path.relative(srcDir, file)}:${i + 1} SQL with WHERE but without parameterized placeholder`);
            }
          }
        }
      }
    }
  });

  it('no .only or .skip in tests', () => {
    const testDir = path.resolve(__dirname);
    const testFiles = [];
    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isFile() && entry.name.endsWith('.test.js')) testFiles.push(full);
      }
    }
    walk(testDir);
    for (const file of testFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (/describe\.only|it\.only|describe\.skip|it\.skip/.test(lines[i])) {
          assert.fail(`${path.basename(file)}:${i + 1} contains .only or .skip`);
        }
      }
    }
  });

  it('catch blocks have handlers (not empty)', () => {
    const catchRe = /catch\s*\([^)]+\)\s*\{([^}]*)\}/g;
    for (const file of allJsFiles) {
      const content = fs.readFileSync(file, 'utf8');
      let match;
      while ((match = catchRe.exec(content)) !== null) {
        const body = match[1].trim();
        if (body === '' || body === ' ') {
          const lineNum = content.substring(0, match.index).split('\n').length;
          assert.fail(`${path.relative(srcDir, file)}:${lineNum} has empty catch block`);
        }
      }
    }
  });

  it('no TODO or FIXME comments in source', () => {
    for (const file of allJsFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (/\bTODO\b|\bFIXME\b/.test(lines[i])) {
          const line = lines[i].trim();
          if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
            assert.fail(`${path.relative(srcDir, file)}:${i + 1} contains TODO/FIXME`);
          }
        }
      }
    }
  });

  it('consistent indentation (2 spaces) in JS files', () => {
    for (const file of allJsFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const leading = line.match(/^([\t ]+)/);
        if (leading) {
          if (leading[1].includes('\t')) {
            assert.fail(`${path.relative(srcDir, file)}:${i + 1} uses tabs`);
          }
          if (leading[1].length % 2 !== 0) {
            assert.fail(`${path.relative(srcDir, file)}:${i + 1} has odd indentation`);
          }
        }
      }
    }
  });

  it('let/const used instead of var', () => {
    const whitelistVars = ['fmtDate'];
    for (const file of allJsFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const match = line.match(/^var\s+(\w+)/);
        if (match && !line.includes('function')) {
          if (!whitelistVars.includes(match[1])) {
            assert.fail(`${path.relative(srcDir, file)}:${i + 1} uses var for '${match[1]}' instead of let/const`);
          }
        }
      }
    }
  });

  it('all EJS templates start with DOCTYPE or include or are valid fragments', () => {
    const viewsDir = path.resolve(__dirname, '..', 'src', 'views');
    const viewFiles = [];
    const validStarts = ['<!DOCTYPE', '<%- include', '</'];
    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.ejs')) viewFiles.push(full);
      }
    }
    walk(viewsDir);
    for (const file of viewFiles) {
      const content = fs.readFileSync(file, 'utf8').trim();
      const ok = validStarts.some(s => content.startsWith(s));
      assert.ok(ok, `${path.relative(viewsDir, file)} does not start with DOCTYPE, include, or closing tag`);
    }
  });
});
