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
    var ch = CAT_TO_CHAPTER[catId];
    if (ch) {
      return '<a class="quiz-textbook-link" href="' + TEXTBOOK_URL + "#ch-" + ch +
        '">教本 第' + ch + "章を読む →</a>";
    }
    return '<a class="quiz-textbook-link" href="' + TEXTBOOK_URL + '">教本で復習する →</a>';
  }

  function renderQuizCategories() {
    var wrap = $("quiz-categories");
    wrap.innerHTML = "";
    var hardShown = false;
    QUIZ.forEach(function (cat) {
      if (cat.tier === "上級" && !hardShown) {
        var divider = document.createElement("div");
        divider.className = "quiz-zone-divider";
        divider.textContent = "上級者向け";
        wrap.appendChild(divider);
        hardShown = true;
      }
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
    quizSession = { cat: cat, idx: 0, score: 0, wrong: [], order: null };
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
    $("quiz-progress").textContent = "第" + (s.idx + 1) + "問 / " + cat.questions.length;
    setBar(s.idx + 1, cat.questions.length);

    if (s.idx >= cat.questions.length) {
      renderQuizResult();
      return;
    }

    var qd = cat.questions[s.idx];

    // 選択肢をシャッフルし、表示順 → 元indexの対応を作る
    var order = shuffle(qd.options.map(function (_, i) { return i; }));
    s.order = order;

    var card = $("quiz-card");
    card.innerHTML =
      '<p class="quiz-q"><span class="q-cat">' + escapeHtml(cat.name) + "</span>" + escapeHtml(qd.q) + "</p>" +
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
      });
    }

    var after = card.querySelector(".quiz-after");
    after.hidden = false;
    after.innerHTML =
      '<div class="quiz-explain"><strong>' +
        (picked === qd.answer ? "○ 正解！" : "× 不正解。正解は「" + escapeHtml(qd.options[qd.answer]) + "」") +
      "</strong>" + escapeHtml(qd.explain) +
      '<p class="quiz-explain-link">' + textbookLink(quizSession.cat.id) + "</p>" +
      "</div>" +
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
    $("quiz-retry").addEventListener("click", function () { startQuiz(s.cat); });
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
