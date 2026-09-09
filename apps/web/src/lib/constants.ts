import { Platform, DealType, Currency, DeliverableStatus, ActivityType, GiftApprovalRole } from "@prisma/client";

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
  CREDIT_VIEW: "credit.view",
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
    PERMISSIONS.CREDIT_VIEW,
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

// ---------------------------------------------------------------------------
// Gift statuses (admin-managed rows; these keys are the seeded day-one set)
// ---------------------------------------------------------------------------
export const GIFT_STATUS_KEYS = {
  DRAFT: "draft",
  PENDING_MANAGER: "pending_manager",
  APPROVED: "approved",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  REJECTED: "rejected",
} as const;

export type GiftStatusKey = (typeof GIFT_STATUS_KEYS)[keyof typeof GIFT_STATUS_KEYS];

/** Seeded gift statuses, cloned when the status table is empty (see ensureGiftStatuses). */
export const DEFAULT_GIFT_STATUSES: {
  key: string;
  label: string;
  position: number;
  approvalRole: GiftApprovalRole;
  isDraft: boolean;
  isRejection: boolean;
  grantCredit: boolean;
  spawnDeliverables: boolean;
  warehouseStep: boolean;
}[] = [
  {
    key: GIFT_STATUS_KEYS.DRAFT,
    label: "Draft",
    position: 0,
    approvalRole: GiftApprovalRole.NONE,
    isDraft: true,
    isRejection: false,
    grantCredit: false,
    spawnDeliverables: false,
    warehouseStep: false,
  },
  {
    key: GIFT_STATUS_KEYS.PENDING_MANAGER,
    label: "Pending Manager",
    position: 1,
    approvalRole: GiftApprovalRole.MANAGER,
    isDraft: false,
    isRejection: false,
    grantCredit: false,
    spawnDeliverables: false,
    warehouseStep: false,
  },
  {
    key: GIFT_STATUS_KEYS.APPROVED,
    label: "Approved",
    position: 2,
    approvalRole: GiftApprovalRole.NONE,
    isDraft: false,
    isRejection: false,
    grantCredit: false,
    spawnDeliverables: true,
    warehouseStep: true,
  },
  {
    key: GIFT_STATUS_KEYS.SHIPPED,
    label: "Shipped",
    position: 3,
    approvalRole: GiftApprovalRole.NONE,
    isDraft: false,
    isRejection: false,
    grantCredit: false,
    spawnDeliverables: false,
    warehouseStep: true,
  },
  {
    key: GIFT_STATUS_KEYS.DELIVERED,
    label: "Delivered",
    position: 4,
    approvalRole: GiftApprovalRole.NONE,
    isDraft: false,
    isRejection: false,
    grantCredit: true,
    spawnDeliverables: false,
    warehouseStep: false,
  },
  {
    key: GIFT_STATUS_KEYS.REJECTED,
    label: "Rejected",
    position: 5,
    approvalRole: GiftApprovalRole.NONE,
    isDraft: false,
    isRejection: true,
    grantCredit: false,
    spawnDeliverables: false,
    warehouseStep: false,
  },
];

export const GIFT_STATUS_LABELS: Record<string, string> = {
  [GIFT_STATUS_KEYS.DRAFT]: "Draft",
  [GIFT_STATUS_KEYS.PENDING_MANAGER]: "Pending Manager",
  [GIFT_STATUS_KEYS.APPROVED]: "Approved",
  [GIFT_STATUS_KEYS.SHIPPED]: "Shipped",
  [GIFT_STATUS_KEYS.DELIVERED]: "Delivered",
  [GIFT_STATUS_KEYS.REJECTED]: "Rejected",
};

