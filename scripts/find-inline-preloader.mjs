import fs from "fs";

const html = fs.readFileSync(".dior-host.html", "utf8");
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
for (const [i, m] of scripts.entries()) {
  const body = m[1].trim();
  if (!body) continue;
  if (body.includes("preloader") || body.includes("PRELOADER") || body.includes("fadeout")) {
    console.log("INLINE", i, body.slice(0, 2000));
  }
}

// also search for numeric timing near preloader in full html
const idx = html.indexOf("preloader");
const around = html.slice(idx, idx + 15000);
for (const n of [1500, 1800, 2000, 2200, 2500, 2800, 3000, 3500]) {
  if (around.includes(String(n))) console.log("found number", n);
}
