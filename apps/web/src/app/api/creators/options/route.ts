import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-utils";

export async function GET() {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  // Stages come from the global Stage list (same set shown in Workspace
  // Settings), so the board, the stage filter and the create-form all match
  // what the Admin maintains — independent of any per-team pipeline config.
  const [stages, teams, owners] = await Promise.all([
    prisma.stage.findMany({ orderBy: { order: "asc" } }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { archivedAt: null },
      select: { id: true, displayName: true, teamId: true, role: { select: { slug: true } } },
    }),
  ]);

  return NextResponse.json({
    stages: stages.map((s) => ({
      id: s.id,
      name: s.name,
      order: s.order,
      isCompleted: s.isCompleted,
    })),
    teams: teams.map((t) => ({ id: t.id, name: t.name })),
    owners: owners.map((o) => ({
      id: o.id,
      displayName: o.displayName,
      teamId: o.teamId,
      roleSlug: o.role.slug,
    })),
  });
}