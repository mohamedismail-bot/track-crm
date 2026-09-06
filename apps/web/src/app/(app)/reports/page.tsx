"use client";

import * as React from "react";
import Link from "next/link";
import { BarChart3, AlertTriangle } from "lucide-react";
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
  giftsThisMonth: number;
  exceptionsPending: number;
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
        <Stat label="Gifts this month" value={dashboard.giftsThisMonth} />
        <Stat label="Pending exceptions" value={dashboard.exceptionsPending} warning={dashboard.exceptionsPending > 0} />
        <Stat label="Overdue deliverables" value={dashboard.overdueDeliverables?.length ?? 0} warning={(dashboard.overdueDeliverables?.length ?? 0) > 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" /> Pipeline distribution
          </CardTitle>
          <CardDescription>Engagements currently in each stage.</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent engagements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {dashboard.recentEngagements?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent engagements.</p>
          ) : (
            dashboard.recentEngagements?.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 text-sm">
                <Link href={`/creators/${e.creatorId}`} className="hover:underline">
                  {e.title}
                </Link>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{e.creatorName}</span>
                  <Badge variant="outline">{e.stageName}</Badge>
                </div>
              </div>
            ))
          )}
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

function Stat({ label, value, warning }: { label: string; value: number; warning?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-semibold ${warning ? "text-destructive" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}