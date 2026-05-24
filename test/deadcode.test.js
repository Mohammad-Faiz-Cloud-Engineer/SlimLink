const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.resolve(rootDir, 'src');
const viewsDir = path.resolve(srcDir, 'views');
const cssPath = path.resolve(rootDir, 'public', 'css', 'style.css');

function getAllFiles(dir, ext) {
  const files = [];
  function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(ext)) files.push(full);
    }
  }
  walk(dir);
  return files;
}

function readAllFiles(dir, ext) {
  const files = getAllFiles(dir, ext);
  const result = {};
  for (const f of files) {
    result[path.relative(dir, f)] = fs.readFileSync(f, 'utf8');
  }
  return result;
}

describe('Dead code: CSS classes', () => {
  const css = fs.readFileSync(cssPath, 'utf8');
  const templates = readAllFiles(viewsDir, '.ejs');
  const allTemplateText = Object.values(templates).join('\n');

  const cssClasses = new Set();
  const classRe = /\.([a-zA-Z0-9_-]+)\s*\{/g;
  let m;
  while ((m = classRe.exec(css)) !== null) {
    cssClasses.add(m[1]);
  }

  const dynamicCssClasses = new Set([
    'badge-mobile', 'badge-tablet', 'badge-desktop',
    'badge-mobile', 'badge-tablet', 'badge-desktop'
  ]);
  for (const c of dynamicCssClasses) cssClasses.delete(c);

  const nonTemplateClasses = new Set([
    'badge-mobile', 'badge-tablet', 'badge-desktop'
  ]);

  for (const cls of nonTemplateClasses) cssClasses.delete(cls);

  for (const cls of cssClasses) {
    it(`CSS class .${cls} is used in at least one template`, () => {
      const patterns = [
        `class="${cls}"`,
        `class='${cls}'`,
        `class="...${cls}`,
        `class='...${cls}`,
        `${cls}`,
        `class="`,
        `class='`
      ];

      let found = false;
      for (const [rel, content] of Object.entries(templates)) {
        const staticMatch = content.match(new RegExp(`class=["'][^"']*\\b${cls}\\b[^"']*["']`));
        if (staticMatch) { found = true; break; }

        const dynamicMatch = content.match(new RegExp(`class-=[^%]*\\b${cls}\\b`));
        if (dynamicMatch) { found = true; break; }

        if (content.includes(`"${cls}"`) || content.includes(`'${cls}'`)) { found = true; break; }
      }

      if (!found) {
        const matchedInCss = allTemplateText.includes(cls);
        if (matchedInCss) found = true;
      }

      assert.ok(found, `CSS class '.${cls}' is defined in style.css but never referenced in any .ejs template`);
    });
  }
});

describe('Dead code: JS exports', () => {
  const jsFiles = getAllFiles(srcDir, '.js');
  const allJsContent = {};
  for (const f of jsFiles) {
    allJsContent[path.relative(srcDir, f)] = fs.readFileSync(f, 'utf8');
  }

  for (const [relPath, content] of Object.entries(allJsContent)) {
    const exportMatch = content.match(/module\.exports\s*=\s*\{([^}]+)\}/);
    if (!exportMatch) continue;
    if (relPath === 'index.js') continue;

    const exportNames = exportMatch[1].split(',').map(s => {
      const parts = s.trim().split(/\s*:\s*/);
      return (parts[1] || parts[0]).trim();
    }).filter(Boolean);

    const currentFile = path.resolve(srcDir, relPath).replace(/\\/g, '/');

    for (const name of exportNames) {
      it(`exported function/variable '${name}' from ${relPath} is imported elsewhere`, () => {
        let used = false;
        for (const [otherRel, otherContent] of Object.entries(allJsContent)) {
          if (otherRel === relPath) continue;
          if (!otherContent.includes(name)) continue;

          const requireRe = /require\(['"]([^'"]+)['"]\)/g;
          let rm;
          while ((rm = requireRe.exec(otherContent)) !== null) {
            const requirePath = rm[1];
            if (!requirePath.startsWith('.')) continue;

            const importerDir = path.dirname(path.join(srcDir, otherRel)).replace(/\\/g, '/');
            const resolved = path.resolve(importerDir, requirePath).replace(/\\/g, '/');
            const resolvedJs = resolved.endsWith('.js') ? resolved : resolved + '.js';

            if (resolvedJs !== currentFile && resolvedJs !== currentFile.replace('/index.js', '') && resolved !== currentFile) continue;

            const lineStart = otherContent.lastIndexOf('\n', rm.index) + 1;
            const lineEnd = otherContent.indexOf('\n', rm.index);
            const line = otherContent.slice(lineStart, lineEnd > 0 ? lineEnd : undefined);

            const destructured = line.match(/\{\s*([^}]+)\s*\}\s*=\s*require/);
            if (destructured) {
              const imported = destructured[1].split(',').map(s => s.trim().split(/\s*:\s*/).pop().trim());
              if (imported.includes(name)) { used = true; break; }
              continue;
            }

            const varMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*require/);
            if (varMatch) {
              const varName = varMatch[1];
              const varRefRe = new RegExp('\\b' + varName + '\\.' + name + '\\b');
              if (varRefRe.test(otherContent)) { used = true; break; }
            }
          }
          if (used) break;
        }

        assert.ok(used, `'${name}' exported from ${relPath} but never imported/used by any other file`);
      });
    }
  }
});

