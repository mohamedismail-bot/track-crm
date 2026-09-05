import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity, logTransaction } from "@/lib/activity";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import type { SessionUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;

  const { id } = await params;
  const body = await req.json();
  const action = body.action;

  const engagement = await prisma.engagement.findUnique({
    where: { id },
    include: { creator: { include: { ownerships: true } }, team: true, stage: true },
  });
  if (!engagement) return jsonError("Engagement not found.", 404);
  if (engagement.teamId !== session.teamId) {
    return jsonError("Not your team's engagement.", 403);
  }

  if (action === "move-stage") {
    if (!session.permissions.includes("creator.moveStage")) {
      return jsonError("No permission to move stages.", 403);
    }
    const owns = engagement.creator.ownerships.some((o) => o.userId === session.id);
    if (!owns && session.roleSlug !== "team-manager" && session.roleSlug !== "admin") {
      return jsonError("Only the assigned owner or team manager can move stages.", 403);
    }
    const stageId = body.stageId;
    if (!stageId) return jsonError("Missing stageId.", 400);
    const target = await prisma.stage.findUnique({ where: { id: stageId } });
    if (!target) return jsonError("Invalid stage.", 400);

    const fromName = engagement.stage.name;
    await prisma.engagement.update({
      where: { id },
      data: { stageId, completedAt: target.isCompleted ? new Date() : engagement.completedAt },
    });
    await logActivity({
      creatorId: engagement.creatorId,
      kind: "SYSTEM",
      type: "STAGE_CHANGED",
      summary: `Stage moved: ${fromName} to ${target.name}`,
      description: `${engagement.title}`,
      authorId: session.id,
    });
    await logTransaction({
      userId: session.id,
      action: "creator.moveStage",
      entityType: "Engagement",
      entityId: id,
      detail: `Moved ${engagement.title} from ${fromName} to ${target.name}`,
    });
    return NextResponse.json({ ok: true, stageName: target.name });
  }

  if (action === "edit") {
    if (!session.permissions.includes("engagement.edit")) {
      return jsonError("No permission to edit engagements.", 403);
    }
    await prisma.engagement.update({
      where: { id },
      data: {
        title: body.title !== undefined ? body.title : undefined,
        amount: body.amount !== undefined ? (body.amount === "" ? null : Number(body.amount)) : undefined,
        couponCode: body.couponCode !== undefined ? (body.couponCode === "" ? null : body.couponCode) : undefined,
        commissionPercent:
          body.commissionPercent !== undefined
            ? body.commissionPercent === ""
              ? null
              : Number(body.commissionPercent)
            : undefined,
      },
    });
    await logTransaction({
      userId: session.id,
      action: "engagement.update",
      entityType: "Engagement",
      entityId: id,
      detail: `Edited ${engagement.title}`,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "add-deliverable") {
    const { title, type, dueDate } = body;
    if (!title || !dueDate) return jsonError("Title and due date are required.", 400);
    await prisma.deliverable.create({
      data: {
        engagementId: id,
        title: String(title).trim(),
        type: String(type ?? "Content"),
        dueDate: new Date(dueDate),
      },
    });
    await logTransaction({
      userId: session.id,
      action: "deliverable.create",
      entityType: "Deliverable",
      entityId: id,
      detail: `Added ${title}`,
    });
    return NextResponse.json({ ok: true });
  }

  return jsonError("Unknown action.", 400);
}