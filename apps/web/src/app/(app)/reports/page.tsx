"use client";

import * as React from "react";
import Link from "next/link";
import { BarChart3, AlertTriangle, Wallet, PackageCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/display";

interface DashboardData {
  totalCreators: number;
  gifts: {
    requestedThisMonth: number;
    pendingExceptions: number;
    deliveredThisMonth: number;
    report: {
      currencyCode: string;
      currencySymbol: string;
      totalOrders: number;
      orderValue: number;
      averageOrderValue: number;
    };
  };
  credit?: {
    enabled: boolean;
    currencySymbol: string;
    totalOutstanding: number;
    topSpenders: { userId: string; name: string; team: string; balance: number; transactionCount: number }[];
  } | null;
  exceptions?: {
    active: {
      creatorId: string;
      creatorName: string;
      requesterName: string;
      teamName: string;
      statusLabel: string;
      requestedAt: string;
    }[];
  } | null;
  overdueDeliverables: { id: string; title: string; creatorId: string; creatorName: string; dueDate: string }[];
  pipeline: { stageId: string; name: string; count: number }[];
  recentEngagements: { id: string; title: string; creatorId: string; creatorName: string; stageName: string }[];
}

export default function ReportsPage() {
  const [dashboard, setDashboard] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => {
        if (r.ok) return r.json();
        throw new Error(`Request failed: ${r.status}`);
      })
      .then(setDashboard)
      .catch(() => setDashboard(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-40 w-full" />;
  if (!dashboard) return <div>Could not load reports.</div>;

  const fmt = (n: number) =>
    `${dashboard.gifts.report.currencySymbol} ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Pipeline distribution, activity and gifting summaries for your team.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total creators" value={dashboard.totalCreators} />
        <Stat label="Gifts this month" value={dashboard.gifts.requestedThisMonth} />
        <Stat label="Pending exceptions" value={dashboard.gifts.pendingExceptions} warning={dashboard.gifts.pendingExceptions > 0} />
        <Stat label="Overdue deliverables" value={dashboard.overdueDeliverables?.length ?? 0} warning={(dashboard.overdueDeliverables?.length ?? 0) > 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" /> Gifting report
          </CardTitle>
          <CardDescription>
            Order volume and value for your team this month; credit balances reflect delivered-but-unfulfilled orders.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Orders (this month)" value={dashboard.gifts.report.totalOrders} />
            <Stat label="Order value" value={fmt(dashboard.gifts.report.orderValue)} />
            <Stat label="Average order value" value={fmt(dashboard.gifts.report.averageOrderValue)} />
            <Stat label="Delivered this month" value={dashboard.gifts.deliveredThisMonth} />
          </div>
        </CardContent>
      </Card>

      {dashboard.credit && dashboard.credit.enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4" /> Credit balances
            </CardTitle>
            <CardDescription>
              Outstanding gifting spend per user (top {dashboard.credit.topSpenders.length}).{" "}
              <Link href="/credit" className="underline underline-offset-2">
                Open credit account
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {dashboard.credit.topSpenders.map((u) => (
                <li key={u.userId} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.team} · {u.transactionCount} transactions
                    </p>
                  </div>
                  <Badge variant="secondary">{fmt(u.balance)}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {dashboard.exceptions && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" /> Active exception orders
            </CardTitle>
            <CardDescription>Exception orders currently in progress.</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard.exceptions.active.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active exception orders.</p>
            ) : (
              <ul className="space-y-2">
                {dashboard.exceptions.active.map((e) => (
                  <li key={e.creatorId + e.requestedAt} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/creators/${e.creatorId}`} className="hover:underline">
                      {e.creatorName}
                    </Link>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{e.requesterName} · {e.teamName}</span>
                      <Badge variant="secondary">{e.statusLabel}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PackageCheck className="h-4 w-4" /> Deliverables & pipeline
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Pipeline distribution</h3>
            {dashboard.pipeline?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No engagements in the pipeline.</p>
            ) : (
              <ul className="space-y-2">
                {dashboard.pipeline?.map((p) => (
                  <li key={p.stageId} className="flex items-center justify-between text-sm">
                    <span>{p.name}</span>
                    <strong>{p.count}</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Recent engagements</h3>
            {dashboard.recentEngagements?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent engagements.</p>
            ) : (
              <ul className="space-y-2">
                {dashboard.recentEngagements?.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/creators/${e.creatorId}`} className="hover:underline">
                      {e.title}
                    </Link>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{e.creatorName}</span>
                      <Badge variant="outline">{e.stageName}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" /> Overdue deliverables
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dashboard.overdueDeliverables?.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing overdue.</p>
          ) : (
            <ul className="space-y-2">
              {dashboard.overdueDeliverables?.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                  <Link href={`/creators/${d.creatorId}`} className="hover:underline">
                    {d.title} · {d.creatorName}
                  </Link>
                  <span className="text-xs font-medium text-destructive">{formatDate(d.dueDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, warning }: { label: string; value: number | string; warning?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-semibold ${warning ? "text-destructive" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}