"use client";

import * as React from "react";
import Link from "next/link";
import { Star, Trash2, Loader2, ShieldAlert } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { toast } from "@/components/ui/toast";
import {
  PLATFORM_LABELS,
  CREATOR_FIELD_TYPE_LABELS,
  buildE164,
  handleFromInput,
  looksLikeUrl,
  urlPlatformMismatch,
  strictProfileEntryError,
} from "@/lib/constants";

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
  phoneDigits: number | null;
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
interface OwnerOption {
  id: string;
  displayName: string;
  teamId: string | null;
  teamName: string | null;
  roleSlug: string;
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
  niche: string[] | null;
  followers: number | null;
  engagementRate: number | null;
  notes: string | null;
  customFields: Record<string, string | number | boolean | null>;
  profiles: { platform: string; handle: string | null; url?: string | null; isPrimary: boolean }[];
  owners?: { id: string; displayName: string; teamId: string | null; roleSlug: string }[] | null;
  canEditOwners?: boolean;
  countryValue: string | null;
  cityValue: string | null;
  creatorTypeValue: string | null;
  canEdit?: boolean;
  canEditProtected?: boolean;
  /** Fields this non-admin user is allowed to edit (admin-granted per-field grants). */
  allowedFields?: string[];
  canEditAllFields?: boolean;
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
  const [niche, setNiche] = React.useState<string[]>([]);
  const [workerOwnerIds, setWorkerOwnerIds] = React.useState<string[]>([]);
  const [ownerOptions, setOwnerOptions] = React.useState<OwnerOption[]>([]);
  const [hardOwnerIds, setHardOwnerIds] = React.useState<string[]>([]);
  const [me, setMe] = React.useState<{ id: string; teamId: string | null; roleSlug: string | null } | null>(null);
  const [followers, setFollowers] = React.useState("");
  const [engagementRate, setEngagementRate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [custom, setCustom] = React.useState<Record<string, string | number | boolean | null>>(emptyCustom);
  const [profiles, setProfiles] = React.useState<ProfileRow[]>([]);
  const [stages, setStages] = React.useState<{ id: string; name: string }[]>([]);
  const [stageId, setStageId] = React.useState("");

  // Inline duplicate-check state (per profile row index).
  const [dupChecks, setDupChecks] = React.useState<Record<number, { state: "idle" | "checking" | "ok" | "dup"; text?: string; url?: string; creatorId?: string; self?: boolean }>>({});
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

  // Create mode: default the dial code to Egypt (+20) once reference data is
  // available, and load the assign-to owner list (same team).
  React.useEffect(() => {
    if (!open || mode !== "create") return;
    let cancelled = false;
    (async () => {
      const me = await fetch("/api/me").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const opts = await fetch("/api/creators/options")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (cancelled) return;
      const owners: OwnerOption[] = (opts?.owners ?? []).map(
        (o: { id: string; displayName: string; teamId: string; roleSlug: string }) => ({
          id: o.id,
          displayName: o.displayName,
          teamId: o.teamId ?? null,
          teamName: null,
          roleSlug: o.roleSlug ?? "",
        }),
      );
      setOwnerOptions(owners);
      // Admin(s) and the acting user's Team Manager(s) are always owners on the
      // backend — mirror that in the form as locked, non-removable selections.
      const hard = owners
        .filter(
          (o) =>
            o.roleSlug === "admin" ||
            (o.roleSlug === "team-manager" && o.teamId === (me?.teamId ?? null)),
        )
        .map((o) => o.id);
      setHardOwnerIds(hard);
      if (me?.id) {
        setMe((prev) => prev ?? { id: me.id, teamId: me.teamId ?? null, roleSlug: me.roleSlug ?? null });
        setWorkerOwnerIds((prev) => (prev.length ? prev : [me.id]));
      }
      const stageList = (opts?.stages ?? []) as { id: string; name: string }[];
      setStages(stageList);
      if (stageList.length > 0) {
        setStageId((prev) => prev || stageList[0].id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, mode]);

  // Egypt +20 default dial code for an empty phone country selection.
  React.useEffect(() => {
    const countries = ref?.countries ?? [];
    if (mode !== "create" || phoneCountryId || !countries.length) return;
    const egypt =
      countries.find((c) => c.name.toLowerCase() === "egypt") ??
      countries.find((c) => c.dialCode === "+20") ??
      countries[0];
    if (egypt) setPhoneCountryId(egypt.id);
  }, [mode, phoneCountryId, ref]);

  // Edit mode: resolve the phone's country by the longest matching dial code and
  // strip its prefix from the stored E.164 number (depends on reference data).
  React.useEffect(() => {
    if (mode !== "edit" || !initial?.phone || !open) return;
    const e164 = String(initial.phone).replace(/[^\d+]/g, "");
    if (!/^\+\d+$/.test(e164)) return;
    const match = (ref?.countries ?? [])
      .filter((c) => e164.startsWith(c.dialCode))
      .sort((a, b) => b.dialCode.length - a.dialCode.length)[0];
    if (match) {
      setPhoneCountryId(match.id);
      setPhoneDigits(e164.slice(match.dialCode.length));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, initial?.id, ref, open]);

  // Edit mode: load the assign-to owner list and default the worker selection to
  // the creator's current owners (admins/managers stay locked via hardOwnerIds).
  React.useEffect(() => {
    if (!open || mode !== "edit") return;
    let cancelled = false;
    (async () => {
      const [mRes, optsRes] = await Promise.all([
        fetch("/api/me"),
        fetch("/api/creators/options"),
      ]);
      if (cancelled) return;
      const m = mRes.ok ? await mRes.json() : null;
      setMe(m ? { id: m.id, teamId: m.teamId ?? null, roleSlug: m.roleSlug ?? null } : null);
      const owners: OwnerOption[] = (optsRes.ok ? await optsRes.json() : null)?.owners?.map(
        (o: { id: string; displayName: string; teamId: string; roleSlug: string }) => ({
          id: o.id,
          displayName: o.displayName,
          teamId: o.teamId ?? null,
          teamName: null,
          roleSlug: o.roleSlug ?? "",
        }),
      ) ?? [];
      setOwnerOptions(owners);
      const currentIds = (initial?.owners ?? []).map((o) => o.id);
      const currentTeams = new Set(
        owners.filter((o) => currentIds.includes(o.id)).map((o) => o.teamId).filter(Boolean) as string[],
      );
      const hard = owners
        .filter(
          (o) =>
            o.roleSlug === "admin" ||
            (o.roleSlug === "team-manager" && o.teamId != null && currentTeams.has(o.teamId)),
        )
        .map((o) => o.id);
      setHardOwnerIds(hard);
      setWorkerOwnerIds(currentIds.filter((id) => !hard.includes(id)));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, mode, initial]);

  // Clear any leftover state from a previous session every time the dialog opens
  // in add mode so it never shows the previous creator's data.
  React.useEffect(() => {
    if (!open || mode !== "create") return;
    setName("");
    setGender("");
    setEmail("");
    setPhoneCountryId("");
    setPhoneDigits("");
    setCountryId("");
    setCityId("");
    setCreatorTypeId("");
    setNiche([]);
    setWorkerOwnerIds([]);
    setFollowers("");
    setEngagementRate("");
    setNotes("");
    setCustom({});
    setProfiles([]);
    setStageId("");
    setEmailDup(null);
    setPhoneDup(null);
    setDupChecks({});
  }, [open, mode]);

  React.useEffect(() => {
    if (mode === "edit" && initial && open) {
      setName(initial.name ?? "");
      setGender(initial.gender ?? "");
      setEmail(initial.email ?? "");
      setNiche(Array.isArray(initial.niche) ? initial.niche : []);
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
          input: (p.url || p.handle) ?? "",
          isPrimary: p.isPrimary,
        })),
      );
      if (initial.phone) {
        const digits = String(initial.phone).replace(/[^\d]/g, "");
        setPhoneDigits(digits);
      } else {
        setPhoneDigits("");
      }
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
  const phoneDigitsClean = phoneDigits.replace(/\D/g, "");
  const dialCountry = countryOf(phoneCountryId);
  const phoneDigitsMismatch =
    !!phoneDigitsClean && dialCountry?.phoneDigits != null && phoneDigitsClean.length !== dialCountry.phoneDigits;

  const requiredFields = (ref?.fields ?? []).filter((f) => f.required);
  const customFields = (ref?.fields ?? []).filter((f) => f.id != null && !f.isSystem);
  const customFieldsVisible = (ref?.customFieldsEnabled ?? true) && customFields.length > 0;
  const nicheOptions = ref?.nicheOptions ?? [];
  const lockedProtected = mode === "edit" && initial?.canEditProtected === false;
  const emailLocked = mode === "edit" && initial?.canEditProtected === false && !!initial?.email;
  const adminOrGranted = (key: string) => {
    // New creator: everything is editable. In edit mode a non-admin may only
    // change fields the Admin has granted (per-field edit permissions).
    if (mode !== "edit" || initial?.canEditAllFields) return true;
    if (lockedProtected && key === "name") return false;
    return (initial?.allowedFields ?? []).includes(key);
  };
  const hardOwners = ownerOptions.filter((o) => hardOwnerIds.includes(o.id));
  // UAT: non-admin / non-manager users may only assign members of their own
  // team, regardless of the multi-team ownership policy.
  const mayAssignCrossTeam = me?.roleSlug === "admin" || me?.roleSlug === "team-manager";
  const workerAssignable: MultiSelectOption[] = (
    mayAssignCrossTeam
      ? ownerOptions.filter((o) => !hardOwnerIds.includes(o.id))
      : ownerOptions.filter((o) => !hardOwnerIds.includes(o.id) && o.teamId === me?.teamId)
  ).map((o) => ({ value: o.id, label: o.displayName }));

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

  // Phone duplicate check. A number is only compared once it is COMPLETE: when
  // the country defines an exact length the check waits for that many digits;
  // when the length is unknown there is no meaningful "done" moment while
  // typing, so the check is deferred to blur — never mid-typing.
  const runPhoneDupCheck = React.useCallback(
    async (
      preview: string,
      digits: string,
      expected: number | null,
      opts?: { allowPartial?: boolean },
    ) => {
      if (!preview) {
        setPhoneDup(null);
        return;
      }
      if (expected != null && digits.length !== expected) {
        setPhoneDup(null);
        return;
      }
      if (expected == null && !opts?.allowPartial) {
        // Unknown country length: wait for blur, never mid-typing.
        setPhoneDup(null);
        return;
      }
      try {
        const res = await fetch(`/api/creators/check?platform=PHONE&handle=${encodeURIComponent(preview)}${initial?.id ? `&exclude=${initial.id}` : ""}`);
        const j = await res.json();
        if (res.ok && j.exists && !j.isSelf) setPhoneDup({ exists: true });
        else setPhoneDup(null);
      } catch {}
    },
    [initial],
  );

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
                [i]: { state: "dup", text: `Already linked to ${j.name}`, url: j.url, creatorId: j.creatorId },
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
    if (dialCountry?.phoneDigits == null) {
      // Unknown country length: no mid-typing check (the timer branch below is
      // skipped), the blur handler is the only trigger. Keep whatever the blur
      // handler set — do not wipe it here on every unrelated keystroke.
    } else {
      timers.push(setTimeout(() => void runPhoneDupCheck(phonePreview, phoneDigitsClean, dialCountry.phoneDigits), 400));
    }
    timers.push(emailTimer);
    return () => timers.forEach(clearTimeout);
  }, [profiles, mutedRows, email, phonePreview, phoneDigitsClean, dialCountry, initial?.id, runPhoneDupCheck]);

  const validateLocal = (): string | null => {
    if (!name.trim()) return "Creator name is required.";
    if (mode === "create") {
      if (profiles.length === 0 || !profiles.some((p) => (p.input ?? "").trim() !== "")) {
        return "Add at least one platform profile.";
      }
    }
    if (mode === "create" && !gender) return "Gender is required.";
    const digits = phoneDigits.replace(/\D/g, "");
    if (digits && !phoneCountryId) return "Pick a country dial code for the phone.";
    const dialCountry = countryOf(phoneCountryId);
    if (digits && dialCountry?.phoneDigits != null && digits.length !== dialCountry.phoneDigits) {
      return `${dialCountry.name} phone numbers must have exactly ${dialCountry.phoneDigits} digits (after the dial code).`;
    }
    if (phoneDup?.exists) return "A creator with this phone already exists.";
    for (const [i, p] of profiles.entries()) {
      const trimmed = p.input.trim();
      if (!trimmed) continue;
      const formatError = strictProfileEntryError(trimmed);
      if (formatError) return formatError;
      const handle = handleFromInput(trimmed);
      if (!handle) return looksLikeUrl(trimmed) ? "Could not read a handle from that link." : "A handle cannot contain spaces or slashes.";
      const muted = mutedRows[i];
      if (muted) return `That looks like a ${muted.detected} link — different from the selected platform.`;
      const check = dupChecks[i];
      if (check?.state === "dup") return `@${handle} is already linked to another creator.`;
    }
    if (email.trim() && !/.+@.+\..+/.test(email.trim())) return "Email must be a valid email address.";
    if (mode === "edit" && emailLocked && email.trim() && email.trim().toLowerCase() !== (initial?.email ?? "").toLowerCase()) {
      return "Only the Admin can change an email once it is set.";
    }
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

    const allOwners = Array.from(new Set([...workerOwnerIds, ...hardOwnerIds]));
    const body: Record<string, unknown> = {
      name: name.trim(),
      email: email.trim() || undefined,
      phoneNumber: phoneDigits.replace(/\D/g, ""),
      phoneCountryId: phoneDigits.replace(/\D/g, "") ? phoneCountryId : undefined,
      countryId: countryId || undefined,
      cityId: cityId || undefined,
      creatorTypeId: creatorTypeId || undefined,
      gender: gender || undefined,
      niche: niche.length ? niche : undefined,
      followers: followers ? Number(followers) : undefined,
      engagementRate: engagementRate ? Number(engagementRate) : undefined,
      notes: notes.trim() || undefined,
      customFields: custom,
      ...(mode === "create" && allOwners.length ? { ownerIds: allOwners } : {}),
      ...(mode === "edit" && initial && initial.canEditOwners !== false ? { ownerIds: allOwners } : {}),
      ...(mode === "create" && stageId ? { stageId } : {}),
      ...(mode === "create"
        ? {
            profiles: profiles
              .filter((p) => p.input.trim())
              .map((p) => ({ platform: p.platform, input: p.input.trim(), isPrimary: p.isPrimary })),
          }
        : mode === "edit" && initial && !initial.canEditProtected
          ? {
              // Non-admin edit: send only newly-added profiles so existing ones are kept.
              profiles: profiles
                .filter((p) => {
                  const existingInputs = (initial.profiles ?? [])
                    .map((ep) => String((ep.url as string) || "").toLowerCase() || (ep.handle ?? "").toLowerCase());
                  return p.input.trim() && !existingInputs.includes(p.input.trim().toLowerCase());
                })
                .map((p) => ({ platform: p.platform, input: p.input.trim(), isPrimary: p.isPrimary })),
            }
          : {
              profiles: profiles
                .filter((p) => p.input.trim())
                .map((p) => ({ platform: p.platform, input: p.input.trim(), isPrimary: p.isPrimary })),
            }),
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
            Track the person, not the profile. Platform profiles accept links only — paste the full profile link (e.g. instagram.com/handle).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-6">
          {/* Identity */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cf-name" className="inline-flex items-center gap-1">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input id="cf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Creator name" disabled={lockedProtected || !adminOrGranted("name")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-gender" className="inline-flex items-center gap-1">
                Gender <span className="text-destructive">*</span>
              </Label>
              <Select value={gender} onValueChange={setGender} disabled={!adminOrGranted("gender")}>
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
                disabled={emailLocked || !adminOrGranted("email")}
              />
              {email.trim() && !/.+@.+\..+/.test(email.trim()) ? (
                <p className="text-xs text-destructive">Enter a valid email address.</p>
              ) : null}
              {emailDup ? <p className="text-xs text-destructive">A creator with this email already exists.</p> : null}
              {lockedProtected ? (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ShieldAlert className="h-3 w-3" /> Name and existing profiles can only be changed by the Admin; you can add new profiles.
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cf-phone">Phone {requiredFields.some((f) => f.key === "phone") ? <span className="text-destructive">*</span> : null}</Label>
              <div className="flex gap-2">
                <Select value={phoneCountryId} onValueChange={setPhoneCountryId} disabled={!adminOrGranted("phone")}>
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
                  onChange={(e) => {
                    setPhoneDigits(e.target.value.replace(/[^\d]/g, ""));
                    setPhoneDup(null);
                  }}
                  onBlur={() => {
                    if (phonePreview) {
                      void runPhoneDupCheck(phonePreview, phoneDigitsClean, dialCountry?.phoneDigits ?? null, {
                        allowPartial: true,
                      });
                    }
                  }}
                  placeholder="1001234567 (digits only)"
                  aria-invalid={phoneDigitsMismatch}
                  disabled={!adminOrGranted("phone")}
                  className={phoneDigitsMismatch ? "border-destructive" : ""}
                />
              </div>
              {phoneDigitsMismatch ? (
                <p className="text-xs text-destructive">
                  {dialCountry?.name} phone numbers have exactly {dialCountry?.phoneDigits} digits (after the dial code).
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {dialCountry?.phoneDigits != null
                    ? `${dialCountry!.name} phone numbers have exactly ${dialCountry!.phoneDigits} digits after the dial code.`
                    : phonePreview
                      ? `Stored as ${phonePreview}`
                      : "Digits only — no spaces or dashes."}
                </p>
              )}
              {phoneDup ? <p className="text-xs text-destructive">A creator with this phone already exists.</p> : null}
            </div>
          </div>

          {/* Location + classification */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="cf-country">Country {requiredFields.some((f) => f.key === "country") ? <span className="text-destructive">*</span> : null}</Label>
              <Select
                value={countryId}
                disabled={!adminOrGranted("country")}
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
              <Select value={cityId} onValueChange={setCityId} disabled={!countryId || !adminOrGranted("city")}>
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
              <Select value={creatorTypeId} onValueChange={setCreatorTypeId} disabled={!adminOrGranted("creatorType")}>
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
              <Input id="cf-followers" type="number" value={followers} onChange={(e) => setFollowers(e.target.value)} placeholder="120000" disabled={!adminOrGranted("followers")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-er">Engagement rate (%)</Label>
              <Input id="cf-er" type="number" step="0.1" value={engagementRate} onChange={(e) => setEngagementRate(e.target.value)} placeholder="3.5" disabled={!adminOrGranted("engagementRate")} />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="cf-niche" className="inline-flex items-center gap-1">
                Niche{" "}
                {requiredFields.some((f) => f.key === "niche") ? <span className="text-destructive">*</span> : null}
              </Label>
              <MultiSelect
                options={nicheOptions.map((o) => ({ value: o, label: o }))}
                value={niche}
                onChange={setNiche}
                disabled={!adminOrGranted("niche")}
                placeholder={nicheOptions.length ? "Select niches…" : "No niche options yet"}
                triggerClassName={nicheOptions.length ? "" : "text-muted-foreground"}
              />
              {niche.length ? (
                <p className="text-xs text-muted-foreground">{niche.join(", ")}</p>
              ) : null}
              {!nicheOptions.length ? (
                <p className="text-xs text-muted-foreground">
                  Add niche options in Workspace settings → Creator fields.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Pick one or more, or clear to leave empty.</p>
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="cf-notes">Notes</Label>
              <Input id="cf-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything relevant about this creator" disabled={!adminOrGranted("notes")} />
            </div>
          </div>

          {/* Custom fields */}
          {customFieldsVisible ? (
            <div className="space-y-3 rounded-lg border p-4">
              <Label className="text-sm font-semibold">Custom fields</Label>
              {customFields.map((f) => (
                <CustomFieldInput key={f.id} field={f} value={custom[f.id!] ?? ""} disabled={!adminOrGranted("customFields")} onChange={(v) => handleCustomChange(f.id!, v)} />
              ))}
            </div>
          ) : null}

          {/* Assignment */}
          {mode === "create" || (mode === "edit" && initial?.canEditOwners !== false) ? (
            <div className="space-y-4 rounded-lg border p-4">
              <Label className="text-sm font-semibold">Assignment</Label>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Auto-assigned (always owners)
                </Label>
                {hardOwners.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {hardOwners.map((o) => (
                      <Badge key={o.id} variant="secondary" className="gap-1 font-normal">
                        <ShieldAlert className="h-3 w-3" />
                        {o.displayName}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="inline-flex items-center gap-1">
                  Assign to{" "}
                  {requiredFields.some((f) => f.key === "owner") ? <span className="text-destructive">*</span> : null}
                </Label>
                <MultiSelect
                  options={workerAssignable}
                  value={workerOwnerIds}
                  onChange={setWorkerOwnerIds}
                  placeholder="Select team members…"
                />
                <p className="text-xs text-muted-foreground">
                  Who should work this creator. You start assigned and can remove yourself or add teammates;
                  multiple owners follow the workspace policy.
                </p>
              </div>
            </div>
          ) : null}

          {/* Pipeline stage (create only) */}
          {mode === "create" && stages.length > 0 ? (
            <div className="space-y-1.5">
              <Label>Starting stage</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">The engagement will start at this pipeline stage.</p>
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
                      disabled={mode === "edit" && !initial?.canEditProtected && !adminOrGranted("profiles")}
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
              const trimmed = row.input.trim();
              const strictErr = trimmed ? strictProfileEntryError(trimmed) : null;
              const showError = !muted && strictErr && !check;
              return (
                <div key={`${row.platform}-${i}`} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-24 shrink-0 truncate text-xs font-medium">
                      {PLATFORM_LABELS[row.platform]}
                    </span>
                    <Input
                      value={row.input}
                      onChange={(e) => setProfile(i, { input: e.target.value })}
                      placeholder={row.platform === "OTHER" ? "e.g. https://tiktok.com/@myname" : `e.g. https://www.${PLATFORM_LABELS[row.platform].toLowerCase()}.com/handle`}
                      disabled={lockedProtected && !adminOrGranted("profiles")}
                      aria-invalid={!!muted || !!showError}
                      className={muted || showError ? "border-destructive" : ""}
                    />                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      title={row.isPrimary ? "Primary profile" : "Make primary"}
                      className={row.isPrimary ? "text-amber-500" : "text-muted-foreground"}
                      disabled={lockedProtected && !adminOrGranted("profiles")}
                      onClick={() => markPrimary(i)}
                    >
                      <Star className="h-4 w-4" fill={row.isPrimary ? "currentColor" : "none"} />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="shrink-0 text-muted-foreground"
                      disabled={lockedProtected && !adminOrGranted("profiles")}
                      onClick={() => setProfiles((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {muted ? (
                    <p className="text-xs text-destructive">
                      That looks like a {muted.detected} link — different from the selected platform.
                    </p>
                  ) : strictErr ? (
                    <p className="text-xs text-destructive">{strictErr}</p>
                  ) : check?.state === "checking" ? (
                    <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Checking…
                    </p>
                  ) : check?.state === "dup" ? (
                    <p className="inline-flex items-center gap-2 text-xs text-destructive">
                      {check.text}
                      {check.creatorId ? (
                        <Link
                          href={`/creators/${check.creatorId}`}
                          className="text-primary underline underline-offset-2"
                          onClick={() => onOpenChange(false)}
                        >
                          View profile →
                        </Link>
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
  disabled = false,
}: {
  field: ReferenceField;
  value: string | number | boolean | null;
  onChange: (v: string | number | boolean | null) => void;
  disabled?: boolean;
}) {
  const label = `${field.label}${field.required ? " *" : ""} (${CREATOR_FIELD_TYPE_LABELS[field.type] ?? ""})`;
  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 accent-primary"
          checked={value === true}
          disabled={disabled}
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
        <Select value={String(value ?? "")} disabled={disabled} onValueChange={onChange}>
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
        <Input type="date" disabled={disabled} value={String(value ?? "").slice(0, 10)} onChange={(e) => onChange(e.target.value || null)} />
      </div>
    );
  }
  if (field.type === "number") {
    return (
      <div className="grid items-center gap-2 sm:grid-cols-[220px_1fr]">
        <Label>{label}</Label>
        <Input type="number" disabled={disabled} value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
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
          disabled={disabled}
          onChange={(e) => onChange(e.target.value || null)}
        />
      ) : (
        <Input disabled={disabled} value={String(value ?? "")} onChange={(e) => onChange(e.target.value || null)} />
      )}
    </div>
  );
}