import fs from "fs";

const html = fs.readFileSync(".dior-host.html", "utf8");
const scripts = [...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+)"/g)].map((m) => m[1]);
console.log(scripts.join("\n"));
