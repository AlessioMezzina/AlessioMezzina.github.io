/* ============================================
   PORTFOLIO GOLD STANDARD - ENHANCED JAVASCRIPT
   ============================================ */

// ============================================
// CONFIGURATION & STATE
// ============================================

const CONFIG = {
  LANGUAGE_STORAGE_KEY: 'site-lang',
  THEME_STORAGE_KEY: 'site-theme',
  SUPPORTED_LANGS: ['en', 'it'],
  PARTICLE_COUNT_FACTOR: 45000,
  MAX_PARTICLES: 80,
  CONNECTION_DISTANCE: 150,
  SCROLL_THRESHOLD: 50,
  TILT_MAX: 8,
  MAGNETIC_STRENGTH: 0.3
};

const state = {
  translations: {},
  currentLang: 'en',
  theme: 'light',
  scrollY: 0,
  lastScrollY: 0,
  navHidden: false,
  particles: [],
  mouseX: 0,
  mouseY: 0,
  isLoaded: false
};

// ============================================
// DOM ELEMENTS
// ============================================

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const elements = {
  canvas: null,
  ctx: null,
  preloader: null,
  scrollProgress: null,
  cursor: null,
  nav: null,
  navToggle: null,
  themeToggle: null
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

const lerp = (start, end, factor) => start + (end - start) * factor;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

const throttle = (fn, limit) => {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

const prefersReducedMotion = () => 
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const getNestedValue = (source, path) => 
  path.split('.').reduce((acc, key) => acc?.[key], source);

const t = (path, fallback = '') => 
  getNestedValue(state.translations, path) ?? fallback;

// ============================================
// THEME MANAGEMENT
// ============================================

function initTheme() {
  const stored = localStorage.getItem(CONFIG.THEME_STORAGE_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  state.theme = stored || (prefersDark ? 'dark' : 'light');
  applyTheme(state.theme);
  
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem(CONFIG.THEME_STORAGE_KEY)) {
      state.theme = e.matches ? 'dark' : 'light';
      applyTheme(state.theme);
    }
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  state.theme = theme;
  
  // Update snake game colors if running
  if (typeof updateSnakeColors === 'function') {
    updateSnakeColors();
  }
}

function toggleTheme() {
  const newTheme = state.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem(CONFIG.THEME_STORAGE_KEY, newTheme);
  applyTheme(newTheme);
  
  // Add a subtle animation
  document.body.style.transition = 'background-color 0.5s ease';
}

// ============================================
// INTERNATIONALIZATION
// ============================================

function buildMailto(address, subject, body) {
  const params = [];
  const safeSubject = subject || '';
  const safeBody = body ? body.replace(/\n/g, '\r\n') : '';
  if (safeSubject) params.push(`subject=${encodeURIComponent(safeSubject)}`);
  if (safeBody) params.push(`body=${encodeURIComponent(safeBody)}`);
  const query = params.join('&');
  return query ? `mailto:${address}?${query}` : `mailto:${address}`;
}

function applyTranslations() {
  $$('[data-i18n]').forEach((el) => {
    const value = t(el.dataset.i18n);
    if (value !== undefined) {
      el.textContent = value;
    }
  });

  $$('[data-i18n-attr]').forEach((el) => {
    const attr = el.dataset.i18nAttr;
    const key = el.dataset.i18nAttrKey;
    if (!attr || !key) return;
    const value = t(key);
    if (value !== undefined) {
      el.setAttribute(attr, value);
    }
  });

  $$('[data-mailto]').forEach((el) => {
    const address = el.dataset.mailtoAddress;
    const key = el.dataset.mailto;
    if (!address || !key) return;
    const subject = t(`mailto.${key}.subject`, '');
    const body = t(`mailto.${key}.body`, '');
    el.setAttribute('href', buildMailto(address, subject, body));
  });

  const title = t('meta.title');
  if (title) document.title = title;
  document.documentElement.lang = state.currentLang;
  
  // Redraw snake if needed
  if (typeof snakeRedraw === 'function') snakeRedraw();
}

function updateLanguageButtons() {
  $$('[data-lang]').forEach((btn) => {
    const isActive = btn.dataset.lang === state.currentLang;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

async function loadTranslations(lang) {
  const response = await fetch(`i18n/${lang}.json`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load translations for ${lang}`);
  return response.json();
}

async function setLanguage(lang) {
  const normalized = CONFIG.SUPPORTED_LANGS.includes(lang) ? lang : 'en';
  try {
    state.translations = await loadTranslations(normalized);
    state.currentLang = normalized;
    localStorage.setItem(CONFIG.LANGUAGE_STORAGE_KEY, state.currentLang);
    applyTranslations();
    updateLanguageButtons();
  } catch (err) {
    if (normalized !== 'en') {
      setLanguage('en');
      return;
    }
    console.error(err);
  }
}

function initI18n() {
  $$('[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      if (lang && lang !== state.currentLang) {
        setLanguage(lang);
      }
    });
  });

  const stored = localStorage.getItem(CONFIG.LANGUAGE_STORAGE_KEY);
  const initial = CONFIG.SUPPORTED_LANGS.includes(stored) ? stored : 'en';
  setLanguage(initial);
}

// ============================================
// PARTICLE BACKGROUND
// ============================================

const COLORS = [
  'rgba(31,58,87,0.4)',
  'rgba(185,106,58,0.4)',
  'rgba(15,27,45,0.25)'
];

let canvasWidth = window.innerWidth;
let canvasHeight = window.innerHeight;

function resizeCanvas() {
  canvasWidth = window.innerWidth;
  canvasHeight = window.innerHeight;
  if (elements.canvas) {
    elements.canvas.width = canvasWidth;
    elements.canvas.height = canvasHeight;
  }
}

function createParticles() {
  const count = Math.min(
    CONFIG.MAX_PARTICLES, 
    Math.floor((canvasWidth * canvasHeight) / CONFIG.PARTICLE_COUNT_FACTOR)
  );
  
  state.particles = Array.from({ length: count }, () => ({
    x: Math.random() * canvasWidth,
    y: Math.random() * canvasHeight,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    r: Math.random() * 2 + 0.8,
    color: COLORS[Math.floor(Math.random() * COLORS.length)]
  }));
}

function animateParticles() {
  if (!elements.ctx || prefersReducedMotion()) return;
  
  const ctx = elements.ctx;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Draw connections with distance-based opacity
  const particles = state.particles;
  const connectionDist = CONFIG.CONNECTION_DISTANCE;
  const connectionDistSq = connectionDist * connectionDist;
  
  for (let i = 0; i < particles.length; i++) {
    const p1 = particles[i];
    
    for (let j = i + 1; j < particles.length; j++) {
      const p2 = particles[j];
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const distSq = dx * dx + dy * dy;
      
      if (distSq < connectionDistSq) {
        const alpha = (1 - distSq / connectionDistSq) * 0.15;
        ctx.strokeStyle = `rgba(31,58,87,${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
  }

  // Draw and update particles
  particles.forEach((p) => {
    // Mouse interaction - subtle attraction
    const dx = state.mouseX - p.x;
    const dy = state.mouseY - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < 200 && dist > 0) {
      const force = (200 - dist) / 200 * 0.0003;
      p.vx += dx * force;
      p.vy += dy * force;
    }
    
    // Apply velocity with damping
    p.vx *= 0.99;
    p.vy *= 0.99;
    
    // Clamp velocity
    p.vx = clamp(p.vx, -0.5, 0.5);
    p.vy = clamp(p.vy, -0.5, 0.5);
    
    p.x += p.vx;
    p.y += p.vy;

    // Wrap around edges
    if (p.x < -10) p.x = canvasWidth + 10;
    if (p.x > canvasWidth + 10) p.x = -10;
    if (p.y < -10) p.y = canvasHeight + 10;
    if (p.y > canvasHeight + 10) p.y = -10;

    // Draw particle
    ctx.beginPath();
    ctx.fillStyle = p.color;
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });

  requestAnimationFrame(animateParticles);
}

function initParticles() {
  elements.canvas = $('#bg-canvas');
  if (!elements.canvas) return;
  
  elements.ctx = elements.canvas.getContext('2d');
  resizeCanvas();
  createParticles();
  
  if (!prefersReducedMotion()) {
    requestAnimationFrame(animateParticles);
  }
}

// ============================================
// CUSTOM CURSOR
// ============================================

function initCursor() {
  if (prefersReducedMotion() || !window.matchMedia('(hover: hover)').matches) return;
  
  elements.cursor = $('.cursor');
  if (!elements.cursor) return;
  
  let cursorX = 0;
  let cursorY = 0;
  let targetX = 0;
  let targetY = 0;
  
  document.addEventListener('mousemove', (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
    state.mouseX = e.clientX;
    state.mouseY = e.clientY;
  });
  
  // Smooth cursor animation
  function animateCursor() {
    cursorX = lerp(cursorX, targetX, 0.15);
    cursorY = lerp(cursorY, targetY, 0.15);
    
    elements.cursor.style.left = `${cursorX}px`;
    elements.cursor.style.top = `${cursorY}px`;
    
    requestAnimationFrame(animateCursor);
  }
  animateCursor();
  
  // Hover states
  const interactiveElements = 'a, button, .button, .project-card, .card, .chip, input, textarea';
  
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest(interactiveElements)) {
      elements.cursor.classList.add('hover');
    }
  });
  
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest(interactiveElements)) {
      elements.cursor.classList.remove('hover');
    }
  });
  
  // Click animation
  document.addEventListener('mousedown', () => {
    elements.cursor.classList.add('clicking');
  });
  
  document.addEventListener('mouseup', () => {
    elements.cursor.classList.remove('clicking');
  });
}

