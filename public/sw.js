// Sapurai Service Worker — Phase 1.2 PWA optim (cache-first assets, network-first HTML)
// Bump CACHE_VERSION pour forcer cleanup chez les users existants.
// v3 (mai 2026) : favicon/icons root passes en network-first pour eviter de cacher
// indefiniment l'ancien camion apres un changement de logo.
var CACHE_VERSION = 'sapurai-v3';
var CACHE_STATIC = CACHE_VERSION + '-static';   // assets immuables (JS/CSS hashes)
var CACHE_FONTS = CACHE_VERSION + '-fonts';     // Google Fonts (Inter, JetBrains Mono)
var CACHE_RUNTIME = CACHE_VERSION + '-runtime'; // pages, navigations

var SHELL = ['/', '/index.html', '/manifest.json'];

// Install : pre-cache du shell minimum
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_RUNTIME).then(function (cache) {
      return cache.addAll(SHELL);
    }).then(function () { self.skipWaiting(); })
  );
});

// Activate : purge des anciens caches (toutes versions != actuelles)
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (names) {
      var keep = [CACHE_STATIC, CACHE_FONTS, CACHE_RUNTIME];
      return Promise.all(
        names.filter(function (n) { return keep.indexOf(n) < 0; })
          .map(function (n) { return caches.delete(n); })
      );
    }).then(function () { self.clients.claim(); })
  );
});

// Helpers de strategy
function isFirebaseOrApi(url) {
  return url.indexOf('firestore.googleapis.com') >= 0
    || url.indexOf('firebaseapp.com') >= 0
    || url.indexOf('firebaseio.com') >= 0
    || url.indexOf('identitytoolkit.googleapis.com') >= 0
    || url.indexOf('securetoken.googleapis.com') >= 0
    || url.indexOf('dpworld-proxy.ozmanm10.workers.dev') >= 0
    || url.indexOf('generativelanguage.googleapis.com') >= 0;
}

function isStaticAsset(url) {
  // Vite genere des assets avec hash dans /assets/ : immuables, cache-first OK.
  // Les fichiers root (favicon.svg, icon-*.png, og-tracking.png, manifest.json)
  // ne sont PAS hashes et peuvent changer entre 2 deploys → on les exclut du
  // cache-first pour qu'ils passent en network-first (toujours fresh).
  return /\/assets\/[A-Za-z0-9_\-]+\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico)(\?.*)?$/.test(url);
}

function isFonts(url) {
  return url.indexOf('fonts.googleapis.com') >= 0 || url.indexOf('fonts.gstatic.com') >= 0;
}

// Cache-first : retourne le cache si dispo, sinon fetch + met en cache
function cacheFirst(req, cacheName) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type !== 'opaque') {
          cache.put(req, res.clone());
        }
        return res;
      });
    });
  });
}

// Stale-while-revalidate : retourne cache immediatement, met a jour en background
function staleWhileRevalidate(req, cacheName) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(req).then(function (cached) {
      var fetchPromise = fetch(req).then(function (res) {
        if (res && res.status === 200) cache.put(req, res.clone());
        return res;
      }).catch(function () { return cached; });
      return cached || fetchPromise;
    });
  });
}

// Network-first : tente network, fallback cache. Pour HTML / pages.
function networkFirst(req, cacheName) {
  return fetch(req).then(function (res) {
    if (res && res.status === 200) {
      var clone = res.clone();
      caches.open(cacheName).then(function (cache) { cache.put(req, clone); });
    }
    return res;
  }).catch(function () {
    return caches.match(req).then(function (cached) {
      return cached || caches.match('/index.html');
    });
  });
}

// Fetch : routing par type de ressource
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = e.request.url;

  // Skip Firebase / API live (toujours network direct)
  if (isFirebaseOrApi(url)) return;

  // Google Fonts : stale-while-revalidate (TTL ~1 an cote Google, on garde local)
  if (isFonts(url)) {
    e.respondWith(staleWhileRevalidate(e.request, CACHE_FONTS));
    return;
  }

  // Assets statiques (JS/CSS avec hash) : cache-first (immuables grace au hash)
  if (isStaticAsset(url)) {
    e.respondWith(cacheFirst(e.request, CACHE_STATIC));
    return;
  }

  // HTML / navigation : network-first (avoir la derniere version) + fallback cache
  if (e.request.mode === 'navigate' || (e.request.headers.get('accept') || '').indexOf('text/html') >= 0) {
    e.respondWith(networkFirst(e.request, CACHE_RUNTIME));
    return;
  }

  // Defaut : network-first
  e.respondWith(networkFirst(e.request, CACHE_RUNTIME));
});

// Permet de declencher skipWaiting depuis l'app (pour activer une nouvelle version)
self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
