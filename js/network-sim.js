// Threshold-crossing demo for the "Stochastic network resilience" project on
// projects.html. Each attack knocks out X1 ~ Geom(p1) nodes; each failed node
// takes down a Geom(p2) number of edges (X2); each edge carries an Exp(r) loss
// (X3). nu_i is the first attack at which the running total of X_i reaches M_i.
// Parameters are fixed at the poster's example (p1 = p2 = 0.5, r = 1, M1 = 1,
// M2 = 2), where Theorem 2 was checked against simulation; the visitor only
// moves the weight threshold M3. Styles live in demos.css.
(function () {
  "use strict";
  var root = document.getElementById("netsim");
  if (!root) return;
  var $ = function (s) { return root.querySelector(s); };
  var P = { p1: 0.5, p2: 0.5, r: 1, M1: 1, M2: 2 };
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function geom(p) { return Math.floor(Math.log(1 - Math.random()) / Math.log(1 - p)) + 1; }
  function expo(r) { return -Math.log(1 - Math.random()) / r; }

  function sequence(M3, keepSteps) {
    var s = [0, 0, 0], nu = [0, 0, 0], M = [P.M1, P.M2, M3], steps = [];
    for (var j = 1; j < 100000 && (!nu[0] || !nu[1] || !nu[2]); j++) {
      var x1 = geom(P.p1), x2 = 0, x3 = 0, k;
      for (k = 0; k < x1; k++) x2 += geom(P.p2);
      for (k = 0; k < x2; k++) x3 += expo(P.r);
      s[0] += x1; s[1] += x2; s[2] += x3;
      for (k = 0; k < 3; k++) if (!nu[k] && s[k] >= M[k]) nu[k] = j;
      if (keepSteps) steps.push({ s: s.slice(), nu: nu.slice() });
    }
    return { nu: nu, steps: steps };
  }

  // Theorem 2 at M1 = 1, M2 = 2 (N = 0, S_N = p1 p2, P(1, z) = 1 - e^-z)
  function theorem(M3) {
    var pp = P.p1 * P.p2, r = P.r;
    return pp * ((1 - Math.exp(-r * M3)) - Math.exp(-r * pp * M3) / (1 - pp) * (1 - Math.exp(-(1 - pp) * r * M3)));
  }

  function M3() { return +$("#ns-M3").value; }

  // ---- meters ------------------------------------------------------------
  function setMeters(step, M) {
    root.querySelectorAll(".meter").forEach(function (m, i) {
      var s = step ? step.s[i] : 0, frac = Math.min((s / M[i]) * 0.8, 1); // threshold mark sits at 80%
      m.querySelector(".fill").style.width = (frac * 100).toFixed(1) + "%";
      m.querySelector(".val").textContent = (i === 2 ? s.toFixed(1) : s) + " / " + M[i];
      m.classList.toggle("crossed", !!(step && step.nu[i]));
    });
  }
  var timer = null;
  function run() {
    clearInterval(timer);
    var M = [P.M1, P.M2, M3()], seq = sequence(M[2], true), i = 0;
    setMeters(null, M); $(".result").textContent = "";
    function done() {
      var nu = seq.nu;
      $(".result").textContent = nu[0] < nu[1] && nu[1] < nu[2]
        ? "In order: nodes, then edges, then weight (attacks " + nu.join(", ") + ")."
        : "Out of order this time (attacks " + nu.join(", ") + ").";
    }
    if (reduceMotion) { setMeters(seq.steps[seq.steps.length - 1], M); done(); return; }
    timer = setInterval(function () { setMeters(seq.steps[i++], M); if (i >= seq.steps.length) { clearInterval(timer); done(); } }, 500);
  }

  // ---- chart: theorem curve + simulated estimate at the chosen M3 ---------
  var svg = $(".chart"), NS = "http://www.w3.org/2000/svg", W = 640, H = 220, L = 44, R = 16, T = 12, B = 34, XMAX = 40, YMAX = 0.3;
  function el(n, a, t) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); if (t != null) e.textContent = t; return e; }
  var sx = function (m) { return L + (m - 1) / (XMAX - 1) * (W - L - R); };
  var sy = function (v) { return T + (1 - v / YMAX) * (H - T - B); };
  var est = null;
  function draw() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    [0, 0.1, 0.2, 0.3].forEach(function (v) {
      svg.appendChild(el("line", { x1: L, x2: W - R, y1: sy(v), y2: sy(v), "class": "gridline" }));
      svg.appendChild(el("text", { x: L - 8, y: sy(v) + 4, "text-anchor": "end" }, v.toFixed(1)));
    });
    [1, 10, 20, 30, 40].forEach(function (m) { svg.appendChild(el("text", { x: sx(m), y: H - B + 18, "text-anchor": "middle" }, m)); });
    svg.appendChild(el("text", { x: (L + W - R) / 2, y: H - 2, "text-anchor": "middle" }, "Weight threshold M₃"));
    var d = "";
    for (var m = 1; m <= XMAX; m += 0.25) d += (d ? "L" : "M") + sx(m).toFixed(1) + "," + sy(theorem(m)).toFixed(1);
    svg.appendChild(el("path", { d: d, "class": "formula" }));
    if (est) {
      var x = sx(est.m);
      svg.appendChild(el("line", { x1: x, x2: x, y1: sy(est.p - est.half), y2: sy(est.p + est.half), "class": "ci" }));
      svg.appendChild(el("circle", { cx: x, cy: sy(est.p), r: 5, "class": "simdot" }));
    }
  }
  var pending = null;
  function estimate() {
    clearTimeout(pending);
    pending = setTimeout(function () {
      var m = M3(), runs = 3000, hits = 0;
      for (var n = 0; n < runs; n++) { var nu = sequence(m, false).nu; if (nu[0] < nu[1] && nu[1] < nu[2]) hits++; }
      var p = hits / runs;
      est = { m: m, p: p, half: 1.96 * Math.sqrt(p * (1 - p) / runs) };
      $(".sim-summary").textContent = "At M₃ = " + m + ": theorem " + theorem(m).toFixed(3) + ", simulation " + p.toFixed(3) + " ± " + est.half.toFixed(3) + ".";
      draw();
    }, 120);
  }

  $("#ns-M3").addEventListener("input", function () {
    $("#ns-M3-out").textContent = M3(); clearInterval(timer); setMeters(null, [P.M1, P.M2, M3()]); $(".result").textContent = ""; estimate();
  });
  $("#ns-run").addEventListener("click", run);
  $("#ns-M3-out").textContent = M3();
  setMeters(null, [P.M1, P.M2, M3()]); draw(); estimate();
})();
