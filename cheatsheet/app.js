// Bar Soutsu チートシート（独立ページ）
(function () {
  "use strict";

  var CHEATS = window.GIN_CHEATSHEET || [];

  function $(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

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

  renderCheatsheet();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("service-worker.js").catch(function () {});
    });
  }
})();
