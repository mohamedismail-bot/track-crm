"use client";

import * as React from "react";
import { Pencil, Plus, Save, Trash2, Upload, X } from "lucide-react";
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
  exportEnabledRoles: string[];
  passwordMinLength: number;
  passwordComplexity: boolean;
  stages: { id: string; name: string; isCompleted: boolean }[];
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

  React.useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
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
  }, [loadTeams]);

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
      fd.append("passwordMinLength", String(data.passwordMinLength));
      fd.append("passwordComplexity", data.passwordComplexity ? "true" : "false");
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
          <CardTitle className="text-base">Ownership policy</CardTitle>
          <CardDescription>Who may work a single creator.</CardDescription>
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
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm hover:bg-accent"
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