"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Save, Trash2, Upload, X, Star } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { BRAND_COLORS } from "@/lib/constants";

interface SettingsData {
  name: string;
  logoUrl: string;
  primaryColor: string;
  multiTeam: boolean;
  multiOwner: boolean;
  inactivitySameTeamDays: number;
  inactivityCompanyDays: number;
  giftMonthlyCapEnabled: boolean;
  giftRequirePreviousDeliverable: boolean;
  giftMinStageId: string | null;
  shopifyMinStageId: string | null;
  exportEnabledRoles: string[];
  exportEnabledUserIds: string[];
  passwordMinLength: number;
  passwordComplexity: boolean;
  genderOptions: string[];
  nicheOptions: string[];
  customFieldsEnabled: boolean;
  approvalEnabled: boolean;
  unassignedVisibleFields: string[];
  stages: { id: string; name: string; isCompleted: boolean }[];
}

interface RefField {
  id: string | null;
  key: string | null;
  label: string;
  type: string;
  required: boolean;
  order: number;
  options: string[];
}

interface ReferenceData {
  countries: {
    id: string;
    name: string;
    dialCode: string;
    phoneDigits: number | null;
    cities: { id: string; name: string }[];
  }[];
  creatorTypes: { id: string; name: string }[];
  fields: RefField[];
}

interface TeamRow {
  id: string;
  name: string;
  slug: string;
  userCount: number;
  engagementCount: number;
  creatorCount: number;
  isMine: boolean;
}

