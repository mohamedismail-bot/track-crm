import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import type { SessionUser } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;

  if (!session.permissions.includes("transactionLog.view")) {
    return jsonError("No permission to view transaction logs.", 403);
  }

  const params = req.nextUrl.searchParams;
  const userId = params.get("userId") ?? "";
  const action = params.get("action") ?? "";
  const from = params.get("from");
  const to = params.get("to");

  const where: Prisma.TransactionLogWhereInput = {
    ...(userId ? { userId } : {}),
    ...(action ? { action } : {}),
    ...(from || to
      ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
      : {}),
  };

  if (session.roleSlug !== "admin") {
    const teamUserIds = await prisma.user.findMany({
      where: { teamId: session.teamId },
      select: { id: true },
    });
    where.userId = userId ? { in: teamUserIds.map((u) => u.id), equals: userId } : { in: teamUserIds.map((u) => u.id) };
  }

  const logs = await prisma.transactionLog.findMany({
    where,
    include: { user: { select: { id: true, displayName: true, teamId: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return NextResponse.json(logs);
}