const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const credentialHint = document.getElementById("credentialHint");
const welcomeTitle = document.getElementById("welcomeTitle");
const logoutBtn = document.getElementById("logoutBtn");
const entryForm = document.getElementById("entryForm");
const sectionsContainer = document.getElementById("sectionsContainer");

const SECTION_ORDER = ["Body", "Mind", "Career"];
let currentUser = null;
let socket = null;
let entriesCache = [];

function formatDate(isoOrDate) {
  const date = new Date(isoOrDate);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || "Request failed");
  }
  return body;
}

function renderEntries() {
  sectionsContainer.innerHTML = "";
  SECTION_ORDER.forEach((sectionName) => {
    const sectionEntries = entriesCache.filter((e) => e.section === sectionName);
    const block = document.createElement("article");
    block.className = "section-block";
    block.dataset.section = sectionName;
    block.innerHTML = `
      <h4 class="section-title">${sectionName}</h4>
      <div class="entries"></div>
    `;
    const entriesEl = block.querySelector(".entries");

    if (!sectionEntries.length) {
      const empty = document.createElement("p");
      empty.className = "subtle";
      empty.textContent = "No updates yet.";
      entriesEl.appendChild(empty);
    } else {
      sectionEntries.forEach((entry) => {
        const isMine = currentUser && entry.author === currentUser.username;
        const item = document.createElement("div");
        item.className = "entry";
        item.innerHTML = `
          <div class="entry-meta">
            <span>${entry.authorName} - ${entry.day}</span>
            <span>Updated ${formatDate(entry.updatedAt)}</span>
          </div>
          <p>${escapeHTML(entry.content)}</p>
          ${
            isMine
              ? `<div class="entry-actions"><button data-edit-id="${entry.id}" type="button">Edit</button></div>`
              : ""
          }
        `;
        entriesEl.appendChild(item);
      });
    }
    sectionsContainer.appendChild(block);
  });

  Array.from(document.querySelectorAll("[data-edit-id]")).forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-edit-id");
      const entry = entriesCache.find((e) => e.id === id);
      if (!entry) return;
      const next = prompt("Edit your update:", entry.content);
      if (next === null) return;
      if (!next.trim()) return;
      updateEntry(entry.id, next.trim(), entry.day);
    });
  });
}

function escapeHTML(input) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function refreshEntries() {
  if (!currentUser) return;
  const data = await api("/api/entries");
  entriesCache = data.entries;
  renderEntries();
}

function connectSocket() {
  if (socket) {
    socket.disconnect();
  }
  socket = io();
  socket.on("entries:changed", () => {
    refreshEntries().catch(() => {});
  });
}

function showDashboard() {
  loginView.classList.add("hidden");
  dashboardView.classList.remove("hidden");
  welcomeTitle.textContent = `Welcome, ${currentUser.displayName}`;
  document.getElementById("day").valueAsDate = new Date();
}

function showLogin() {
  dashboardView.classList.add("hidden");
  loginView.classList.remove("hidden");
}

async function boot() {
  try {
    const [config, session] = await Promise.all([api("/api/config"), api("/api/session")]);
    credentialHint.textContent = `Allowed users: ${config.users
      .map((u) => u.username)
      .join(" and ")}`;

    if (session.user) {
      currentUser = session.user;
      showDashboard();
      await refreshEntries();
      connectSocket();
    } else {
      showLogin();
    }
  } catch (error) {
    loginError.textContent = "Could not initialize app.";
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    currentUser = data.user;
    showDashboard();
    await refreshEntries();
    connectSocket();
  } catch (error) {
    loginError.textContent = error.message;
  }
});

logoutBtn.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  if (socket) socket.disconnect();
  currentUser = null;
  entriesCache = [];
  showLogin();
});

entryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const section = document.getElementById("section").value;
  const day = document.getElementById("day").value;
  const content = document.getElementById("content").value.trim();
  if (!content) return;
  await api("/api/entries", {
    method: "POST",
    body: JSON.stringify({ section, day, content })
  });
  document.getElementById("content").value = "";
  await refreshEntries();
});

async function updateEntry(id, content, day) {
  await api(`/api/entries/${id}`, {
    method: "PUT",
    body: JSON.stringify({ content, day })
  });
  await refreshEntries();
}

boot();
