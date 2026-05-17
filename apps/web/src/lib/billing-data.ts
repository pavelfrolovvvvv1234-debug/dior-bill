import { cache } from "react";
import { getBillingOverview, getTopUpById, getUserLedger, getWallet } from "@dior/backend";

export const getBillingOverviewCached = cache((userId: string) => getBillingOverview(userId));

export const getWalletCached = cache((userId: string) => getWallet(userId));

export const getUserLedgerCached = cache(
  (userId: string, page: number, search: string | undefined) =>
    getUserLedger(userId, { page, search }),
);

export const getTopUpByIdCached = cache((topUpId: string, userId: string) =>
  getTopUpById(topUpId, userId),
);
