"use client";

import * as React from "react";
import Link from "next/link";
import { Users, CalendarClock, Flame, ExternalLink, ChevronDown, MoreHorizontal, UserCog } from "lucide-react";
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
import { REQUIRED_FOR_GIFTING_LABELS } from "@/lib/constants";
import { StageChangeDialog, moveStageWithReason } from "./stage-change-dialog";
import { ReassignCreatorDialog } from "./reassign-dialog";

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
  const missing = c.missingRequiredForGifting ?? [];
  const label =
    missing.length > 0
      ? missing.map((m) => REQUIRED_FOR_GIFTING_LABELS[m] ?? m).join(", ")
      : "Missing details";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/60 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <span className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
          Incomplete data
        </span>
      </TooltipTrigger>
      <TooltipContent>
        Add missing info to enable gifting: {label}.
      </TooltipContent>
    </Tooltip>
  );
}

export function StageDropdown({
  creator,
  onStageChanged,
}: {
  creator: CreatorListItem;
  onStageChanged: (stage: { id: string; name: string }) => void;
}) {
  const [stages, setStages] = React.useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [pending, setPending] = React.useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = React.useState(false);

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

  const confirmMove = async (reason: string) => {
    if (!creator.currentEngagementId || !pending) return;
    setBusy(true);
    const res = await moveStageWithReason(creator.currentEngagementId, pending.id, reason);
    setBusy(false);
    if (!res.ok) return toast({ title: res.error ?? "Failed to move stage", variant: "destructive" });
    toast({ title: `Stage moved to ${res.stageName}` });
    setPending(null);
    onStageChanged({ id: pending.id, name: res.stageName ?? pending.name });
  };

  return (
    <>
      <DropdownMenu onOpenChange={(open) => open && loadStages()}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-[11px] font-medium" disabled={loading}>
            {creator.stage?.name ?? "No stage"}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {stages.map((s) => (
            <DropdownMenuItem
              key={s.id}
              onClick={() => setPending({ id: s.id, name: s.name })}
              className={s.id === creator.stage?.id ? "font-semibold" : ""}
            >
              {s.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <StageChangeDialog
        open={pending !== null}
        onOpenChange={(v) => !v && setPending(null)}
        title={`Move to ${pending?.name ?? ""}`}
        onConfirm={confirmMove}
        busy={busy}
      />
    </>
  );
}

function StoryRingAvatar({ name }: { name: string }) {
  return (
    <Avatar className="h-10 w-10 ring-1 ring-border">
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

export function CreatorCard({
  creator,
  onStageChanged,
  selected,
  onToggleSelect,
  onReassigned,
}: {
  creator: CreatorListItem;
  onStageChanged?: (creatorId: string, stage: { id: string; name: string } | null) => void;
  selected?: boolean;
  onToggleSelect?: (creatorId: string, selected: boolean) => void;
  onReassigned?: () => void;
}) {
  const [currentStage, setCurrentStage] = React.useState<{ id: string; name: string } | null>(creator.stage);
  const [reassignOpen, setReassignOpen] = React.useState(false);
  const overdue =
    creator.nextDeliverable && new Date(creator.nextDeliverable.dueDate) < new Date()
      ? true
      : false;
  const showCheck = onToggleSelect !== undefined;

  const handleStageChanged = (stage: { id: string; name: string }) => {
    setCurrentStage(stage);
    onStageChanged?.(creator.id, stage);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={`group relative flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors ${
          selected
            ? "border-primary/70 ring-2 ring-primary/30"
            : "border-border hover:border-primary/40 hover:bg-accent/40"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            {showCheck ? (
              <button
                type="button"
                onClick={() => onToggleSelect?.(creator.id, !selected)}
                aria-label={selected ? "Deselect creator" : "Select creator"}
                className={`mt-1 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border transition-colors ${
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-transparent hover:border-primary/60"
                }`}
              >
                {selected ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </button>
            ) : null}
            <StoryRingAvatar name={creator.name} />
            <div className="min-w-0">
              <Link
                href={`/creators/${creator.id}`}
                className="break-words text-sm font-semibold leading-tight hover:underline"
              >
                {creator.name}
              </Link>
              {!creator.profiles.length ? (
                <span className="block text-xs text-muted-foreground">@{creator.handle ?? "—"}</span>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <a
              href={`/creators/${creator.id}`}
              target="_blank"
              rel="noreferrer"
              className="p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
              title="Open in new tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {creator.canMove ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="More actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setReassignOpen(true)}>
                    <UserCog className="mr-2 h-4 w-4" />
                    Reassign owner…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span className="w-7" />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {creator.canMove && creator.currentEngagementId ? (
            <StageDropdown creator={{ ...creator, stage: currentStage }} onStageChanged={handleStageChanged} />
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
              Registered
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <span className="inline-flex h-3 w-3 items-center justify-center opacity-70">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.337 23.979l7.216-1.851-4.284-15.319-10.055 2.722-.56 3.952 5.899 1.517 2.487 8.168c.146.478.253.96.32 1.443l5.273-1.356v-.276z" />
                </svg>
              </span>
              Not registered
            </Badge>
          )}
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
            {creator.createdAt ? `Added ${timeAgo(creator.createdAt)}` : "—"}
          </span>
        </div>
        <ReassignCreatorDialog
          open={reassignOpen}
          onOpenChange={setReassignOpen}
          creatorId={creator.id}
          creatorName={creator.name}
          currentOwnerIds={creator.owners.map((o) => o.id)}
          onDone={onReassigned}
        />
      </div>
    </TooltipProvider>
  );
}