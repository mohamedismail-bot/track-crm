import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import type { Prisma } from "@prisma/client";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (!user.permissions.includes("user.manage")) {
    return jsonError("No permission to manage users.", 403);
  }

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return jsonError("User not found.", 404);

  const body = await req.json();
  const data: Prisma.UserUncheckedUpdateInput = {};

  if (body.displayName !== undefined && body.displayName.trim()) data.displayName = body.displayName.trim();
  if (body.email !== undefined) data.email = body.email || null;
  if (body.phone !== undefined) data.phone = body.phone || null;
  if (body.teamId !== undefined) {
    const team = await prisma.team.findUnique({ where: { id: body.teamId } });
    if (!team) return jsonError("Invalid team.", 400);
    data.teamId = body.teamId;
  }
  if (body.roleSlug !== undefined) {
    const role = await prisma.role.findUnique({ where: { slug: body.roleSlug } });
    if (!role) return jsonError("Invalid role.", 400);
    data.roleId = role.id;
  }
  if (body.password !== undefined) {
    if (String(body.password).length < 8) return jsonError("Password must be at least 8 characters.", 400);
    data.passwordHash = await hashPassword(String(body.password));
  }
  if (body.archived !== undefined) data.archivedAt = body.archived ? new Date() : null;

  const updated = await prisma.user.update({ where: { id }, data });
  return NextResponse.json({ id: updated.id });
}