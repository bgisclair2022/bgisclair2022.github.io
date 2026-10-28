# Blake Gisclair personal website

Plain HTML/CSS site, ready for GitHub Pages (push this folder as the
`bgisclair2022.github.io` repo).

- `index.html` - home page (intro, photo, experience, section tiles)
- `projects.html`, `publications.html`, `classes.html`, `personal.html` - one page per section
- `style.css` - shared styles for every page
- `photo.jpg`, `resume.pdf`, `halo.pdf`, `stochastic-network-resilience.pdf` - linked assets
  (`resume.pdf` has the phone number and clearance removed; the original is in Downloads)
- `tools/build_single.py` - merges all pages into `single-file/index.html`, one
  self-contained file used for the private Claude preview:
  `python tools/build_single.py . single-file/index.html`

Preview locally: `python -m http.server 8766`, then open http://127.0.0.1:8766/
