let allResources = [];
let activeCategories = new Set(['All']);
let searchQuery = '';
let hoursFilter = 'All';
let sortOrder = 'best';
let currentView = 'list';
let map = null;
let pointsLayer = null;
let bookmarks = JSON.parse(localStorage.getItem('clt-bookmarks') || '[]');
let hubHydrating = false;
let visibleCount = 24;

const resourcePhotos = {
  "Nourish Up": "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=600&q=80",
  "Roof Above": "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=600&q=80",
  "NAMI Charlotte": "https://images.unsplash.com/photo-1559757175-5700dde675bc?w=600&q=80",
  "Crisis Assistance Ministry": "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&q=80",
  "The Relatives": "https://images.unsplash.com/photo-1529390079861-591de354faf5?w=600&q=80",
  "Hope Street Food Pantry": "https://images.unsplash.com/photo-1593113598332-cd288d649433?w=600&q=80",
  "Alexander Youth Network": "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&q=80",
  "Care Ring": "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&q=80",
  "Safe Alliance": "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=600&q=80",
  "United Way of Greater Charlotte": "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=600&q=80",
  "Charlotte Center for Legal Advocacy": "https://images.unsplash.com/photo-1589994965851-a8f479c573a9?w=600&q=80",
  "Mobile Crisis Team (CriSys)": "https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?w=600&q=80",
  "Veterans Bridge Home": "https://images.unsplash.com/photo-1609220136736-443140cffec6?w=600&q=80",
  "Mecklenburg County Veterans Services": "https://images.unsplash.com/photo-1541199249251-f713e6145474?w=600&q=80",
  "Goodwill Industries of the Southern Piedmont": "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=600&q=80",
  "Habitat for Humanity Charlotte": "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=600&q=80",
  "Charlotte Rescue Mission": "https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=600&q=80",
  "Loaves & Fishes": "https://images.unsplash.com/photo-1547496502-affa22d38842?w=600&q=80",
  "Charlotte Community Health Clinic": "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=600&q=80",
  "Salvation Army of Greater Charlotte": "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=600&q=80",
  "Classroom Central": "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&q=80",
  "Communities In Schools of CMS": "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600&q=80",
  "Gracious Hands": "https://images.unsplash.com/photo-1531983412531-1f49a365ffed?w=600&q=80",
  "Charlotte Bilingual Preschool": "https://images.unsplash.com/photo-1588072432836-e10032774350?w=600&q=80",
  "Hospitality House of Charlotte": "https://images.unsplash.com/photo-1460317442991-0ec209397118?w=600&q=80",
  "Passage Home": "https://images.unsplash.com/photo-1460317442991-0ec209397118?w=600&q=80",
  "Second Harvest Food Bank of Metrolina": "https://images.unsplash.com/photo-1601598851547-4302969d0614?w=600&q=80",
  "Charlotte Family Housing": "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=600&q=80",
  "Behavioral Health Center of Mecklenburg County": "https://images.unsplash.com/photo-1573497491208-6b1acb260507?w=600&q=80",
  "Thompson Child & Family Focus": "https://images.unsplash.com/photo-1491013516836-7db643ee125a?w=600&q=80",
  "Latin American Coalition": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&q=80",
  "Ada Jenkins Center": "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600&q=80",
  "NC MedAssist": "https://images.unsplash.com/photo-1550831107-1553da8c8464?w=600&q=80",
  "Dress for Success Charlotte": "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&q=80",
  "Mecklenburg County DSS": "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&q=80",
  "Catholic Charities Diocese of Charlotte": "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=600&q=80",
  "Time Out Youth Center": "https://images.unsplash.com/photo-1529390079861-591de354faf5?w=600&q=80",
  "Anuvia Prevention and Recovery Center": "https://images.unsplash.com/photo-1573497491208-6b1acb260507?w=600&q=80",
  "Dilworth Soup Kitchen": "https://images.unsplash.com/photo-1547496502-affa22d38842?w=600&q=80",
  "International House Charlotte": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&q=80",
  "RAIN of North Carolina": "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&q=80",
  "Crossroads Charlotte": "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=600&q=80",
  "McLeod Addictive Disease Center": "https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?w=600&q=80",
  "Monarch NC": "https://images.unsplash.com/photo-1559757175-5700dde675bc?w=600&q=80",
  "Center for Community Transitions": "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&q=80",
  "Transcend Charlotte": "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=600&q=80",
  "Carolina Refugee Resettlement Agency": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&q=80",
  "Family Support Services of Mecklenburg": "https://images.unsplash.com/photo-1491013516836-7db643ee125a?w=600&q=80",
  "StepUp Ministry": "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=600&q=80",
  "Friendship Trays": "https://images.unsplash.com/photo-1601598851547-4302969d0614?w=600&q=80"
};

