import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-utils";
import type { SessionUser } from "@/lib/auth";
import { GiftApprovalRole, type Prisma } from "@prisma/client";

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
    ...(status ? { status: { is: { key: status } } } : {}),
    ...(exception === "1" ? { isException: true } : {}),
    ...(team ? { engagement: { teamId: team } } : {}),
    ...(scopeToOwnTeam ? { engagement: { teamId: session.teamId } } : {}),
    // "Pending approval" = any status that currently requires a manager action.
    ...(pendingOnly ? { status: { is: { approvalRole: GiftApprovalRole.MANAGER } } } : {}),
  };

  const gifts = await prisma.gift.findMany({
    where,
    include: {
      status: true,
      lines: { orderBy: { id: "asc" } },
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
      orderNumber: g.orderNumber,
      productName: g.lines[0]?.productName ?? `${g.engagement.creator.name} gift`,
      productDescription: g.lines[0]?.productDescription,
      lines: g.lines,
      orderTotal: g.orderTotal,
      status: g.status.key,
      statusKey: g.status.key,
      statusLabel: g.status.label,
      group: g.status.isDraft
        ? "draft"
        : g.status.approvalRole !== GiftApprovalRole.NONE
          ? "pending"
          : g.status.warehouseStep
            ? "warehouse"
            : "history",
      isException: g.isException,
      exceptionReason: g.exceptionReason,
      shippingAddress: g.shippingAddress,
      trackingNumber: g.trackingNumber,
      carrier: g.carrier,
      currency: g.currency,
      agreedBudget: g.agreedBudget,
      commissionRate: g.commissionRate,
      couponCode: g.couponCode,
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