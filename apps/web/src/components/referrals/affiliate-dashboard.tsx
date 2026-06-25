import { Panel } from "@/components/ui/enterprise/panel";
import { Badge } from "@/components/ui/badge";
import { ReferralCopy } from "@/app/(dashboard)/referrals/referral-copy";
import { cn, formatMoney } from "@/lib/utils";
import { LocalDateTime } from "@/components/ui/local-datetime";

type ReferralRow = {
  id: string;
  email: string | null;
  telegramUsername: string | null;
  displayName: string | null;
  createdAt: Date;
  totalEarned: number;
};

type EarningRow = {
  id: string;
  createdAt: Date;
  amount: unknown;
  description: string;
  sourceUser: {
    id: string;
    email: string | null;
    displayName: string | null;
  };
};

type PayoutRow = {
  id: string;
  status: string;
  createdAt: Date;
  amount: unknown;
  method: string;
};

type TierRow = {
  id: string;
  name: string;
  percent: unknown;
  minReferrals: number;
  minEarnings: unknown;
};

type AffiliateDashboardProps = {
  referralCode: string;
  referralLink: string;
  tier: TierRow | null;
  percent: number;
  totalEarnings: number;
  referralCount: number;
  referrals: ReferralRow[];
  recentEarnings: EarningRow[];
  payouts: PayoutRow[];
  tiers: TierRow[];
};

function payoutReserved(payouts: PayoutRow[]) {
  return payouts
    .filter((p) => ["PENDING", "APPROVED", "PAID"].includes(p.status))
    .reduce((sum, p) => sum + Number(p.amount), 0);
}

function resolveCurrentTierIndex(tiers: TierRow[], tier: TierRow | null, referralCount: number) {
  const sorted = [...tiers].sort((a, b) => a.minReferrals - b.minReferrals);
  if (tier) {
    const idx = sorted.findIndex((t) => t.id === tier.id);
    if (idx >= 0) return idx;
  }
  let idx = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (referralCount >= sorted[i].minReferrals) idx = i;
  }
  return idx;
}

function displayReferralName(row: ReferralRow) {
  return row.displayName ?? row.email ?? (row.telegramUsername ? `@${row.telegramUsername}` : "User");
}

function displaySourceName(row: EarningRow) {
  return row.sourceUser.displayName ?? row.sourceUser.email ?? "Referral payment";
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 px-5 py-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function AffiliateDashboard({
  referralCode,
  referralLink,
  tier,
  percent,
  totalEarnings,
  referralCount,
  referrals,
  recentEarnings,
  payouts,
  tiers,
}: AffiliateDashboardProps) {
  const sortedTiers = [...tiers].sort((a, b) => a.minReferrals - b.minReferrals);
  const reserved = payoutReserved(payouts);
  const available = Math.max(0, totalEarnings - reserved);
  const pendingCount = payouts.filter((p) => p.status === "PENDING").length;

  const currentTierIndex = resolveCurrentTierIndex(sortedTiers, tier, referralCount);
  const currentTier = sortedTiers[currentTierIndex] ?? null;
  const nextTier = sortedTiers[currentTierIndex + 1] ?? null;
  const tierName = currentTier?.name ?? tier?.name ?? "Starter";

  const nextTarget = nextTier ? Math.max(nextTier.minReferrals, 1) : 0;
  const tierProgress = nextTier
    ? Math.min(100, Math.round((referralCount / nextTarget) * 100))
    : 100;
  const refsToNext = nextTier ? Math.max(0, nextTier.minReferrals - referralCount) : 0;

  return (
    <div className="space-y-6">
      <Panel noPadding>
        <div className="grid divide-y divide-border sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
          <Metric label="Total earnings" value={formatMoney(totalEarnings)} hint="All-time commissions" />
          <Metric
            label="Available"
            value={formatMoney(available)}
            hint={pendingCount > 0 ? `${pendingCount} payout pending` : "Credited to wallet"}
          />
          <Metric label="Referrals" value={String(referralCount)} hint="Registered users" />
          <Metric label="Commission" value={`${percent}%`} hint={`${tierName} tier`} />
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Referral link" description="New users who register through this link count as your referrals">
            <ReferralCopy link={referralLink} code={referralCode} />
          </Panel>

          <Panel
            title="Referrals"
            description={referralCount > 0 ? `${referralCount} users` : undefined}
            noPadding
          >
            {referrals.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm font-medium">No referrals yet</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  Share your link. When someone registers and pays, they appear here with earnings from that user.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {referrals.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 data-row-hover"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{displayReferralName(r)}</p>
                      <p className="text-xs text-muted-foreground">Joined <LocalDateTime value={r.createdAt} /></p>
                    </div>
                    <p className="shrink-0 font-mono text-sm tabular-nums text-success">
                      +{formatMoney(r.totalEarned)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {recentEarnings.length > 0 ? (
            <Panel title="Recent commissions" description="Latest referral payouts" noPadding>
              <div className="divide-y divide-border">
                {recentEarnings.slice(0, 8).map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{displaySourceName(e)}</p>
                      <p className="text-xs text-muted-foreground"><LocalDateTime value={e.createdAt} /></p>
                    </div>
                    <span className="shrink-0 font-mono text-sm tabular-nums text-success">
                      +{formatMoney(Number(e.amount))}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}
        </div>

        <div className="space-y-6">
          <Panel title="Commission tiers">
            <div className="space-y-3">
              {nextTier ? (
                <div className="rounded-md border border-border bg-muted/20 px-3 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress to {nextTier.name}</span>
                    <span className="font-medium tabular-nums">{tierProgress}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                      style={{ width: `${tierProgress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {refsToNext > 0
                      ? `${refsToNext} more referral${refsToNext === 1 ? "" : "s"} for ${Number(nextTier.percent)}%`
                      : `Reach ${formatMoney(Number(nextTier.minEarnings))} total earnings for ${nextTier.name}`}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">You are on the highest tier ({percent}%).</p>
              )}

              <div className="space-y-1">
                {sortedTiers.map((t, index) => {
                  const active = index === currentTierIndex;
                  return (
                    <div
                      key={t.id}
                      className={cn(
                        "flex items-center justify-between rounded-md border px-3 py-2 text-sm",
                        active ? "border-primary/40 bg-primary/5" : "border-transparent",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{t.name}</span>
                        {active ? (
                          <Badge variant="outline" className="h-5 border-primary/30 px-1.5 text-[10px] text-primary">
                            Current
                          </Badge>
                        ) : null}
                      </div>
                      <span className="tabular-nums text-muted-foreground">
                        {Number(t.percent)}% · {t.minReferrals}+ refs
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Panel>

          {payouts.length > 0 ? (
            <Panel title="Payouts" description="Withdrawal requests">
              <div className="space-y-2">
                {payouts.slice(0, 6).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium tabular-nums">{formatMoney(Number(p.amount))}</p>
                      <p className="truncate text-xs capitalize text-muted-foreground">
                        {p.method} · <LocalDateTime value={p.createdAt} />
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 capitalize",
                        p.status === "PAID" && "border-success/40 text-success",
                        p.status === "PENDING" && "border-warning/40 text-warning",
                        p.status === "REJECTED" && "border-destructive/40 text-destructive",
                      )}
                    >
                      {p.status.toLowerCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}

          <Panel title="How it works">
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="font-mono text-xs text-foreground/70">1</span>
                <span>Share your referral link or code.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-xs text-foreground/70">2</span>
                <span>User registers and pays for services or top-ups.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-xs text-foreground/70">3</span>
                <span>Commission is added to your wallet balance automatically.</span>
              </li>
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  );
}
