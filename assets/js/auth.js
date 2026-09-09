(function () {
  const QCCAuth = {
    user: null,
    state: null,
    googleEnabled: false,
    googleClientId: '',
    googleRedirectEnabled: false,
    mode: 'server',
    ready: Promise.resolve()
  };

  let saveTimer = null;
  let pendingPatch = {};
  let flushPromise = null;

  function sitePath(path) {
    const clean = path.startsWith('/') ? path : '/' + path;
    const pathname = window.location.pathname.replace(/\/[^/]*\.[A-Za-z0-9]+$/, '/');
    if (pathname && pathname !== '/') {
      return pathname.replace(/\/$/, '') + clean;
    }
    return clean;
  }

  function guestBookmarks() {
    try {
      return JSON.parse(localStorage.getItem('clt-bookmarks') || '[]').map(Number).filter((n) => n > 0);
    } catch {
      return [];
    }
  }

  function guestSubmissions() {
    try {
      return JSON.parse(localStorage.getItem('clt-submissions') || '[]');
    } catch {
      return [];
    }
  }

  function currentNext() {
    const page = window.location.pathname.split('/').pop() || 'index.html';
    if (page === 'signin.html' || page === 'reset.html') {
      const params = new URLSearchParams(window.location.search);
      return params.get('next') || 'saved.html';
    }
    if (page === 'saved.html') return 'saved.html';
    return page + window.location.search + window.location.hash;
  }

  function signInHref() {
    return 'signin.html?next=' + encodeURIComponent(currentNext());
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function firstName(name) {
    return String(name || 'Account').trim().split(/\s+/)[0];
  }

  function serverUnavailableError() {
    return new Error('Could not reach the QueenCityConnect account server. Open the live site or run npm start so this login saves to the shared database.');
  }

  function renderNav() {
    const host = document.getElementById('nav-account');
    if (!host) return;
    if (QCCAuth.user) {
      host.innerHTML =
        '<span class="nav-account-name" title="' + escapeHtml(QCCAuth.user.email) + '">' +
        escapeHtml(firstName(QCCAuth.user.name)) +
        '</span>' +
        '<a href="saved.html" class="nav-cta nav-saves">My Saves</a>' +
        '<button type="button" class="nav-sign-out" id="nav-sign-out">Sign out</button>';
      const btn = document.getElementById('nav-sign-out');
      if (btn) {
        btn.addEventListener('click', async () => {
          await QCCAuth.logout();
          window.location.href = 'index.html';
        });
      }
      return;
    }
    host.innerHTML = '<a href="' + signInHref() + '" class="nav-sign-in">Sign In</a>';
  }

  async function api(url, options) {
    let response;
    try {
      response = await fetch(sitePath(url), {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(options && options.headers) },
        ...options
      });
    } catch {
      throw serverUnavailableError();
    }
    const type = response.headers.get('content-type') || '';
    const data = type.includes('application/json')
      ? await response.json().catch(() => ({}))
      : {};
    if (!type.includes('application/json')) {
      throw serverUnavailableError();
    }
    if (!response.ok) {
      const error = new Error(data.error || 'Request failed.');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  QCCAuth.applySession = function (data) {
    QCCAuth.user = data.user || null;
    QCCAuth.state = data.state || null;
    QCCAuth.mode = 'server';
    if (data.googleEnabled != null) QCCAuth.googleEnabled = Boolean(data.googleEnabled);
    if (data.googleClientId) QCCAuth.googleClientId = data.googleClientId;
    if (data.googleRedirectEnabled != null) QCCAuth.googleRedirectEnabled = Boolean(data.googleRedirectEnabled);
    if (QCCAuth.user && QCCAuth.state && Array.isArray(QCCAuth.state.bookmarks)) {
      localStorage.setItem('clt-bookmarks', JSON.stringify(QCCAuth.state.bookmarks));
    }
    renderNav();
    return data;
  };

  async function loadGoogleClientId() {
    try {
      const data = await api('/api/auth/config');
      QCCAuth.googleEnabled = Boolean(data.googleEnabled || data.googleClientId);
      QCCAuth.googleClientId = data.googleClientId || '';
      QCCAuth.googleRedirectEnabled = Boolean(data.googleRedirectEnabled);
      if (QCCAuth.googleClientId) return;
    } catch {
      /* static hosts have no /api — fall through to the public config file */
    }
    try {
      const data = await fetch(sitePath('/data/auth-config.json')).then((response) => {
        if (!response.ok) throw new Error('missing auth config');
        return response.json();
      });
      QCCAuth.googleClientId = (data && data.googleClientId) || QCCAuth.googleClientId || '';
      QCCAuth.googleEnabled = Boolean(QCCAuth.googleClientId);
    } catch {
      if (!QCCAuth.googleClientId) {
        QCCAuth.googleEnabled = false;
        QCCAuth.googleRedirectEnabled = false;
      }
    }
  }

  QCCAuth.refresh = async function () {
    try {
      const data = await api('/api/me');
      QCCAuth.applySession(data);
      if (!QCCAuth.googleClientId) await loadGoogleClientId();
      return data;
    } catch {
      QCCAuth.user = null;
      QCCAuth.state = null;
      await loadGoogleClientId();
      renderNav();
      return null;
    }
  };

  QCCAuth.flushSave = async function () {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!QCCAuth.user || !Object.keys(pendingPatch).length) {
      return QCCAuth.state;
    }
    if (flushPromise) return flushPromise;
    const toSend = pendingPatch;
    pendingPatch = {};
    flushPromise = api('/api/me/state', {
      method: 'PUT',
      body: JSON.stringify(toSend)
    }).then((data) => {
      QCCAuth.applySession(data);
      return data;
    }).catch((err) => {
      pendingPatch = { ...toSend, ...pendingPatch };
      console.error('Could not save account data', err);
      return null;
    }).finally(() => {
      flushPromise = null;
    });
    return flushPromise;
  };

  QCCAuth.saveState = function (patch, options) {
    if (!QCCAuth.user) return Promise.resolve(null);
    pendingPatch = { ...pendingPatch, ...patch };
    QCCAuth.state = { ...(QCCAuth.state || {}), ...pendingPatch };
    if (Array.isArray(pendingPatch.bookmarks)) {
      localStorage.setItem('clt-bookmarks', JSON.stringify(pendingPatch.bookmarks));
    }
    if (options && options.immediate) {
      return QCCAuth.flushSave();
    }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      QCCAuth.flushSave();
    }, 200);
    return Promise.resolve(QCCAuth.state);
  };

  QCCAuth.mergeGuestOnLogin = async function () {
    if (!QCCAuth.user) return;
    const bookmarks = guestBookmarks();
    const submissions = guestSubmissions();
    const patch = { mergeBookmarks: true };
    if (bookmarks.length) patch.bookmarks = bookmarks;
    if (submissions.length) {
      patch.submissions = [...(QCCAuth.state && QCCAuth.state.submissions ? QCCAuth.state.submissions : []), ...submissions];
    }
    if (!patch.bookmarks && !patch.submissions) return;
    const data = await api('/api/me/state', {
      method: 'PUT',
      body: JSON.stringify(patch)
    });
    QCCAuth.applySession(data);
  };

  QCCAuth.login = async function (email, password) {
    sessionStorage.setItem('clt-guest-bookmarks', JSON.stringify(guestBookmarks()));
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    QCCAuth.applySession(data);
    await QCCAuth.mergeGuestOnLogin();
    return QCCAuth;
  };

  QCCAuth.register = async function (name, email, password) {
    sessionStorage.setItem('clt-guest-bookmarks', JSON.stringify(guestBookmarks()));
    const data = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    QCCAuth.applySession(data);
    await QCCAuth.mergeGuestOnLogin();
    return QCCAuth;
  };

  QCCAuth.loginWithGoogle = async function (credential) {
    sessionStorage.setItem('clt-guest-bookmarks', JSON.stringify(guestBookmarks()));
    const data = await api('/api/auth/google/id-token', {
      method: 'POST',
      body: JSON.stringify({ credential })
    });
    QCCAuth.applySession(data);
    await QCCAuth.mergeGuestOnLogin();
    return QCCAuth;
  };

  QCCAuth.forgotPassword = async function (email) {
    return api('/api/auth/forgot', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  };

  QCCAuth.resetPassword = async function (token, password) {
    sessionStorage.setItem('clt-guest-bookmarks', JSON.stringify(guestBookmarks()));
    const data = await api('/api/auth/reset', {
      method: 'POST',
      body: JSON.stringify({ token, password })
    });
    QCCAuth.applySession(data);
    await QCCAuth.mergeGuestOnLogin();
    return QCCAuth;
  };

  QCCAuth.logout = async function () {
    await QCCAuth.flushSave();
    try {
      await api('/api/auth/logout', { method: 'POST', body: '{}' });
    } catch {
      /* still clear client session */
    }
    QCCAuth.user = null;
    QCCAuth.state = null;
    pendingPatch = {};
    try {
      const guest = JSON.parse(sessionStorage.getItem('clt-guest-bookmarks') || '[]');
      localStorage.setItem('clt-bookmarks', JSON.stringify(guest));
      sessionStorage.removeItem('clt-guest-bookmarks');
    } catch {
      localStorage.setItem('clt-bookmarks', '[]');
    }
    renderNav();
  };

  QCCAuth.recordActivity = function (type, resourceId) {
    if (!QCCAuth.user) return;
    const now = new Date().toISOString();
    const activity = [...((QCCAuth.state && QCCAuth.state.activity) || []), {
      type,
      resourceId: resourceId == null ? null : Number(resourceId),
      at: now
    }].slice(-200);
    const patch = { activity };
    if (resourceId != null) {
      const viewed = ((QCCAuth.state && QCCAuth.state.recentlyViewed) || [])
        .filter((item) => Number(item.id) !== Number(resourceId));
      viewed.unshift({ id: Number(resourceId), at: now });
      patch.recentlyViewed = viewed.slice(0, 50);
    }
    QCCAuth.saveState(patch);
  };

  QCCAuth.appendSubmission = function (payload) {
    const local = guestSubmissions();
    local.push(payload);
    localStorage.setItem('clt-submissions', JSON.stringify(local));
    if (!QCCAuth.user) return Promise.resolve();
    const submissions = [...((QCCAuth.state && QCCAuth.state.submissions) || []), payload].slice(-100);
    return QCCAuth.saveState({ submissions }, { immediate: true });
  };

  QCCAuth.googleStartUrl = function (next) {
    const dest = next || currentNext();
    const safe = String(dest).includes('://') ? 'saved.html' : dest;
    return sitePath('/api/auth/google') + '?next=' + encodeURIComponent('/' + String(safe).replace(/^\//, ''));
  };

  QCCAuth.initGoogleButton = function (elementId) {
    const host = document.getElementById(elementId);
    if (!host) return;
    if (!QCCAuth.googleClientId) {
      host.hidden = true;
      host.innerHTML = '';
      return;
    }
    host.hidden = false;
    const start = () => {
      if (!window.google || !window.google.accounts || !window.google.accounts.id) return false;
      window.google.accounts.id.initialize({
        client_id: QCCAuth.googleClientId,
        callback: async (response) => {
          try {
            await QCCAuth.loginWithGoogle(response.credential);
            const params = new URLSearchParams(window.location.search);
            const next = params.get('next') || 'saved.html';
            window.location.href = next.includes('://') ? 'saved.html' : next;
          } catch (err) {
            const el = document.getElementById('auth-error');
            if (el) {
              el.hidden = false;
              el.textContent = err.message || 'Google Sign-In did not complete.';
            }
          }
        }
      });
      host.innerHTML = '';
      const width = Math.min(360, Math.max(240, host.clientWidth || 320));
      window.google.accounts.id.renderButton(host, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width
      });
      return true;
    };
    if (start()) return;
    const existing = document.querySelector('script[data-qcc-gis]');
    if (existing) {
      existing.addEventListener('load', start);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.qccGis = 'true';
    script.addEventListener('load', start);
    document.head.appendChild(script);
  };

  function flushOnLeave() {
    if (!QCCAuth.user || !Object.keys(pendingPatch).length) return;
    const toSend = pendingPatch;
    pendingPatch = {};
    const body = JSON.stringify(toSend);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(sitePath('/api/me/state'), new Blob([body], { type: 'application/json' }));
    } else {
      fetch(sitePath('/api/me/state'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true
      }).catch(() => {});
    }
  }

  window.addEventListener('pagehide', flushOnLeave);
  window.addEventListener('beforeunload', flushOnLeave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushOnLeave();
  });

  window.QCCAuth = QCCAuth;
  QCCAuth.ready = QCCAuth.refresh();
  document.addEventListener('DOMContentLoaded', renderNav);
})();
