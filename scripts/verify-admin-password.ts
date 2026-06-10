import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

function loadEnvFile() {
  for (const envPath of [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.env"),
  ]) {
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] == null) process.env[key] = value;
    }
    break;
  }
}

loadEnvFile();

const email = process.argv[2] ?? "admin@dior.cloud";
const password = process.argv[3];

if (!password) {
  console.error("Usage: tsx scripts/verify-admin-password.ts <email> <password>");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`FAIL: user not found (${email})`);
    process.exit(1);
  }
  if (!user.passwordHash) {
    console.error("FAIL: user has no password hash");
    process.exit(1);
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    console.error(`FAIL: password does not match for ${email}`);
    process.exit(1);
  }

  console.log(`OK: password matches for ${email} (role=${user.role}, status=${user.status})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
