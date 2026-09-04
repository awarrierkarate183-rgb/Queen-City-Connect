// ─── SPOTLIGHT CARDS ───
async function loadSpotlight() {
  const grid = document.getElementById('spotlight-grid');
  if (!grid) return;
  try {
    const response = await fetch('data/resources.json');
    const data = await response.json();
    const spotlights = data.resources.filter(r => r.spotlight === true);
    spotlights.forEach(resource => {
      const photo = window.QCCPhotos
        ? window.QCCPhotos.forResource(resource)
        : '';
      const card = document.createElement('div');
      card.classList.add('spotlight-card');
      card.innerHTML = `
        <div class="spotlight-card-photo" style="background-image:url('${photo}')">
          <div class="spotlight-card-photo-overlay"></div>
          <div class="spotlight-card-cat">${resource.category}</div>
        </div>
        <div class="spotlight-card-body">
          <h3>${resource.name}</h3>
          <p>${resource.description}</p>
          <div class="spotlight-card-meta">
            <span>${resource.address}</span>
            <span>${resource.phone}</span>
            <span>${resource.hours}</span>
          </div>
          <a href="${resource.website}" target="_blank" class="spotlight-card-link">
            Visit website &rarr;
          </a>
        </div>
      `;
      grid.appendChild(card);
    });
    initScrollAnimations();
  } catch(e) {
    console.error('Could not load spotlight resources', e);
  }
}

// ─── HOMEPAGE MAP ───
async function loadHomeMap() {
  const mapEl = document.getElementById('home-map');
  if (!mapEl || typeof L === 'undefined' || !window.QCCMap) return;
  const map = window.QCCMap.create('home-map');
  const layer = L.layerGroup().addTo(map);
  try {
    const response = await fetch('/data/resources.json');
    const data = await response.json();
    window.QCCMap.draw(layer, data.resources || []);
    setTimeout(() => map.invalidateSize(), 80);
  } catch (e) {
    console.error('Could not load map data', e);
  }
}

// ─── TYPEWRITER EFFECT ───
function initTypewriter() {
  const el = document.getElementById('typewriter');
  if (!el) return;
  const words = ['a way in.', 'a first job.', 'volunteer hours.', 'real help.'];
  let wordIndex = 0;
  let charIndex = 0;
  let deleting = false;

  function type() {
    const current = words[wordIndex];
    if (deleting) {
      el.textContent = current.substring(0, charIndex - 1);
      charIndex--;
    } else {
      el.textContent = current.substring(0, charIndex + 1);
      charIndex++;
    }
    let speed = deleting ? 60 : 100;
    if (!deleting && charIndex === current.length) {
      speed = 2000;
      deleting = true;
    } else if (deleting && charIndex === 0) {
      deleting = false;
      wordIndex = (wordIndex + 1) % words.length;
      speed = 400;
    }
    setTimeout(type, speed);
  }
  setTimeout(type, 800);
}

// ─── ANIMATED COUNTERS ───
function animateCounter(el, target, suffix, duration) {
  let start = 0;
  const isDecimal = target % 1 !== 0;
  const increment = target / (duration / 16);
  const timer = setInterval(() => {
    start += increment;
    if (start >= target) {
      start = target;
      clearInterval(timer);
    }
    el.textContent = (isDecimal ? start.toFixed(1) : Math.floor(start)) + suffix;
  }, 16);
}

function initCounters() {
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.dataset.counted) {
        entry.target.dataset.counted = 'true';
        const target = parseFloat(entry.target.dataset.count);
        const suffix = entry.target.dataset.suffix || '';
        animateCounter(entry.target, target, suffix, 1800);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(c => observer.observe(c));
}

// ─── PARALLAX HERO ───
function initParallax() {
  const hero = document.querySelector('.hero-photo img');
  if (!hero) return;
  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    hero.style.transform = `translateY(${scrolled * 0.15}px)`;
  }, { passive: true });
}

// ─── SCROLL ANIMATIONS ───
function initScrollAnimations() {
  const targets = document.querySelectorAll(
    '.spotlight-card, .about-card, .need-help-card, ' +
    '.about-who-card, .numbers-card, .how-step, .ref-block, ' +
    '.resource-card, .photo-cat-card, .neighborhood-card, ' +
    '.update-item, .update-main, .stat-item, .nbhd-hero-card, ' +
    '.verification-item'
  );
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, entry.target.dataset.delay || 0);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  targets.forEach((el, i) => {
    if (!el.classList.contains('fade-up')) el.classList.add('fade-up');
    el.dataset.delay = (i % 4) * 80;
    observer.observe(el);
  });
}

// ─── SMOOTH SCROLL FOR ANCHOR LINKS ───
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

// ─── NAVBAR SCROLL EFFECT ───
function initNavbar() {
  const nav = document.querySelector('.navbar');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    if (window.scrollY > 10) {
      nav.style.boxShadow = '0 2px 24px rgba(0,0,0,0.12)';
      nav.style.backdropFilter = 'blur(8px)';
    } else {
      nav.style.boxShadow = 'none';
      nav.style.backdropFilter = 'none';
    }
  }, { passive: true });
}

// ─── CARD TILT EFFECT ───
function initCardTilt() {
  document.querySelectorAll('.photo-cat-card, .need-help-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -4;
      const rotateY = ((x - centerX) / centerX) * 4;
      card.style.transform = `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}

// ─── DARK MODE — default ON ───
function toggleDark() {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('clt-dark', isDark);
  const btn = document.getElementById('dark-btn');
  if (btn) btn.innerHTML = isDark ? '&#9728;' : '&#9790;';
}

(function() {
  const saved = localStorage.getItem('clt-dark');
  const isDark = saved === null ? true : saved === 'true';
  if (isDark) {
    document.body.classList.add('dark');
    const btn = document.getElementById('dark-btn');
    if (btn) btn.innerHTML = '&#9728;';
  } else {
    document.body.classList.remove('dark');
    const btn = document.getElementById('dark-btn');
    if (btn) btn.innerHTML = '&#9790;';
  }
})();

// ─── ACTIVE NAV LINK ───
(function() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(link => {
    if (link.getAttribute('href') === page) {
      link.classList.add('nav-active');
    }
  });
})();

function initNewsletter() {
  document.querySelectorAll('.footer-newsletter-form').forEach(form => {
    const input = form.querySelector('input[type="email"]');
    const btn = form.querySelector('.newsletter-signup-btn') || form.querySelector('button');
    if (!input || !btn) return;
    btn.addEventListener('click', async () => {
      const email = input.value.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert('Please enter a valid email address.');
        return;
      }
      if (window.QCCAuth && QCCAuth.user) {
        await QCCAuth.saveState({ newsletterEmail: email }, { immediate: true });
        alert('You are signed up. This email is saved to your account.');
        return;
      }
      alert('Thank you for signing up! Create an account to keep this email saved.');
    });
  });
}

// ─── INIT ───
document.addEventListener('DOMContentLoaded', () => {
  loadSpotlight();
  loadHomeMap();
  initTypewriter();
  initCounters();
  initParallax();
  initScrollAnimations();
  initSmoothScroll();
  initNavbar();
  initCardTilt();
  initNewsletter();
});