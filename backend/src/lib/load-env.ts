import { existsSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";

let loaded = false;

/** Load monorepo root `.env` when PM2 starts from apps/web or apps/api. */
export function loadMonorepoEnv(): void {
  if (loaded) return;

  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../.env"),
    resolve(process.cwd(), "../../.env"),
    resolve(process.cwd(), "../../../.env"),
  ];

  // Load every candidate in order (cwd → monorepo root). Later files override earlier
  // ones so `/var/www/dior-billing/.env` wins over `backend/.env`.
  for (const path of candidates) {
    if (existsSync(path)) {
      config({ path, override: true });
    }
  }
  loaded = true;
}
