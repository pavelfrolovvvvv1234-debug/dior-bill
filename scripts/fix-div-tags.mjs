import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "apps", "web", "src");

function walk(dir) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) walk(p);
    else if (name.name.endsWith(".tsx") || name.name.endsWith(".ts")) {
      let c = readFileSync(p, "utf8");
      if (!c.includes("motion-free")) continue;
      c = c.replaceAll("<motion-free", "<div");
      c = c.replaceAll("</motion-free>", "</div>");
      writeFileSync(p, c);
      console.log("fixed", p);
    }
  }
}

walk(root);
