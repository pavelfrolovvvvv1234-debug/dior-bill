import fs from "fs";
import path from "path";

for (const file of fs.readdirSync(".").filter((f) => f.startsWith(".dior-") && f.endsWith(".js"))) {
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes("preloader")) continue;
  console.log("FILE", file);
  const idx = text.indexOf("preloader");
  console.log(text.slice(Math.max(0, idx - 200), idx + 600));
  console.log("---");
}