describe('Dead code: Unused require() imports', () => {
  const jsFiles = getAllFiles(srcDir, '.js');

  for (const file of jsFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    const requireStmts = [];
    const requireRe = /(?:const|let|var)\s+(?:(\{[^}]+\})|(\w+))\s*=\s*require\(['"]([^'"]+)['"]\)/g;
    let rm;
    while ((rm = requireRe.exec(content)) !== null) {
      const lineNum = content.substring(0, rm.index).split('\n').length;
      const isDestructured = !!rm[1];
      const varName = rm[2] || '';
      const destructuredNames = rm[1] ? rm[1].replace(/[{}]/g, '').split(',').map(s => s.trim().split(/\s*:\s*/).pop().trim()) : [];
      requireStmts.push({ line: lineNum, isDestructured, varName, names: destructuredNames, full: rm[0] });
    }

    for (const stmt of requireStmts) {
      it(`${path.relative(srcDir, file)}:${stmt.line} — imported names are referenced`, () => {
        const fileContent = fs.readFileSync(file, 'utf8');
        const afterRequire = fileContent.slice(fileContent.indexOf(stmt.full) + stmt.full.length);

        if (stmt.isDestructured) {
          for (const name of stmt.names) {
            if (name === 'Router' || name === 'rateLimit' || name.startsWith('express')) continue;
            const re = new RegExp('\\b' + name + '\\b');
            assert.ok(re.test(afterRequire) || re.test(fileContent.slice(0, fileContent.indexOf(stmt.full))),
              `'${name}' imported via destructuring but never referenced after require()`);
          }
        } else {
          if (stmt.varName === 'express' || stmt.varName === 'basicAuth') return;
          if (stmt.varName === 'https') return;
          if (stmt.varName.startsWith('init')) return;
          const re = new RegExp('\\b' + stmt.varName + '\\b');
          assert.ok(re.test(afterRequire) || re.test(fileContent.slice(0, fileContent.indexOf(stmt.full))),
            `'${stmt.varName}' required but never referenced after require()`);
        }
      });
    }
  }
});

describe('Dead code: EJS render variables', () => {
  const jsFiles = getAllFiles(srcDir, '.js');
  const templates = readAllFiles(viewsDir, '.ejs');

  for (const file of jsFiles) {
    if (file.endsWith('index.js')) continue;
    const content = fs.readFileSync(file, 'utf8');
    const renderRe = /res\.render\(['"]([^'"]+)['"],\s*\{([^}]+)\}\)/g;
    let rm;

    while ((rm = renderRe.exec(content)) !== null) {
      const tplName = rm[1];
      const varsStr = rm[2];

      const vars = varsStr.split(',').map(s => {
        const parts = s.trim().split(/\s*:\s*/);
        return parts[0].trim();
      }).filter(Boolean);

      const tplRel = tplName + '.ejs';
      let tplContent = '';

      if (templates[tplRel]) {
        tplContent = templates[tplRel];
      } else if (templates[tplRel.replace('/', '\\')]) {
        tplContent = templates[tplRel.replace('/', '\\')];
      } else {
        for (const [k, v] of Object.entries(templates)) {
          if (k.includes(tplName.replace('/', path.sep) + '.ejs')) {
            tplContent = v;
            break;
          }
        }
      }

      if (!tplContent) continue;
      const includedPartials = [];
      const incRe = /<%-?\s+include\s*\(\s*['"]([^'"]+)['"]/g;
      let im;
      while ((im = incRe.exec(tplContent)) !== null) {
        includedPartials.push(im[1]);
      }

      let allContent = tplContent;
      for (const partial of includedPartials) {
        const partialRel = partial + '.ejs';
        if (templates[partialRel]) allContent += '\n' + templates[partialRel];
        else if (templates[partialRel.replace('/', '\\')]) allContent += '\n' + templates[partialRel.replace('/', '\\')];
        else {
          for (const [k, v] of Object.entries(templates)) {
            if (k.includes(partial.replace('/', path.sep) + '.ejs')) {
              allContent += '\n' + v;
              break;
            }
          }
        }
      }

      const lineNum = content.substring(0, rm.index).split('\n').length;
      const fileRel = path.relative(srcDir, file);

      for (const v of vars) {
        if (v === 'title' || v === 'baseUrl') continue;
        if (v === '__' || v === '_') continue;
        const escapedV = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const usageRe = new RegExp(`<%=?\\s*${escapedV}[^%]*%>|<%-?\\s*include.*${escapedV}|\\b${escapedV}\\.\\w+`);
        if (!usageRe.test(allContent)) {
          it(`${fileRel}:${lineNum} — variable '${v}' passed to '${tplName}' but never used in template`, () => {
            assert.ok(false, `render variable '${v}' is passed to '${tplRel}' from ${fileRel}:${lineNum} but never referenced in the template or its partials`);
          });
        }
      }
    }
  }
});
