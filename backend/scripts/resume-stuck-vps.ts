/**
 * Retry provisioning for paid VPS stuck in PENDING/FAILED.
 * Usage: DATABASE_URL=... [PROXMOX_*] npx tsx scripts/resume-stuck-vps.ts [userEmail]
 */
import { prisma } from "@dior/database";
import { resumeStuckVpsProvisioningForUser } from "../src/core/provisioning/engine";

async function main() {
  const email = process.argv[2];
  if (email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error(`User not found: ${email}`);
    await resumeStuckVpsProvisioningForUser(user.id);
    console.log(`Resumed provisioning for ${email}`);
    return;
  }

  const users = await prisma.service.findMany({
    where: { type: "VPS", status: { in: ["PENDING", "FAILED"] } },
    select: { userId: true },
    distinct: ["userId"],
  });
  for (const { userId } of users) {
    await resumeStuckVpsProvisioningForUser(userId);
  }
  console.log(`Processed ${users.length} user(s) with stuck VPS`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
