import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canExportCreators,
  listCreators,
  parseCreatorListFilters,
} from "@/lib/creators";
import { isGroupByKey, type GroupByKey } from "@/lib/grouping";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import type { SessionUser } from "@/lib/auth";

function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;

  if (!(await canExportCreators(session))) {
    return jsonError("You do not have permission to export creators.", 403);
  }

  const filters = parseCreatorListFilters(req.nextUrl.searchParams);
  const items = await listCreators(session, filters);

  const details = await prisma.creator.findMany({
    where: { id: { in: items.map((i) => i.id) }, deletedAt: null },
    include: {
      countryRef: true,
      cityRef: true,
      creatorTypeRef: true,
      profiles: true,
    },
  });
  const detailById = new Map(details.map((d) => [d.id, d]));

  const header = [
    "Name",
    "Handle",
    "Email",
    "Phone",
    "Country",
    "City",
    "Creator type",
    "Gender",
    "Platforms",
    "Stage",
    "Owners",
    "Followers",
    "Engagement rate %",
    "Niche",
    "Shopify registered",
    "Created",
    "Last activity",
    "Notes",
  ];

  // Mirrors the on-screen groupValue() so the export groups match the UI.
  const groupLabelOf = (i: (typeof items)[number], key: GroupByKey): string => {
    switch (key) {
      case "stage":
        return i.stage?.name ?? "No stage";
      case "owner":
        return i.owners[0]?.name ?? "Unassigned";
      case "team":
        return i.teams[0]?.name ?? "Unassigned";
      case "country":
        return i.country ?? "Unknown country";
      case "city":
        return i.city ?? "Unknown city";
      case "creatorType":
        return i.creatorType ?? "No type";
      case "gender":
        return i.gender ?? "Unspecified";
      case "shopify":
        return i.shopifyRegistered ? "Shopify registered" : "Not registered";
      default:
        return "";
    }
  };

  const groupParam = req.nextUrl.searchParams.get("group");
  const groupKey = isGroupByKey(groupParam) ? (groupParam as GroupByKey) : "none";

  const contentRows: string[] = [];
  let lastGroup: string | null = null;

  for (const i of items) {
    if (groupKey !== "none") {
      const label = groupLabelOf(i, groupKey);
      if (label !== lastGroup) {
        contentRows.push(`"═══ ${label} ═══"`);
        lastGroup = label;
      }
    }

    const d = detailById.get(i.id);
    const profiles = (d?.profiles ?? []).map(
      (p) => `${p.platform} @${p.handle} (${p.url})`,
    );
    const owners = i.owners.map((o) => `${o.name} (${o.teamName})`);

    contentRows.push(
      [
        i.name,
        i.handle,
        d?.email ?? "",
        d?.phone ?? "",
        i.country,
        i.city,
        i.creatorType,
        i.gender,
        profiles.join(" | "),
        i.stage?.name ?? "",
        owners.join(", "),
        i.followers,
        i.engagementRate,
        i.niche.join("; "),
        i.shopifyRegistered == null ? "" : i.shopifyRegistered ? "Yes" : "No",
        i.createdAt ? new Date(i.createdAt).toISOString() : "",
        i.lastActivityAt ? new Date(i.lastActivityAt).toISOString() : "",
        d?.notes ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }

  const csv = [header.map(csvCell).join(","), ...contentRows].join("\r\n");
  const padded = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="creators-${padded}.csv"`,
    },
  });
}
