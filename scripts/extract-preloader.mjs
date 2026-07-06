import fs from "fs";

const html = fs.readFileSync(".dior-host.html", "utf8");
const start = html.indexOf('id="preloader"');
console.log("=== HTML ===");
console.log(html.slice(start - 50, start + 4000));

for (const file of [".dior-css1.css", ".dior-css2.css"]) {
  if (!fs.existsSync(file)) continue;
  const css = fs.readFileSync(file, "utf8");
  const idx = css.indexOf(".preloader");
  if (idx !== -1) {
    console.log(`\n=== CSS ${file} ===`);
    console.log(css.slice(idx, idx + 2500));
  }
}

const scriptMatches = [...html.matchAll(/preloader[^"'`]{0,80}/gi)];
console.log("\n=== script refs ===");
for (const m of scriptMatches.slice(0, 20)) console.log(m[0]);
