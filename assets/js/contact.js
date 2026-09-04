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
    const website = String(url || '').trim();
    if (!website || website === '#') return '';
    return website;
  },

  mapsHref: function (address) {
    const value = String(address || '').trim();
    if (!value) return '';
    if (/available anywhere|countywide|statewide|charlotte metro|partner sites|planting sites|program site posted|event sites|services listed online/i.test(value)) {
      return '';
    }
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(value);
  }
};


