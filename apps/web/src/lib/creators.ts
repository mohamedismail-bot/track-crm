import "server-only";
import { prisma } from "./prisma";
import {
  buildE164,
  detectPlatformFromUrl,
  handleFromInput,
  isValidEmail,
  isValidE164,
  looksLikeUrl,
  normalizeHandleFromUrl,
  requiredForGiftingMissing,
  strictProfileEntryError,
  urlPlatformMismatch,
} from "./constants";
import { Prisma } from "@prisma/client";
import type { Platform, ApprovalStatus } from "@prisma/client";
import { logActivity, logTransaction } from "./activity";
import type { SessionUser } from "./auth";
import { listCreatorFields, type CreatorFieldDef } from "./reference";

export interface NewProfileInput {
  platform: string;
  input: string;
  isPrimary?: boolean;
}

export interface CreateCreatorInput {
  name: string;
  email?: string;
  phoneCountryId?: string;
  phoneNumber?: string;
  countryId?: string;
  cityId?: string;
  creatorTypeId?: string;
  gender?: string;
  shopifyRegistered?: boolean;
  niche?: string[];
  followers?: string | number;
  engagementRate?: string | number;
  notes?: string;
  customFields?: Record<string, string | number | boolean | null>;
  ownerIds?: string[];
  profiles: NewProfileInput[];
  stageId?: string;
}

export function parseNumeric(value: string | number | undefined): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Normalise a niche selection: dedupe, trim, drop empties. */
export function normalizeNiche(value: string[] | string | null | undefined): string[] {
  const list = Array.isArray(value)
    ? value
    : value === null || value === undefined || value === ""
      ? []
      : [value];
  return Array.from(new Set(list.map((v) => String(v).trim()).filter(Boolean)));
}

export interface ValidatedProfile {
  platform: Platform;
  handle: string;
  normalizedHandle: string;
  url: string;
  isPrimary: boolean;
}

/**
 * Tolerantly normalise a single profile entry (bare handle, @handle or full
 * link). Throws with a human message when the entry is unusable.
 */
export function validateProfileEntry(p: NewProfileInput): ValidatedProfile {
  const platform = (p.platform || "OTHER") as Platform;
  const raw = p.input?.trim() ?? "";
  if (!raw) throw new Error("Every platform profile needs a handle.");
  const detected = urlPlatformMismatch(raw, platform);
  if (detected) {
    throw new Error(
      `That looks like a ${detected} link — different from the selected platform. Check the entry or pick ${detected}.`,
    );
  }
  const formatError = strictProfileEntryError(raw);
  if (formatError) throw new Error(formatError);
  const handle = handleFromInput(raw);
  if (!handle) {
    throw new Error(
      looksLikeUrl(raw)
        ? `Could not read a handle from that link.`
        : `Handle cannot contain spaces or slashes.`,
    );
  }
  return {
    platform,
    handle,
    normalizedHandle: handle,
    url: raw.toLowerCase().includes("http") ? raw.trim() : raw.trim(),
    isPrimary: p.isPrimary ?? false,
  };
}

export interface ValidationResult {
  data: {
    name: string;
    email: string | null;
    phone: string | null;
    countryId: string | null;
    cityId: string | null;
    creatorTypeId: string | null;
    gender: string | null;
    shopifyRegistered: boolean | null;
    niche: string[];
    followers: number | null;
    engagementRate: number | null;
    notes: string | null;
    customFields: Record<string, string | number | boolean | null>;
    phoneCountryRow: { id: string; dialCode: string; name: string; phoneDigits: number | null } | null;
  };
  profiles: ValidatedProfile[];
  erroredMissingRequired: string[];
}

const SYSTEM_REQUIRED_VALUE_KEY: Record<string, (d: ValidationResult["data"]) => boolean> = {
  email: (d) => !!d.email,
  phone: (d) => !!d.phone,
  gender: (d) => !!d.gender,
  country: (d) => !!d.countryId,
  city: (d) => !!d.cityId,
  creatorType: (d) => !!d.creatorTypeId,
  shopifyRegistered: (d) => d.shopifyRegistered !== null,
  niche: (d) => (d.niche?.length ?? 0) > 0,
  followers: (d) => d.followers !== null,
  engagementRate: (d) => d.engagementRate !== null,
  notes: (d) => !!d.notes,
};

/**
 * Validate + normalise the shared creator payload. Throws Error with a
 * user-facing message for hard validation failures (email/phone/type checks).
 */
