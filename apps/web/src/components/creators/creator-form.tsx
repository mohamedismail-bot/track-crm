"use client";

import * as React from "react";
import { Star, Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { PLATFORM_LABELS, CREATOR_FIELD_TYPE_LABELS, buildE164, handleFromInput, looksLikeUrl, urlPlatformMismatch } from "@/lib/constants";

export type PlatformKey =
  | "INSTAGRAM"
  | "TIKTOK"
  | "YOUTUBE"
  | "X"
  | "SNAPCHAT"
  | "FACEBOOK"
  | "LINKEDIN"
  | "TWITCH"
  | "OTHER";

const PLATFORMS: PlatformKey[] = [
  "INSTAGRAM",
  "TIKTOK",
  "YOUTUBE",
  "X",
  "SNAPCHAT",
  "FACEBOOK",
  "LINKEDIN",
  "TWITCH",
  "OTHER",
];

interface ReferenceCountry {
  id: string;
  name: string;
  dialCode: string;
  cities: { id: string; name: string }[];
}
interface ReferenceField {
  id: string | null;
  key: string | null;
  label: string;
  type: string;
  required: boolean;
  order: number;
  options: string[];
  isSystem: boolean;
}
interface ReferencePayload {
  countries: ReferenceCountry[];
  creatorTypes: { id: string; name: string }[];
  fields: ReferenceField[];
  genderOptions: string[];
  nicheOptions: string[];
  customFieldsEnabled: boolean;
  approvalEnabled: boolean;
}

interface ProfileRow {
  platform: PlatformKey;
  input: string;
  isPrimary: boolean;
}

export interface EditableCreatorInput {
  id?: string;
  name: string;
  email: string | null;
  phone: string | null;
  countryId: string | null;
  cityId: string | null;
  creatorTypeId: string | null;
  gender: string | null;
  shopifyRegistered: boolean | null;
  niche: string | null;
  followers: number | null;
  engagementRate: number | null;
  notes: string | null;
  customFields: Record<string, string | number | boolean | null>;
  profiles: { platform: string; handle: string | null; isPrimary: boolean }[];
  countryValue: string | null;
  cityValue: string | null;
  creatorTypeValue: string | null;
  canEdit?: boolean;
}

interface CreatorFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "create" | "edit";
  initial?: EditableCreatorInput | null;
  onCreated?: (data: { id: string; name: string; pendingApproval?: boolean }) => void;
  onSaved?: () => void;
}

const emptyCustom: Record<string, string | number | boolean | null> = {};

