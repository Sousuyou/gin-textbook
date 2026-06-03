// Bar Soutsu クイズ道場（独立ページ）
(function () {
  "use strict";

  var QUIZ = window.GIN_QUIZ || [];
  var STORE_QUIZ = "ginbook_quizbest";

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
    window.scrollTo(0, 0);
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
      pct >= 40 ? "復習しよう。ジン教本を読み返すと効く。" :
      "ここからが伸びしろ。まずはジン教本を一読しよう。";

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

  renderQuizCategories();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("service-worker.js").catch(function () {});
    });
  }
})();
