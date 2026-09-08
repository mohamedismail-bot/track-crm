import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings, setSettingsMany } from "@/lib/settings";
import { BRAND_COLORS, SETTING_KEYS } from "@/lib/constants";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import { storeUpload } from "@/lib/blob";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;

export async function GET() {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (!user.permissions.includes("settings.manage")) {
    return jsonError("No permission to manage settings.", 403);
  }
  const settings = await getSettings();
  const stages = await prisma.stage.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({
    ...settings,
    stages: stages.map((s) => ({ id: s.id, name: s.name, isCompleted: s.isCompleted })),
  });
}

export async function PUT(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (!user.permissions.includes("settings.manage")) {
    return jsonError("No permission to manage settings.", 403);
  }

  const contentType = req.headers.get("content-type") ?? "";
  const body: Record<string, unknown> = {};
  let logoFile: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    for (const [key, value] of form.entries()) {
      if (value instanceof File) {
        if (key === "logo" && value.size > 0) logoFile = value;
        continue;
      }
      if (value === "true") body[key] = true;
      else if (value === "false") body[key] = false;
      else body[key] = String(value);
    }
  } else {
    const parsed = await req.json();
    Object.assign(body, parsed);
  }

  const entries: Record<string, string> = {};

  if (body.name !== undefined) entries[SETTING_KEYS.WORKSPACE_NAME] = String(body.name);
  if (body.primaryColor !== undefined) {
    const color = String(body.primaryColor);
    if (!Object.prototype.hasOwnProperty.call(BRAND_COLORS, color)) {
      return jsonError("Invalid brand accent color.", 400);
    }
    entries[SETTING_KEYS.PRIMARY_COLOR] = color;
  }
  if (body.logoUrl !== undefined && logoFile === null)
    entries[SETTING_KEYS.COMPANY_LOGO] = String(body.logoUrl);
  if (body.removeLogo === true && logoFile === null)
    entries[SETTING_KEYS.COMPANY_LOGO] = "";
  if (logoFile) {
    if (logoFile.size > MAX_LOGO_BYTES) {
      return jsonError("Logo must be smaller than 5 MB.", 400);
    }
    const stored = await storeUpload(logoFile, "logos");
    entries[SETTING_KEYS.COMPANY_LOGO] = stored.url;
  }
  if (body.multiTeam !== undefined) entries[SETTING_KEYS.MULTI_TEAM] = body.multiTeam ? "true" : "false";
  if (body.multiOwner !== undefined) entries[SETTING_KEYS.MULTI_OWNER] = body.multiOwner ? "true" : "false";
  if (body.inactivitySameTeamDays !== undefined) {
    const n = Number(body.inactivitySameTeamDays);
    if (!Number.isFinite(n) || n < 1) return jsonError("Invalid inactivity threshold (same team).", 400);
    entries[SETTING_KEYS.INACTIVITY_SAME_TEAM] = String(Math.round(n));
  }
  if (body.inactivityCompanyDays !== undefined) {
    const n = Number(body.inactivityCompanyDays);
    if (!Number.isFinite(n) || n < 1) return jsonError("Invalid inactivity threshold (company).", 400);
    entries[SETTING_KEYS.INACTIVITY_COMPANY] = String(Math.round(n));
  }
  // Validate cross-field: company threshold must be strictly longer than the
  // same-team threshold, regardless of whether both were sent together.
  if (entries[SETTING_KEYS.INACTIVITY_COMPANY] || entries[SETTING_KEYS.INACTIVITY_SAME_TEAM]) {
    const current = await getSettings();
    const company = Number(entries[SETTING_KEYS.INACTIVITY_COMPANY]) || current.inactivityCompanyDays;
    const sameTeam = Number(entries[SETTING_KEYS.INACTIVITY_SAME_TEAM]) || current.inactivitySameTeamDays;
    if (company <= sameTeam) {
      return jsonError("Company threshold must be longer than the same-team threshold.", 400);
    }
  }
  if (body.giftMonthlyCapEnabled !== undefined)
    entries[SETTING_KEYS.GIFT_MONTHLY_CAP] = body.giftMonthlyCapEnabled ? "true" : "false";
  if (body.giftRequirePreviousDeliverable !== undefined)
    entries[SETTING_KEYS.GIFT_REQUIRE_PREV_DELIVERABLE] = body.giftRequirePreviousDeliverable ? "true" : "false";
  if (body.giftMinStageId !== undefined) {
    const stageId = String(body.giftMinStageId ?? "");
    if (stageId && stageId !== "none") {
      const stage = await prisma.stage.findUnique({ where: { id: stageId } });
      if (!stage) return jsonError("Invalid minimum gift stage.", 400);
    }
    entries[SETTING_KEYS.GIFT_MIN_STAGE_ID] = stageId === "none" ? "" : stageId;
  }
  if (body.shopifyMinStageId !== undefined) {
    const stageId = String(body.shopifyMinStageId ?? "");
    if (stageId && stageId !== "none") {
      const stage = await prisma.stage.findUnique({ where: { id: stageId } });
      if (!stage) return jsonError("Invalid minimum Shopify stage.", 400);
    }
    entries[SETTING_KEYS.SHOPIFY_MIN_STAGE_ID] = stageId === "none" ? "" : stageId;
  }
  if (body.exportEnabledRoles !== undefined) {
    let arr: unknown = body.exportEnabledRoles;
    if (typeof arr === "string") {
      try {
        arr = JSON.parse(arr);
      } catch {
        return jsonError("exportEnabledRoles must be a JSON array of strings.", 400);
      }
    }
    if (!Array.isArray(arr) || arr.some((x) => typeof x !== "string")) return jsonError("exportEnabledRoles must be a JSON array of strings.", 400);
    entries[SETTING_KEYS.EXPORT_ENABLED_ROLES] = JSON.stringify(arr);
  }
  if (body.exportEnabledUserIds !== undefined) {
    let arr: unknown = body.exportEnabledUserIds;
    if (typeof arr === "string") {
      try {
        arr = JSON.parse(arr);
      } catch {
        return jsonError("exportEnabledUserIds must be a JSON array of strings.", 400);
      }
    }
    if (!Array.isArray(arr) || arr.some((x) => typeof x !== "string")) return jsonError("exportEnabledUserIds must be a JSON array of strings.", 400);
    entries[SETTING_KEYS.EXPORT_ENABLED_USER_IDS] = JSON.stringify(arr);
  }
  if (body.bulkEditEnabledRoles !== undefined) {
    let arr: unknown = body.bulkEditEnabledRoles;
    if (typeof arr === "string") {
      try {
        arr = JSON.parse(arr);
      } catch {
        return jsonError("bulkEditEnabledRoles must be a JSON array of strings.", 400);
      }
    }
    if (!Array.isArray(arr) || arr.some((x) => typeof x !== "string")) return jsonError("bulkEditEnabledRoles must be a JSON array of strings.", 400);
    entries[SETTING_KEYS.BULK_EDIT_ENABLED_ROLES] = JSON.stringify(arr);
  }
  if (body.bulkEditEnabledUserIds !== undefined) {
    let arr: unknown = body.bulkEditEnabledUserIds;
    if (typeof arr === "string") {
      try {
        arr = JSON.parse(arr);
      } catch {
        return jsonError("bulkEditEnabledUserIds must be a JSON array of strings.", 400);
      }
    }
    if (!Array.isArray(arr) || arr.some((x) => typeof x !== "string")) return jsonError("bulkEditEnabledUserIds must be a JSON array of strings.", 400);
    entries[SETTING_KEYS.BULK_EDIT_ENABLED_USER_IDS] = JSON.stringify(arr);
  }
  if (body.passwordMinLength !== undefined) {
    const n = Number(body.passwordMinLength);
    if (!Number.isFinite(n) || n < 6) return jsonError("Minimum password length must be at least 6.", 400);
    entries[SETTING_KEYS.PASSWORD_MIN_LENGTH] = String(Math.round(n));
  }
  if (body.passwordComplexity !== undefined)
    entries[SETTING_KEYS.PASSWORD_COMPLEXITY] = body.passwordComplexity ? "true" : "false";
  if (body.genderOptions !== undefined) {
    let opts: unknown = body.genderOptions;
    if (typeof body.genderOptions === "string") {
      try {
        opts = JSON.parse(body.genderOptions);
      } catch {
        return jsonError("genderOptions must be a JSON array of strings.", 400);
      }
    }
    if (
      !Array.isArray(opts) ||
      opts.length === 0 ||
      typeof opts[0] !== "string" ||
      opts.some((o) => typeof o !== "string" || !o.trim())
    ) {
      return jsonError("At least one gender option is required.", 400);
    }
    entries[SETTING_KEYS.GENDER_OPTIONS] = JSON.stringify(opts.map((o) => String(o).trim()));
  }
  if (body.nicheOptions !== undefined) {
    let opts: unknown = body.nicheOptions;
    if (typeof body.nicheOptions === "string") {
      try {
        opts = JSON.parse(body.nicheOptions);
      } catch {
        return jsonError("nicheOptions must be a JSON array of strings.", 400);
      }
    }
    if (
      !Array.isArray(opts) ||
      opts.some((o) => typeof o !== "string" || !o.trim())
    ) {
      return jsonError("Niche options must be a JSON array of strings.", 400);
    }
    entries[SETTING_KEYS.NICHE_OPTIONS] = JSON.stringify(opts.map((o) => String(o).trim()));
  }
  if (body.customFieldsEnabled !== undefined)
    entries[SETTING_KEYS.CUSTOM_FIELDS_ENABLED] = body.customFieldsEnabled ? "true" : "false";
  if (body.approvalEnabled !== undefined)
    entries[SETTING_KEYS.APPROVAL_REQUIRED] = body.approvalEnabled ? "true" : "false";
  if (body.unassignedVisibleFields !== undefined) {
    let opts: unknown = body.unassignedVisibleFields;
    if (typeof body.unassignedVisibleFields === "string") {
      try {
        opts = JSON.parse(body.unassignedVisibleFields);
      } catch {
        return jsonError("unassignedVisibleFields must be a JSON array of strings.", 400);
      }
    }
    if (!Array.isArray(opts) || opts.some((o) => typeof o !== "string")) {
      return jsonError("unassignedVisibleFields must be a JSON array of strings.", 400);
    }
    const allowed = new Set([
      "platformLink",
      "creatorName",
      "city",
      "phone",
      "email",
      "followers",
      "engagementRate",
      "creatorType",
      "shopify",
    ]);
    const cleaned = (opts as string[]).filter((o) => allowed.has(o));
    // Platform link + creator name are always mandatory for unassigned teams.
    entries[SETTING_KEYS.UNASSIGNED_VISIBLE_FIELDS] = JSON.stringify(
      Array.from(new Set(["platformLink", "creatorName", ...cleaned])),
    );
  }

  if (Object.keys(entries).length === 0) return jsonError("No valid settings provided.", 400);
  await setSettingsMany(entries);
  return NextResponse.json({ ok: true });
}