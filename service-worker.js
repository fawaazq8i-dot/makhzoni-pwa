// Bump this on any deploy that changes a precached file below.
const CACHE_VERSION = "v8";
const PRECACHE = `makhzoni-precache-${CACHE_VERSION}`;
const RUNTIME = `makhzoni-runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  ".",
  "index.html",
  "manifest.json",
  "offline.html",
  "css/variables.css",
  "css/base.css",
  "css/components.css",
  "css/addProduct.css",
  "css/stock.css",
  "css/dashboard.css",
  "js/app.js",
  "js/router.js",
  "js/storage.js",
  "js/toast.js",
  "js/db.js",
  "js/photo.js",
  "js/features/addProduct.js",
  "js/features/stock.js",
  "js/features/dashboard.js",
  "js/features/daySwitcher.js",
  "fonts/cairo-400.woff2",
  "fonts/cairo-700.woff2",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-512-maskable.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) =>
      // Two layers of caching to defeat here: {cache:"reload"} bypasses the
      // *browser's* HTTP cache, but GitHub Pages' CDN (Fastly) still
      // edge-caches each URL for several minutes regardless. Appending a
      // CACHE_VERSION-tied query string guarantees a URL Fastly has never
      // cached, forcing a real origin fetch; the response is still stored
      // under the plain (query-free) URL so normal runtime requests match
      // it. Added individually so one missing file doesn't fail the install.
      Promise.all(
        PRECACHE_URLS.map((url) => {
          const bustUrl = url + (url.includes("?") ? "&" : "?") + "swv=" + CACHE_VERSION;
          return fetch(bustUrl, { cache: "reload" })
            .then((res) => (res.ok ? cache.put(url, res) : null))
            .catch(() => {});
        })
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== PRECACHE && k !== RUNTIME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Navigations ignore the query string when matching so a URL opened with
  // any extra params still resolves to the cached app shell.
  const cacheLookup = req.mode === "navigate" ? caches.match(req, { ignoreSearch: true }) : caches.match(req);
  event.respondWith(
    cacheLookup.then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res.ok && url.origin === self.location.origin) {
            const clone = res.clone();
            caches.open(RUNTIME).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => {
          if (req.mode === "navigate") return caches.match("offline.html");
          return caches.match("index.html");
        });
    })
  );
});
