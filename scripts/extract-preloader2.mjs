import fs from "fs";

const html = fs.readFileSync(".dior-host.html", "utf8");
const start = html.indexOf('id="preloader"');
const end = html.indexOf("</div></div></div>", start) + 18;
let chunk = html.slice(start, start + 8000);
// find closing of preloader - count divs
const preloaderEnd = html.indexOf('</div><div class="premium-saas-bg', start);
if (preloaderEnd > start) chunk = html.slice(start, preloaderEnd + 6);
console.log(chunk);

// search JS for timing
for (const pat of ["preloader", "PRELOADER", "minDisplay", "fadeout", "1800", "2000", "2200", "2500", "3000"]) {
  const re = new RegExp(`.{0,60}${pat}.{0,120}`, "g");
  const hits = [...html.matchAll(re)].slice(0, 5);
  if (hits.length) {
    console.log("\n==", pat, "==");
    hits.forEach((h) => console.log(h[0].replace(/\s+/g, " ")));
  }
}

const css = fs.readFileSync(".dior-css1.css", "utf8");
const pi = css.indexOf("progress-line");
console.log("\nprogress css:", css.slice(pi, pi + 800));
