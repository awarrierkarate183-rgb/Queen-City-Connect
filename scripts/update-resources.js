'use strict';

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { enrichResources } = require('./ai-resources');

const ROOT = path.join(__dirname, '..');
const CURATED_PATH = path.join(ROOT, 'data', 'curated-resources.json');
const STUDENT_PATH = path.join(ROOT, 'data', 'student-resources.json');
const OUT_PATH = path.join(ROOT, 'data', 'resources.json');
const META_PATH = path.join(ROOT, 'data', 'resources-meta.json');

const BBOX = '34.82,-81.38,35.64,-80.40';
const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter'
];

const OVERPASS_QUERIES = [
  `
[out:json][timeout:180];
(
  nwr["amenity"="social_facility"](${BBOX});
  nwr["amenity"="food_bank"](${BBOX});
  nwr["amenity"="soup_kitchen"](${BBOX});
  nwr["amenity"="shelter"](${BBOX});
  nwr["amenity"="community_centre"](${BBOX});
  nwr["amenity"="library"](${BBOX});
  nwr["office"="ngo"](${BBOX});
  nwr["office"="charity"](${BBOX});
  nwr["office"="foundation"](${BBOX});
  nwr["social_facility"](${BBOX});
  nwr["shop"="charity"](${BBOX});
  nwr["leisure"="community_centre"](${BBOX});
);
out center tags;
`.trim()
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function inCharlotteServiceArea(lat, lng, address) {
  const a = String(address || '').toLowerCase();
  if (/\b(sc|south carolina|rock hill|fort mill|york sc|indian land|cherryville|kings mountain|lincolnton|maiden|gastonia|bessemer city|dallas nc|kannapolis|concord nc|mooresville|china grove|rockwell|locust|midland nc|stanley nc|terrell|sherrills|monroe nc|waxhaw|wingate|indian trail)\b/.test(a)
    && !/\b(charlotte|matthews|mint hill|pineville|huntersville|cornelius|davidson|belmont)\b/.test(a)) {
    return false;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat >= 35.17 && lat <= 35.20 && lng >= -81.05 && lng <= -81.00) return true;
  return lat >= 35.05 && lat <= 35.52 && lng >= -81.05 && lng <= -80.64;
}

function decimalPlaces(n) {
  const s = String(n);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
}

function isCoarseCoord(lat, lng) {
  return !Number.isFinite(lat) || !Number.isFinite(lng) || decimalPlaces(lat) <= 4 || decimalPlaces(lng) <= 4;
}

function isQualityStoredLive(resource) {
  if (!resource || resource.source !== 'openstreetmap') return false;
  const website = resource.website || '#';
  const phone = resource.phone || 'See listing';
  if (website === '#' && (phone === 'See listing' || !phone)) return false;
  const blob = String(resource.name || '').toLowerCase();
  if (/event venue|riverwalk event|^j\.n\. fries|founders hall library/.test(blob)) return false;
  if (!inCharlotteServiceArea(resource.lat, resource.lng, resource.address)) return false;
  return true;
}

function loadExistingLive() {
  try {
    const data = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));
    return (data.resources || []).filter(isQualityStoredLive).map((resource) => {
      const next = { ...resource };
      delete next.opportunities;
      next.opportunities = defaultOpportunities(next);
      return next;
    });
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
        if (Number.isFinite(lat) && Number.isFinite(lng) && inCharlotteServiceArea(lat, lng, query)) {
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

function persistCoordsFile(filePath, refined) {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const byName = new Map(refined.map((r) => [keyName(r.name), r]));
    raw.resources = (raw.resources || []).map((resource) => {
      const hit = byName.get(keyName(resource.name));
      if (!hit) return resource;
      return { ...resource, lat: hit.lat, lng: hit.lng };
    });
    fs.writeFileSync(filePath, JSON.stringify(raw, null, 2) + '\n');
  } catch {
    // File may not exist yet.
  }
}

function persistCuratedCoords(refined) {
  persistCoordsFile(CURATED_PATH, refined);
  persistCoordsFile(STUDENT_PATH, refined);
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
  if (amenity === 'food_bank' || amenity === 'soup_kitchen' || amenity === 'marketplace' || social === 'food_bank' || blob.includes('food bank') || blob.includes('pantry')) return 'Food';
  if (amenity === 'shelter' || social === 'shelter' || social === 'homeless' || blob.includes('homeless')) return 'Housing';
  if (healthcare === 'mental_health' || social === 'mental_health' || blob.includes('mental') || blob.includes('psych')) return 'Mental Health';
  if (amenity === 'library') return 'Education';
  if (blob.includes('youth') || blob.includes('teen') || amenity === 'childcare') return 'Youth';
  if (amenity === 'police' || blob.includes('crisis') || blob.includes('domestic')) return 'Safety';
  if (office === 'lawyer' || amenity === 'courthouse' || blob.includes('legal')) return 'Legal Aid';
  if (office === 'employment_agency' || blob.includes('workforce') || blob.includes('intern')) return 'Internships';
  if (blob.includes('volunteer')) return 'Volunteer';
  if (amenity === 'hospital' || amenity === 'clinic' || amenity === 'doctors' || healthcare) return 'Health';
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

function defaultOpportunities(resource) {
  if (Array.isArray(resource.opportunities) && resource.opportunities.length) {
    return resource.opportunities;
  }
  const category = resource.category || '';
  const blob = `${resource.name} ${category}`.toLowerCase();
  const opps = new Set(['help']);
  if (category === 'Volunteer' || blob.includes('volunteer')) opps.add('volunteer');
  if (category === 'Internships' || blob.includes('intern') || blob.includes('workforce') || blob.includes('employment')) {
    opps.add('intern');
  }
  if (['Youth', 'Food', 'Housing', 'Volunteer'].includes(category)) {
    opps.add('volunteer');
  }
  if (category === 'Employment') opps.add('intern');
  return [...opps];
}

function isQualityLive(tags, name, website, phone) {
  const amenity = String(tags.amenity || '');
  const office = String(tags.office || '');
  const allowedAmenity = new Set(['social_facility', 'food_bank', 'soup_kitchen', 'shelter', 'community_centre', 'library']);
  const allowedOffice = new Set(['ngo', 'charity', 'foundation']);
  if (!allowedAmenity.has(amenity) && !allowedOffice.has(office) && !tags.social_facility && tags.shop !== 'charity') {
    return false;
  }
  if (website === '#' && (phone === 'See listing' || !phone)) return false;
  const blob = String(name || '').toLowerCase();
  if (/cvs|walgreens|rite aid|circle k|7-eleven|atm|bank of america|wells fargo|chase bank/.test(blob)) return false;
  return true;
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
    const website = tags.website || tags['contact:website'] || '#';
    const phone = tags.phone || tags['contact:phone'] || 'See listing';
    if (!isQualityLive(tags, name, website, phone)) continue;
    const lat = Number(xy[0].toFixed(6));
    const lng = Number(xy[1].toFixed(6));
    const dedupe = keyName(name) + '|' + lat.toFixed(4) + '|' + lng.toFixed(4);
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const address = addressOf(tags);
    if (!inCharlotteServiceArea(lat, lng, address)) continue;
    const category = categorize(tags);
    const hours = tags.opening_hours === '24/7' ? '24/7' : (tags.opening_hours || 'See listing');
    const resource = {
      id: 10000 + out.length + 1,
      name,
      category,
      description: tags.description || tags.note ||
        `${name} is a Charlotte-area ${category.toLowerCase()} organization. Check the website for hours, programs, and how to get involved.`,
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
    resource.opportunities = defaultOpportunities(resource);
    resource.score = scoreResource(resource);
    out.push(resource);
  }
  return out;
}

function loadJsonResources(filePath) {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return raw.resources || [];
  } catch {
    return [];
  }
}

function loadCurated() {
  const combined = [...loadJsonResources(CURATED_PATH), ...loadJsonResources(STUDENT_PATH)];
  const seen = new Set();
  return combined.map((resource, index) => {
    const key = keyName(resource.name);
    if (key === 'city year charlotte') return null;
    if (seen.has(key)) return null;
    seen.add(key);
    const next = {
      ...resource,
      verified: true,
      source: 'curated',
      spotlight: resource.spotlight === true
    };
    next.opportunities = defaultOpportunities(next);
    next.score = scoreResource(next) + 20;
    if (!next.id) next.id = index + 1;
    return next;
  }).filter(Boolean);
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

  let resources = merge(curated, live);
  let aiMeta = { used: false };
  if (options.ai !== false) {
    const enriched = await enrichResources(resources, { skipCache: options.skipAiCache === true });
    resources = enriched.resources.map((resource) => ({
      ...resource,
      score: scoreResource(resource)
    }));
    resources.sort((a, b) => (b.score - a.score) || a.name.localeCompare(b.name));
    resources = resources.map((r, i) => ({ ...r, id: i + 1 }));
    aiMeta = enriched.ai;
  }
  const payload = { resources };
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2));
  const meta = {
    lastUpdated: new Date().toISOString(),
    lastAttempt: new Date().toISOString(),
    nextUpdateDays: 14,
    count: resources.length,
    curatedCount: curated.length,
    liveCount: resources.length - curated.length,
    source: sourceNote,
    ai: aiMeta
  };
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2));
  return meta;
}

if (require.main === module) {
  updateResources({
    reuseLive: process.argv.includes('--reuse-live'),
    geocode: !process.argv.includes('--no-geocode'),
    ai: !process.argv.includes('--no-ai'),
    skipAiCache: process.argv.includes('--refresh-ai')
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
