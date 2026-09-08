import type { CreatorListItem } from "@/components/creators/creator-card";

export type GroupByKey =
  | "none"
  | "stage"
  | "owner"
  | "team"
  | "country"
  | "city"
  | "creatorType"
  | "gender"
  | "shopify";

export const GROUP_BY_OPTIONS: { value: GroupByKey; label: string }[] = [
  { value: "none", label: "No grouping" },
  { value: "stage", label: "Group by stage" },
  { value: "owner", label: "Group by owner" },
  { value: "team", label: "Group by team" },
  { value: "country", label: "Group by country" },
  { value: "city", label: "Group by city" },
  { value: "creatorType", label: "Group by creator type" },
  { value: "gender", label: "Group by gender" },
  { value: "shopify", label: "Group by Shopify" },
];

const GROUP_KEY_SET = new Set<string>(GROUP_BY_OPTIONS.map((o) => o.value));
export function isGroupByKey(v: unknown): v is GroupByKey {
  return typeof v === "string" && GROUP_KEY_SET.has(v);
}

export function groupValue(c: CreatorListItem, key: GroupByKey): string {
  switch (key) {
    case "stage":
      return c.stage?.name ?? "No stage";
    case "owner":
      return c.owners[0]?.name ?? "Unassigned";
    case "team":
      return c.teams[0]?.name ?? "Unassigned";
    case "country":
      return c.country ?? "Unknown country";
    case "city":
      return c.city ?? "Unknown city";
    case "creatorType":
      return c.creatorType ?? "No type";
    case "gender":
      return c.gender ?? "Unspecified";
    case "shopify":
      return c.shopifyRegistered ? "Shopify registered" : "Not registered";
    default:
      return "";
  }
}

export function groupCreators(
  items: CreatorListItem[],
  key: GroupByKey,
): { label: string; items: CreatorListItem[] }[] {
  const groups = new Map<string, CreatorListItem[]>();
  const order: string[] = [];
  for (const c of items) {
    const label = key === "none" ? "" : groupValue(c, key);
    if (!groups.has(label)) {
      groups.set(label, []);
      order.push(label);
    }
    groups.get(label)!.push(c);
  }
  return order.map((label) => ({ label, items: groups.get(label) ?? [] }));
}