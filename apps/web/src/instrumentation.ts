import { loadMonorepoEnv } from "@/lib/load-env";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    loadMonorepoEnv();
  }
}