// ─── LOAD ───
function applySavedHubPrefs() {
  if (!window.QCCAuth || !QCCAuth.user || !QCCAuth.state) return;

  if (Array.isArray(QCCAuth.state.bookmarks)) {
    bookmarks = QCCAuth.state.bookmarks.map(Number);
    localStorage.setItem('clt-bookmarks', JSON.stringify(bookmarks));
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get('category')) return;

  const prefs = QCCAuth.state.hubPrefs;
  if (!prefs) return;

  if (Array.isArray(prefs.categories) && prefs.categories.length) {
    activeCategories = new Set(prefs.categories);
    const sel = document.getElementById('category-select');
    if (sel) {
      Array.from(sel.options).forEach(o => {
        o.selected = activeCategories.has(o.value);
      });
    }
  }

  if (typeof prefs.search === 'string') {
    searchQuery = prefs.search.toLowerCase().trim();
    const input = document.getElementById('search-input');
    if (input) input.value = prefs.search;
  }

  if (prefs.hours) {
    hoursFilter = prefs.hours;
    const hours = document.getElementById('hours-select');
    if (hours) hours.value = prefs.hours;
  }

  if (prefs.sort) {
    sortOrder = prefs.sort === 'default' ? 'best' : prefs.sort;
    const sort = document.getElementById('sort-select');
    if (sort) sort.value = sortOrder;
  }

  if (prefs.view === 'map' || prefs.view === 'list') {
    setView(prefs.view);
  }
}

function persistHubState(immediate) {
  bookmarks = bookmarks.map(Number).filter((n) => n > 0);
  localStorage.setItem('clt-bookmarks', JSON.stringify(bookmarks));
  if (hubHydrating || !window.QCCAuth || !QCCAuth.user) return;
  QCCAuth.saveState({
    bookmarks,
    hubPrefs: {
      categories: [...activeCategories],
      search: document.getElementById('search-input') ? document.getElementById('search-input').value : searchQuery,
      hours: hoursFilter,
      sort: sortOrder,
      view: currentView
    }
  }, { immediate: !!immediate });
}

async function loadResources() {
  if (window.QCCAuth && QCCAuth.ready) {
    await QCCAuth.ready;
  }
  try {
    const response = await fetch('/data/resources.json');
    const data = await response.json();
    allResources = data.resources;

    const params = new URLSearchParams(window.location.search);
    const urlCategory = params.get('category');

    hubHydrating = true;
    if (urlCategory) {
      activeCategories.clear();
      activeCategories.add(urlCategory);
      const sel = document.getElementById('category-select');
      if (sel) {
        Array.from(sel.options).forEach(o => {
          o.selected = o.value === urlCategory;
        });
      }
    }
    applySavedHubPrefs();
    hubHydrating = false;

    renderResources();
    loadDirectoryMeta();
  } catch(e) {
    hubHydrating = false;
    console.error('Could not load resources', e);
  }
}

// ─── FILTER + SORT ───
function getFiltered() {
  let results = allResources.filter(r => {
    const matchCategory =
      activeCategories.has('All') ||
      activeCategories.has(r.category);
    const hay = `${r.name} ${r.category} ${r.description} ${r.address}`.toLowerCase();
    const matchSearch = !searchQuery || hay.includes(searchQuery);
    const matchHours =
      hoursFilter === 'All' ||
      (hoursFilter === '24/7' && r.hours === '24/7') ||
      (hoursFilter === 'Weekday' && r.hours !== '24/7');
    return matchCategory && matchSearch && matchHours;
  });

  if (sortOrder === 'az') results.sort((a, b) => a.name.localeCompare(b.name));
  else if (sortOrder === 'za') results.sort((a, b) => b.name.localeCompare(a.name));
  else results.sort((a, b) => (Number(b.score) - Number(a.score)) || Number(b.verified) - Number(a.verified) || a.name.localeCompare(b.name));

  return results;
}

