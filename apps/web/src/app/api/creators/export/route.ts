import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canExportCreators,
  listCreators,
  parseCreatorListFilters,
} from "@/lib/creators";
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

  const rows = items.map((i) => {
    const d = detailById.get(i.id);
    const profiles = (d?.profiles ?? []).map(
      (p) => `${p.platform} @${p.handle} (${p.url})`,
    );
    const owners = i.owners.map((o) => `${o.name} (${o.teamName})`);
    return [
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
    ];
  });

  const csv = [header, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
  const padded = `${new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/[-:T]/g, "")}`;

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="creators-${padded}.csv"`,
    },
  });
}