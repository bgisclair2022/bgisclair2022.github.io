"""Turn one HMI-LUSC region into the small files the hyperspectral explorer loads.

HMI-LUSC (Yan et al., Sci Data 13:415, 2026; CC BY 4.0) ships each region as an
ENVI cube plus per-patient white/dark references, an RGB image and masks. This
script calibrates to reflectance, crops a square, bins it down, and writes
data/hsi/{bands.png, rgb.png, mask.png, meta.json}. The demo itself is
js/hsi-explorer.js.

Usage:
  python tools/prepare_hsi.py --cube <region .hdr> --white <white .hdr> --dark <dark .hdr>
      --mask <cell mask image> --tumour-color 0,255,0 --other-color 255,0,0 --rgb <rgb image>
      --x0 X --y0 Y --crop 384 --bin 2 --out data/hsi
"""
import argparse
import json
import re
from pathlib import Path

import numpy as np
from PIL import Image

DTYPES = {1: np.uint8, 2: np.int16, 3: np.int32, 4: np.float32, 5: np.float64, 12: np.uint16, 13: np.uint32}


def read_header(hdr):
    text = Path(hdr).read_text(errors="replace")
    fields = {}
    for m in re.finditer(r"^\s*([\w ]+?)\s*=\s*(\{[^}]*\}|[^\n]*)", text, re.M):
        fields[m.group(1).strip().lower()] = m.group(2).strip()
    return fields


def read_envi(hdr):
    """Return (cube as float32 H x W x B, wavelengths or None)."""
    h = read_header(hdr)
    rows, cols, nb = int(h["lines"]), int(h["samples"]), int(h["bands"])
    dt = np.dtype(DTYPES[int(h["data type"])]).newbyteorder(">" if h.get("byte order", "0") == "1" else "<")
    raw = Path(hdr).with_suffix("")
    if not raw.exists():
        cands = [p for p in Path(hdr).parent.glob(Path(hdr).stem + ".*") if p.suffix.lower() != ".hdr"]
        raw = cands[0]
    data = np.fromfile(raw, dtype=dt, offset=int(h.get("header offset", "0")))
    il = h.get("interleave", "bsq").lower()
    shape = {"bsq": (nb, rows, cols), "bil": (rows, nb, cols), "bip": (rows, cols, nb)}[il]
    data = data[: np.prod(shape)].reshape(shape)
    cube = {"bsq": data.transpose(1, 2, 0), "bil": data.transpose(0, 2, 1), "bip": data}[il].astype(np.float32)
    wl = None
    if "wavelength" in h:
        wl = [float(v) for v in h["wavelength"].strip("{}").split(",") if v.strip()]
    return cube, wl


def ref_spectrum(hdr):
    """White/dark references: mean spectrum over the frame (1 x 1 x B)."""
    cube, _ = read_envi(hdr)
    return cube.reshape(-1, cube.shape[-1]).mean(0)[None, None, :]


def bin2d(a, f):
    h, w = a.shape[0] // f * f, a.shape[1] // f * f
    a = a[:h, :w]
    return a.reshape(h // f, f, w // f, f, *a.shape[2:]).mean((1, 3))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cube", required=True, help="ENVI .hdr of the region")
    ap.add_argument("--white", required=True); ap.add_argument("--dark", required=True)
    ap.add_argument("--mask", required=True, help="cell-level mask image")
    ap.add_argument("--tumour-color", required=True, help="mask RGB for tumour cells, e.g. 0,255,0")
    ap.add_argument("--other-color", required=True, help="mask RGB for non-tumour cells, e.g. 255,0,0")
    ap.add_argument("--rgb", required=True)
    ap.add_argument("--x0", type=int, required=True); ap.add_argument("--y0", type=int, required=True)
    ap.add_argument("--crop", type=int, default=384); ap.add_argument("--bin", type=int, default=2)
    ap.add_argument("--out", default="data/hsi")
    a = ap.parse_args()

    cube, wl = read_envi(a.cube)
    white, dark = ref_spectrum(a.white), ref_spectrum(a.dark)
    refl = np.clip((cube - dark) / np.maximum(white - dark, 1e-6), 0, 1.5)
    nb = refl.shape[-1]
    wl = wl or [450 + 5 * i for i in range(nb)]
    rgbmask = np.array(Image.open(a.mask).convert("RGB"))
    if rgbmask.shape[:2] != refl.shape[:2]:
        rgbmask = np.array(Image.fromarray(rgbmask).resize(refl.shape[1::-1], Image.NEAREST))
    # 1 = tumour cell, 2 = non-tumour cell, 0 = anything else
    mask = np.zeros(rgbmask.shape[:2], np.uint8)
    mask[np.all(rgbmask == [int(v) for v in a.tumour_color.split(",")], -1)] = 1
    mask[np.all(rgbmask == [int(v) for v in a.other_color.split(",")], -1)] = 2

    # mean spectra over the WHOLE region, not just the crop
    tum, oth = refl[mask == 1], refl[mask == 2]

    ys, xs = slice(a.y0, a.y0 + a.crop), slice(a.x0, a.x0 + a.crop)
    sub = bin2d(refl[ys, xs], a.bin)
    size = sub.shape[0]
    lo, hi = np.percentile(sub, 0.5, axis=(0, 1)), np.percentile(sub, 99.5, axis=(0, 1))
    q = np.clip((sub - lo) / np.maximum(hi - lo, 1e-6) * 255, 0, 255).round().astype(np.uint8)

    cols = int(np.ceil(np.sqrt(nb)))
    rows = int(np.ceil(nb / cols))
    sprite = np.zeros((rows * size, cols * size), np.uint8)
    for b in range(nb):
        r, c = divmod(b, cols)
        sprite[r * size:(r + 1) * size, c * size:(c + 1) * size] = q[..., b]

    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    Image.fromarray(sprite).save(out / "bands.png", optimize=True)
    rgb = Image.open(a.rgb).convert("RGB")
    if rgb.size != refl.shape[1::-1]: rgb = rgb.resize(refl.shape[1::-1])
    rgb.crop((a.x0, a.y0, a.x0 + a.crop, a.y0 + a.crop)).resize((size, size), Image.LANCZOS).save(out / "rgb.png", optimize=True)
    m = mask[ys, xs][:: a.bin, :: a.bin][:size, :size]
    overlay = np.zeros((size, size, 4), np.uint8)
    overlay[m == 1] = (235, 104, 52, 255)
    Image.fromarray(overlay).save(out / "mask.png", optimize=True)

    meta = {
        "size": size, "cols": cols, "wavelengths": [round(w) for w in wl],
        "defaultBand": int(np.argmin(np.abs(np.array(wl) - 550))),
        "scale": [[float(l), float(h)] for l, h in zip(lo, hi)],
        "mean": {"tumour": [round(float(v), 4) for v in tum.mean(0)], "other": [round(float(v), 4) for v in oth.mean(0)]},
        "counts": {"tumour": int(len(tum)), "other": int(len(oth))},
        "source": "HMI-LUSC (Yan et al., Sci Data 13:415, 2026), CC BY 4.0",
    }
    (out / "meta.json").write_text(json.dumps(meta))
    print("size", size, "bands", nb, "tumour px", len(tum), "other px", len(oth))


if __name__ == "__main__":
    main()
