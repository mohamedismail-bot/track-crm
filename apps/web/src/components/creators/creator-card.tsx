"use client";

import * as React from "react";
import Link from "next/link";
import { Users, CalendarClock, Flame, AlertTriangle, ExternalLink, ChevronDown } from "lucide-react";
import type { Platform } from "@prisma/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import {
  PlatformLogoBadge,
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
  return (
    <Badge variant="destructive" className="gap-1">
      <AlertTriangle className="h-3 w-3" /> Incomplete data
    </Badge>
  );
}

export function StageDropdown({
  creator,
  onStageChanged,
}: {
  creator: CreatorListItem;
  onStageChanged: (name: string) => void;
}) {
  const [stages, setStages] = React.useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = React.useState(false);

  const loadStages = async () => {
    if (stages.length > 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/creators/options");
      if (res.ok) {
        const d = await res.json();
        setStages(d.stages ?? []);
      }
    } catch {}
    setLoading(false);
  };

  const moveStage = async (targetStageId: string) => {
    if (!creator.currentEngagementId) return;
    try {
      const res = await fetch(`/api/engagements/${creator.currentEngagementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "move-stage", stageId: targetStageId }),
      });
      const data = await res.json();
      if (!res.ok) return toast({ title: data.error ?? "Failed to move stage", variant: "destructive" });
      toast({ title: `Stage moved to ${data.stageName}` });
      onStageChanged(data.stageName);
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    }
  };

  return (
    <DropdownMenu onOpenChange={(open) => open && loadStages()}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-[11px] font-medium" disabled={loading}>
          {creator.stage?.name ?? "No stage"}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {stages.map((s) => (
          <DropdownMenuItem
            key={s.id}
            onClick={() => moveStage(s.id)}
            className={s.id === creator.stage?.id ? "font-semibold" : ""}
          >
            {s.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StoryRingAvatar({ name }: { name: string }) {
  return (
    <Avatar className="h-10 w-10 ring-1 ring-border">
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

export function CreatorCard({ creator }: { creator: CreatorListItem }) {
  const [currentStage, setCurrentStage] = React.useState(creator.stage);
  const overdue =
    creator.nextDeliverable && new Date(creator.nextDeliverable.dueDate) < new Date()
      ? true
      : false;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <StoryRingAvatar name={creator.name} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Link href={`/creators/${creator.id}`} className="truncate text-sm font-semibold leading-tight hover:underline">
                  {creator.name}
                </Link>
                <a
                  href={`/creators/${creator.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                  title="Open in new tab"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              {!creator.profiles.length ? (
                <span className="text-xs text-muted-foreground">@{creator.handle ?? "—"}</span>
              ) : null}
            </div>
          </div>
          {creator.canMove && creator.currentEngagementId ? (
            <StageDropdown creator={{ ...creator, stage: currentStage }} onStageChanged={(name) => setCurrentStage((prev) => prev ? { ...prev, name } : prev)} />
          ) : currentStage ? (
            <Badge variant="outline" className="shrink-0">{currentStage.name}</Badge>
          ) : null}
        </div>

        {creator.profiles.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {creator.profiles.map((p) => (
              <PlatformLogoBadge key={`${p.platform}-${p.handle}`} platform={p.platform} url={p.url} handle={p.handle} />
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1">
          {approvalBadge(creator)}
          {incompleteBadge(creator)}
          {creator.shopifyRegistered ? (
            <Badge variant="secondary" className="gap-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
              <span className="inline-flex h-3 w-3 items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.337 23.979l7.216-1.851-4.284-15.319-10.055 2.722-.56 3.952 5.899 1.517 2.487 8.168c.146.478.253.96.32 1.443l5.273-1.356v-.276z" />
                </svg>
              </span>
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