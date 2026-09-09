"use client";

import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Phone,
  Mail,
  Tag,
  Calendar,
  UserPlus,
  PackagePlus,
  CheckCircle2,
  XCircle,
  Upload,
  AlertTriangle,
  MapPin,
  ShieldAlert,
  Store,
  MessageSquare,
  StickyNote,
  Clock,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PlatformLogoIcon,
  DealTypeBadge,
  DeliverableStatusBadge,
  GiftStatusBadge,
  initials,
  formatFollowerCount,
  formatMoney,
  formatDate,
  formatDateTime,
  timeAgo,
  isOverdue,
} from "@/lib/display";
import { ACTIVITY_TYPE_LABELS, profileHref } from "@/lib/constants";
import { CreatorFormDialog, type EditableCreatorInput } from "@/components/creators/creator-form";
import { StageChangeDialog, moveStageWithReason } from "@/components/creators/stage-change-dialog";
import { GiftOrderDialog, type DraftOrder } from "@/components/gifts/gift-order-dialog";
import type { Platform, DealType, ApprovalStatus } from "@prisma/client";

type Relationship = "owned" | "same_team" | "same_team_manager" | "other_team" | "available" | "none";

interface Profile {
  id: string;
  platform: Platform;
  handle: string | null;
  url: string;
  isPrimary: boolean;
}

interface Deliverable {
  id: string;
  title: string;
  type: string;
  dueDate: string;
  status: string;
  postedUrl: string | null;
  reviewComment: string | null;
}

interface GiftLine {
  id: string;
  productId: string | null;
  productName: string;
  unitCost: number;
  quantity: number;
  lineTotal: number;
}

interface Gift {
  id: string;
  engagementId: string;
  productName: string;
  status: string;
  isException: boolean;
  exceptionReason: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  shippingAddress: string | null;
  orderTotal: number;
  currency: string;
  agreedBudget: number | null;
  commissionRate: number | null;
  couponCode: string | null;
  lines: GiftLine[];
  agreement: { title: string; type: string; dueDate: string }[] | null;
  requestedAt: string;
}

interface Engagement {
  id: string;
  title: string;
  dealType: DealType;
  amount: number | null;
  currency: string;
  couponCode: string | null;
  commissionPercent: number | null;
  stage: { id: string; name: string } | null;
  team: { name: string };
  createdById: string;
  deliverables: Deliverable[];
  gifts: Gift[];
}

interface ActivityEntry {
  id: string;
  kind: string;
  type: string;
  summary: string;
  description: string | null;
  authorId: string | null;
  author: { displayName: string } | null;
  loggedAt: string;
  attachments: { id: string; filename: string; type?: string; path: string }[];
}

type DraftGift = DraftOrder;

interface CreatorDetail {
  id: string;
  name: string;
  niche: string[];
  email: string | null;
  phone: string | null;
  gender: string | null;
  shopifyRegistered: boolean | null;
  city: string | null;
  country: string | null;
  creatorType: string | null;
  countryRef: { id: string; name: string; dialCode: string } | null;
  cityRef: { id: string; name: string } | null;
  creatorTypeRef: { id: string; name: string } | null;
  customFields: Record<string, string | number | boolean | null>;
  followers: number | null;
  engagementRate: number | null;
  notes: string | null;
  createdAt: string;
  approvalStatus: ApprovalStatus | null;
  reviewComment: string | null;
  createdBy: { id: string; displayName: string; teamId: string | null } | null;
  primaryProfile: Profile | null;
  profiles: Profile[];
  ownerships: {
    userId: string;
    teamId: string | null;
    user: { displayName: string; role?: { slug?: string } | null };
    team: { name: string };
  }[];
  engagements: Engagement[];
  activityLogs: ActivityEntry[];
  canViewFull: boolean;
  relationship: Relationship;
  poolStatus: "none" | "same_team" | "company";
  isOwnedByMe: boolean;
  canMove: boolean;
  canLog: boolean;
  canReviewApproval: boolean;
  missingRequiredForGifting: string[];
  incompleteData: boolean;
  unassignedVisibleFields: string[];
}

