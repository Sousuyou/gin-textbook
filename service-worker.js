// Bar Soutsu ジン教本 — オフライン用 Service Worker
// 更新方針: stale-while-revalidate
//   表示は高速なキャッシュから返しつつ、裏で最新を取得してキャッシュを更新する。
//   コンテンツを更新したら CACHE の版数（vN）を上げること。
var CACHE = "ginbook-v4";
var ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./content.js",
  "./glossary.js",
  "./manifest.json",
  "./assets/icon.svg",
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })
      );
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
        // キャッシュがあれば即返し、裏で更新。無ければネットワークを待つ。
        return hit || network;
      });
    })
  );
});
