import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { validatePassword } from "@/lib/settings";
import { jsonError, requireApiUser } from "@/lib/api-utils";

export async function GET() {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (!user.permissions.includes("user.manage")) {
    return jsonError("No permission to manage users.", 403);
  }
  const [users, teams, roles] = await Promise.all([
    prisma.user.findMany({
      include: { role: true, team: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.role.findMany({
      include: { permissions: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      phone: u.phone,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      roleSlug: u.role.slug,
      roleName: u.role.name,
      teamId: u.teamId,
      teamName: u.team.name,
      archivedAt: u.archivedAt,
      createdAt: u.createdAt,
    })),
    teams: teams.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
    roles: roles.map((r) => ({ id: r.id, name: r.name, slug: r.slug, immutable: r.immutable })),
  });
}

export async function POST(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (!user.permissions.includes("user.manage")) {
    return jsonError("No permission to manage users.", 403);
  }

  const body = await req.json();
  const { displayName, email, phone, roleSlug, teamId, password } = body;
  if (!displayName?.trim()) return jsonError("Display name is required.", 400);
  if (!roleSlug || !teamId) return jsonError("Role and team are required.", 400);
  if (!password) return jsonError("Password is required.", 400);
  const policyError = await validatePassword(String(password));
  if (policyError) return jsonError(policyError, 400);

  const role = await prisma.role.findUnique({ where: { slug: roleSlug } });
  if (!role) return jsonError("Invalid role.", 400);

  const already = await prisma.user.findFirst({
    where: { OR: [{ email: email || undefined }, { phone: phone || undefined }] },
  });
  if (already) return jsonError("A user with this email or phone already exists.", 409);

  const created = await prisma.user.create({
    data: {
      displayName: displayName.trim(),
      email: email || null,
      phone: phone || null,
      roleId: role.id,
      teamId,
      passwordHash: await hashPassword(String(password)),
    },
  });
  return NextResponse.json({ id: created.id }, { status: 201 });
}