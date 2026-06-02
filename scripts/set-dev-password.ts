import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const email = process.argv[2] ?? "pavel.frolovmsk@gmail.com";
const password = process.argv[3] ?? "dev123!";

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { email },
    data: { passwordHash: hash, emailVerified: new Date() },
  });
  console.log(`OK: ${email} → password "${password}"`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