// ============================================
// SCROLL EFFECTS
// ============================================

function initScrollProgress() {
  elements.scrollProgress = $('.scroll-progress');
  if (!elements.scrollProgress) return;
  
  function updateProgress() {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = (window.scrollY / scrollHeight) * 100;
    elements.scrollProgress.style.width = `${progress}%`;
  }
  
  window.addEventListener('scroll', throttle(updateProgress, 16), { passive: true });
  updateProgress();
}

function initNavScroll() {
  elements.nav = $('.nav');
  if (!elements.nav) return;
  
  let lastScrollY = 0;
  
  function handleScroll() {
    const currentScrollY = window.scrollY;
    
    // Add/remove scrolled class
    elements.nav.classList.toggle('scrolled', currentScrollY > CONFIG.SCROLL_THRESHOLD);
    
    // Hide/show nav on scroll direction
    if (currentScrollY > lastScrollY && currentScrollY > 200) {
      elements.nav.classList.add('hidden');
    } else {
      elements.nav.classList.remove('hidden');
    }
    
    lastScrollY = currentScrollY;
  }
  
  window.addEventListener('scroll', throttle(handleScroll, 100), { passive: true });
}

function initActiveNavLink() {
  const sections = $$('section[id]');
  const navLinks = $$('.nav nav a[href^="#"]');
  
  function updateActiveLink() {
    const scrollY = window.scrollY + 150;
    
    sections.forEach((section) => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      const sectionId = section.getAttribute('id');
      
      if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
        navLinks.forEach((link) => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${sectionId}`) {
            link.classList.add('active');
          }
        });
      }
    });
  }
  
  window.addEventListener('scroll', throttle(updateActiveLink, 100), { passive: true });
  updateActiveLink();
}

// ============================================
// INTERSECTION OBSERVER ANIMATIONS
// ============================================

function initAnimations() {
  if (prefersReducedMotion()) {
    $$('[data-animate]').forEach((el) => el.classList.add('visible'));
    return;
  }
  
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
  );

  $$('[data-animate]').forEach((el) => observer.observe(el));
}

// ============================================
// 3D TILT EFFECT
// ============================================

function initTiltEffect() {
  if (prefersReducedMotion()) return;
  
  const tiltElements = $$('.hero__card, .project-card:not(.static)');
  
  tiltElements.forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = ((y - centerY) / centerY) * -CONFIG.TILT_MAX;
      const rotateY = ((x - centerX) / centerX) * CONFIG.TILT_MAX;
      
      el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
    });
    
    el.addEventListener('mouseleave', () => {
      el.style.transform = '';
    });
  });
}

// ============================================
// BUTTON RIPPLE EFFECT
// ============================================

function initRippleEffect() {
  $$('.button').forEach((button) => {
    button.addEventListener('click', function(e) {
      const rect = this.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      
      this.appendChild(ripple);
      
      setTimeout(() => ripple.remove(), 600);
    });
  });
}

// ============================================
// MAGNETIC BUTTONS
// ============================================

function initMagneticButtons() {
  if (prefersReducedMotion()) return;
  
  const magneticElements = $$('.nav__logo, .theme-toggle, .project-btn');
  
  magneticElements.forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      el.style.transform = `translate(${x * CONFIG.MAGNETIC_STRENGTH}px, ${y * CONFIG.MAGNETIC_STRENGTH}px)`;
    });
    
    el.addEventListener('mouseleave', () => {
      el.style.transform = '';
    });
  });
}

// ============================================
// CAROUSEL
// ============================================

function initCarousel(selector, trackSelector, cardSelector) {
  $$(selector).forEach((carousel) => {
    const track = carousel.querySelector(trackSelector);
    const cards = carousel.querySelectorAll(cardSelector);
    const prev = carousel.querySelector('.prev');
    const next = carousel.querySelector('.next');
    if (!track || !cards.length) return;

    let index = 0;

    const scrollToIndex = (i) => {
      const count = cards.length;
      index = (i + count) % count;
      const target = cards[index];
      const left = target.offsetLeft - 8;
      track.scrollTo({ left, behavior: 'smooth' });
    };

    prev?.addEventListener('click', () => scrollToIndex(index - 1));
    next?.addEventListener('click', () => scrollToIndex(index + 1));
    
    // Handle resize
    window.addEventListener('resize', debounce(() => scrollToIndex(index), 100));
    
    // Touch swipe support
    let touchStartX = 0;
    let touchEndX = 0;
    
    track.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    track.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      const diff = touchStartX - touchEndX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) scrollToIndex(index + 1);
        else scrollToIndex(index - 1);
      }
    }, { passive: true });
    
    scrollToIndex(0);
  });
}

// ============================================
// MOBILE NAVIGATION
// ============================================

function initMobileNav() {
  elements.navToggle = $('.nav__toggle');
  elements.nav = $('.nav');
  
  if (!elements.navToggle || !elements.nav) return;
  
  elements.navToggle.addEventListener('click', () => {
    elements.navToggle.classList.toggle('active');
    elements.nav.classList.toggle('nav-open');
  });
  
  // Close nav when clicking a link
  $$('.nav nav a').forEach((link) => {
    link.addEventListener('click', () => {
      elements.navToggle.classList.remove('active');
      elements.nav.classList.remove('nav-open');
    });
  });
  
  // Close nav when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav') && elements.nav.classList.contains('nav-open')) {
      elements.navToggle.classList.remove('active');
      elements.nav.classList.remove('nav-open');
    }
  });
}

// ============================================
// THEME TOGGLE
// ============================================

function initThemeToggle() {
  elements.themeToggle = $('.theme-toggle');
  if (!elements.themeToggle) return;
  
  elements.themeToggle.addEventListener('click', toggleTheme);
}

// ============================================
// PRELOADER
// ============================================

function initPreloader() {
  elements.preloader = $('.preloader');
  if (!elements.preloader) return;
  
  // Hide preloader when page is fully loaded
  window.addEventListener('load', () => {
    setTimeout(() => {
      elements.preloader.classList.add('hidden');
      state.isLoaded = true;
      document.body.classList.add('loaded');
    }, 800);
  });
  
  // Fallback: hide after 3 seconds regardless
  setTimeout(() => {
    if (!state.isLoaded) {
      elements.preloader.classList.add('hidden');
      state.isLoaded = true;
    }
  }, 3000);
}

// ============================================
// SMOOTH SCROLL
// ============================================

function initSmoothScroll() {
  $$('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#' || href === '#top') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// ============================================
// SNAKE GAME
// ============================================

let snakeRedraw = null;

function initSnakeGame() {
  const canvas = $('#snake-canvas');
  const scoreEl = $('#snake-score');
  const bestEl = $('#snake-best');
  const startBtn = $('#snake-start');
  const padBtns = $$('.pad-btn');
  
  if (!canvas || !scoreEl || !bestEl || !startBtn) return;

  const ctx = canvas.getContext('2d');
  const gameState = {
    size: 18,
    cell: 20,
    snake: [],
    dir: { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    food: { x: 5, y: 5 },
    running: false,
    loop: null,
    score: 0,
    best: parseInt(localStorage.getItem('snake-best') || '0', 10)
  };

  function getColors() {
    const isDark = state.theme === 'dark';
    return {
      bg: isDark ? '#1a1f26' : '#f7f4ee',
      grid: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,27,45,0.08)',
      snake: isDark ? '#4a8bc2' : '#1f3a57',
      head: isDark ? '#e8885a' : '#b96a3a',
      food: '#3f8f4a',
      text: isDark ? '#f0f4f8' : '#0f1b2d'
    };
  }

  function resizeBoard() {
    const wrap = canvas.parentElement;
    const max = Math.min(wrap.clientWidth, 520);
    const px = Math.max(260, max);
    canvas.width = px;
    canvas.height = px;
    gameState.cell = Math.floor(px / gameState.size);
  }

  function reset() {
    resizeBoard();
    gameState.snake = [
      { x: 4, y: 9 },
      { x: 3, y: 9 },
      { x: 2, y: 9 }
    ];
    gameState.dir = { x: 1, y: 0 };
    gameState.nextDir = { x: 1, y: 0 };
    gameState.food = randomFood();
    gameState.score = 0;
    scoreEl.textContent = gameState.score;
    bestEl.textContent = gameState.best;
    gameState.running = true;
    if (gameState.loop) clearInterval(gameState.loop);
    gameState.loop = setInterval(tick, 120);
    draw();
  }

  function randomFood() {
    let p;
    do {
      p = {
        x: Math.floor(Math.random() * gameState.size),
        y: Math.floor(Math.random() * gameState.size)
      };
    } while (gameState.snake.some((s) => s.x === p.x && s.y === p.y));
    return p;
  }

  function setDir(x, y) {
    if (gameState.dir.x === -x && gameState.dir.y === -y) return;
    gameState.nextDir = { x, y };
  }

  function tick() {
    if (!gameState.running) return;
    gameState.dir = { ...gameState.nextDir };
    const head = { 
      x: gameState.snake[0].x + gameState.dir.x, 
      y: gameState.snake[0].y + gameState.dir.y 
    };

    // Wrap around
    head.x = (head.x + gameState.size) % gameState.size;
    head.y = (head.y + gameState.size) % gameState.size;

    if (gameState.snake.some((s) => s.x === head.x && s.y === head.y)) {
      gameState.running = false;
      draw();
      return;
    }

    gameState.snake.unshift(head);
    if (head.x === gameState.food.x && head.y === gameState.food.y) {
      gameState.score += 1;
      scoreEl.textContent = gameState.score;
      if (gameState.score > gameState.best) {
        gameState.best = gameState.score;
        localStorage.setItem('snake-best', String(gameState.best));
        bestEl.textContent = gameState.best;
      }
      gameState.food = randomFood();
    } else {
      gameState.snake.pop();
    }
    draw();
  }

  function draw() {
    const { cell, size } = gameState;
    const colors = getColors();
    
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

    // Food with glow
    ctx.shadowColor = colors.food;
    ctx.shadowBlur = 10;
    ctx.fillStyle = colors.food;
    ctx.beginPath();
    ctx.arc(
      gameState.food.x * cell + cell / 2, 
      gameState.food.y * cell + cell / 2, 
      cell / 2 - 3, 
      0, 
      Math.PI * 2
    );
    ctx.fill();
    ctx.shadowBlur = 0;

    // Snake with gradient
    gameState.snake.forEach((seg, idx) => {
      const isHead = idx === 0;
      ctx.fillStyle = isHead ? colors.head : colors.snake;
      
      if (isHead) {
        ctx.shadowColor = colors.head;
        ctx.shadowBlur = 8;
      }
      
      ctx.beginPath();
      ctx.roundRect(
        seg.x * cell + 2, 
        seg.y * cell + 2, 
        cell - 4, 
        cell - 4, 
        4
      );
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    if (!gameState.running) {
      ctx.fillStyle = 'rgba(15,27,45,0.6)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = colors.text;
      ctx.font = "bold 20px 'Fraunces', serif";
      ctx.textAlign = 'center';
      ctx.fillText(t('lab.gameOver', 'Game Over - Press Start'), canvas.width / 2, canvas.height / 2);
    }
  }

  // Update colors function for theme changes
  window.updateSnakeColors = draw;

  function handleKey(e) {
    const key = e.key.toLowerCase();
    if (key === 'arrowup' || key === 'w') { e.preventDefault(); setDir(0, -1); }
    else if (key === 'arrowdown' || key === 's') { e.preventDefault(); setDir(0, 1); }
    else if (key === 'arrowleft' || key === 'a') { e.preventDefault(); setDir(-1, 0); }
    else if (key === 'arrowright' || key === 'd') { e.preventDefault(); setDir(1, 0); }
  }

  let touchStart = null;
  function handleTouchStart(e) {
    const touch = e.touches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  }
  
  function handleTouchMove(e) {
    if (!touchStart) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX < 20 && absY < 20) return;
    if (absX > absY) setDir(dx > 0 ? 1 : -1, 0);
    else setDir(0, dy > 0 ? 1 : -1);
    touchStart = null;
  }

  startBtn.addEventListener('click', reset);
  padBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const dir = btn.dataset.dir;
      if (dir === 'up') setDir(0, -1);
      if (dir === 'down') setDir(0, 1);
      if (dir === 'left') setDir(-1, 0);
      if (dir === 'right') setDir(1, 0);
    });
  });
  
  window.addEventListener('keydown', handleKey);
  canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
  canvas.addEventListener('touchmove', handleTouchMove, { passive: true });
  window.addEventListener('resize', debounce(() => { resizeBoard(); draw(); }, 100));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && gameState.running) {
      // Pause when tab is hidden
    }
  });

  resizeBoard();
  bestEl.textContent = gameState.best;
  draw();
  snakeRedraw = draw;
}

// ============================================
// KEYBOARD NAVIGATION
// ============================================

function initKeyboardNav() {
  document.addEventListener('keydown', (e) => {
    // Escape closes mobile nav
    if (e.key === 'Escape' && elements.nav?.classList.contains('nav-open')) {
      elements.navToggle?.classList.remove('active');
      elements.nav.classList.remove('nav-open');
    }
    
    // Slash focuses search (if implemented)
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      const searchInput = $('input[type="search"]');
      if (searchInput) {
        e.preventDefault();
        searchInput.focus();
      }
    }
  });
}

// ============================================
// PERFORMANCE OPTIMIZATIONS
// ============================================

function initPerformanceOptimizations() {
  // Lazy load images
  const lazyImages = $$('img[loading="lazy"]');
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
          }
          imageObserver.unobserve(img);
        }
      });
    });
    
    lazyImages.forEach((img) => imageObserver.observe(img));
  }
  
  // Pause animations when tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      document.body.classList.add('paused');
    } else {
      document.body.classList.remove('paused');
    }
  });
}

// ============================================
// INITIALIZATION
// ============================================

function init() {
  // Core functionality
  initTheme();
  initI18n();
  initPreloader();
  
  // Visual effects
  initParticles();
  initCursor();
  initScrollProgress();
  initAnimations();
  
  // Navigation
  initNavScroll();
  initActiveNavLink();
  initMobileNav();
  initThemeToggle();
  initSmoothScroll();
  initKeyboardNav();
  
  // Interactions
  initTiltEffect();
  initRippleEffect();
  initMagneticButtons();
  
  // Components
  initCarousel('.project-carousel', '.project-track', '.project-card');
  initCarousel('.roles-carousel', '.roles-track', '.role-card');
  initSnakeGame();
  
  // Performance
  initPerformanceOptimizations();
  
  // Handle resize
  window.addEventListener('resize', debounce(() => {
    resizeCanvas();
    createParticles();
  }, 200));
  
  console.log('🚀 Portfolio initialized successfully!');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
