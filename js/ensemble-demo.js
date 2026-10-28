// Entropy-weighted voting demo for the "Entropy-based ensembling" project on
// projects.html. Three models each predict a class with some confidence; the
// rest of their probability is split evenly over the other classes. A model's
// weight is 1 - H/log(K), so a sure model counts for more than an unsure one.
// This is a generic illustration, not the ERDC method itself.
// Styles live in demos.css.
(function () {
  "use strict";
  var root = document.getElementById("ensemble");
  if (!root) return;

  var CLASSES = ["A", "B", "C"], K = CLASSES.length;
  var PRESETS = {
    minority: [[0, 0.95], [1, 0.40], [1, 0.40]],
    agree: [[0, 0.80], [0, 0.70], [0, 0.90]],
    split: [[0, 0.60], [1, 0.62], [2, 0.58]]
  };

  function probs(cls, conf) {
    var p = [], rest = (1 - conf) / (K - 1);
    for (var k = 0; k < K; k++) p.push(k === cls ? conf : rest);
    return p;
  }
  function entropy(p) { return -p.reduce(function (h, x) { return x > 0 ? h + x * Math.log(x) : h; }, 0); }
  function argmax(v) { var b = 0; for (var i = 1; i < v.length; i++) if (v[i] > v[b]) b = i; return b; }

  function barsHtml(p) {
    return p.map(function (x, k) {
      return '<span>' + CLASSES[k] + '</span><span class="bar c' + k + '"><b style="width:' + (x * 100).toFixed(1) +
        '%"></b></span><span class="pct">' + Math.round(x * 100) + '%</span>';
    }).join("");
  }

  function update() {
    var rows = root.querySelectorAll(".model"), ps = [], ws = [], votes = [0, 0, 0];
    rows.forEach(function (row) {
      var cls = +row.querySelector("select").value, conf = +row.querySelector("input").value / 100;
      var p = probs(cls, conf), hn = entropy(p) / Math.log(K), w = 1 - hn;
      ps.push(p); ws.push(w); votes[cls]++;
      row.querySelector(".conf output").textContent = Math.round(conf * 100) + "%";
      row.querySelector(".probs").innerHTML = barsHtml(p);
      row.querySelector(".meta-line").textContent = "Uncertainty " + hn.toFixed(2) + "  ·  weight " + w.toFixed(2);
    });

    // plain majority vote
    var top = Math.max.apply(null, votes), leaders = [];
    votes.forEach(function (v, k) { if (v === top) leaders.push(CLASSES[k]); });
    root.querySelector("#ens-majority .winner").textContent = leaders.length > 1 ? "Tie" : "Class " + leaders[0];
    root.querySelector("#ens-majority .why").textContent = "Votes: " + votes.map(function (v, k) { return CLASSES[k] + " " + v; }).join(", ") + ". Every model counts the same.";

    // entropy-weighted average of the probability vectors
    var total = ws.reduce(function (a, b) { return a + b; }, 0) || 1, combo = [0, 0, 0];
    ps.forEach(function (p, i) { p.forEach(function (x, k) { combo[k] += ws[i] * x / total; }); });
    var best = argmax(combo);
    root.querySelector("#ens-weighted .winner").textContent = "Class " + CLASSES[best];
    root.querySelector("#ens-weighted .probs").innerHTML = barsHtml(combo);

    var differ = leaders.length === 1 && leaders[0] !== CLASSES[best];
    root.querySelector(".ens-summary").textContent = differ
      ? "The two methods disagree: one confident model outweighs two unsure ones."
      : leaders.length > 1 ? "Majority vote can't decide; weighting by certainty breaks the tie."
      : "Both methods agree here.";
  }

  function applyPreset(name) {
    root.querySelectorAll(".model").forEach(function (row, i) {
      row.querySelector("select").value = PRESETS[name][i][0];
      row.querySelector("input").value = Math.round(PRESETS[name][i][1] * 100);
    });
    update();
  }

  root.querySelectorAll(".model select, .model input").forEach(function (c) { c.addEventListener("input", update); });
  root.querySelectorAll("[data-preset]").forEach(function (b) {
    b.addEventListener("click", function () { applyPreset(b.getAttribute("data-preset")); });
  });
  applyPreset("minority");
})();
