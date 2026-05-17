import { Header } from "@/components/layout/header";
import { requireSession } from "@/lib/auth";
import { getReferralDashboard } from "@dior/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, formatDate } from "@/lib/utils";
import { ReferralCopy } from "./referral-copy";

export default async function ReferralsPage() {
  const session = await requireSession();
  const data = await getReferralDashboard(session.user.id);

  return (
    <>
      <Header title="Affiliate" description="Referral program & earnings" user={session.user} />
      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="glass stat-glow">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Total earnings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{formatMoney(data.totalEarnings)}</p>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Referrals</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{data.referralCount}</p>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Commission</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{data.percent}%</p>
            </CardContent>
          </Card>
        </div>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Your referral link</CardTitle>
          </CardHeader>
          <CardContent>
            <ReferralCopy link={data.referralLink} code={data.referralCode} />
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Referrals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.referrals.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-border/50 p-4"
              >
                <div>
                  <p className="font-medium">{r.email ?? (r.telegramUsername ? `@${r.telegramUsername}` : "User")}</p>
                  <p className="text-xs text-muted-foreground">Joined {formatDate(r.createdAt)}</p>
                </div>
                <p className="font-mono text-sm text-emerald-500">
                  +{formatMoney(r.totalEarned)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
