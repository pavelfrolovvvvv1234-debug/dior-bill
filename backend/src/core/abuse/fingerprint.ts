import { prisma } from "@dior/database";

/** Records payment fingerprints for analytics only — no risk scoring. */
export async function recordPaymentFingerprint(params: {
  userId: string;
  fingerprintHash: string;
  provider?: string;
  walletHint?: string;
}): Promise<void> {
  await prisma.paymentFingerprint.upsert({
    where: { fingerprintHash: params.fingerprintHash },
    create: {
      userId: params.userId,
      fingerprintHash: params.fingerprintHash,
      provider: params.provider,
      walletHint: params.walletHint,
    },
    update: {
      hitCount: { increment: 1 },
      lastSeenAt: new Date(),
    },
  });
}
