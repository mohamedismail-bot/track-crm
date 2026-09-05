import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import type { SessionUser } from "@/lib/auth";

export async function GET() {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;

  if (!session.permissions.includes("request.approve")) {
    return jsonError("No permission to view availability requests.", 403);
  }

  const requests = await prisma.availabilityRequest.findMany({
    where: {
      OR: [
        { status: "PENDING_PRE_APPROVAL", requestingTeamId: session.teamId },
        { status: "PENDING_RELEASE", owningTeamId: session.teamId },
      ],
    },
    include: {
      creator: { include: { ownerships: { include: { user: true, team: true } } } },
      requestingTeam: true,
      owningTeam: true,
      requester: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    requests.map((r) => ({
      id: r.id,
      creatorId: r.creatorId,
      creatorName: r.creator.name,
      requestingTeamName: r.requestingTeam.name,
      owningTeamName: r.owningTeam.name,
      requesterName: r.requester.displayName,
      note: r.note,
      status: r.status,
      createdAt: r.createdAt,
      stage:
        r.status === "PENDING_PRE_APPROVAL"
          ? "pre_approval"
          : r.status === "PENDING_RELEASE"
            ? "release"
            : r.status,
    })),
  );
}