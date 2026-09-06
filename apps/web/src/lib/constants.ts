import { Platform, DealType, Currency, DeliverableStatus, GiftStatus, ActivityType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Permission tokens
// ---------------------------------------------------------------------------
export const PERMISSIONS = {
  CREATOR_CREATE: "creator.create",
  CREATOR_EDIT: "creator.edit",
  CREATOR_DELETE: "creator.delete",
  CREATOR_MOVE_STAGE: "creator.moveStage",
  ACTIVITY_LOG: "activity.log",
  ENGAGEMENT_CREATE: "engagement.create",
  ENGAGEMENT_EDIT: "engagement.edit",
  DELIVERABLE_SUBMIT: "deliverable.submit",
  DELIVERABLE_APPROVE: "deliverable.approve",
  DELIVERABLE_VERIFY: "deliverable.verify",
  GIFT_REQUEST: "gift.request",
  GIFT_APPROVE: "gift.approve",
  GIFT_FULFILL: "gift.fulfill",
  REQUEST_CREATE: "request.create",
  REQUEST_APPROVE: "request.approve",
  USER_MANAGE: "user.manage",
  ROLE_MANAGE: "role.manage",
  TEAM_MANAGE: "team.manage",
  EXPORT_CSV: "export.csv",
  IMPORT_CSV: "import.csv",
  REPORT_VIEW: "report.view",
  TRANSACTION_LOG_VIEW: "transactionLog.view",
  SETTINGS_MANAGE: "settings.manage",
  NOTIFICATION_READ: "notification.read",
} as const;

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

// ---------------------------------------------------------------------------
// Role seeds: default permission sets
// ---------------------------------------------------------------------------
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ALL_PERMISSIONS,
  "team-manager": [
    PERMISSIONS.CREATOR_CREATE,
    PERMISSIONS.CREATOR_EDIT,
    PERMISSIONS.CREATOR_MOVE_STAGE,
    PERMISSIONS.ACTIVITY_LOG,
    PERMISSIONS.ENGAGEMENT_CREATE,
    PERMISSIONS.ENGAGEMENT_EDIT,
    PERMISSIONS.DELIVERABLE_SUBMIT,
    PERMISSIONS.DELIVERABLE_APPROVE,
    PERMISSIONS.DELIVERABLE_VERIFY,
    PERMISSIONS.GIFT_REQUEST,
    PERMISSIONS.GIFT_APPROVE,
    PERMISSIONS.REQUEST_CREATE,
    PERMISSIONS.REQUEST_APPROVE,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.TRANSACTION_LOG_VIEW,
    PERMISSIONS.NOTIFICATION_READ,
  ],
  "team-leader": [
    PERMISSIONS.CREATOR_CREATE,
    PERMISSIONS.CREATOR_EDIT,
    PERMISSIONS.CREATOR_MOVE_STAGE,
    PERMISSIONS.ACTIVITY_LOG,
    PERMISSIONS.ENGAGEMENT_CREATE,
    PERMISSIONS.ENGAGEMENT_EDIT,
    PERMISSIONS.DELIVERABLE_SUBMIT,
    PERMISSIONS.GIFT_REQUEST,
    PERMISSIONS.REQUEST_CREATE,
    PERMISSIONS.NOTIFICATION_READ,
  ],
  warehouse: [
    PERMISSIONS.GIFT_FULFILL,
    PERMISSIONS.NOTIFICATION_READ,
  ],
};

// ---------------------------------------------------------------------------
// Display metadata
// ---------------------------------------------------------------------------
export const PLATFORM_LABELS: Record<Platform, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  X: "X (Twitter)",
  SNAPCHAT: "Snapchat",
  FACEBOOK: "Facebook",
  LINKEDIN: "LinkedIn",
  TWITCH: "Twitch",
  OTHER: "Other",
};

export const DEAL_TYPE_LABELS: Record<DealType, string> = {
  FIXED_BUDGET: "Fixed Budget",
  COMMISSION: "Commission",
  BARTER: "Barter / Gift",
};

export const CURRENCY_LABELS: Record<Currency, string> = {
  EGP: "EGP",
  USD: "USD",
  EUR: "EUR",
};

export const DELIVERABLE_STATUS_LABELS: Record<DeliverableStatus, string> = {
  PENDING: "Pending",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  REVISION_REQUESTED: "Revision Requested",
};

