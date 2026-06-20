/**
 * Retry provisioning for paid VPS stuck in PENDING/FAILED.
 * Usage: DATABASE_URL=... [PROXMOX_*] npx tsx scripts/resume-stuck-vps.ts [userEmail]
 */
import { prisma } from "@dior/database";
import { resumeAllStuckVpsProvisioning } from "../src/core/provisioning/engine";

async function main() {
  const email = process.argv[2];
  if (email) {
    const { resumeStuckVpsProvisioningForUser } = await import("../src/core/provisioning/engine");
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error(`User not found: ${email}`);
    await resumeStuckVpsProvisioningForUser(user.id);
    console.log(`Resumed provisioning for ${email}`);
    return;
  }

  const result = await resumeAllStuckVpsProvisioning();
  console.log(`Processed ${result.usersProcessed} user(s); findings:`, result.findings);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
