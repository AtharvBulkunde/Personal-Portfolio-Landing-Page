# Atharv Bulkunde — Digital Portfolio

A responsive, editorial-style portfolio built with HTML, CSS and vanilla JavaScript, plus a small Node.js API for project data and contact messages.

## Frontend

Open `index.html` directly or use a local static server such as VS Code Live Server. The UI uses Google Fonts (DM Sans, DM Mono and Playfair Display) and the GitHub profile avatar. Core layout and motion use CSS and vanilla JS.

### Connect the contact form to the API

Edit the `<body>` element in `index.html` and set `data-api-base="http://localhost:3000"` for local testing. On deployment, set it to the public origin of the API (no trailing slash). Leave it empty when no API is available; the form will show direct-contact options instead of claiming that a message was sent.

## Backend API

Requires Node.js 20 or newer.

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

Set `ADMIN_API_TOKEN` in `server/.env` to a long, random secret before using admin endpoints. Change `ALLOWED_ORIGINS` to include your front-end origin. The API creates its SQLite database in `server/data/portfolio.sqlite` on first start.

Endpoints:
- `GET /api/health` — service health
- `GET /api/projects` — the portfolio project's data
- `POST /api/contact` — validates and stores a message in SQLite (rate-limited)
- `GET /api/admin/messages?limit=100` — list messages; requires `Authorization: Bearer <ADMIN_API_TOKEN>`
- `PATCH /api/admin/messages/:id/status` — update message status; same admin authorization

## Admin inbox

Open `admin.html` using your static server. Enter the API origin and the `ADMIN_API_TOKEN` from the server environment. The dashboard keeps the token in memory only (not local storage). Do not expose the token in frontend code, Git commits, or public environment variables.

## Deployment notes

The frontend and API can be deployed separately. Configure `data-api-base` to point to the deployed API and set that API's `ALLOWED_ORIGINS` to the exact frontend origin. Use persistent storage for the SQLite database; some serverless platforms have ephemeral filesystems, so a managed database may be preferable there. The API stores messages but does not send email notifications by itself.

## Personal details to verify

The design reuses the GitHub and LinkedIn URLs already present in this repository. Replace certificate placeholders with verified certificate names/links only. Update your résumé URL if it changes.
