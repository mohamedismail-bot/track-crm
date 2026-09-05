import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-utils";

export async function GET() {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const [stages, teams, owners] = await Promise.all([
    prisma.pipelineConfig.findMany({
      where: { teamId: user.teamId },
      include: { stage: true },
      orderBy: { order: "asc" },
    }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { archivedAt: null },
      select: { id: true, displayName: true, teamId: true },
    }),
  ]);

  return NextResponse.json({
    stages: stages.map((s) => ({
      id: s.stage.id,
      name: s.stage.name,
      order: s.order,
      isCompleted: s.isCompleted,
    })),
    teams: teams.map((t) => ({ id: t.id, name: t.name })),
    owners: owners.map((o) => ({ id: o.id, displayName: o.displayName, teamId: o.teamId })),
  });
}