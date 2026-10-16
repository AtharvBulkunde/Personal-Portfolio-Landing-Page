const apiInput = document.getElementById("apiBase");
const tokenInput = document.getElementById("adminToken");
const connectBtn = document.getElementById("connectBtn");
const disconnectBtn = document.getElementById("disconnectBtn");
const refreshBtn = document.getElementById("refreshBtn");
const statusBox = document.getElementById("status");
const messageList = document.getElementById("messageList");
let apiBase = "";
let adminToken = "";

apiInput.value = localStorage.getItem("portfolioAdminApiBase") || "http://localhost:3000";

function setStatus(message, tone = "") {
  statusBox.textContent = message;
  statusBox.className = "status" + (tone ? " " + tone : "");
}
function makeButton(label, action, disabled = false) {
  const button = document.createElement("button");
  button.className = "button";
  button.type = "button";
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener("click", action);
  return button;
}
async function apiRequest(path, options = {}) {
  const response = await fetch(apiBase + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + adminToken,
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Request failed (" + response.status + ").");
  return payload;
}
function displayEmpty(message) {
  messageList.replaceChildren();
  const empty = document.createElement("div");
  empty.className = "empty panel";
  empty.textContent = message;
  messageList.append(empty);
}
function renderMessages(items) {
  messageList.replaceChildren();
  if (!items.length) return displayEmpty("No messages yet. New submissions will show up here.");
  for (const item of items) {
    const card = document.createElement("article");
    card.className = "message-card panel";
    const top = document.createElement("div");
    top.className = "message-top";
    const identity = document.createElement("div");
    const name = document.createElement("h3");
    name.textContent = item.name;
    const meta = document.createElement("div");
    meta.className = "message-meta";
    meta.textContent = item.email + " · " + new Date(item.created_at).toLocaleString();
    identity.append(name, meta);
    const chip = document.createElement("span");
    chip.className = "status-chip";
    chip.textContent = item.status;
    top.append(identity, chip);
    const body = document.createElement("div");
    body.className = "message-body";
    body.textContent = item.message;
    const actions = document.createElement("div");
    actions.className = "message-actions";
    if (item.status !== "read") {
      actions.append(makeButton("Mark read", () => updateStatus(item.id, "read")));
    }
    if (item.status !== "archived") {
      actions.append(makeButton("Archive", () => updateStatus(item.id, "archived")));
    }
    actions.append(makeButton("Mark new", () => updateStatus(item.id, "new")));
    card.append(top, body, actions);
    messageList.append(card);
  }
}
async function loadMessages() {
  if (!apiBase || !adminToken) return;
  refreshBtn.disabled = true;
  setStatus("Loading messages…");
  try {
    const payload = await apiRequest("/api/admin/messages?limit=100");
    renderMessages(payload.items || []);
    setStatus("Connected. Loaded " + (payload.items || []).length + " message(s).", "success");
    refreshBtn.disabled = false;
  } catch (error) {
    setStatus(error.message, "error");
    displayEmpty("Unable to load the inbox. Check the API origin and admin token.");
    refreshBtn.disabled = true;
  }
}
async function updateStatus(id, status) {
  try {
    await apiRequest("/api/admin/messages/" + encodeURIComponent(id) + "/status", {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    await loadMessages();
  } catch (error) {
    setStatus(error.message, "error");
  }
}
connectBtn.addEventListener("click", async () => {
  const nextBase = apiInput.value.trim().replace(/\/$/, "");
  const nextToken = tokenInput.value.trim();
  if (!/^https?:\/\//i.test(nextBase)) return setStatus("Enter a valid API origin such as http://localhost:3000.", "error");
  if (!nextToken) return setStatus("Enter your server-side admin token.", "error");
  apiBase = nextBase;
  adminToken = nextToken;
  localStorage.setItem("portfolioAdminApiBase", apiBase);
  tokenInput.value = "";
  await loadMessages();
});
disconnectBtn.addEventListener("click", () => {
  apiBase = "";
  adminToken = "";
  tokenInput.value = "";
  refreshBtn.disabled = true;
  displayEmpty("Disconnected. Connect again to review messages.");
  setStatus("Disconnected. The token has been cleared from memory.");
});
refreshBtn.addEventListener("click", loadMessages);
