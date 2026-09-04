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

  const USERS_KEY = 'qcc-local-users';
  const SESSION_KEY = 'qcc-local-session';

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

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function loadLocalUsers() {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveLocalUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function defaultState() {
    return {
      bookmarks: [],
      hubPrefs: { categories: ['All'], search: '', hours: 'All', sort: 'best', view: 'list', opportunity: 'All' },
      recentlyViewed: [],
      submissions: [],
      newsletterEmail: null,
      activity: []
    };
  }

  function publicLocalUser(user) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      hasGoogle: Boolean(user.googleId),
      hasPassword: Boolean(user.passwordHash)
    };
  }

  function localSessionPayload(user) {
    localStorage.setItem(SESSION_KEY, String(user.id));
    return {
      user: publicLocalUser(user),
      state: Object.assign(defaultState(), user.state || {}),
      googleEnabled: QCCAuth.googleEnabled,
      googleClientId: QCCAuth.googleClientId
    };
  }

  function bytesToB64(bytes) {
    let binary = '';
    const arr = new Uint8Array(bytes);
    for (let i = 0; i < arr.length; i += 1) binary += String.fromCharCode(arr[i]);
    return btoa(binary);
  }

  function b64ToBytes(value) {
    const binary = atob(value);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) arr[i] = binary.charCodeAt(i);
    return arr;
  }

  async function hashPassword(password, saltB64) {
    const salt = saltB64 ? b64ToBytes(saltB64) : crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 120000 }, key, 256);
    return { hash: bytesToB64(bits), salt: bytesToB64(salt) };
  }

  function decodeJwt(token) {
    const part = String(token || '').split('.')[1];
    if (!part) throw new Error('Google Sign-In did not complete.');
    const padded = part.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((part.length + 3) % 4);
    return JSON.parse(atob(padded));
  }

  function shouldFallback(response) {
    if (!response) return true;
    if (response.status === 404) return true;
    const type = response.headers.get('content-type') || '';
    return response.status >= 400 && !type.includes('application/json');
  }

  async function localRegister(name, email, password) {
    email = normalizeEmail(email);
    name = String(name || '').trim().slice(0, 80);
    if (!name) throw new Error('Name is required.');
    if (!isValidEmail(email)) throw new Error('Enter a valid email address.');
    if (String(password || '').length < 8) throw new Error('Password must be at least 8 characters.');
    const users = loadLocalUsers();
    if (users.some((user) => user.email === email)) {
      throw new Error('An account with that email already exists. Sign in instead.');
    }
    const secret = await hashPassword(password);
    const user = {
      id: 'local-' + Date.now(),
      name,
      email,
      passwordHash: secret.hash,
      passwordSalt: secret.salt,
      googleId: null,
      state: defaultState()
    };
    users.push(user);
    saveLocalUsers(users);
    QCCAuth.mode = 'local';
    return localSessionPayload(user);
  }

  async function localLogin(email, password) {
    email = normalizeEmail(email);
    const user = loadLocalUsers().find((item) => item.email === email);
    if (!user || !user.passwordHash) throw new Error('Email or password is incorrect.');
    const secret = await hashPassword(password, user.passwordSalt);
    if (secret.hash !== user.passwordHash) throw new Error('Email or password is incorrect.');
    QCCAuth.mode = 'local';
    return localSessionPayload(user);
  }

  async function localGoogle(credential) {
    const payload = decodeJwt(credential);
    if (QCCAuth.googleClientId && payload.aud && payload.aud !== QCCAuth.googleClientId) {
      throw new Error('Google Sign-In client does not match this site.');
    }
    if (payload.exp && Number(payload.exp) * 1000 < Date.now()) {
      throw new Error('Google Sign-In expired. Try again.');
    }
    const email = normalizeEmail(payload.email);
    const googleId = String(payload.sub || '');
    const name = String(payload.name || payload.given_name || 'Neighbor').slice(0, 80);
    if (!email || !googleId) throw new Error('Google Sign-In did not complete.');
    const users = loadLocalUsers();
    let user = users.find((item) => item.googleId === googleId) || users.find((item) => item.email === email);
    if (user) {
      user.googleId = googleId;
      user.name = user.name || name;
    } else {
      user = {
        id: 'local-' + Date.now(),
        name,
        email,
        passwordHash: null,
        passwordSalt: null,
        googleId,
        state: defaultState()
      };
      users.push(user);
    }
    saveLocalUsers(users);
    QCCAuth.mode = 'local';
    return localSessionPayload(user);
  }

  function localRefresh() {
    const id = localStorage.getItem(SESSION_KEY);
    if (!id) return { user: null, state: null, googleEnabled: QCCAuth.googleEnabled, googleClientId: QCCAuth.googleClientId };
    const user = loadLocalUsers().find((item) => String(item.id) === String(id));
    if (!user) {
      localStorage.removeItem(SESSION_KEY);
      return { user: null, state: null, googleEnabled: QCCAuth.googleEnabled, googleClientId: QCCAuth.googleClientId };
    }
    QCCAuth.mode = 'local';
    return localSessionPayload(user);
  }

  function localSaveState(patch) {
    const id = localStorage.getItem(SESSION_KEY);
    const users = loadLocalUsers();
    const user = users.find((item) => String(item.id) === String(id));
    if (!user) return null;
    const next = Object.assign(defaultState(), user.state || {});
    const incoming = Object.assign({}, patch);
    if (incoming.mergeBookmarks && Array.isArray(incoming.bookmarks)) {
      next.bookmarks = [...new Set([...(next.bookmarks || []), ...incoming.bookmarks].map(Number).filter((n) => n > 0))];
      delete incoming.bookmarks;
    }
    delete incoming.mergeBookmarks;
    Object.assign(next, incoming);
    user.state = next;
    saveLocalUsers(users);
    return localSessionPayload(user);
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
    const response = await fetch(sitePath(url), {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(options && options.headers) },
      ...options
    });
    const type = response.headers.get('content-type') || '';
    const data = type.includes('application/json')
      ? await response.json().catch(() => ({}))
      : {};
    if (shouldFallback(response)) {
      const error = new Error('API_FALLBACK');
      error.status = response.status;
      error.fallback = true;
      throw error;
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
    if (data.googleEnabled != null) QCCAuth.googleEnabled = Boolean(data.googleEnabled);
    if (data.googleClientId) QCCAuth.googleClientId = data.googleClientId;
    if (data.googleRedirectEnabled != null) QCCAuth.googleRedirectEnabled = Boolean(data.googleRedirectEnabled);
    if (QCCAuth.user && QCCAuth.state && Array.isArray(QCCAuth.state.bookmarks)) {
      localStorage.setItem('clt-bookmarks', JSON.stringify(QCCAuth.state.bookmarks));
    }
    renderNav();
    return data;
  };

  async function loadPublicConfig() {
    try {
      const data = await api('/api/auth/config');
      QCCAuth.googleEnabled = Boolean(data.googleEnabled || data.googleClientId);
      QCCAuth.googleClientId = data.googleClientId || '';
      QCCAuth.googleRedirectEnabled = Boolean(data.googleRedirectEnabled);
      QCCAuth.mode = 'server';
      return data;
    } catch {
      try {
        const data = await fetch(sitePath('/data/auth-config.json')).then((r) => r.json());
        QCCAuth.googleClientId = data.googleClientId || '';
        QCCAuth.googleEnabled = Boolean(QCCAuth.googleClientId);
        QCCAuth.mode = 'local';
        return data;
      } catch {
        QCCAuth.googleEnabled = false;
        QCCAuth.googleClientId = '';
        QCCAuth.mode = 'local';
        return null;
      }
    }
  }

  QCCAuth.refresh = async function () {
    try {
      const data = await api('/api/me');
      QCCAuth.mode = 'server';
      return QCCAuth.applySession(data);
    } catch (err) {
      await loadPublicConfig();
      if (err && err.fallback) {
        return QCCAuth.applySession(localRefresh());
      }
      QCCAuth.user = null;
      QCCAuth.state = null;
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
    if (QCCAuth.mode === 'local') {
      const data = localSaveState(pendingPatch);
      pendingPatch = {};
      if (data) QCCAuth.applySession(data);
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
    if (QCCAuth.mode === 'local') {
      QCCAuth.applySession(localSaveState(patch));
      return;
    }
    const data = await api('/api/me/state', {
      method: 'PUT',
      body: JSON.stringify(patch)
    });
    QCCAuth.applySession(data);
  };

  function canFallback(err) {
    return Boolean(err && (err.fallback || err.name === 'TypeError' || /Failed to fetch|NetworkError/i.test(err.message || '')));
  }

  QCCAuth.login = async function (email, password) {
    sessionStorage.setItem('clt-guest-bookmarks', JSON.stringify(guestBookmarks()));
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      QCCAuth.mode = 'server';
      QCCAuth.applySession(data);
    } catch (err) {
      if (!canFallback(err)) throw err;
      QCCAuth.applySession(await localLogin(email, password));
    }
    await QCCAuth.mergeGuestOnLogin();
    return QCCAuth;
  };

  QCCAuth.register = async function (name, email, password) {
    sessionStorage.setItem('clt-guest-bookmarks', JSON.stringify(guestBookmarks()));
    try {
      const data = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password })
      });
      QCCAuth.mode = 'server';
      QCCAuth.applySession(data);
    } catch (err) {
      if (!canFallback(err)) throw err;
      QCCAuth.applySession(await localRegister(name, email, password));
    }
    await QCCAuth.mergeGuestOnLogin();
    return QCCAuth;
  };

  QCCAuth.loginWithGoogle = async function (credential) {
    sessionStorage.setItem('clt-guest-bookmarks', JSON.stringify(guestBookmarks()));
    try {
      const data = await api('/api/auth/google/id-token', {
        method: 'POST',
        body: JSON.stringify({ credential })
      });
      QCCAuth.mode = 'server';
      QCCAuth.applySession(data);
    } catch (err) {
      if (!canFallback(err)) throw err;
      QCCAuth.applySession(await localGoogle(credential));
    }
    await QCCAuth.mergeGuestOnLogin();
    return QCCAuth;
  };

  QCCAuth.forgotPassword = async function (email) {
    try {
      return await api('/api/auth/forgot', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
    } catch (err) {
      if (!canFallback(err)) throw err;
      return {
        ok: true,
        message: 'Password reset needs the QueenCityConnect server (npm start). If this site is running, check that email and try again.'
      };
    }
  };

  QCCAuth.resetPassword = async function (token, password) {
    sessionStorage.setItem('clt-guest-bookmarks', JSON.stringify(guestBookmarks()));
    try {
      const data = await api('/api/auth/reset', {
        method: 'POST',
        body: JSON.stringify({ token, password })
      });
      QCCAuth.mode = 'server';
      QCCAuth.applySession(data);
    } catch (err) {
      if (!canFallback(err)) throw err;
      throw new Error('Password reset needs the QueenCityConnect server (npm start).');
    }
    await QCCAuth.mergeGuestOnLogin();
    return QCCAuth;
  };

  QCCAuth.logout = async function () {
    await QCCAuth.flushSave();
    try {
      if (QCCAuth.mode === 'server') {
        await api('/api/auth/logout', { method: 'POST', body: '{}' });
      }
    } catch {
      /* still clear client session */
    }
    localStorage.removeItem(SESSION_KEY);
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

  QCCAuth.initGoogleButton = function (elementId) {
    const host = document.getElementById(elementId);
    if (!host) return;
    if (!QCCAuth.googleClientId) {
      host.hidden = true;
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
            window.location.href = next.includes('://') ? 'hub.html' : next;
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
      window.google.accounts.id.renderButton(host, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 360
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
    if (QCCAuth.mode === 'local') {
      localSaveState(pendingPatch);
      pendingPatch = {};
      return;
    }
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
