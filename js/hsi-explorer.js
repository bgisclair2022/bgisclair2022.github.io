// Hyperspectral explorer for the cancer-detection project on projects.html.
// Data is one region of a public dataset (HMI-LUSC, CC BY 4.0), prepared by
// tools/prepare_hsi.py into data/hsi/: bands.png (every wavelength band as a
// grey tile in one sprite), mask.png (tumour cells orange, other cells blue)
// and meta.json (wavelengths, sprite layout, per-band scaling).
// The visitor drags one wavelength slider and points at the image; the chart
// shows that spot's spectrum, coloured by the kind of cell under it.
// Styles live in demos.css.
(function () {
  "use strict";
  var root = document.getElementById("hsi");
  if (!root) return;
  var $ = function (s) { return root.querySelector(s); };
  var BASE = "data/hsi/";

  var meta, bands, size, nb, cls;             // bands[b][i] = 0..255; cls[i] = 0 none, 1 tumour, 2 other
  var view = $("#hsi-view"), ctx = view.getContext("2d"), maskImg = new Image();
  var spot = null;                            // {x, y} in data pixels

  function load(img, src) { return new Promise(function (ok, fail) { img.onload = ok; img.onerror = fail; img.src = src; }); }
  function pixels(img) {
    var c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    var g = c.getContext("2d"); g.drawImage(img, 0, 0);
    return { w: c.width, d: g.getImageData(0, 0, c.width, c.height).data };
  }

  function band() { return +$("#hsi-band").value; }

  function drawView() {
    var img = ctx.createImageData(size, size), a = bands[band()];
    for (var i = 0; i < a.length; i++) { img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = a[i]; img.data[i * 4 + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    if ($("#hsi-mask").checked) { ctx.globalAlpha = 0.5; ctx.drawImage(maskImg, 0, 0); ctx.globalAlpha = 1; }
    if (spot) { ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1; ctx.strokeRect(spot.x - 2.5, spot.y - 2.5, 6, 6); }
    $("#hsi-band-out").textContent = meta.wavelengths[band()] + " nm";
  }

  function spectrum(p) { // 3x3 average around the spot, scaled back to reflectance
    var out = [];
    for (var b = 0; b < nb; b++) {
      var s = 0, n = 0;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        var x = p.x + dx, y = p.y + dy;
        if (x >= 0 && y >= 0 && x < size && y < size) { s += bands[b][y * size + x]; n++; }
      }
      out.push(meta.scale[b][0] + (s / n / 255) * (meta.scale[b][1] - meta.scale[b][0]));
    }
    return out;
  }

  var svg = $(".chart"), NS = "http://www.w3.org/2000/svg", W = 360, H = 230, L = 34, R = 18, T = 10, B = 36, YMAX = 1.2; // narrow box: the chart sits in a narrow column
  function el(n, a, t) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); if (t != null) e.textContent = t; return e; }
  function drawChart() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var wl = meta.wavelengths, x0 = wl[0], x1 = wl[nb - 1];
    var sx = function (w) { return L + (w - x0) / (x1 - x0) * (W - L - R); };
    var sy = function (v) { return T + (1 - Math.min(v, YMAX) / YMAX) * (H - T - B); };
    [0, 0.4, 0.8, 1.2].forEach(function (v) {
      svg.appendChild(el("line", { x1: L, x2: W - R, y1: sy(v), y2: sy(v), "class": "gridline" }));
      svg.appendChild(el("text", { x: L - 8, y: sy(v) + 4, "text-anchor": "end" }, v.toFixed(1)));
    });
    [450, 550, 650, 750].forEach(function (w) { svg.appendChild(el("text", { x: sx(w), y: H - B + 18, "text-anchor": "middle" }, w)); });
    svg.appendChild(el("text", { x: (L + W - R) / 2, y: H - 2, "text-anchor": "middle" }, "Reflectance vs. wavelength (nm)"));
    var bx = sx(wl[band()]);
    svg.appendChild(el("line", { x1: bx, x2: bx, y1: T, y2: H - B, "class": "now" }));
    if (!spot) return;
    var s = spectrum(spot), kind = cls[spot.y * size + spot.x];
    svg.appendChild(el("path", {
      d: s.map(function (v, k) { return (k ? "L" : "M") + sx(wl[k]).toFixed(1) + "," + sy(v).toFixed(1); }).join(""),
      "class": kind === 1 ? "s-tumour" : kind === 2 ? "s-other" : "s-pixel"
    }));
    $(".hsi-readout").textContent = (kind === 1 ? "Tumour cell" : kind === 2 ? "Other cell" : "Not a labelled cell") +
      ": reflectance " + s[band()].toFixed(2) + " at " + wl[band()] + " nm";
  }
  function redraw() { drawView(); drawChart(); }

  view.addEventListener("pointermove", function (ev) {
    var box = view.getBoundingClientRect();
    var x = Math.floor((ev.clientX - box.left) / box.width * size), y = Math.floor((ev.clientY - box.top) / box.height * size);
    if (x >= 0 && y >= 0 && x < size && y < size) { spot = { x: x, y: y }; redraw(); }
  });
  $("#hsi-band").addEventListener("input", redraw);
  $("#hsi-mask").addEventListener("change", redraw);

  fetch(BASE + "meta.json").then(function (r) { return r.json(); }).then(function (m) {
    meta = m; size = m.size; nb = m.wavelengths.length;
    view.width = view.height = size;
    $("#hsi-band").max = nb - 1; $("#hsi-band").value = m.defaultBand;
    var sprite = new Image();
    return Promise.all([load(sprite, BASE + "bands.png"), load(maskImg, BASE + "mask.png")]).then(function () {
      var sp = pixels(sprite), mk = pixels(maskImg);
      bands = [];
      for (var b = 0; b < nb; b++) {
        var ox = (b % m.cols) * size, oy = Math.floor(b / m.cols) * size, a = new Uint8Array(size * size);
        for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) a[y * size + x] = sp.d[((oy + y) * sp.w + ox + x) * 4];
        bands.push(a);
      }
      cls = new Uint8Array(size * size);
      for (var i = 0; i < size * size; i++) if (mk.d[i * 4 + 3]) cls[i] = mk.d[i * 4] > 128 ? 1 : 2; // orange vs blue
      // start on a tumour cell near the middle so the chart is never empty
      var best = null, c = size / 2;
      for (i = 0; i < cls.length; i++) if (cls[i] === 1) {
        var px = i % size, py = (i - px) / size, d = (px - c) * (px - c) + (py - c) * (py - c);
        if (!best || d < best.d) best = { x: px, y: py, d: d };
      }
      spot = best ? { x: best.x, y: best.y } : { x: size >> 1, y: size >> 1 };
      root.classList.remove("loading"); redraw();
    });
  }).catch(function () { $(".hsi-readout").textContent = "The image data didn't load. Refresh the page to try again."; });
})();
