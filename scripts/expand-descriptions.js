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

function originalBlurb(text) {
  let core = String(text || '').replace(/\s+/g, ' ').trim();
  const markers = [
    ' Service is described as ',
    ' is listed at ',
    ' is available any time, including nights',
    ' Posted hours are ',
    ' The schedule is listed as',
    ' People can use this listing',
    ' QueenCityConnect tags',
    ' Current programs, applications, and updates are on ',
    ' Call ',
    ' The official website on file is ',
    ' The phone number on file is ',
    ' The number to use is ',
    ' Chat and extra guidance are on '
  ];
  markers.forEach((marker) => {
    const index = core.indexOf(marker);
    if (index > 40) core = core.slice(0, index).trim();
  });
  return core.replace(/\s+/g, ' ').trim();
}

function isPhoneOnlyCrisis(resource, blurb) {
  const blob = `${resource.name} ${blurb} ${resource.phone}`.toLowerCase();
  return /\b(988|211|crisis|hotline|lifeline)\b/.test(blob) && /24\/7/.test(String(resource.hours || ''));
}

function vagueAddress(address) {
  return /available anywhere|countywide|statewide|charlotte metro|partner sites|planting sites|program site posted|event sites|services listed online|^charlotte, nc$/i.test(address);
}

function expandDescription(resource) {
  const blurb = originalBlurb(resource.description) || `${String(resource.name || 'This organization')} is a Charlotte-Mecklenburg resource.`;
  const name = String(resource.name || 'This organization').trim();
  const category = String(resource.category || 'community support').trim().toLowerCase();
  const address = String(resource.address || '').trim();
  const hours = String(resource.hours || '').trim();
  const phone = usablePhone(resource.phone);
  const website = usableWebsite(resource.website);
  const opps = new Set(Array.isArray(resource.opportunities) ? resource.opportunities.map(String) : []);
  const sentences = [blurb];

  if (isPhoneOnlyCrisis(resource, blurb)) {
    sentences.push(`${name} can be reached any time, including nights and weekends, from anywhere in Mecklenburg County.`);
    if (phone) sentences.push(`Use ${phone} for voice or text support.`);
    if (website) sentences.push(`If calling is hard, chat and extra guidance are published at ${website}.`);
    sentences.push('This is a confidential support line, not a walk-in office and not a volunteer signup.');
    sentences.push('Save the number now so you do not have to search during an emergency.');
  } else {
    sentences.push(`${name} is listed as a ${category} option for neighbors, schools, and students who need a clear next step in Charlotte-Mecklenburg.`);

    if (address && !vagueAddress(address)) {
      sentences.push(`The published location is ${address}, which you can use to plan a visit once you confirm they are open.`);
    } else if (address) {
      sentences.push(`Coverage is described as ${address}, so ask whether you must live nearby or can use the service from anywhere in the county.`);
    }

    if (hours) {
      if (/online|website|calendar|see |varies|application/i.test(hours)) {
        sentences.push(`There is no single walk-in clock time in this record; the schedule is “${hours},” so check the same day you go.`);
      } else {
        sentences.push(`Hours on file are ${hours}. Confirm before you travel, because holidays and staffing can change the door time.`);
      }
    }

    if (phone) {
      sentences.push(`The phone number on file is ${phone}. Call to ask about eligibility, intake, or whether you need an appointment.`);
    } else {
      sentences.push('This directory record does not include a public phone, so do not guess a number.');
    }

    if (website) {
      sentences.push(`Applications, current programs, and volunteer or student forms should be taken from ${website} only.`);
    }

    const uses = [];
    if (opps.has('help')) uses.push('getting help');
    if (opps.has('volunteer')) uses.push('volunteering');
    if (opps.has('intern')) uses.push('checking any internship or student-work posting that is actually open');
    if (uses.length === 1) {
      sentences.push(`People use this listing for ${uses[0]}, then confirm details through the official contact above.`);
    } else if (uses.length === 2) {
      sentences.push(`People use this listing for ${uses[0]} and ${uses[1]}, then confirm details through the official contact above.`);
    } else if (uses.length > 2) {
      sentences.push(`People use this listing for ${uses.slice(0, -1).join(', ')}, and ${uses[uses.length - 1]}. Confirm every opening through the official contact above.`);
    }
  }

  let text = sentences.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  if (wordCount(text) < 50) {
    text += ` Use only the address, hours, phone, and website already shown on this card so you do not follow outdated rumors about ${name}.`;
  }
  return text;
}

function expandFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const list = Array.isArray(data.resources) ? data.resources : data;
  list.forEach((resource) => {
    resource.description = expandDescription(resource);
  });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  const counts = list.map((resource) => wordCount(resource.description));
  const short = list.filter((resource) => wordCount(resource.description) < 50).map((resource) => resource.name);
  return {
    file: path.basename(filePath),
    count: list.length,
    under50: short.length,
    min: Math.min(...counts),
    max: Math.max(...counts),
    short
  };
}

console.log(JSON.stringify(FILES.map(expandFile), null, 2));
