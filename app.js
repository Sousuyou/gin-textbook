// Bar Soutsu ジン教本 — アプリ本体
(function () {
  "use strict";

  var CHAPTERS = window.GIN_CONTENT || [];
  var QUIZ = window.GIN_QUIZ || [];
  var CHEATS = window.GIN_CHEATSHEET || [];

  // カテゴリの日本語ラベル
  var CAT_LABEL = {
    basics: "基礎", history: "歴史", production: "製法", botanical: "ボタニカル",
    classification: "分類", brands: "銘柄", japan: "日本", cocktail: "カクテル",
    tasting: "テイスティング", pairing: "ペアリング", culture: "文化",
    guide: "ガイド", market: "市場",
  };

  // ---- localStorage ヘルパー ----
  var STORE_READ = "ginbook_read";
  var STORE_QUIZ = "ginbook_quizbest";

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
  var quizBest = load(STORE_QUIZ);

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

  // ================= クイズ道場 =================
  function renderQuizCategories() {
    var wrap = $("quiz-categories");
    wrap.innerHTML = "";
    QUIZ.forEach(function (cat) {
      var best = quizBest[cat.id];
      var card = document.createElement("button");
      card.type = "button";
      card.className = "quiz-cat-card";
      card.innerHTML =
        "<strong>" + escapeHtml(cat.name) + "</strong>" +
        "<span>" + escapeHtml(cat.desc) + " · 全" + cat.questions.length + "問</span>" +
        (best != null ? '<span class="qc-best">自己ベスト ' + best + "/" + cat.questions.length + "</span>" : "");
      card.addEventListener("click", function () { startQuiz(cat); });
      wrap.appendChild(card);
    });
  }

  var quizSession = null;

  function startQuiz(cat) {
    quizSession = { cat: cat, idx: 0, score: 0 };
    $("quiz-home").hidden = true;
    $("quiz-runner").hidden = false;
    renderQuizQuestion();
  }

  function renderQuizQuestion() {
    var s = quizSession;
    var cat = s.cat;
    $("quiz-progress").textContent = "第" + (s.idx + 1) + "問 / " + cat.questions.length;

    if (s.idx >= cat.questions.length) {
      renderQuizResult();
      return;
    }

    var qd = cat.questions[s.idx];
    var card = $("quiz-card");
    card.innerHTML =
      '<p class="quiz-q"><span class="q-cat">' + escapeHtml(cat.name) + "</span>" + escapeHtml(qd.q) + "</p>" +
      '<div class="quiz-options"></div>' +
      '<div class="quiz-after" hidden></div>';

    var opts = card.querySelector(".quiz-options");
    qd.options.forEach(function (opt, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "quiz-opt";
      b.textContent = opt;
      b.addEventListener("click", function () { answerQuiz(i, qd, opts, card); });
      opts.appendChild(b);
    });
  }

  function answerQuiz(picked, qd, opts, card) {
    var buttons = opts.querySelectorAll(".quiz-opt");
    buttons.forEach(function (b, i) {
      b.disabled = true;
      if (i === qd.answer) b.classList.add("is-correct");
      else if (i === picked) b.classList.add("is-wrong");
    });

    if (picked === qd.answer) quizSession.score++;

    var after = card.querySelector(".quiz-after");
    after.hidden = false;
    after.innerHTML =
      '<div class="quiz-explain"><strong>' +
        (picked === qd.answer ? "正解！" : "不正解。正解は「" + escapeHtml(qd.options[qd.answer]) + "」") +
      "</strong>" + escapeHtml(qd.explain) + "</div>" +
      '<button class="quiz-next" type="button">' +
        (quizSession.idx + 1 >= quizSession.cat.questions.length ? "結果を見る" : "次の問題へ") +
      "</button>";

    after.querySelector(".quiz-next").addEventListener("click", function () {
      quizSession.idx++;
      renderQuizQuestion();
      window.scrollTo(0, 0);
    });
  }

  function renderQuizResult() {
    var s = quizSession;
    var total = s.cat.questions.length;
    var prev = quizBest[s.cat.id];
    if (prev == null || s.score > prev) {
      quizBest[s.cat.id] = s.score;
      save(STORE_QUIZ, quizBest);
    }
    var pct = Math.round((s.score / total) * 100);
    var msg =
      pct === 100 ? "満点！お客様に語れるレベルだ。" :
      pct >= 70 ? "good。あと少しで完璧。" :
      pct >= 40 ? "復習しよう。該当の章を読み返すと効く。" :
      "ここからが伸びしろ。まずは章を一読しよう。";

    $("quiz-progress").textContent = "結果";
    $("quiz-card").innerHTML =
      '<div class="quiz-result">' +
        '<div class="score">' + s.score + " / " + total + "</div>" +
        "<p>" + msg + "</p>" +
        '<button class="quiz-next" type="button" id="quiz-retry">もう一度</button>' +
      "</div>";
    $("quiz-retry").addEventListener("click", function () { startQuiz(s.cat); });
  }

  $("quiz-back").addEventListener("click", function () {
    $("quiz-runner").hidden = true;
    $("quiz-home").hidden = false;
    renderQuizCategories();
    window.scrollTo(0, 0);
  });

  // ================= チートシート =================
  function renderCheatsheet() {
    var wrap = $("cheatsheet-body");
    wrap.innerHTML = "";
    CHEATS.forEach(function (c) {
      var card = document.createElement("div");
      card.className = "cheat-card";
      var rows = c.rows.map(function (r) {
        return "<tr>" + r.map(function (cell) { return "<td>" + escapeHtml(cell) + "</td>"; }).join("") + "</tr>";
      }).join("");
      card.innerHTML =
        "<h3>" + escapeHtml(c.title) + "</h3>" +
        '<div class="cheat-inner">' +
          '<div class="table-wrap"><table>' +
            "<thead><tr>" + c.head.map(function (h) { return "<th>" + escapeHtml(h) + "</th>"; }).join("") + "</tr></thead>" +
            "<tbody>" + rows + "</tbody>" +
          "</table></div>" +
          (c.note ? '<p class="cheat-note">' + escapeHtml(c.note) + "</p>" : "") +
        "</div>";
      wrap.appendChild(card);
    });
  }

  // ---- util ----
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // ================= 初期化 =================
  renderChapterList("");
  renderQuizCategories();
  renderCheatsheet();

  // PWA: service worker 登録
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("service-worker.js").catch(function () {});
    });
  }
})();
