// Entropy-weighted voting demo for the "Entropy-based ensembling" project on
// projects.html. Model 1 votes A; models 2 and 3 vote B. Each model puts its
// confidence on its own class and splits the rest evenly over the other two.
// Weight = 1 - H/log(3), so a sure model counts for more than an unsure one.
// A generic illustration, not the ERDC method. Styles live in demos.css.
(function () {
  "use strict";
  var root = document.getElementById("ensemble");
  if (!root) return;
  var VOTES = [0, 1, 1], NAMES = ["A", "B", "C"];

  function probs(cls, conf) { return [0, 1, 2].map(function (k) { return k === cls ? conf : (1 - conf) / 2; }); }
  function entropy(p) { return -p.reduce(function (h, x) { return x > 0 ? h + x * Math.log(x) : h; }, 0); }

  function update() {
    var combo = [0, 0, 0]; // weighted sum; only its largest entry matters
    root.querySelectorAll(".vote").forEach(function (row, i) {
      var conf = +row.querySelector("input").value / 100, p = probs(VOTES[i], conf), w = 1 - entropy(p) / Math.log(3);
      row.querySelector("output").textContent = Math.round(conf * 100) + "% sure";
      row.querySelector(".w").textContent = "counts " + w.toFixed(2);
      p.forEach(function (x, k) { combo[k] += w * x; });
    });
    var best = combo.indexOf(Math.max.apply(null, combo));
    root.querySelector("#ens-weighted").textContent = NAMES[best];
    root.querySelector("#ens-weighted").parentNode.classList.toggle("differs", best !== 1);
    root.querySelector(".ens-summary").textContent = best !== 1
      ? "Model 1 is sure enough to outweigh the other two."
      : "Models 2 and 3 together carry enough weight to win.";
  }
  root.querySelectorAll(".vote input").forEach(function (s) { s.addEventListener("input", update); });
  update();
})();
