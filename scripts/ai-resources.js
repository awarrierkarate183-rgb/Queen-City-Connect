'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CACHE_PATH = path.join(ROOT, 'data', 'ai-cache.json');

const CATEGORIES = [
  'Food', 'Housing', 'Health', 'Mental Health', 'Youth', 'Volunteer',
  'Internships', 'Safety', 'Legal Aid', 'Financial Aid', 'Veterans',
  'Employment', 'Education', 'General Support'
];

const OPPORTUNITIES = ['volunteer', 'intern', 'help'];

function getGroqKey() {
  return String(process.env.GROQ_API_KEY || '').trim();
}

function groqEnabled() {
  return getGroqKey().startsWith('gsk_');
}

function groqModel() {
  return String(process.env.GROQ_MODEL || 'openai/gpt-oss-20b').trim() || 'openai/gpt-oss-20b';
}

function groqModelFallbacks() {
  const primary = groqModel();
  const extras = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'llama-3.1-8b-instant'];
  return [...new Set([primary, ...extras])];
}

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

function cacheKey(resource) {
  return [
    String(resource.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
    resource.source || '',
    resource.website || '',
    resource.category || ''
  ].join('|');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonContent(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON object in model response');
  return JSON.parse(candidate.slice(start, end + 1));
}

function sanitizeOpportunities(value, fallback) {
  const set = new Set();
  (Array.isArray(value) ? value : []).forEach((item) => {
    const key = String(item || '').toLowerCase();
    if (OPPORTUNITIES.includes(key)) set.add(key);
  });
  if (!set.size) (fallback || ['help']).forEach((item) => set.add(item));
  return [...set];
}

function sanitizeCategory(value, fallback) {
  return CATEGORIES.includes(value) ? value : (fallback || 'General Support');
}

function sanitizeDescription(value, fallback) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length < 40) return fallback;
  return text.slice(0, 420);
}

async function groqChat(messages, { retries = 4 } = {}) {
  const key = getGroqKey();
  if (!key) throw new Error('GROQ_API_KEY is missing');
  const models = groqModelFallbacks();
  let lastError = null;
  for (const model of models) {
    let useJson = true;
    for (let attempt = 1; attempt <= retries; attempt++) {
      const body = {
        model,
        temperature: 0.2,
        max_tokens: 2500,
        messages
      };
      if (useJson) body.response_format = { type: 'json_object' };
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error('Groq HTTP ' + response.status);
        await sleep(1500 * attempt);
        continue;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = (data.error && data.error.message) || ('Groq HTTP ' + response.status);
        lastError = new Error(msg);
        if (/json_object|response_format/i.test(msg)) {
          useJson = false;
          continue;
        }
        if (/model|decommission|does not exist/i.test(msg)) break;
        if (response.status === 401 || response.status === 403) throw lastError;
        await sleep(800 * attempt);
        continue;
      }
      const message = data.choices && data.choices[0] && data.choices[0].message;
      const content = (message && message.content) || (message && message.reasoning) || '';
      if (!content) {
        lastError = new Error('Empty Groq response');
        break;
      }
      groqChat.lastModel = model;
      return content;
    }
  }
  throw lastError || new Error('Groq unavailable');
}

async function enrichBatch(batch) {
  const payload = batch.map((resource) => ({
    id: resource.id,
    name: resource.name,
    category: resource.category,
    description: resource.description,
    address: resource.address,
    hours: resource.hours,
    opportunities: resource.opportunities || [],
    source: resource.source,
    verified: !!resource.verified
  }));

  const content = await groqChat([
    {
      role: 'system',
      content:
        'You write a Charlotte high-school resource directory. Return JSON only: {"items":[...]}. '
        + 'Each item must have id, keep (boolean), category, opportunities, description. '
        + 'category must be one of: ' + CATEGORIES.join(', ') + '. '
        + 'opportunities is an array using only: volunteer, intern, help. '
        + 'description: 1-2 sentences, grade 9-12 voice, concrete, no hype. '
        + 'keep=false only if the place is useless to teens (random church, empty name, store, ATM). '
        + 'Never invent phone numbers, websites, internships, hours, or programs not supported by the input. '
        + 'Libraries, food pantries, clinics, shelters, and youth nonprofits should keep=true. '
        + 'Do not change the id.'
    },
    {
      role: 'user',
      content: JSON.stringify({ items: payload })
    }
  ]);

  const parsed = parseJsonContent(content);
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const byId = new Map(items.map((item) => [Number(item.id), item]));
  return batch.map((resource) => {
    const hit = byId.get(Number(resource.id));
    if (!hit) return resource;
    if (resource.source === 'openstreetmap' && hit.keep === false) {
      return { ...resource, _drop: true };
    }
    const next = { ...resource };
    next.category = sanitizeCategory(hit.category, resource.category);
    next.opportunities = sanitizeOpportunities(hit.opportunities, resource.opportunities);
    next.description = sanitizeDescription(hit.description, resource.description);
    next.aiEnriched = true;
    return next;
  });
}

async function enrichResources(resources, options = {}) {
  if (!groqEnabled()) {
    return { resources, ai: { used: false, reason: 'no-key' } };
  }
  const skipCache = options.skipCache === true;
  const cache = skipCache ? {} : loadCache();
  const pending = [];
  const kept = [];

  for (const resource of resources) {
    const key = cacheKey(resource);
    if (!skipCache && cache[key] && cache[key].description) {
      kept.push({
        ...resource,
        category: sanitizeCategory(cache[key].category, resource.category),
        opportunities: sanitizeOpportunities(cache[key].opportunities, resource.opportunities),
        description: sanitizeDescription(cache[key].description, resource.description),
        aiEnriched: true
      });
    } else {
      pending.push(resource);
    }
  }

  const size = 6;
  let enriched = 0;
  let dropped = 0;
  for (let i = 0; i < pending.length; i += size) {
    const batch = pending.slice(i, i + size);
    try {
      const updated = await enrichBatch(batch);
      for (const resource of updated) {
        if (resource._drop) {
          dropped += 1;
          continue;
        }
        cache[cacheKey(resource)] = {
          category: resource.category,
          opportunities: resource.opportunities,
          description: resource.description
        };
        kept.push(resource);
        enriched += 1;
      }
    } catch (err) {
      console.error('Groq batch failed; keeping original blurbs.', err.message || err);
      kept.push(...batch);
    }
    if (i + size < pending.length) await sleep(250);
  }

  saveCache(cache);
  return {
    resources: kept,
    ai: {
      used: true,
      model: groqChat.lastModel || groqModel(),
      newlyEnriched: enriched,
      cached: resources.length - pending.length,
      dropped
    }
  };
}

module.exports = {
  groqEnabled,
  groqChat,
  enrichResources,
  CATEGORIES
};