export function giftStatusLabel(key: string): string {
  return GIFT_STATUS_LABELS[key] ?? key;
}

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
  GIFT_CREDIT_POSTED: "Credit posted",
  GIFT_DEBIT_POSTED: "Debit posted",
  DELIVERABLE_SUBMITTED: "Deliverable submitted",
  DELIVERABLE_APPROVED: "Deliverable approved",
  DELIVERABLE_REVISION_REQUESTED: "Deliverable revision requested",
  ENGAGEMENT_CREATED: "Engagement created",
  ENGAGEMENT_COMPLETED: "Engagement completed",
  CREATOR_CREATED: "Creator created",
  CREATOR_UPDATED: "Creator updated",
  CREATOR_APPROVED: "Creator approved",
  CREATOR_REJECTED: "Creator rejected",
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
  CREDIT_ENABLED: "credit.enabled",
  DELIVERABLE_APPROVAL_REQUIRED: "deliverable.approvalRequired",
  SHOPIFY_MIN_STAGE_ID: "shopify.minStageId",
  EXPORT_ENABLED_ROLES: "export.enabledRoles",
  EXPORT_ENABLED_USER_IDS: "export.enabledUserIds",
  BULK_EDIT_ENABLED_ROLES: "bulkEdit.enabledRoles",
  BULK_EDIT_ENABLED_USER_IDS: "bulkEdit.enabledUserIds",
  PASSWORD_MIN_LENGTH: "password.minLength",
  PASSWORD_COMPLEXITY: "password.complexity",
  GENDER_OPTIONS: "creator.genderOptions",
  NICHE_OPTIONS: "creator.nicheOptions",
  CUSTOM_FIELDS_ENABLED: "creator.customFieldsEnabled",
  APPROVAL_REQUIRED: "approval.requireCreatorApproval",
  UNASSIGNED_VISIBLE_FIELDS: "visibility.unassignedVisibleFields",
  CREATOR_EDIT_ALLOWED_FIELDS: "creator.editAllowedFields",
} as const;

/**
 * Creator fields the Admin can selectively allow non-admin users to edit
 * (Workspace Settings -> Creator editing permissions). Admins always edit all.
 */
export const CREATOR_EDITABLE_FIELDS: { key: string; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "country", label: "Country" },
  { key: "city", label: "City" },
  { key: "creatorType", label: "Creator type" },
  { key: "gender", label: "Gender" },
  { key: "shopify", label: "Shopify registered" },
  { key: "niche", label: "Niche" },
  { key: "followers", label: "Followers" },
  { key: "engagementRate", label: "Engagement rate" },
  { key: "notes", label: "Notes" },
  { key: "customFields", label: "Custom fields" },
  { key: "profiles", label: "Platform profiles" },
];

export const ALL_CREATOR_EDITABLE_FIELDS = CREATOR_EDITABLE_FIELDS.map((f) => f.key);

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
  [SETTING_KEYS.CREDIT_ENABLED]: "true",
  [SETTING_KEYS.DELIVERABLE_APPROVAL_REQUIRED]: "true",
  [SETTING_KEYS.SHOPIFY_MIN_STAGE_ID]: "",
  [SETTING_KEYS.EXPORT_ENABLED_ROLES]: "[]",
  [SETTING_KEYS.EXPORT_ENABLED_USER_IDS]: "[]",
  [SETTING_KEYS.BULK_EDIT_ENABLED_ROLES]: "[]",
  [SETTING_KEYS.BULK_EDIT_ENABLED_USER_IDS]: "[]",
  [SETTING_KEYS.PASSWORD_MIN_LENGTH]: "8",
  [SETTING_KEYS.PASSWORD_COMPLEXITY]: "false",
  [SETTING_KEYS.GENDER_OPTIONS]: '["Male","Female","Other","Prefer not to say"]',
  [SETTING_KEYS.NICHE_OPTIONS]:
    '["Fashion","Beauty","Tech","Gaming","Food","Travel","Fitness","Family","Lifestyle","Automotive","Business","Sports","Other"]',
  [SETTING_KEYS.CUSTOM_FIELDS_ENABLED]: "true",
  [SETTING_KEYS.APPROVAL_REQUIRED]: "false",
  [SETTING_KEYS.UNASSIGNED_VISIBLE_FIELDS]: '["platformLink","creatorName"]',
  [SETTING_KEYS.CREATOR_EDIT_ALLOWED_FIELDS]: JSON.stringify(ALL_CREATOR_EDITABLE_FIELDS),
};

