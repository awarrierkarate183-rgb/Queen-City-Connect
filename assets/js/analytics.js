window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
(function () {
  if (document.querySelector('script[data-qcc-va]')) return;
  var script = document.createElement('script');
  script.defer = true;
  script.src = '/_vercel/insights/script.js';
  script.dataset.qccVa = 'true';
  document.head.appendChild(script);
})();
