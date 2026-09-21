window.QCCContact = {
  TEAM_EMAIL: 'queencityconnect674@gmail.com',

  usablePhone: function (phone) {
    const raw = String(phone || '').trim();
    if (!raw || /^see (listing|website)$/i.test(raw) || /^n\/?a$/i.test(raw)) return '';
    const digits = raw.replace(/[^\d]/g, '');
    return digits.length >= 3 ? raw : '';
  },

  telHref: function (phone) {
    const raw = this.usablePhone(phone);
    if (!raw) return '';
    let digits = raw.replace(/[^\d]/g, '');
    if (digits === '988' || digits === '211') return 'tel:' + digits;
    if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
    if (digits.length === 10) return 'tel:+1' + digits;
    if (digits.length >= 7) return 'tel:+1' + digits;
    return '';
  },

  usableWebsite: function (url) {
    let website = String(url || '').trim();
    if (!website || website === '#') return '';
    if (/^(mailto|tel|sms):/i.test(website)) return website;
    if (/^https?:\/\//i.test(website)) return website;
    if (website.startsWith('//')) return 'https:' + website;
    return 'https://' + website.replace(/^\/+/, '');
  },

  mapsHref: function (address) {
    const value = String(address || '').trim();
    if (!value) return '';
    if (/available anywhere|countywide|statewide|charlotte metro|partner sites|planting sites|program site posted|event sites|services listed online/i.test(value)) {
      return '';
    }
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(value);
  },

  escapeHtml: function (value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  linkify: function (text) {
    const escaped = this.escapeHtml(text).replace(/\s+/g, ' ').trim();
    return escaped.replace(/https?:\/\/[^\s<]+/gi, function (raw) {
      const trail = raw.match(/[).,;:!?]+$/);
      const url = trail ? raw.slice(0, -trail[0].length) : raw;
      const after = trail ? trail[0] : '';
      return '<a class="text-link" href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + '</a>' + after;
    });
  }
};

window.toggleNavMenu = function (force) {
  const menu = document.getElementById('nav-links');
  const btn = document.querySelector('.nav-hamburger');
  if (!menu) return;
  const open = typeof force === 'boolean' ? force : !menu.classList.contains('open');
  menu.classList.toggle('open', open);
  document.body.classList.toggle('nav-open', open);
  const backdrop = document.getElementById('nav-backdrop');
  if (backdrop) backdrop.hidden = !open;
  if (btn) {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
};

(function initPhoneChrome() {
  const phoneQuery = window.matchMedia('(max-width: 720px)');

  function isPhoneNav() {
    return phoneQuery.matches;
  }

  function ensureBackdrop() {
    let el = document.getElementById('nav-backdrop');
    if (el) return el;
    el = document.createElement('button');
    el.id = 'nav-backdrop';
    el.className = 'nav-backdrop';
    el.type = 'button';
    el.hidden = true;
    el.setAttribute('aria-label', 'Close menu');
    el.addEventListener('click', function (e) {
      e.preventDefault();
      window.toggleNavMenu(false);
    });
    document.body.appendChild(el);
    return el;
  }

  function placeMenu() {
    const menu = document.getElementById('nav-links');
    const inner = document.querySelector('.nav-inner');
    const right = inner && inner.querySelector('.nav-right');
    if (!menu || !inner) return;
    if (isPhoneNav()) {
      if (menu.parentElement !== document.body) document.body.appendChild(menu);
    } else if (right && menu.parentElement !== inner) {
      inner.insertBefore(menu, right);
    }
  }

  function bindHamburger() {
    document.querySelectorAll('.nav-hamburger').forEach(function (btn) {
      if (btn.dataset.qccBound === '1') return;
      btn.dataset.qccBound = '1';
      btn.removeAttribute('onclick');
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        window.toggleNavMenu();
      });
    });
  }

  function bindMenuLinks() {
    const menu = document.getElementById('nav-links');
    if (!menu || menu.dataset.qccBound === '1') return;
    menu.dataset.qccBound = '1';
    menu.addEventListener('click', function (e) {
      const node = e.target && e.target.nodeType === 1 ? e.target : e.target && e.target.parentElement;
      if (!node || typeof node.closest !== 'function') return;
      const item = node.closest('a, button');
      if (!item || !menu.contains(item)) return;
      const href = item.getAttribute('href') || '';
      if (item.tagName === 'A' && href && href !== '#') return;
      window.toggleNavMenu(false);
    });
  }

  function boot() {
    ensureBackdrop();
    placeMenu();
    bindHamburger();
    bindMenuLinks();
    window.toggleNavMenu(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') window.toggleNavMenu(false);
  });

  if (phoneQuery.addEventListener) {
    phoneQuery.addEventListener('change', function () {
      placeMenu();
      if (!isPhoneNav()) window.toggleNavMenu(false);
    });
  } else if (phoneQuery.addListener) {
    phoneQuery.addListener(function () {
      placeMenu();
      if (!isPhoneNav()) window.toggleNavMenu(false);
    });
  }
})();
