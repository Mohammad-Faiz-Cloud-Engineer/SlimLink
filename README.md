# SlimLink

![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen?logo=node.js&style=flat)
![Express](https://img.shields.io/badge/express-4.21-blue?logo=express&style=flat)
![SQLite](https://img.shields.io/badge/sql.js-SQLite-blue?logo=sqlite&style=flat)
![License](https://img.shields.io/badge/license-MIT-green?style=flat)
![Status](https://img.shields.io/badge/status-active-brightgreen?style=flat)

[![Test results](https://img.shields.io/badge/tests-%E2%9C%93%20210-brightgreen?style=flat)]()
[![Code quality](https://img.shields.io/badge/code%20quality-A-brightgreen?style=flat)]()
[![Build](https://img.shields.io/badge/build-passing-brightgreen?style=flat)]()
[![Dead code](https://img.shields.io/badge/dead%20code-none-brightgreen?style=flat)]()

Self-hosted URL shortener with an admin panel. Tracks every click - device, browser, OS, ISP, country, referrer.

Created by [Mohammad Faiz](https://github.com/Mohammad-Faiz-Cloud-Engineer)

## Quick start

```
npm install
npm start
```

Open http://localhost:3000. Admin panel at http://localhost:3000/admin.

Default login: `admin` / `change_this_to_something_secure` - set it in `.env` before going live.

## What it does

- Shorten URLs via the landing page form or the API (`POST /api/shorten`)
- Visiting a short link gets a 301 redirect - click gets logged
- Admin panel shows dashboards and per-link click analytics
- Click data includes: IP, ISP, browser + version, OS, device type, country, referrer, timestamp

## Stack

Express + sql.js (zero-config SQLite) + EJS. No build step, no native dependencies. One `npm install` and it runs.

## Routes

| Method | Path | What |
|---|---|---|
| GET / | Landing page | Shorten a URL |
| POST /api/shorten | API | Returns JSON with short URL |
| GET /:code | Redirect | 301 to original URL + logs click |
| GET /admin | Dashboard | Stats + recent clicks |
| GET /admin/links | Link manager | Create, view, delete links |
| POST /admin/links | Link manager | Create a new short link |
| GET /admin/links/:id | Click analytics | Device, browser, ISP per click |
| POST /admin/links/:id/delete | Link manager | Delete a short link |

## Why sql.js

Was using better-sqlite3 initially. Requires native compilation (node-gyp + VS Build Tools). Switched to sql.js - pure JavaScript, works everywhere. DB is saved to `data/links.db` after every write.

## Tests

Six test suites (210 tests, zero dependencies).

| Command | Tests | What it covers |
|---|---|---|
| `npm test` | 210 | All suites - routes, unit, DB, build, quality, dead code |
| `npm run quality` | 12 | Code quality: no debugger, no console.log, no hardcoded secrets, SQL parameterization, indentation, empty catches |
| `npm run build` | 7 | Load verification: JS syntax, template existence, require() resolution, dependency audit |

### Test files

| File | Tests | Scope |
|---|---|---|
| `test/routes.test.js` | 29 | All 14 endpoints via real HTTP server, security headers, click tracking |
| `test/unit.test.js` | 26 | URL shortener, IP/UA/ISP tracker, validation, auth, rate limiter, config |
| `test/db.test.js` | 18 | Link CRUD, click recording, ISP update, pagination, cascade delete, null fields |
| `test/quality.test.js` | 12 | Syntax, debug/log/hardcoded-secret checks, SQL param enforcement, style consistency |
| `test/build.test.js` | 7 | Module parse, template existence, require resolution, CSS/.env integrity, dep audit |
| `test/deadcode.test.js` | 117 | CSS class usage, JS export trace, unused imports, EJS render variable usage |

## Things to know

- ISP lookup is async (ip-api.com, HTTPS) - doesn't block the redirect
- Rate limited: 100 req/min on API, 1000/min on redirects
- Helmet security headers on everything
- No CSRF tokens - admin uses HTTP Basic Auth, so the surface is narrow
- The admin password warning on startup is intentional - change ADMIN_PASSWORD in .env
