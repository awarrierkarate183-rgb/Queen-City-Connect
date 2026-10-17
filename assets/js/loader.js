(function qccLoader() {
  function pathName() {
    try { return window.location.pathname || ''; } catch (e) { return ''; }
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', noteInAppBrowser);
  } else {
    noteInAppBrowser();
  }
})();
