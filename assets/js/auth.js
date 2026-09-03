(function () {
  const QCCAuth = {
    user: null,
    state: null,
    googleEnabled: false,
    ready: Promise.resolve()
  };

  let saveTimer = null;
  let pendingPatch = {};
  let flushPromise = null;

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
    if (page === 'signin.html') {
      const params = new URLSearchParams(window.location.search);
      return params.get('next') || 'hub.html';
    }
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

  function renderNav() {
    const host = document.getElementById('nav-account');
    if (!host) return;
    if (QCCAuth.user) {
      host.innerHTML =
        '<span class="nav-account-name" title="' + escapeHtml(QCCAuth.user.email) + '">' +
        escapeHtml(firstName(QCCAuth.user.name)) +
        '</span>' +
        '<a href="signin.html" class="nav-account-link">Saved</a>' +
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
    const response = await fetch(url, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(options && options.headers) },
      ...options
    });
    const data = await response.json().catch(() => ({}));
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
    QCCAuth.googleEnabled = Boolean(data.googleEnabled);
    if (QCCAuth.user && QCCAuth.state && Array.isArray(QCCAuth.state.bookmarks)) {
      localStorage.setItem('clt-bookmarks', JSON.stringify(QCCAuth.state.bookmarks));
    }
    renderNav();
    return data;
  };

  QCCAuth.refresh = async function () {
    try {
      const data = await api('/api/me');
      return QCCAuth.applySession(data);
    } catch {
      try {
        const config = await fetch('/api/auth/config', { credentials: 'include' }).then((r) => r.json());
        QCCAuth.googleEnabled = Boolean(config.googleEnabled);
      } catch {
        QCCAuth.googleEnabled = false;
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
    return data;
  };

  QCCAuth.register = async function (name, email, password) {
    sessionStorage.setItem('clt-guest-bookmarks', JSON.stringify(guestBookmarks()));
    const data = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    QCCAuth.applySession(data);
    await QCCAuth.mergeGuestOnLogin();
    return data;
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

  function flushOnLeave() {
    if (!QCCAuth.user || !Object.keys(pendingPatch).length) return;
    const toSend = pendingPatch;
    pendingPatch = {};
    const body = JSON.stringify(toSend);
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/me/state', new Blob([body], { type: 'application/json' }));
    } else {
      fetch('/api/me/state', {
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
