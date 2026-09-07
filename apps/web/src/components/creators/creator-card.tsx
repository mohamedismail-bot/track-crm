"use client";

import Link from "next/link";
import { Users, CalendarClock, Flame } from "lucide-react";
import type { Platform } from "@prisma/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  PlatformBadge,
  initials,
  formatFollowerCount,
  formatDate,
  timeAgo,
} from "@/lib/display";

export interface CreatorListItem {
  id: string;
  name: string;
  gender: string | null;
  shopifyRegistered: boolean | null;
  niche: string[];
  followers: number | null;
  engagementRate: number | null;
  platform: Platform | null;
  handle: string | null;
  profileUrl: string | null;
  profiles: { platform: Platform; handle: string; url: string }[];
  city: string | null;
  country: string | null;
  creatorType: string | null;
  owners: { id: string; name: string; teamId: string; teamName: string }[];
  teams: { id: string; name: string }[];
  stage: { id: string; name: string } | null;
  currentEngagementId: string | null;
  canMove: boolean;
  completedAt: string | null;
  nextDeliverable: { id: string; title: string; dueDate: string } | null;
  lastActivityAt: string | null;
  relationship: "owned" | "available" | "same_team" | "other_team" | "none";
  poolStatus: "none" | "same_team" | "company";
  missingRequiredForGifting: string[];
  incompleteData: boolean;
  approvalStatus: "PENDING" | "REJECTED" | null;
  approvalVisible: boolean;
  requestedBy: { id: string; name: string; teamId: string | null } | null;
  reviewComment: string | null;
  createdAt: string;
}

export function relationshipLabel(r: CreatorListItem["relationship"]): string {
  switch (r) {
    case "owned":
      return "Owned";
    case "same_team":
      return "Team";
    case "other_team":
      return "Other team";
    case "available":
      return "Available";
    default:
      return "—";
  }
}

export function poolBadge(c: CreatorListItem) {
  if (c.poolStatus === "company") return <Badge variant="default">Pool · company</Badge>;
  if (c.poolStatus === "same_team") return <Badge variant="secondary">Pool · team</Badge>;
  return null;
}

export function approvalBadge(c: CreatorListItem) {
  if (c.approvalStatus === "PENDING") return <Badge variant="warning">Pending approval</Badge>;
  if (c.approvalStatus === "REJECTED") return <Badge variant="destructive">Rejected</Badge>;
  return null;
}

export function incompleteBadge(c: CreatorListItem) {
  if (c.approvalStatus) return null;
  if (!c.incompleteData) return null;
  return <Badge variant="info">Incomplete data</Badge>;
}

export function CreatorCard({ creator }: { creator: CreatorListItem }) {
  const overdue =
    creator.nextDeliverable && new Date(creator.nextDeliverable.dueDate) < new Date()
      ? true
      : false;

  return (
    <Link
      href={`/creators/${creator.id}`}
      className="group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-10 w-10 ring-1 ring-border">
            <AvatarFallback>{initials(creator.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight group-hover:underline">
              {creator.name}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              {creator.profiles.length ? (
                creator.profiles.map((p) => <PlatformBadge key={`${p.platform}-${p.handle}`} platform={p.platform} />)
              ) : creator.platform ? (
                <PlatformBadge platform={creator.platform} />
              ) : null}
              <span className="truncate text-xs text-muted-foreground">@{creator.handle ?? "—"}</span>
            </div>
          </div>
        </div>
        {creator.stage ? (
          <Badge variant="outline" className="shrink-0">
            {creator.stage.name}
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1">
        {approvalBadge(creator)}
        {incompleteBadge(creator)}
        {creator.shopifyRegistered ? (
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
            Shopify
          </Badge>
        ) : null}
      </div>

      {creator.niche?.length ? (
        <p className="line-clamp-1 text-xs text-muted-foreground">{creator.niche.join(", ")}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {formatFollowerCount(creator.followers)}
        </span>
        {creator.engagementRate != null ? (
          <span className="inline-flex items-center gap-1">
            <Flame className="h-3.5 w-3.5" />
            {creator.engagementRate}% ER
          </span>
        ) : null}
        {creator.nextDeliverable ? (
          <span
            className={
              overdue
                ? "inline-flex items-center gap-1 font-medium text-destructive"
                : "inline-flex items-center gap-1"
            }
          >
            <CalendarClock className="h-3.5 w-3.5" />
            {overdue ? "Overdue " : ""}
            {formatDate(creator.nextDeliverable.dueDate)}
          </span>
        ) : null}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3">
        {creator.owners.length > 0 ? (
          <div className="flex items-center gap-1.5">
            <div className="flex -space-x-2">
              {creator.owners.slice(0, 3).map((o) => (
                <div
                  key={o.id}
                  title={`${o.name} · ${o.teamName}`}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-medium ring-2 ring-card"
                >
                  {initials(o.name).slice(0, 2)}
                </div>
              ))}
            </div>
            {creator.approvalStatus ? (
              <span className="truncate text-[11px] text-muted-foreground">
                Requested by {creator.requestedBy?.name ?? "—"}
              </span>
            ) : null}
          </div>
        ) : creator.approvalStatus ? (
          <span className="text-xs text-muted-foreground">
            Requested by {creator.requestedBy?.name ?? "—"}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Unassigned</span>
        )}
        <span className="text-right text-[11px] leading-tight text-muted-foreground">
          {creator.lastActivityAt ? timeAgo(creator.lastActivityAt) : "No activity"}
        </span>
      </div>
    </Link>
  );
}