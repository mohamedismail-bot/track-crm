import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-utils";

export async function GET() {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (!user.permissions.includes("credit.view")) {
    return NextResponse.json({ error: "No permission to view credit accounts." }, { status: 403 });
  }

  const where = user.isAdmin
    ? { archivedAt: null }
    : { archivedAt: null, teamId: user.teamId };

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      displayName: true,
      email: true,
      team: { select: { name: true } },
      creditAccount: { select: { balance: true, _count: { select: { transactions: true } } } },
    },
    orderBy: { displayName: "asc" },
  });

  return NextResponse.json({
    users: users.map((u) => ({
      userId: u.id,
      name: u.displayName,
      email: u.email,
      team: u.team?.name ?? "—",
      balance: u.creditAccount?.balance ?? 0,
      transactionCount: u.creditAccount?._count.transactions ?? 0,
    })),
  });
}