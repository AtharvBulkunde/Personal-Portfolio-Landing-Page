/* Portfolio interactions — accessible, reduced-motion aware, dependency-light. */
const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");

menuBtn?.addEventListener("click", () => {
  const opened = navLinks?.classList.toggle("open") ?? false;
  menuBtn.setAttribute("aria-expanded", String(opened));
  menuBtn.setAttribute("aria-label", opened ? "Close navigation" : "Open navigation");
  menuBtn.textContent = opened ? "×" : "☰";
});
document.querySelectorAll(".nav-links a").forEach(link => link.addEventListener("click", () => {
  navLinks?.classList.remove("open");
  menuBtn?.setAttribute("aria-expanded", "false");
  menuBtn?.setAttribute("aria-label", "Open navigation");
  if (menuBtn) menuBtn.textContent = "☰";
}));

/* Theme toggle. The visual theme is stored locally; no account data is saved. */
const themeToggle = document.getElementById("themeToggle");
const setTheme = isDark => {
  document.body.classList.toggle("dark-mode", isDark);
  if (themeToggle) {
    themeToggle.textContent = isDark ? "☼" : "☾";
    themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    themeToggle.title = isDark ? "Switch to light mode" : "Switch to dark mode";
  }
};
try { setTheme(localStorage.getItem("portfolioTheme") === "dark"); }
catch { setTheme(false); }
themeToggle?.addEventListener("click", () => {
  const isDark = !document.body.classList.contains("dark-mode");
  setTheme(isDark);
  try { localStorage.setItem("portfolioTheme", isDark ? "dark" : "light"); } catch {}
});

/* Scroll reveal: elements remain visible when motion is reduced or observer is unsupported. */
const revealTargets = document.querySelectorAll(
  ".section-heading,.about-card,.stat,.skill-card,.timeline-item,.project-card,.certificate,.education,.contact-box"
);
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if ("IntersectionObserver" in window && !reduceMotion) {
  revealTargets.forEach(el => el.classList.add("js-reveal"));
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  }), { threshold: 0.12 });
  revealTargets.forEach(el => observer.observe(el));
}

/* Reading progress and the subtle mouse-follow spotlight. */
const progress = document.getElementById("readingProgress");
const cursorGlow = document.querySelector(".cursor-glow");
let ticking = false;
window.addEventListener("scroll", () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.width = (maxScroll > 0 ? window.scrollY / maxScroll * 100 : 0) + "%";
    ticking = false;
  });
}, { passive: true });
window.addEventListener("pointermove", event => {
  if (cursorGlow && event.pointerType === "mouse" && !reduceMotion) {
    cursorGlow.style.left = event.clientX + "px";
    cursorGlow.style.top = event.clientY + "px";
    cursorGlow.style.opacity = "1";
  }
}, { passive: true });

/* Contact messages are posted only when a backend URL has been configured.
   The form never displays a false-success message for an unconnected form. */
const contactForm = document.getElementById("contactForm");
const formMessage = document.getElementById("formMessage");
const apiBase = (document.body.dataset.apiBase || "").trim().replace(/\/$/, "");

// Dynamic project list: the HTML cards remain as a graceful fallback if the API is offline.
async function loadPublicProjects() {
  const grid = document.getElementById("projectsGrid");
  if (!apiBase || !grid) return;
  try {
    const response = await fetch(apiBase + "/api/projects");
    if (!response.ok) return;
    const payload = await response.json();
    if (!Array.isArray(payload.items) || payload.items.length === 0) return;
    const palettes = ["blue", "purple", "green"];
    const makeExternalLink = (label, href) => {
      if (!href) return null;
      try { if (new URL(href).protocol !== "https:") return null; } catch { return null; }
      const a = document.createElement("a");
      a.href = href;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.textContent = label;
      return a;
    };
    const cards = payload.items.map((project, index) => {
      const card = document.createElement("article");
      card.className = "project-card js-reveal is-visible";
      const image = document.createElement("div");
      image.className = "project-image " + palettes[index % palettes.length];
      image.textContent = String(project.title || "PROJECT").toUpperCase();
      const content = document.createElement("div");
      content.className = "project-content";
      const number = document.createElement("small");
      number.textContent = String(index + 1).padStart(2, "0") + " / " + String(payload.items.length).padStart(2, "0");
      const title = document.createElement("h3");
      title.textContent = project.title || "Project";
      const summary = document.createElement("p");
      summary.textContent = project.summary || "";
      const tags = document.createElement("div");
      tags.className = "tags";
      (Array.isArray(project.tags) ? project.tags : []).slice(0, 8).forEach(tag => {
        const pill = document.createElement("span");
        pill.textContent = tag;
        tags.append(pill);
      });
      const links = document.createElement("div");
      links.className = "project-links";
      const sourceLink = makeExternalLink("Source ↗", project.repository);
      const liveLink = makeExternalLink("Live demo ↗", project.liveUrl);
      if (sourceLink) links.append(sourceLink);
      if (liveLink) links.append(liveLink);
      content.append(number, title, summary, tags, links);
      card.append(image, content);
      return card;
    });
    grid.replaceChildren(...cards);
  } catch {
    // Keep the static cards visible when the API is unavailable.
  }
}
void loadPublicProjects();

contactForm?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!contactForm.reportValidity()) return;
  const name = document.getElementById("name")?.value.trim() || "";
  const email = document.getElementById("email")?.value.trim() || "";
  const message = document.getElementById("message")?.value.trim() || "";
  if (!apiBase) {
    if (formMessage) formMessage.textContent = "The message service isn't connected yet. Please contact me on LinkedIn or GitHub above.";
    return;
  }
  const submitButton = contactForm.querySelector('button[type="submit"]');
  const previousLabel = submitButton?.textContent || "Send Message ↗";
  if (submitButton) { submitButton.disabled = true; submitButton.textContent = "Sending…"; }
  if (formMessage) formMessage.textContent = "Sending your message…";
  try {
    const response = await fetch(apiBase + "/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, message })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "The message could not be sent.");
    if (formMessage) formMessage.textContent = "Message saved successfully. Thank you for reaching out!";
    contactForm.reset();
  } catch (error) {
    if (formMessage) formMessage.textContent = error instanceof Error
      ? error.message + " Please try again or use LinkedIn."
      : "Something went wrong. Please use LinkedIn to contact me.";
  } finally {
    if (submitButton) { submitButton.disabled = false; submitButton.textContent = previousLabel; }
  }
});
const year = document.getElementById("year");
if (year) year.textContent = String(new Date().getFullYear());
