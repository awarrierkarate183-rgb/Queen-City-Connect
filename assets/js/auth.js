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

  const ACCOUNTS_KEY = 'qcc-local-accounts';
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

  function serverUnavailableError() {
    return new Error('Could not reach the QueenCityConnect account server. Open the live site or run npm start so this login saves to the shared database.');
  }

  function isServerDown(err) {
    return !err || !err.status || err.message === serverUnavailableError().message;
  }

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function emptyState() {
    return {
      bookmarks: [],
      hubPrefs: {
        categories: ['All'],
        search: '',
        hours: 'All',
        sort: 'best',
        view: 'list',
        opportunity: 'All'
      },
      recentlyViewed: [],
      submissions: [],
      newsletterEmail: null,
      activity: [],
      bookmarkSnapshots: {}
    };
  }

  function readAccounts() {
    try {
      const data = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '{}');
      return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    } catch {
      return {};
    }
  }

  function writeAccounts(accounts) {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  }

  function publicFromAccount(account) {
    return {
      id: account.id,
      name: account.name,
      email: account.email,
      hasGoogle: Boolean(account.googleSub),
      hasPassword: Boolean(account.passwordHash)
    };
  }

  async function sha256Hex(text) {
    const bytes = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function hashPassword(password, salt) {
    return sha256Hex(salt + '\n' + password);
  }

  function parseGoogleCredential(credential) {
    const parts = String(credential || '').split('.');
    if (parts.length < 2) throw new Error('Google Sign-In did not complete.');
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded);
    let payload;
    try {
      payload = JSON.parse(decodeURIComponent(Array.from(binary, (ch) => (
        '%' + ch.charCodeAt(0).toString(16).padStart(2, '0')
      )).join('')));
    } catch {
      payload = JSON.parse(binary);
    }
    if (!payload.email) throw new Error('Google Sign-In did not complete.');
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      throw new Error('Google Sign-In expired. Try again.');
    }
    return {
      email: normalizeEmail(payload.email),
      name: String(payload.name || payload.given_name || payload.email).trim().slice(0, 80),
      sub: String(payload.sub || '')
    };
  }

  function applyLocalAccount(account) {
    QCCAuth.mode = 'local';
    QCCAuth.user = publicFromAccount(account);
    QCCAuth.state = { ...emptyState(), ...(account.state || {}) };
    localStorage.setItem(SESSION_KEY, account.email);
    if (Array.isArray(QCCAuth.state.bookmarks)) {
      localStorage.setItem('clt-bookmarks', JSON.stringify(QCCAuth.state.bookmarks));
    }
    renderNav();
    return { user: QCCAuth.user, state: QCCAuth.state };
  }

  function persistLocalAccount(patch) {
    if (!QCCAuth.user) return;
    const accounts = readAccounts();
    const email = QCCAuth.user.email;
    if (!accounts[email]) return;
    accounts[email] = { ...accounts[email], ...patch, state: { ...emptyState(), ...(QCCAuth.state || {}) } };
    writeAccounts(accounts);
  }

  async function localRegister(name, email, password) {
    const cleanName = String(name || '').trim().slice(0, 80);
    const cleanEmail = normalizeEmail(email);
    if (!cleanName) throw new Error('Name is required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error('Enter a valid email address.');
    if (String(password || '').length < 8) throw new Error('Password must be at least 8 characters.');
    const accounts = readAccounts();
    const existing = accounts[cleanEmail];
    const salt = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    const passwordHash = await hashPassword(password, salt);
    if (existing) {
      if (existing.passwordHash) {
        throw new Error('An account with that email already exists. Sign in instead.');
      }
      existing.name = cleanName || existing.name;
      existing.passwordHash = passwordHash;
      existing.salt = salt;
      writeAccounts(accounts);
      return applyLocalAccount(existing);
    }
    const account = {
      id: 'local-' + Date.now(),
      name: cleanName,
      email: cleanEmail,
      passwordHash,
      salt,
      googleSub: '',
      state: emptyState(),
      createdAt: new Date().toISOString()
    };
    accounts[cleanEmail] = account;
    writeAccounts(accounts);
    return applyLocalAccount(account);
  }

  async function localLogin(email, password) {
    const cleanEmail = normalizeEmail(email);
    const accounts = readAccounts();
    const account = accounts[cleanEmail];
    if (!account) throw new Error('Email or password is incorrect.');
    if (!account.passwordHash) throw new Error('This account uses Google. Continue with Google instead.');
    const guess = await hashPassword(password, account.salt || '');
    if (guess !== account.passwordHash) throw new Error('Email or password is incorrect.');
    return applyLocalAccount(account);
  }

  function localGoogle(credential) {
    const profile = parseGoogleCredential(credential);
    const accounts = readAccounts();
    let account = accounts[profile.email] || Object.values(accounts).find((item) => item.googleSub && item.googleSub === profile.sub);
    if (!account) {
      account = {
        id: 'local-' + Date.now(),
        name: profile.name,
        email: profile.email,
        passwordHash: '',
        salt: '',
        googleSub: profile.sub,
        state: emptyState(),
        createdAt: new Date().toISOString()
      };
      accounts[profile.email] = account;
    } else {
      account.googleSub = profile.sub || account.googleSub;
      if (profile.name && !account.name) account.name = profile.name;
      accounts[account.email] = account;
    }
    writeAccounts(accounts);
    return applyLocalAccount(account);
  }

  function restoreLocalSession() {
    const email = localStorage.getItem(SESSION_KEY) || '';
    const account = email && readAccounts()[email];
    if (!account) {
      QCCAuth.mode = 'local';
      QCCAuth.user = null;
      QCCAuth.state = null;
      renderNav();
      return null;
    }
    return applyLocalAccount(account);
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
    QCCAuth.mode = data.mode || 'server';
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
      restoreLocalSession();
      await loadGoogleClientId();
      return QCCAuth.user ? { user: QCCAuth.user, state: QCCAuth.state } : null;
    }
  };

  QCCAuth.flushSave = async function () {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!QCCAuth.user || !Object.keys(pendingPatch).length) {
      return QCCAuth.state;
    }
    if (QCCAuth.mode === 'local') {
      persistLocalAccount({});
      pendingPatch = {};
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
      if (isServerDown(err)) {
        QCCAuth.mode = 'local';
        persistLocalAccount({});
        pendingPatch = {};
        return QCCAuth.state;
      }
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
    QCCAuth.state = { ...(QCCAuth.state || emptyState()), ...pendingPatch };
    if (Array.isArray(pendingPatch.bookmarks)) {
      localStorage.setItem('clt-bookmarks', JSON.stringify(pendingPatch.bookmarks));
    }
    if (QCCAuth.mode === 'local') {
      persistLocalAccount({});
      pendingPatch = {};
      return Promise.resolve(QCCAuth.state);
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
      const current = QCCAuth.state || emptyState();
      const merged = [...new Set([...(current.bookmarks || []), ...(patch.bookmarks || [])].map(Number))];
      QCCAuth.state = {
        ...current,
        bookmarks: merged,
        submissions: patch.submissions || current.submissions
      };
      persistLocalAccount({});
      localStorage.setItem('clt-bookmarks', JSON.stringify(merged));
      return;
    }
    const data = await api('/api/me/state', {
      method: 'PUT',
      body: JSON.stringify(patch)
    });
    QCCAuth.applySession(data);
  };

  QCCAuth.login = async function (email, password) {
    sessionStorage.setItem('clt-guest-bookmarks', JSON.stringify(guestBookmarks()));
    if (QCCAuth.mode !== 'local') {
      try {
        const data = await api('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        QCCAuth.applySession(data);
        await QCCAuth.mergeGuestOnLogin();
        return QCCAuth;
      } catch (err) {
        if (!isServerDown(err)) throw err;
        QCCAuth.mode = 'local';
      }
    }
    await localLogin(email, password);
    await QCCAuth.mergeGuestOnLogin();
    return QCCAuth;
  };

  QCCAuth.register = async function (name, email, password) {
    sessionStorage.setItem('clt-guest-bookmarks', JSON.stringify(guestBookmarks()));
    if (QCCAuth.mode !== 'local') {
      try {
        const data = await api('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password })
        });
        QCCAuth.applySession(data);
        await QCCAuth.mergeGuestOnLogin();
        return QCCAuth;
      } catch (err) {
        if (!isServerDown(err)) throw err;
        QCCAuth.mode = 'local';
      }
    }
    await localRegister(name, email, password);
    await QCCAuth.mergeGuestOnLogin();
    return QCCAuth;
  };

  QCCAuth.loginWithGoogle = async function (credential) {
    sessionStorage.setItem('clt-guest-bookmarks', JSON.stringify(guestBookmarks()));
    if (QCCAuth.mode !== 'local') {
      try {
        const data = await api('/api/auth/google/id-token', {
          method: 'POST',
          body: JSON.stringify({ credential })
        });
        QCCAuth.applySession(data);
        await QCCAuth.mergeGuestOnLogin();
        return QCCAuth;
      } catch (err) {
        if (!isServerDown(err)) throw err;
        QCCAuth.mode = 'local';
      }
    }
    localGoogle(credential);
    await QCCAuth.mergeGuestOnLogin();
    return QCCAuth;
  };

  QCCAuth.forgotPassword = async function (email) {
    if (QCCAuth.mode !== 'local') {
      try {
        return await api('/api/auth/forgot', {
          method: 'POST',
          body: JSON.stringify({ email })
        });
      } catch (err) {
        if (!isServerDown(err)) throw err;
        QCCAuth.mode = 'local';
      }
    }
    return {
      ok: true,
      message: 'This site is saving accounts in this browser. Sign in with Google, or create the account again if you need a new password.'
    };
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
    if (QCCAuth.mode !== 'local') {
      try {
        await api('/api/auth/logout', { method: 'POST', body: '{}' });
      } catch {
        /* still clear client session */
      }
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
    if (QCCAuth.mode === 'local') {
      persistLocalAccount({});
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