export async function validateCreatorInput(
  input: CreateCreatorInput,
  opts: { isCreate: boolean },
): Promise<ValidationResult> {
  const { isCreate } = opts;
  const errors: string[] = [];

  if (!input.name?.trim()) errors.push("Creator name is required.");
  const name = input.name?.trim() ?? "";

  if (isCreate && (!input.profiles || input.profiles.length === 0)) {
    errors.push("At least one platform profile is required.");
  }

  let email: string | null = null;
  if (input.email && input.email.trim()) {
    email = input.email.trim().toLowerCase();
    if (!isValidEmail(email)) errors.push("Email must be a valid email address.");
  }

  let phone: string | null = null;
  let phoneCountryRow: ValidationResult["data"]["phoneCountryRow"] = null;
  if (input.phoneNumber && input.phoneNumber.replace(/\D/g, "").length > 0) {
    const digits = input.phoneNumber.replace(/\D/g, "");
    if (!input.phoneCountryId) {
      errors.push("Pick a country dial code for the phone number.");
    } else {
      phoneCountryRow = await prisma.country.findUnique({ where: { id: input.phoneCountryId } });
      if (!phoneCountryRow) {
        errors.push("The selected dial-code country is not valid.");
      } else {
        phone = buildE164(phoneCountryRow.dialCode, digits);
        if (phoneCountryRow.phoneDigits != null && digits.length !== phoneCountryRow.phoneDigits) {
          errors.push(
            `${phoneCountryRow.name} phone numbers must have exactly ${phoneCountryRow.phoneDigits} digits (after the dial code).`,
          );
        } else if (!isValidE164(phone)) {
          errors.push("Phone must be between 8 and 15 digits.");
        }
      }
    }
  }

  let gender: string | null = null;
  if (input.gender) {
    const validGender = await import("./reference").then((m) => m.getGenderOptions());
    if (validGender.includes(input.gender)) gender = input.gender;
    else errors.push(`"${input.gender}" is not a valid gender option.`);
  }

  let countryId: string | null = null;
  if (input.countryId) {
    const country = await prisma.country.findUnique({ where: { id: input.countryId } });
    if (!country) errors.push("Selected country is not valid.");
    else countryId = country.id;
  }

  let cityId: string | null = null;
  if (input.cityId) {
    const city = await prisma.city.findUnique({ where: { id: input.cityId } });
    if (!city) errors.push("Selected city is not valid.");
    else if (countryId && city.countryId !== countryId) {
      errors.push("Selected city does not belong to the selected country.");
    } else cityId = city.id;
  }

  let creatorTypeId: string | null = null;
  if (input.creatorTypeId) {
    const type = await prisma.creatorType.findUnique({ where: { id: input.creatorTypeId } });
    if (!type) errors.push("Selected creator type is not valid.");
    else creatorTypeId = type.id;
  }

  const customFields: Record<string, string | number | boolean | null> = {};
  if (input.customFields && typeof input.customFields === "object") {
    const fields = await listCreatorFields();
    const customOnly = fields.filter((f) => f.id && !f.key);
    for (const entry of Object.entries(input.customFields)) {
      const [fieldId, value] = entry;
      const field = customOnly.find((f) => f.id === fieldId);
      if (!field) {
        errors.push("Unknown custom field was submitted.");
        continue;
      }
      const cleaned = coerceFieldValue(field, value);
      if (cleaned === null && value !== null && value !== undefined && value !== "") {
        errors.push(`"${field.label}" has an invalid value.`);
        continue;
      }
      if (cleaned !== null && cleaned !== "" && field.options.length && !field.options.includes(String(cleaned))) {
        errors.push(`"${String(cleaned)}" is not an option for "${field.label}".`);
        continue;
      }
      customFields[fieldId] = cleaned;
    }
  }

  const data: ValidationResult["data"] = {
    name,
    email,
    phone,
    countryId,
    cityId,
    creatorTypeId,
    gender,
    shopifyRegistered: input.shopifyRegistered ?? null,
    niche: normalizeNiche(input.niche),
    followers: parseNumeric(input.followers),
    engagementRate: parseNumeric(input.engagementRate),
    notes: input.notes?.trim() || null,
    customFields: Object.keys(customFields).length ? customFields : {},
    phoneCountryRow,
  };

  // Mandatory built-in fields (Name/Profiles handled separately by caller).
  // Enforced at creation; on edits the record keeps existing values and the
  // admin can flag incomplete records via the gifting gate instead.
  const erroredMissingRequired: string[] = [];
  if (isCreate) {
    const fields = await listCreatorFields();
    for (const field of fields) {
      if (!field.required) continue;
      const check = SYSTEM_REQUIRED_VALUE_KEY[field.key ?? ""];
      if (check && !check(data)) {
        erroredMissingRequired.push(field.label);
        errors.push(`${field.label} is required.`);
      }
    }
  }

  if (errors.length) throw new Error(errors.join("\n"));
  return { data, profiles: [], erroredMissingRequired };
}

/** Coerce a submitted custom field value into the value's native JSON type. */
export function coerceFieldValue(
  field: CreatorFieldDef,
  value: string | number | boolean | null | undefined,
): string | number | boolean | null {
  if (value === null || value === undefined || value === "") return null;
  switch (field.type) {
    case "number":
      return Number.isFinite(Number(value)) ? Number(value) : null;
    case "boolean":
      if (typeof value === "boolean") return value;
      return value === "true" || value === "1" || value === "yes";
    case "date": {
      const iso = String(value);
      if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
      return iso.slice(0, 10);
    }
    default:
      return String(value);
  }
}

export interface NewProfileResult {
  platform: Platform;
  handle: string;
  url: string;
  isPrimary: boolean;
}