function activityIcon(type: string): React.ReactNode {
  switch (type) {
    case "CALL":
      return <Phone className="h-3.5 w-3.5" />;
    case "DM":
      return <MessageSquare className="h-3.5 w-3.5" />;
    case "EMAIL":
      return <Mail className="h-3.5 w-3.5" />;
    case "MEETING":
      return <Calendar className="h-3.5 w-3.5" />;
    case "NOTE":
      return <StickyNote className="h-3.5 w-3.5" />;
    default:
      return <FileText className="h-3.5 w-3.5" />;
  }
}

function activityTone(type: string): string {
  switch (type) {
    case "CALL":
      return "text-sky-600 dark:text-sky-400";
    case "DM":
      return "text-violet-600 dark:text-violet-400";
    case "EMAIL":
      return "text-blue-600 dark:text-blue-400";
    case "MEETING":
      return "text-amber-600 dark:text-amber-400";
    case "NOTE":
      return "text-emerald-600 dark:text-emerald-400";
    default:
      return "text-muted-foreground";
  }
}

function ActivityBadge({ type }: { type: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${activityTone(type)}`}>
      {ACTIVITY_TYPE_LABELS[type as keyof typeof ACTIVITY_TYPE_LABELS] ?? type}
    </span>
  );
}

function ActivityForm({ creatorId, canLog, onLogged }: { creatorId: string; canLog: boolean; onLogged: () => void }) {
  const [type, setType] = React.useState("NOTE");
  const [summary, setSummary] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) return toast({ title: "A summary is required", variant: "destructive" });
    setBusy(true);
    const data = new FormData();
    data.set("type", type);
    data.set("summary", summary);
    data.set("description", description);
    if (file) data.set("file", file);
    try {
      const res = await fetch(`/api/creators/${creatorId}/activity`, { method: "POST", body: data });
      const j = await res.json();
      if (!res.ok) return toast({ title: j.error ?? "Could not log activity", variant: "destructive" });
      toast({ title: "Activity logged" });
      setSummary("");
      setDescription("");
      setFile(null);
      onLogged();
    } catch {
      toast({ title: "Could not log activity", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Log activity</p>
        <span className="text-xs text-muted-foreground">{canLog ? "Notes appear in the timeline below" : "Read-only"}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-32 shrink-0">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {(["CALL", "DM", "EMAIL", "MEETING", "NOTE"] as const).map((t) => (
              <SelectItem key={t} value={t}>
                {ACTIVITY_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="flex-1"
          placeholder="Short summary of the interaction…"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
        <input
          type="file"
          id="attachment-input"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <Button type="button" variant="outline" size="icon" onClick={() => document.getElementById("attachment-input")?.click()} title="Attach file">
          <Upload className="h-4 w-4" />
        </Button>
        <Button type="submit" disabled={busy} size="sm">
          {busy ? "Logging…" : "Log"}
        </Button>
      </div>
      <Input
        placeholder="Add more detail (optional)…"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      {file ? (
        <p className="text-xs text-muted-foreground">Attached: {file.name} ({Math.round(file.size / 1024)} KB)</p>
      ) : null}
      {canLog ? null : (
        <p className="text-xs text-muted-foreground">Only owners and team managers can log activity.</p>
      )}
    </form>
  );
}

export default function CreatorProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const [creator, setCreator] = React.useState<CreatorDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [pendingStage, setPendingStage] = React.useState<string | null>(null);
  const [stageBusy, setStageBusy] = React.useState(false);
  const [giftOpen, setGiftOpen] = React.useState(false);
  const [giftDraft, setGiftDraft] = React.useState<DraftGift | null>(null);
  const searchParams = useSearchParams();
  const giftParam = searchParams.get("gift");
  const tabParam = searchParams.get("giftTab");
  const [tab, setTab] = React.useState<string>(
    ["activity", "engagements", "deliverables", "gifts", "details"].includes(tabParam ?? "") ? tabParam! : "activity",
  );
  const giftSeededRef = React.useRef(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");
  const [reviewBusy, setReviewBusy] = React.useState(false);
  const [me, setMe] = React.useState<{
    id: string;
    roleSlug: string;
    isAdmin?: boolean;
    creatorEditAllowedFields?: string[];
  } | null>(null);
  const [refData, setRefData] = React.useState<{
    shopifyMinStageId: string | null;
    stages: { id: string; name: string; order: number }[];
  } | null>(null);
  const [shopifyBusy, setShopifyBusy] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/reference")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) =>
        setRefData({
          shopifyMinStageId: d?.shopifyMinStageId ?? null,
          stages: d?.stages ?? [],
        }),
      )
      .catch(() => {});
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/creators/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      setCreator(data);
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    load();
    fetch("/api/me")
      .then((r) => r.json())
      .then(setMe)
      .catch(() => {});
  }, [load]);

  const editInitial: EditableCreatorInput | null = React.useMemo(
    () =>
      creator
        ? {
            id: creator.id,
            name: creator.name,
            email: creator.email ?? null,
            phone: creator.phone ?? null,
            countryId: creator.countryRef?.id ?? null,
            cityId: creator.cityRef?.id ?? null,
            creatorTypeId: creator.creatorTypeRef?.id ?? null,
            gender: creator.gender ?? null,
            shopifyRegistered: creator.shopifyRegistered ?? false,
            niche: creator.niche ?? [],
            followers: creator.followers,
            engagementRate: creator.engagementRate,
            notes: creator.notes ?? null,
            customFields: creator.customFields ?? {},
            profiles: creator.profiles.map((p) => ({
              platform: p.platform,
              handle: p.handle,
              url: p.url,
              isPrimary: p.isPrimary,
            })),
            owners: creator.ownerships.map((o) => ({
              id: o.userId,
              displayName: o.user.displayName,
              teamId: o.teamId ?? null,
              roleSlug: o.user.role?.slug ?? "",
            })),
            canEditOwners:
              me?.roleSlug === "admin" ||
              creator.canMove ||
              creator.relationship === "same_team_manager" ||
              (creator.approvalStatus != null && creator.createdBy?.id === me?.id),
            countryValue: creator.countryRef?.name ?? null,
            cityValue: creator.cityRef?.name ?? null,
            creatorTypeValue: creator.creatorTypeRef?.name ?? null,
            canEditProtected: me?.roleSlug === "admin",
            canEditAllFields: me?.isAdmin,
            allowedFields: me?.creatorEditAllowedFields ?? [],
          }
        : null,
    [creator, me],
  );

  const isRequester = creator?.createdBy?.id === me?.id;
  const canEditProfile =
    creator?.canMove ||
    creator?.relationship === "same_team_manager" ||
    (creator?.approvalStatus != null && isRequester) ||
    me?.roleSlug === "admin";

  const toggleShopify = async () => {
    if (!creator || shopifyBusy) return;
    setShopifyBusy(true);
    try {
      const res = await fetch(`/api/creators/${creator.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopifyRegistered: !creator.shopifyRegistered }),
      });
      const j = await res.json();
      if (!res.ok) return toast({ title: j.error ?? "Could not update Shopify status", variant: "destructive" });
      toast({ title: "Shopify status updated" });
      await load();
    } finally {
      setShopifyBusy(false);
    }
  };

  const performAvailabilityRequest = async () => {
    const res = await fetch(`/api/creators/${id}/availability-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const j = await res.json();
    if (!res.ok) return toast({ title: j.error ?? "Could not request", variant: "destructive" });
    toast({ title: "Availability request sent for manager approval" });
  };

  const pickup = async () => {
    const res = await fetch(`/api/creators/${id}/pickup`, { method: "POST" });
    const j = await res.json();
    if (!res.ok) return toast({ title: j.error ?? "Could not pick up", variant: "destructive" });
    toast({ title: "Creator picked up" });
    load();
  };

  const openGift = (draft: Gift | null) => {
    setGiftDraft(
      draft
        ? {
            id: draft.id,
            engagementId: "",
            shippingAddress: draft.shippingAddress,
            agreedBudget: draft.agreedBudget,
            commissionRate: draft.commissionRate,
            couponCode: draft.couponCode,
            currency: draft.currency,
            lines: draft.lines.map((l) => ({ ...l })),
            agreement: draft.agreement,
          }
        : null,
    );
    setGiftOpen(true);
  };

  // Resume a draft from the Gifting page: ?gift=<draftId>&giftTab=gifts opens the
  // order form prefilled with the saved draft.
  React.useEffect(() => {
    if (!creator || giftSeededRef.current) return;
    if (giftParam) {
      const draftGift = creator.engagements
        .flatMap((e) => e.gifts)
        .find((g) => g.id === giftParam && g.status === "draft");
      if (draftGift) {
        setGiftDraft({
          id: draftGift.id,
          engagementId: draftGift.engagementId ?? "",
          shippingAddress: draftGift.shippingAddress,
          agreedBudget: draftGift.agreedBudget,
          commissionRate: draftGift.commissionRate,
          couponCode: draftGift.couponCode,
          currency: draftGift.currency,
          lines: draftGift.lines.map((l) => ({ ...l })),
          agreement: draftGift.agreement,
        });
        setGiftOpen(true);
        giftSeededRef.current = true;
      }
    }
  }, [creator, giftParam]);

  const review = async (decision: "approve" | "reject") => {
    setReviewBusy(true);
    try {
      const res = await fetch(`/api/creators/${id}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          reason: decision === "reject" ? rejectReason : undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) return toast({ title: j.error ?? "Could not review", variant: "destructive" });
      toast({ title: decision === "approve" ? "Creator approved" : "Creator rejected" });
      setRejectOpen(false);
      setRejectReason("");
      load();
    } catch {
      toast({ title: "Could not review", variant: "destructive" });
    } finally {
      setReviewBusy(false);
    }
  };

  if (loading) return <CreatorPageSkeleton />;
  if (notFound || !creator)
    return (
      <div className="rounded-xl border p-10 text-center text-muted-foreground">
        Creator not found.
      </div>
    );

  const isOtherTeam = creator.relationship === "other_team";

  const minStageId = refData?.shopifyMinStageId ?? null;
  const sortOrder = (s: { id: string } | null): number =>
    s ? refData?.stages.find((st) => st.id === s.id)?.order ?? 0 : 0;
  const currentEngagement =
    [...creator.engagements].sort((a, b) => sortOrder(b.stage) - sortOrder(a.stage))[0] ?? null;
  const currentStage = currentEngagement?.stage ?? null;
  const shopifyModuleVisible =
    creator.canViewFull && (!minStageId || sortOrder(currentStage) >= sortOrder(refData?.stages.find((s) => s.id === minStageId) ?? null));

  const moveStage = async (stageId: string) => {
    if (!currentEngagement || stageId === currentEngagement.stage?.id) return;
    setPendingStage(stageId);
  };

  const confirmStageMove = async (reason: string) => {
    if (!currentEngagement || !pendingStage) return;
    setStageBusy(true);
    const res = await moveStageWithReason(currentEngagement.id, pendingStage, reason);
    setStageBusy(false);
    if (!res.ok) return toast({ title: res.error ?? "Could not move stage", variant: "destructive" });
    setPendingStage(null);
    toast({ title: `Moved to ${res.stageName ?? "new stage"}` });
    await load();
  };

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link href="/creators">
          <ArrowLeft className="mr-1 h-4 w-4" /> All creators
        </Link>
      </Button>

      {creator.approvalStatus === "PENDING" ? (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="flex flex-wrap items-center gap-3 pt-5">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Pending approval</p>
              <p className="text-xs text-muted-foreground">
                Requested by {creator.createdBy?.displayName ?? "—"}. This creator cannot be worked until a Team Manager approves it.
              </p>
            </div>
            {creator.canReviewApproval ? (
              <div className="flex items-center gap-2">
                <Button size="sm" disabled={reviewBusy} onClick={() => review("approve")}>
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                </Button>
                <Button size="sm" variant="outline" disabled={reviewBusy} onClick={() => setRejectOpen(true)}>
                  <XCircle className="mr-1 h-4 w-4" /> Reject
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {creator.approvalStatus === "REJECTED" ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-center gap-3">
              <XCircle className="h-5 w-5 text-destructive" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Rejected</p>
                <p className="text-xs text-muted-foreground">
                  {creator.reviewComment ?? "No reason provided."}
                </p>
              </div>
              {isRequester || me?.roleSlug === "admin" ? (
                <Button size="sm" onClick={() => setEditOpen(true)}>
                  Edit and resubmit
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {creator.incompleteData && !creator.approvalStatus && creator.isOwnedByMe ? (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="flex flex-wrap items-center gap-3 pt-5">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Incomplete data</p>
              <p className="text-xs text-muted-foreground">
                Add {creator.missingRequiredForGifting.join(", ")} before requesting a gift.
              </p>
            </div>
            {canEditProfile ? (
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                Complete profile
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="flex flex-wrap items-start gap-4 pt-6">
          <Avatar className="h-16 w-16">
            <AvatarFallback>{initials(creator.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{creator.name}</h1>
              {creator.approvalStatus === "PENDING" ? <Badge variant="warning">Pending approval</Badge> : null}
              {creator.approvalStatus === "REJECTED" ? <Badge variant="destructive">Rejected</Badge> : null}
              {!creator.approvalStatus && creator.incompleteData ? <Badge variant="info">Incomplete data</Badge> : null}
              {creator.poolStatus === "company" ? <Badge>Pool · company</Badge> : null}
              {creator.poolStatus === "same_team" ? <Badge variant="secondary">Pool · team</Badge> : null}
              {creator.relationship === "owned" ? <Badge variant="outline">Owned by me</Badge> : null}
              {currentStage ? (
                creator.canMove ? (
                  <Select value={currentStage.id} onValueChange={(v) => void moveStage(v)}>
                    <SelectTrigger className="h-6 w-48 px-2 text-xs">
                      <SelectValue placeholder="Stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {(refData?.stages ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline">{currentStage.name}</Badge>
                )
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {creator.profiles.length ? (
                creator.profiles.map((p) => (
                  <a
                    key={`${p.platform}-${p.handle}`}
                    href={profileHref(p.platform, p.url, p.handle)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center text-muted-foreground transition-colors hover:text-foreground"
                    title={`@${p.handle} on ${p.platform}`}
                  >
                    <PlatformLogoIcon platform={p.platform} size={15} />
                    <span className="sr-only">@{p.handle}</span>
                  </a>
                ))
              ) : creator.primaryProfile?.platform ? (
                <PlatformLogoIcon platform={creator.primaryProfile.platform} size={15} />
              ) : null}
              {creator.followers != null && (isOtherTeam ? (creator.unassignedVisibleFields ?? []).includes("followers") : true) ? (
                <span>{formatFollowerCount(creator.followers)} followers</span>
              ) : null}
              {creator.engagementRate != null && (isOtherTeam ? (creator.unassignedVisibleFields ?? []).includes("engagementRate") : true) ? (
                <span>{creator.engagementRate}% ER</span>
              ) : null}
              {creator.creatorType && (isOtherTeam ? (creator.unassignedVisibleFields ?? []).includes("creatorType") : true) ? (
                <span className="inline-flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5" /> {creator.creatorType}
                </span>
              ) : null}
              {creator.shopifyRegistered && (isOtherTeam ? (creator.unassignedVisibleFields ?? []).includes("shopify") : true) ? (
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <Store className="h-3.5 w-3.5" /> Shopify
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {creator.primaryProfile && creator.primaryProfile.url ? (
                <a href={creator.primaryProfile.url} target="_blank" rel="noreferrer" className="text-xs inline-flex items-center gap-1 text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" /> Profile link
                </a>
              ) : null}
              {creator.gender && (isOtherTeam ? (creator.unassignedVisibleFields ?? []).includes("gender") : true) ? (
                <span className="inline-flex items-center gap-1 text-xs"><Tag className="h-3 w-3" /> {creator.gender}</span>
              ) : null}
              {creator.city && creator.country && (isOtherTeam ? (creator.unassignedVisibleFields ?? []).includes("city") : true) ? (
                <span className="inline-flex items-center gap-1 text-xs"><MapPin className="h-3 w-3" /> {creator.city}, {creator.country}</span>
              ) : null}
              {creator.email && (isOtherTeam ? (creator.unassignedVisibleFields ?? []).includes("email") : true) ? (
                <span className="inline-flex items-center gap-1 text-xs"><Mail className="h-3 w-3" /> {creator.email}</span>
              ) : null}
              {creator.phone && (isOtherTeam ? (creator.unassignedVisibleFields ?? []).includes("phone") : true) ? (
                <span className="inline-flex items-center gap-1 text-xs"><Phone className="h-3 w-3" /> {creator.phone}</span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {creator.relationship === "available" ? (
              <Button onClick={pickup}>
                <UserPlus className="mr-1 h-4 w-4" /> Pick up
              </Button>
            ) : null}
            {creator.relationship === "other_team" ? (
              <Button onClick={performAvailabilityRequest}>Request availability</Button>
            ) : null}
            {canEditProfile ? (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                {creator.approvalStatus === "REJECTED" ? "Edit & resubmit" : "Edit"}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Dialog open={rejectOpen} onOpenChange={(v) => { setRejectOpen(v); if (!v) setRejectReason(""); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reject {creator.name}</DialogTitle>
            <DialogDescription>
              Rejection notifies the requester. They can edit the creator and resubmit it for approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reject-reason">Reason</Label>
            <textarea
              id="reject-reason"
              className="min-h-[90px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              placeholder="Why is this creator being rejected?"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={reviewBusy} onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={reviewBusy || !rejectReason.trim()} onClick={() => review("reject")}>
              Reject creator
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreatorFormDialog
        key={editInitial?.id ?? "new"}
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initial={editInitial}
        onSaved={load}
      />

      <StageChangeDialog
        open={pendingStage !== null}
        onOpenChange={(v) => !v && setPendingStage(null)}
        title={
          pendingStage
            ? `Move to ${refData?.stages.find((s) => s.id === pendingStage)?.name ?? "new stage"}`
            : "Move to"
        }
        description={creator ? `${creator.name} — recorded on their activity log.` : undefined}
        onConfirm={(reason) => void confirmStageMove(reason)}
        busy={stageBusy}
      />

      {creator ? (
        <GiftOrderDialog
          open={giftOpen}
          onOpenChange={(v) => {
            setGiftOpen(v);
            if (!v) giftSeededRef.current = false;
          }}
          creatorName={creator.name}
          engagements={creator.engagements.map((e) => ({
            id: e.id,
            title: e.title,
            dealType: e.dealType,
            currency: e.currency,
            team: { name: e.team.name },
          }))}
          draft={giftDraft}
          previousAddresses={Array.from(
            new Set(creator.engagements.flatMap((e) => e.gifts.map((g) => g.shippingAddress).filter((a): a is string => Boolean(a && a.trim())))),
          )}
          onSubmitted={() => load()}
        />
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
              <TabsTrigger value="activity">Activity</TabsTrigger>
              {creator.canViewFull ? (
                <>
                  <TabsTrigger value="engagements">Engagements</TabsTrigger>
                  <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
                  <TabsTrigger value="gifts">Gifts</TabsTrigger>
                </>
              ) : null}
              {!isOtherTeam ? <TabsTrigger value="details">Details</TabsTrigger> : null}
            </TabsList>

            <TabsContent value="activity" className="space-y-4">
              {creator.canLog ? <ActivityForm creatorId={id} canLog={creator.canLog} onLogged={load} /> : null}
              {creator.activityLogs.length === 0 ? (
                <div className="rounded-xl border p-8 text-center text-muted-foreground">No activity yet.</div>
              ) : (
                <ol className="relative space-y-5 border-l-2 border-border pl-5">
                  {creator.activityLogs.map((a) => (
                    <li key={a.id} className="relative">
                      <span className="absolute -left-[27px] top-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm">
                        {activityIcon(a.type)}
                      </span>
                      <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <ActivityBadge type={a.type} />
                          {a.author?.displayName ? (
                            <span className="text-xs font-medium text-foreground">{a.author.displayName}</span>
                          ) : null}
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {timeAgo(a.loggedAt)}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm font-semibold break-words">{a.summary}</p>
                        {a.description ? (
                          <p className="mt-1 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground break-words">
                            {a.description}
                          </p>
                        ) : null}
                        {a.attachments.length ? (
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {a.attachments.map((att) => (
                              <a
                                key={att.id}
                                href={att.path}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-md border bg-accent/40 px-2 py-1 text-xs text-primary hover:bg-accent"
                              >
                                <FileText className="h-3.5 w-3.5" /> {att.filename}
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </TabsContent>

            <TabsContent value="engagements" className="space-y-3">
              {creator.engagements.length === 0 ? (
                <div className="rounded-xl border p-8 text-center text-muted-foreground">No engagements yet.</div>
              ) : (
                creator.engagements.map((e) => (
                  <Card key={e.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">{e.title}</CardTitle>
                        <DealTypeBadge type={e.dealType} />
                      </div>
                      <CardDescription>
                        {e.team.name} · {e.stage?.name ?? "No stage"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                      <span>
                        Budget:{" "}
                        <span className="font-medium text-foreground">
                          {formatMoney(e.amount, e.currency)}
                        </span>
                      </span>
                      {e.dealType === "COMMISSION" ? (
                        <>
                          <span>
                            Code: <span className="font-medium text-foreground">{e.couponCode ?? "—"}</span>
                          </span>
                          <span>
                            Commission: <span className="font-medium text-foreground">{e.commissionPercent != null ? `${e.commissionPercent}%` : "—"}</span>
                          </span>
                        </>
                      ) : null}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="deliverables" className="space-y-3">
              {creator.engagements.length === 0 ? (
                <div className="rounded-xl border p-8 text-center text-muted-foreground">No deliverables.</div>
              ) : (
                creator.engagements.flatMap((e) =>
                  e.deliverables.map((d) => (
                    <Card key={d.id}>
                      <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-5">
                        <div className="min-w-0">
                          <p className="font-medium">{d.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {e.title} · {d.type}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <DeliverableStatusBadge status={d.status} />
                          <span
                            className={`text-xs ${
                              isOverdue(d.dueDate, d.status) ? "font-medium text-destructive" : "text-muted-foreground"
                            }`}
                          >
                            {formatDate(d.dueDate)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )),
                )
              )}
            </TabsContent>

            <TabsContent value="gifts" className="space-y-3">
              {creator.engagements.length === 0 ? (
                <div className="rounded-xl border p-8 text-center text-muted-foreground">No gifts.</div>
              ) : (
                creator.engagements.flatMap((e) =>
                  e.gifts.map((g) => (
                    <Card key={g.id}>
                      <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-5">
                        <div>
                          <p className="font-medium">
                            {g.productName}
                            {g.isException ? <Badge className="ml-2" variant="secondary">Exception</Badge> : null}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {e.title} · requested {formatDateTime(g.requestedAt)}
                          </p>
                          {g.lines.length > 1 ? (
                            <p className="text-xs text-muted-foreground">
                              {g.lines.map((l) => l.productName).join(", ")}
                            </p>
                          ) : null}
                          {g.orderTotal > 0 ? (
                            <p className="text-xs text-muted-foreground">
                              {g.lines.length} line{g.lines.length === 1 ? "" : "s"} · {formatMoney(g.orderTotal, g.currency)}
                              {g.shippingAddress ? " · " + g.shippingAddress : ""}
                            </p>
                          ) : null}
                          {g.trackingNumber ? (
                            <p className="text-xs text-muted-foreground">
                              {g.carrier} · {g.trackingNumber}
                            </p>
                          ) : null}
                        </div>
                        <GiftStatusBadge status={g.status} />
                      </CardContent>
                    </Card>
                  )),
                )
              )}
            </TabsContent>

            <TabsContent value="details">
              <Card>
                <CardContent className="grid gap-x-6 gap-y-3 pt-6 text-sm sm:grid-cols-2">
                  <p className="text-muted-foreground">Niche</p>
                  <p>{creator.niche?.length ? creator.niche.join(", ") : "—"}</p>
                  <p className="text-muted-foreground">Gender</p>
                  <p>{creator.gender ?? "—"}</p>
                  <p className="text-muted-foreground">City / Country</p>
                  <p>{creator.city ?? "—"} / {creator.country ?? "—"}</p>
                  <p className="text-muted-foreground">Creator type</p>
                  <p>{creator.creatorType ?? "—"}</p>
                  <p className="text-muted-foreground">Email</p>
                  <p>{creator.email ?? "—"}</p>
                  <p className="text-muted-foreground">Phone</p>
                  <p>{creator.phone ?? "—"}</p>
                  <p className="text-muted-foreground">Shopify</p>
                  <p>{creator.shopifyRegistered ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : "—"}</p>
                  <p className="text-muted-foreground">Created</p>
                  <p>{formatDate(creator.createdAt)}</p>
                  {Object.keys(creator.customFields ?? {}).length ? (
                    <p className="text-muted-foreground col-span-full mt-2 border-t pt-3">Custom fields</p>
                  ) : null}
                  <div className="col-span-full grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    {Object.entries(creator.customFields ?? {}).map(([key, value]) => (
                      <div key={key} className="col-span-1 flex justify-between gap-4">
                        <span className="text-muted-foreground">{key}</span>
                        <span className="text-right font-medium">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-muted-foreground">Notes</p>
                  <p className="whitespace-pre-wrap break-words">{creator.notes ?? "—"}</p>
                  <p className="text-muted-foreground col-span-full mt-2 border-t pt-3 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> Platform profiles
                  </p>
                  <div className="col-span-full flex flex-wrap gap-2">
                    {creator.profiles.map((p) => (
                      <a
                        key={p.id}
                        href={profileHref(p.platform, p.url, p.handle)}
                        target="_blank"
                        rel="noreferrer"
                        title={p.handle ? `@${p.handle} on ${p.platform}` : p.platform}
                        className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                      >
                        <PlatformLogoIcon platform={p.platform} size={14} />
                        {p.isPrimary ? <Badge variant="secondary">primary</Badge> : null}
                        <span className="sr-only">@{p.handle}</span>
                      </a>
                    ))}
                  </div>
                  <p className="text-muted-foreground col-span-full mt-2 border-t pt-3">Ownership</p>
                  <div className="col-span-full">
                    {creator.ownerships.length ? (
                      creator.ownerships.map((o, i) => (
                        <Badge key={i} variant="outline" className="mr-1.5">
                          {o.user.displayName} · {o.team.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          {shopifyModuleVisible ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Store className="h-4 w-4" /> Shopify
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm">
                    {creator.shopifyRegistered ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" /> Registered on Shopify
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Not registered on Shopify</span>
                    )}
                  </span>
                  {canEditProfile ? (
                    <Button size="sm" variant={creator.shopifyRegistered ? "outline" : "default"} onClick={toggleShopify} disabled={shopifyBusy}>
                      {shopifyBusy ? "Saving…" : creator.shopifyRegistered ? "Mark not registered" : "Mark registered"}
                    </Button>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Appears once outreach reaches the minimum stage.
                </p>
              </CardContent>
            </Card>
          ) : null}
          {!isOtherTeam ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Gift a creator</CardTitle>
              </CardHeader>
              <CardContent>
                {creator.incompleteData && creator.isOwnedByMe ? (
                  <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs">
                    <p className="font-medium text-amber-800">Missing required data</p>
                    <p className="mt-0.5 text-amber-700">
                      {creator.missingRequiredForGifting.join(", ")} — needed before a gift can be requested.
                    </p>
                  </div>
                ) : null}
                <Button
                  variant="outline"
                  className="w-full"
                  size="sm"
                  onClick={() => openGift(null)}
                  disabled={creator.engagements.length === 0 || (creator.incompleteData && creator.isOwnedByMe)}
                >
                  <PackagePlus className="mr-1 h-4 w-4" /> Request gift
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Subject to the one-per-month rule. Requests that need an exception go to your team manager.
                </p>
              </CardContent>
            </Card>
          ) : null}
          {creator.ownerships.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Owned by</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {creator.ownerships.map((o, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback>{initials(o.user.displayName)}</AvatarFallback>
                    </Avatar>
                    <span>{o.user.displayName}</span>
                    <Badge variant="secondary" className="ml-auto">
                      {o.team.name}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Access</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Relationship</span>
                <span className="font-medium">{creator.relationship.replaceAll("_", " ")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">See full deal</span>
                <span>{creator.canViewFull ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CreatorPageSkeleton() {
  return <Skeleton className="h-40 w-full" />;
}