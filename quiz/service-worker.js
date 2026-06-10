// Bar Soutsu クイズ道場 — Service Worker（stale-while-revalidate）
var CACHE = "ginquiz-v23";
var ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.json",
  "../styles.css",
  "../quiz.js",
  "../assets/icon.svg",
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(e.request).then(function (hit) {
        var network = fetch(e.request).then(function (res) {
          if (res && res.status === 200) cache.put(e.request, res.clone());
          return res;
        }).catch(function () { return hit; });
        return hit || network;
      });
    })
  );
});