// ---------------------------------------------------------------------------
// Creator fields (built-in + custom)
// ---------------------------------------------------------------------------

export const DEFAULT_GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"];

export const DEFAULT_NICHE_OPTIONS = [
  "Fashion",
  "Beauty",
  "Tech",
  "Gaming",
  "Food",
  "Travel",
  "Fitness",
  "Family",
  "Lifestyle",
  "Automotive",
  "Business",
  "Sports",
  "Other",
];

/** Custom-field types an Admin can pick from; built-in fields use semantic types. */
export const CREATOR_FIELD_TYPES = {
  TEXT: "text",
  TEXTAREA: "textarea",
  NUMBER: "number",
  DATE: "date",
  SELECT: "select",
  BOOLEAN: "boolean",
} as const;

export const CUSTOM_FIELD_TYPES = [
  CREATOR_FIELD_TYPES.TEXT,
  CREATOR_FIELD_TYPES.TEXTAREA,
  CREATOR_FIELD_TYPES.NUMBER,
  CREATOR_FIELD_TYPES.DATE,
  CREATOR_FIELD_TYPES.SELECT,
  CREATOR_FIELD_TYPES.BOOLEAN,
] as const;

export const CREATOR_FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Short text",
  textarea: "Long text",
  number: "Number",
  date: "Date",
  select: "Single select",
  boolean: "Yes / No",
  email: "Email",
  phone: "Phone",
  country: "Country",
  city: "City",
  creatorType: "Creator Type",
  gender: "Gender",
};

/**
 * Built-in creator fields. Each maps to a first-class column; `required` is
 * toggled by the Admin in Settings (Name and Platform Profiles are always
 * required and are not listed here).
 */
export const SYSTEM_FIELD_DEFINITIONS: {
  key: string;
  label: string;
  type: string;
  required: boolean;
  order: number;
}[] = [
  { key: "email", label: "Email", type: "email", required: false, order: 1 },
  { key: "phone", label: "Phone", type: "phone", required: false, order: 2 },
  { key: "gender", label: "Gender", type: "gender", required: true, order: 3 },
  { key: "country", label: "Country", type: "country", required: false, order: 4 },
  { key: "city", label: "City", type: "city", required: false, order: 5 },
  { key: "creatorType", label: "Creator Type", type: "creatorType", required: false, order: 6 },
  { key: "niche", label: "Niche", type: "text", required: false, order: 7 },
  { key: "followers", label: "Followers", type: "number", required: false, order: 8 },
  { key: "engagementRate", label: "Engagement rate (%)", type: "number", required: false, order: 9 },
  { key: "shopifyRegistered", label: "Registered on Shopify", type: "boolean", required: false, order: 10 },
  { key: "notes", label: "Notes", type: "textarea", required: false, order: 11 },
];

/**
 * Fields that must be populated before a Gift may be requested for a Creator
 * (the "Required for Gifting" set). Fixed — not admin-configurable.
 */
export const REQUIRED_FOR_GIFTING_FIELD_KEYS = ["country", "city", "creatorType", "phone"] as const;

export const REQUIRED_FOR_GIFTING_LABELS: Record<string, string> = {
  country: "Country",
  city: "City",
  creatorType: "Creator Type",
  phone: "Phone",
};

export function requiredForGiftingMissing(c: {
  countryId: string | null;
  cityId: string | null;
  creatorTypeId: string | null;
  phone: string | null;
}): string[] {
  const missing: string[] = [];
  if (!c.countryId) missing.push("country");
  if (!c.cityId) missing.push("city");
  if (!c.creatorTypeId) missing.push("creatorType");
  if (!c.phone) missing.push("phone");
  return missing;
}

// ---------------------------------------------------------------------------
// Platform + profile input helpers
// ---------------------------------------------------------------------------

