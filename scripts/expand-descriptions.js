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

const MIN_WORDS = 50;
const MAX_WORDS = 60;

function wordList(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean);
}

function wordCount(text) {
  return wordList(text).length;
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

function originalBlurb(text, name) {
  let core = String(text || '').replace(/\s+/g, ' ').trim();
  const markers = [
    ' is listed as a ',
    ' Coverage is described as ',
    ' The published location is ',
    ' There is no single walk-in',
    ' Hours on file are ',
    ' This directory record does not',
    ' Applications, current programs',
    ' People use this listing',
    ' can be reached any time',
    ' Service is described as ',
    ' Service area:',
    ' It is listed at ',
    ' is listed at ',
    ' is available any time, including nights',
    ' Posted hours are ',
    ' The schedule is listed as',
    ' Hours: ',
    ' Details are on ',
    ' Use this listing to ',
    ' Call (',
    ' People can use this listing',
    ' QueenCityConnect tags',
    ' Current programs, applications, and updates are on ',
    ' The official website on file is ',
    ' The phone number on file is ',
    ' The number to use is ',
    ' Chat and extra guidance are on ',
    ' Chat is on ',
    ' If calling is hard',
    ' This is a confidential support line',
    ' It is a 24/7 line',
    ' is a 24/7 line',
    ' Save the number so',
    ' Confirm hours before you go',
    ' Ask about eligibility'
  ];
  markers.forEach((marker) => {
    const index = core.indexOf(marker);
    if (index > 30) core = core.slice(0, index).trim();
  });
  const n = String(name || '').trim();
  if (n) {
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (let i = 0; i < 3; i += 1) {
      const next = core.replace(new RegExp('(?:[.!?]\\s*)?' + escaped + '\\.?\\s*$'), '').trim();
      if (next === core) break;
      core = next;
    }
  }
  if (core && !/[.!?]$/.test(core)) core += '.';
  return core.replace(/\s+/g, ' ').trim();
}

function isPhoneOnlyCrisis(resource, blurb) {
  const blob = `${resource.name} ${blurb} ${resource.phone}`.toLowerCase();
  return /\b(988|211|crisis|hotline|lifeline)\b/.test(blob) && /24\/7/.test(String(resource.hours || ''));
}

function vagueAddress(address) {
  return /available anywhere|countywide|statewide|charlotte metro|partner sites|planting sites|program site posted|event sites|services listed online|^charlotte, nc$/i.test(address);
}

function finish(words) {
  let text = words.join(' ').replace(/\s+/g, ' ').trim();
  if (!/[.!?]$/.test(text)) text += '.';
  return text;
}

function fitWords(text, pads) {
  let words = wordList(text);
  const extras = pads || [
    'Confirm hours before you go.',
    'Ask about eligibility and intake.',
    'Use only the contact already on this card.',
    'Schedules can change with holidays.',
    'Do not guess extra phone numbers.'
  ];
  let pad = 0;
  while (words.length < MIN_WORDS && pad < 12) {
    words = words.concat(wordList(extras[pad % extras.length]));
    pad += 1;
  }
  if (words.length > MAX_WORDS) {
    const cut = words.slice(0, MAX_WORDS);
    const joined = cut.join(' ');
    const period = joined.lastIndexOf('.');
    if (period > 0 && wordList(joined.slice(0, period)).length >= MIN_WORDS) {
      return joined.slice(0, period + 1);
    }
    return finish(cut);
  }
  return finish(words);
}

function expandDescription(resource) {
  const name = String(resource.name || 'This organization').trim();
  const blurb = originalBlurb(resource.description, name) || `${name} serves people in Charlotte-Mecklenburg.`;
  const address = String(resource.address || '').trim();
  const hours = String(resource.hours || '').trim();
  const phone = usablePhone(resource.phone);
  const website = usableWebsite(resource.website);
  const opps = new Set(Array.isArray(resource.opportunities) ? resource.opportunities.map(String) : []);
  const extra = [];

  if (isPhoneOnlyCrisis(resource, blurb)) {
    extra.push('It is a 24/7 line for Mecklenburg County, not a walk-in office.');
    if (phone) extra.push(`Call or text ${phone} for confidential support.`);
    if (website) extra.push(`Chat is on ${website}.`);
    extra.push('Save the number so you can find it during an emergency.');
    return fitWords([blurb].concat(extra).join(' '), [
      'This is not a volunteer signup.',
      'Help is free and confidential.',
      'Use it any hour of the day.'
    ]);
  }

  if (address && !vagueAddress(address)) extra.push(`It is listed at ${address}.`);
  else if (address) extra.push(`Service area: ${address}.`);
  if (hours) extra.push(`Hours: ${hours}.`);
  if (phone) extra.push(`Call ${phone} before you visit.`);
  if (website) extra.push(`Details are on ${website}.`);
  const uses = [];
  if (opps.has('help')) uses.push('get help');
  if (opps.has('volunteer')) uses.push('volunteer');
  if (opps.has('intern')) uses.push('check student roles on the official site');
  if (uses.length === 1) extra.push(`Use this listing to ${uses[0]}.`);
  else if (uses.length === 2) extra.push(`Use this listing to ${uses[0]} or ${uses[1]}.`);
  else if (uses.length > 2) extra.push(`Use this listing to ${uses[0]}, ${uses[1]}, or ${uses[2]}.`);

  return fitWords([blurb].concat(extra).join(' '));
}

function expandFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const list = Array.isArray(data.resources) ? data.resources : data;
  const bad = [];
  list.forEach((resource) => {
    resource.description = expandDescription(resource);
    const n = wordCount(resource.description);
    if (n < MIN_WORDS || n > MAX_WORDS) bad.push({ name: resource.name, n });
  });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  const counts = list.map((resource) => wordCount(resource.description));
  return {
    file: path.basename(filePath),
    count: list.length,
    min: Math.min(...counts),
    max: Math.max(...counts),
    bad
  };
}

console.log(JSON.stringify(FILES.map(expandFile), null, 2));
