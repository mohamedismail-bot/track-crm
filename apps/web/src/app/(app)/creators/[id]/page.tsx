"use client";

import * as React from "react";
import { useParams } from "next/navigation";
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
} from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  PlatformBadge,
  DealTypeBadge,
  DeliverableStatusBadge,
  GiftStatusBadge,
  ActivityTypeLabel,
  initials,
  formatFollowerCount,
  formatMoney,
  formatDate,
  formatDateTime,
  timeAgo,
  isOverdue,
} from "@/lib/display";
import type { Platform, DealType } from "@prisma/client";

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

interface Gift {
  id: string;
  productName: string;
  status: string;
  isException: boolean;
  exceptionReason: string | null;
  trackingNumber: string | null;
  carrier: string | null;
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

interface CreatorDetail {
  id: string;
  name: string;
  niche: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  creatorType: string | null;
  followers: number | null;
  engagementRate: number | null;
  notes: string | null;
  avatarUrl: string | null;
  createdAt: string;
  primaryProfile: Profile | null;
  profiles: Profile[];
  ownerships: {
    userId: string;
    user: { displayName: string };
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
    <form onSubmit={submit} className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {["CALL", "DM", "EMAIL", "MEETING", "NOTE"].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
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
          Log
        </Button>
      </div>
      {file ? (
        <p className="text-xs text-muted-foreground">Attached: {file.name} ({Math.round(file.size / 1024)} KB)</p>
      ) : null}
      {description ? null : null}
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
  const [editForm, setEditForm] = React.useState({
    name: "",
    niche: "",
    email: "",
    phone: "",
    city: "",
    country: "",
    creatorType: "",
    followers: "",
    engagementRate: "",
    notes: "",
  });

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
      setEditForm({
        name: data.name ?? "",
        niche: data.niche ?? "",
        email: data.email ?? "",
        phone: data.phone ?? "",
        city: data.city ?? "",
        country: data.country ?? "",
        creatorType: data.creatorType ?? "",
        followers: data.followers?.toString() ?? "",
        engagementRate: data.engagementRate?.toString() ?? "",
        notes: data.notes ?? "",
      });
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  const saveEdit = async () => {
    const body: Record<string, string | number> = {
      name: editForm.name,
      niche: editForm.niche,
      email: editForm.email,
      phone: editForm.phone,
      city: editForm.city,
      country: editForm.country,
      creatorType: editForm.creatorType,
      notes: editForm.notes,
    };
    if (editForm.followers) body.followers = Number(editForm.followers);
    if (editForm.engagementRate) body.engagementRate = Number(editForm.engagementRate);
    const res = await fetch(`/api/creators/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    if (!res.ok) return toast({ title: j.error ?? "Could not save", variant: "destructive" });
    setEditOpen(false);
    toast({ title: "Saved" });
    load();
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

  if (loading) return <CreatorPageSkeleton />;
  if (notFound || !creator)
    return (
      <div className="rounded-xl border p-10 text-center text-muted-foreground">
        Creator not found.
      </div>
    );

  const isOtherTeam = creator.relationship === "other_team";

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link href="/creators">
          <ArrowLeft className="mr-1 h-4 w-4" /> All creators
        </Link>
      </Button>

      <Card>
        <CardContent className="flex flex-wrap items-start gap-4 pt-6">
          <Avatar className="h-16 w-16">
            <AvatarImage src={creator.avatarUrl ?? undefined} alt={creator.name} />
            <AvatarFallback>{initials(creator.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{creator.name}</h1>
              {creator.poolStatus === "company" ? <Badge>Pool · company</Badge> : null}
              {creator.poolStatus === "same_team" ? <Badge variant="secondary">Pool · team</Badge> : null}
              {creator.relationship === "owned" ? <Badge variant="outline">Owned by me</Badge> : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {creator.primaryProfile?.platform ? (
                <PlatformBadge platform={creator.primaryProfile.platform} />
              ) : null}
              <span>@{creator.primaryProfile?.handle ?? "—"}</span>
              {creator.followers != null ? <span>{formatFollowerCount(creator.followers)} followers</span> : null}
              {creator.engagementRate != null ? <span>{creator.engagementRate}% ER</span> : null}
              {creator.creatorType ? (
                <span className="inline-flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5" /> {creator.creatorType}
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {creator.primaryProfile ? (
                <a href={creator.primaryProfile.url} target="_blank" rel="noreferrer" className="text-xs inline-flex items-center gap-1 text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" /> Profile link
                </a>
              ) : null}
              {creator.email ? (
                <span className="inline-flex items-center gap-1 text-xs"><Mail className="h-3 w-3" /> {creator.email}</span>
              ) : null}
              {creator.phone ? (
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
            {creator.canMove ? (
              <Button variant="outline" onClick={() => setEditOpen(true)}>Edit</Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit creator</DialogTitle>
            <DialogDescription>Update basic profile details for {creator.name}.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="edit-niche">Niche</Label>
              <Input id="edit-niche" value={editForm.niche} onChange={(e) => setEditForm((f) => ({ ...f, niche: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="edit-phone">Phone</Label>
              <Input id="edit-phone" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="edit-city">City</Label>
              <Input id="edit-city" value={editForm.city} onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="edit-country">Country</Label>
              <Input id="edit-country" value={editForm.country} onChange={(e) => setEditForm((f) => ({ ...f, country: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="edit-followers">Followers</Label>
              <Input id="edit-followers" type="number" value={editForm.followers} onChange={(e) => setEditForm((f) => ({ ...f, followers: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="edit-er">Engagement rate (%)</Label>
              <Input id="edit-er" type="number" value={editForm.engagementRate} onChange={(e) => setEditForm((f) => ({ ...f, engagementRate: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="edit-type">Creator type</Label>
              <Input id="edit-type" value={editForm.creatorType} onChange={(e) => setEditForm((f) => ({ ...f, creatorType: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs defaultValue="activity">
            <TabsList className="mb-4">
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="engagements">Engagements</TabsTrigger>
              <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
              <TabsTrigger value="gifts">Gifts</TabsTrigger>
              {!isOtherTeam ? <TabsTrigger value="details">Details</TabsTrigger> : null}
            </TabsList>

            <TabsContent value="activity" className="space-y-4">
              {creator.canLog ? <ActivityForm creatorId={id} canLog={creator.canLog} onLogged={load} /> : null}
              {creator.activityLogs.length === 0 ? (
                <div className="rounded-xl border p-8 text-center text-muted-foreground">No activity yet.</div>
              ) : (
                creator.activityLogs.map((a) => (
                  <Card key={a.id}>
                    <CardContent className="pt-5">
                      <div className="flex items-center gap-2 text-sm">
                        <ActivityTypeLabel type={a.type} />
                        <span className="ml-auto text-xs text-muted-foreground">
                          {a.author?.displayName ?? "System"} · {timeAgo(a.loggedAt)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium">{a.summary}</p>
                      {a.description ? <p className="mt-1 text-xs text-muted-foreground">{a.description}</p> : null}
                      {a.attachments.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {a.attachments.map((att) => (
                            <a
                              key={att.id}
                              href={att.path}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-primary hover:bg-accent"
                            >
                              <Upload className="h-3 w-3" /> {att.filename}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ))
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
                  <p>{creator.niche ?? "—"}</p>
                  <p className="text-muted-foreground">City / Country</p>
                  <p>{creator.city ?? "—"} / {creator.country ?? "—"}</p>
                  <p className="text-muted-foreground">Created</p>
                  <p>{formatDate(creator.createdAt)}</p>
                  <p className="text-muted-foreground">Notes</p>
                  <p className="whitespace-pre-wrap">{creator.notes ?? "—"}</p>
                  <p className="text-muted-foreground col-span-full mt-2 border-t pt-3 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> Platform profiles
                  </p>
                  <div className="col-span-full flex flex-wrap gap-2">
                    {creator.profiles.map((p) => (
                      <a
                        key={p.id}
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                      >
                        <PlatformBadge platform={p.platform} /> @{p.handle}
                        {p.isPrimary ? <Badge variant="secondary" className="ml-1">primary</Badge> : null}
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
          {!isOtherTeam ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Gift a creator</CardTitle>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full" size="sm">
                  <Link href={`/creators/${id}`}>
                    <PackagePlus className="mr-1 h-4 w-4" /> Request gift
                  </Link>
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