/** Validate that a profile URL does not already belong to another creator. */
export async function findDuplicateProfile(url: string, platform?: string, excludeCreatorId?: string) {
  const handle = normalizeHandleFromUrl(url);
  const detected: Platform = platform ? (platform as Platform) : detectPlatformFromUrl(url);
  return prisma.platformProfile.findFirst({
    where: {
      platform: detected,
      normalizedHandle: handle,
      creator: { isNot: excludeCreatorId ? { id: excludeCreatorId } : undefined },
    },
    include: { creator: { include: { ownerships: { include: { user: true, team: true }, take: 1 } } } },
  });
}

/** Check a bare platform+handle for duplicates (for inline "view profile" UX). */
export async function checkPlatformHandle(platform: Platform, handle: string, excludeCreatorId?: string) {
  return findDuplicateProfile(handle, platform, excludeCreatorId);
}

/**
 * A phone number is unique per creator by its local digits, not only the full
 * E.164 (so entering the same number under a different dial code is still a
 * duplicate). The local digits are the digits after the country dial code,
 * resolved against the workspace's Country list (longest matching dial code),
 * so every stored/entered number is split the same way. Returns the first
 * creator that already holds the same local number, or null.
 */
export async function findDuplicatePhone(e164: string, excludeCreatorId?: string) {
  if (!e164) return null;
  const legalDialCodes = (await prisma.country.findMany({ select: { dialCode: true } }))
    .map((c) => (c.dialCode ?? "").replace(/[^\d]/g, ""))
    .filter((dc) => dc.length > 0);
  const localOf = (phone: string) => {
    const digits = phone.replace(/[^\d]/g, "");
    let dial = "";
    for (const dc of legalDialCodes) {
      if (digits.startsWith(dc) && dc.length > dial.length) dial = dc;
    }
    return digits.slice(dial.length);
  };
  const local = localOf(e164);
  const others = await prisma.creator.findMany({
    where: { deletedAt: null, phone: { not: null } },
    select: { id: true, name: true, phone: true },
  });
  const match = others.find(
    (c) => c.id !== excludeCreatorId && c.phone && localOf(c.phone) === local,
  );
  return match ?? null;
}

/**
 * Build the canonical profile URL (+ normalized handle) for a tolerant entry.
 */
export async function buildValidatedProfiles(
  inputProfiles: NewProfileInput[],
): Promise<NewProfileResult[]> {
  return inputProfiles.map((p) => {
    const v = validateProfileEntry(p);
    return { platform: v.platform, handle: v.handle, url: v.url, isPrimary: v.isPrimary };
  });
}

/** Replace a creator's platform profiles from tolerant entries (validated). */
export async function replaceCreatorProfiles(
  creatorId: string,
  inputProfiles: NewProfileInput[],
  tx: Prisma.TransactionClient = prisma,
): Promise<NewProfileResult[]> {
  const validated = inputProfiles.map((p) => validateProfileEntry(p));
  if (validated.length === 0) throw new Error("A creator needs at least one platform profile.");

  const seen = new Set<string>();
  for (const p of validated) {
    const key = `${p.platform}:${p.normalizedHandle}`;
    if (seen.has(key)) throw new Error(`Duplicate profile for @${p.handle}.`);
    seen.add(key);
  }

  for (const p of validated) {
    const dup = await findDuplicateProfile(p.url, p.platform, creatorId);
    if (dup) {
      throw new Error(
        `@${p.handle} on ${p.platform} is already linked to ${dup.creator.name}. Check your entry.`,
      );
    }
  }

  const hasMarkedPrimary = validated.some((p) => p.isPrimary);
  const profiles = validated.map((p, i) => ({ ...p, isPrimary: p.isPrimary ?? (hasMarkedPrimary ? false : i === 0) }));

  await tx.platformProfile.deleteMany({ where: { creatorId } });
  await tx.platformProfile.createMany({
    data: profiles.map((p) => ({
      creatorId,
      url: p.url,
      platform: p.platform,
      isPrimary: p.isPrimary,
      handle: p.handle,
      normalizedHandle: p.normalizedHandle,
    })),
  });
  const primary = await tx.platformProfile.findFirst({ where: { creatorId, isPrimary: true } });
  if (primary) {
    await tx.creator.update({ where: { id: creatorId }, data: { primaryProfileId: primary.id } });
  }
  return profiles;
}

/** Append new platform profiles without touching existing ones (add-only). */
export async function addCreatorProfiles(
  creatorId: string,
  inputProfiles: NewProfileInput[],
  tx: Prisma.TransactionClient = prisma,
): Promise<NewProfileResult[]> {
  const validated = inputProfiles.map((p) => validateProfileEntry(p));
  if (validated.length === 0) return [];

  const existing = await tx.platformProfile.findMany({ where: { creatorId } });
  const existingKeys = new Set(existing.map((p) => `${p.platform}:${p.normalizedHandle}`));

  for (const p of validated) {
    const key = `${p.platform}:${p.normalizedHandle}`;
    if (existingKeys.has(key)) throw new Error(`@${p.handle} on ${p.platform} is already linked.`);
    existingKeys.add(key);
  }

  for (const p of validated) {
    const dup = await findDuplicateProfile(p.url, p.platform, creatorId);
    if (dup) {
      throw new Error(
        `@${p.handle} on ${p.platform} is already linked to ${dup.creator.name}. Check your entry.`,
      );
    }
  }

  const primary = existing.some((e) => e.isPrimary) || validated.some((p) => p.isPrimary);
  const profiles = validated.map((p, i) => ({
    ...p,
    isPrimary: p.isPrimary ?? (!primary && i === 0),
  }));

  await tx.platformProfile.createMany({
    data: profiles.map((p) => ({
      creatorId,
      url: p.url,
      platform: p.platform,
      isPrimary: p.isPrimary,
      handle: p.handle,
      normalizedHandle: p.normalizedHandle,
    })),
  });
  if (!existing.some((e) => e.isPrimary)) {
    const createdPrimary = await tx.platformProfile.findFirst({ where: { creatorId, isPrimary: true } });
    if (createdPrimary) {
      await tx.creator.update({ where: { id: creatorId }, data: { primaryProfileId: createdPrimary.id } });
    }
  }
  return profiles;
}

