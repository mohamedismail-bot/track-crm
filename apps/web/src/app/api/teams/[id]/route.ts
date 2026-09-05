import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/constants";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "team";
}

async function uniqueSlug(base: string, excludeId: string): Promise<string> {
  const existing = await prisma.team.findMany({
    where: { slug: { startsWith: base }, id: { not: excludeId } },
    select: { slug: true },
  });
  const taken = new Set(existing.map((t) => t.slug));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

async function nameTaken(name: string, excludeId: string): Promise<boolean> {
  const teams = await prisma.team.findMany({
    select: { id: true, name: true },
  });
  const needle = name.toLocaleLowerCase();
  return teams.some((t) => t.id !== excludeId && t.name.toLocaleLowerCase() === needle);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (!user.permissions.includes(PERMISSIONS.TEAM_MANAGE)) {
    return jsonError("No permission to manage teams.", 403);
  }

  const { id } = await params;
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) return jsonError("Team not found.", 404);

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return jsonError("Team name is required.", 400);
  if (name.length > 40) return jsonError("Team name must be 40 characters or fewer.", 400);

  if (await nameTaken(name, id)) return jsonError("A team with that name already exists.", 409);

  const updated = await prisma.team.update({
    where: { id },
    data: {
      name,
      ...(name.toLowerCase() !== team.name.toLowerCase()
        ? { slug: await uniqueSlug(slugify(name), id) }
        : {}),
    },
  });

  return NextResponse.json({ team: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (!user.permissions.includes(PERMISSIONS.TEAM_MANAGE)) {
    return jsonError("No permission to manage teams.", 403);
  }

  const { id } = await params;
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      users: { take: 1, select: { id: true } },
      engagements: { take: 1, select: { id: true } },
      pipelineConfigs: { take: 1, select: { id: true } },
      creatorOwnerships: { take: 1, select: { id: true } },
      requestedRequests: { take: 1, select: { id: true } },
      owningRequests: { take: 1, select: { id: true } },
    },
  });
  if (!team) return jsonError("Team not found.", 404);

  if (team.id === user.teamId) {
    return jsonError("You cannot delete your own team.", 400);
  }

  const blockers: string[] = [];
  if (team.users.length > 0) blockers.push("members");
  if (team.engagements.length > 0) blockers.push("engagements");
  if (team.pipelineConfigs.length > 0) blockers.push("pipeline configuration");
  if (team.creatorOwnerships.length > 0) blockers.push("assigned creators");
  if (team.requestedRequests.length > 0 || team.owningRequests.length > 0)
    blockers.push("availability requests");
  if (blockers.length > 0) {
    return jsonError(
      `Cannot delete this team: it still has ${blockers.join(", ")}. Reassign or remove them first.`,
      409,
    );
  }

  await prisma.team.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}