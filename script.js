const canvas = document.getElementById("bg-canvas");
const ctx = canvas.getContext("2d");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let particles = [];
let w = window.innerWidth;
let h = window.innerHeight;
let translations = {};
let currentLang = "en";
let snakeRedraw = null;

const LANGUAGE_STORAGE_KEY = "site-lang";
const SUPPORTED_LANGS = ["en", "it"];

const COLORS = [
  "rgba(31,58,87,0.35)",
  "rgba(185,106,58,0.35)",
  "rgba(15,27,45,0.2)"
];

function getNestedValue(source, path) {
  return path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), source);
}

function t(path, fallback = "") {
  const value = getNestedValue(translations, path);
  return value === undefined ? fallback : value;
}

function buildMailto(address, subject, body) {
  const params = new URLSearchParams();
  const safeSubject = subject || "";
  const safeBody = body ? body.replace(/\n/g, "\r\n") : "";
  if (safeSubject) params.set("subject", safeSubject);
  if (safeBody) params.set("body", safeBody);
  const query = params.toString();
  return query ? `mailto:${address}?${query}` : `mailto:${address}`;
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const value = t(el.dataset.i18n);
    if (value !== undefined) {
      el.textContent = value;
    }
  });

  document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    const attr = el.dataset.i18nAttr;
    const key = el.dataset.i18nAttrKey;
    if (!attr || !key) return;
    const value = t(key);
    if (value !== undefined) {
      el.setAttribute(attr, value);
    }
  });

  document.querySelectorAll("[data-mailto]").forEach((el) => {
    const address = el.dataset.mailtoAddress;
    const key = el.dataset.mailto;
    if (!address || !key) return;
    const subject = t(`mailto.${key}.subject`, "");
    const body = t(`mailto.${key}.body`, "");
    el.setAttribute("href", buildMailto(address, subject, body));
  });

  const title = t("meta.title");
  if (title) {
    document.title = title;
  }

  document.documentElement.lang = currentLang;

  if (snakeRedraw) {
    snakeRedraw();
  }
}

