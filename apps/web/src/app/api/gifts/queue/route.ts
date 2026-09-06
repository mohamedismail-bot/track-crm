import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-utils";
import type { SessionUser } from "@/lib/auth";
import { GiftStatus, type Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;

  const params = req.nextUrl.searchParams;
  const status = params.get("status") ?? "";
  const team = params.get("team") ?? "";
  const exception = params.get("exception");
  const pendingOnly = params.get("scope") === "manager";

  // Warehouse/fullfillment users see gifts across all teams; everyone else is
  // scoped to their own team unless they explicitly filter by team.
  const isWarehouse = session.permissions.includes("gift.fulfill");
  const scopeToOwnTeam = !isWarehouse && session.roleSlug !== "admin" && !team;

  const where: Prisma.GiftWhereInput = {
    ...(status ? { status: status as GiftStatus } : {}),
    ...(exception === "1" ? { isException: true } : {}),
    ...(team ? { engagement: { teamId: team } } : {}),
    ...(scopeToOwnTeam ? { engagement: { teamId: session.teamId } } : {}),
    ...(pendingOnly ? { status: { in: [GiftStatus.REQUESTED] } } : {}),
  };

  const gifts = await prisma.gift.findMany({
    where,
    include: {
      engagement: { include: { creator: true, team: true, deliverables: true } },
      requestedBy: true,
      approvedBy: true,
    },
    orderBy: { requestedAt: "desc" },
    take: 200,
  });

  return NextResponse.json(
    gifts.map((g) => ({
      id: g.id,
      productName: g.productName,
      productDescription: g.productDescription,
      status: g.status,
      isException: g.isException,
      exceptionReason: g.exceptionReason,
      trackingNumber: g.trackingNumber,
      carrier: g.carrier,
      requestedAt: g.requestedAt,
      dispatchedAt: g.dispatchedAt,
      deliveredAt: g.deliveredAt,
      creatorId: g.engagement.creatorId,
      creatorName: g.engagement.creator.name,
      engagementId: g.engagementId,
      engagementTitle: g.engagement.title,
      teamName: g.engagement.team.name,
      requestedByName: g.requestedBy.displayName,
      requestedByRole: g.requestedBy.roleId,
      deliverables: g.engagement.deliverables,
    })),
  );
}