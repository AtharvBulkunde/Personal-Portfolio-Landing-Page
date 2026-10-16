# Atharv Bulkunde — Digital Portfolio

A responsive editorial-style portfolio built with HTML, CSS and vanilla JavaScript, plus a Node.js API and admin dashboard for projects and contact messages.

## Frontend

Open `index.html` directly or use a local static server such as VS Code Live Server. The UI uses Google Fonts (DM Sans, DM Mono and Playfair Display), a grayscale GitHub avatar, glass cards, scroll reveals, a reading-progress bar, a subtle cursor spotlight and responsive navigation.

### Connect the frontend to the API

Edit the `<body>` element in `index.html`:
- Local: `data-api-base="http://localhost:3000"`
- Deployed: use the public origin of your API, without a trailing slash.

When the API origin is blank or unavailable, the static project cards remain visible and the contact form does not claim it sent a message.

## Backend API

Requires Node.js 20 or newer.

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

Set `ADMIN_API_TOKEN` in `server/.env` to a long, random secret (at least 24 characters) before using admin endpoints. Change `ALLOWED_ORIGINS` to include the exact front-end origin. SQLite data is written to `server/data/portfolio.sqlite` on first start.

Endpoints:
- `GET /api/health` — health check
- `GET /api/projects` — database-backed project list
- `POST /api/contact` — validates and stores a message in SQLite; rate-limited
- `GET /api/admin/messages?limit=100` — list messages; requires `Authorization: Bearer <ADMIN_API_TOKEN>`
- `PATCH /api/admin/messages/:id/status` — change message status
- `GET /api/admin/projects` — list projects for the admin
- `POST /api/admin/projects` — create a project
- `PATCH /api/admin/projects/:id` — update a project
- `DELETE /api/admin/projects/:id` — delete a project

The API hashes and constant-time compares admin-token bytes, validates project and contact payloads, uses Helmet, configures CORS from an allowlist, and rate-limits contact submissions. It stores messages but does **not** send email notifications by itself.

## Admin dashboard

Serve the repository root (e.g. VS Code Live Server) and open `admin.html`. Enter the API origin and the `ADMIN_API_TOKEN` from the server environment. The token stays in page memory only; it is not stored in local storage or committed to source control. Use the dashboard to update project cards and review/archive messages.

## Deployment notes

The static frontend and Node API must be deployed separately. Set the frontend's `data-api-base` to the public API origin and configure that API's `ALLOWED_ORIGINS` for the exact frontend origin. Use persistent storage for SQLite; some serverless platforms have ephemeral filesystems, so a managed database may be preferable. Protect the admin token, do not expose it in frontend environment variables, and configure a durable database before using the site for real enquiries.

## Personal details to verify

The redesign reuses the GitHub and LinkedIn URLs already present in this repository. Replace certificate placeholders with real certificate names and links only. Verify the résumé URL before publishing.
