let allResources = [];
let activeCategories = new Set(['All']);
let searchQuery = '';
let hoursFilter = 'All';
let sortOrder = 'default';
let currentView = 'list';
let map = null;
let markers = [];
let bookmarks = JSON.parse(localStorage.getItem('clt-bookmarks') || '[]');

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
async function loadResources() {
  try {
    const response = await fetch('/data/resources.json');
    const data = await response.json();
    allResources = data.resources;

    const params = new URLSearchParams(window.location.search);
    const urlCategory = params.get('category');

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

    renderResources();
  } catch(e) {
    console.error('Could not load resources', e);
  }
}

// ─── FILTER + SORT ───
function getFiltered() {
  let results = allResources.filter(r => {
    const matchCategory =
      activeCategories.has('All') ||
      activeCategories.has(r.category);
    const matchSearch =
      r.name.toLowerCase().includes(searchQuery) ||
      r.category.toLowerCase().includes(searchQuery) ||
      r.description.toLowerCase().includes(searchQuery) ||
      r.address.toLowerCase().includes(searchQuery);
    const matchHours =
      hoursFilter === 'All' ||
      (hoursFilter === '24/7' && r.hours === '24/7') ||
      (hoursFilter === 'Weekday' && r.hours !== '24/7');
    return matchCategory && matchSearch && matchHours;
  });

  if (sortOrder === 'az') results.sort((a, b) => a.name.localeCompare(b.name));
  if (sortOrder === 'za') results.sort((a, b) => b.name.localeCompare(a.name));

  return results;
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
  countEl.innerHTML = `${filtered.length} resource${filtered.length !== 1 ? 's' : ''}${filterLabel}`;

  filtered.forEach(resource => {
    const isBookmarked = bookmarks.includes(resource.id);
    const catClass = resource.category.replace(/ /g, '-');
    const photo = resourcePhotos[resource.name] || 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=600&q=80';
    const card = document.createElement('div');
    card.classList.add('resource-card');
    card.innerHTML = `
      <div class="resource-card-photo" style="background-image:url('${photo}')">
        <div class="resource-card-photo-overlay"></div>
        <div class="resource-card-photo-top">
          <span class="card-category ${catClass}">${resource.category}</span>
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
          <a href="${resource.website}" target="_blank" class="btn-secondary">Visit Website</a>
          <button class="btn-print" onclick="printCard(${resource.id})">Print</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  if (typeof initScrollAnimations === 'function') initScrollAnimations();
}

// ─── MAP VIEW ───
function initMap() {
  if (map) return;
  map = L.map('map').setView([35.2271, -80.8431], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
}

function renderMap() {
  initMap();
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  getFiltered().forEach(resource => {
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
    markers.push(marker);
  });

  setTimeout(() => map.invalidateSize(), 100);
}

// ─── VIEW TOGGLE ───
function setView(view) {
  currentView = view;
  document.getElementById('list-view').classList.toggle('hidden', view === 'map');
  document.getElementById('map-view').classList.toggle('hidden', view === 'list');
  document.getElementById('btn-list').classList.toggle('active', view === 'list');
  document.getElementById('btn-map').classList.toggle('active', view === 'map');
  if (view === 'map') renderMap();
}

// ─── BOOKMARKS ───
function toggleBookmark(id, btn) {
  const idx = bookmarks.indexOf(id);
  if (idx === -1) {
    bookmarks.push(id);
    btn.classList.add('bookmarked');
  } else {
    bookmarks.splice(idx, 1);
    btn.classList.remove('bookmarked');
  }
  localStorage.setItem('clt-bookmarks', JSON.stringify(bookmarks));
}

// ─── PRINT ───
function printCard(id) {
  const resource = allResources.find(r => r.id === id);
  if (!resource) return;
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
  renderResources();
  if (currentView === 'map') renderMap();
});

loadResources();