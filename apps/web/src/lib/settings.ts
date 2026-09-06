import "server-only";
import { prisma } from "./prisma";
import { DEFAULT_SETTINGS, DEFAULT_PRIMARY_COLOR, SETTING_KEYS } from "./constants";

export interface WorkspaceSettings {
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
}

export async function getSettings(): Promise<WorkspaceSettings> {
  const rows = await prisma.workspaceSetting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const all = { ...DEFAULT_SETTINGS, ...map };
  return {
    name: all[SETTING_KEYS.WORKSPACE_NAME] ?? "Parishia Smart",
    logoUrl: all[SETTING_KEYS.COMPANY_LOGO] ?? "",
    primaryColor: all[SETTING_KEYS.PRIMARY_COLOR] || DEFAULT_PRIMARY_COLOR,
    multiTeam: all[SETTING_KEYS.MULTI_TEAM] === "true",
    multiOwner: all[SETTING_KEYS.MULTI_OWNER] === "true",
    inactivitySameTeamDays: safeInt(all[SETTING_KEYS.INACTIVITY_SAME_TEAM], 30),
    inactivityCompanyDays: safeInt(all[SETTING_KEYS.INACTIVITY_COMPANY], 60),
    giftMonthlyCapEnabled: all[SETTING_KEYS.GIFT_MONTHLY_CAP] !== "false",
    giftRequirePreviousDeliverable: all[SETTING_KEYS.GIFT_REQUIRE_PREV_DELIVERABLE] !== "false",
    giftMinStageId: all[SETTING_KEYS.GIFT_MIN_STAGE_ID] || null,
    exportEnabledRoles: jsonArray(all[SETTING_KEYS.EXPORT_ENABLED_ROLES]),
    passwordMinLength: safeInt(all[SETTING_KEYS.PASSWORD_MIN_LENGTH], 8),
    passwordComplexity: all[SETTING_KEYS.PASSWORD_COMPLEXITY] === "true",
  };
}

function safeInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function jsonArray(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function setSetting(key: string, value: string) {
  await prisma.workspaceSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function setSettingsMany(entries: Record<string, string>) {
  for (const [key, value] of Object.entries(entries)) {
    await setSetting(key, value);
  }
}

/**
 * Validate a new/adjusted password against the workspace password policy.
 * Returns an error message when the password does not satisfy the policy,
 * or null when it is acceptable.
 */
export async function validatePassword(pw: string): Promise<string | null> {
  const settings = await getSettings();
  if (pw.length < settings.passwordMinLength) {
    return `Password must be at least ${settings.passwordMinLength} characters.`;
  }
  if (settings.passwordComplexity) {
    if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw) || !/[^A-Za-z0-9]/.test(pw)) {
      return "Password must include upper and lower case letters, a number and a symbol.";
    }
  }
  return null;
}