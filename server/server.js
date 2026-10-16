import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import Database from "better-sqlite3";
import { createHash, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH ? resolve(process.env.DB_PATH) : resolve(here, "data", "portfolio.sqlite");
mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','read','archived')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    tags_json TEXT NOT NULL DEFAULT '[]',
    repository_url TEXT NOT NULL,
    live_url TEXT,
    featured INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
`);
`);

const app = express();
const port = Number(process.env.PORT || 3000);
app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY === "1" ? 1 : false);
app.use(helmet());
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || "http://localhost:5500,http://127.0.0.1:5500,http://localhost:8080,http://127.0.0.1:8080")
    .split(",").map(value => value.trim()).filter(Boolean)
);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by this API."));
  },
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "20kb", strict: true }));

const initialProjects = [
  {
    slug: "personal-portfolio",
    title: "Personal Portfolio",
    summary: "An editorial portfolio with responsive layouts, motion, theme controls and a contact API.",
    tags: ["HTML", "CSS", "JavaScript", "Node.js"],
    repository: "https://github.com/AtharvBulkunde/Personal-Portfolio-Landing-Page",
    liveUrl: "",
    featured: true
  },
  {
    slug: "music-ui",
    title: "Modern Music UI",
    summary: "A music interface concept focused on clear visual hierarchy and interactive presentation.",
    tags: ["HTML", "CSS", "JavaScript"],
    repository: "https://github.com/AtharvBulkunde/Music",
    liveUrl: "",
    featured: false
  },
  {
    slug: "edutrack",
    title: "EduTrack Pro",
    summary: "A college management system repository for exploring academic data and workflows.",
    tags: ["Java", "SQL", "DBMS"],
    repository: "https://github.com/AtharvBulkunde/EduTrack-Pro---Complete-College-Management-System",
    liveUrl: "",
    featured: false
  }
];
const projectCount = db.prepare("SELECT COUNT(*) AS count FROM projects").get().count;
if (projectCount === 0) {
  const seedProject = db.prepare(
    "INSERT INTO projects (slug, title, summary, tags_json, repository_url, live_url, featured) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const seedTransaction = db.transaction(items => items.forEach(item => seedProject.run(
    item.slug, item.title, item.summary, JSON.stringify(item.tags), item.repository,
    item.liveUrl || null, item.featured ? 1 : 0
  )));
  seedTransaction(initialProjects);
}
function serialiseProject(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    tags: JSON.parse(row.tags_json),
    repository: row.repository_url,
    liveUrl: row.live_url || "",
    featured: Boolean(row.featured),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function validateProject(body) {
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const slug = typeof body?.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const summary = typeof body?.summary === "string" ? body.summary.trim() : "";
  const tags = Array.isArray(body?.tags)
    ? body.tags.filter(tag => typeof tag === "string").map(tag => tag.trim()).filter(Boolean).slice(0, 12)
    : [];
  const repository = typeof body?.repository === "string" ? body.repository.trim() : "";
  const liveUrl = typeof body?.liveUrl === "string" ? body.liveUrl.trim() : "";
  const validHttps = value => {
    try { return new URL(value).protocol === "https:"; } catch { return false; }
  };
  if (title.length < 2 || title.length > 120) return { error: "Title must be between 2 and 120 characters." };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) return { error: "Slug must use lowercase letters, numbers and single hyphens." };
  if (summary.length < 10 || summary.length > 1000) return { error: "Summary must be between 10 and 1,000 characters." };
  if (!tags.length) return { error: "Add at least one technology tag." };
  if (tags.some(tag => tag.length > 40)) return { error: "Each technology tag must be 40 characters or fewer." };
  if (!validHttps(repository)) return { error: "Repository must be a valid HTTPS URL." };
  if (liveUrl && !validHttps(liveUrl)) return { error: "Live demo must be a valid HTTPS URL or blank." };
  return { project: { title, slug, summary, tags, repository, liveUrl, featured: Boolean(body.featured) } };
}
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "portfolio-api" }));
app.get("/api/projects", (_req, res) => {
  const rows = db.prepare("SELECT * FROM projects ORDER BY featured DESC, updated_at DESC, id DESC").all();
  return res.json({ items: rows.map(serialiseProject) });
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many messages have been submitted. Please try again later." }
});

