import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getSettings, setSettingsMany } from "@/lib/settings";
import { BRAND_COLORS, SETTING_KEYS } from "@/lib/constants";
import { jsonError, requireApiUser } from "@/lib/api-utils";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
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
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `logo-${Date.now()}-${logoFile.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const buffer = Buffer.from(await logoFile.arrayBuffer());
    await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);
    entries[SETTING_KEYS.COMPANY_LOGO] = `/uploads/${filename}`;
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
    if (n <= Number(entries[SETTING_KEYS.INACTIVITY_SAME_TEAM] ?? 0)) {
      return jsonError("Company threshold must be longer than the same-team threshold.", 400);
    }
    entries[SETTING_KEYS.INACTIVITY_COMPANY] = String(Math.round(n));
  }
  if (body.giftMonthlyCapEnabled !== undefined)
    entries[SETTING_KEYS.GIFT_MONTHLY_CAP] = body.giftMonthlyCapEnabled ? "true" : "false";
  if (body.giftRequirePreviousDeliverable !== undefined)
    entries[SETTING_KEYS.GIFT_REQUIRE_PREV_DELIVERABLE] = body.giftRequirePreviousDeliverable ? "true" : "false";
  if (body.giftMinStageId !== undefined)
    entries[SETTING_KEYS.GIFT_MIN_STAGE_ID] = String(body.giftMinStageId ?? "");
  if (body.exportEnabledRoles !== undefined)
    entries[SETTING_KEYS.EXPORT_ENABLED_ROLES] = JSON.stringify(body.exportEnabledRoles ?? []);
  if (body.passwordMinLength !== undefined) {
    const n = Number(body.passwordMinLength);
    if (!Number.isFinite(n) || n < 6) return jsonError("Minimum password length must be at least 6.", 400);
    entries[SETTING_KEYS.PASSWORD_MIN_LENGTH] = String(Math.round(n));
  }
  if (body.passwordComplexity !== undefined)
    entries[SETTING_KEYS.PASSWORD_COMPLEXITY] = body.passwordComplexity ? "true" : "false";

  if (Object.keys(entries).length === 0) return jsonError("No valid settings provided.", 400);
  await setSettingsMany(entries);
  return NextResponse.json({ ok: true });
}