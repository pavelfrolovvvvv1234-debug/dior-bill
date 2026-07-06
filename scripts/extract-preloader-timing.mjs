import fs from "fs";

const text = fs.readFileSync(".dior-8167.js", "utf8");
let idx = 0;
while ((idx = text.indexOf("preloader", idx)) !== -1) {
  console.log(text.slice(Math.max(0, idx - 150), idx + 400));
  console.log("\n---\n");
  idx += 9;
}

// extract numbers that look like timeouts
const block = text.slice(text.indexOf("getElementById(\"preloader\")"), text.indexOf("getElementById(\"preloader\")") + 4000);
console.log("BLOCK:\n", block);
const nums = [...block.matchAll(/\b(1[5-9]\d{2}|2\d{3}|3\d{3}|4\d{3}|5\d{2})\b/g)].map((m) => m[1]);
console.log("nums", [...new Set(nums)]);
