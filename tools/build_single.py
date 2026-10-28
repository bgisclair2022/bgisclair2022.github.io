"""Merge the multi-page portfolio into one self-contained HTML file.

Reads portfolio/*.html + style.css + photo.jpg, writes single/index.html with
inline CSS, the photo as a data URI, and each page as a #section switched by JS.
"""
import base64
import re
import sys
from pathlib import Path

src = Path(sys.argv[1])
out = Path(sys.argv[2])

PAGES = ["index", "projects", "publications", "classes", "personal"]
IDS = {"index": "home", "projects": "projects", "publications": "publications",
       "classes": "classes", "personal": "personal"}

css = (src / "style.css").read_text(encoding="utf-8")
photo = base64.b64encode((src / "photo.jpg").read_bytes()).decode()

def main_of(name):
    html = (src / f"{name}.html").read_text(encoding="utf-8")
    m = re.search(r'<main class="container">(.*?)</main>', html, re.S)
    return m.group(1)

def relink(html):
    html = html.replace('href="personal.html#contact"', 'href="#personal"')
    for name, sid in IDS.items():
        html = html.replace(f'href="{name}.html"', f'href="#{sid}"')
    html = html.replace('src="photo.jpg"', f'src="data:image/jpeg;base64,{photo}"')
    # public copies of the posters, so links work outside the artifact too
    html = html.replace('href="halo.pdf"',
                        'href="https://repository.fit.edu/cgi/viewcontent.cgi?article=1011&amp;context=math_student"')
    return html

sections = "\n".join(
    f'<main class="container page" id="{IDS[n]}">{relink(main_of(n))}</main>' for n in PAGES)

nav = """<nav class="site-nav" aria-label="Site">
  <div class="container">
    <a class="name" href="#home">Blake Gisclair</a>
    <ul>
      <li><a href="#projects">Projects</a></li>
      <li><a href="#publications">Publications</a></li>
      <li><a href="#classes">Classes</a></li>
      <li><a href="#personal">Personal</a></li>
    </ul>
  </div>
</nav>"""

script = """<script>
(function () {
  var pages = Array.prototype.slice.call(document.querySelectorAll(".page"));
  var links = Array.prototype.slice.call(document.querySelectorAll(".site-nav ul a"));
  function show() {
    var id = (location.hash || "#home").slice(1);
    if (!document.getElementById(id) || !document.getElementById(id).classList.contains("page")) id = "home";
    pages.forEach(function (p) { p.hidden = p.id !== id; });
    links.forEach(function (a) {
      if (a.getAttribute("href") === "#" + id) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", show);
  show();
})();
</script>"""

doc = f"""<title>Blake Gisclair</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500&family=Public+Sans:wght@400;500;600&display=swap">
<style>
{css}
.page[hidden] {{ display: none !important; }}
</style>
{nav}
{sections}
<footer class="site-footer">
  <div class="container">
    <span>&copy; 2026 Blake Gisclair</span>
    <span>Melbourne, Florida</span>
  </div>
</footer>
{script}
"""
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(doc, encoding="utf-8")
print(out, len(doc), "chars")
