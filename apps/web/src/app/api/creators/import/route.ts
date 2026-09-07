import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import { looksLikeUrl, detectPlatformFromUrl } from "@/lib/constants";
import {
  validateCreatorInput,
  validateProfileEntry,
  findDuplicateProfile,
  findDuplicatePhone,
} from "@/lib/creators";
import { logActivity, logTransaction } from "@/lib/activity";
import type { SessionUser } from "@/lib/auth";
import type { Platform } from "@prisma/client";

const MAX_ROWS = 500;

const PLATFORM_COLUMNS: Record<string, Platform> = {
  instagram: "INSTAGRAM",
  ig: "INSTAGRAM",
  tiktok: "TIKTOK",
  youtube: "YOUTUBE",
  x: "X",
  twitter: "X",
  snapchat: "SNAPCHAT",
  snap: "SNAPCHAT",
  facebook: "FACEBOOK",
  fb: "FACEBOOK",
  linkedin: "LINKEDIN",
  twitch: "TWITCH",
};

type RowFields = {
  name: string;
  gender: string;
  country: string;
  city: string;
  creatorType: string;
  niche: string;
  phone: string;
  email: string;
  handles: string;
  platformHandles: { platform: Platform; value: string }[];
};

const FIELD_COLUMNS: Record<string, keyof RowFields> = {
  name: "name",
  creatorname: "name",
  fullname: "name",
  gender: "gender",
  country: "country",
  city: "city",
  creatortype: "creatorType",
  type: "creatorType",
  category: "creatorType",
  niche: "niche",
  niches: "niche",
  phone: "phone",
  phonenumber: "phone",
  mobile: "phone",
  tel: "phone",
  email: "email",
  emailaddress: "email",
  handles: "handles",
  handle: "handles",
  platformhandle: "handles",
  platformhandles: "handles",
  socials: "handles",
  profiles: "handles",
  links: "handles",
};

