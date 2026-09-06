import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity, logTransaction } from "@/lib/activity";
import { notifyTeamManagerOfTeam } from "@/lib/notify";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import type { SessionUser } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;

  const { id } = await params;
  const body = await req.json();
  const note: string | null = body.note ?? null;

  if (!session.permissions.includes("request.create")) {
    return jsonError("No permission to request availability.", 403);
  }

  const creator = await prisma.creator.findUnique({
    where: { id, deletedAt: null },
    include: { ownerships: { include: { team: true } } },
  });
  if (!creator) return jsonError("Creator not found.", 404);
  if (creator.ownerships.length === 0) {
    return jsonError("Creator is unowned; pick it up directly instead.", 409);
  }
  if (creator.ownerships.some((o) => o.teamId === session.teamId)) {
    return jsonError("Your team already works this creator.", 409);
  }

  const owningTeamId = creator.ownerships[0].teamId;
  const existing = await prisma.availabilityRequest.findFirst({
    where: {
      creatorId: id,
      requestingTeamId: session.teamId,
      status: { in: ["PENDING_PRE_APPROVAL", "PENDING_RELEASE"] },
    },
  });
  if (existing) {
    return jsonError("An availability request for this creator is already pending.", 409);
  }

  const request = await prisma.availabilityRequest.create({
    data: {
      creatorId: id,
      requestingTeamId: session.teamId,
      requestingUserId: session.id,
      owningTeamId,
      note,
      status: "PENDING_PRE_APPROVAL",
    },
  });

  await logActivity({
    creatorId: id,
    kind: "SYSTEM",
    type: "REQUEST_CREATED",
    summary: `Availability requested by ${session.teamName}`,
    description: note ?? undefined,
    authorId: session.id,
  });
  await logTransaction({
    userId: session.id,
    action: "request.create",
    entityType: "AvailabilityRequest",
    entityId: request.id,
    detail: `Requested ${creator.name} from owning team`,
  });

  // Step 1 approval: requesting team's manager. Step 2: owning team's manager.
  const requestingManagers = await prisma.user.findMany({
    where: { teamId: session.teamId, role: { is: { slug: "team-manager" } }, archivedAt: null },
  });
  if (requestingManagers.length === 0) {
    // No requesting manager exists; jump straight to owning team approval.
    await prisma.availabilityRequest.update({
      where: { id: request.id },
      data: { status: "PENDING_RELEASE", preApprovedById: session.id },
    });
  }
  await notifyTeamManagerOfTeam(owningTeamId, {
    type: "AVAILABILITY_REQUESTED",
    title: "Availability request received",
    body: `${session.teamName} requested ${creator.name}`,
    link: "/creators",
  });

  return NextResponse.json({ id: request.id });
}