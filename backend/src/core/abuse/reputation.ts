import { prisma } from "@dior/database";

export async function scoreIpReputation(ip: string): Promise<{
  score: number;
  blocked: boolean;
  asn?: string;
}> {
  const parts = ip.split(".");
  const asnGuess = parts.length >= 2 ? `AS-${parts[0]}.${parts[1]}` : "AS-unknown";

  const record = await prisma.asnReputation.findUnique({ where: { asn: asnGuess } });
  if (record) {
    return { score: record.score, blocked: record.blocked, asn: asnGuess };
  }

  return { score: 50, blocked: false, asn: asnGuess };
}

export async function upsertAsnReputation(
  asn: string,
  score: number,
  blocked = false,
): Promise<void> {
  await prisma.asnReputation.upsert({
    where: { asn },
    create: { asn, score, blocked },
    update: { score, blocked },
  });
}
