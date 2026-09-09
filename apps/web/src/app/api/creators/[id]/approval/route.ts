import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import { logActivity, logTransaction } from "@/lib/activity";
import { notify } from "@/lib/notify";
import type { SessionUser } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;

  const isManager = session.roleSlug === "team-manager";
  if (session.roleSlug !== "admin" && !isManager) {
    return jsonError("Only a Team Manager or the Admin can review pending creators.", 403);
  }

  const { id } = await params;
  const creator = await prisma.creator.findUnique({
    where: { id, deletedAt: null },
    include: { createdBy: { include: { team: true } } },
  });
  if (!creator) return jsonError("Creator not found.", 404);
  if (creator.approvalStatus === null) {
    return jsonError("This creator is not awaiting approval.", 400);
  }

  // A Team Manager may only review creators requested by a user on their own team.
  if (session.roleSlug === "team-manager" && creator.createdBy?.teamId !== session.teamId) {
    return jsonError("You can only review creators requested within your team.", 403);
  }

  const body = await req.json();
  const decision = String(body.decision ?? "");
  if (decision !== "approve" && decision !== "reject") {
    return jsonError("decision must be 'approve' or 'reject'.", 400);
  }
  if (decision === "reject" && !String(body.reason ?? "").trim()) {
    return jsonError("A reason is required to reject a creator.", 400);
  }
  const reason = String(body.reason ?? "").trim();

  const approved = decision === "approve";

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.creator.update({
      where: { id },
      data: {
        approvalStatus: approved ? null : "REJECTED",
        reviewComment: approved ? null : reason,
        reviewedById: session.id,
        reviewedAt: new Date(),
        ownerships: approved
          ? {
              create: { userId: creator.createdById ?? session.id, teamId: creator.createdBy?.teamId ?? session.teamId },
            }
          : undefined,
      },
    });
    return row;
  }, { timeout: 30000 });

  await logActivity({
    creatorId: id,
    kind: "SYSTEM",
    type: approved ? "CREATOR_APPROVED" : "CREATOR_REJECTED",
    summary: approved ? "Creator approved by Team Manager" : `Creator rejected: ${reason}`,
    description: approved ? undefined : `Reason: ${reason}`,
    authorId: session.id,
  });
  await logTransaction({
    userId: session.id,
    action: approved ? "creator.approve" : "creator.reject",
    entityType: "Creator",
    entityId: id,
    detail: `${approved ? "Approved" : "Rejected"} ${updated.name}`,
  });

  if (creator.createdById && creator.createdById !== session.id) {
    await notify({
      userId: creator.createdById,
      type: "SYSTEM",
      title: approved ? "Creator approved" : "Creator rejected",
      body: approved
        ? `${updated.name} was approved and is now assigned to you.`
        : `${updated.name} was rejected. Reason: ${reason}`,
      link: `/creators/${id}`,
    });
  }

  return NextResponse.json({ ok: true, approvalStatus: updated.approvalStatus });
}