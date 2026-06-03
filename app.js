// Bar Soutsu ジン教本 — アプリ本体
(function () {
  "use strict";

  var CHAPTERS = window.GIN_CONTENT || [];
  var GLOSSARY = window.GIN_GLOSSARY || [];

  // カテゴリの日本語ラベル
  var CAT_LABEL = {
    basics: "基礎", history: "歴史", production: "製法", botanical: "ボタニカル",
    classification: "分類", brands: "銘柄", japan: "日本", cocktail: "カクテル",
    tasting: "テイスティング", pairing: "ペアリング", culture: "文化",
    guide: "ガイド", market: "市場",
  };

  // ---- localStorage ヘルパー ----
  var STORE_READ = "ginbook_read";

  function load(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "{}");
    } catch (e) {
      return {};
    }
  }
  function save(key, obj) {
    try {
      localStorage.setItem(key, JSON.stringify(obj));
    } catch (e) {
      /* プライベートモード等では無視 */
    }
  }

  var readState = load(STORE_READ);

  // ---- 要素参照 ----
  var $ = function (id) { return document.getElementById(id); };
  var grid = $("chapter-grid");
  var search = $("search");
  var searchStatus = $("search-status");
  var listPane = $("chapter-list-pane");
  var reader = $("reader");

  // ================= ビュー切替 =================
  var tabs = document.querySelectorAll(".tab");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var view = tab.dataset.view;
      tabs.forEach(function (t) { t.classList.toggle("is-active", t === tab); });
      document.querySelectorAll(".view").forEach(function (v) {
        var on = v.id === "view-" + view;
        v.classList.toggle("is-active", on);
        v.hidden = !on;
      });
      window.scrollTo(0, 0);
    });
  });

  // ================= 教本：章一覧 =================
  function renderChapterList(filter) {
    grid.innerHTML = "";
    var q = (filter || "").trim().toLowerCase();
    var shown = 0;

    CHAPTERS.forEach(function (ch) {
      var hitCount = 0;
      if (q) {
        var hay = (ch.title + " " + ch.sections.join(" ") + " " + ch.text).toLowerCase();
        if (hay.indexOf(q) === -1) return;
        // ヒット数を数える（簡易）
        var idx = 0;
        while ((idx = hay.indexOf(q, idx)) !== -1) { hitCount++; idx += q.length; }
      }
      shown++;

      var card = document.createElement("button");
      card.type = "button";
      card.className = "chapter-card" + (readState[ch.num] ? " is-read" : "");
      card.addEventListener("click", function () { openChapter(ch.num); });

      var isRead = readState[ch.num];
      card.innerHTML =
        '<div class="cc-top">' +
          '<span class="cc-num">第' + ch.num + "章" + (isRead ? ' · <span class="cc-read-flag">読了</span>' : "") + "</span>" +
          '<span class="cc-cat">' + (CAT_LABEL[ch.category] || ch.category) + "</span>" +
        "</div>" +
        '<div class="cc-title">' + escapeHtml(ch.title) + "</div>" +
        '<div class="cc-meta">' + ch.sections.length + " 節" +
          (q && hitCount ? ' · <span class="search-hits">該当 ' + hitCount + "</span>" : "") +
        "</div>";
      grid.appendChild(card);
    });

    if (q) {
      searchStatus.textContent = shown
        ? shown + " 章が該当（章を開くとブラウザ内検索でさらに絞り込めます）"
        : "該当する章がありません。別のキーワードを試してください。";
    } else {
      searchStatus.textContent = "全 " + CHAPTERS.length + " 章。読んだ章は左に緑のラインが付きます。";
    }
  }

  // ================= 教本：リーダー =================
  var currentNum = null;

  function openChapter(num) {
    var ch = CHAPTERS.find(function (c) { return c.num === num; });
    if (!ch) return;
    currentNum = num;

    listPane.hidden = true;
    reader.hidden = false;

    // 目次
    var toc = $("reader-toc");
    if (ch.sections.length) {
      toc.innerHTML =
        "<h2>この章の内容</h2><ul>" +
        ch.sections.map(function (s) {
          var anchor = "sec-" + s.replace(/[^\w぀-ヿ一-鿿]+/g, "-").replace(/^-+|-+$/g, "");
          return '<li><a href="#' + anchor + '">' + escapeHtml(s) + "</a></li>";
        }).join("") +
        "</ul>";
    } else {
      toc.innerHTML = "";
    }

    // 本文（章タイトルを先頭に付与）
    $("reader-body").innerHTML =
      "<h2>第" + ch.num + "章　" + escapeHtml(ch.title) + "</h2>" + ch.html;

    // 目次内アンカーをスムーズスクロールに
    toc.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var el = document.getElementById(a.getAttribute("href").slice(1));
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    updateReadToggle();
    renderReaderNav(num);
    window.scrollTo(0, 0);
  }

  function renderReaderNav(num) {
    var nav = $("reader-nav");
    var prev = CHAPTERS.find(function (c) { return c.num === num - 1; });
    var next = CHAPTERS.find(function (c) { return c.num === num + 1; });
    nav.innerHTML = "";

    var pb = document.createElement("button");
    pb.type = "button";
    pb.textContent = prev ? "← 第" + prev.num + "章 " + prev.title : "前の章はありません";
    pb.disabled = !prev;
    if (prev) pb.addEventListener("click", function () { openChapter(prev.num); });
    nav.appendChild(pb);

    var nb = document.createElement("button");
    nb.type = "button";
    nb.textContent = next ? "第" + next.num + "章 " + next.title + " →" : "最終章です";
    nb.disabled = !next;
    if (next) nb.addEventListener("click", function () { openChapter(next.num); });
    nav.appendChild(nb);
  }

  function updateReadToggle() {
    var btn = $("reader-read");
    var isRead = !!readState[currentNum];
    btn.classList.toggle("is-read", isRead);
    btn.textContent = isRead ? "✓ 読了済み" : "読了にする";
  }

  $("reader-read").addEventListener("click", function () {
    if (readState[currentNum]) {
      delete readState[currentNum];
    } else {
      readState[currentNum] = true;
    }
    save(STORE_READ, readState);
    updateReadToggle();
  });

  $("reader-back").addEventListener("click", function () {
    reader.hidden = true;
    listPane.hidden = false;
    renderChapterList(search.value);
    window.scrollTo(0, 0);
  });

  // 検索
  var searchTimer = null;
  search.addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { renderChapterList(search.value); }, 120);
  });

  // ================= 用語集 =================
  var glossaryCat = "all";

  function renderGlossaryCats() {
    var cats = ["all"];
    GLOSSARY.forEach(function (g) {
      if (cats.indexOf(g.category) === -1) cats.push(g.category);
    });
    var wrap = $("glossary-cats");
    wrap.innerHTML = cats.map(function (c) {
      var label = c === "all" ? "すべて" : c;
      return '<button type="button" class="gloss-chip' + (c === glossaryCat ? " is-active" : "") +
        '" data-cat="' + escapeHtml(c) + '">' + escapeHtml(label) + "</button>";
    }).join("");
    wrap.querySelectorAll(".gloss-chip").forEach(function (b) {
      b.addEventListener("click", function () {
        glossaryCat = b.dataset.cat;
        renderGlossaryCats();
        renderGlossary($("glossary-search").value);
      });
    });
  }

  function renderGlossary(filter) {
    var wrap = $("glossary-body");
    var q = (filter || "").trim().toLowerCase();
    var items = GLOSSARY.filter(function (g) {
      if (glossaryCat !== "all" && g.category !== glossaryCat) return false;
      if (!q) return true;
      return (g.term + " " + (g.reading || "") + " " + g.def).toLowerCase().indexOf(q) !== -1;
    });
    // 五十音（reading）順に並べる
    items.sort(function (a, b) { return (a.reading || a.term).localeCompare(b.reading || b.term, "ja"); });

    if (!items.length) {
      wrap.innerHTML = '<p class="gloss-empty">該当する用語がありません。</p>';
      return;
    }
    wrap.innerHTML = items.map(function (g) {
      return '<div class="gloss-item">' +
        '<div class="gloss-term"><span class="gt-name">' + escapeHtml(g.term) + "</span>" +
        '<span class="gt-cat">' + escapeHtml(g.category) + "</span></div>" +
        '<p class="gloss-def">' + escapeHtml(g.def) + "</p>" +
      "</div>";
    }).join("");
  }

  var glossTimer = null;
  $("glossary-search").addEventListener("input", function () {
    clearTimeout(glossTimer);
    var v = $("glossary-search").value;
    glossTimer = setTimeout(function () { renderGlossary(v); }, 120);
  });

  // ---- util ----
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // ================= 初期化 =================
  renderChapterList("");
  renderGlossaryCats();
  renderGlossary("");

  // PWA: service worker 登録
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("service-worker.js").catch(function () {});
    });
  }
})();
