import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { logActivity, logTransaction } from "@/lib/activity";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import type { SessionUser } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;

  const { id } = await params;
  const body = await req.json();
  const decision: "approve" | "reject" = body.decision;
  const reason: string | null = body.reason ?? null;

  const request = await prisma.availabilityRequest.findUnique({
    where: { id },
    include: {
      creator: { include: { ownerships: { include: { team: true } } } },
      requestingTeam: true,
      owningTeam: true,
      requester: true,
    },
  });
  if (!request) return jsonError("Request not found.", 404);

  if (request.status === "PENDING_PRE_APPROVAL") {
    if (request.requestingTeamId !== session.teamId) {
      return jsonError("Only the requesting team's manager can pre-approve.", 403);
    }
    if (!session.permissions.includes("request.approve")) {
      return jsonError("No permission.", 403);
    }
    if (decision === "reject") {
      await resolveRequest(session, request, "reject", reason);
      return NextResponse.json({ ok: true, status: "REJECTED" });
    }
    await prisma.availabilityRequest.update({
      where: { id },
      data: { status: "PENDING_RELEASE", preApprovedById: session.id },
    });
    return NextResponse.json({ ok: true, status: "PENDING_RELEASE" });
  }

  if (request.status === "PENDING_RELEASE") {
    if (request.owningTeamId !== session.teamId) {
      return jsonError("Only the owning team's manager can release the creator.", 403);
    }
    if (!session.permissions.includes("request.approve")) {
      return jsonError("No permission.", 403);
    }
    if (decision === "reject") {
      await resolveRequest(session, request, "reject", reason);
      return NextResponse.json({ ok: true, status: "REJECTED" });
    }

    // Release ownership: remove owning team ownership, assign to requesting team.
    await prisma.$transaction(async (tx) => {
      await tx.creatorOwnership.deleteMany({
        where: { creatorId: request.creatorId, teamId: request.owningTeamId },
      });
      await tx.creatorOwnership.create({
        data: {
          creatorId: request.creatorId,
          userId: request.requester.id,
          teamId: request.requestingTeamId,
        },
      });
      await tx.availabilityRequest.update({
        where: { id },
        data: { status: "APPROVED", releasedById: session.id, resolvedAt: new Date() },
      });
    });

    await notify({
      userId: request.requester.id,
      type: "AVAILABILITY_APPROVED",
      title: "Availability request approved",
      body: `${request.creator.name} is now available to ${request.requestingTeam.name}`,
      link: `/creators/${request.creatorId}`,
    });

    await logActivity({
      creatorId: request.creatorId,
      kind: "SYSTEM",
      type: "OWNERSHIP_CHANGED",
      summary: `Creator moved to ${request.requestingTeam.name}`,
      description: `Released by ${session.displayName}`,
      authorId: session.id,
    });
    await logActivity({
      creatorId: request.creatorId,
      kind: "SYSTEM",
      type: "REQUEST_RESOLVED",
      summary: `Availability request approved`,
      authorId: session.id,
    });
    await logTransaction({
      userId: session.id,
      action: "request.approve",
      entityType: "AvailabilityRequest",
      entityId: id,
      detail: `Released ${request.creator.name} to ${request.requestingTeam.name}`,
    });
    return NextResponse.json({ ok: true, status: "APPROVED" });
  }

  return jsonError("Request is already resolved.", 409);
}

async function resolveRequest(
  session: SessionUser,
  request: {
    id: string;
    creatorId: string;
    requester: { id: string; displayName: string };
    creator: { name: string };
    requestingTeam: { name: string };
  },
  decision: "reject",
  reason: string | null,
) {
  await prisma.availabilityRequest.update({
    where: { id: request.id },
    data: { status: "REJECTED", rejectedById: session.id, rejectReason: reason, resolvedAt: new Date() },
  });
  await notify({
    userId: request.requester.id,
    type: "AVAILABILITY_REJECTED",
    title: "Availability request rejected",
    body: reason ?? `${request.creator.name} from ${request.requestingTeam.name}`,
    link: "/creators",
  });
  await logActivity({
    creatorId: request.creatorId,
    kind: "SYSTEM",
    type: "REQUEST_RESOLVED",
    summary: `Availability request rejected`,
    description: reason ?? undefined,
    authorId: session.id,
  });
  await logTransaction({
    userId: session.id,
    action: "request.reject",
    entityType: "AvailabilityRequest",
    entityId: request.id,
    detail: `Rejected request for ${request.creator.name}`,
  });
}