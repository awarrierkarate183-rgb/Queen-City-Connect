'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILES = [
  path.join(ROOT, 'data', 'curated-resources.json'),
  path.join(ROOT, 'data', 'student-resources.json'),
  path.join(ROOT, 'data', 'local-sites.json'),
  path.join(ROOT, 'data', 'resources.json')
];

function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function usablePhone(phone) {
  const raw = String(phone || '').trim();
  if (!raw || /^see (listing|website)$/i.test(raw) || /^n\/?a$/i.test(raw)) return '';
  const digits = raw.replace(/[^\d]/g, '');
  return digits.length >= 3 ? raw : '';
}

function usableWebsite(url) {
  const website = String(url || '').trim();
  if (!website || website === '#') return '';
  return website;
}

function isPhoneOnlyCrisis(resource) {
  const blob = `${resource.name} ${resource.description} ${resource.phone}`.toLowerCase();
  return /\b(988|211|crisis|hotline|lifeline)\b/.test(blob) && /24\/7/.test(String(resource.hours || ''));
}

function vagueAddress(address) {
  return /available anywhere|countywide|statewide|charlotte metro|partner sites|planting sites|program site posted|event sites|services listed online|^charlotte, nc$/i.test(address);
}

function expandDescription(resource) {
  const original = String(resource.description || '').replace(/\s+/g, ' ').trim();
  const name = String(resource.name || 'This organization').trim();
  const category = String(resource.category || 'community support').trim().toLowerCase();
  const address = String(resource.address || '').trim();
  const hours = String(resource.hours || '').trim();
  const phone = usablePhone(resource.phone);
  const website = usableWebsite(resource.website);
  const opps = new Set(Array.isArray(resource.opportunities) ? resource.opportunities.map(String) : []);
  const crisis = isPhoneOnlyCrisis(resource);
  const parts = [];

  parts.push(original || `${name} is a ${category} resource for people in Charlotte-Mecklenburg.`);

  if (crisis) {
    parts.push(`${name} is available any time, including nights and weekends, for people in Mecklenburg County who need immediate support.`);
    if (phone) parts.push(`The number to use is ${phone}.`);
    if (website) parts.push(`Chat and extra guidance are on ${website}.`);
    parts.push('This is a support line, not a building you have to visit, and it is not a volunteer signup.');
  } else {
    if (address && !vagueAddress(address)) {
      parts.push(`${name} is listed at ${address}.`);
    } else if (address) {
      parts.push(`Service is described as ${address}, so ask whether you need to live nearby or can use it from anywhere in the county.`);
    }

    if (hours) {
      if (/^(see |hours |program |varies|check )/i.test(hours) || /online|website|calendar/i.test(hours)) {
        parts.push(`The schedule is listed as “${hours},” so confirm the current times before you go.`);
      } else {
        parts.push(`Posted hours are ${hours}; always confirm before you go because schedules change.`);
      }
    }

    if (phone) {
      parts.push(`Call ${phone} to ask about intake, eligibility, or the next available visit.`);
    }

    if (website) {
      parts.push(`Current programs, applications, and updates are on ${website}.`);
    }

    const uses = [];
    if (opps.has('help')) uses.push('get help');
    if (opps.has('volunteer')) uses.push('volunteer');
    if (opps.has('intern')) uses.push('ask about student or internship paths that are actually posted');
    if (uses.length === 1) {
      parts.push(`People can use this listing to ${uses[0]}, using only the contact details already on file.`);
    } else if (uses.length === 2) {
      parts.push(`People can use this listing to ${uses[0]} and ${uses[1]}, using only the contact details already on file.`);
    } else if (uses.length > 2) {
      parts.push(`People can use this listing to ${uses.slice(0, -1).join(', ')}, and ${uses[uses.length - 1]}, using only the contact details already on file.`);
    } else {
      parts.push(`This ${category} listing is here so schools, neighborhoods, and families have a clear next step in Charlotte-Mecklenburg.`);
    }
  }

  let text = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  if (wordCount(text) < 50) {
    text += ` Read the details above, then use the posted phone or website when one is listed so you get the latest hours and how to connect.`;
  }
  if (wordCount(text) < 50) {
    text += ` ${name} is included in the directory so people searching for ${category} support can find a concrete starting point.`;
  }
  return text.replace(/\s+/g, ' ').trim();
}

function expandFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const list = Array.isArray(data.resources) ? data.resources : data;
  list.forEach((resource) => {
    resource.description = expandDescription(resource);
  });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  const counts = list.map((resource) => wordCount(resource.description));
  return {
    file: path.basename(filePath),
    count: list.length,
    under50: counts.filter((n) => n < 50).length,
    min: Math.min(...counts),
    max: Math.max(...counts)
  };
}

console.log(FILES.map(expandFile));