export const GIFT_STATUS_LABELS: Record<GiftStatus, string> = {
  REQUESTED: "Requested",
  APPROVED_QUEUED: "Approved / Queued",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  REJECTED: "Rejected",
};

export const MANUAL_ACTIVITY_TYPES = ["CALL", "DM", "EMAIL", "MEETING", "NOTE"] as const;

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  CALL: "Call",
  DM: "DM",
  EMAIL: "Email",
  MEETING: "Meeting",
  NOTE: "Note",
  STAGE_CHANGED: "Stage changed",
  OWNERSHIP_CHANGED: "Ownership changed",
  GIFT_REQUESTED: "Gift requested",
  GIFT_APPROVED: "Gift approved",
  GIFT_REJECTED: "Gift rejected",
  GIFT_DISPATCHED: "Gift dispatched",
  GIFT_DELIVERED: "Gift delivered",
  DELIVERABLE_SUBMITTED: "Deliverable submitted",
  DELIVERABLE_APPROVED: "Deliverable approved",
  DELIVERABLE_REVISION_REQUESTED: "Deliverable revision requested",
  ENGAGEMENT_CREATED: "Engagement created",
  ENGAGEMENT_COMPLETED: "Engagement completed",
  CREATOR_CREATED: "Creator created",
  CREATOR_UPDATED: "Creator updated",
  REQUEST_CREATED: "Availability request created",
  REQUEST_RESOLVED: "Availability request resolved",
};

// ---------------------------------------------------------------------------
// Workspace setting keys
// ---------------------------------------------------------------------------
export const SETTING_KEYS = {
  WORKSPACE_NAME: "workspace.name",
  COMPANY_LOGO: "workspace.logoUrl",
  PRIMARY_COLOR: "brand.primaryColor",
  MULTI_TEAM: "ownership.multiTeam",
  MULTI_OWNER: "ownership.multiOwner",
  INACTIVITY_SAME_TEAM: "inactivity.sameTeamDays",
  INACTIVITY_COMPANY: "inactivity.companyDays",
  GIFT_MONTHLY_CAP: "gift.monthlyCapEnabled",
  GIFT_REQUIRE_PREV_DELIVERABLE: "gift.requirePreviousDeliverable",
  GIFT_MIN_STAGE_ID: "gift.minStageId",
  EXPORT_ENABLED_ROLES: "export.enabledRoles",
  PASSWORD_MIN_LENGTH: "password.minLength",
  PASSWORD_COMPLEXITY: "password.complexity",
} as const;

export interface BrandColor {
  label: string;
  light: { primary: string; primaryForeground: string; ring: string };
  dark: { primary: string; primaryForeground: string; ring: string };
}

export const DEFAULT_PRIMARY_COLOR = "indigo";

