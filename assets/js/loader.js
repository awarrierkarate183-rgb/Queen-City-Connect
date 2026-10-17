(function qccLoader() {
  var SEEN_KEY = 'qcc-loader-seen';
  var overlay = null;
  var locked = false;

  function pathName() {
    try { return window.location.pathname || ''; } catch (e) { return ''; }
  }

  function alreadySeen() {
    try { return sessionStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return false; }
  }

  function markSeen() {
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
  }

  function restoreScroll() {
    locked = false;
    document.documentElement.style.overflow = '';
    if (document.body) document.body.style.overflow = '';
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
  }

  function lockScroll() {
    locked = true;
    document.documentElement.style.overflow = 'hidden';
    if (document.body) document.body.style.overflow = 'hidden';
  }

  function paint(mode) {
    if (!document.body) return;
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'qcc-loader';
      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-live', 'polite');
      document.body.appendChild(overlay);
      lockScroll();
    }
    if (mode === 'error') {
      overlay.innerHTML = '<div class="qcc-loader-inner"><h2>QueenCityConnect</h2><p>The directory is taking longer than usual. Check your connection, then try again.</p><button type="button" class="qcc-loader-retry">Try again</button></div>';
      var btn = overlay.querySelector('.qcc-loader-retry');
      if (btn) btn.addEventListener('click', function () { restoreScroll(); start(true); });
      return;
    }
    overlay.innerHTML = '<div class="qcc-loader-inner"><h2>QueenCityConnect</h2><p>Getting the directory ready. This only takes a moment.</p><div class="qcc-loader-spin" aria-hidden="true"></div></div>';
  }

  function checkHealth(ms) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, ms);
    return fetch('/api/health', { cache: 'no-store', credentials: 'omit', signal: controller.signal })
      .then(function (res) {
        clearTimeout(timer);
        return res.ok;
      })
      .catch(function () {
        clearTimeout(timer);
        return false;
      });
  }

  async function start(force) {
    if (!force && alreadySeen()) return;
    var ready = await checkHealth(1000);
    if (ready) {
      markSeen();
      restoreScroll();
      return;
    }
    paint('wait');
    var waited = 0;
    while (waited < 75000) {
      ready = await checkHealth(2000);
      if (ready) {
        markSeen();
        restoreScroll();
        return;
      }
      waited += 2000;
    }
    paint('error');
  }

  function noteInAppBrowser() {
    if (!/signin\.html$/i.test(pathName())) return;
    var ua = String(navigator.userAgent || '');
    if (!/(Instagram|FBAN|FBAV|FB_IAB|TikTok|BytedanceWebview|Snapchat|LinkedInApp)/i.test(ua)) return;
    var slot = document.getElementById('auth-lead');
    if (!slot || document.getElementById('qcc-inapp-note')) return;
    var note = document.createElement('p');
    note.id = 'qcc-inapp-note';
    note.className = 'qcc-inapp-note';
    note.textContent = 'Google sign-in does not work in this in-app browser. Open this page in Safari or Chrome, or use email sign-in below.';
    slot.insertAdjacentElement('afterend', note);
  }

  window.addEventListener('pageshow', function (event) {
    if (event.persisted) restoreScroll();
  });

  function boot() {
    noteInAppBrowser();
    start(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
