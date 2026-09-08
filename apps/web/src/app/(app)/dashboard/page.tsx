"use client";

import * as React from "react";
import Link from "next/link";
import {
  Users,
  Package,
  AlertTriangle,
  ArrowRight,
  Gauge,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Truck,
  PackageCheck,
  UserCircle2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, initials, isOverdue } from "@/lib/display";
import { GIFT_STATUS_KEYS } from "@/lib/constants";

interface DashboardData {
  role: { roleSlug: string; isWarehouse: boolean; canApprove: boolean; canFulfill: boolean };
  totalCreators: number;
  myCreators: number;
  overdueDeliverables: { id: string; title: string; dueDate: string; creatorId: string; creatorName: string }[];
  upcomingDeliverables: { id: string; title: string; dueDate: string; creatorId: string; creatorName: string }[];
  recentEngagements: { id: string; title: string; creatorId: string; creatorName: string; stageName: string; teamName: string; updatedAt: string }[];
  gifts: {
    requestedThisMonth: number;
    pendingApproval: number;
    pendingExceptions: number;
    queuedForDispatch: number;
    dispatchedThisMonth: number;
    deliveredThisMonth: number;
    topGiftedCreators: { creatorId: string; name: string; count: number }[];
    recent: {
      id: string;
      productName: string;
      status: string;
      isException: boolean;
      requestedAt: string;
      creatorId: string;
      creatorName: string;
      teamName: string;
    }[];
  };
  pipeline: { stageId: string; name: string; count: number }[];
  leaderboard: { userId: string; name: string; creators: number }[];
  myCreatorsDetail: { id: string; name: string; handle: string | null }[];
}

function giftCounts(recent: DashboardData["gifts"]["recent"]) {
  const pending = recent.filter((g) => g.status === GIFT_STATUS_KEYS.PENDING_MANAGER);
  const queued = recent.filter((g) => g.status === GIFT_STATUS_KEYS.APPROVED);
  return { pending, queued };
}

