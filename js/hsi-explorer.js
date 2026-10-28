// Hyperspectral explorer for the cancer-detection project on projects.html.
// Data is one region of a public dataset (HMI-LUSC, CC BY 4.0), prepared by
// tools/prepare_hsi.py into data/hsi/: bands.png (every wavelength band as a
// grey tile in one sprite), rgb.png, mask.png (tumour cells) and meta.json
// (wavelengths, sprite layout, tumour vs non-tumour mean spectra).
// Styles live in demos.css.
(function () {
  "use strict";
  var root = document.getElementById("hsi");
  if (!root) return;
  var $ = function (s) { return root.querySelector(s); };
  var BASE = "data/hsi/";

  var meta, bands = null, size, nb;          // bands[b][y*size+x] = 0..255
  var view = $("#hsi-view"), ctx = view.getContext("2d");
  var rgbImg = new Image(), maskImg = new Image();
  var pinned = null, hover = null;            // {x, y} in data pixels

  function loadImage(img, src) {
    return new Promise(function (ok, fail) { img.onload = ok; img.onerror = fail; img.src = src; });
  }

  // Unpack the sprite into one Uint8Array per band.
  function unpack(sprite) {
    var c = document.createElement("canvas"); c.width = sprite.width; c.height = sprite.height;
    var g = c.getContext("2d"); g.drawImage(sprite, 0, 0);
    var px = g.getImageData(0, 0, c.width, c.height).data, out = [];
    for (var b = 0; b < nb; b++) {
      var ox = (b % meta.cols) * size, oy = Math.floor(b / meta.cols) * size, a = new Uint8Array(size * size);
      for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) a[y * size + x] = px[((oy + y) * c.width + ox + x) * 4];
      out.push(a);
    }
    return out;
  }

  function bandIndex() { return +$("#hsi-band").value; }

  // ---- image view ----------------------------------------------------------
  function drawView() {
    var mode = root.querySelector('input[name="hsi-mode"]:checked').value;
    view.width = size; view.height = size;
    if (mode === "rgb") ctx.drawImage(rgbImg, 0, 0, size, size);
    else {
      var img = ctx.createImageData(size, size), a = bands[bandIndex()];
      for (var i = 0; i < a.length; i++) { var v = a[i]; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
      ctx.putImageData(img, 0, 0);
    }
    if ($("#hsi-mask").checked) { ctx.globalAlpha = 0.45; ctx.drawImage(maskImg, 0, 0, size, size); ctx.globalAlpha = 1; }
    [pinned, hover].forEach(function (p, i) {
      if (!p) return;
      ctx.strokeStyle = i === 0 ? "#ffffff" : "rgba(255,255,255,.7)"; ctx.lineWidth = 1;
      ctx.strokeRect(p.x - 2.5, p.y - 2.5, 6, 6);
    });
    var nm = meta.wavelengths[bandIndex()];
    $("#hsi-band-out").textContent = nm + " nm";
  }

  function pixelAt(ev) {
    var box = view.getBoundingClientRect();
    var x = Math.floor((ev.clientX - box.left) / box.width * size), y = Math.floor((ev.clientY - box.top) / box.height * size);
    return x >= 0 && y >= 0 && x < size && y < size ? { x: x, y: y } : null;
  }
  function spectrumAt(p) {
    // 3x3 average around the pixel, scaled back to reflectance
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

  // ---- spectrum chart --------------------------------------------------------
  var svg = $(".chart"), NS = "http://www.w3.org/2000/svg", W = 640, H = 240, L = 44, R = 16, T = 12, B = 34;
  function el(n, a, t) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); if (t != null) e.textContent = t; return e; }
  function drawChart() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var wl = meta.wavelengths, x0 = wl[0], x1 = wl[wl.length - 1];
    var series = [
      { v: meta.mean.tumour, cls: "s-tumour" },
      { v: meta.mean.other, cls: "s-other" }
    ];
    var px = pinned || hover;
    var pxSpec = px ? spectrumAt(px) : null;
    var diff = root.querySelector('input[name="hsi-chart"]:checked').value === "diff";
    if (diff) series = [{ v: meta.mean.tumour.map(function (v, k) { return v - meta.mean.other[k]; }), cls: "s-tumour" }];
    root.querySelector(".legend").hidden = diff; root.querySelector(".diff-legend").hidden = !diff;
    var all = series.reduce(function (acc, s) { return acc.concat(s.v); }, diff ? [0] : (pxSpec || []));
    var lo, hi;
    if (diff) { var m = Math.max.apply(null, all.map(Math.abs)); hi = Math.ceil(m * 100) / 100; lo = -hi; }
    else { lo = Math.max(0, Math.floor(Math.min.apply(null, all) * 10) / 10); hi = Math.ceil(Math.max.apply(null, all) * 10) / 10; }
    var sx = function (w) { return L + (w - x0) / (x1 - x0) * (W - L - R); };
    var sy = function (v) { return T + (1 - (v - lo) / (hi - lo)) * (H - T - B); };
    for (var i = 0; i <= 4; i++) {
      var v = lo + (hi - lo) * i / 4, y = sy(v);
      svg.appendChild(el("line", { x1: L, x2: W - R, y1: y, y2: y, "class": "gridline" }));
      svg.appendChild(el("text", { x: L - 8, y: y + 4, "text-anchor": "end" }, v.toFixed(diff ? 3 : 2)));
    }
    [450, 500, 550, 600, 650, 700, 750].forEach(function (w) { svg.appendChild(el("text", { x: sx(w), y: H - B + 18, "text-anchor": "middle" }, w)); });
    svg.appendChild(el("text", { x: (L + W - R) / 2, y: H - 2, "text-anchor": "middle" }, "Wavelength (nm)"));
    svg.appendChild(el("line", { x1: L, x2: W - R, y1: H - B, y2: H - B, "class": "axis" }));
    var bx = sx(wl[bandIndex()]);
    svg.appendChild(el("line", { x1: bx, x2: bx, y1: T, y2: H - B, "class": "now" }));
    function path(vals, cls) {
      var d = vals.map(function (v, k) { return (k ? "L" : "M") + sx(wl[k]).toFixed(1) + "," + sy(v).toFixed(1); }).join("");
      svg.appendChild(el("path", { d: d, "class": cls }));
    }
    if (diff) svg.appendChild(el("line", { x1: L, x2: W - R, y1: sy(0), y2: sy(0), "class": "axis" }));
    series.forEach(function (s) { path(s.v, s.cls); });
    if (pxSpec && !diff) path(pxSpec, "s-pixel");
    $(".hsi-readout").textContent = px
      ? (pinned ? "Pinned" : "Pointer") + " pixel (" + px.x + ", " + px.y + "): reflectance " + pxSpec[bandIndex()].toFixed(3) + " at " + wl[bandIndex()] + " nm" + (pinned ? ". Click the image again to unpin." : ". Click to pin it.")
      : "Point at the image to see that pixel's spectrum.";
  }

  function redraw() { drawView(); drawChart(); }

  // ---- wiring ----------------------------------------------------------------
  view.addEventListener("mousemove", function (ev) { hover = pixelAt(ev); redraw(); });
  view.addEventListener("mouseleave", function () { hover = null; redraw(); });
  view.addEventListener("click", function (ev) { var p = pixelAt(ev); pinned = pinned ? null : p; redraw(); });
  ["#hsi-band", "#hsi-mask"].forEach(function (s) { $(s).addEventListener("input", redraw); });
  root.querySelectorAll('input[name="hsi-mode"], input[name="hsi-chart"]').forEach(function (r) { r.addEventListener("change", redraw); });

  fetch(BASE + "meta.json").then(function (r) { return r.json(); }).then(function (m) {
    meta = m; size = m.size; nb = m.wavelengths.length;
    $("#hsi-band").max = nb - 1; $("#hsi-band").value = m.defaultBand;
    var sprite = new Image();
    return Promise.all([loadImage(sprite, BASE + "bands.png"), loadImage(rgbImg, BASE + "rgb.png"), loadImage(maskImg, BASE + "mask.png")])
      .then(function () { bands = unpack(sprite); root.classList.remove("loading"); redraw(); });
  }).catch(function () {
    $(".hsi-readout").textContent = "The image data didn't load. Refresh the page to try again.";
  });
})();
