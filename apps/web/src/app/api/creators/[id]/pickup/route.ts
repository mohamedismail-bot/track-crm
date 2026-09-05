import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { addDays, isBefore } from "date-fns";
import { logActivity, logTransaction } from "@/lib/activity";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import type { SessionUser } from "@/lib/auth";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;

  const { id } = await params;
  const settings = await getSettings();

  const creator = await prisma.creator.findUnique({
    where: { id, deletedAt: null },
    include: {
      ownerships: { include: { team: true } },
      activityLogs: { orderBy: { loggedAt: "desc" }, take: 1 },
    },
  });
  if (!creator) return jsonError("Creator not found.", 404);
  if (creator.ownerships.length > 0) {
    return jsonError("This creator is already owned and cannot be picked up.", 409);
  }

  // A fully unowned creator that never entered the pool can be picked up by anyone
  // with creator.create; pool rules only apply to formerly-owned creators.
  const lastActivity = creator.activityLogs[0]?.loggedAt;
  if (lastActivity) {
    const inCompany = isBefore(lastActivity, addDays(new Date(), -settings.inactivityCompanyDays));
    const inSameTeam = isBefore(lastActivity, addDays(new Date(), -settings.inactivitySameTeamDays));
    if (!inSameTeam && !inCompany) {
      return jsonError("Creator is still active; it cannot be picked up.", 409);
    }
  }

  await prisma.creatorOwnership.create({
    data: { creatorId: id, userId: session.id, teamId: session.teamId },
  });
  await logActivity({
    creatorId: id,
    kind: "SYSTEM",
    type: "OWNERSHIP_CHANGED",
    summary: `Creator picked up by ${session.displayName}`,
    description: `Assigned to team ${session.teamName}`,
    authorId: session.id,
  });
  await logTransaction({
    userId: session.id,
    action: "creator.pickup",
    entityType: "Creator",
    entityId: id,
    detail: `Picked up ${creator.name}`,
  });

  return NextResponse.json({ ok: true });
}