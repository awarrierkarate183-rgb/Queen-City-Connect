(function registerWakeWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(function () {});
})();
