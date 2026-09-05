"use client";

import * as React from "react";
import Link from "next/link";
import { Users, Package, AlertTriangle, ArrowRight, Gauge } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatDate, initials, isOverdue } from "@/lib/display";

interface DashboardData {
  totalCreators: number;
  myCreators: number;
  overdueDeliverables: { id: string; title: string; dueDate: string; creatorId: string; creatorName: string }[];
  upcomingDeliverables: { id: string; title: string; dueDate: string; creatorId: string; creatorName: string }[];
  recentEngagements: { id: string; title: string; creatorId: string; creatorName: string; stageName: string; teamName: string; updatedAt: string }[];
  giftsThisMonth: number;
  exceptionsPending: number;
  pipeline: { stageId: string; name: string; count: number }[];
  leaderboard: { userId: string; name: string; creators: number }[];
  myCreatorsDetail: { id: string; name: string; handle: string | null; avatarUrl: string | null }[];
}

export default function DashboardPage() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (!data) return <div>Could not load dashboard</div>;

  const totalPipeline = data.pipeline.reduce((s, p) => s + p.count, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your team at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<Users className="h-4 w-4" />} label="Total creators" value={data.totalCreators} />
        <StatCard icon={<Gauge className="h-4 w-4" />} label="Owned by me" value={data.myCreators} />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Overdue deliverables"
          value={data.overdueDeliverables.length}
          warning={data.overdueDeliverables.length > 0}
        />
        <StatCard icon={<Package className="h-4 w-4" />} label="Gifts this month" value={data.giftsThisMonth} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">My creators</CardTitle>
            <CardDescription>Creators you directly work with.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.myCreatorsDetail.length === 0 ? (
              <p className="text-sm text-muted-foreground">No creators assigned to you yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {data.myCreatorsDetail.slice(0, 6).map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/creators/${c.id}`}
                      className="flex items-center gap-2 text-sm hover:underline"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[10px] font-medium">
                        {initials(c.name)}
                      </span>
                      {c.name}
                      {c.handle ? <span className="text-xs text-muted-foreground">@{c.handle}</span> : null}
                      <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {totalPipeline === 0 ? (
              <p className="text-sm text-muted-foreground">No engagements in the pipeline.</p>
            ) : (
              data.pipeline.map((p) => (
                <div key={p.stageId} className="flex items-center gap-2 text-sm">
                  <span className="w-28 truncate">{p.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${totalPipeline ? (p.count / totalPipeline) * 100 : 0}%` }}
                    />
                  </div>
                  <Badge variant="secondary" className="px-1.5">{p.count}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overdue</CardTitle>
            <CardDescription>Deliverables past their due date.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.overdueDeliverables.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing overdue — great work.</p>
            ) : (
              <ul className="space-y-2">
                {data.overdueDeliverables.map((d) => (
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming</CardTitle>
            <CardDescription>Due within the next 7 days.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.upcomingDeliverables.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deliverables due this week.</p>
            ) : (
              <ul className="space-y-2">
                {data.upcomingDeliverables.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/creators/${d.creatorId}`} className="hover:underline">
                      {d.title} · {d.creatorName}
                    </Link>
                    <span
                      className={`text-xs ${isOverdue(d.dueDate, "PENDING") ? "text-destructive font-medium" : "text-muted-foreground"}`}
                    >
                      {formatDate(d.dueDate)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent engagements</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentEngagements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent engagements.</p>
            ) : (
              <ul className="space-y-2">
                {data.recentEngagements.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/creators/${e.creatorId}`} className="hover:underline">
                      {e.title} · {e.creatorName}
                    </Link>
                    <Badge variant="outline" className="shrink-0">{e.stageName}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top owners</CardTitle>
          </CardHeader>
          <CardContent>
            {data.leaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground">No ownership data.</p>
            ) : (
              <ul className="space-y-2">
                {data.leaderboard.slice(0, 5).map((l) => (
                  <li key={l.userId} className="flex items-center justify-between text-sm">
                    <span>{l.name}</span>
                    <Badge variant="secondary">{l.creators} creators</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  warning,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-xs">{label}</span>
        </div>
        <p className={`mt-2 text-2xl font-semibold ${warning ? "text-destructive" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-56 lg:col-span-2" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}