/** Compute a creator's E.164 phone from dial-country + local digits (or null). */
export async function phoneFromInput(
  phoneCountryId: string | undefined,
  phoneNumber: string | undefined,
): Promise<string | null> {
  if (!phoneNumber || !phoneNumber.replace(/\D/g, "")) return null;
  if (!phoneCountryId) throw new Error("Pick a country dial code for the phone number.");
  const country = await prisma.country.findUnique({ where: { id: phoneCountryId } });
  if (!country) throw new Error("The selected dial-code country is not valid.");
  return buildE164(country.dialCode, phoneNumber);
}

export async function createCreator(input: CreateCreatorInput, user: SessionUser) {
  const [validation] = await Promise.all([validateCreatorInput(input, { isCreate: true })]);
  const profilesInput: ValidatedProfile[] = input.profiles.map((p) => validateProfileEntry(p));

  // No duplicate handles in the input itself.
  const seen = new Set<string>();
  for (const p of profilesInput) {
    const key = `${p.platform}:${p.normalizedHandle}`;
    if (seen.has(key)) throw new Error(`Duplicate profile for @${p.handle}.`);
    seen.add(key);
  }

  // The first profile is primary unless one is marked primary.
  const hasMarkedPrimary = profilesInput.some((p) => p.isPrimary);
  const profiles = profilesInput.map((p, i) => ({ ...p, isPrimary: p.isPrimary ?? (hasMarkedPrimary ? false : i === 0) }));

  const gender = validation.data.gender;
  if (!gender) throw new Error("Gender is required.");

  // Unique email check.
  if (validation.data.email) {
    const dupEmail = await prisma.creator.findUnique({ where: { email: validation.data.email } });
    if (dupEmail) throw new Error(`A creator with the email ${validation.data.email} already exists.`);
  }
  if (validation.data.phone) {
    const dupPhone = await findDuplicatePhone(validation.data.phone);
    if (dupPhone) throw new Error(`A creator with this phone number already exists (${dupPhone.name}).`);
  }
  for (const p of profiles) {
    const dup = await findDuplicateProfile(p.url, p.platform);
    if (dup) {
      throw new Error(
        `@${p.handle} on ${p.platform} is already linked to ${dup.creator.name}. Check your entry.`,
      );
    }
  }

  const settings = await import("./settings").then((m) => m.getSettings());
  const pendingApproval = settings.approvalEnabled && user.roleSlug !== "admin";

  // Which users should own this creator? Defaults to the acting user. The
  // dropdown list restricts assignments to the acting user's team, but guards
  // here keep the Ownership Policy safe regardless of the client.
  const ownerIds = Array.isArray(input.ownerIds)
    ? Array.from(new Set(input.ownerIds.filter((id) => typeof id === "string" && id)))
    : [];
  const ownerRows =
    ownerIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: ownerIds }, archivedAt: null } })
      : [];
  if (ownerIds.length > 0 && ownerRows.length !== ownerIds.length) {
    throw new Error("One of the selected owners is not a valid user.");
  }
  if (ownerRows.some((o) => o.teamId !== user.teamId) && !settings.multiTeam) {
    throw new Error("Assignments are limited to your own team by the Ownership Policy.");
  }
  const ownerships = ownerRows.length
    ? ownerRows.map((o) => ({ userId: o.id, teamId: o.teamId! }))
    : [{ userId: user.id, teamId: user.teamId }];

  // Auto-assign admin + user's team manager as owners.
  const [adminUsers, teamManagers] = await Promise.all([
    prisma.user.findMany({
      where: { archivedAt: null, role: { slug: "admin" } },
      select: { id: true, teamId: true },
    }),
    prisma.user.findMany({
      where: { archivedAt: null, teamId: user.teamId, role: { slug: "team-manager" } },
      select: { id: true, teamId: true },
    }),
  ]);
  const autoOwners = [...adminUsers, ...teamManagers].filter(
    (u) => !ownerships.some((o) => o.userId === u.id) && u.teamId != null,
  ).map((o) => ({ userId: o.id, teamId: o.teamId! }));
  const finalOwnerships = [...ownerships, ...autoOwners];

  const created = await prisma.$transaction(async (tx) => {
    const creator = await tx.creator.create({
      data: {
        name: validation.data.name,
        email: validation.data.email,
        phone: validation.data.phone,
        niche: validation.data.niche,
        countryId: validation.data.countryId,
        cityId: validation.data.cityId,
        creatorTypeId: validation.data.creatorTypeId,
        gender,
        shopifyRegistered: validation.data.shopifyRegistered,
        followers: validation.data.followers,
        engagementRate: validation.data.engagementRate,
        notes: validation.data.notes,
        customFields: Object.keys(validation.data.customFields).length ? validation.data.customFields : undefined,
        createdById: user.id,
        approvalStatus: pendingApproval ? "PENDING" : null,
        ownerships: pendingApproval ? undefined : { create: finalOwnerships },
      },
    });

    // Create engagement with the specified stage (or first pipeline stage by default).
    if (!pendingApproval) {
      let stageId = input.stageId;
      if (!stageId) {
        const firstPipeline = await tx.pipelineConfig.findFirst({
          where: { teamId: user.teamId },
          orderBy: { order: "asc" },
        });
        stageId = firstPipeline?.stageId;
      }
      if (stageId) {
        await tx.engagement.create({
          data: {
            creatorId: creator.id,
            teamId: user.teamId,
            stageId,
            title: `${creator.name} engagement`,
            dealType: "BARTER",
            currency: "EGP",
            createdById: user.id,
          },
        });
      }
    }

    await tx.platformProfile.createMany({
      data: profiles.map((p) => ({
        creatorId: creator.id,
        url: p.url,
        platform: p.platform,
        isPrimary: p.isPrimary,
        handle: p.handle,
        normalizedHandle: p.normalizedHandle,
      })),
    });
    const primary = await tx.platformProfile.findFirst({ where: { creatorId: creator.id, isPrimary: true } });
    if (primary) {
      await tx.creator.update({ where: { id: creator.id }, data: { primaryProfileId: primary.id } });
    }
    return { creator, profiles };
  });

  const profileSummary = created.profiles.map((p) => `@${p.handle}`).join(", ");
  await logActivity({
    creatorId: created.creator.id,
    kind: "SYSTEM",
    type: pendingApproval ? "CREATOR_CREATED" : "CREATOR_CREATED",
      summary: pendingApproval
      ? "Creator created — pending Team Manager approval"
      : finalOwnerships.length > 1
        ? "Creator created and assigned to the team"
        : "Creator created and assigned to me",
    description: `Platform profiles: ${profileSummary}`,
    authorId: user.id,
  });
  await logTransaction({
    userId: user.id,
    action: "creator.create",
    entityType: "Creator",
    entityId: created.creator.id,
    detail: `Created ${created.creator.name}${pendingApproval ? " (pending approval)" : ""}`,
  });

  if (pendingApproval) {
    await notifyManagersOfApproval(created.creator.id, user);
  }

  return { creator: created.creator, pendingApproval };
}

