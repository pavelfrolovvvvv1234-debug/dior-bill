import { prisma } from "@dior/database";
import { getWallet, type WalletSnapshot } from "../payments/wallet";

export type BillingOverviewData = {
  wallet: WalletSnapshot;
  invoices: {
    id: string;
    number: string;
    status: string;
    total: unknown;
    createdAt: Date;
  }[];
  transactions: {
    id: string;
    description: string;
    type: string;
    amount: unknown;
    createdAt: Date;
  }[];
};

/** Single parallel fetch for billing home — no invoice line items */
export async function getBillingOverview(userId: string): Promise<BillingOverviewData> {
  const [wallet, invoices, transactions] = await Promise.all([
    getWallet(userId),
    prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        createdAt: true,
      },
    }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        description: true,
        type: true,
        amount: true,
        createdAt: true,
      },
    }),
  ]);

  return { wallet, invoices, transactions };
}
