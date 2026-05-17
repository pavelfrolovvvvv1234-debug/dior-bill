/**
 * Generates favicon.ico, PNG sizes, and copies brand assets into apps/web and apps/admin.
 * Run: node scripts/generate-brand-assets.mjs
 */
import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const assetsDir =
  process.env.BRAND_ASSETS_DIR ??
  join(
    process.env.USERPROFILE ?? "",
    ".cursor",
    "projects",
    "c-Users-xd-user-Desktop-dior-web-billing",
    "assets",
  );

const markSrc = join(
  assetsDir,
  "c__Users_xd-user_AppData_Roaming_Cursor_User_workspaceStorage_676bc5248c5e74f502eb6338f47e11b0_images_favicon-38481f16-b5ef-45ec-bb88-0344d72d2af1.png",
);
const brandSrc = join(
  assetsDir,
  "c__Users_xd-user_AppData_Roaming_Cursor_User_workspaceStorage_676bc5248c5e74f502eb6338f47e11b0_images__89B1E951-523A-4AAC-94D4-DB2E52655121_-db85c8bf-f49f-4676-a3f6-2455c320d2e1.png",
);

const targets = [
  join(root, "apps/web/public"),
  join(root, "apps/admin/public"),
];

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function writeSquarePng(input, output, size) {
  await sharp(input)
    .resize(size, size, {
      fit: "contain",
      background: { r: 7, g: 11, b: 20, alpha: 1 },
    })
    .png()
    .toFile(output);
}

async function generateForPublic(publicDir) {
  await ensureDir(publicDir);

  // Always re-encode mark as real PNG (source files are sometimes JPEG mislabeled)
  await sharp(markSrc)
    .resize(256, 256, {
      fit: "contain",
      background: { r: 7, g: 11, b: 20, alpha: 1 },
    })
    .png()
    .toFile(join(publicDir, "logo-mark.png"));

  const sizes = [16, 32, 48, 180, 192, 512];
  for (const size of sizes) {
    await writeSquarePng(markSrc, join(publicDir, `icon-${size}.png`), size);
  }

  const favicon16 = join(publicDir, "favicon-16.png");
  const favicon32 = join(publicDir, "favicon-32.png");
  const favicon48 = join(publicDir, "favicon-48.png");
  await writeSquarePng(markSrc, favicon16, 16);
  await writeSquarePng(markSrc, favicon32, 32);
  await writeSquarePng(markSrc, favicon48, 48);

  const icoBuffer = await pngToIco([favicon16, favicon32, favicon48]);
  await writeFile(join(publicDir, "favicon.ico"), icoBuffer);

  await copyFile(join(publicDir, "icon-32.png"), join(publicDir, "logo-icon.png"));
  await copyFile(join(publicDir, "icon-180.png"), join(publicDir, "apple-touch-icon.png"));
}

async function linkNextAppIcons(appRoot, publicDir) {
  const appDir = join(appRoot, "src", "app");
  await ensureDir(appDir);
  const links = [
    ["favicon.ico", "favicon.ico"],
    ["icon-32.png", "icon.png"],
    ["icon-180.png", "apple-icon.png"],
  ];
  for (const [from, to] of links) {
    await copyFile(join(publicDir, from), join(appDir, to));
  }
}

async function main() {
  for (const publicDir of targets) {
    await generateForPublic(publicDir);
    const appRoot = join(publicDir, "..");
    if (publicDir.includes("apps")) {
      await linkNextAppIcons(appRoot, publicDir);
    }
  }
  console.log("Brand assets generated for web and admin.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