/** Notify Team Managers (of the requester's team) about a pending creator. */
async function notifyManagersOfApproval(creatorId: string, requester: SessionUser) {
  const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
  if (!creator) return;
  const { notifyTeamManagerOfTeam } = await import("./notify");
  await notifyTeamManagerOfTeam(requester.teamId, {
    type: "SYSTEM",
    title: "Creator pending approval",
    body: `${creator.name} was created by ${requester.displayName} and needs your approval.`,
    link: `/creators?pending=1`,
  });
}

export interface CreatorListFilters {
  team?: string;
  stage?: string;
  platform?: string;
  niche?: string;
  owner?: string;
  q?: string;
  pool?: string;
  overdue?: boolean;
  upcoming?: boolean;
  pending?: boolean;
  incomplete?: boolean;
  gender?: string;
  shopify?: "yes" | "no";
  country?: string;
  city?: string;
  creatorType?: string;
  custom?: Record<string, string>;
  createdFrom?: string;
  createdTo?: string;
  sort?: "latest" | "oldest" | "name-asc" | "name-desc" | "created-desc" | "created-asc";
}

/**
 * Smart-search predicate. Accepts a creator name, a bare handle, an `@`-handle,
 * a pasted platform link, an email or a phone number. Every field matches
 * partially (contains). Pasted links and `@`-handles are parsed into a canonical
 * Platform Handle before matching against platform profiles.
 */
export function smartSearchWhere(qRaw: string): Prisma.CreatorWhereInput {
  const q = qRaw.trim();
  if (!q) return {};
  const handle = handleFromInput(q);
  const or: Prisma.CreatorWhereInput[] = [
    { name: { contains: q } },
    { email: { contains: q.toLowerCase() } },
    { phone: { contains: q } },
  ];
  if (handle) {
    or.push({ profiles: { some: { normalizedHandle: { contains: handle.toLowerCase() } } } });
  }
  return { OR: or };
}

/** Whether a user may see a pending/rejected creator. */
export function canSeePendingCreator(
  user: SessionUser,
  c: { createdById: string | null; createdBy?: { teamId: string | null } | null },
): boolean {
  if (user.roleSlug === "admin") return true;
  if (c.createdById === user.id) return true;
  if (user.roleSlug === "team-manager") {
    const requesterTeam = c.createdBy?.teamId;
    if (requesterTeam && requesterTeam === user.teamId) return true;
  }
  return false;
}

/**
 * Whether a user may export creator data. Admins always can; otherwise the
 * export grant comes from the workspace "export.enabledRoles" (role-based) or
 * the newer per-user "export.enabledUserIds" grant.
 */