export const PLATFORM_HANDLE_BASE: Record<string, string> = {
  INSTAGRAM: "instagram.com",
  TIKTOK: "tiktok.com",
  YOUTUBE: "youtube.com",
  X: "x.com",
  SNAPCHAT: "snapchat.com",
  FACEBOOK: "facebook.com",
  LINKEDIN: "linkedin.com",
  TWITCH: "twitch.tv",
};

/** Build the canonical profile URL for a platform + bare handle. */
export function canonicalProfileUrl(platform: string, handle: string): string {
  const base = PLATFORM_HANDLE_BASE[platform];
  if (!base) return handle;
  if (platform === "TIKTOK" || platform === "SNAPCHAT" || platform === "YOUTUBE") {
    return `https://${base}/@${handle}`;
  }
  if (platform === "LINKEDIN") return `https://${base}/in/${handle}`;
  return `https://${base}/${handle}`;
}

/**
 * The href to use for a creator's platform profile: the stored link when it is
 * a real URL, otherwise the canonical URL built from the platform + handle so
 * an icon/link never navigates to an internal route.
 */
export function profileHref(
  platform: Platform | string,
  url?: string | null,
  handle?: string | null,
): string {
  if (url && /^https?:\/\//i.test(url.trim())) return url.trim();
  if (handle) return canonicalProfileUrl(platform, handle);
  return url || "#";
}

export function normalizeHandleFromUrl(rawUrl: string): string {
  const withoutProtocol = rawUrl.trim().replace(/^https?:\/\//i, "");
  const withoutWww = withoutProtocol.replace(/^www\./i, "");
  const withoutQuery = withoutWww.split(/[?#]/)[0];
  const segments = withoutQuery.replace(/\/+$/, "").split("/").filter(Boolean);
  const last = segments.at(-1) ?? segments[0] ?? withoutQuery;
  return last.replace(/^@+/, "").toLowerCase();
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

/** True when the entry looks like a real social link rather than a bare handle. */
export function looksLikeUrl(input: string): boolean {
  return /[./]/.test(input);
}

/**
 * Extract the canonical Platform Handle from tolerant user input: a bare
 * handle, an `@`-prefixed handle, or a full link (`https://www.instagram.com/mohamedismail`).
 * Returns null when the input is invalid (bare handle containing spaces or slashes).
 */
export function handleFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!looksLikeUrl(trimmed)) {
    const cleaned = trimmed.replace(/^@+/, "").trim();
    if (/[\s/]/.test(cleaned)) return null;
    return cleaned.toLowerCase();
  }
  return normalizeHandleFromUrl(trimmed);
}

/** Detect a conflicting platform when a link was pasted; null when not detectable. */
export function urlPlatformMismatch(input: string, selected: Platform): Platform | null {
  if (!looksLikeUrl(input)) return null;
  const detected = detectPlatformFromUrl(input);
  if (detected === "OTHER" || detected === selected) return null;
  return detected;
}

/**
 * Strict platform-profile entry check: platform profiles must be a full link
 * (e.g. `https://www.instagram.com/handle` or `www.instagram.com/handle`).
 * The handle itself is derived from the last path segment of the link.
 * Returns a user-facing error message, or null when OK.
 */
export function strictProfileEntryError(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return "Every platform profile needs a link.";
  if (/[\s]/.test(trimmed)) return "Paste the full profile link without spaces.";
  if (looksLikeUrl(trimmed)) return null;
  return "Paste the full profile link (e.g. https://www.instagram.com/handle).";
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Strip non-digit characters from a phone input. */
export function digitsOnly(value: string): string {
  return value.replace(/[^\d]/g, "");
}

/** Build an E.164 phone (`+201001234567`) from a dial code and local digits. */
export function buildE164(dialCode: string, localDigits: string): string {
  let d = digitsOnly(localDigits);
  if (d.startsWith("0")) d = d.slice(1);
  return `+${dialCode.replace(/^\+/, "")}${d}`;
}

export function isValidE164(phone: string): boolean {
  return /^\+\d{8,15}$/.test(phone);
}