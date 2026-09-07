"use client";

import Link from "next/link";
import { Users, CalendarClock, Flame, AlertTriangle } from "lucide-react";
import type { Platform } from "@prisma/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
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

const PLATFORM_COLORS: Record<string, string> = {
  INSTAGRAM: "#E4405F",
  TIKTOK: "#010101",
  YOUTUBE: "#FF0000",
  X: "#14171A",
  SNAPCHAT: "#FFFC00",
  FACEBOOK: "#1877F2",
  LINKEDIN: "#0A66C2",
  TWITCH: "#9146FF",
  OTHER: "#6b7280",
};

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
  return (
    <Badge variant="destructive" className="gap-1">
      <AlertTriangle className="h-3 w-3" /> Incomplete data
    </Badge>
  );
}

function PlatformIconLink({ platform, url, handle }: { platform: Platform; url: string; handle: string }) {
  const color = PLATFORM_COLORS[platform] ?? "#6b7280";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          title={`Open ${platform.toLowerCase()} profile`}
          aria-label={`${platform} profile of @${handle}`}
          className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold uppercase tracking-wide text-white ring-1 ring-black/10 transition-transform hover:scale-110"
          style={{ backgroundColor: color }}
          onClick={(e) => e.stopPropagation()}
        >
          {platform.slice(0, 1)}
        </a>
      </TooltipTrigger>
      <TooltipContent>
        {platform} · @{handle}
      </TooltipContent>
    </Tooltip>
  );
}

export function CreatorCard({ creator }: { creator: CreatorListItem }) {
  const overdue =
    creator.nextDeliverable && new Date(creator.nextDeliverable.dueDate) < new Date()
      ? true
      : false;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/creators/${creator.id}`} className="flex min-w-0 items-center gap-3">
          <Avatar className="h-10 w-10 ring-1 ring-border">
            <AvatarFallback>{initials(creator.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight group-hover:underline">
              {creator.name}
            </p>
            {!creator.profiles.length ? (
              <span className="text-xs text-muted-foreground">@{creator.handle ?? "—"}</span>
            ) : null}
          </div>
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          {creator.profiles.length ? (
            creator.profiles.map((p) =>
              p.url ? (
                <PlatformIconLink key={`${p.platform}-${p.handle}`} platform={p.platform} url={p.url} handle={p.handle} />
              ) : (
                <PlatformBadge key={`${p.platform}-${p.handle}`} platform={p.platform} />
              ),
            )
          ) : creator.platform ? (
            <PlatformBadge platform={creator.platform} />
          ) : null}
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
                <Tooltip key={o.id}>
                  <TooltipTrigger asChild>
                    <Link
                      href={`/creators?owner=${o.id}`}
                      title={`${o.name} · ${o.teamName}`}
                      aria-label={`Filter by owner ${o.name}`}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-secondary-foreground ring-2 ring-card transition-colors hover:bg-primary hover:text-primary-foreground"
                    >
                      {initials(o.name).slice(0, 2)}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    {o.name} · {o.teamName}
                  </TooltipContent>
                </Tooltip>
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
      </div>
    </TooltipProvider>
  );
}