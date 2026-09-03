'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CURATED_PATH = path.join(ROOT, 'data', 'curated-resources.json');
const OUT_PATH = path.join(ROOT, 'data', 'resources.json');
const META_PATH = path.join(ROOT, 'data', 'resources-meta.json');

const BBOX = '34.82,-81.38,35.64,-80.40';
const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter'
];

const OVERPASS_QUERIES = [
  `
[out:json][timeout:240];
(
  nwr["amenity"="social_facility"](${BBOX});
  nwr["amenity"="food_bank"](${BBOX});
  nwr["amenity"="soup_kitchen"](${BBOX});
  nwr["amenity"="shelter"](${BBOX});
  nwr["amenity"="hospital"](${BBOX});
  nwr["amenity"="clinic"](${BBOX});
  nwr["amenity"="doctors"](${BBOX});
  nwr["amenity"="pharmacy"](${BBOX});
  nwr["amenity"="dentist"](${BBOX});
  nwr["amenity"="school"](${BBOX});
  nwr["amenity"="kindergarten"](${BBOX});
  nwr["amenity"="college"](${BBOX});
  nwr["amenity"="university"](${BBOX});
  nwr["amenity"="community_centre"](${BBOX});
  nwr["amenity"="library"](${BBOX});
  nwr["amenity"="place_of_worship"](${BBOX});
  nwr["amenity"="courthouse"](${BBOX});
  nwr["amenity"="police"](${BBOX});
  nwr["amenity"="fire_station"](${BBOX});
  nwr["amenity"="childcare"](${BBOX});
  nwr["amenity"="nursing_home"](${BBOX});
  nwr["amenity"="townhall"](${BBOX});
  nwr["healthcare"](${BBOX});
  nwr["office"="ngo"](${BBOX});
  nwr["office"="government"](${BBOX});
  nwr["office"="charity"](${BBOX});
  nwr["office"="association"](${BBOX});
  nwr["office"="employment_agency"](${BBOX});
  nwr["office"="lawyer"](${BBOX});
  nwr["social_facility"](${BBOX});
  nwr["shop"="charity"](${BBOX});
  nwr["amenity"="social_centre"](${BBOX});
  nwr["leisure"="community_centre"](${BBOX});
  nwr["amenity"="post_office"](${BBOX});
  nwr["amenity"="public_building"](${BBOX});
  nwr["emergency"="ambulance_station"](${BBOX});
  nwr["office"="foundation"](${BBOX});
);
out center tags;
`.trim(),
  `
[out:json][timeout:240];
(
  nwr["leisure"="park"](${BBOX});
  nwr["leisure"="playground"](${BBOX});
  nwr["leisure"="sports_centre"](${BBOX});
  nwr["leisure"="recreation_ground"](${BBOX});
  nwr["amenity"="marketplace"](${BBOX});
  nwr["shop"="supermarket"](${BBOX});
  nwr["shop"="convenience"](${BBOX});
  nwr["shop"="greengrocer"](${BBOX});
  nwr["amenity"="bank"](${BBOX});
  nwr["amenity"="credit_union"](${BBOX});
  nwr["office"="financial"](${BBOX});
);
out center tags;
`.trim()
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function inMetro(lat, lng) {
  return lat >= 34.8 && lat <= 35.7 && lng >= -81.4 && lng <= -80.3;
}

function decimalPlaces(n) {
  const s = String(n);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
}

function isCoarseCoord(lat, lng) {
  return !Number.isFinite(lat) || !Number.isFinite(lng) || decimalPlaces(lat) <= 4 || decimalPlaces(lng) <= 4;
}

function loadExistingLive() {
  try {
    const data = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));
    return (data.resources || []).filter((r) => r.source === 'openstreetmap');
  } catch {
    return [];
  }
}