const insertMessage = db.prepare(
  "INSERT INTO messages (name, email, message) VALUES (@name, @email, @message)"
);
app.post("/api/contact", contactLimiter, (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  if (name.length < 2 || name.length > 100) {
    return res.status(400).json({ error: "Please enter a name between 2 and 100 characters." });
  }
  if (email.length > 254 || !emailPattern.test(email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  if (message.length < 10 || message.length > 5000) {
    return res.status(400).json({ error: "Please enter a message between 10 and 5,000 characters." });
  }

  try {
    const result = insertMessage.run({ name, email, message });
    return res.status(201).json({ ok: true, id: Number(result.lastInsertRowid) });
  } catch {
    return res.status(500).json({ error: "The message could not be saved. Please try again." });
  }
});

function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_API_TOKEN || "";
  if (expected.length < 24) {
    return res.status(503).json({ error: "Admin access is not configured. Set ADMIN_API_TOKEN on the server." });
  }
  const supplied = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const expectedHash = createHash("sha256").update(expected).digest();
  const suppliedHash = createHash("sha256").update(supplied).digest();
  if (!supplied || !timingSafeEqual(expectedHash, suppliedHash)) {
    return res.status(401).json({ error: "Invalid admin token." });
  }
  next();
}

app.get("/api/admin/messages", requireAdmin, (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit || "50"), 10) || 50, 1), 100);
  const rows = db.prepare(
    "SELECT id, name, email, message, status, created_at FROM messages ORDER BY id DESC LIMIT ?"
  ).all(limit);
  return res.json({ items: rows });
});

app.patch("/api/admin/messages/:id/status", requireAdmin, (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const status = req.body?.status;
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Invalid message ID." });
  if (!["new", "read", "archived"].includes(status)) {
    return res.status(400).json({ error: "Status must be new, read or archived." });
  }
  const result = db.prepare("UPDATE messages SET status = ? WHERE id = ?").run(status, id);
  if (result.changes === 0) return res.status(404).json({ error: "Message not found." });
  return res.json({ ok: true });
});

app.get("/api/admin/projects", requireAdmin, (_req, res) => {
  const rows = db.prepare("SELECT * FROM projects ORDER BY featured DESC, updated_at DESC, id DESC").all();
  return res.json({ items: rows.map(serialiseProject) });
});

app.post("/api/admin/projects", requireAdmin, (req, res) => {
  const validated = validateProject(req.body);
  if (validated.error) return res.status(400).json({ error: validated.error });
  const p = validated.project;
  try {
    const result = db.prepare(
      "INSERT INTO projects (slug, title, summary, tags_json, repository_url, live_url, featured) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(p.slug, p.title, p.summary, JSON.stringify(p.tags), p.repository, p.liveUrl || null, p.featured ? 1 : 0);
    const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(Number(result.lastInsertRowid));
    return res.status(201).json({ item: serialiseProject(row) });
  } catch (error) {
    if (error?.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "That project slug already exists." });
    return res.status(500).json({ error: "Project could not be saved." });
  }
});

app.patch("/api/admin/projects/:id", requireAdmin, (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Invalid project ID." });
  const validated = validateProject(req.body);
  if (validated.error) return res.status(400).json({ error: validated.error });
  const p = validated.project;
  try {
    const result = db.prepare(
      "UPDATE projects SET slug = ?, title = ?, summary = ?, tags_json = ?, repository_url = ?, live_url = ?, featured = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?"
    ).run(p.slug, p.title, p.summary, JSON.stringify(p.tags), p.repository, p.liveUrl || null, p.featured ? 1 : 0, id);
    if (result.changes === 0) return res.status(404).json({ error: "Project not found." });
    const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
    return res.json({ item: serialiseProject(row) });
  } catch (error) {
    if (error?.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "That project slug already exists." });
    return res.status(500).json({ error: "Project could not be updated." });
  }
});

app.delete("/api/admin/projects/:id", requireAdmin, (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Invalid project ID." });
  const result = db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  if (result.changes === 0) return res.status(404).json({ error: "Project not found." });
  return res.json({ ok: true });
});

app.use((err, _req, res, _next) => {
  if (err?.message === "Origin is not allowed by this API.") {
    return res.status(403).json({ error: err.message });
  }
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON body." });
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "Request body is too large." });
  console.error("API error:", err?.message || "Unknown error");
  return res.status(500).json({ error: "Unexpected API error." });
});

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Portfolio API listening on port ${port}`);
});
function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