export default function SettingsPage() {
  const [data, setData] = React.useState<SettingsData | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = React.useState(false);

  const [teams, setTeams] = React.useState<TeamRow[]>([]);
  const [loadError, setLoadError] = React.useState("");
  const [newTeamName, setNewTeamName] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const [refData, setRefData] = React.useState<ReferenceData | null>(null);

  React.useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
    fetch("/api/reference")
      .then((r) => r.json())
      .then(setRefData)
      .catch(() => setRefData(null));
  }, []);

  const loadReference = React.useCallback(async () => {
    const res = await fetch("/api/reference");
    if (!res.ok) return;
    const d = await res.json();
    setRefData({ countries: d.countries ?? [], creatorTypes: d.creatorTypes ?? [], fields: d.fields ?? [] });
    setData((prev) =>
      prev
        ? {
            ...prev,
            genderOptions: d.genderOptions ?? prev.genderOptions,
            nicheOptions: d.nicheOptions ?? prev.nicheOptions,
            customFieldsEnabled: d.customFieldsEnabled ?? prev.customFieldsEnabled,
            approvalEnabled: d.approvalEnabled ?? prev.approvalEnabled,
          }
        : prev,
    );
  }, []);

  const loadTeams = React.useCallback(async () => {
    try {
      const res = await fetch("/api/teams");
      const d = await res.json();
      if (res.ok) {
        setTeams(d.teams);
        setLoadError("");
      } else {
        setLoadError(d.error ?? "Could not load teams.");
      }
    } catch {
      setLoadError("Could not load teams.");
    }
  }, []);

  React.useEffect(() => {
    void loadTeams();
    void loadReference();
  }, [loadTeams, loadReference]);

  if (!data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const save = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("name", data.name);
      fd.append("primaryColor", data.primaryColor || "indigo");
      fd.append("multiTeam", data.multiTeam ? "true" : "false");
      fd.append("multiOwner", data.multiOwner ? "true" : "false");
      fd.append("inactivitySameTeamDays", String(data.inactivitySameTeamDays));
      fd.append("inactivityCompanyDays", String(data.inactivityCompanyDays));
      fd.append("giftMonthlyCapEnabled", data.giftMonthlyCapEnabled ? "true" : "false");
      fd.append("giftRequirePreviousDeliverable", data.giftRequirePreviousDeliverable ? "true" : "false");
      fd.append("giftMinStageId", data.giftMinStageId ?? "");
      fd.append("shopifyMinStageId", data.shopifyMinStageId ?? "");
      fd.append("passwordMinLength", String(data.passwordMinLength));
      fd.append("passwordComplexity", data.passwordComplexity ? "true" : "false");
      fd.append("genderOptions", JSON.stringify(data.genderOptions));
      fd.append("nicheOptions", JSON.stringify(data.nicheOptions));
      fd.append("customFieldsEnabled", data.customFieldsEnabled ? "true" : "false");
      fd.append("approvalEnabled", data.approvalEnabled ? "true" : "false");
      fd.append("unassignedVisibleFields", JSON.stringify(data.unassignedVisibleFields ?? ["platformLink", "creatorName"]));
      fd.append("exportEnabledRoles", JSON.stringify(data.exportEnabledRoles ?? []));
      fd.append("exportEnabledUserIds", JSON.stringify(data.exportEnabledUserIds ?? []));
      if (logoFile) {
        fd.append("logo", logoFile);
      } else if (removeLogo) {
        fd.append("removeLogo", "true");
      }

      const res = await fetch("/api/settings", {
        method: "PUT",
        body: fd,
      });
      const j = await res.json();
      if (!res.ok) {
        return toast({ title: j.error ?? "Could not save settings", variant: "destructive" });
      }
      setRemoveLogo(false);
      setLogoFile(null);
      toast({ title: "Settings saved" });
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof SettingsData>(key: K, value: SettingsData[K]) =>
    setData((d) => (d ? { ...d, [key]: value } : d));

  const previewUrl = logoFile ? URL.createObjectURL(logoFile) : removeLogo ? "" : data.logoUrl;

  const addTeam = async () => {
    const name = newTeamName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const j = await res.json();
      if (!res.ok) {
        return toast({ title: j.error ?? "Could not add team", variant: "destructive" });
      }
      setNewTeamName("");
      toast({ title: `${name} added` });
      await loadTeams();
    } finally {
      setBusy(false);
    }
  };

  const renameTeam = async (id: string) => {
    const name = editName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/teams/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const j = await res.json();
      if (!res.ok) {
        return toast({ title: j.error ?? "Could not rename team", variant: "destructive" });
      }
      setEditingId(null);
      toast({ title: "Team renamed" });
      await loadTeams();
    } finally {
      setBusy(false);
    }
  };

  const deleteTeam = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/teams/${id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) {
        return toast({ title: j.error ?? "Could not delete team", variant: "destructive" });
      }
      setConfirmDeleteId(null);
      toast({ title: "Team deleted" });
      await loadTeams();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Workspace settings</h1>
          <p className="text-sm text-muted-foreground">
            Controlled by the admin. Changes apply across the workspace.
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          <Save className="mr-1 h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Branding</CardTitle>
          <CardDescription>
            The workspace name, logo, and accent color shown across the app and on the login
            screen.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ws-name">Workspace name</Label>
            <Input id="ws-name" value={data.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Workspace logo</Label>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-accent">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Workspace logo preview"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-xs font-bold text-muted-foreground">
                    {data.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent">
                  <Upload className="h-4 w-4" />
                  {logoFile || data.logoUrl ? "Replace logo" : "Attach logo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setLogoFile(f);
                      if (f) setRemoveLogo(false);
                    }}
                  />
                </label>
                {(logoFile || data.logoUrl) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setLogoFile(null);
                      setRemoveLogo(true);
                    }}
                  >
                    <X className="mr-1 h-4 w-4" /> Remove
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Upload an image file; a URL is no longer used for the logo.
            </p>
          </div>
          <div className="space-y-3 sm:col-span-2">
            <Label>Accent color</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(BRAND_COLORS).map(([id, c]) => {
                const selected = data.primaryColor === id;
                return (
                  <button
                    key={id}
                    type="button"
                    title={c.label}
                    aria-label={c.label}
                    aria-pressed={selected}
                    onClick={() => set("primaryColor", id)}
                    className={`flex h-9 w-9 items-center justify-center rounded-full transition-transform ${
                      selected ? "scale-110 ring-2 ring-ring ring-offset-2" : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: c.light.primary }}
                  >
                    {selected && (
                      <span
                        className="text-sm font-bold"
                        style={{ color: c.light.primaryForeground }}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Teams</CardTitle>
          <CardDescription>
            Create, rename, or delete the teams that own and work creators. A team with
            members, engagements, pipeline configuration, or assigned creators cannot be
            deleted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadError && <p className="text-sm text-destructive">{loadError}</p>}
          <div className="divide-y rounded-lg border">
            {teams.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                {editingId === t.id ? (
                  <>
                    <Input
                      autoFocus
                      value={editName}
                      maxLength={40}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void renameTeam(t.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <Button size="sm" disabled={busy} onClick={() => void renameTeam(t.id)}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.slug} · {t.userCount} members · {t.creatorCount} creators ·{" "}
                        {t.engagementCount} engagements{t.isMine ? " · you" : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Rename ${t.name}`}
                      onClick={() => {
                        setEditingId(t.id);
                        setEditName(t.name);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {confirmDeleteId === t.id ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => void deleteTeam(t.id)}
                      >
                        Confirm
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Delete ${t.name}`}
                        disabled={t.isMine}
                        onClick={() => setConfirmDeleteId(t.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            ))}
            {teams.length === 0 && !loadError && (
              <p className="px-3 py-4 text-sm text-muted-foreground">No teams yet.</p>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={newTeamName}
              maxLength={40}
              placeholder="New team name"
              onChange={(e) => setNewTeamName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void addTeam();
              }}
            />
            <Button disabled={busy || !newTeamName.trim()} onClick={() => void addTeam()}>
              <Plus className="mr-1 h-4 w-4" /> Add team
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Creator approval</CardTitle>
          <CardDescription>
            Approval flow and the gender choices offered when a creator is added.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Toggle
            label="Require Team Manager approval for new creators"
            checked={data.approvalEnabled}
            onChange={(v) => set("approvalEnabled", v)}
          />
          <div className="space-y-2">
            <Label>Gender options</Label>
            <div className="flex flex-wrap gap-2">
              {data.genderOptions.map((g, i) => (
                <span
                  key={`${g}-${i}`}
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm"
                >
                  {g}
                  <button
                    type="button"
                    aria-label={`Remove ${g}`}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      set(
                        "genderOptions",
                        data.genderOptions.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                id="new-gender"
                placeholder="Add an option (e.g. Male)"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (v && !data.genderOptions.includes(v)) set("genderOptions", [...data.genderOptions, v]);
                    (e.target as HTMLInputElement).value = "";
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={() => {
                  const input = document.getElementById("new-gender") as HTMLInputElement | null;
                  const v = input?.value.trim() ?? "";
                  if (v && !data.genderOptions.includes(v)) set("genderOptions", [...data.genderOptions, v]);
                  if (input) input.value = "";
                }}
              >
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              At least one option is required. Changes save with the main Save button.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Unassigned team visibility</CardTitle>
          <CardDescription>
            Control which creator details an unassigned team can view when inspecting another team&apos;s creator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Unassigned teams always see the creator&apos;s status, stage and activity log. The platform link and creator
            name are always shown to any user; choose which additional creator fields an unassigned team may see.
          </p>
          {[
            { key: "platformLink", title: "Platform link", desc: "Always shown (mandatory)." },
            { key: "creatorName", title: "Creator name", desc: "Always shown (mandatory)." },
            { key: "city", title: "City", desc: "Show the creator's city to unassigned teams." },
            { key: "phone", title: "Phone", desc: "Show the creator's phone number to unassigned teams." },
            { key: "email", title: "Email", desc: "Show the creator's email to unassigned teams." },
            { key: "followers", title: "Followers", desc: "Show follower counts to unassigned teams." },
            { key: "engagementRate", title: "Engagement rate", desc: "Show engagement rate to unassigned teams." },
            { key: "creatorType", title: "Creator type", desc: "Show the creator type to unassigned teams." },
            { key: "shopify", title: "Shopify status", desc: "Show Shopify registration status to unassigned teams." },
          ].map(({ key, title, desc }) => {
            const mandatory = key === "platformLink" || key === "creatorName";
            return (
              <div key={key} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <Toggle
                  label=""
                  checked={(data.unassignedVisibleFields ?? ["platformLink", "creatorName"]).includes(key)}
                  disabled={mandatory}
                  onChange={
                    mandatory
                      ? () => {}
                      : (v) =>
                          set(
                            "unassignedVisibleFields",
                            v
                              ? Array.from(new Set([...(data.unassignedVisibleFields ?? []), key]))
                              : (data.unassignedVisibleFields ?? []).filter((f) => f !== key),
                          )
                  }
                />
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            The platform link and creator name are always visible. Changes save with the main Save button.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Creator fields</CardTitle>
          <CardDescription>
            Which fields appear on a creator record, whether they are mandatory, and any
            custom fields beyond the built-ins.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Toggle
            label="Show admin-created custom fields in the creator form"
            checked={data.customFieldsEnabled}
            onChange={(v) => set("customFieldsEnabled", v)}
          />
          <FieldList
            refData={refData}
            onChanged={loadReference}
            onToast={(title, variant) => toast({ title, variant })}
          />
          <div className="space-y-2">
            <div>
              <Label>Niche options</Label>
              <p className="text-xs text-muted-foreground">
                Choices offered when adding or editing a creator&apos;s niche.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.nicheOptions.map((g, i) => (
                <span
                  key={`${g}-${i}`}
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm"
                >
                  {g}
                  <button
                    type="button"
                    aria-label={`Remove ${g}`}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      set("nicheOptions", data.nicheOptions.filter((_, j) => j !== i))
                    }
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                id="new-niche"
                placeholder="Add an option (e.g. Fashion)"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (v && !data.nicheOptions.includes(v)) set("nicheOptions", [...data.nicheOptions, v]);
                    (e.target as HTMLInputElement).value = "";
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={() => {
                  const input = document.getElementById("new-niche") as HTMLInputElement | null;
                  const v = input?.value.trim() ?? "";
                  if (v && !data.nicheOptions.includes(v)) set("nicheOptions", [...data.nicheOptions, v]);
                  if (input) input.value = "";
                }}
              >
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reference data</CardTitle>
          <CardDescription>
            Countries (with phone dial codes and cities) and creator types used when
            building creator records. Entries in use cannot be deleted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RefList
            refData={refData}
            onChanged={loadReference}
            onToast={(title, variant) => toast({ title, variant })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stages & pipeline</CardTitle>
          <CardDescription>
            Create, rename, reorder, and delete outreach stages. Every team starts from the same
            global list; each team keeps its own order. Stages with active engagements cannot be
            deleted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StagesCard />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shopify module</CardTitle>
          <CardDescription>
            Control when the Shopify module becomes available on a creator&apos;s profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Minimum stage to show the Shopify module</Label>
            <Select
              value={data.shopifyMinStageId ?? "none"}
              onValueChange={(v) => set("shopifyMinStageId", v === "none" ? null : v)}
            >
              <SelectTrigger className="w-full sm:max-w-xs">
                <SelectValue placeholder="No minimum stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No minimum stage</SelectItem>
                {data.stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Password policy</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Toggle
            label="Multiple teams may work one creator"
            checked={data.multiTeam}
            onChange={(v) => set("multiTeam", v)}
          />
          <Toggle
            label="Multiple owners may be assigned"
            checked={data.multiOwner}
            onChange={(v) => set("multiOwner", v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inactivity & availability pool</CardTitle>
          <CardDescription>
            Creators with no activity for these many days are released to the pool.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="inact-same">Same-team pool (days)</Label>
            <Input
              id="inact-same"
              type="number"
              min={1}
              value={data.inactivitySameTeamDays}
              onChange={(e) => set("inactivitySameTeamDays", Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inact-company">Company-wide pool (days)</Label>
            <Input
              id="inact-company"
              type="number"
              min={1}
              value={data.inactivityCompanyDays}
              onChange={(e) => set("inactivityCompanyDays", Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gifting rules</CardTitle>
          <CardDescription>Hard stop on gifts per month and per creator.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Toggle
            label="One gift per creator per month"
            checked={data.giftMonthlyCapEnabled}
            onChange={(v) => set("giftMonthlyCapEnabled", v)}
          />
          <Toggle
            label="Require previous gift's deliverables before the next gift"
            checked={data.giftRequirePreviousDeliverable}
            onChange={(v) => set("giftRequirePreviousDeliverable", v)}
          />
          <div className="space-y-1.5">
            <Label>Minimum stage for sending a gift</Label>
            <Select
              value={data.giftMinStageId ?? "none"}
              onValueChange={(v) => set("giftMinStageId", v === "none" ? null : v)}
            >
              <SelectTrigger className="w-full sm:max-w-xs">
                <SelectValue placeholder="No minimum stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No minimum stage</SelectItem>
                {data.stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Password policy</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pw-min">Minimum length</Label>
            <Input
              id="pw-min"
              type="number"
              min={6}
              value={data.passwordMinLength}
              onChange={(e) => set("passwordMinLength", Number(e.target.value))}
            />
          </div>
          <Toggle
            label="Require complexity (upper, lower, digit, symbol)"
            checked={data.passwordComplexity}
            onChange={(v) => set("passwordComplexity", v)}
          />
        </CardContent>
      </Card>

      <ExportCard
        roles={data.exportEnabledRoles}
        userIds={data.exportEnabledUserIds}
        onRolesChange={(v) => set("exportEnabledRoles", v)}
        onUserIdsChange={(v) => set("exportEnabledUserIds", v)}
      />
    </div>
  );
}

function ExportCard({
  roles,
  userIds,
  onRolesChange,
  onUserIdsChange,
}: {
  roles: string[];
  userIds: string[];
  onRolesChange: (roles: string[]) => void;
  onUserIdsChange: (userIds: string[]) => void;
}) {
  const [users, setUsers] = React.useState<
    { id: string; displayName: string; roleName: string; teamName: string }[]
  >([]);
  const [rolesList, setRolesList] = React.useState<{ slug: string; name: string }[]>([]);

  React.useEffect(() => {
    fetch("/api/users")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setUsers((d.users ?? []).filter((u: { archivedAt: string | null }) => !u.archivedAt));
        setRolesList(
          (d.roles ?? []).filter((r: { slug: string; immutable?: boolean }) => !r.immutable && r.slug !== "admin"),
        );
      })
      .catch(() => {});
  }, []);

  const toggleRole = (slug: string) =>
    onRolesChange(
      roles.includes(slug) ? roles.filter((s) => s !== slug) : [...roles, slug],
    );
  const toggleUser = (id: string) =>
    onUserIdsChange(
      userIds.includes(id) ? userIds.filter((s) => s !== id) : [...userIds, id],
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">CSV export access</CardTitle>
        <CardDescription>
          Control who can export creators to CSV. Admins can always export. Enable whole roles
          and/or specific team members below.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="space-y-2">
          <Label>Roles</Label>
          {rolesList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No exportable roles available.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {rolesList.map((r) => (
                <Toggle
                  key={r.slug}
                  label={r.name}
                  checked={roles.includes(r.slug)}
                  onChange={() => toggleRole(r.slug)}
                />
              ))}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label>Specific team members</Label>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active users found.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {users.map((u) => (
                <Toggle
                  key={u.id}
                  label={`${u.displayName} · ${u.roleName}${u.teamName ? ` (${u.teamName})` : ""}`}
                  checked={userIds.includes(u.id)}
                  onChange={() => toggleUser(u.id)}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm hover:bg-accent",
        disabled && "cursor-not-allowed opacity-60 hover:bg-transparent",
      )}
    >
      <span>{label}</span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-input"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-background transition-all ${
            checked ? "left-[18px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

const FIELD_TYPES: { value: string; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Single select" },
  { value: "boolean", label: "Yes / No" },
];

function patchRef({ kind, id, body }: { kind: string; id: string; body: Record<string, unknown> }) {
  return fetch(`/api/reference/${id}?kind=${kind}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (res) => ({ ok: res.ok, error: res.ok ? "" : (await res.json()).error }));
}

function deleteRef({ kind, id }: { kind: string; id: string }) {
  return fetch(`/api/reference/${id}?kind=${kind}`, { method: "DELETE" }).then(async (res) => ({
    ok: res.ok,
    error: res.ok ? "" : (await res.json()).error,
  }));
}

function FieldList({
  refData,
  onChanged,
  onToast,
}: {
  refData: ReferenceData | null;
  onChanged: () => Promise<void>;
  onToast: (title: string, variant?: "default" | "destructive" | "success") => void;
}) {
  const fields = refData?.fields ?? [];
  const orderable = fields.filter((f) => f.id != null);

  const [newLabel, setNewLabel] = React.useState("");
  const [newType, setNewType] = React.useState("text");
  const [newOptions, setNewOptions] = React.useState("");
  const [drafts, setDrafts] = React.useState<Record<string, { label: string; options: string }>>({});
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const patch = async (f: RefField, body: Record<string, unknown>) => {
    if (!f.id) return;
    setBusyId(f.id);
    const r = await patchRef({ kind: "field", id: f.id, body });
    if (!r.ok) onToast(r.error || "Could not update field", "destructive");
    else {
      onToast("Field updated", "success");
      await onChanged();
    }
    setBusyId(null);
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const target = orderable[idx + dir];
    const from = orderable[idx];
    if (!from.id || !target.id) return;
    const a = from.order;
    const b = target.order;
    await patchRef({ kind: "field", id: from.id, body: { order: b } });
    await patchRef({ kind: "field", id: target.id, body: { order: a } });
    await onChanged();
  };

  const addCustom = async () => {
    const label = newLabel.trim();
    if (!label) return onToast("A label is required", "destructive");
    const options = newType === "select" ? newOptions.split(",").map((s) => s.trim()).filter(Boolean) : [];
    if (newType === "select" && options.length === 0) return onToast("Select fields need at least one option", "destructive");
    const res = await fetch("/api/reference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "field", label, type: newType, options }),
    });
    const j = await res.json();
    if (!res.ok) return onToast(j.error ?? "Could not add field", "destructive");
    onToast("Field added", "success");
    setNewLabel("");
    setNewOptions("");
    setNewType("text");
    await onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="divide-y rounded-lg border">
        {fields.map((f, i) => {
          const draft = drafts[f.id ?? f.label] ?? { label: f.label, options: f.options.join(", ") };
          const isSystem = f.id != null && fields.some((x) => x.id === f.id && x.key != null);
          const isCustom = f.id != null && !isSystem;
          const locked = f.key === "name" || f.key === "gender" || f.id == null;
          return (
            <div key={f.id ?? f.key ?? f.label} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              {isCustom ? (
                <Input
                  className="w-44"
                  value={draft.label}
                  onChange={(e) => setDrafts((d) => ({ ...d, [f.id as string]: { ...(d[f.id as string] ?? { options: f.options.join(", ") }), label: e.target.value } }))}
                  onBlur={() => {
                    const v = draft.label.trim();
                    if (v && v !== f.label) void patch(f, { label: v });
                  }}
                />
              ) : (
                <span className="w-44 truncate text-sm font-medium">
                  {f.label}
                  {f.id == null ? <span className="ml-1 text-xs font-normal text-muted-foreground">built-in</span> : null}
                </span>
              )}
              {isCustom ? (
                <Select value={f.type} onValueChange={(t) => void patch(f, { type: t })}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="w-36 text-xs text-muted-foreground">
                  {FIELD_TYPES.find((t) => t.value === f.type)?.label ?? f.type}
                </span>
              )}
              {isCustom && f.type === "select" ? (
                <Input
                  className="w-56"
                  placeholder="Options, comma separated"
                  value={draft.options}
                  onChange={(e) => setDrafts((d) => ({ ...d, [f.id as string]: { ...(d[f.id as string] ?? { label: f.label }), options: e.target.value } }))}
                  onBlur={() => {
                    const v = draft.options.split(",").map((s) => s.trim()).filter(Boolean);
                    if (v.length && v.join(", ") !== f.options.join(", ")) void patch(f, { options: v });
                  }}
                />
              ) : null}
              {locked ? (
                <span className="ml-auto px-2 text-xs text-muted-foreground">
                  {f.key === "gender" ? "always required" : "always on"}
                </span>
              ) : (
                <Toggle
                  label="Required"
                  checked={f.required}
                  onChange={(v) => void patch(f, { required: v })}
                />
              )}
              {isCustom ? (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Delete field"
                  disabled={busyId === f.id}
                  onClick={async () => {
                    const r = await deleteRef({ kind: "field", id: f.id as string });
                    if (!r.ok) onToast(r.error || "Could not delete field", "destructive");
                    else {
                      onToast("Field deleted", "success");
                      await onChanged();
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
              <div className="flex items-center">
                <Button size="icon" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => void move(i, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label="Move down" disabled={i === fields.length - 1} onClick={() => void move(i, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
        <Input className="w-44" placeholder="New field label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
        <Select value={newType} onValueChange={setNewType}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {newType === "select" ? (
          <Input className="w-56" placeholder="Options, comma separated" value={newOptions} onChange={(e) => setNewOptions(e.target.value)} />
        ) : null}
        <Button onClick={() => void addCustom()}>
          <Plus className="mr-1 h-4 w-4" /> Add field
        </Button>
      </div>
    </div>
  );
}

function RefList({
  refData,
  onChanged,
  onToast,
}: {
  refData: ReferenceData | null;
  onChanged: () => Promise<void>;
  onToast: (title: string, variant?: "default" | "destructive" | "success") => void;
}) {
  const countries = refData?.countries ?? [];
  const creatorTypes = refData?.creatorTypes ?? [];

  const [newCountry, setNewCountry] = React.useState("");
  const [newDial, setNewDial] = React.useState("");
  const [newCity, setNewCity] = React.useState("");
  const [newType, setNewType] = React.useState("");
  const [cityFor, setCityFor] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<{ kind: string; id: string; label: string } | null>(null);
  const [rename, setRename] = React.useState<{ kind: string; id: string; value: string; dial?: string; digits?: string } | null>(null);

  const busy = confirmDelete != null || rename != null;

  const addCountry = async () => {
    const name = newCountry.trim();
    const dial = newDial.trim().replace(/^\+/, "");
    if (!name) return onToast("Country name is required", "destructive");
    if (!/^\d{1,4}$/.test(dial)) return onToast("Dial code must be 1–4 digits", "destructive");
    const res = await fetch("/api/reference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "country", name, dialCode: dial }),
    });
    const j = await res.json();
    if (!res.ok) return onToast(j.error ?? "Could not add country", "destructive");
    setNewCountry("");
    setNewDial("");
    onToast("Country added", "success");
    await onChanged();
  };

  const addCity = async (countryId: string) => {
    const name = newCity.trim();
    if (!name) return onToast("City name is required", "destructive");
    const res = await fetch("/api/reference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "city", name, countryId }),
    });
    const j = await res.json();
    if (!res.ok) return onToast(j.error ?? "Could not add city", "destructive");
    setNewCity("");
    onToast("City added", "success");
    await onChanged();
  };

  const addType = async () => {
    const name = newType.trim();
    if (!name) return onToast("Creator type name is required", "destructive");
    const res = await fetch("/api/reference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "creatorType", name }),
    });
    const j = await res.json();
    if (!res.ok) return onToast(j.error ?? "Could not add creator type", "destructive");
    setNewType("");
    onToast("Creator type added", "success");
    await onChanged();
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    const r = await deleteRef({ kind: confirmDelete.kind, id: confirmDelete.id });
    if (!r.ok) onToast(r.error || "Could not delete", "destructive");
    else {
      onToast("Deleted", "success");
      setConfirmDelete(null);
      await onChanged();
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Countries</p>
        </div>
        <div className="divide-y rounded-lg border">
          {countries.map((c) => (
            <div key={c.id} className="px-3 py-2.5">
              <div className="flex items-center gap-2">
                {rename?.kind === "country" && rename.id === c.id ? (
                  <>
                    <Input
                      autoFocus
                      className="w-40"
                      value={rename.value}
                      onChange={(e) => setRename({ ...rename, value: e.target.value })}
                    />
                    <Input
                      className="w-24"
                      value={rename.dial ?? ""}
                      onChange={(e) => setRename({ ...rename, dial: e.target.value })}
                    />
                    <Input
                      className="w-24"
                      placeholder="Digits"
                      title="Expected phone digits (after the dial code)"
                      value={rename.digits ?? ""}
                      onChange={(e) => setRename({ ...rename, digits: e.target.value })}
                    />
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={async () => {
                        const body: Record<string, string | null> = { name: rename.value };
                        if (rename.dial !== undefined) body.dialCode = rename.dial.replace(/^\+/, "");
                        if (rename.digits !== undefined) {
                          body.phoneDigits = rename.digits.trim() ? rename.digits.replace(/\D/g, "") : null;
                        }
                        const r = await patchRef({ kind: "country", id: c.id, body });
                        if (!r.ok) onToast(r.error || "Could not rename", "destructive");
                        else {
                          onToast("Country updated", "success");
                          setRename(null);
                          await onChanged();
                        }
                      }}
                    >
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRename(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                    <Badge variant="outline">+{c.dialCode.replace(/^\+/, "")}</Badge>
                    {c.phoneDigits != null ? (
                      <span className="text-xs text-muted-foreground">{c.phoneDigits} digits</span>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setRename({ kind: "country", id: c.id, value: c.name, dial: c.dialCode.replace(/^\+/, ""), digits: c.phoneDigits != null ? String(c.phoneDigits) : "" })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete({ kind: "country", id: c.id, label: c.name })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => (cityFor === c.id ? setCityFor(null) : setCityFor(c.id))} disabled={busy}>
                      {cityFor === c.id ? "Hide cities" : `${c.cities.length} cities`}
                    </Button>
                  </>
                )}
              </div>
              {cityFor === c.id ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 pb-1">
                  <Input className="w-48" placeholder="New city name" value={newCity} onChange={(e) => setNewCity(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void addCity(c.id)} />
                  <Button size="sm" variant="outline" onClick={() => void addCity(c.id)}>
                    <Plus className="mr-1 h-4 w-4" /> Add city
                  </Button>
                  <div className="flex w-full flex-wrap gap-1.5">
                    {c.cities.map((city) => (
                      <span key={city.id} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
                        {city.name}
                        <button
                          type="button"
                          aria-label={`Delete ${city.name}`}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={async () => {
                            const r = await deleteRef({ kind: "city", id: city.id });
                            if (!r.ok) onToast(r.error || "Could not delete city", "destructive");
                            else {
                              onToast("City deleted", "success");
                              await onChanged();
                            }
                          }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
          {countries.length === 0 ? <p className="px-3 py-4 text-sm text-muted-foreground">No countries yet. Add the first one below.</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input className="w-40" placeholder="Country name" value={newCountry} onChange={(e) => setNewCountry(e.target.value)} />
          <Input className="w-24" placeholder="+20" value={newDial} onChange={(e) => setNewDial(e.target.value)} />
          <Button onClick={() => void addCountry()}>
            <Plus className="mr-1 h-4 w-4" /> Add country
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Creator types</p>
        <div className="divide-y rounded-lg border">
          {creatorTypes.map((t) => (
            <div key={t.id} className="flex items-center gap-2 px-3 py-2.5">
              {rename?.kind === "creatorType" && rename.id === t.id ? (
                <>
                  <Input
                    autoFocus
                    className="flex-1"
                    value={rename.value}
                    onChange={(e) => setRename({ ...rename, value: e.target.value })}
                  />
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={async () => {
                      const r = await patchRef({ kind: "creatorType", id: t.id, body: { name: rename.value } });
                      if (!r.ok) onToast(r.error || "Could not rename", "destructive");
                      else {
                        onToast("Creator type updated", "success");
                        setRename(null);
                        await onChanged();
                      }
                    }}
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRename(null)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.name}</span>
                  <Button size="sm" variant="ghost" onClick={() => setRename({ kind: "creatorType", id: t.id, value: t.name })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete({ kind: "creatorType", id: t.id, label: t.name })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          ))}
          {creatorTypes.length === 0 ? <p className="px-3 py-4 text-sm text-muted-foreground">No creator types yet.</p> : null}
        </div>
        <div className="flex gap-2">
          <Input placeholder="New creator type" value={newType} onChange={(e) => setNewType(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void addType()} />
          <Button onClick={() => void addType()}>
            <Plus className="mr-1 h-4 w-4" /> Add type
          </Button>
        </div>
      </div>

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle className="text-base">Delete {confirmDelete.label}?</CardTitle>
              <CardDescription>
                This cannot be undone. Entries that are in use cannot be deleted.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => void doDelete()}>
                Delete
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

interface StageRow {
  id: string;
  name: string;
  order: number;
  isCompleted?: boolean;
}

function StagesCard() {
  const [stages, setStages] = React.useState<StageRow[]>([]);
  const [newName, setNewName] = React.useState("");
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await fetch("/api/settings/stages");
    if (!res.ok) return;
    const j = await res.json();
    setStages(j.stages ?? []);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const run = async (method: string, body: unknown) => {
    setBusy(true);
    try {
      const res = await fetch("/api/settings/stages", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const j = await res.json();
      if (!res.ok) {
        toast({ title: j.error ?? "Could not update stages", variant: "destructive" });
        return false;
      }
      await load();
      return true;
    } catch {
      toast({ title: "Could not update stages", variant: "destructive" });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    const ok = await run("POST", { name });
    if (ok) {
      setNewName("");
      toast({ title: `Stage "${name}" added to every pipeline` });
    }
  };

  const rename = async () => {
    if (!renamingId || !renameValue.trim() || busy) return;
    const ok = await run("PATCH", { action: "rename", id: renamingId, name: renameValue.trim() });
    if (ok) {
      setRenamingId(null);
      toast({ title: "Stage renamed" });
    }
  };

  const remove = async () => {
    if (!confirmDeleteId || busy) return;
    const res = await fetch(`/api/settings/stages?id=${confirmDeleteId}`, { method: "DELETE" });
    const j = await res.json();
    if (!res.ok) {
      toast({ title: j.error ?? "Could not delete stage", variant: "destructive" });
      setConfirmDeleteId(null);
      return;
    }
    setConfirmDeleteId(null);
    toast({ title: "Stage deleted" });
    await load();
  };

  return (
    <div className="space-y-4 pt-4">
      {confirmDeleteId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle className="text-base">Delete this stage?</CardTitle>
              <CardDescription>
                Engagements on this stage must be moved first. Teams will lose it from their pipelines.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => void remove()}>
                Delete
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="space-y-1.5">
        {stages.map((s, i) => {
          const renaming = renamingId === s.id;
          return (
            <div key={s.id} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
              {renaming ? (
                <>
                  <Input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void rename()}
                    className="flex-1"
                    autoFocus
                  />
                  <Button size="sm" variant="default" onClick={() => void rename()} disabled={busy}>
                    <Save className="mr-1 h-4 w-4" /> Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRenamingId(null)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span>
                  <div className="flex items-center gap-0.5">
                    <Button size="sm" variant="ghost" disabled={i === 0 || busy} onClick={() => void run("PATCH", { action: "move", id: s.id, dir: -1 })}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" disabled={i === stages.length - 1 || busy} onClick={() => void run("PATCH", { action: "move", id: s.id, dir: 1 })}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Toggle completed stage"
                    onClick={() => void run("PATCH", { action: "toggle-completed", id: s.id, completed: !s.isCompleted })}
                    disabled={busy || s.isCompleted === undefined}
                  >
                    <Star className={cn("h-4 w-4", s.isCompleted ? "fill-amber-400 text-amber-500" : "text-muted-foreground")} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setRenamingId(s.id); setRenameValue(s.name); }}>
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmDeleteId(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          );
        })}
        {stages.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            No stages yet — add the first one below.
          </p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="New stage name (e.g. Negotiation)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void add()}
        />
        <Button onClick={() => void add()} disabled={busy || !newName.trim()}>
          <Plus className="mr-1 h-4 w-4" /> Add stage
        </Button>
      </div>
    </div>
  );
}

function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}