function categoryPhoto(category) {
  const photos = {
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
  return photos[category] || photos['General Support'];
}

// ─── RENDER CARDS ───
function renderResources() {
  const grid = document.getElementById('resource-grid');
  const noResults = document.getElementById('no-results');
  const countEl = document.getElementById('results-count');
  const filtered = getFiltered();

  grid.innerHTML = '';

  if (filtered.length === 0) {
    noResults.classList.remove('hidden');
    countEl.textContent = '';
    return;
  }

  noResults.classList.add('hidden');

  let filterLabel = '';
  if (!activeCategories.has('All') && activeCategories.size > 0) {
    const cats = [...activeCategories].join(', ');
    filterLabel = ` in <strong>${cats}</strong>`;
  }
  const page = filtered.slice(0, visibleCount);
  countEl.innerHTML = `${filtered.length.toLocaleString()} resource${filtered.length !== 1 ? 's' : ''}${filterLabel}`;

  page.forEach(resource => {
    const isBookmarked = bookmarks.map(Number).includes(Number(resource.id));
    const catClass = resource.category.replace(/ /g, '-');
    const photo = resourcePhotos[resource.name] || categoryPhoto(resource.category);
    const card = document.createElement('div');
    card.classList.add('resource-card');
    card.innerHTML = `
      <div class="resource-card-photo" style="background-image:url('${photo}')">
        <div class="resource-card-photo-overlay"></div>
        <div class="resource-card-photo-top">
          <span class="card-category ${catClass}">${resource.category}</span>
          ${resource.verified ? '<span class="badge-24">Verified</span>' : ''}
          ${resource.hours === '24/7' ? '<span class="badge-24">24/7</span>' : ''}
          <button class="bookmark-btn ${isBookmarked ? 'bookmarked' : ''}"
            onclick="toggleBookmark(${resource.id}, this)"
            title="${isBookmarked ? 'Remove bookmark' : 'Save resource'}">&#9825;</button>
        </div>
      </div>
      <div class="resource-card-body">
        <h3>${resource.name}</h3>
        <p>${resource.description}</p>
        <div class="card-details">
          <div class="detail-row">
            <span class="detail-label">Address</span>
            <span>${resource.address}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Phone</span>
            <span>${resource.phone}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Hours</span>
            <span>${resource.hours}</span>
          </div>
        </div>
        <div class="card-actions">
          <a href="${resource.website}" target="_blank" class="btn-secondary" onclick="trackResourceUse(${resource.id}, 'website')">Visit Website</a>
          <button class="btn-print" onclick="printCard(${resource.id})">Print</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  const more = document.getElementById('load-more-wrap');
  if (more) more.classList.toggle('hidden', visibleCount >= filtered.length);

  if (typeof initScrollAnimations === 'function') initScrollAnimations();
}

function loadMoreResources() {
  visibleCount += 24;
  renderResources();
}

// ─── MAP VIEW ───
function initMap() {
  if (map) return;
  map = window.QCCMap.create('map');
  pointsLayer = L.layerGroup().addTo(map);
}

function renderMap() {
  initMap();
  const bounds = window.QCCMap.draw(pointsLayer, getFiltered());
  if (bounds.length && (!activeCategories.has('All') || searchQuery)) {
    map.fitBounds(L.latLngBounds(bounds).pad(0.08), { maxZoom: 13, animate: false });
  } else {
    map.setView(window.QCCMap.charlotte, 11);
  }
  setTimeout(() => map.invalidateSize(), 80);
}

// ─── VIEW TOGGLE ───
function setView(view) {
  currentView = view;
  document.getElementById('list-view').classList.toggle('hidden', view === 'map');
  document.getElementById('map-view').classList.toggle('hidden', view === 'list');
  document.getElementById('btn-list').classList.toggle('active', view === 'list');
  document.getElementById('btn-map').classList.toggle('active', view === 'map');
  if (view === 'map') renderMap();
  persistHubState();
}

function trackResourceUse(id, type) {
  if (window.QCCAuth) QCCAuth.recordActivity(type, id);
}

// ─── BOOKMARKS ───
function toggleBookmark(id, btn) {
  id = Number(id);
  const idx = bookmarks.map(Number).indexOf(id);
  if (idx === -1) {
    bookmarks.push(id);
    btn.classList.add('bookmarked');
    if (window.QCCAuth) QCCAuth.recordActivity('bookmark', id);
  } else {
    bookmarks.splice(idx, 1);
    btn.classList.remove('bookmarked');
    if (window.QCCAuth) QCCAuth.recordActivity('unbookmark', id);
  }
  persistHubState(true);
}

// ─── PRINT ───
function printCard(id) {
  const resource = allResources.find(r => r.id === id);
  if (!resource) return;
  trackResourceUse(id, 'print');
  const win = window.open('', '_blank');
  win.document.write(`
    <!DOCTYPE html><html><head>
    <title>${resource.name} - QueenCityConnect</title>
    <style>
      body{font-family:Georgia,serif;padding:40px;color:#1a1a1a;max-width:560px}
      h1{font-size:24px;margin-bottom:4px}
      .cat{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#1a5c38;margin-bottom:16px;display:block}
      p{font-size:14px;color:#3d3d3d;line-height:1.65;margin-bottom:20px}
      .row{font-size:13px;margin-bottom:8px;color:#3d3d3d}
      .lbl{font-weight:700;display:inline-block;min-width:60px}
      .foot{margin-top:40px;font-size:11px;color:#9a9a9a;border-top:1px solid #e8e4df;padding-top:12px}
    </style></head><body>
    <h1>${resource.name}</h1>
    <span class="cat">${resource.category}</span>
    <p>${resource.description}</p>
    <div class="row"><span class="lbl">Address</span>${resource.address}</div>
    <div class="row"><span class="lbl">Phone</span>${resource.phone}</div>
    <div class="row"><span class="lbl">Hours</span>${resource.hours}</div>
    <div class="row"><span class="lbl">Website</span>${resource.website}</div>
    <div class="foot">QueenCityConnect - Charlotte Community Resource Directory</div>
    <script>window.onload=()=>{window.print();window.close()}<\/script>
    </body></html>
  `);
  win.document.close();
}

// ─── SEARCH ───
document.getElementById('search-input').addEventListener('input', e => {
  searchQuery = e.target.value.toLowerCase().trim();
  visibleCount = 24;
  renderResources();
  if (currentView === 'map') renderMap();
  persistHubState();
});

function toggleHubFilters() {
  const masthead = document.getElementById('hub-masthead');
  const toggle = document.getElementById('hub-title-toggle');
  if (!masthead || !toggle) return;
  const open = !masthead.classList.contains('is-open');
  masthead.classList.toggle('is-open', open);
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function initHubTitleFade() {
  const scroll = document.querySelector('.hub-scroll');
  const title = document.getElementById('hub-title-block');
  if (!scroll || !title) return;
  const update = () => {
    const t = Math.min(1, scroll.scrollTop / 70);
    title.style.opacity = String(1 - t);
    title.style.transform = `translateY(${-10 * t}px)`;
    title.classList.toggle('is-faded', t > 0.85);
  };
  scroll.addEventListener('scroll', update, { passive: true });
  update();
}

async function loadDirectoryMeta() {
  const el = document.getElementById('directory-updated');
  if (!el) return;
  try {
    const meta = await fetch('/api/resources/meta').then((r) => r.json());
    const count = Number(meta.count || allResources.length).toLocaleString();
    const when = meta.lastUpdated ? new Date(meta.lastUpdated).toLocaleDateString() : 'today';
    el.textContent = `${count} listings in Charlotte-Mecklenburg · updated ${when} · auto-refreshes every 2 weeks`;
  } catch {
    el.textContent = `${allResources.length.toLocaleString()} listings in Charlotte-Mecklenburg`;
  }
}

loadResources();
initHubTitleFade();