window.QCCMap = {
  categoryColors: {
    "Food": "#ef4444",
    "Housing": "#10b981",
    "Health": "#3b82f6",
    "Mental Health": "#8b5cf6",
    "Youth": "#f59e0b",
    "Safety": "#ec4899",
    "Legal Aid": "#6366f1",
    "Financial Aid": "#14b8a6",
    "General Support": "#94a3b8",
    "Veterans": "#dc2626",
    "Volunteer": "#f97316",
    "Internships": "#0ea5e9",
    "Employment": "#16a34a",
    "Education": "#7c3aed"
  },

  charlotte: [35.2271, -80.8431],

  isMappable(resource) {
    const lat = Number(resource && resource.lat);
    const lng = Number(resource && resource.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    if (resource.mappable === false) return false;
    const address = String(resource.address || '').toLowerCase();
    if (/available anywhere|countywide|statewide|p\.o\. box|partner sites|planting sites|chapters welcome|program site posted|event sites|services listed online|freedom school sites/.test(address)) {
      return false;
    }
    if (address === 'charlotte, nc' || address === 'charlotte nc') return false;
    return lat >= 35.05 && lat <= 35.52 && lng >= -81.05 && lng <= -80.64;
  },

  create(elementId) {
    const map = L.map(elementId, {
      preferCanvas: true,
      renderer: L.canvas({ padding: 0.4, tolerance: 8 }),
      zoomControl: true,
      scrollWheelZoom: true
    }).setView(this.charlotte, 11);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19
    }).addTo(map);

    return map;
  },

  popupHtml(resource) {
    const color = this.categoryColors[resource.category] || '#94a3b8';
    const phone = resource.phone && resource.phone !== 'See listing' ? resource.phone : '';
    const website = resource.website && resource.website !== '#' ? resource.website : '';
    const address = resource.address && !String(resource.address).startsWith('Charlotte-Mecklenburg')
      ? resource.address : '';
    const photo = window.QCCPhotos ? window.QCCPhotos.forResource(resource) : '';
    return `
      <div class="qcc-map-popup">
        ${photo ? `<div class="qcc-map-popup-photo" style="background-image:url('${photo}')"></div>` : ''}
        <strong>${resource.name || ''}</strong>
        <span class="qcc-map-popup-cat"><i style="background:${color}"></i>${resource.category || ''}${resource.verified ? ' · Verified' : ''}</span>
        ${address ? `<span>${address}</span>` : ''}
        ${phone ? `<span>${phone}</span>` : ''}
        ${website ? `<a href="${website}" target="_blank" rel="noopener">Visit website &rarr;</a>` : ''}
      </div>
    `;
  },

  marker(resource, lat, lng) {
    const color = this.categoryColors[resource.category] || '#94a3b8';
    const marker = L.circleMarker([lat, lng], {
      radius: resource.verified ? 8 : 6.5,
      color: '#fff',
      weight: 2,
      fillColor: color,
      fillOpacity: 0.95,
      opacity: 1
    });
    marker.bindPopup(this.popupHtml(resource), { maxWidth: 280, className: 'qcc-popup-wrap' });
    return marker;
  },

  spreadOverlaps(points) {
    const groups = new Map();
    points.forEach((point) => {
      const key = point.lat.toFixed(4) + ',' + point.lng.toFixed(4);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(point);
    });
    const out = [];
    groups.forEach((list) => {
      if (list.length === 1) {
        out.push(list[0]);
        return;
      }
      list.forEach((point, i) => {
        const angle = (2 * Math.PI * i) / list.length;
        const dist = 0.00022 * Math.ceil((i + 1) / 8);
        out.push({
          ...point,
          lat: point.lat + Math.cos(angle) * dist,
          lng: point.lng + Math.sin(angle) * dist
        });
      });
    });
    return out;
  },

  draw(layer, resources) {
    layer.clearLayers();
    const raw = [];
    (resources || []).forEach((resource) => {
      if (!this.isMappable(resource)) return;
      raw.push({ resource, lat: Number(resource.lat), lng: Number(resource.lng) });
    });
    const bounds = [];
    this.spreadOverlaps(raw).forEach((point) => {
      const marker = this.marker(point.resource, point.lat, point.lng);
      layer.addLayer(marker);
      bounds.push(marker.getLatLng());
    });
    return bounds;
  }
};
