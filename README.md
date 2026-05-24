# SlimLink

Self-hosted URL shortener with an admin panel. Tracks every click - device, browser, OS, ISP, country, referrer.

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

## Things to know

- ISP lookup is async (ip-api.com, HTTPS) - doesn't block the redirect
- Rate limited: 100 req/min on API, 1000/min on redirects
- Helmet security headers on everything
- No CSRF tokens - admin uses HTTP Basic Auth, so the surface is narrow
- The admin password warning on startup is intentional - change ADMIN_PASSWORD in .env