export async function canExportCreators(user: SessionUser): Promise<boolean> {
  if (user.roleSlug === "admin") return true;
  const s = await import("./settings").then((m) => m.getSettings());
  if (s.exportEnabledRoles.includes(user.roleSlug)) return true;
  if (s.exportEnabledUserIds.includes(user.id)) return true;
  return false;
}

/**
 * Whether a user may bulk-edit creators (stage, owner, Shopify status).
 * Admins always can; otherwise the grant comes from the workspace
 * "bulkEdit.enabledRoles" (role-based) or per-user "bulkEdit.enabledUserIds".
 */
export async function canBulkEditCreators(user: SessionUser): Promise<boolean> {
  if (user.roleSlug === "admin") return true;
  const s = await import("./settings").then((m) => m.getSettings());
  if (s.bulkEditEnabledRoles.includes(user.roleSlug)) return true;
  if (s.bulkEditEnabledUserIds.includes(user.id)) return true;
  return false;
}

/**
 * Resolve the final set of ownerships for an owner-IDs change (create, edit or
 * bulk reassign). Rules mirror creation: assignments are limited to the acting
 * user's own team unless the actor is an Admin or a Team Manager (who may
 * assign across all teams); Admin(s) plus each involved team's Team Manager(s)
 * are always owners (never removed). Returns the ownership rows to write;
 * throws a user-facing message on any invalid or disallowed selection.
 */
export async function resolveOwnerships(
  user: SessionUser,
  requestedOwnerIds: string[] | undefined,
  opts: { defaultToSelf?: boolean } = {},
): Promise<{ userId: string; teamId: string }[]> {
  const ownerIds = Array.isArray(requestedOwnerIds)
    ? Array.from(new Set(requestedOwnerIds.filter((id) => typeof id === "string" && id)))
    : [];

  let base: { userId: string; teamId: string }[] = [];
  if (ownerIds.length > 0) {
    const ownerRows = await prisma.user.findMany({
      where: { id: { in: ownerIds }, archivedAt: null },
      select: { id: true, teamId: true },
    });
    if (ownerRows.length !== ownerIds.length) {
      throw new Error("One of the selected owners is not a valid user.");
    }
    // UAT: only Admin and Team Managers may assign across all teams; everyone
    // else can only pick from their own team (regardless of the multi-team policy).
    const mayAssignCrossTeam = user.roleSlug === "admin" || user.roleSlug === "team-manager";
    if (!mayAssignCrossTeam && ownerRows.some((o) => o.teamId !== user.teamId)) {
      throw new Error("You can only assign creators to members of your own team.");
    }
    base = ownerRows.filter((o) => o.teamId != null).map((o) => ({ userId: o.id, teamId: o.teamId! }));
  } else if (opts.defaultToSelf !== false) {
    base = [{ userId: user.id, teamId: user.teamId }];
  }

  const teamIds = new Set(base.map((o) => o.teamId));
  const [admins, teamManagers] = await Promise.all([
    prisma.user.findMany({
      where: { archivedAt: null, role: { slug: "admin" } },
      select: { id: true, teamId: true },
    }),
    prisma.user.findMany({
      where: { archivedAt: null, role: { slug: "team-manager" }, teamId: { in: [...teamIds] } },
      select: { id: true, teamId: true },
    }),
  ]);
  const autoOwners = [...admins, ...teamManagers]
    .filter((u) => !base.some((o) => o.userId === u.id) && u.teamId != null)
    .map((o) => ({ userId: o.id, teamId: o.teamId! }));

  return [...base, ...autoOwners];
}

/** Persist a resolved ownership set for a creator. */
export async function replaceCreatorOwnerships(
  creatorId: string,
  ownerships: { userId: string; teamId: string }[],
  tx: Prisma.TransactionClient = prisma,
) {
  await tx.creatorOwnership.deleteMany({ where: { creatorId } });
  if (ownerships.length > 0) {
    await tx.creatorOwnership.createMany({
      data: ownerships.map((o) => ({ creatorId, userId: o.userId, teamId: o.teamId })),
    });
  }
}

/** Parse the shared creator-list query params (used by GET /api/creators and the export route). */
export function parseCreatorListFilters(params: URLSearchParams): CreatorListFilters {
  const custom: Record<string, string> = {};
  for (const key of params.keys()) {
    if (key.startsWith("cf_")) custom[key.slice(3)] = params.get(key) ?? "";
  }
  const shopifyParam = params.get("shopify");
  const shopify = shopifyParam === "yes" || shopifyParam === "no" ? shopifyParam : undefined;
  const sortParam = params.get("sort");
  const sort = ["latest", "oldest", "name-asc", "name-desc", "created-desc", "created-asc"].includes(
    sortParam ?? "",
  )
    ? (sortParam as NonNullable<CreatorListFilters["sort"]>)
    : undefined;
  return {
    team: params.get("team") ?? "",
    stage: params.get("stage") ?? "",
    platform: params.get("platform") === "all-platform" ? "" : (params.get("platform") ?? ""),
    niche: params.get("niche") ?? "",
    owner: params.get("owner") ?? "",
    q: params.get("q") ?? "",
    pool: params.get("pool") ?? "",
    overdue: params.get("overdue") === "1",
    upcoming: params.get("upcoming") === "1",
    pending: params.get("pending") === "1",
    incomplete: params.get("incomplete") === "1",
    gender: params.get("gender") ?? "",
    shopify,
    country: params.get("country") ?? "",
    city: params.get("city") ?? "",
    creatorType: params.get("creatorType") ?? "",
    createdFrom: params.get("createdFrom") ?? "",
    createdTo: params.get("createdTo") ?? "",
    sort,
    custom,
  };
}

