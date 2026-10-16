// Portfolio interactions — small, accessible and dependency-free.
const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");
menuBtn?.setAttribute("aria-expanded", "false");
menuBtn?.addEventListener("click", () => {
  const opened = navLinks.classList.toggle("open");
  menuBtn.setAttribute("aria-expanded", String(opened));
  menuBtn.textContent = opened ? "×" : "☰";
});
document.querySelectorAll(".nav-links a").forEach(link => link.addEventListener("click", () => {
  navLinks.classList.remove("open");
  menuBtn?.setAttribute("aria-expanded", "false");
  if (menuBtn) menuBtn.textContent = "☰";
}));

const themeToggle = document.getElementById("themeToggle");
const setTheme = light => {
  document.body.classList.toggle("light", light);
  if (themeToggle) {
    themeToggle.textContent = light ? "☾" : "☼";
    themeToggle.setAttribute("aria-label", light ? "Switch to dark mode" : "Switch to light mode");
    themeToggle.title = light ? "Switch to dark mode" : "Switch to light mode";
  }
};
try { setTheme(localStorage.getItem("portfolioTheme") === "light"); } catch (error) { setTheme(false); }
themeToggle?.addEventListener("click", () => {
  const light = !document.body.classList.contains("light");
  setTheme(light);
  try { localStorage.setItem("portfolioTheme", light ? "light" : "dark"); } catch (error) {}
});

const revealTargets = document.querySelectorAll(".section-heading,.about-card,.stat,.skill-card,.timeline-item,.project-card,.certificate,.education,.contact-box");
revealTargets.forEach(el => el.classList.add("js-reveal"));
if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  }), { threshold: 0.12 });
  revealTargets.forEach(el => observer.observe(el));
} else {
  revealTargets.forEach(el => el.classList.add("is-visible"));
}

const progress = document.getElementById("readingProgress");
const cursorGlow = document.querySelector(".cursor-glow");
let ticking = false;
window.addEventListener("scroll", () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.width = (scrollable > 0 ? window.scrollY / scrollable * 100 : 0) + "%";
    ticking = false;
  });
}, { passive: true });
window.addEventListener("pointermove", event => {
  if (cursorGlow && event.pointerType === "mouse") {
    cursorGlow.style.left = event.clientX + "px";
    cursorGlow.style.top = event.clientY + "px";
    cursorGlow.style.opacity = "1";
  }
}, { passive: true });

const contactForm = document.getElementById("contactForm");
const formMessage = document.getElementById("formMessage");
contactForm?.addEventListener("submit", event => {
  event.preventDefault();
  const name = document.getElementById("name")?.value.trim() || "";
  const email = document.getElementById("email")?.value.trim() || "";
  const message = document.getElementById("message")?.value.trim() || "";
  const subject = encodeURIComponent("Portfolio contact — " + name);
  const body = encodeURIComponent("Name: " + name + "\nEmail: " + email + "\n\nMessage:\n" + message);
  if (formMessage) formMessage.textContent = "Opening your email application…";
  window.location.href = "mailto:atharvbulkunde@example.com?subject=" + subject + "&body=" + body;
});
const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();
