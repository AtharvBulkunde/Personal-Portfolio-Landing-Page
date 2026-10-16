const apiInput = document.getElementById("apiBase");
const tokenInput = document.getElementById("adminToken");
const connectBtn = document.getElementById("connectBtn");
const disconnectBtn = document.getElementById("disconnectBtn");
const refreshBtn = document.getElementById("refreshBtn");
const statusBox = document.getElementById("status");
const messageList = document.getElementById("messageList");
const projectList = document.getElementById("projectList");
const messagesPanel = document.getElementById("messagesPanel");
const projectsPanel = document.getElementById("projectsPanel");
const showMessagesBtn = document.getElementById("showMessages");
const showProjectsBtn = document.getElementById("showProjects");
const projectForm = document.getElementById("projectForm");
const projectFormStatus = document.getElementById("projectFormStatus");
const reloadProjectsBtn = document.getElementById("reloadProjects");
let apiBase = "";
let adminToken = "";

apiInput.value = localStorage.getItem("portfolioAdminApiBase") || "http://localhost:3000";
function setStatus(message, tone = "") {
  statusBox.textContent = message;
  statusBox.className = "status" + (tone ? " " + tone : "");
}
function setProjectStatus(message, tone = "") {
  projectFormStatus.textContent = message;
  projectFormStatus.className = "status" + (tone ? " " + tone : "");
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
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + adminToken, ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Request failed (" + response.status + ").");
  return payload;
}
function displayEmpty(target, message) {
  target.replaceChildren();
  const empty = document.createElement("div");
  empty.className = "empty panel";
  empty.textContent = message;
  target.append(empty);
}
function renderMessages(items) {
  messageList.replaceChildren();
  if (!items.length) return displayEmpty(messageList, "No messages yet. New submissions will show up here.");
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
    if (item.status !== "read") actions.append(makeButton("Mark read", () => updateMessageStatus(item.id, "read")));
    if (item.status !== "archived") actions.append(makeButton("Archive", () => updateMessageStatus(item.id, "archived")));
    actions.append(makeButton("Mark new", () => updateMessageStatus(item.id, "new")));
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
    displayEmpty(messageList, "Unable to load the inbox. Check the API origin and admin token.");
  } finally {
    refreshBtn.disabled = false;
  }
}
async function updateMessageStatus(id, status) {
  try {
    await apiRequest("/api/admin/messages/" + encodeURIComponent(id) + "/status", { method: "PATCH", body: JSON.stringify({ status }) });
    await loadMessages();
  } catch (error) { setStatus(error.message, "error"); }
}
function showPanel(name) {
  const messagesActive = name === "messages";
  messagesPanel.hidden = !messagesActive;
  projectsPanel.hidden = messagesActive;
  showMessagesBtn.classList.toggle("primary", messagesActive);
  showProjectsBtn.classList.toggle("primary", !messagesActive);
  showMessagesBtn.classList.toggle("active", messagesActive);
  showProjectsBtn.classList.toggle("active", !messagesActive);
}
function resetProjectForm() {
  projectForm.reset();
  document.getElementById("projectId").value = "";
  document.getElementById("projectFormTitle").textContent = "Add a project";
  document.getElementById("saveProject").textContent = "Save project";
  document.getElementById("cancelProjectEdit").hidden = true;
  setProjectStatus("");
}
function editProject(item) {
  document.getElementById("projectId").value = item.id;
  document.getElementById("projectTitle").value = item.title;
  document.getElementById("projectSlug").value = item.slug;
  document.getElementById("projectSummary").value = item.summary;
  document.getElementById("projectTags").value = (item.tags || []).join(", ");
  document.getElementById("projectRepository").value = item.repository;
  document.getElementById("projectLiveUrl").value = item.liveUrl || "";
  document.getElementById("projectFeatured").checked = Boolean(item.featured);
  document.getElementById("projectFormTitle").textContent = "Edit project";
  document.getElementById("saveProject").textContent = "Update project";
  document.getElementById("cancelProjectEdit").hidden = false;
  setProjectStatus("Editing “" + item.title + "”.");
  projectForm.scrollIntoView({ behavior: "smooth", block: "start" });
}
function safeExternalLink(label, url) {
  if (!url) return null;
  try { if (new URL(url).protocol !== "https:") return null; } catch { return null; }
  const a = document.createElement("a");
  a.href = url; a.target = "_blank"; a.rel = "noreferrer"; a.textContent = label;
  return a;
}
function renderProjects(items) {
  projectList.replaceChildren();
  if (!items.length) return displayEmpty(projectList, "No projects yet. Use the form above to add your first project.");
  for (const item of items) {
    const card = document.createElement("article");
    card.className = "message-card panel";
    const top = document.createElement("div"); top.className = "project-title-row";
    const identity = document.createElement("div");
    const title = document.createElement("h3"); title.textContent = item.title;
    const meta = document.createElement("div"); meta.className = "message-meta";
    meta.textContent = "/" + item.slug + (item.featured ? " · FEATURED" : "");
    identity.append(title, meta);
    const actions = document.createElement("div"); actions.className = "project-actions";
    actions.append(makeButton("Edit", () => editProject(item)));
    actions.append(makeButton("Delete", async () => {
      if (!window.confirm("Delete “" + item.title + "”? This cannot be undone.")) return;
      try {
        await apiRequest("/api/admin/projects/" + encodeURIComponent(item.id), { method: "DELETE" });
        setProjectStatus("Project deleted.", "success");
        await loadProjects();
      } catch (error) { setProjectStatus(error.message, "error"); }
    }));
    top.append(identity, actions);
    const summary = document.createElement("p"); summary.className = "project-summary"; summary.textContent = item.summary;
    const tags = document.createElement("div"); tags.className = "project-tags";
    (item.tags || []).forEach(tag => { const pill = document.createElement("span"); pill.textContent = tag; tags.append(pill); });
    const links = document.createElement("div"); links.className = "project-actions";
    const source = safeExternalLink("Repository ↗", item.repository);
    const live = safeExternalLink("Live demo ↗", item.liveUrl);
    if (source) links.append(source);
    if (live) links.append(live);
    card.append(top, summary, tags, links);
    projectList.append(card);
  }
}
async function loadProjects() {
  if (!apiBase || !adminToken) return;
  reloadProjectsBtn.disabled = true;
  try {
    const payload = await apiRequest("/api/admin/projects");
    renderProjects(payload.items || []);
    setProjectStatus("Loaded " + (payload.items || []).length + " project(s).", "success");
  } catch (error) {
    setProjectStatus(error.message, "error");
    displayEmpty(projectList, "Unable to load projects. Check the API origin and admin token.");
  } finally { reloadProjectsBtn.disabled = false; }
}
projectForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!apiBase || !adminToken) return setProjectStatus("Connect to the API before saving projects.", "error");
  if (!projectForm.reportValidity()) return;
  const id = document.getElementById("projectId").value;
  const data = {
    title: document.getElementById("projectTitle").value.trim(),
    slug: document.getElementById("projectSlug").value.trim().toLowerCase(),
    summary: document.getElementById("projectSummary").value.trim(),
    tags: document.getElementById("projectTags").value.split(",").map(tag => tag.trim()).filter(Boolean),
    repository: document.getElementById("projectRepository").value.trim(),
    liveUrl: document.getElementById("projectLiveUrl").value.trim(),
    featured: document.getElementById("projectFeatured").checked
  };
  const saveButton = document.getElementById("saveProject");
  saveButton.disabled = true;
  setProjectStatus(id ? "Updating project…" : "Saving project…");
  try {
    const payload = await apiRequest(id ? "/api/admin/projects/" + encodeURIComponent(id) : "/api/admin/projects", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(data)
    });
    resetProjectForm();
    setProjectStatus(payload.item ? "Project saved. The public list updates when the portfolio API is connected." : "Project saved.", "success");
    await loadProjects();
  } catch (error) { setProjectStatus(error.message, "error"); }
  finally { saveButton.disabled = false; }
});
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
  await loadProjects();
});
disconnectBtn.addEventListener("click", () => {
  apiBase = ""; adminToken = ""; tokenInput.value = "";
  refreshBtn.disabled = true; reloadProjectsBtn.disabled = true;
  displayEmpty(messageList, "Disconnected. Connect again to review messages.");
  displayEmpty(projectList, "Disconnected. Connect again to manage projects.");
  setStatus("Disconnected. The token has been cleared from memory.");
  setProjectStatus("");
});
refreshBtn.addEventListener("click", loadMessages);
reloadProjectsBtn.addEventListener("click", loadProjects);
showMessagesBtn.addEventListener("click", () => showPanel("messages"));
showProjectsBtn.addEventListener("click", () => showPanel("projects"));
document.getElementById("cancelProjectEdit").addEventListener("click", resetProjectForm);
showPanel("messages");
