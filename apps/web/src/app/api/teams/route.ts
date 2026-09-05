import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/constants";

export async function GET() {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (!user.permissions.includes(PERMISSIONS.TEAM_MANAGE)) {
    return jsonError("No permission to manage teams.", 403);
  }

  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { users: true, engagements: true, creatorOwnerships: true } },
    },
  });

  return NextResponse.json({
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      userCount: t._count.users,
      engagementCount: t._count.engagements,
      creatorCount: t._count.creatorOwnerships,
      isMine: t.id === user.teamId,
    })),
  });
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "team";
}

async function uniqueSlug(base: string): Promise<string> {
  const existing = await prisma.team.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  const taken = new Set(existing.map((t) => t.slug));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

async function nameTaken(name: string): Promise<boolean> {
  const teams = await prisma.team.findMany({ select: { name: true } });
  const needle = name.toLocaleLowerCase();
  return teams.some((t) => t.name.toLocaleLowerCase() === needle);
}

export async function POST(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (!user.permissions.includes(PERMISSIONS.TEAM_MANAGE)) {
    return jsonError("No permission to manage teams.", 403);
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return jsonError("Team name is required.", 400);
  if (name.length > 40) return jsonError("Team name must be 40 characters or fewer.", 400);

  if (await nameTaken(name)) return jsonError("A team with that name already exists.", 409);

  const team = await prisma.team.create({
    data: { name, slug: await uniqueSlug(slugify(name)) },
  });

  return NextResponse.json({ team }, { status: 201 });
}