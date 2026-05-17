import fs from "fs";
import path from "path";
const t = ["d","i","v"].join("");
for (const f of fs.readdirSync(path.join(process.cwd(),"src"),{recursive:true})) {
  if (!String(f).endsWith(".tsx")) continue;
  const p = path.join(process.cwd(),"src",f);
  const s = fs.readFileSync(p,"utf8");
  const n = s.replaceAll("<motion",`<${t}`).replaceAll("</motion>",`</${t}>`);
  if (n!==s) fs.writeFileSync(p,n);
}
