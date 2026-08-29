// ─── RESOURCE & CATEGORY PHOTOS ───
const categoryPhotos = {
  "Food": "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=600&q=80",
  "Housing": "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=600&q=80",
  "Health": "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&q=80",
  "Mental Health": "https://images.unsplash.com/photo-1559757175-5700dde675bc?w=600&q=80",
  "Youth": "https://images.unsplash.com/photo-1529390079861-591de354faf5?w=600&q=80",
  "Safety": "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=600&q=80",
  "Legal Aid": "https://images.unsplash.com/photo-1589994965851-a8f479c573a9?w=600&q=80",
  "Financial Aid": "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&q=80",
  "General Support": "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=600&q=80",
  "Veterans": "https://images.unsplash.com/photo-1609220136736-443140cffec6?w=600&q=80",
  "Employment": "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=600&q=80",
  "Education": "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&q=80"
};

// ─── SPOTLIGHT CARDS ───
async function loadSpotlight() {
  const grid = document.getElementById('spotlight-grid');
  if (!grid) return;
  try {
    const response = await fetch('/data/resources.json');
    const data = await response.json();
    const spotlights = data.resources.filter(r => r.spotlight === true);
    spotlights.forEach(resource => {
      const photo = categoryPhotos[resource.category] || categoryPhotos['General Support'];
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
const coordinates = {
  "Nourish Up": [35.2397, -80.8329],
  "Roof Above": [35.2368, -80.8364],
  "NAMI Charlotte": [35.2085, -80.8391],
  "Crisis Assistance Ministry": [35.2397, -80.834],
  "The Relatives": [35.2201, -80.8712],
  "Hope Street Food Pantry": [35.3412, -80.7923],
  "Alexander Youth Network": [35.2271, -80.8101],
  "Care Ring": [35.1401, -80.9312],
  "Safe Alliance": [35.2289, -80.8321],
  "United Way of Greater Charlotte": [35.2241, -80.8431],
  "Charlotte Center for Legal Advocacy": [35.2118, -80.8401],
  "Mobile Crisis Team (CriSys)": [35.2271, -80.852],
  "Veterans Bridge Home": [35.1801, -80.9012],
  "Mecklenburg County Veterans Services": [35.2198, -80.8743],
  "Goodwill Industries of the Southern Piedmont": [35.2198, -80.8712],
  "Habitat for Humanity Charlotte": [35.1912, -80.9101],
  "Charlotte Rescue Mission": [35.2312, -80.8289],
  "Loaves & Fishes": [35.2412, -80.8312],
  "Charlotte Community Health Clinic": [35.3185, -80.7589],
  "Salvation Army of Greater Charlotte": [35.2389, -80.8334],
  "Classroom Central": [35.2234, -80.8756],
  "Communities In Schools of CMS": [35.1989, -80.7823],
  "Gracious Hands": [35.2156, -80.8523],
  "Charlotte Bilingual Preschool": [35.2312, -80.8012],
  "Hospitality House of Charlotte": [35.2178, -80.8267],
  "Passage Home": [35.2156, -80.8534],
  "Second Harvest Food Bank of Metrolina": [35.2198, -80.8445],
  "Charlotte Family Housing": [35.2334, -80.8312],
  "Behavioral Health Center of Mecklenburg County": [35.1723, -80.8134],
  "Thompson Child & Family Focus": [35.1156, -80.7023],
  "Latin American Coalition": [35.2378, -80.8256],
  "Ada Jenkins Center": [35.4998, -80.8134],
  "NC MedAssist": [35.2089, -80.8312],
  "Dress for Success Charlotte": [35.2134, -80.8089],
  "Mecklenburg County DSS": [35.1734, -80.8145],
  "Catholic Charities Diocese of Charlotte": [35.2089, -80.8534],
  "Time Out Youth Center": [35.2134, -80.8001],
  "Anuvia Prevention and Recovery Center": [35.1756, -80.8134],
  "Dilworth Soup Kitchen": [35.2089, -80.8423],
  "International House Charlotte": [35.2156, -80.8001],
  "RAIN of North Carolina": [35.2267, -80.8378],
  "Crossroads Charlotte": [35.2201, -80.8456],
  "McLeod Addictive Disease Center": [35.1923, -80.8756],
  "Monarch NC": [35.1989, -80.7934],
  "Center for Community Transitions": [35.2934, -80.7823],
  "Transcend Charlotte": [35.2134, -80.8012],
  "Carolina Refugee Resettlement Agency": [35.2134, -80.7934],
  "Family Support Services of Mecklenburg": [35.2312, -80.8401],
  "StepUp Ministry": [35.2289, -80.8089],
  "Friendship Trays": [35.2267, -80.8045]
};

const categoryColors = {
  "Food": "#ef4444",
  "Housing": "#10b981",
  "Health": "#3b82f6",
  "Mental Health": "#8b5cf6",
  "Youth": "#f59e0b",
  "Safety": "#ec4899",
  "Legal Aid": "#6366f1",
  "Financial Aid": "#14b8a6",
  "General Support": "#64748b",
  "Veterans": "#dc2626",
  "Employment": "#16a34a",
  "Education": "#7c3aed"
};

async function loadHomeMap() {
  const mapEl = document.getElementById('home-map');
  if (!mapEl || typeof L === 'undefined') return;
  const map = L.map('home-map').setView([35.2271, -80.8431], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  try {
    const response = await fetch('/data/resources.json');
    const data = await response.json();
    data.resources.forEach(resource => {
      const coords = coordinates[resource.name];
      if (!coords) return;
      const color = categoryColors[resource.category] || '#64748b';
      const icon = L.divIcon({
        html: `<div style="width:12px;height:12px;background:${color};border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.25)"></div>`,
        className: '',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });
      const marker = L.marker(coords, { icon }).addTo(map);
      marker.bindPopup(`
        <div style="min-width:200px;font-family:'DM Sans',system-ui,sans-serif;padding:4px">
          <strong style="font-size:14px;color:#1a1a1a;display:block;margin-bottom:4px">${resource.name}</strong>
          <span style="font-size:11px;color:#9a9a9a;font-weight:700;text-transform:uppercase;letter-spacing:0.06em">${resource.category}</span>
          <hr style="border:none;border-top:1px solid #e8e4df;margin:8px 0"/>
          <span style="font-size:12px;color:#3d3d3d;display:block;margin-bottom:3px">${resource.phone}</span>
          <span style="font-size:12px;color:#3d3d3d;display:block;margin-bottom:10px">${resource.hours}</span>
          <a href="${resource.website}" target="_blank" style="font-size:13px;color:#1a5c38;font-weight:600;text-decoration:none">Visit website &rarr;</a>
        </div>
      `);
    });
  } catch(e) {
    console.error('Could not load map data', e);
  }
}

// ─── TYPEWRITER EFFECT ───
function initTypewriter() {
  const el = document.getElementById('typewriter');
  if (!el) return;
  const words = ['support.', 'community.', 'connection.', 'hope.'];
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
});