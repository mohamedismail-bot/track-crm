import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-utils";
import type { SessionUser } from "@/lib/auth";
import { addDays, startOfMonth, endOfMonth, subDays } from "date-fns";
import { DeliverableStatus, GiftStatus } from "@prisma/client";

export async function GET() {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;

  const isWarehouse = session.roleSlug === "warehouse";
  const isAdmin = session.roleSlug === "admin";
  const teamWhere = isAdmin ? {} : { teamId: session.teamId };
  // Warehouse (and admin) see gift data across all teams; everyone else is
  // scoped to their own team.
  const giftTeamWhere = isWarehouse || isAdmin ? {} : { teamId: session.teamId };

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [
    totalCreators,
    myCreators,
    overdueDeliverables,
    upcomingDeliverables,
    recentEngagements,
    giftsRequestedThisMonth,
    giftsPendingApproval,
    giftsPendingExceptions,
    giftsQueued,
    giftsDispatchedThisMonth,
    giftsDeliveredThisMonth,
    pipelineCounts,
    ownedByMe,
  ] = await Promise.all([
    prisma.creator.count({
      where: { deletedAt: null, ...(isAdmin ? {} : { ownerships: { some: { teamId: session.teamId } } }) },
    }),
    prisma.creatorOwnership.count({ where: { userId: session.id } }),
    prisma.deliverable.findMany({
      where: {
        status: { not: DeliverableStatus.APPROVED },
        dueDate: { lt: now },
        engagement: teamWhere,
      },
      include: { engagement: { include: { creator: true } } },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
    prisma.deliverable.findMany({
      where: {
        status: { not: DeliverableStatus.APPROVED },
        dueDate: { gte: now, lt: addDays(now, 7) },
        engagement: teamWhere,
      },
      include: { engagement: { include: { creator: true } } },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
    prisma.engagement.findMany({
      where: teamWhere,
      include: { creator: true, stage: true, team: true },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    prisma.gift.count({
      where: {
        engagement: giftTeamWhere,
        requestedAt: { gte: monthStart, lte: monthEnd },
        status: { not: GiftStatus.REJECTED },
      },
    }),
    prisma.gift.count({
      where: { status: GiftStatus.REQUESTED, engagement: giftTeamWhere },
    }),
    prisma.gift.count({
      where: { status: GiftStatus.REQUESTED, isException: true, engagement: giftTeamWhere },
    }),
    prisma.gift.count({
      where: { status: GiftStatus.APPROVED_QUEUED, engagement: giftTeamWhere },
    }),
    prisma.gift.count({
      where: {
        status: GiftStatus.DISPATCHED,
        dispatchedAt: { gte: monthStart, lte: monthEnd },
        engagement: giftTeamWhere,
      },
    }),
    prisma.gift.count({
      where: {
        status: GiftStatus.DELIVERED,
        deliveredAt: { gte: monthStart, lte: monthEnd },
        engagement: giftTeamWhere,
      },
    }),
    prisma.engagement.groupBy({
      by: ["stageId"],
      where: teamWhere,
      _count: { _all: true },
    }),
    prisma.creatorOwnership.findMany({
      where: { userId: session.id },
      include: { creator: { include: { primaryProfile: true } } },
      take: 100,
    }),
  ]);

  const stageDetails = await prisma.stage.findMany();
  const pipeline = pipelineCounts.map((c) => ({
    stageId: c.stageId,
    name: stageDetails.find((s) => s.id === c.stageId)?.name ?? "Unknown",
    count: c._count._all,
  }));

  const [maps, recentGifts] = await Promise.all([
    prisma.creatorOwnership.groupBy({
      by: ["userId"],
      where: teamWhere,
      _count: { _all: true },
    }),
    prisma.gift.findMany({
      where: {
        engagement: giftTeamWhere,
        requestedAt: { gte: subDays(now, 90) },
      },
      include: { engagement: { include: { creator: true, team: true } } },
      orderBy: { requestedAt: "desc" },
      take: 100,
    }),
  ]);

  const userSummaries = await prisma.user.findMany({
    where: { id: { in: maps.map((m) => m.userId) } },
    select: { id: true, displayName: true },
  });
  const leaderboard = maps
    .map((m) => ({
      userId: m.userId,
      name: userSummaries.find((u) => u.id === m.userId)?.displayName ?? "Unknown",
      creators: m._count._all,
    }))
    .sort((a, b) => b.creators - a.creators);

  const myCreatorsDetail = ownedByMe.map((o) => ({
    id: o.creator.id,
    name: o.creator.name,
    handle: o.creator.primaryProfile?.handle ?? null,
  }));

  // Top gifted creators (last 90 days), with exception requests flagged.
  const giftedCounts = new Map<string, { creatorId: string; name: string; count: number }>();
  for (const g of recentGifts) {
    const cid = g.engagement.creatorId;
    const cur = giftedCounts.get(cid);
    if (cur) {
      cur.count += 1;
    } else {
      giftedCounts.set(cid, {
        creatorId: cid,
        name: g.engagement.creator.name,
        count: 1,
      });
    }
  }
  const topGiftedCreators = [...giftedCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return NextResponse.json({
    role: {
      roleSlug: session.roleSlug,
      isWarehouse,
      canApprove: session.permissions.includes("gift.approve"),
      canFulfill: session.permissions.includes("gift.fulfill"),
    },
    totalCreators,
    myCreators,
    overdueDeliverables: overdueDeliverables.map((d) => ({
      id: d.id,
      title: d.title,
      dueDate: d.dueDate,
      creatorId: d.engagement.creatorId,
      creatorName: d.engagement.creator.name,
    })),
    upcomingDeliverables: upcomingDeliverables.map((d) => ({
      id: d.id,
      title: d.title,
      dueDate: d.dueDate,
      creatorId: d.engagement.creatorId,
      creatorName: d.engagement.creator.name,
    })),
    recentEngagements: recentEngagements.map((e) => ({
      id: e.id,
      title: e.title,
      creatorId: e.creatorId,
      creatorName: e.creator.name,
      stageName: e.stage.name,
      teamName: e.team.name,
      updatedAt: e.updatedAt,
    })),
    gifts: {
      requestedThisMonth: giftsRequestedThisMonth,
      pendingApproval: giftsPendingApproval,
      pendingExceptions: giftsPendingExceptions,
      queuedForDispatch: giftsQueued,
      dispatchedThisMonth: giftsDispatchedThisMonth,
      deliveredThisMonth: giftsDeliveredThisMonth,
      topGiftedCreators,
      recent: recentGifts.map((g) => ({
        id: g.id,
        productName: g.productName,
        status: g.status,
        isException: g.isException,
        requestedAt: g.requestedAt,
        creatorId: g.engagement.creatorId,
        creatorName: g.engagement.creator.name,
        teamName: g.engagement.team.name,
      })),
    },
    pipeline,
    leaderboard,
    myCreatorsDetail,
  });
}