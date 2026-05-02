var CACHE = 'sapurai-v1';
var SHELL = [
  '/',
  '/index.html'
];

// Install: cache shell
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL);
    }).then(function () { self.skipWaiting(); })
  );
});

// Activate: clean old caches
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE; })
          .map(function (n) { return caches.delete(n); })
      );
    }).then(function () { self.clients.claim(); })
  );
});

// Fetch: network-first for pages, cache-first for assets
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = e.request.url;

  // Skip Firebase/Google APIs — Firestore handles its own offline cache
  if (url.indexOf('firestore.googleapis.com') >= 0 ||
      url.indexOf('firebase') >= 0 ||
      url.indexOf('googleapis.com') >= 0 ||
      url.indexOf('gstatic.com') >= 0) return;

  // Static assets (JS, CSS, fonts, images) — cache-first (immutable hashed filenames)
  if (url.indexOf('/assets/') >= 0 || /\.(js|css|woff2?|ttf|png|svg|ico|webp)(\?|$)/.test(url)) {
    e.respondWith(
      caches.match(e.request).then(function (cached) {
        if (cached) return cached;
        return fetch(e.request).then(function (res) {
          if (res.status === 200) {
            var clone = res.clone();
            caches.open(CACHE).then(function (cache) { cache.put(e.request, clone); });
          }
          return res;
        }).catch(function () {
          return caches.match(e.request);
        });
      })
    );
    return;
  }

  // HTML pages — network-first, fallback to cache
  e.respondWith(
    fetch(e.request).then(function (res) {
      if (res.status === 200) {
        var clone = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(e.request, clone); });
      }
      return res;
    }).catch(function () {
      return caches.match(e.request).then(function (cached) {
        return cached || caches.match('/index.html');
      });
    })
  );
});
