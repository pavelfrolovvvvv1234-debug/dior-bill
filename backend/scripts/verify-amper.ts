/**
 * Verify Amper API connectivity: account, prices, search.
 * Usage: AMPER_API_TOKEN=sk_live_... npx tsx scripts/verify-amper.ts
 */
import { verifyAmperIntegration, getAmperApiBaseUrl } from "../src/amper";

async function main() {
  console.log("Amper API base:", getAmperApiBaseUrl());
  const result = await verifyAmperIntegration();
  console.log("OK — account balance:", result.account.balance);
  console.log("Active TLDs:", result.activeTlds);
  console.log(
    "Sample search:",
    result.sampleSearch.query,
    "→",
    result.sampleSearch.results[0]?.available ? "available" : "taken",
  );
}

main().catch((err) => {
  console.error("Amper verification failed:", err.message ?? err);
  process.exit(1);
});
