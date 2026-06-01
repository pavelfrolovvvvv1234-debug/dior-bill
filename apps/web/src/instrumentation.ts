import { loadMonorepoEnv } from "@dior/backend";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    loadMonorepoEnv();
  }
}
