import { loadMonorepoEnv } from "../src/lib/load-env";
import { prisma } from "@dior/database";
import { retryVpsProvisioningForInstance } from "../src/provisioning/retry";

loadMonorepoEnv();

function parseArgs(): { hostname?: string; force: boolean } {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const force = args.includes("--force") || args.includes("-f");
  const hostname = args.find((a) => !a.startsWith("-"))?.trim();
  return { hostname: hostname || undefined, force };
}

async function main() {
  const { hostname, force } = parseArgs();
  const result = await retryVpsProvisioningForInstance({ hostname, force });
  console.log("Done:", result.hostname, "status=", result.status, "ip=", result.ip, "vmid=", result.vmid);
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
