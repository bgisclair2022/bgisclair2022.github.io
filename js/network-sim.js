// Threshold-crossing simulator for the "Stochastic network resilience" project
// on projects.html. Each attack j knocks out X1 ~ Geom(p1) nodes; each failed
// node takes down a Geom(p2) number of edges (X2); each edge carries an Exp(r)
// loss (X3). nu_i is the first attack at which the running total of X_i reaches
// threshold M_i. The closed form is Theorem 2 of the poster; it is drawn only
// for M1 = 1, M2 = 2, the setting where it was checked against simulation.
// Styles live in demos.css.
(function () {
  "use strict";
  var root = document.getElementById("netsim");
  if (!root) return;

  var $ = function (sel) { return root.querySelector(sel); };
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- sampling ---------------------------------------------------------
  function geom(p) { return Math.floor(Math.log(1 - Math.random()) / Math.log(1 - p)) + 1; } // support 1, 2, ...
  function expo(r) { return -Math.log(1 - Math.random()) / r; }

  // One attack sequence. Returns the per-attack running totals and nu.
  function sequence(P, keepSteps) {
    var s = [0, 0, 0], nu = [0, 0, 0], M = [P.M1, P.M2, P.M3], steps = [];
    for (var j = 1; j < 100000 && (!nu[0] || !nu[1] || !nu[2]); j++) {
      var x1 = geom(P.p1), x2 = 0, x3 = 0, k;
      for (k = 0; k < x1; k++) x2 += geom(P.p2);
      for (k = 0; k < x2; k++) x3 += expo(P.r);
      s[0] += x1; s[1] += x2; s[2] += x3;
      for (k = 0; k < 3; k++) if (!nu[k] && s[k] >= M[k]) nu[k] = j;
      if (keepSteps) steps.push({ x: [x1, x2, x3], s: s.slice(), nu: nu.slice() });
    }
    return { nu: nu, steps: steps };
  }

  // ---- closed form (poster, Theorem 2) ----------------------------------
  function lowerGammaP(a, x) { // regularized lower incomplete gamma, integer a >= 1
    var term = 1, sum = 1;
    for (var k = 1; k < a; k++) { term *= x / k; sum += term; }
    return 1 - Math.exp(-x) * sum;
  }
  function choose(n, k) { var c = 1; for (var i = 1; i <= k; i++) c = c * (n - k + i) / i; return c; }
  function closedForm(P) {
    var q2 = 1 - P.p2, pp = P.p1 * P.p2, N = P.M2 - P.M1 - 1, S = 0, a = P.M2 - 1;
    for (var t = 0; t <= N; t++) S += choose(P.M1 + t + 2, t) * Math.pow(q2, t) * (1 - Math.pow(1 - pp, N + t + 1));
    return S * Math.pow(P.p2, P.M1 - 1) *
      (lowerGammaP(a, P.r * P.M3) - Math.exp(-P.r * pp * P.M3) / Math.pow(1 - pp, a) * lowerGammaP(a, (1 - pp) * P.r * P.M3));
  }
  function formulaShown(P) { return P.M1 === 1 && P.M2 === 2; }

  // ---- controls ----------------------------------------------------------
  var ids = ["p1", "p2", "r", "M1", "M2", "M3"];
  function params() {
    var P = {};
    ids.forEach(function (id) { P[id] = parseFloat($("#ns-" + id).value); });
    return P;
  }
  function syncOutputs() {
    var m1 = $("#ns-M1"), m2 = $("#ns-M2");
    if (+m2.value <= +m1.value) m2.value = +m1.value + 1; // M2 must exceed M1
    ids.forEach(function (id) {
      var v = parseFloat($("#ns-" + id).value);
      $("#ns-" + id + "-out").textContent = id.charAt(0) === "M" ? v : v.toFixed(2);
    });
  }

  // ---- meters ------------------------------------------------------------
  var labels = ["Nodes lost", "Edges lost", "Weight lost"];
  function resetMeters(P) {
    var M = [P.M1, P.M2, P.M3];
    root.querySelectorAll(".meter").forEach(function (m, i) {
      m.classList.remove("crossed");
      m.querySelector(".fill").style.width = "0%";
      m.querySelector(".val").textContent = "0 / " + M[i];
    });
    $(".result").textContent = "";
  }
  function setMeters(P, step) {
    var M = [P.M1, P.M2, P.M3];
    root.querySelectorAll(".meter").forEach(function (m, i) {
      var frac = Math.min((step.s[i] / M[i]) * 0.8, 1); // threshold mark sits at 80%
      m.querySelector(".fill").style.width = (frac * 100).toFixed(1) + "%";
      var v = i === 2 ? step.s[i].toFixed(1) : step.s[i];
      m.querySelector(".val").textContent = v + " / " + M[i] + (step.nu[i] ? "  (attack " + step.nu[i] + ")" : "");
      m.classList.toggle("crossed", !!step.nu[i]);
    });
  }

  var timer = null;
  function runOne() {
    clearInterval(timer);
    var P = params(), seq = sequence(P, true), i = 0;
    resetMeters(P);
    function finish() {
      var nu = seq.nu, ok = nu[0] < nu[1] && nu[1] < nu[2];
      $(".result").innerHTML = "Thresholds crossed at attacks " + nu[0] + ", " + nu[1] + ", " + nu[2] + ". " +
        (ok ? "<strong>In order:</strong> nodes, then edges, then weight." : "<strong>Not in strict order</strong> this time.");
    }
    if (reduceMotion) { setMeters(P, seq.steps[seq.steps.length - 1]); finish(); return; }
    timer = setInterval(function () {
      setMeters(P, seq.steps[i++]);
      if (i >= seq.steps.length) { clearInterval(timer); finish(); }
    }, 650);
  }

  // ---- chart -------------------------------------------------------------
  var svg = $(".chart"), NS = "http://www.w3.org/2000/svg";
  var W = 640, H = 260, L = 44, R = 16, T = 12, B = 34, XMAX = 40;
  var sims = {}; // M3 -> {p, half}
  function el(name, attrs, text) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function yMaxFor(P) {
    var m = formulaShown(P) ? P.p1 * P.p2 : 0;
    for (var k in sims) m = Math.max(m, sims[k].p + sims[k].half);
    return Math.max(0.1, Math.ceil(m * 1.15 * 20) / 20);
  }
  var sx = function (m) { return L + (m - 1) / (XMAX - 1) * (W - L - R); };
  var sy = function (v, ymax) { return T + (1 - v / ymax) * (H - T - B); };

  function draw() {
    var P = params(), ymax = yMaxFor(P), i;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    for (i = 0; i <= 4; i++) { // y grid + labels
      var v = ymax * i / 4, y = sy(v, ymax);
      svg.appendChild(el("line", { x1: L, x2: W - R, y1: y, y2: y, "class": "gridline" }));
      svg.appendChild(el("text", { x: L - 8, y: y + 4, "text-anchor": "end" }, v.toFixed(2)));
    }
    [1, 10, 20, 30, 40].forEach(function (m) {
      svg.appendChild(el("text", { x: sx(m), y: H - B + 18, "text-anchor": "middle" }, m));
    });
    svg.appendChild(el("line", { x1: L, x2: W - R, y1: H - B, y2: H - B, "class": "axis" }));
    svg.appendChild(el("text", { x: (L + W - R) / 2, y: H - 2, "text-anchor": "middle" }, "Weight threshold M₃"));
    svg.appendChild(el("line", { x1: sx(P.M3), x2: sx(P.M3), y1: T, y2: H - B, "class": "now" }));
    if (formulaShown(P)) {
      var d = "";
      for (var m = 1; m <= XMAX; m += 0.25) d += (d ? "L" : "M") + sx(m).toFixed(1) + "," + sy(closedForm({ p1: P.p1, p2: P.p2, r: P.r, M1: 1, M2: 2, M3: m }), ymax).toFixed(1);
      svg.appendChild(el("path", { d: d, "class": "formula" }));
    }
    Object.keys(sims).forEach(function (k) {
      var s = sims[k], x = sx(+k);
      svg.appendChild(el("line", { x1: x, x2: x, y1: sy(s.p - s.half, ymax), y2: sy(Math.min(s.p + s.half, ymax), ymax), "class": "ci" }));
      svg.appendChild(el("circle", { cx: x, cy: sy(s.p, ymax), r: 4.5, "class": "simdot" }));
    });
    hoverLine = el("line", { y1: T, y2: H - B, "class": "hover-line", visibility: "hidden" });
    svg.appendChild(hoverLine);
    $(".formula-note").hidden = formulaShown(P);
  }

  // hover: nearest integer M3, formula + simulated value
  var hoverLine, tip = $(".tip");
  svg.addEventListener("mousemove", function (ev) {
    var box = svg.getBoundingClientRect(), x = (ev.clientX - box.left) * W / box.width;
    var m = Math.round(1 + (x - L) / (W - L - R) * (XMAX - 1));
    if (m < 1 || m > XMAX) { hide(); return; }
    var P = params(), lines = ["M₃ = " + m];
    if (formulaShown(P)) lines.push("Closed form: " + closedForm({ p1: P.p1, p2: P.p2, r: P.r, M1: 1, M2: 2, M3: m }).toFixed(4));
    if (sims[m]) lines.push("Simulation: " + sims[m].p.toFixed(4) + " ± " + sims[m].half.toFixed(4));
    if (lines.length === 1) lines.push("Run the simulation to add points");
    tip.innerHTML = lines.join("<br>"); tip.hidden = false;
    tip.style.left = (sx(m) / W * box.width) + "px"; tip.style.top = (ev.clientY - box.top) + "px";
    hoverLine.setAttribute("x1", sx(m)); hoverLine.setAttribute("x2", sx(m)); hoverLine.setAttribute("visibility", "visible");
  });
  function hide() { tip.hidden = true; if (hoverLine) hoverLine.setAttribute("visibility", "hidden"); }
  svg.addEventListener("mouseleave", hide);

  // Monte Carlo over a set of M3 values, in chunks so the page stays responsive
  function simulateCurve() {
    var P = params(), btn = $("#ns-sim"), runs = 4000;
    var grid = [1, 2, 4, 6, 8, 10, 15, 20, 25, 30, 40];
    if (grid.indexOf(P.M3) < 0) grid.push(P.M3);
    sims = {}; btn.disabled = true; btn.textContent = "Simulating…";
    var gi = 0;
    (function next() {
      if (gi >= grid.length) {
        btn.disabled = false; btn.textContent = "Simulate the curve again";
        var here = sims[P.M3];
        $(".sim-summary").textContent = "At M₃ = " + P.M3 + ": simulated " + here.p.toFixed(3) + " ± " + here.half.toFixed(3) +
          (formulaShown(P) ? ", closed form " + closedForm(P).toFixed(3) + "." : " (" + runs.toLocaleString() + " runs per point).");
        return;
      }
      var m = grid[gi++], hits = 0, Q = { p1: P.p1, p2: P.p2, r: P.r, M1: P.M1, M2: P.M2, M3: m };
      for (var n = 0; n < runs; n++) { var nu = sequence(Q, false).nu; if (nu[0] < nu[1] && nu[1] < nu[2]) hits++; }
      var p = hits / runs;
      sims[m] = { p: p, half: 1.96 * Math.sqrt(Math.max(p * (1 - p), 1e-9) / runs) };
      draw();
      setTimeout(next, 0);
    })();
  }

  // ---- wiring ------------------------------------------------------------
  ids.forEach(function (id) {
    $("#ns-" + id).addEventListener("input", function () {
      syncOutputs(); sims = {}; $(".sim-summary").textContent = ""; clearInterval(timer);
      resetMeters(params()); draw();
      $("#ns-sim").textContent = "Simulate the curve";
    });
  });
  $("#ns-run").addEventListener("click", runOne);
  $("#ns-sim").addEventListener("click", simulateCurve);
  root.querySelectorAll(".meter .name").forEach(function (n, i) { n.textContent = labels[i]; });
  syncOutputs(); resetMeters(params()); draw();
})();
