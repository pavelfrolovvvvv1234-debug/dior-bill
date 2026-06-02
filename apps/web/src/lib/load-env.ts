import { existsSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";

let loaded = false;

/** Load monorepo root `.env` when PM2 starts from apps/web. */
export function loadMonorepoEnv(): void {
  if (loaded) return;

  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../.env"),
    resolve(process.cwd(), "../../.env"),
    resolve(process.cwd(), "../../../.env"),
  ];

  for (const path of candidates) {
    if (existsSync(path)) {
      config({ path, override: false });
      loaded = true;
      return;
    }
  }
}