export default function DashboardPage() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => {
        if (r.ok) return r.json();
        throw new Error(`Request failed: ${r.status}`);
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (!data) return <div>Could not load dashboard</div>;

  const isWarehouse = data.role.isWarehouse;
  const totalPipeline = data.pipeline.reduce((s, p) => s + p.count, 0);
  const toggle = (key: string) => setOpenSections((m) => ({ ...m, [key]: !m[key] }));

  const { pending: recentPendingGifts, queued: recentQueuedGifts } = giftCounts(data.gifts.recent);
  const warehouseFocus = isWarehouse || data.role.canFulfill;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {warehouseFocus
            ? "Fulfillment overview — approved gifts to prepare and dispatch."
            : "Your team at a glance. Click any stat for details."}
        </p>
      </div>

      {isWarehouse ? (
        // ---------------- Warehouse / fulfillment view ----------------
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Gifting & fulfillment
            </h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard icon={<ClipboardCheck className="h-4 w-4" />} label="Pending approval" value={data.gifts.pendingApproval}
                href="/gifting?tab=pending" expanded={openSections.pending} onToggle={() => toggle("pending")}>
                <DetailList items={recentPendingGifts.map((g) => ({
                  href: `/creators/${g.creatorId}`, primary: g.productName,
                  secondary: `${g.creatorName} · ${g.teamName}`, badge: g.isException ? "Exception" : null,
                }))} emptyText="No gifts waiting for approval." href="/gifting?tab=pending" />
              </StatCard>
              <StatCard icon={<Package className="h-4 w-4" />} label="Queued for dispatch" value={data.gifts.queuedForDispatch}
                href="/gifting?tab=warehouse" expanded={openSections.queued} onToggle={() => toggle("queued")}>
                <DetailList items={recentQueuedGifts.map((g) => ({
                  href: `/creators/${g.creatorId}`, primary: g.productName,
                  secondary: `${g.creatorName} · ${g.teamName}`,
                }))} emptyText="Nothing in the warehouse queue." href="/gifting?tab=warehouse" />
              </StatCard>
              <StatCard icon={<Truck className="h-4 w-4" />} label="Dispatched this month" value={data.gifts.dispatchedThisMonth}
                href="/gifting?tab=warehouse" expanded={openSections.dispatched} onToggle={() => toggle("dispatched")}>
                <DetailList items={data.gifts.recent.filter((g) => g.status === GIFT_STATUS_KEYS.SHIPPED).map((g) => ({
                  href: `/creators/${g.creatorId}`, primary: g.productName,
                  secondary: `${g.creatorName} · ${g.teamName}`,
                }))} emptyText="No gifts dispatched this month." href="/gifting?tab=warehouse" />
              </StatCard>
              <StatCard icon={<PackageCheck className="h-4 w-4" />} label="Delivered this month" value={data.gifts.deliveredThisMonth}
                href="/gifting?tab=history" expanded={openSections.delivered} onToggle={() => toggle("delivered")}>
                <DetailList items={data.gifts.recent.filter((g) => g.status === GIFT_STATUS_KEYS.DELIVERED).map((g) => ({
                  href: `/creators/${g.creatorId}`, primary: g.productName,
                  secondary: `${g.creatorName} · ${g.teamName}`,
                }))} emptyText="No gifts delivered this month." href="/gifting?tab=history" />
              </StatCard>
            </div>
          </section>

          <TopGiftedCard creators={data.gifts.topGiftedCreators} />
        </>
      ) : (
        // ---------------- Leader / manager / admin view ----------------
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Creators
            </h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard icon={<Users className="h-4 w-4" />} label="Total creators" value={data.totalCreators} href="/creators" />
              <StatCard icon={<Gauge className="h-4 w-4" />} label="Owned by me" value={data.myCreators}
                href="/creators?owner=me" expanded={openSections.mine} onToggle={() => toggle("mine")}>
                <DetailList items={data.myCreatorsDetail.map((c) => ({
                  href: `/creators/${c.id}`, primary: c.name,
                  secondary: c.handle ? `@${c.handle}` : null,
                }))} emptyText="No creators assigned to you yet." href="/creators" />
              </StatCard>
              <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Overdue deliverables" value={data.overdueDeliverables.length}
                warning={data.overdueDeliverables.length > 0} href="/creators?overdue=1"
                expanded={openSections.overdue} onToggle={() => toggle("overdue")}>
                <DetailList items={data.overdueDeliverables.map((d) => ({
                  href: `/creators/${d.creatorId}`, primary: d.title,
                  secondary: d.creatorName, right: formatDate(d.dueDate),
                }))} emptyText="Nothing overdue — great work." href="/creators?overdue=1" />
              </StatCard>
              <StatCard icon={<Package className="h-4 w-4" />} label="Gifts requested this month" value={data.gifts.requestedThisMonth}
                href="/gifting?tab=pending" expanded={openSections.gifts} onToggle={() => toggle("gifts")}>
                <DetailList items={data.gifts.recent.slice(0, 8).map((g) => ({
                  href: `/creators/${g.creatorId}`, primary: g.productName,
                  secondary: `${g.creatorName} · ${g.teamName}`, badge: g.isException ? "Exception" : null,
                }))} emptyText="No gifts requested this month." href="/gifting" />
              </StatCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base">My creators</CardTitle>
                  <Button asChild variant="ghost" size="sm"><Link href="/creators">View all <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
                </CardHeader>
                <CardContent>
                  {data.myCreatorsDetail.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No creators assigned to you yet.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {data.myCreatorsDetail.slice(0, 6).map((c) => (
                        <li key={c.id}>
                          <Link href={`/creators/${c.id}`} className="flex items-center gap-2 text-sm hover:underline">
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

              <PipelineCard pipeline={data.pipeline} total={totalPipeline} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Gifting
            </h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard icon={<ClipboardCheck className="h-4 w-4" />} label="Pending approval"
                value={data.gifts.pendingApproval}
                warning={data.gifts.pendingApproval > 0}
                href="/gifting?tab=pending" expanded={openSections.gPending} onToggle={() => toggle("gPending")}>
                <DetailList items={recentPendingGifts.map((g) => ({
                  href: `/creators/${g.creatorId}`, primary: g.productName,
                  secondary: `${g.creatorName} · ${g.teamName}`, badge: g.isException ? "Exception" : null,
                }))} emptyText="No gifts waiting for approval." href="/gifting?tab=pending" />
              </StatCard>
              <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Exception requests"
                value={data.gifts.pendingExceptions}
                warning={data.gifts.pendingExceptions > 0}
                href="/gifting?tab=pending" expanded={openSections.gExceptions} onToggle={() => toggle("gExceptions")}>
                <DetailList items={data.gifts.recent.filter((g) => g.isException && g.status === GIFT_STATUS_KEYS.PENDING_MANAGER).map((g) => ({
                  href: `/creators/${g.creatorId}`, primary: g.productName,
                  secondary: `${g.creatorName} · ${g.teamName}`,
                }))} emptyText="No exception requests pending." href="/gifting?tab=pending" />
              </StatCard>
              <StatCard icon={<Package className="h-4 w-4" />} label="Queued for dispatch" value={data.gifts.queuedForDispatch}
                href="/gifting?tab=warehouse" expanded={openSections.gQueued} onToggle={() => toggle("gQueued")}>
                <DetailList items={recentQueuedGifts.map((g) => ({
                  href: `/creators/${g.creatorId}`, primary: g.productName,
                  secondary: `${g.creatorName} · ${g.teamName}`,
                }))} emptyText="Nothing in the warehouse queue." href="/gifting?tab=warehouse" />
              </StatCard>
              <StatCard icon={<PackageCheck className="h-4 w-4" />} label="Delivered this month" value={data.gifts.deliveredThisMonth}
                href="/gifting?tab=history" expanded={openSections.gDelivered} onToggle={() => toggle("gDelivered")}>
                <DetailList items={data.gifts.recent.filter((g) => g.status === GIFT_STATUS_KEYS.DELIVERED).map((g) => ({
                  href: `/creators/${g.creatorId}`, primary: g.productName,
                  secondary: `${g.creatorName} · ${g.teamName}`,
                }))} emptyText="No gifts delivered this month." href="/gifting?tab=history" />
              </StatCard>
            </div>

            <TopGiftedCard creators={data.gifts.topGiftedCreators} />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Deliverables
            </h2>
            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base">Overdue</CardTitle>
                  <Button asChild variant="ghost" size="sm"><Link href="/creators?overdue=1">Open <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
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
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base">Upcoming</CardTitle>
                  <Button asChild variant="ghost" size="sm"><Link href="/creators?upcoming=1">Open <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
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
                          <span className={`text-xs ${isOverdue(d.dueDate, "PENDING") ? "text-destructive font-medium" : "text-muted-foreground"}`}>
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
                          <Link href={`/creators?owner=${l.userId}`} className="hover:underline">
                            <UserCircle2 className="mr-1 inline h-3.5 w-3.5 text-muted-foreground" />
                            {l.name}
                          </Link>
                          <Badge variant="secondary">{l.creators} creators</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function TopGiftedCard({ creators }: { creators: { creatorId: string; name: string; count: number }[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Top gifted creators <span className="ml-1 text-xs font-normal text-muted-foreground">(last 90 days)</span></CardTitle>
        <Button asChild variant="ghost" size="sm"><Link href="/gifting">Open <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
      </CardHeader>
      <CardContent>
        {creators.length === 0 ? (
          <p className="text-sm text-muted-foreground">No gift activity yet.</p>
        ) : (
          <ul className="space-y-2">
            {creators.map((c) => (
              <li key={c.creatorId} className="flex items-center justify-between text-sm">
                <Link href={`/creators/${c.creatorId}`} className="hover:underline">{c.name}</Link>
                <Badge variant="secondary">{c.count} {c.count === 1 ? "gift" : "gifts"}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PipelineCard({ pipeline, total }: { pipeline: { stageId: string; name: string; count: number }[]; total: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pipeline</CardTitle>
        <CardDescription>Click a stage to view its creators.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">No engagements in the pipeline.</p>
        ) : (
          pipeline.map((p) => (
            <Link key={p.stageId} href={`/creators?stage=${p.stageId}`} className="flex items-center gap-2 text-sm rounded-md px-1 py-0.5 hover:bg-accent hover:no-underline">
              <span className="w-28 truncate">{p.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(p.count / total) * 100}%` }} />
              </div>
              <Badge variant="secondary" className="px-1.5">{p.count}</Badge>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({
  icon,
  label,
  value,
  warning,
  href,
  expanded,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  warning?: boolean;
  href: string;
  expanded?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
}) {
  const expandable = Boolean(onToggle && children);
  return (
    <Card className={expandable ? "overflow-hidden" : ""}>
      <Link href={href} className="group block">
        <CardContent className="pt-5 pb-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            {icon}
            <span className="text-xs">{label}</span>
            {expandable ? (
              <span className="ml-auto text-muted-foreground/60 group-hover:text-foreground">
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            ) : null}
          </div>
          <p className={`mt-2 text-2xl font-semibold ${warning ? "text-destructive" : ""}`}>{value}</p>
        </CardContent>
      </Link>
      {expandable && onToggle ? (
        <>
          <div className="px-4 pb-2">
            <Button variant="ghost" size="sm" className="h-6 px-1 text-xs text-muted-foreground" onClick={onToggle}>
              <ChevronDown className={`mr-1 h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
              {expanded ? "Hide details" : "Show details"}
            </Button>
          </div>
          {expanded ? <div className="border-t px-4 py-3">{children}</div> : null}
        </>
      ) : null}
    </Card>
  );
}

function DetailList({
  items,
  emptyText,
  href,
}: {
  items: { href: string; primary: string; secondary?: string | null; right?: string; badge?: string | null }[];
  emptyText: string;
  href: string;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{emptyText}</p>
        <Button asChild variant="outline" size="sm"><Link href={href}>Open list <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
      </div>
    );
  }
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex items-center gap-2 text-sm">
          <Link href={it.href} className="min-w-0 flex-1 truncate hover:underline">
            {it.primary}
            {it.secondary ? <span className="text-xs text-muted-foreground"> · {it.secondary}</span> : null}
          </Link>
          {it.badge ? <Badge variant="secondary" className="shrink-0">Exception</Badge> : null}
          {it.right ? <span className="shrink-0 text-xs text-muted-foreground">{it.right}</span> : null}
        </li>
      ))}
      <li>
        <Button asChild variant="outline" size="sm"><Link href={href}>Open full list <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
      </li>
    </ul>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-56 lg:col-span-2" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}