function updateLanguageButtons() {
  document.querySelectorAll("[data-lang]").forEach((btn) => {
    const isActive = btn.dataset.lang === currentLang;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

async function loadTranslations(lang) {
  const response = await fetch(`i18n/${lang}.json`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load translations for ${lang}`);
  }
  return response.json();
}

async function setLanguage(lang) {
  const normalized = SUPPORTED_LANGS.includes(lang) ? lang : "en";
  try {
    translations = await loadTranslations(normalized);
    currentLang = normalized;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLang);
    applyTranslations();
    updateLanguageButtons();
  } catch (err) {
    if (normalized !== "en") {
      setLanguage("en");
      return;
    }
    console.error(err);
  }
}

function initI18n() {
  document.querySelectorAll("[data-lang]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lang = btn.dataset.lang;
      if (lang && lang !== currentLang) {
        setLanguage(lang);
      }
    });
  });

  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  const initial = SUPPORTED_LANGS.includes(stored) ? stored : "en";
  setLanguage(initial);
}

function resize() {
  w = window.innerWidth;
  h = window.innerHeight;
  canvas.width = w;
  canvas.height = h;
}

function createParticles() {
  const count = Math.min(60, Math.floor((w * h) / 38000));
  particles = Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.25,
    vy: (Math.random() - 0.5) * 0.25,
    r: Math.random() * 1.6 + 0.6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)]
  }));
}

function step() {
  ctx.clearRect(0, 0, w, h);

  // Draw connections (limited neighbors for perf)
  for (let i = 0; i < particles.length; i++) {
    const p1 = particles[i];
    for (let j = i + 1; j < Math.min(particles.length, i + 12); j++) {
      const p2 = particles[j];
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const dist2 = dx * dx + dy * dy;
      if (dist2 < 140 * 140) {
        const alpha = 1 - dist2 / (140 * 140);
        ctx.strokeStyle = `rgba(31,58,87,${alpha * 0.12})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
  }

  // Draw particles
  particles.forEach((p) => {
    ctx.beginPath();
    ctx.fillStyle = p.color;
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();

    p.x += p.vx;
    p.y += p.vy;

    if (p.x < -10) p.x = w + 10;
    if (p.x > w + 10) p.x = -10;
    if (p.y < -10) p.y = h + 10;
    if (p.y > h + 10) p.y = -10;
  });

  if (!prefersReducedMotion) {
    requestAnimationFrame(step);
  }
}

function animateSections() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );

  document.querySelectorAll("[data-animate]").forEach((el) => observer.observe(el));
}

function initCarousel() {
  document.querySelectorAll(".project-carousel").forEach((carousel) => {
    const track = carousel.querySelector(".project-track");
    const cards = carousel.querySelectorAll(".project-card");
    const prev = carousel.querySelector(".prev");
    const next = carousel.querySelector(".next");
    if (!track || !cards.length) return;

    let index = 0;

    const scrollToIndex = (i) => {
      const count = cards.length;
      index = (i + count) % count;
      const target = cards[index];
      const left = target.offsetLeft - 6; // align with padding
      track.scrollTo({ left, behavior: "smooth" });
    };

    prev?.addEventListener("click", () => scrollToIndex(index - 1));
    next?.addEventListener("click", () => scrollToIndex(index + 1));
    window.addEventListener("resize", () => scrollToIndex(index));
    scrollToIndex(0);
  });
}

window.addEventListener("resize", () => {
  resize();
  createParticles();
});

resize();
createParticles();
animateSections();
initCarousel();
if (!prefersReducedMotion) requestAnimationFrame(step);

// Snake game
function initSnakeGame() {
  const canvas = document.getElementById("snake-canvas");
  const scoreEl = document.getElementById("snake-score");
  const bestEl = document.getElementById("snake-best");
  const startBtn = document.getElementById("snake-start");
  const padBtns = document.querySelectorAll(".pad-btn");
  if (!canvas || !scoreEl || !bestEl || !startBtn) return;

  const ctx = canvas.getContext("2d");
  const state = {
    size: 18,
    cell: 20,
    snake: [],
    dir: { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    food: { x: 5, y: 5 },
    running: false,
    loop: null,
    score: 0,
    best: parseInt(localStorage.getItem("snake-best") || "0", 10)
  };

  const colors = {
    bg: "#f7f4ee",
    grid: "rgba(15,27,45,0.08)",
    snake: "#1f3a57",
    head: "#b96a3a",
    food: "#3f8f4a",
    text: "#0f1b2d"
  };

  function resizeBoard() {
    const wrap = canvas.parentElement;
    const max = Math.min(wrap.clientWidth, 520);
    const px = Math.max(260, max);
    canvas.width = px;
    canvas.height = px;
    state.cell = Math.floor(px / state.size);
  }

  function reset() {
    resizeBoard();
    state.snake = [
      { x: 4, y: 9 },
      { x: 3, y: 9 },
      { x: 2, y: 9 }
    ];
    state.dir = { x: 1, y: 0 };
    state.nextDir = { x: 1, y: 0 };
    state.food = randomFood();
    state.score = 0;
    scoreEl.textContent = state.score;
    bestEl.textContent = state.best;
    state.running = true;
    if (state.loop) clearInterval(state.loop);
    state.loop = setInterval(tick, 130);
    draw();
  }

  function randomFood() {
    let p;
    do {
      p = {
        x: Math.floor(Math.random() * state.size),
        y: Math.floor(Math.random() * state.size)
      };
    } while (state.snake.some((s) => s.x === p.x && s.y === p.y));
    return p;
  }

  function setDir(x, y) {
    if (state.dir.x === -x && state.dir.y === -y) return; // prevent reverse
    state.nextDir = { x, y };
  }

  function tick() {
    if (!state.running) return;
    state.dir = { ...state.nextDir };
    const head = { x: state.snake[0].x + state.dir.x, y: state.snake[0].y + state.dir.y };

    // wrap around
    head.x = (head.x + state.size) % state.size;
    head.y = (head.y + state.size) % state.size;

    if (state.snake.some((s) => s.x === head.x && s.y === head.y)) {
      state.running = false;
      draw();
      return;
    }

    state.snake.unshift(head);
    if (head.x === state.food.x && head.y === state.food.y) {
      state.score += 1;
      scoreEl.textContent = state.score;
      if (state.score > state.best) {
        state.best = state.score;
        localStorage.setItem("snake-best", String(state.best));
        bestEl.textContent = state.best;
      }
      state.food = randomFood();
    } else {
      state.snake.pop();
    }
    draw();
  }

  function draw() {
    const { cell, size } = state;
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= size; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cell + 0.5, 0);
      ctx.lineTo(i * cell + 0.5, size * cell);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cell + 0.5);
      ctx.lineTo(size * cell, i * cell + 0.5);
      ctx.stroke();
    }

    // food
    ctx.fillStyle = colors.food;
    ctx.fillRect(state.food.x * cell + 2, state.food.y * cell + 2, cell - 4, cell - 4);

    // snake
    state.snake.forEach((seg, idx) => {
      ctx.fillStyle = idx === 0 ? colors.head : colors.snake;
      ctx.fillRect(seg.x * cell + 2, seg.y * cell + 2, cell - 4, cell - 4);
    });

    if (!state.running) {
      ctx.fillStyle = "rgba(15,27,45,0.45)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = colors.text;
      ctx.font = "bold 22px 'Fraunces', serif";
      ctx.textAlign = "center";
      ctx.fillText(t("lab.gameOver", "Game Over - Start again"), canvas.width / 2, canvas.height / 2);
    }
  }

  function handleKey(e) {
    const key = e.key.toLowerCase();
    if (key === "arrowup" || key === "w") setDir(0, -1);
    else if (key === "arrowdown" || key === "s") setDir(0, 1);
    else if (key === "arrowleft" || key === "a") setDir(-1, 0);
    else if (key === "arrowright" || key === "d") setDir(1, 0);
  }

  let touchStart = null;
  function handleTouchStart(e) {
    const t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }
  function handleTouchMove(e) {
    if (!touchStart) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX < 20 && absY < 20) return;
    if (absX > absY) setDir(dx > 0 ? 1 : -1, 0);
    else setDir(0, dy > 0 ? 1 : -1);
    touchStart = null;
  }

  startBtn.addEventListener("click", reset);
  padBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const dir = btn.dataset.dir;
      if (dir === "up") setDir(0, -1);
      if (dir === "down") setDir(0, 1);
      if (dir === "left") setDir(-1, 0);
      if (dir === "right") setDir(1, 0);
    });
  });
  window.addEventListener("keydown", handleKey);
  canvas.addEventListener("touchstart", handleTouchStart, { passive: true });
  canvas.addEventListener("touchmove", handleTouchMove, { passive: true });
  window.addEventListener("resize", () => {
    resizeBoard();
    draw();
  });

  document.addEventListener("visibilitychange", () => {
    state.running = !document.hidden;
  });

  resizeBoard();
  bestEl.textContent = state.best;
  draw();
  snakeRedraw = draw;
}

initI18n();
initSnakeGame();
