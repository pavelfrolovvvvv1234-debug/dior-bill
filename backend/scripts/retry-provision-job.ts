import { loadMonorepoEnv } from "../src/lib/load-env";
import { prisma } from "@dior/database";
import { retryVpsProvisioningForInstance } from "../src/provisioning/retry";

loadMonorepoEnv();

function parseHostnameArg(): string | undefined {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const hostname = args[0]?.trim();
  return hostname || undefined;
}

async function main() {
  const hostname = parseHostnameArg();
  const result = await retryVpsProvisioningForInstance({ hostname });
  console.log("Done:", result.hostname, "status=", result.status, "ip=", result.ip, "vmid=", result.vmid);
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