export const BRAND_COLORS: Record<string, BrandColor> = {
  indigo: {
    label: "Indigo",
    light: {
      primary: "oklch(0.42 0.14 262)",
      primaryForeground: "oklch(0.985 0 0)",
      ring: "oklch(0.71 0.09 262.7)",
    },
    dark: {
      primary: "oklch(0.7 0.12 264)",
      primaryForeground: "oklch(0.16 0.02 258)",
      ring: "oklch(0.56 0.09 264)",
    },
  },
  blue: {
    label: "Blue",
    light: {
      primary: "oklch(0.45 0.15 252)",
      primaryForeground: "oklch(0.985 0 0)",
      ring: "oklch(0.74 0.1 252)",
    },
    dark: {
      primary: "oklch(0.71 0.13 253)",
      primaryForeground: "oklch(0.16 0.02 250)",
      ring: "oklch(0.57 0.1 252)",
    },
  },
  violet: {
    label: "Violet",
    light: {
      primary: "oklch(0.47 0.2 288)",
      primaryForeground: "oklch(0.985 0 0)",
      ring: "oklch(0.76 0.13 288)",
    },
    dark: {
      primary: "oklch(0.72 0.16 289)",
      primaryForeground: "oklch(0.17 0.03 290)",
      ring: "oklch(0.58 0.13 288)",
    },
  },
  teal: {
    label: "Teal",
    light: {
      primary: "oklch(0.46 0.13 195)",
      primaryForeground: "oklch(0.985 0 0)",
      ring: "oklch(0.72 0.08 195)",
    },
    dark: {
      primary: "oklch(0.72 0.11 195)",
      primaryForeground: "oklch(0.16 0.02 194)",
      ring: "oklch(0.58 0.08 195)",
    },
  },
  emerald: {
    label: "Emerald",
    light: {
      primary: "oklch(0.5 0.15 162)",
      primaryForeground: "oklch(0.985 0 0)",
      ring: "oklch(0.74 0.09 162)",
    },
    dark: {
      primary: "oklch(0.73 0.12 163)",
      primaryForeground: "oklch(0.16 0.02 162)",
      ring: "oklch(0.59 0.09 163)",
    },
  },
  rose: {
    label: "Rose",
    light: {
      primary: "oklch(0.47 0.17 358)",
      primaryForeground: "oklch(0.985 0 0)",
      ring: "oklch(0.72 0.11 358)",
    },
    dark: {
      primary: "oklch(0.72 0.14 359)",
      primaryForeground: "oklch(0.16 0.02 0)",
      ring: "oklch(0.58 0.11 358)",
    },
  },
  amber: {
    label: "Amber",
    light: {
      primary: "oklch(0.59 0.15 82)",
      primaryForeground: "oklch(0.19 0.03 82)",
      ring: "oklch(0.8 0.09 82)",
    },
    dark: {
      primary: "oklch(0.78 0.12 82)",
      primaryForeground: "oklch(0.18 0.03 82)",
      ring: "oklch(0.66 0.1 82)",
    },
  },
  slate: {
    label: "Slate",
    light: {
      primary: "oklch(0.28 0.035 264)",
      primaryForeground: "oklch(0.985 0 0)",
      ring: "oklch(0.55 0.025 262)",
    },
    dark: {
      primary: "oklch(0.82 0.02 262)",
      primaryForeground: "oklch(0.17 0.015 258)",
      ring: "oklch(0.62 0.02 262)",
    },
  },
};

export const DEFAULT_SETTINGS: Record<string, string> = {
  [SETTING_KEYS.WORKSPACE_NAME]: "Parishia Smart",
  [SETTING_KEYS.COMPANY_LOGO]: "",
  [SETTING_KEYS.PRIMARY_COLOR]: DEFAULT_PRIMARY_COLOR,
  [SETTING_KEYS.MULTI_TEAM]: "false",
  [SETTING_KEYS.MULTI_OWNER]: "false",
  [SETTING_KEYS.INACTIVITY_SAME_TEAM]: "30",
  [SETTING_KEYS.INACTIVITY_COMPANY]: "60",
  [SETTING_KEYS.GIFT_MONTHLY_CAP]: "true",
  [SETTING_KEYS.GIFT_REQUIRE_PREV_DELIVERABLE]: "true",
  [SETTING_KEYS.GIFT_MIN_STAGE_ID]: "",
  [SETTING_KEYS.EXPORT_ENABLED_ROLES]: "[]",
  [SETTING_KEYS.PASSWORD_MIN_LENGTH]: "8",
  [SETTING_KEYS.PASSWORD_COMPLEXITY]: "false",
};

export function normalizeHandleFromUrl(rawUrl: string): string {
  const withoutProtocol = rawUrl.trim().replace(/^https?:\/\//i, "");
  const withoutWww = withoutProtocol.replace(/^www\./i, "");
  const withoutQuery = withoutWww.split(/[?#]/)[0];
  const segments = withoutQuery.replace(/\/+$/, "").split("/").filter(Boolean);
  return (segments.at(-1) ?? segments[0] ?? withoutQuery).toLowerCase();
}

export function detectPlatformFromUrl(rawUrl: string): Platform {
  const url = rawUrl.toLowerCase();
  if (url.includes("instagram.com")) return "INSTAGRAM";
  if (url.includes("tiktok.com")) return "TIKTOK";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "YOUTUBE";
  if (url.includes("x.com") || url.includes("twitter.com")) return "X";
  if (url.includes("snapchat.com")) return "SNAPCHAT";
  if (url.includes("facebook.com") || url.includes("fb.com")) return "FACEBOOK";
  if (url.includes("linkedin.com")) return "LINKEDIN";
  if (url.includes("twitch.tv")) return "TWITCH";
  return "OTHER";
}