function addressVariants(address) {
  const raw = String(address || '').trim();
  const noSuite = raw.replace(/,?\s*(suite|ste\.?|unit|#)\s*[a-z0-9-]+/ig, '').replace(/\s{2,}/g, ' ').replace(/\s+,/g, ',').trim();
  return [...new Set([raw, noSuite])].filter(Boolean);
}

async function geocodeAddress(address) {
  for (const query of addressVariants(address)) {
    const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q='
      + encodeURIComponent(query);
    const response = await fetch(url, {
      headers: { 'User-Agent': 'QueenCityConnect/1.0 (charlotte community resources; local directory update)' }
    });
    if (response.ok) {
      const data = await response.json();
      if (data && data[0]) {
        const lat = Number(data[0].lat);
        const lng = Number(data[0].lon);
        if (Number.isFinite(lat) && Number.isFinite(lng) && inMetro(lat, lng)) {
          return [Number(lat.toFixed(6)), Number(lng.toFixed(6))];
        }
      }
    }
    await sleep(1100);
  }
  return null;
}

async function refineCuratedCoords(curated, live, doGeocode) {
  const byName = new Map();
  for (const resource of live) {
    const key = keyName(resource.name);
    if (!byName.has(key)) byName.set(key, resource);
  }
  const refined = [];
  for (const resource of curated) {
    const next = { ...resource };
    const osm = byName.get(keyName(resource.name));
    if (osm && Number.isFinite(osm.lat) && Number.isFinite(osm.lng)) {
      next.lat = osm.lat;
      next.lng = osm.lng;
    } else if (doGeocode && isCoarseCoord(next.lat, next.lng)) {
      try {
        const xy = await geocodeAddress(next.address);
        if (xy) {
          next.lat = xy[0];
          next.lng = xy[1];
        }
      } catch {
        // Keep existing coordinates if geocoding is unavailable.
      }
      await sleep(1100);
    }
    next.score = scoreResource(next);
    refined.push(next);
  }
  return refined;
}

function persistCuratedCoords(refined) {
  const raw = JSON.parse(fs.readFileSync(CURATED_PATH, 'utf8'));
  const byName = new Map(refined.map((r) => [keyName(r.name), r]));
  raw.resources = (raw.resources || []).map((resource) => {
    const hit = byName.get(keyName(resource.name));
    if (!hit) return resource;
    return { ...resource, lat: hit.lat, lng: hit.lng };
  });
  fs.writeFileSync(CURATED_PATH, JSON.stringify(raw, null, 2) + '\n');
}

function categorize(tags) {
  const amenity = String(tags.amenity || '');
  const healthcare = String(tags.healthcare || '');
  const social = String(tags.social_facility || '');
  const office = String(tags.office || '');
  const shop = String(tags.shop || '');
  const leisure = String(tags.leisure || '');
  const name = String(tags.name || tags['name:en'] || '');
  const blob = `${amenity} ${healthcare} ${social} ${office} ${shop} ${leisure} ${name}`.toLowerCase();

  if (blob.includes('veteran') || blob.includes('va ')) return 'Veterans';
  if (amenity === 'food_bank' || amenity === 'soup_kitchen' || amenity === 'marketplace' || shop === 'supermarket' || shop === 'convenience' || shop === 'greengrocer' || social === 'food_bank' || blob.includes('food bank') || blob.includes('pantry')) return 'Food';
  if (amenity === 'shelter' || social === 'shelter' || social === 'homeless' || blob.includes('homeless') || blob.includes('housing')) return 'Housing';
  if (healthcare === 'mental_health' || social === 'mental_health' || blob.includes('mental') || blob.includes('psych')) return 'Mental Health';
  if (amenity === 'school' || amenity === 'kindergarten' || amenity === 'college' || amenity === 'university' || amenity === 'library') return 'Education';
  if (amenity === 'childcare' || leisure === 'playground' || social === 'child_care' || blob.includes('youth')) return 'Youth';
  if (amenity === 'police' || amenity === 'fire_station' || blob.includes('crisis') || blob.includes('domestic')) return 'Safety';
  if (office === 'lawyer' || amenity === 'courthouse' || blob.includes('legal')) return 'Legal Aid';
  if (office === 'employment_agency' || blob.includes('workforce') || blob.includes('job')) return 'Employment';
  if (amenity === 'bank' || amenity === 'credit_union' || office === 'financial') return 'Financial Aid';
  if (amenity === 'hospital' || amenity === 'clinic' || amenity === 'doctors' || amenity === 'pharmacy' || amenity === 'dentist' || amenity === 'nursing_home' || healthcare) return 'Health';
  return 'General Support';
}

function coordsOf(el) {
  if (Number.isFinite(el.lat) && Number.isFinite(el.lon)) return [el.lat, el.lon];
  if (el.center && Number.isFinite(el.center.lat) && Number.isFinite(el.center.lon)) {
    return [el.center.lat, el.center.lon];
  }
  return null;
}

function addressOf(tags) {
  const parts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:city'] || tags['addr:suburb'],
    tags['addr:state'] || 'NC',
    tags['addr:postcode']
  ].filter(Boolean);
  return parts.length >= 2 ? parts.join(' ') : 'Charlotte metro';
}

function scoreResource(resource) {
  let score = 0;
  if (resource.verified) score += 100;
  if (resource.phone && resource.phone !== 'See listing') score += 12;
  if (resource.website && resource.website !== '#') score += 12;
  if (resource.hours && resource.hours !== 'See listing') score += 8;
  if (resource.address && resource.address !== 'Charlotte metro' && !resource.address.startsWith('Charlotte-Mecklenburg')) score += 8;
  if (resource.description && resource.description.length > 40) score += 6;
  if (Number.isFinite(resource.lat) && Number.isFinite(resource.lng)) score += 10;
  const ageDays = resource.osmTimestamp
    ? (Date.now() - Date.parse(resource.osmTimestamp)) / 86400000
    : 400;
  score += Math.max(0, 10 - ageDays / 120);
  return Math.round(score);
}

function keyName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function fetchOverpassQuery(query) {
  let lastError = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'User-Agent': 'QueenCityConnect/1.0 (charlotte community resources; local directory update)'
          },
          body: 'data=' + encodeURIComponent(query)
        });
        if (response.status === 429 || response.status === 504) {
          lastError = new Error('Overpass HTTP ' + response.status);
          await sleep(4000 * attempt);
          continue;
        }
        if (!response.ok) {
          lastError = new Error('Overpass HTTP ' + response.status);
          break;
        }
        const data = await response.json();
        if (data && Array.isArray(data.elements)) return data.elements;
        lastError = new Error('Unexpected Overpass response');
      } catch (err) {
        lastError = err;
        await sleep(2000 * attempt);
      }
    }
  }
  throw lastError || new Error('Overpass unavailable');
}

