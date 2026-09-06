"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Save, Trash2, Upload, X } from "lucide-react";
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
  exportEnabledRoles: string[];
  passwordMinLength: number;
  passwordComplexity: boolean;
  genderOptions: string[];
  approvalEnabled: boolean;
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
  countries: { id: string; name: string; dialCode: string; cities: { id: string; name: string }[] }[];
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
    setData((prev) => (prev ? { ...prev, genderOptions: d.genderOptions ?? prev.genderOptions, approvalEnabled: d.approvalEnabled ?? prev.approvalEnabled } : prev));
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
      fd.append("passwordMinLength", String(data.passwordMinLength));
      fd.append("passwordComplexity", data.passwordComplexity ? "true" : "false");
      fd.append("genderOptions", JSON.stringify(data.genderOptions));
      fd.append("approvalEnabled", data.approvalEnabled ? "true" : "false");
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
          <CardTitle className="text-base">Creator fields</CardTitle>
          <CardDescription>
            Which fields appear on a creator record, whether they are mandatory, and any
            custom fields beyond the built-ins.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldList
            refData={refData}
            onChanged={loadReference}
            onToast={(title, variant) => toast({ title, variant })}
          />
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
  const [rename, setRename] = React.useState<{ kind: string; id: string; value: string; dial?: string } | null>(null);

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
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={async () => {
                        const body: Record<string, string> = { name: rename.value };
                        if (rename.dial !== undefined) body.dialCode = rename.dial.replace(/^\+/, "");
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
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setRename({ kind: "country", id: c.id, value: c.name, dial: c.dialCode.replace(/^\+/, "") })}
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