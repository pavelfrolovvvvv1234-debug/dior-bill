import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  /** Bumped when schema adds models — invalidates stale hot-reload singletons */
  prismaSchemaStamp?: string;
};

/** Increment when new Prisma models are added (Settings API keys, 2FA, etc.) */
const PRISMA_SCHEMA_STAMP = "promo-redemption-v1";

function createPrismaClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

function isPrismaClientReady(client: PrismaClient) {
  const apiKey = (client as { apiKey?: { findMany?: unknown } }).apiKey;
  return typeof apiKey?.findMany === "function";
}

function getPrisma(): PrismaClient {
  const cached = globalForPrisma.prisma;
  const stampOk = globalForPrisma.prismaSchemaStamp === PRISMA_SCHEMA_STAMP;

  if (cached && stampOk && isPrismaClientReady(cached)) {
    return cached;
  }

  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  globalForPrisma.prismaSchemaStamp = PRISMA_SCHEMA_STAMP;
  return client;
}

export const prisma = getPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
export { prisma as db };
