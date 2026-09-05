import {
  PLATFORM_LABELS,
  DEAL_TYPE_LABELS,
  DELIVERABLE_STATUS_LABELS,
  GIFT_STATUS_LABELS,
  ACTIVITY_TYPE_LABELS,
} from "@/lib/constants";
import type { Platform, DealType, DeliverableStatus, GiftStatus, ActivityType } from "@prisma/client";
import { Badge, type BadgeProps } from "@/components/ui/badge";

export function PlatformBadge({ platform }: { platform: Platform }) {
  return <span className="font-medium">{PLATFORM_LABELS[platform]}</span>;
}

export function DealTypeBadge({ type }: { type: DealType }) {
  return <Badge variant="secondary">{DEAL_TYPE_LABELS[type]}</Badge>;
}

const statusVariant: Record<DeliverableStatus, BadgeProps["variant"]> = {
  PENDING: "secondary",
  UNDER_REVIEW: "warning",
  APPROVED: "success",
  REVISION_REQUESTED: "destructive",
};

export function DeliverableStatusBadge({ status }: { status: DeliverableStatus | (string & {}) }) {
  const key = status as DeliverableStatus;
  return <Badge variant={statusVariant[key]}>{DELIVERABLE_STATUS_LABELS[key] ?? status}</Badge>;
}

const giftVariant: Record<GiftStatus, BadgeProps["variant"]> = {
  REQUESTED: "info",
  APPROVED_QUEUED: "warning",
  DISPATCHED: "secondary",
  DELIVERED: "success",
  REJECTED: "destructive",
};

export function GiftStatusBadge({ status }: { status: GiftStatus | (string & {}) }) {
  const key = status as GiftStatus;
  return <Badge variant={giftVariant[key]}>{GIFT_STATUS_LABELS[key] ?? status}</Badge>;
}

export function ActivityTypeLabel({ type }: { type: ActivityType | (string & {}) }) {
  return <span>{ACTIVITY_TYPE_LABELS[type as ActivityType] ?? type}</span>;
}

export function formatFollowerCount(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

export function formatMoney(n: number | null, currency: string): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function timeAgo(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function isOverdue(dueDate: Date | string, status: string): boolean {
  return new Date(dueDate).getTime() < Date.now() && status !== "APPROVED";
}