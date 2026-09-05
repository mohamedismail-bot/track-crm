import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-utils";
import type { SessionUser } from "@/lib/auth";
import { addDays, startOfMonth, endOfMonth } from "date-fns";
import { DeliverableStatus, GiftStatus } from "@prisma/client";

export async function GET() {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;

  const teamWhere = session.roleSlug === "admin" ? {} : { teamId: session.teamId };
  const now = new Date();

  const [
    totalCreators,
    myCreators,
    overdueDeliverables,
    upcomingDeliverables,
    recentEngagements,
    giftsThisMonth,
    exceptionsPending,
    pipelineCounts,
    ownedByMe,
  ] = await Promise.all([
    prisma.creator.count({ where: { deletedAt: null } }),
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
        engagement: teamWhere,
        requestedAt: { gte: startOfMonth(now), lte: endOfMonth(now) },
        status: { not: GiftStatus.REJECTED },
      },
    }),
    prisma.gift.count({
      where: { status: GiftStatus.REQUESTED, engagement: teamWhere },
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

  const maps = await prisma.creatorOwnership.groupBy({
    by: ["userId"],
    where: teamWhere,
    _count: { _all: true },
  });
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
    avatarUrl: o.creator.avatarUrl,
  }));

  return NextResponse.json({
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
    giftsThisMonth,
    exceptionsPending,
    pipeline,
    leaderboard,
    myCreatorsDetail,
  });
}