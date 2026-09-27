/* QueenCityConnect: show our wake page instead of the host startup screen. */
const CACHE = 'qcc-wake-v2';
const WAKE_URL = '/wake.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([WAKE_URL, '/assets/images/logo.png', '/favicon.ico'])).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

function isNavigate(request) {
  return request.mode === 'navigate' || (request.method === 'GET' && (request.headers.get('accept') || '').includes('text/html'));
}

function isPassthrough(url) {
  const path = url.pathname;
  return path === WAKE_URL
    || path === '/sw.js'
    || path.startsWith('/api/')
    || path.startsWith('/assets/')
    || /\.(png|jpg|jpeg|svg|ico|css|js|json|webp|woff2?)$/i.test(path);
}

function looksLikeHostSplash(html) {
  const sample = String(html || '').slice(0, 12000);
  if (/QueenCityConnect|qcc-wake|id="qcc-wake"/i.test(sample)) return false;
  return /render\.com|onrender\.com|Starting your service|Your service is starting|spinning up|waiting for your service|Web Service is starting|environment variable|checking your service|connect(?:ing)? to (?:your )?service/i.test(sample);
}

function wakeResponse(request) {
  const dest = new URL(request.url);
  const next = dest.pathname + dest.search + dest.hash;
  return caches.match(WAKE_URL).then((cached) => {
    if (!cached) return fetch(WAKE_URL);
    return cached;
  }).then(async (res) => {
    if (!res) return fetch(WAKE_URL);
    if (next === '/' || next === '/index.html' || next === WAKE_URL) return res;
    const html = await res.text();
    const patched = html.replace(
      'var raw = new URLSearchParams(window.location.search).get(\'next\') || \'/\';',
      'var raw = ' + JSON.stringify(next) + ';'
    );
    return new Response(patched, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isPassthrough(url) || !isNavigate(request)) return;

  event.respondWith((async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1800);
    try {
      const res = await fetch(request, { signal: controller.signal });
      clearTimeout(timer);
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        return wakeResponse(request);
      }
      const type = res.headers.get('content-type') || '';
      if (res.ok && type.includes('text/html')) {
        const text = await res.clone().text();
        if (looksLikeHostSplash(text)) return wakeResponse(request);
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      return wakeResponse(request);
    }
  })());
});
