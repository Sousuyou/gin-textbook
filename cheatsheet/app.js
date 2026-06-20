// Bar Soutsu 早見表（独立ページ）
(function () {
  "use strict";

  var CHEATS = window.GIN_CHEATSHEET || [];

  function $(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function renderIndex() {
    var nav = $("cheat-index");
    if (!nav) return;
    if (!CHEATS.length) { nav.style.display = "none"; return; }
    var html = '<span class="cheat-index-label">目次</span>';
    html += CHEATS.map(function (c, i) {
      return '<a href="#cheat-' + i + '">' + escapeHtml(c.title) + "</a>";
    }).join("");
    nav.innerHTML = html;
  }

  function renderCheatsheet() {
    var wrap = $("cheatsheet-body");
    wrap.innerHTML = "";
    CHEATS.forEach(function (c, i) {
      var card = document.createElement("div");
      card.className = "cheat-card";
      card.id = "cheat-" + i;
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

  renderCheatsheet();
  renderIndex();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("service-worker.js").catch(function () {});
    });
  }
})();