function normKey(h: unknown): string {
  return String(h)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

type ImportRowResult = {
  name: string;
  status: "created" | "skipped" | "failed";
  message: string;
};

export async function POST(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;
  if (session.roleSlug !== "admin") return jsonError("Only the Admin can import creators.", 403);

  const form = await req.formData();
  const file = form.get("file");
  if (!file || typeof file === "string" || typeof file === "boolean") {
    return jsonError("Attach an Excel (.xlsx) file.", 400);
  }

  let workbook: XLSX.WorkBook;
  try {
    const arrayBuffer = await (file as File).arrayBuffer();
    workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
  } catch {
    return jsonError("That file could not be parsed as an Excel workbook.", 400);
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return jsonError("The workbook has no sheets.", 400);
  const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
  }) as unknown[][];

  const headerIndex = rawRows.findIndex((row) => row.some((v) => String(v).trim() !== ""));
  if (headerIndex < 0) return jsonError("The sheet is empty — it needs a header row.", 400);

  const headers = rawRows[headerIndex];
  const colMap = new Map<string, number>();
  headers.forEach((h, i) => {
    const key = normKey(h);
    if (key) colMap.set(key, i);
  });

  const fieldCol = new Map<string, number>();
  for (const [header, field] of Object.entries(FIELD_COLUMNS)) {
    const idx = colMap.get(header);
    if (idx !== undefined) fieldCol.set(field, idx);
  }
  const platformCols: { platform: Platform; idx: number }[] = [];
  for (const [header, platform] of Object.entries(PLATFORM_COLUMNS)) {
    const idx = colMap.get(header);
    if (idx !== undefined) platformCols.push({ platform, idx });
  }

  if (fieldCol.size === 0 && platformCols.length === 0) {
    return jsonError(
      "No recognized columns. Expected headers like: Name, Gender, Country, City, Creator Type, Niche, Phone, Email, Industry-handle columns (Instagram, TikTok…), or a Platform Handles column.",
      400,
    );
  }

  const lookup = (row: unknown[], idx: number | undefined): string =>
    idx === undefined ? "" : String(row[idx] ?? "").trim();

  const countries = await prisma.country.findMany({
    include: { cities: true },
  });
  const countryByName = new Map<string, (typeof countries)[number]>();
  countries.forEach((c) => countryByName.set(c.name.toLowerCase(), c));
  const creatorTypes = await prisma.creatorType.findMany();
  const creatorTypeByName = new Map<string, string>();
  creatorTypes.forEach((t) => creatorTypeByName.set(t.name.toLowerCase(), t.id));

  const dataRows = rawRows.slice(headerIndex + 1, headerIndex + 1 + MAX_ROWS);
  if (rawRows.length - headerIndex - 1 > MAX_ROWS) {
    return jsonError(`Too many rows — the import is capped at ${MAX_ROWS} creators per file.`, 400);
  }

  const results: ImportRowResult[] = [];
  let createdCount = 0;

  for (const row of dataRows) {
    const name = lookup(row, fieldCol.get("name"));
    const email = lookup(row, fieldCol.get("email")).toLowerCase();
    const phoneRaw = lookup(row, fieldCol.get("phone"));
    const phoneDigits = phoneRaw.replace(/\D/g, "");
    const hasAny =
      name || email || phoneDigits || platformCols.some((c) => lookup(row, c.idx)) || fieldCol.has("handles");
    if (!hasAny) continue;

    const countryName = lookup(row, fieldCol.get("country"));
    const countryRow = countryName ? countryByName.get(countryName.toLowerCase()) : undefined;
    const cityName = lookup(row, fieldCol.get("city"));
    const cityId =
      countryRow && cityName
        ? (countryRow.cities.find((c) => c.name.toLowerCase() === cityName.toLowerCase())?.id ?? null)
        : null;

    const platformHandles: RowFields["platformHandles"] = [];
    for (const { platform, idx } of platformCols) {
      const value = lookup(row, idx);
      if (value) platformHandles.push({ platform, value });
    }

    const handlesCell = lookup(row, fieldCol.get("handles"));
    const tokens = handlesCell.split(/[,;\n]+/).map((t) => t.trim()).filter(Boolean);
    for (const token of tokens) {
      const prefixed = token.match(/^([A-Za-z]+)[@:|]\s*(.+)$/);
      const named = prefixed ? PLATFORM_COLUMNS[prefixed[1].toLowerCase()] : null;
      if (named) {
        platformHandles.push({ platform: named, value: prefixed?.[2] ?? token });
      } else if (looksLikeUrl(token)) {
        const detected = detectPlatformFromUrl(token);
        if (detected) platformHandles.push({ platform: detected, value: token });
      } else if (platformHandles.length === 0 && platformCols.length === 1) {
        platformHandles.push({ platform: platformCols[0].platform, value: token });
      }
    }

    const profilesInput = platformHandles.map((p, i) => {
      const value = p.value.trim();
      const compliant = !looksLikeUrl(value) && !value.startsWith("@") ? `@${value}` : value;
      return { platform: p.platform, input: compliant, isPrimary: i === 0 };
    });

    if (!name) {
      results.push({ name: profilesInput[0]?.input || "(no name)", status: "failed", message: "Creator name is required." });
      continue;
    }

    let validated;
    try {
      validated = profilesInput.map((p) => validateProfileEntry(p));
      const seen = new Set<string>();
      for (const p of validated) {
        const key = `${p.platform}:${p.normalizedHandle}`;
        if (seen.has(key)) throw new Error(`Duplicate profile for @${p.handle}.`);
        seen.add(key);
      }
    } catch (e) {
      results.push({ name, status: "failed", message: e instanceof Error ? e.message : String(e) });
      continue;
    }

    let data;
    try {
      data = await validateCreatorInput(
        {
          name,
          email: email || undefined,
          phoneCountryId: countryRow?.id,
          phoneNumber: phoneDigits || undefined,
          countryId: countryRow?.id,
          cityId: cityId ?? undefined,
          creatorTypeId: creatorTypeByName.get(lookup(row, fieldCol.get("creatorType")).toLowerCase()) ?? undefined,
          gender: lookup(row, fieldCol.get("gender")) || undefined,
          niche: lookup(row, fieldCol.get("niche")) ? lookup(row, fieldCol.get("niche")).split(/[,;\n]+/) : [],
          profiles: profilesInput,
        },
        { isCreate: true },
      );
    } catch (e) {
      results.push({ name, status: "failed", message: e instanceof Error ? e.message : String(e) });
      continue;
    }

    if (!data.data.gender) {
      results.push({ name, status: "failed", message: "Gender is required." });
      continue;
    }

    const d = data.data;
    const skipReasons: string[] = [];
    if (d.email) {
      const dupEmail = await prisma.creator.findUnique({ where: { email: d.email } });
      if (dupEmail) skipReasons.push(`Email ${d.email} already belongs to ${dupEmail.name}.`);
    }
    if (d.phone) {
      const dupPhone = await findDuplicatePhone(d.phone);
      if (dupPhone) skipReasons.push(`Phone ${d.phone} already belongs to ${dupPhone.name}.`);
    }
    for (const p of validated) {
      const dup = await findDuplicateProfile(p.url, p.platform);
      if (dup) {
        skipReasons.push(`@${p.handle} on ${p.platform} is already linked to ${dup.creator.name}.`);
        break;
      }
    }
    if (skipReasons.length) {
      results.push({ name, status: "skipped", message: skipReasons.join(" ") });
      continue;
    }

    const hasMarkedPrimary = validated.some((p) => p.isPrimary);
    const finalProfiles = validated.map((p, i) => ({
      ...p,
      isPrimary: p.isPrimary ?? (hasMarkedPrimary ? false : i === 0),
    }));

    try {
      const creator = await prisma.$transaction(async (tx) => {
        const c = await tx.creator.create({
          data: {
            name: d.name,
            email: d.email,
            phone: d.phone,
            niche: d.niche,
            countryId: d.countryId,
            cityId: d.cityId,
            creatorTypeId: d.creatorTypeId,
            gender: d.gender,
            shopifyRegistered: d.shopifyRegistered ?? false,
            followers: d.followers,
            engagementRate: d.engagementRate,
            notes: d.notes,
            customFields: Object.keys(d.customFields).length ? d.customFields : undefined,
            createdById: session.id,
            approvalStatus: null,
            ownerships: { create: { userId: session.id, teamId: session.teamId } },
          },
        });
        await tx.platformProfile.createMany({
          data: finalProfiles.map((p) => ({
            creatorId: c.id,
            url: p.url,
            platform: p.platform,
            isPrimary: p.isPrimary,
            handle: p.handle,
            normalizedHandle: p.normalizedHandle,
          })),
        });
        const primary = await tx.platformProfile.findFirst({ where: { creatorId: c.id, isPrimary: true } });
        if (primary) {
          await tx.creator.update({ where: { id: c.id }, data: { primaryProfileId: primary.id } });
        }
        return c;
      });

      const profileSummary = finalProfiles.map((p) => `@${p.handle}`).join(", ");
      await logActivity({
        creatorId: creator.id,
        kind: "SYSTEM",
        type: "CREATOR_CREATED",
        summary: "Creator created via Excel import",
        description: `Platform profiles: ${profileSummary}`,
        authorId: session.id,
      });
      await logTransaction({
        userId: session.id,
        action: "creator.create",
        entityType: "Creator",
        entityId: creator.id,
        detail: `Imported ${creator.name} via Excel`,
      });
      createdCount += 1;
      results.push({ name, status: "created", message: "" });
    } catch (e) {
      results.push({ name, status: "failed", message: e instanceof Error ? e.message : String(e) });
    }
  }

  const summary = {
    total: results.length,
    created: results.filter((r) => r.status === "created").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed").length,
    rows: results,
  };

  if (createdCount > 0) {
    await logTransaction({
      userId: session.id,
      action: "creator.import",
      entityType: "Creator",
      entityId: "batch",
      detail: `Imported ${summary.created} creators via Excel (${summary.skipped} skipped, ${summary.failed} failed)`,
    });
  }

  return NextResponse.json(summary);
}