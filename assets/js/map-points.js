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
    "Employment": "#16a34a",
    "Education": "#7c3aed"
  },

  charlotte: [35.2271, -80.8431],

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
    const phone = resource.phone && resource.phone !== 'See listing' ? resource.phone : '';
    const website = resource.website && resource.website !== '#' ? resource.website : '';
    const address = resource.address && !String(resource.address).startsWith('Charlotte-Mecklenburg')
      ? resource.address : '';
    return `
      <div class="qcc-map-popup">
        <strong>${resource.name || ''}</strong>
        <span class="qcc-map-popup-cat">${resource.category || ''}${resource.verified ? ' · Verified' : ''}</span>
        ${address ? `<span>${address}</span>` : ''}
        ${phone ? `<span>${phone}</span>` : ''}
        ${website ? `<a href="${website}" target="_blank" rel="noopener">Visit website &rarr;</a>` : ''}
      </div>
    `;
  },

  marker(resource) {
    const lat = Number(resource.lat);
    const lng = Number(resource.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const color = this.categoryColors[resource.category] || '#94a3b8';
    const marker = L.circleMarker([lat, lng], {
      radius: 3.25,
      color: '#fff',
      weight: 1,
      fillColor: color,
      fillOpacity: 0.95,
      opacity: 1
    });
    marker.bindPopup(this.popupHtml(resource), { maxWidth: 260, className: 'qcc-popup-wrap' });
    return marker;
  },

  draw(layer, resources) {
    layer.clearLayers();
    const bounds = [];
    (resources || []).forEach((resource) => {
      const marker = this.marker(resource);
      if (!marker) return;
      layer.addLayer(marker);
      bounds.push(marker.getLatLng());
    });
    return bounds;
  }
};
