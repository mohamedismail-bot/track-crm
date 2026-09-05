import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { addDays, isBefore } from "date-fns";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import type { SessionUser } from "@/lib/auth";
import { logActivity, logTransaction } from "@/lib/activity";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;
  const { id } = await params;

  const creator = await prisma.creator.findUnique({
    where: { id, deletedAt: null },
    include: {
      primaryProfile: true,
      profiles: true,
      ownerships: { include: { user: true, team: true } },
      engagements: {
        include: {
          stage: true,
          team: true,
          deliverables: { orderBy: { createdAt: "asc" } },
          gifts: { orderBy: { requestedAt: "desc" } },
        },
        orderBy: { createdAt: "desc" },
      },
      activityLogs: {
        include: { author: true, attachments: true },
        orderBy: { loggedAt: "desc" },
      },
    },
  });
  if (!creator) return jsonError("Creator not found.", 404);

  const settings = await getSettings();
  const owns = creator.ownerships.some((o) => o.userId === session.id);
  const isManager = session.roleSlug === "team-manager";
  const sameTeam = creator.ownerships.some((o) => o.teamId === session.teamId);
  const otherTeamOnly = creator.ownerships.length > 0 && !sameTeam;

  // Limited view: unassigned teams only get status, stage and activity logs.
  const canViewFull = sameTeam || owns || !otherTeamOnly;

  let poolStatus: "none" | "same_team" | "company" = "none";
  const lastActivity = creator.activityLogs[0]?.loggedAt;
  if (!owns && !sameTeam && lastActivity && creator.ownerships.length > 0) {
    if (isBefore(lastActivity, addDays(new Date(), -settings.inactivityCompanyDays))) poolStatus = "company";
    else if (isBefore(lastActivity, addDays(new Date(), -settings.inactivitySameTeamDays))) poolStatus = "same_team";
  }

  return NextResponse.json({
    ...creator,
    canViewFull,
    relationship: owns
      ? "owned"
      : sameTeam
        ? isManager
          ? "same_team_manager"
          : "same_team"
        : otherTeamOnly
          ? "other_team"
          : creator.ownerships.length === 0
            ? "available"
            : "none",
    poolStatus,
    isOwnedByMe: owns,
    canMove: (owns || isManager) && sameTeam,
    canLog: sameTeam,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;

  const { id } = await params;
  if (!session.permissions.includes("creator.edit")) {
    return jsonError("No permission to edit creators.", 403);
  }

  try {
    const body = await req.json();
    const { name, email, phone, niche, city, country, creatorType, followers, engagementRate, notes } = body;

    const creator = await prisma.creator.update({
      where: { id },
      data: {
        name,
        email,
        phone,
        niche,
        city,
        country,
        creatorType,
        followers: followers === "" || followers == null ? null : Number(followers),
        engagementRate: engagementRate === "" || engagementRate == null ? null : Number(engagementRate),
        notes,
      },
    });
    await logActivity({
      creatorId: id,
      kind: "SYSTEM",
      type: "CREATOR_UPDATED",
      summary: "Creator details updated",
      authorId: session.id,
    });
    await logTransaction({
      userId: session.id,
      action: "creator.update",
      entityType: "Creator",
      entityId: id,
      detail: `Updated ${creator.name}`,
    });
    return NextResponse.json({ id: creator.id });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed to update creator", 400);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;

  const { id } = await params;
  if (!session.permissions.includes("creator.delete")) {
    return jsonError("No permission to delete creators.", 403);
  }
  await prisma.creator.update({ where: { id }, data: { deletedAt: new Date() } });
  await logTransaction({
    userId: session.id,
    action: "creator.delete",
    entityType: "Creator",
    entityId: id,
    detail: "Soft-deleted creator",
  });
  return NextResponse.json({ ok: true });
}