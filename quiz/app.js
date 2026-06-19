// Bar Soutsu クイズ道場（独立ページ）
(function () {
  "use strict";

  var QUIZ = window.GIN_QUIZ || [];
  var STORE_QUIZ = "ginbook_quizbest";
  var TEXTBOOK_URL = "https://sousuyou.github.io/gin-textbook/";

  // クイズのカテゴリID → 教本の該当章番号（分かるものだけ）。
  // 不明なものは教本トップへ誘導する。
  var CAT_TO_CHAPTER = {
    basics: 1,
    history: 2,
    production: 3,
    botanical: 4,
    classification: 5,
    brands: 6,
    cocktail: 12,   // ジントニック設計の章が最も近い
    tasting: 8,
    // service / advanced / master は対応章が一意でないため教本トップへ
  };

  function load(key) {
    try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) { return {}; }
  }
  function save(key, obj) {
    try { localStorage.setItem(key, JSON.stringify(obj)); } catch (e) {}
  }
  var quizBest = load(STORE_QUIZ);

  function $(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // 配列をシャッフル（Fisher–Yates）。元配列は壊さない。
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // 該当カテゴリの教本リンクHTMLを返す
  function textbookLink(catId) {
    if (catId === "botanical_guess") {
      return '<a class="quiz-textbook-link" href="https://sousuyou.github.io/gin-stock/">在庫カタログで確認 →</a>';
    }
    var ch = CAT_TO_CHAPTER[catId];
    if (ch) {
      return '<a class="quiz-textbook-link" href="' + TEXTBOOK_URL + "#ch-" + ch +
        '">教本 第' + ch + "章を読む →</a>";
    }
    return '<a class="quiz-textbook-link" href="' + TEXTBOOK_URL + '">教本で復習する →</a>';
  }

  // ボタニカル当ては該当銘柄へ直リンク。それ以外は教本リンク。
  function answerLink(catId, linkName) {
    if (catId === "botanical_guess" && linkName) {
      return '<a class="quiz-textbook-link" target="_blank" rel="noopener" href="' +
        "https://sousuyou.github.io/gin-stock/?q=" + encodeURIComponent(linkName) +
        '">「' + escapeHtml(linkName) + '」をカタログで見る →</a>';
    }
    return textbookLink(catId);
  }

  // ====== ボタニカル当てクイズ（在庫カタログ連動）======
  // 同一オリジンの公開カタログ。CSP connect-src 'self' 対応のため相対パスで取得。
  var CATALOG_URL = "../../gin-stock/gins.json";
  var BOTANICAL_N = 10; // ボタニカル当ての1回の出題数
  // 通常カテゴリは毎回ランダム順。tierごとに1回の出題数を変える（暗記ゲー化を防ぐ）。
  // 基礎＝サクッと小テスト。応用・研究・腕試し＝全問（腕試しはフルの腕試し）。
  // ここに無いtierは「全問」になる。
  var PICK_BY_TIER = { "基礎": 5 };
  function pickCount(cat) {
    if (cat.generated) return BOTANICAL_N;
    var n = PICK_BY_TIER[cat.tier];
    var len = (cat.questions || []).length;
    return (n == null) ? len : Math.min(n, len);
  }

  function splitBotanicals(s) {
    return String(s || "").split(/[、,／\/]/).map(function (x) { return x.trim(); }).filter(Boolean);
  }

  // 在庫データから「ボタニカル → 銘柄当て」問題を生成する
  function buildBotanicalQuestions(gins) {
    var pool = gins.filter(function (g) {
      return g && g.botanicals && splitBotanicals(g.botanicals).length >= 3 && (g.kana || g.name);
    });
    // 選択肢の表示名：「英語名 / カタカナ名」（片方しか無ければある方）
    var label = function (g) {
      var n = String(g.name || "").trim(), k = String(g.kana || "").trim();
      if (n && k && n !== k) return n + " / " + k;
      return n || k;
    };
    return shuffle(pool).slice(0, BOTANICAL_N).map(function (ans) {
      // 表示名が重複しない誤答を5つ選ぶ（同名・カナ被りの別銘柄の混入を防ぐ）
      var seen = {}; seen[label(ans)] = true;
      var distractors = [];
      var others = shuffle(pool);
      for (var i = 0; i < others.length && distractors.length < 5; i++) {
        var lb = label(others[i]);
        if (seen[lb]) continue;
        seen[lb] = true;
        distractors.push(others[i]);
      }
      var choices = distractors.concat([ans]); // 表示時にapp側で再シャッフルされる
      return {
        q: "以下のボタニカルで作られるジンはなに？",
        sub: ans.botanicals,
        options: choices.map(label),
        answer: choices.length - 1,
        explain: (ans.kana || ans.name) + "（" + ans.name + "）｜" +
          (ans.country || "産地不明") + "・" + (ans.abv != null ? ans.abv + "%" : "度数不明") +
          (String(ans.note || "").trim() ? "。" + String(ans.note).trim() : ""),
        linkName: String(ans.name || ans.kana || "").trim(), // 該当銘柄へ直リンクするための名前
      };
    });
  }

  // カテゴリ起動。在庫連動カテゴリは取得→生成してから開始する。
  function launchCategory(cat) {
    if (cat.generated !== "botanical") { startQuiz(cat); return; }
    $("quiz-home").hidden = true;
    $("quiz-runner").hidden = false;
    $("quiz-progress").textContent = "読み込み中…";
    $("quiz-card").innerHTML = '<p class="quiz-loading" style="padding:36px 12px;text-align:center;color:var(--muted);">在庫カタログからジンのデータを取得しています…</p>';
    fetch(CATALOG_URL, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (data) {
        var qs = buildBotanicalQuestions((data && data.gins) || []);
        if (!qs.length) throw new Error("出題データなし");
        cat.questions = qs;
        startQuiz(cat);
      })
      .catch(function () {
        $("quiz-card").innerHTML =
          '<div class="quiz-result"><p>在庫カタログのデータを取得できませんでした。<br>通信状況を確認して、もう一度お試しください。</p>' +
          '<div class="quiz-result-actions"><button class="quiz-next" type="button" id="quiz-back2">カテゴリへ戻る</button></div></div>';
        $("quiz-back2").addEventListener("click", goHome);
      });
  }

  function renderQuizCategories() {
    var wrap = $("quiz-categories");
    wrap.innerHTML = "";
    // バンド（編）ごとの見出し。色は左罫線で区別（styles.css非依存のインライン）。
    var BAND_LABELS = { "特別": "特別クイズ", "基礎": "基礎編", "応用": "応用編", "研究": "研究編", "腕試し": "腕試し" };
    var BAND_COLORS = { "特別": "#bd8a2c", "基礎": "#3f6b54", "応用": "#41618f", "研究": "#6b4f8c", "腕試し": "#a4503a" };
    var currentBand = null;
    QUIZ.forEach(function (cat) {
      var band = cat.tier || "基礎";
      if (band !== currentBand) {
        currentBand = band;
        // 「特別」は見出しを出さず、カード自体を金枠にして特別感を出す
        if (band !== "特別") {
          var header = document.createElement("div");
          header.className = "quiz-band-header";
          header.setAttribute("style",
            "grid-column:1/-1;margin:22px 0 6px;padding:7px 0 7px 12px;" +
            "border-left:5px solid " + (BAND_COLORS[band] || "#888") + ";" +
            "border-bottom:1px solid var(--line);font-weight:700;" +
            "font-size:0.95rem;letter-spacing:0.04em;color:var(--text);");
          header.textContent = BAND_LABELS[band] || band;
          wrap.appendChild(header);
        }
      }
      var best = quizBest[cat.id];
      var denom = pickCount(cat);
      var card = document.createElement("button");
      card.type = "button";
      card.className = "quiz-cat-card";
      if (cat.tier === "特別") {
        card.style.border = "2px solid " + (BAND_COLORS["特別"] || "#bd8a2c");
      }
      card.innerHTML =
        "<strong>" + escapeHtml(cat.name) + "</strong>" +
        "<span>" + escapeHtml(cat.desc) + " · 全" + denom + "問</span>" +
        (best != null ? '<span class="qc-best">自己ベスト ' + Math.min(best, denom) + "/" + denom + "</span>" : "");
      card.addEventListener("click", function () { launchCategory(cat); });
      wrap.appendChild(card);
    });
  }

  var quizSession = null;

  function startQuiz(cat) {
    // 出題する問題リストを用意する。
    // 通常カテゴリは毎回シャッフルし、最大 QUIZ_PICK 問だけ抽出（繰り返しても順番・顔ぶれが変わる）。
    // 生成カテゴリ（ボタニカル当て）は launchCategory で抽出済みのためそのまま使う。
    var pool = (cat.questions || []).slice();
    if (!cat.generated) {
      var n = pickCount(cat);
      pool = shuffle(pool);
      if (pool.length > n) pool = pool.slice(0, n);
    }
    quizSession = { cat: cat, questions: pool, idx: 0, score: 0, wrong: [], order: null };
    $("quiz-home").hidden = true;
    $("quiz-runner").hidden = false;
    renderQuizQuestion();
    window.scrollTo(0, 0);
  }

  function setBar(current, total) {
    var bar = $("quiz-bar");
    var fill = $("quiz-bar-fill");
    if (!bar || !fill) return;
    bar.style.display = "block";
    var pct = total ? Math.round((current / total) * 100) : 0;
    fill.style.width = pct + "%";
  }

  function renderQuizQuestion() {
    var s = quizSession;
    var cat = s.cat;
    var list = s.questions;
    $("quiz-progress").textContent = "第" + (s.idx + 1) + "問 / " + list.length;
    setBar(s.idx + 1, list.length);

    if (s.idx >= list.length) {
      renderQuizResult();
      return;
    }

    var qd = list[s.idx];

    // 選択肢をシャッフルし、表示順 → 元indexの対応を作る
    var order = shuffle(qd.options.map(function (_, i) { return i; }));
    s.order = order;

    // 補足（ボタニカル当てクイズ）：ボタニカルをタグ（丸チップ）で並べる。
    // 選択肢の四角いボタンと見分けやすくするため、丸み・中立色で表示する。
    var subBox = qd.sub
      ? '<div class="quiz-sub" style="margin:10px 0 16px;display:flex;flex-wrap:wrap;gap:7px;">' +
        splitBotanicals(qd.sub).map(function (b) {
          return '<span style="display:inline-block;padding:5px 12px;border-radius:16px;' +
            'font-size:0.88em;color:#5a3a00;background:#ffd56b;">' + escapeHtml(b) + "</span>";
        }).join("") +
        "</div>"
      : "";

    var card = $("quiz-card");
    card.innerHTML =
      '<p class="quiz-q"><span class="q-cat">' + escapeHtml(cat.name) + "</span>" + escapeHtml(qd.q) + "</p>" +
      subBox +
      '<div class="quiz-options"></div>' +
      '<div class="quiz-after" hidden></div>';

    var opts = card.querySelector(".quiz-options");
    order.forEach(function (origIdx) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "quiz-opt";
      b.textContent = qd.options[origIdx];
      b.addEventListener("click", function () { answerQuiz(origIdx, qd, opts, card); });
      opts.appendChild(b);
    });
  }

  function answerQuiz(picked, qd, opts, card) {
    var buttons = opts.querySelectorAll(".quiz-opt");
    var order = quizSession.order;
    buttons.forEach(function (b, displayIdx) {
      b.disabled = true;
      var origIdx = order[displayIdx];
      // 色だけに頼らず ○×アイコン＋文字も添える（色覚配慮）
      if (origIdx === qd.answer) {
        b.classList.add("is-correct");
        b.insertAdjacentHTML("beforeend", '<span class="opt-mark opt-mark-correct">○ 正解</span>');
      } else if (origIdx === picked) {
        b.classList.add("is-wrong");
        b.insertAdjacentHTML("beforeend", '<span class="opt-mark opt-mark-wrong">× 不正解</span>');
      }
    });

    if (picked === qd.answer) {
      quizSession.score++;
    } else {
      quizSession.wrong.push({
        q: qd.q,
        your: qd.options[picked],
        correct: qd.options[qd.answer],
        explain: qd.explain,
        linkName: qd.linkName,
      });
    }

    var after = card.querySelector(".quiz-after");
    after.hidden = false;
    after.innerHTML =
      '<div class="quiz-explain"><strong>' +
        (picked === qd.answer ? "○ 正解！" : "× 不正解。正解は「" + escapeHtml(qd.options[qd.answer]) + "」") +
      "</strong>" + escapeHtml(qd.explain) +
      '<p class="quiz-explain-link">' + answerLink(quizSession.cat.id, qd.linkName) + "</p>" +
      "</div>" +
      '<button class="quiz-next" type="button">' +
        (quizSession.idx + 1 >= quizSession.questions.length ? "結果を見る" : "次の問題へ") +
      "</button>";

    after.querySelector(".quiz-next").addEventListener("click", function () {
      quizSession.idx++;
      renderQuizQuestion();
      window.scrollTo(0, 0);
    });
  }

  function renderQuizResult() {
    var s = quizSession;
    var total = s.questions.length;
    var prev = quizBest[s.cat.id];
    if (prev == null || s.score > prev) {
      quizBest[s.cat.id] = s.score;
      save(STORE_QUIZ, quizBest);
    }
    var pct = Math.round((s.score / total) * 100);
    var msg =
      pct === 100 ? "満点！お客様に語れるレベルだ。" :
      pct >= 70 ? "good。あと少しで完璧。" :
      pct >= 40 ? "復習しよう。ジン教本を読み返すと効く。" :
      "ここからが伸びしろ。まずはジン教本を一読しよう。";

    $("quiz-progress").textContent = "結果";
    setBar(total, total);

    var review = "";
    if (s.wrong.length) {
      review =
        '<div class="quiz-review">' +
          '<h3>間違えた問題のおさらい（' + s.wrong.length + "問）</h3>" +
          s.wrong.map(function (w) {
            return '<div class="qr-item">' +
              '<p class="qr-q">' + escapeHtml(w.q) + "</p>" +
              '<p class="qr-line qr-correct"><span>○ 正解</span>' + escapeHtml(w.correct) + "</p>" +
              '<p class="qr-line qr-your"><span>× あなた</span>' + escapeHtml(w.your) + "</p>" +
              '<p class="qr-explain">' + escapeHtml(w.explain) + "</p>" +
              (s.cat.id === "botanical_guess" && w.linkName
                ? '<p class="quiz-explain-link">' + answerLink(s.cat.id, w.linkName) + "</p>" : "") +
            "</div>";
          }).join("") +
        "</div>";
    } else {
      review = '<p class="quiz-allcorrect">全問正解！おさらいはありません。</p>';
    }

    $("quiz-card").innerHTML =
      '<div class="quiz-result">' +
        '<div class="score">' + s.score + " / " + total + "</div>" +
        "<p>" + msg + "</p>" +
        '<p class="quiz-result-link">' + textbookLink(s.cat.id) + "</p>" +
        '<div class="quiz-result-actions">' +
          '<button class="quiz-next" type="button" id="quiz-retry">もう一度</button>' +
          '<button class="quiz-next quiz-next-alt" type="button" id="quiz-other">他のカテゴリへ</button>' +
        "</div>" +
      "</div>" +
      review;
    $("quiz-retry").addEventListener("click", function () { launchCategory(s.cat); });
    $("quiz-other").addEventListener("click", function () { goHome(); });
  }

  function goHome() {
    $("quiz-runner").hidden = true;
    $("quiz-home").hidden = false;
    renderQuizCategories();
    window.scrollTo(0, 0);
  }

  $("quiz-back").addEventListener("click", goHome);

  renderQuizCategories();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("service-worker.js").catch(function () {});
    });
  }
})();
