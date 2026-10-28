# Blake Gisclair personal website

Plain HTML/CSS site, ready for GitHub Pages (push this folder as the
`bgisclair2022.github.io` repo).

- `index.html` - home page (intro, photo, experience, section tiles)
- `projects.html`, `publications.html`, `classes.html`, `personal.html` - one page per section
- `style.css` - shared styles for every page
- `demos.css`, `js/network-sim.js`, `js/ensemble-demo.js` - the two interactive demos on the Projects page
  (threshold-crossing simulator; majority vs. entropy-weighted voting)
- `img/` - project figures (taken from the HALO, SmallSat and stochastic-network posters)
- `js/hsi-explorer.js` + `data/hsi/` - hyperspectral explorer on the Projects page, built from one region of
  the public HMI-LUSC dataset (CC BY 4.0) by `tools/prepare_hsi.py`:
  `python tools/prepare_hsi.py --cube <P10>/LUSC_ROI_1/Raw.hdr --white <P10>/whiteReference.hdr --dark <P10>/darkReference.hdr --mask "<P10>/LUSC_ROI_1/Cell-level Label.png" --tumour-color 0,255,0 --other-color 255,0,0 --rgb <P10>/LUSC_ROI_1/rgb.png --x0 896 --y0 1280 --crop 768 --bin 4 --out data/hsi`
  (P10.zip from https://doi.org/10.6084/m9.figshare.30188080.v1; mask green = tumour cells, red = non-tumour cells)
- `photo.jpg`, `resume.pdf`, `halo.pdf`, `stochastic-network-resilience.pdf` - linked assets
  (`resume.pdf` has the phone number and clearance removed; the original is in Downloads)
- `tools/build_single.py` - merges all pages into `single-file/index.html`, one
  self-contained file used for the private Claude preview:
  `python tools/build_single.py . single-file/index.html`

Preview locally: `python -m http.server 8766`, then open http://127.0.0.1:8766/
