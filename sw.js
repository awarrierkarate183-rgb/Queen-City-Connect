/* QueenCityConnect: never show the host startup page. */
const CACHE = 'qcc-wake-v3';
const WAKE_URL = '/wake.html';
const PRECACHE = [WAKE_URL, '/assets/images/logo.png', '/assets/images/logo.svg', '/favicon.ico'];

const INLINE_WAKE = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="robots" content="noindex"/><title>QueenCityConnect</title><style>html,body{margin:0;min-height:100%;background:#faf9f7;color:#1a1a1a}body{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:32px 24px;font-family:system-ui,-apple-system,sans-serif}.wake{width:min(400px,100%);text-align:center}.wake-mark{width:72px;height:72px;margin:0 auto 22px;display:block;border-radius:16px;box-shadow:0 8px 24px rgba(26,92,56,.16)}h1{margin:0 0 10px;font-family:Georgia,"Times New Roman",serif;font-size:30px;letter-spacing:-.02em;font-weight:400}h1 span{color:#1a5c38;font-weight:700}p{margin:0 auto;max-width:32ch;font-size:16px;line-height:1.55;color:#3d3d3d}.wake-spin{width:28px;height:28px;margin:28px auto 0;border:2.5px solid #e8e4df;border-top-color:#1a5c38;border-radius:50%;animation:qcc-spin .8s linear infinite}@keyframes qcc-spin{to{transform:rotate(360deg)}}</style></head><body><div class="wake" id="qcc-wake"><svg class="wake-mark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#1a5c38"/><path fill="#f0ece6" d="M18 22 L24 10 L32 18 L40 10 L46 22 Z"/><circle cx="32" cy="36" r="14.5" fill="none" stroke="#f0ece6" stroke-width="5.2"/><g fill="#f0ece6"><rect x="22.2" y="34" width="3.2" height="8"/><rect x="26" y="31.2" width="3.4" height="10.8"/><path d="M31.1 24.8 L33 22.2 L34.9 24.8 L34.9 42 L31.1 42 Z"/><rect x="35.6" y="32.4" width="3.2" height="9.6"/><rect x="39.2" y="35" width="2.8" height="7"/></g><path d="M41 45.5 C44 48.5 47 49.2 50.2 47.6" fill="none" stroke="#e8d5a3" stroke-width="3.4" stroke-linecap="round"/><circle cx="50.6" cy="47.2" r="2.4" fill="#e8d5a3"/><circle cx="46.4" cy="52.4" r="1.7" fill="#b8d4c4"/><circle cx="54.2" cy="51.6" r="1.5" fill="#f0ece6"/></svg><h1>Queen<span>City</span>Connect</h1><p role="status">Getting the directory ready. This only takes a moment.</p><div class="wake-spin" aria-hidden="true"></div></div><script>(function(){function safeNext(){try{var raw=new URLSearchParams(window.location.search).get('next')||'/';if(raw.charAt(0)!=='/')raw='/'+raw;if(raw.indexOf('//')===0||/[\\\\:]/.test(raw))return'/';return raw}catch(e){return'/'}}var dest=safeNext();var tries=0;async function ready(){try{var res=await fetch('/api/health',{cache:'no-store',credentials:'omit'});if(res.ok)return true}catch(e){}return false}async function tick(){tries+=1;if(await ready()||tries>80){window.location.replace(dest);return}setTimeout(tick,1200)}tick()})();</script></body></html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).catch(() => {})
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

function isOurHtml(html) {
  return /QueenCityConnect|id="qcc-wake"|qcc-wake/i.test(String(html || ''));
}

function isPrecached(url) {
  return PRECACHE.includes(url.pathname);
}

function wakeHeaders() {
  return { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' };
}

function inlineWake(next) {
  let html = INLINE_WAKE;
  if (next && next !== '/' && next !== '/index.html' && next !== WAKE_URL) {
    html = html.replace(
      "var raw=new URLSearchParams(window.location.search).get('next')||'/'",
      'var raw=' + JSON.stringify(next)
    );
  }
  return new Response(html, { status: 200, headers: wakeHeaders() });
}

async function wakeResponse(request) {
  const dest = new URL(request.url);
  const next = dest.pathname + dest.search + dest.hash;
  try {
    const cached = await caches.match(WAKE_URL);
    if (cached) {
      if (next === '/' || next === '/index.html' || next === WAKE_URL) return cached;
      const html = await cached.text();
      const patched = html.replace(
        "var raw = new URLSearchParams(window.location.search).get('next') || '/';",
        'var raw = ' + JSON.stringify(next) + ';'
      );
      return new Response(patched, { status: 200, headers: wakeHeaders() });
    }
  } catch (e) {}
  return inlineWake(next);
}

async function networkIfOurs(request) {
  const res = await fetch(request);
  if (res.status === 502 || res.status === 503 || res.status === 504) return null;
  const type = res.headers.get('content-type') || '';
  if (type.includes('text/html') || isNavigate(request)) {
    const text = await res.clone().text();
    if (!isOurHtml(text)) return null;
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === '/sw.js' || url.pathname.startsWith('/api/')) return;

  if (isPrecached(url)) {
    event.respondWith(
      caches.match(url.pathname).then((cached) => cached || fetch(request).catch(() => cached))
    );
    return;
  }

  if (!isNavigate(request)) return;

  event.respondWith((async () => {
    const network = networkIfOurs(request).catch(() => null);
    const waited = await Promise.race([
      network.then((res) => (res ? { kind: 'ok', res } : { kind: 'bad' })),
      new Promise((resolve) => setTimeout(() => resolve({ kind: 'slow' }), 400))
    ]);
    if (waited.kind === 'ok') return waited.res;
    return wakeResponse(request);
  })());
});