export async function listCreators(user: SessionUser, filters: CreatorListFilters = {}) {
  const { addDays, isBefore } = await import("date-fns");
  const now = new Date();
  const s = await import("./settings").then((m) => m.getSettings());

  const fieldFilters: Prisma.CreatorWhereInput[] = [];
  if (filters.custom) {
    for (const [fieldId, value] of Object.entries(filters.custom)) {
      if (value === "__any__") {
        fieldFilters.push({ customFields: { path: [fieldId], not: Prisma.DbNull } });
      } else if (value !== "") {
        const coercion = await coerceForFilter(fieldId, value);
        fieldFilters.push({ customFields: { path: [fieldId], equals: coercion } });
      }
    }
  }

  const engagementConditions: Prisma.EngagementWhereInput[] = [];
  if (filters.stage) engagementConditions.push({ stageId: filters.stage });
  if (filters.overdue)
    engagementConditions.push({
      deliverables: { some: { status: { not: "APPROVED" }, dueDate: { lt: now } } },
    });
  if (filters.upcoming)
    engagementConditions.push({
      deliverables: {
        some: { status: { not: "APPROVED" }, dueDate: { gte: now, lt: addDays(now, 7) } },
      },
    });

  const and: Prisma.CreatorWhereInput[] = [
    ...(filters.q ? [smartSearchWhere(filters.q)] : []),
    ...(filters.niche ? [{ niche: { has: filters.niche } }] : []),
    ...(filters.platform ? [{ profiles: { some: { platform: filters.platform as Platform } } }] : []),
    ...(filters.owner ? [{ ownerships: { some: { userId: filters.owner } } }] : []),
    ...(filters.gender ? [{ gender: filters.gender }] : []),
    ...(filters.shopify === "yes" ? [{ shopifyRegistered: true }] : []),
    ...(filters.shopify === "no"
      ? [{ OR: [{ shopifyRegistered: false }, { shopifyRegistered: null }] }]
      : []),
    ...(filters.country ? [{ countryId: filters.country }] : []),
    ...(filters.city ? [{ cityId: filters.city }] : []),
    ...(filters.creatorType ? [{ creatorTypeId: filters.creatorType }] : []),
    ...(filters.createdFrom
      ? [{ createdAt: { gte: new Date(`${filters.createdFrom}T00:00:00`) } }]
      : []),
    ...(filters.createdTo
      ? [{ createdAt: { lte: new Date(`${filters.createdTo}T23:59:59`) } }]
      : []),
    ...(engagementConditions.length ? [{ engagements: { some: { AND: engagementConditions } } }] : []),
    ...(filters.pending
      ? [{ approvalStatus: { in: ["PENDING", "REJECTED"] as ApprovalStatus[] } }]
      : [{ approvalStatus: null }]),
    ...(filters.incomplete
      ? [{
          OR: [
            { countryId: null },
            { cityId: null },
            { creatorTypeId: null },
            { phone: null },
            { phone: "" },
          ],
        }]
      : []),
    ...(fieldFilters.length ? fieldFilters : []),
  ];

  const where: Prisma.CreatorWhereInput = {
    deletedAt: null,
    ...(and.length ? { AND: and } : {}),
  };

  const orderBy: Prisma.CreatorOrderByWithRelationInput = (() => {
    switch (filters.sort) {
      case "name-asc":
        return { name: "asc" };
      case "name-desc":
        return { name: "desc" };
      case "created-desc":
        return { createdAt: "desc" };
      case "created-asc":
        return { createdAt: "asc" };
      case "oldest":
        return { updatedAt: "asc" };
      default:
        return { updatedAt: "desc" };
    }
  })();

  const creators = await prisma.creator.findMany({
    where,
    include: {
      primaryProfile: true,
      profiles: true,
      ownerships: { include: { user: true, team: true } },
      engagements: { include: { stage: true, deliverables: true }, orderBy: { createdAt: "desc" } },
      activityLogs: { orderBy: { loggedAt: "desc" }, take: 1 },
      countryRef: true,
      cityRef: true,
      creatorTypeRef: true,
      createdBy: { include: { team: true } },
    },
    orderBy,
  });

  return creators
    .filter((c) => {
      if (filters.pending) return canSeePendingCreator(user, c);
      return true;
    })
    .filter((c) => {
      if (filters.team === "unassigned") return c.ownerships.length === 0;
      if (!filters.team) return true;
      return c.ownerships.some((o) => o.teamId === filters.team);
    })
    .map((c) => {
      const owns = c.ownerships.some((o) => o.userId === user.id);
      const sameTeamOther = c.ownerships.some(
        (o) => o.teamId === user.teamId && o.userId !== user.id,
      );
      const unassigned = c.ownerships.length === 0;

      const nextDeliverable = c.engagements
        .flatMap((e) => e.deliverables)
        .filter((d) => d.status !== "APPROVED")
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];

      const lastActivity = c.activityLogs[0]?.loggedAt;

      let poolStatus: "none" | "same_team" | "company" = "none";
      if (!owns && !sameTeamOther && lastActivity && c.ownerships.length > 0) {
        if (isBefore(lastActivity, addDays(now, -s.inactivityCompanyDays))) poolStatus = "company";
        else if (isBefore(lastActivity, addDays(now, -s.inactivitySameTeamDays))) poolStatus = "same_team";
      }

      const latestEngagement = [...c.engagements].sort(
        (a, b) => (b.completedAt?.getTime() ?? b.createdAt.getTime()) - (a.completedAt?.getTime() ?? a.createdAt.getTime()),
      )[0];
      const currentStage = latestEngagement?.stage ?? null;
      const isOtherTeam =
        !owns && !sameTeamOther && !unassigned && c.ownerships.some((o) => o.teamId !== user.teamId);
      const isManager = user.roleSlug === "team-manager";
      const isAdmin = user.roleSlug === "admin";

      const missingGifting = requiredForGiftingMissing({
        countryId: c.countryId,
        cityId: c.cityId,
        creatorTypeId: c.creatorTypeId,
        phone: c.phone,
      });

      return {
        id: c.id,
        name: c.name,
        gender: c.gender,
        shopifyRegistered: c.shopifyRegistered,
        niche: c.niche,
        followers: c.followers,
        engagementRate: c.engagementRate,
        platform: c.primaryProfile?.platform ?? c.profiles[0]?.platform ?? null,
        handle: c.primaryProfile?.handle ?? c.profiles[0]?.handle ?? null,
        profileUrl: c.primaryProfile?.url ?? c.profiles[0]?.url ?? null,
        profiles: c.profiles.map((p) => ({ platform: p.platform, handle: p.handle, url: p.url })),
        city: c.cityRef?.name ?? c.city,
        country: c.countryRef?.name ?? c.country,
        creatorType: c.creatorTypeRef?.name ?? c.creatorType,
        owners: c.ownerships.map((o) => ({
          id: o.userId,
          name: o.user.displayName,
          teamId: o.teamId,
          teamName: o.team.name,
        })),
        teams: [...new Map(c.ownerships.map((o) => [o.teamId, { id: o.teamId, name: o.team.name }])).values()],
        stage: currentStage ? { id: currentStage.id, name: currentStage.name } : null,
        currentEngagementId: latestEngagement?.id ?? null,
        completedAt: c.engagements.find((e) => e.completedAt)?.completedAt ?? null,
        canMove: isAdmin ? owns || sameTeamOther : canMoveStage(user, owns, isManager),
        isOverdue:
          !!nextDeliverable &&
          nextDeliverable.dueDate.getTime() < new Date().getTime(),
        nextDeliverable: isOtherTeam
          ? null
          : nextDeliverable
            ? { id: nextDeliverable.id, title: nextDeliverable.title, dueDate: nextDeliverable.dueDate }
            : null,
        lastActivityAt: lastActivity ?? null,
        relationship: owns
          ? "owned"
          : unassigned
            ? "available"
            : sameTeamOther
              ? "same_team"
              : c.ownerships.length
                ? "other_team"
                : "none",
        poolStatus,
        missingRequiredForGifting: missingGifting,
        incompleteData: missingGifting.length > 0,
        approvalStatus: c.approvalStatus,
        approvalVisible: canSeePendingCreator(user, c),
        requestedBy: c.createdBy ? { id: c.createdBy.id, name: c.createdBy.displayName, teamId: c.createdBy.teamId } : null,
        reviewComment: c.reviewComment,
        createdAt: c.createdAt,
      };
    })
    .filter((i) => {
      if (filters.pool === "same_team") return i.poolStatus === "same_team";
      if (filters.pool === "company") return i.poolStatus === "company";
      return true;
    });
}

async function coerceForFilter(fieldId: string, value: string): Promise<string | number | boolean> {
  const fields = await listCreatorFields();
  const field = fields.find((f) => f.id === fieldId);
  if (!field) return value;
  const coerced = coerceFieldValue(field, value);
  return coerced === null ? value : coerced;
}

export async function listTeamPipeline(user: SessionUser) {
  const configs = await prisma.pipelineConfig.findMany({
    where: { teamId: user.teamId },
    include: { stage: true },
    orderBy: { order: "asc" },
  });
  return configs.map((c) => ({
    id: c.stage.id,
    name: c.stage.name,
    order: c.order,
    isCompleted: c.isCompleted,
  }));
}

export async function listTeams() {
  return prisma.team.findMany({ orderBy: { name: "asc" } });
}

export async function listUsersForFilter() {
  return prisma.user.findMany({ select: { id: true, displayName: true, teamId: true } });
}

export function canMoveStage(user: SessionUser, owns: boolean, isTeamManager: boolean): boolean {
  if (isTeamManager) return user.permissions.includes("creator.moveStage");
  return owns && user.permissions.includes("creator.moveStage");
}