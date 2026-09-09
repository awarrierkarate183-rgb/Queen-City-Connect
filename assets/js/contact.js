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
  if (btn) {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
};

(function initPhoneChrome() {
  function sameSite(href) {
    try {
      const url = new URL(href, window.location.href);
      return url.origin === window.location.origin;
    } catch {
      return true;
    }
  }

  function standalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  document.addEventListener('click', function (e) {
    const hamburger = e.target.closest('.nav-hamburger');
    if (hamburger) {
      requestAnimationFrame(function () {
        const menu = document.getElementById('nav-links');
        const open = !!(menu && menu.classList.contains('open'));
        document.body.classList.toggle('nav-open', open);
        hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
        hamburger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      });
      return;
    }

    const navLink = e.target.closest('.nav-links a');
    if (navLink) {
      const href = navLink.getAttribute('href') || '';
      if (href && !href.startsWith('#') && navLink.target !== '_blank') {
        window.location.href = navLink.href;
        return;
      }
      setTimeout(function () { window.toggleNavMenu(false); }, 0);
    }

    if (document.body.classList.contains('nav-open') || document.querySelector('.nav-links.open')) {
      if (!e.target.closest('.navbar')) window.toggleNavMenu(false);
    }

    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    if (/^(tel|mailto|sms):/i.test(href)) return;
    if (href.startsWith('#') || href.startsWith('javascript:')) return;
    if (sameSite(link.href) && link.target !== '_blank') return;

    if (standalone() && (link.target === '_blank' || !sameSite(link.href))) {
      e.preventDefault();
      window.location.href = link.href;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') window.toggleNavMenu(false);
  });
})();