async function fetchOverpass() {
  const all = [];
  let lastError = null;
  for (const query of OVERPASS_QUERIES) {
    try {
      const elements = await fetchOverpassQuery(query);
      all.push(...elements);
    } catch (err) {
      lastError = err;
      console.error('Overpass query failed:', err.message || err);
    }
  }
  if (!all.length) throw lastError || new Error('Overpass unavailable');
  return all;
}

function fromOsm(elements) {
  const seen = new Set();
  const out = [];
  for (const el of elements) {
    const tags = el.tags || {};
    const name = tags.name || tags['name:en'] || tags.operator;
    if (!name) continue;
    const xy = coordsOf(el);
    if (!xy) continue;
    const lat = Number(xy[0].toFixed(6));
    const lng = Number(xy[1].toFixed(6));
    const dedupe = keyName(name) + '|' + lat.toFixed(4) + '|' + lng.toFixed(4);
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const category = categorize(tags);
    const website = tags.website || tags['contact:website'] || '#';
    const phone = tags.phone || tags['contact:phone'] || 'See listing';
    const hours = tags.opening_hours === '24/7' ? '24/7' : (tags.opening_hours || 'See listing');
    const resource = {
      id: 10000 + out.length + 1,
      name,
      category,
      description: tags.description || tags.note ||
        `${name} is a mapped ${category.toLowerCase()} location in the Charlotte metro area.`,
      address: addressOf(tags),
      phone,
      website,
      hours,
      spotlight: false,
      verified: false,
      source: 'openstreetmap',
      lat,
      lng,
      osmTimestamp: el.timestamp || null
    };
    resource.score = scoreResource(resource);
    out.push(resource);
  }
  return out;
}

function loadCurated() {
  const raw = JSON.parse(fs.readFileSync(CURATED_PATH, 'utf8'));
  return (raw.resources || []).map((resource, index) => {
    const next = {
      ...resource,
      verified: true,
      source: 'curated',
      spotlight: resource.spotlight === true
    };
    next.score = scoreResource(next);
    if (!next.id) next.id = index + 1;
    return next;
  });
}

function merge(curated, live) {
  const used = new Set(curated.map((r) => keyName(r.name)));
  const extra = live.filter((r) => !used.has(keyName(r.name)));
  const all = [...curated, ...extra].map((r, i) => ({ ...r, id: i + 1 }));
  all.sort((a, b) => (b.score - a.score) || a.name.localeCompare(b.name));
  return all.map((r, i) => ({ ...r, id: i + 1 }));
}

async function updateResources(options = {}) {
  const reuseLive = options.reuseLive === true;
  const doGeocode = options.geocode !== false;
  let curated = loadCurated();
  let live = [];
  let sourceNote = 'curated-only';
  if (reuseLive) {
    live = loadExistingLive();
    if (live.length) sourceNote = 'openstreetmap+curated';
  } else {
    try {
      const elements = await fetchOverpass();
      live = fromOsm(elements);
      sourceNote = 'openstreetmap+curated';
    } catch (err) {
      console.error('Live map refresh failed; keeping existing mapped listings.', err.message || err);
      live = loadExistingLive();
      sourceNote = live.length ? 'openstreetmap+curated' : 'curated-only';
    }
  }

  curated = await refineCuratedCoords(curated, live, doGeocode);
  persistCuratedCoords(curated);

  const resources = merge(curated, live);
  const payload = { resources };
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2));
  const meta = {
    lastUpdated: new Date().toISOString(),
    lastAttempt: new Date().toISOString(),
    nextUpdateDays: 14,
    count: resources.length,
    curatedCount: curated.length,
    liveCount: resources.length - curated.length,
    source: sourceNote
  };
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2));
  return meta;
}

if (require.main === module) {
  updateResources({
    reuseLive: process.argv.includes('--reuse-live'),
    geocode: !process.argv.includes('--no-geocode')
  })
    .then((meta) => {
      console.log('Resource directory updated:', meta);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { updateResources };