export function CreatorFormDialog({
  open,
  onOpenChange,
  mode = "create",
  initial,
  onCreated,
  onSaved,
}: CreatorFormProps) {
  const [ref, setRef] = React.useState<ReferencePayload | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const [name, setName] = React.useState("");
  const [gender, setGender] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phoneCountryId, setPhoneCountryId] = React.useState("");
  const [phoneDigits, setPhoneDigits] = React.useState("");
  const [countryId, setCountryId] = React.useState("");
  const [cityId, setCityId] = React.useState("");
  const [creatorTypeId, setCreatorTypeId] = React.useState("");
  const [shopify, setShopify] = React.useState(false);
  const [niche, setNiche] = React.useState("");
  const [followers, setFollowers] = React.useState("");
  const [engagementRate, setEngagementRate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [custom, setCustom] = React.useState<Record<string, string | number | boolean | null>>(emptyCustom);
  const [profiles, setProfiles] = React.useState<ProfileRow[]>([]);

  // Inline duplicate-check state (per profile row index).
  const [dupChecks, setDupChecks] = React.useState<Record<number, { state: "idle" | "checking" | "ok" | "dup"; text?: string; url?: string; self?: boolean }>>({});
  const [emailDup, setEmailDup] = React.useState<null | { exists: boolean; self?: boolean }>(null);
  const [phoneDup, setPhoneDup] = React.useState<null | { exists: boolean; self?: boolean }>(null);

  const fetchRef = React.useCallback(async () => {
    const res = await fetch("/api/reference");
    if (!res.ok) return;
    setRef(await res.json());
  }, []);

  React.useEffect(() => {
    if (open) fetchRef();
  }, [open, fetchRef]);

  React.useEffect(() => {
    if (mode === "edit" && initial && open) {
      setName(initial.name ?? "");
      setGender(initial.gender ?? "");
      setEmail(initial.email ?? "");
      setShopify(initial.shopifyRegistered ?? false);
      setNiche(initial.niche ?? "");
      setFollowers(initial.followers?.toString() ?? "");
      setEngagementRate(initial.engagementRate?.toString() ?? "");
      setNotes(initial.notes ?? "");
      setCountryId(initial.countryId ?? "");
      setCityId(initial.cityId ?? "");
      setCreatorTypeId(initial.creatorTypeId ?? "");
      setCustom(initial.customFields ?? {});
      setProfiles(
        (initial.profiles ?? []).map((p) => ({
          platform: (p.platform as PlatformKey) || "OTHER",
          input: p.handle ?? "",
          isPrimary: p.isPrimary,
        })),
      );
      // Phone: split E.164 back into local digits (reuse the last dial code style).
      if (initial.phone) {
        const digits = initial.phone.replace(/^\+\d+/, "");
        setPhoneDigits(digits);
      } else {
        setPhoneDigits("");
      }
      setPhoneCountryId(initial.countryId ?? "");
      setEmailDup(null);
      setPhoneDup(null);
      setDupChecks({});
    }
  }, [mode, initial, open]);

  const refCountries = ref?.countries ?? [];
  const countryOf = (id: string) => refCountries.find((c) => c.id === id);
  const citiesOf = (id: string) => countryOf(id)?.cities ?? [];
  const dialOf = (id: string) => countryOf(id)?.dialCode ?? "";
  const phonePreview = phoneDigits.replace(/\D/g, "") ? buildE164(dialOf(phoneCountryId), phoneDigits) : "";

  const requiredFields = (ref?.fields ?? []).filter((f) => f.required);
  const customFields = (ref?.fields ?? []).filter((f) => f.id != null && !f.isSystem);
  const customFieldsVisible = (ref?.customFieldsEnabled ?? true) && customFields.length > 0;
  const nicheOptions = ref?.nicheOptions ?? [];

  React.useEffect(() => {
    if (!countryId) return;
    const city = citiesOf(countryId);
    if (city.length && !city.some((c) => c.id === cityId)) setCityId("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryId, cityId, ref]);

  React.useEffect(() => {
    if (mode !== "create") return;
    if (profiles.length === 0) {
      setProfiles([{ platform: "INSTAGRAM", input: "", isPrimary: true }]);
    }
  }, [mode, profiles.length]);

  const setProfile = (i: number, patch: Partial<ProfileRow>) =>
    setProfiles((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const markPrimary = (i: number) =>
    setProfiles((prev) => prev.map((p, j) => ({ ...p, isPrimary: j === i })));

  const mutedRows = React.useMemo(() => {
    const map: Record<number, { muted: boolean; detected?: string }> = {};
    profiles.forEach((p, i) => {
      const detected = urlPlatformMismatch(p.input, p.platform);
      if (detected && detected !== "OTHER") {
        map[i] = { muted: true, detected };
      }
    });
    return map;
  }, [profiles]);

  // Debounced inline duplicate checks per row + email + phone.
  React.useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    profiles.forEach((p, i) => {
      const handle = handleFromInput(p.input);
      const muting = mutedRows[i];
      if (!handle || p.input.trim().length === 0 || muting) {
        setDupChecks((d) => ({ ...d, [i]: { state: "idle" } }));
        return;
      }
      timers.push(
        setTimeout(async () => {
          setDupChecks((d) => ({ ...d, [i]: { state: "checking" } }));
          try {
            const res = await fetch(
              `/api/creators/check?platform=${encodeURIComponent(p.platform)}&handle=${encodeURIComponent(handle)}${initial?.id ? `&exclude=${initial.id}` : ""}`,
            );
            const j = await res.json();
            if (res.ok && j.exists && !j.isSelf) {
              setDupChecks((d) => ({
                ...d,
                [i]: { state: "dup", text: `Already linked to ${j.name}`, url: j.url },
              }));
            } else {
              setDupChecks((d) => ({ ...d, [i]: { state: "ok" } }));
            }
          } catch {
            setDupChecks((d) => ({ ...d, [i]: { state: "idle" } }));
          }
        }, 400),
      );
    });
    const emailTimer = setTimeout(async () => {
      const value = email.trim().toLowerCase();
      if (!/.+@.+\..+/.test(value)) {
        setEmailDup(null);
        return;
      }
      try {
        const res = await fetch(`/api/creators/check?platform=EMAIL&handle=${encodeURIComponent(value)}${initial?.id ? `&exclude=${initial.id}` : ""}`);
        const j = await res.json();
        if (res.ok && j.exists && !j.isSelf) setEmailDup({ exists: true });
        else setEmailDup(null);
      } catch {}
    }, 400);
    const phoneTimer = setTimeout(async () => {
      if (!phonePreview) {
        setPhoneDup(null);
        return;
      }
      try {
        const res = await fetch(`/api/creators/check?platform=PHONE&handle=${encodeURIComponent(phonePreview)}${initial?.id ? `&exclude=${initial.id}` : ""}`);
        const j = await res.json();
        if (res.ok && j.exists && !j.isSelf) setPhoneDup({ exists: true });
        else setPhoneDup(null);
      } catch {}
    }, 400);
    timers.push(emailTimer, phoneTimer);
    return () => timers.forEach(clearTimeout);
  }, [profiles, mutedRows, email, phonePreview, initial?.id]);

  const validateLocal = (): string | null => {
    if (!name.trim()) return "Creator name is required.";
    if (mode === "create") {
      if (profiles.length === 0 || !profiles.some((p) => (p.input ?? "").trim() !== "")) {
        return "Add at least one platform profile.";
      }
    }
    if (mode === "create" && !gender) return "Gender is required.";
    if (phoneDigits.replace(/\D/g, "") && !phoneCountryId) return "Pick a country dial code for the phone.";
    for (const [i, p] of profiles.entries()) {
      const trimmed = p.input.trim();
      if (!trimmed) continue;
      const handle = handleFromInput(trimmed);
      if (!handle) return looksLikeUrl(trimmed) ? "Could not read a handle from that link." : "A handle cannot contain spaces or slashes.";
      const muted = mutedRows[i];
      if (muted) return `That looks like a ${muted.detected} link — different from the selected platform.`;
      const check = dupChecks[i];
      if (check?.state === "dup") return `@${handle} is already linked to another creator.`;
    }
    if (email.trim() && !/.+@.+\..+/.test(email.trim())) return "Email must be a valid email address.";
    for (const f of customFields) {
      const value = custom[f.id!];
      const isEmpty = value == null || value === "";
      if (f.required && isEmpty) return `${f.label} is required.`;
      if (f.type === "select" && !isEmpty && f.options.length && !f.options.includes(String(value))) {
        return `"${String(value)}" is not an option for ${f.label}.`;
      }
    }
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const localError = validateLocal();
    if (localError) return toast({ title: localError, variant: "destructive" });

    const body: Record<string, unknown> = {
      name: name.trim(),
      email: email.trim() || undefined,
      phoneNumber: phoneDigits.replace(/\D/g, ""),
      phoneCountryId: phoneDigits.replace(/\D/g, "") ? phoneCountryId : undefined,
      countryId: countryId || undefined,
      cityId: cityId || undefined,
      creatorTypeId: creatorTypeId || undefined,
      gender: gender || undefined,
      shopifyRegistered: shopify,
      niche: niche.trim() || undefined,
      followers: followers ? Number(followers) : undefined,
      engagementRate: engagementRate ? Number(engagementRate) : undefined,
      notes: notes.trim() || undefined,
      customFields: custom,
      profiles: profiles
        .filter((p) => p.input.trim())
        .map((p) => ({ platform: p.platform, input: p.input.trim(), isPrimary: p.isPrimary })),
    };

    setSubmitting(true);
    try {
      if (mode === "create") {
        const res = await fetch("/api/creators", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return toast({ title: data.error ?? "Could not create creator", variant: "destructive" });
        toast({
          title: data.pendingApproval ? "Creator created — pending approval" : "Creator created",
          description: data.name,
        });
        onOpenChange(false);
        onCreated?.(data);
      } else {
        if (!initial?.id) return;
        const res = await fetch(`/api/creators/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return toast({ title: data.error ?? "Could not save changes", variant: "destructive" });
        toast({ title: "Saved" });
        onOpenChange(false);
        onSaved?.();
      }
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCustomChange = (fieldId: string, value: string | number | boolean | null) => {
    setCustom((prev) => ({ ...prev, [fieldId]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add creator" : `Edit ${initial?.name ?? "creator"}`}</DialogTitle>
          <DialogDescription>
            Track the person, not the profile. Platform handles accept bare, @-prefixed or full links.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-6">
          {/* Identity */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cf-name" className="inline-flex items-center gap-1">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input id="cf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Creator name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-gender" className="inline-flex items-center gap-1">
                Gender <span className="text-destructive">*</span>
              </Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger id="cf-gender">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {(ref?.genderOptions ?? []).map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cf-email">Email {requiredFields.some((f) => f.key === "email") ? <span className="text-destructive">*</span> : null}</Label>
              <Input
                id="cf-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
              {email.trim() && !/.+@.+\..+/.test(email.trim()) ? (
                <p className="text-xs text-destructive">Enter a valid email address.</p>
              ) : null}
              {emailDup ? <p className="text-xs text-destructive">A creator with this email already exists.</p> : null}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cf-phone">Phone {requiredFields.some((f) => f.key === "phone") ? <span className="text-destructive">*</span> : null}</Label>
              <div className="flex gap-2">
                <Select value={phoneCountryId} onValueChange={setPhoneCountryId}>
                  <SelectTrigger className="w-32 shrink-0">
                    <SelectValue placeholder="Dial code" />
                  </SelectTrigger>
                  <SelectContent>
                    {(refCountries ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.dialCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  id="cf-phone"
                  inputMode="numeric"
                  value={phoneDigits}
                  onChange={(e) => setPhoneDigits(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="1001234567 (digits only)"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {phonePreview ? `Stored as ${phonePreview}` : "Digits only — no spaces or dashes."}
              </p>
              {phoneDup ? <p className="text-xs text-destructive">A creator with this phone already exists.</p> : null}
            </div>
          </div>

          {/* Location + classification */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="cf-country">Country {requiredFields.some((f) => f.key === "country") ? <span className="text-destructive">*</span> : null}</Label>
              <Select
                value={countryId}
                onValueChange={(v) => {
                  setCountryId(v);
                  setCityId("");
                }}
              >
                <SelectTrigger id="cf-country">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {refCountries.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-city">City {requiredFields.some((f) => f.key === "city") ? <span className="text-destructive">*</span> : null}</Label>
              <Select value={cityId} onValueChange={setCityId} disabled={!countryId}>
                <SelectTrigger id="cf-city">
                  <SelectValue placeholder={countryId ? "Select city" : "Pick a country first"} />
                </SelectTrigger>
                <SelectContent>
                  {citiesOf(countryId).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-type">Creator type {requiredFields.some((f) => f.key === "creatorType") ? <span className="text-destructive">*</span> : null}</Label>
              <Select value={creatorTypeId} onValueChange={setCreatorTypeId}>
                <SelectTrigger id="cf-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {(ref?.creatorTypes ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Audiences + notes */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="cf-followers">Followers</Label>
              <Input id="cf-followers" type="number" value={followers} onChange={(e) => setFollowers(e.target.value)} placeholder="120000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-er">Engagement rate (%)</Label>
              <Input id="cf-er" type="number" step="0.1" value={engagementRate} onChange={(e) => setEngagementRate(e.target.value)} placeholder="3.5" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-shopify" className="inline-flex items-center gap-2 pt-6">
                <input
                  id="cf-shopify"
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={shopify}
                  onChange={(e) => setShopify(e.target.checked)}
                />
                Registered on Shopify
              </Label>
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="cf-niche" className="inline-flex items-center gap-1">
                Niche{" "}
                {requiredFields.some((f) => f.key === "niche") ? <span className="text-destructive">*</span> : null}
              </Label>
              <Select value={niche} onValueChange={setNiche}>
                <SelectTrigger id="cf-niche">
                  <SelectValue placeholder={nicheOptions.length ? "Select niche" : "No niche options yet"} />
                </SelectTrigger>
                <SelectContent>
                  {niche && !nicheOptions.includes(niche) ? <SelectItem value={niche}>{niche}</SelectItem> : null}
                  {nicheOptions.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!nicheOptions.length ? (
                <p className="text-xs text-muted-foreground">
                  Add niche options in Workspace settings → Creator fields.
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="cf-notes">Notes</Label>
              <Input id="cf-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything relevant about this creator" />
            </div>
          </div>

          {/* Custom fields */}
          {customFieldsVisible ? (
            <div className="space-y-3 rounded-lg border p-4">
              <Label className="text-sm font-semibold">Custom fields</Label>
              {customFields.map((f) => (
                <CustomFieldInput key={f.id} field={f} value={custom[f.id!] ?? ""} onChange={(v) => handleCustomChange(f.id!, v)} />
              ))}
            </div>
          ) : null}

          {/* Platform profiles */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">
              Platform profiles {mode === "create" ? <span className="text-destructive">*</span> : null}
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((p) => {
                const active = profiles.some((r) => r.platform === p);
                return (
                  <Button
                    key={p}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    className="text-xs"
                    onClick={() => {
                      if (active) {
                        setProfiles((prev) => prev.filter((r) => r.platform !== p));
                      } else {
                        setProfiles((prev) => [
                          ...prev,
                          { platform: p, input: "", isPrimary: prev.length === 0 },
                        ]);
                      }
                      setDupChecks({});
                    }}
                  >
                    {PLATFORM_LABELS[p]}
                  </Button>
                );
              })}
            </div>
            {profiles.map((row, i) => {
              const check = dupChecks[i];
              const muted = mutedRows[i];
              return (
                <div key={`${row.platform}-${i}`} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-24 shrink-0 truncate text-xs font-medium">
                      {PLATFORM_LABELS[row.platform]}
                    </span>
                    <Input
                      value={row.input}
                      onChange={(e) => setProfile(i, { input: e.target.value })}
                      placeholder={row.platform === "OTHER" ? "e.g. tiktok.com/myname or @myname" : `e.g. @handle or a ${PLATFORM_LABELS[row.platform].toLowerCase()} link`}
                      className={muted ? "border-destructive" : ""}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      title={row.isPrimary ? "Primary profile" : "Make primary"}
                      className={row.isPrimary ? "text-amber-500" : "text-muted-foreground"}
                      onClick={() => markPrimary(i)}
                    >
                      <Star className="h-4 w-4" fill={row.isPrimary ? "currentColor" : "none"} />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="shrink-0 text-muted-foreground"
                      onClick={() => setProfiles((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {muted ? (
                    <p className="text-xs text-destructive">
                      That looks like a {muted.detected} link — different from the selected platform.
                    </p>
                  ) : check?.state === "checking" ? (
                    <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Checking…
                    </p>
                  ) : check?.state === "dup" ? (
                    <p className="inline-flex items-center gap-2 text-xs text-destructive">
                      {check.text}
                      {check.url ? (
                        <a href={check.url} target="_blank" rel="noreferrer" className="text-primary underline">
                          View profile →
                        </a>
                      ) : null}
                    </p>
                  ) : null}
                </div>
              );
            })}
            {mode === "edit" && profiles.length === 0 ? (
              <p className="text-xs text-destructive">A creator needs at least one platform profile.</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? "Saving…"
                : mode === "create"
                  ? "Create creator"
                  : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CustomFieldInput({
  field,
  value,
  onChange,
}: {
  field: ReferenceField;
  value: string | number | boolean | null;
  onChange: (v: string | number | boolean | null) => void;
}) {
  const label = `${field.label}${field.required ? " *" : ""} (${CREATOR_FIELD_TYPE_LABELS[field.type] ?? ""})`;
  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 accent-primary"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
        {label}
      </label>
    );
  }
  if (field.type === "select") {
    return (
      <div className="grid items-center gap-2 sm:grid-cols-[220px_1fr]">
        <Label>{label}</Label>
        <Select value={String(value ?? "")} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">—</SelectItem>
            {field.options.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (field.type === "date") {
    return (
      <div className="grid items-center gap-2 sm:grid-cols-[220px_1fr]">
        <Label>{label}</Label>
        <Input type="date" value={String(value ?? "").slice(0, 10)} onChange={(e) => onChange(e.target.value || null)} />
      </div>
    );
  }
  if (field.type === "number") {
    return (
      <div className="grid items-center gap-2 sm:grid-cols-[220px_1fr]">
        <Label>{label}</Label>
        <Input type="number" value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
      </div>
    );
  }
  return (
    <div className="grid items-center gap-2 sm:grid-cols-[220px_1fr]">
      <Label>{label}</Label>
      {field.type === "textarea" ? (
        <textarea
          className="min-h-16 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value || null)}
        />
      ) : (
        <Input value={String(value ?? "")} onChange={(e) => onChange(e.target.value || null)} />
      )}
    </div>
  );
}