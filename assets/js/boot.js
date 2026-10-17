(function registerWakeWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(function (reg) {
    if (reg.update) reg.update().catch(function () {});
  }).catch(function () {});
})();
