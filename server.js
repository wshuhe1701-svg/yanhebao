const express = require("express");
const session = require("express-session");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");
const SESSION_SECRET = process.env.SESSION_SECRET || "replace-with-strong-secret";

const ALLOWED_USERS = [
  {
    username: "oncet",
    password: "20030621",
    displayName: "Oncet"
  },
  {
    username: "yellody",
    password: "20030717",
    displayName: "Yellody"
  }
];

function safeReadJSON() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return { entries: [] };
    }
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.entries)) {
      return { entries: [] };
    }
    return parsed;
  } catch (error) {
    console.error("Failed to read data file:", error);
    return { entries: [] };
  }
}

function safeWriteJSON(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("Failed to write data file:", error);
  }
}

let db = safeReadJSON();

const sessionMiddleware = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax"
  }
});

app.use(express.json());
app.use(sessionMiddleware);

function authRequired(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

app.get("/api/config", (_req, res) => {
  res.json({
    users: ALLOWED_USERS.map((u) => ({
      username: u.username,
      displayName: u.displayName
    }))
  });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  const matched = ALLOWED_USERS.find(
    (u) => u.username === username && u.password === password
  );
  if (!matched) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  req.session.user = {
    username: matched.username,
    displayName: matched.displayName
  };
  return res.json({
    user: req.session.user
  });
});

app.post("/api/logout", authRequired, (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get("/api/session", (req, res) => {
  res.json({
    user: req.session.user || null
  });
});

app.get("/api/entries", authRequired, (_req, res) => {
  const sorted = [...db.entries].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  res.json({ entries: sorted });
});

app.post("/api/entries", authRequired, (req, res) => {
  const { section, content, day } = req.body || {};
  if (!["Body", "Mind", "Career"].includes(section)) {
    return res.status(400).json({ error: "Invalid section" });
  }
  if (!content || typeof content !== "string" || !content.trim()) {
    return res.status(400).json({ error: "Content required" });
  }
  const now = new Date().toISOString();
  const entry = {
    id: uuidv4(),
    author: req.session.user.username,
    authorName: req.session.user.displayName,
    section,
    content: content.trim(),
    day: day || now.slice(0, 10),
    createdAt: now,
    updatedAt: now
  };
  db.entries.push(entry);
  safeWriteJSON(db);
  io.emit("entries:changed");
  res.status(201).json({ entry });
});

app.put("/api/entries/:id", authRequired, (req, res) => {
  const { id } = req.params;
  const { content, day } = req.body || {};
  const entry = db.entries.find((e) => e.id === id);
  if (!entry) {
    return res.status(404).json({ error: "Entry not found" });
  }
  if (entry.author !== req.session.user.username) {
    return res.status(403).json({ error: "You can only edit your own entry" });
  }
  if (!content || typeof content !== "string" || !content.trim()) {
    return res.status(400).json({ error: "Content required" });
  }
  entry.content = content.trim();
  entry.day = day || entry.day;
  entry.updatedAt = new Date().toISOString();
  safeWriteJSON(db);
  io.emit("entries:changed");
  return res.json({ entry });
});

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

io.on("connection", (socket) => {
  const user = socket.request.session.user;
  if (!user) {
    socket.disconnect(true);
    return;
  }
  socket.emit("connected", { ok: true });
});

app.use(express.static(path.join(__dirname, "public")));

server.listen(PORT, () => {
  console.log(`Private growth space is running on http://localhost:${PORT}`);
});
