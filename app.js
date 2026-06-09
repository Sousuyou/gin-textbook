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
    gintonic: "G&T設計", homemade: "自家製", service: "サービス",
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
      tabs.forEach(function (t) {
        var on = t === tab;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });
      document.querySelectorAll(".view").forEach(function (v) {
        var on = v.id === "view-" + view;
        v.classList.toggle("is-active", on);
        v.hidden = !on;
      });
      // タブ切替時は前タブの検索文字が残らないようにリセットする
      if (view === "textbook") {
        var gs = $("glossary-search");
        if (gs && gs.value) { gs.value = ""; renderGlossary(""); }
        renderChapterList(search.value);
      } else if (view === "glossary") {
        if (search.value) { search.value = ""; renderChapterList(""); }
        renderGlossary($("glossary-search").value);
      }
      hideTip();
      window.scrollTo(0, 0);
    });
  });

  // ================= 学習進捗バー =================
  function updateProgress() {
    var total = CHAPTERS.length;
    var done = 0;
    CHAPTERS.forEach(function (ch) { if (readState[ch.num]) done++; });
    var pct = total ? Math.round((done / total) * 100) : 0;
    var label = $("progress-label");
    var fill = $("progress-fill");
    var track = $("progress-track");
    if (label) label.textContent = "全 " + total + " 章中 " + done + " 章 読了（" + pct + "%）";
    if (fill) fill.style.width = pct + "%";
    if (track) track.setAttribute("aria-valuenow", String(pct));
  }

  // ================= 教本：章一覧 =================
  var listFilter = "all"; // all / read

  function passFilter(ch) {
    switch (listFilter) {
      case "read": return !!readState[ch.num];
      default: return true;
    }
  }

  // 編（基礎/応用/研究）グループ。章番号の上限で区切る。
  var BANDS = [
    { name: "基礎編", note: "ジンを知る土台", max: 8 },
    { name: "応用編", note: "現場での応用", max: 14 },
    { name: "研究編", note: "テーマ別の深掘り大全", max: 29 },
    { name: "用語・リファレンス", note: "年表・用語集・図解で引く", max: 37 },
    // 銘柄図鑑（第38〜67章）はタイプ別の5グループに分ける。各グループ内は知名度順。
    { name: "銘柄図鑑｜4大ジン", note: "世界の定番", max: 41 },
    { name: "銘柄図鑑｜ロンドン・ドライの名門", note: "古典・正統派", max: 46 },
    { name: "銘柄図鑑｜クラフト／プレミアム", note: "ボタニカル個性派", max: 52 },
    { name: "銘柄図鑑｜フレーバー／コンテンポラリー", note: "フルーツ・フローラル系", max: 59 },
    { name: "銘柄図鑑｜国産クラフト", note: "日本のジン", max: Infinity },
  ];
  function bandOf(num) {
    for (var i = 0; i < BANDS.length; i++) {
      if (num <= BANDS[i].max) return BANDS[i];
    }
    return BANDS[BANDS.length - 1];
  }

  function renderChapterList(filter) {
    grid.innerHTML = "";
    var q = (filter || "").trim().toLowerCase();
    var shown = 0;
    var lastBand = null;

    CHAPTERS.forEach(function (ch) {
      if (!passFilter(ch)) return;

      var hitCount = 0;
      if (q) {
        var hay = (ch.title + " " + ch.sections.join(" ") + " " + ch.text).toLowerCase();
        if (hay.indexOf(q) === -1) return;
        // ヒット数を数える（簡易）
        var idx = 0;
        while ((idx = hay.indexOf(q, idx)) !== -1) { hitCount++; idx += q.length; }
      }
      shown++;

      // 編（基礎/応用/研究）が切り替わったら見出しを差し込む
      var band = bandOf(ch.num);
      if (band !== lastBand) {
        lastBand = band;
        var header = document.createElement("div");
        header.className = "band-header";
        header.innerHTML =
          '<span class="band-name">' + band.name + "</span>" +
          '<span class="band-note">' + band.note + "</span>";
        grid.appendChild(header);
      }

      var card = document.createElement("button");
      card.type = "button";
      card.className = "chapter-card" + (readState[ch.num] ? " is-read" : "");
      card.addEventListener("click", function () { openChapter(ch.num); });

      var isRead = readState[ch.num];

      // 検索語ハイライト付きタイトル
      var titleHtml = q ? highlight(ch.title, q) : escapeHtml(ch.title);

      card.innerHTML =
        '<div class="cc-top">' +
          '<span class="cc-num">第' + ch.num + "章" + (isRead ? ' · <span class="cc-read-flag">読了</span>' : "") + "</span>" +
          '<span class="cc-cat">' + (CAT_LABEL[ch.category] || ch.category) + "</span>" +
        "</div>" +
        '<div class="cc-title">' + titleHtml + "</div>" +
        '<div class="cc-meta">' + ch.sections.length + " 節" +
          (q && hitCount ? ' · <span class="search-hits">該当 ' + hitCount + "</span>" : "") +
        "</div>";
      grid.appendChild(card);
    });

    var filterNote = listFilter === "all" ? "" :
      "（絞り込み: " + filterLabel(listFilter) + "）";

    if (q) {
      searchStatus.textContent = shown
        ? shown + " 章が該当" + filterNote + "（章を開くとブラウザ内検索でさらに絞り込めます）"
        : "該当する章がありません。別のキーワードや絞り込みを試してください。";
    } else if (listFilter !== "all") {
      searchStatus.textContent = shown
        ? shown + " 章を表示中" + filterNote + "。"
        : "この条件に当てはまる章はまだありません。";
    } else {
      searchStatus.textContent = "全 " + CHAPTERS.length + " 章。読んだ章は左に緑のラインが付きます。";
    }
  }

  function filterLabel(f) {
    return { read: "読了" }[f] || f;
  }

  // 絞り込みチップ
  document.querySelectorAll("#chapter-filters .filter-chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      listFilter = chip.dataset.filter;
      document.querySelectorAll("#chapter-filters .filter-chip").forEach(function (c) {
        c.classList.toggle("is-active", c === chip);
      });
      renderChapterList(search.value);
    });
  });

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
    var body = $("reader-body");
    body.innerHTML =
      "<h2>第" + ch.num + "章　" + escapeHtml(ch.title) + "</h2>" + ch.html;

    // 本文中の用語をインライン辞書化
    decorateGlossaryTerms(body);

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
    updateProgress();
  });

  $("reader-back").addEventListener("click", function () {
    reader.hidden = true;
    listPane.hidden = false;
    hideTip();
    renderChapterList(search.value);
    window.scrollTo(0, 0);
  });

  // 検索
  var searchTimer = null;
  search.addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { renderChapterList(search.value); }, 120);
  });

  // ================= 本文インライン辞書 =================
  // 用語を長い順に並べておく（長い語を先にマッチさせて部分被りを防ぐ）
  var TERM_INDEX = GLOSSARY
    .filter(function (g) { return g.term && g.term.length >= 2; })
    .slice()
    .sort(function (a, b) { return b.term.length - a.term.length; });

  var TERM_MAP = {};
  TERM_INDEX.forEach(function (g) { if (!TERM_MAP[g.term]) TERM_MAP[g.term] = g; });

  // 本文テキストノードを走査し、用語に一致する箇所を辞書ボタン化する
  function decorateGlossaryTerms(root) {
    if (!TERM_INDEX.length) return;
    var marked = {}; // 1章につき同じ用語は最初の1回だけ装飾
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = node.parentNode;
        // 見出し・既存リンク・コード内などは対象外
        while (p && p !== root) {
          var tag = p.nodeName;
          if (tag === "A" || tag === "CODE" || tag === "H1" || tag === "H2" ||
              tag === "H3" || tag === "H4" || tag === "H5" || tag === "BUTTON") {
            return NodeFilter.FILTER_REJECT;
          }
          p = p.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    var textNodes = [];
    var n;
    while ((n = walker.nextNode())) textNodes.push(n);

    textNodes.forEach(function (node) {
      var text = node.nodeValue;
      var found = null, foundIdx = -1, foundTerm = null;
      // この一致候補のうち、最も前方に出現する用語を選ぶ
      for (var i = 0; i < TERM_INDEX.length; i++) {
        var t = TERM_INDEX[i].term;
        if (marked[t]) continue;
        var idx = text.indexOf(t);
        if (idx !== -1 && (foundIdx === -1 || idx < foundIdx || (idx === foundIdx && t.length > foundTerm.length))) {
          found = TERM_INDEX[i]; foundIdx = idx; foundTerm = t;
        }
      }
      if (!found) return;

      marked[foundTerm] = true;
      var before = text.slice(0, foundIdx);
      var after = text.slice(foundIdx + foundTerm.length);
      var frag = document.createDocumentFragment();
      if (before) frag.appendChild(document.createTextNode(before));
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "term-link";
      btn.textContent = foundTerm;
      btn.setAttribute("data-term", foundTerm);
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        showTip(btn, found);
      });
      frag.appendChild(btn);
      if (after) frag.appendChild(document.createTextNode(after));
      node.parentNode.replaceChild(frag, node);
    });
  }

  var tipEl = $("term-tip");

  function showTip(anchor, g) {
    if (!tipEl) return;
    tipEl.innerHTML =
      '<div class="tip-head"><span class="tip-term">' + escapeHtml(g.term) + "</span>" +
      '<span class="tip-cat">' + escapeHtml(g.category) + "</span></div>" +
      (g.reading ? '<p class="tip-reading">' + escapeHtml(g.reading) + "</p>" : "") +
      '<p class="tip-def">' + escapeHtml(g.def) + "</p>" +
      '<button type="button" class="tip-close" aria-label="閉じる">閉じる</button>';
    tipEl.hidden = false;

    // 位置決め（アンカーの下に出す。画面外にはみ出さないよう調整）
    var rect = anchor.getBoundingClientRect();
    var tipW = Math.min(300, window.innerWidth - 20);
    tipEl.style.width = tipW + "px";
    var left = rect.left + window.scrollX;
    if (left + tipW > window.scrollX + window.innerWidth - 10) {
      left = window.scrollX + window.innerWidth - tipW - 10;
    }
    if (left < window.scrollX + 10) left = window.scrollX + 10;
    var top = rect.bottom + window.scrollY + 6;
    tipEl.style.left = left + "px";
    tipEl.style.top = top + "px";

    tipEl.querySelector(".tip-close").addEventListener("click", function (e) {
      e.stopPropagation();
      hideTip();
    });
  }

  function hideTip() {
    if (tipEl) { tipEl.hidden = true; tipEl.innerHTML = ""; }
  }

  // 外側タップ・スクロール・Escで閉じる
  document.addEventListener("click", function (e) {
    if (tipEl && !tipEl.hidden && !tipEl.contains(e.target) &&
        !(e.target.classList && e.target.classList.contains("term-link"))) {
      hideTip();
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") hideTip();
  });

  // ================= 用語集 =================
  var glossaryCat = "all";

  function catCount(c) {
    if (c === "all") return GLOSSARY.length;
    var n = 0;
    GLOSSARY.forEach(function (g) { if (g.category === c) n++; });
    return n;
  }

  function renderGlossaryCats() {
    var cats = ["all"];
    GLOSSARY.forEach(function (g) {
      if (cats.indexOf(g.category) === -1) cats.push(g.category);
    });
    var wrap = $("glossary-cats");
    wrap.innerHTML = cats.map(function (c) {
      var label = (c === "all" ? "すべて" : c) + " (" + catCount(c) + ")";
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
        '<div class="gloss-term"><span class="gt-name">' + (q ? highlight(g.term, q) : escapeHtml(g.term)) + "</span>" +
        '<span class="gt-cat">' + escapeHtml(g.category) + "</span></div>" +
        '<p class="gloss-def">' + (q ? highlight(g.def, q) : escapeHtml(g.def)) + "</p>" +
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

  // 検索語をエスケープした上で <mark> で囲む（大小文字を無視）
  function highlight(text, q) {
    var str = String(text);
    if (!q) return escapeHtml(str);
    var lower = str.toLowerCase();
    var ql = q.toLowerCase();
    var out = "";
    var i = 0, idx;
    while ((idx = lower.indexOf(ql, i)) !== -1) {
      out += escapeHtml(str.slice(i, idx));
      out += '<mark class="hl">' + escapeHtml(str.slice(idx, idx + ql.length)) + "</mark>";
      i = idx + ql.length;
    }
    out += escapeHtml(str.slice(i));
    return out;
  }

  // ================= 初期化 =================
  renderChapterList("");
  renderGlossaryCats();
  renderGlossary("");
  updateProgress();

  // 別ページ（クイズ等）から「#ch-N」で特定章へ直接来た場合に開く
  (function openFromHash() {
    var m = (location.hash || "").match(/^#ch-(\d+)$/);
    if (m) {
      var num = parseInt(m[1], 10);
      if (CHAPTERS.some(function (c) { return c.num === num; })) openChapter(num);
    }
  })();

  // PWA: service worker 登録
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("service-worker.js").catch(function () {});
    });
  }
})();
