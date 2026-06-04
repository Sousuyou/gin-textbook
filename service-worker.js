// Bar Soutsu ジン教本 — Service Worker
// 更新方針: ページ本体(HTML)とJSONは「ネットワーク優先」で常に最新を取得し、
//   オフライン時のみキャッシュを使う。画像・CSS・JSは「キャッシュ優先」で高速表示。
//   コンテンツを更新したら CACHE の版数（vN）を上げること。
var CACHE = "ginbook-v16";
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
    caches
      .open(CACHE)
      .then(function (c) {
        return c.addAll(ASSETS);
      })
      .then(function () {
        return self.skipWaiting();
      }),
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (k) {
              return k !== CACHE;
            })
            .map(function (k) {
              return caches.delete(k);
            }),
        );
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  var accept = req.headers.get("accept") || "";
  var fresh =
    req.mode === "navigate" ||
    accept.indexOf("text/html") !== -1 ||
    url.pathname.indexOf(".json") === url.pathname.length - 5;

  if (fresh) {
    // ネットワーク優先（最新を表示。失敗時はキャッシュ）
    e.respondWith(
      fetch(req)
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) {
            c.put(req, copy);
          });
          return res;
        })
        .catch(function () {
          return caches.match(req).then(function (r) {
            return r || caches.match("./index.html");
          });
        }),
    );
  } else {
    // キャッシュ優先（高速。無ければ取得してキャッシュ）
    e.respondWith(
      caches.match(req).then(function (hit) {
        return (
          hit ||
          fetch(req).then(function (res) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) {
              c.put(req, copy);
            });
            return res;
          })
        );
      }),
    );
  }
});
