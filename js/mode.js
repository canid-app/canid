(() => {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const wantsEditor =
    standalone ||
    /^\/editor\/?$/.test(location.pathname) ||
    new URLSearchParams(location.search).has('edit') ||
    location.hash.startsWith('#b=');
  document.documentElement.dataset.mode = wantsEditor ? 'app' : 'landing';

  // Privacy-first, cookieless analytics
  if (!wantsEditor) {
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://scripts.simpleanalyticscdn.com/latest.js';
    document.head.appendChild(s);
  }
})();
