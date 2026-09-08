import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import type { SessionUser } from "@/lib/auth";
import { logActivity, logTransaction } from "@/lib/activity";

/**
 * Bulk-edit creators in one shot: change stage, owners, and/or Shopify status
 * for a set of creators. Gated by the `creator.edit` permission plus the
 * workspace bulk-edit grant (roles / users) so the Admin controls who can use it.
 */
export async function PATCH(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;

  if (!session.permissions.includes("creator.edit")) {
    return jsonError("No permission to edit creators.", 403);
  }
  const { canBulkEditCreators } = await import("@/lib/creators");
  if (!(await canBulkEditCreators(session))) {
    return jsonError("No permission to bulk-edit creators.", 403);
  }

  const body = await req.json();
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((i: unknown) => typeof i === "string") : [];
  if (ids.length === 0) return jsonError("At least one creator id is required.", 400);
  if (ids.length > 500) return jsonError("Select at most 500 creators at once.", 400);

  if (body.stageId === undefined && body.ownerIds === undefined && body.shopifyRegistered === undefined) {
    return jsonError("Nothing to update — pick a stage, owners or Shopify status.", 400);
  }

  let targetStage: { id: string; name: string; isCompleted: boolean } | null = null;
  if (body.stageId !== undefined) {
    const stage = await prisma.stage.findUnique({ where: { id: String(body.stageId) } });
    if (!stage) return jsonError("Invalid stage.", 400);
    targetStage = { id: stage.id, name: stage.name, isCompleted: stage.isCompleted };
  }

  const creators = await prisma.creator.findMany({
    where: { id: { in: ids }, deletedAt: null },
    include: {
      engagements: { include: { stage: true }, orderBy: { createdAt: "desc" } },
      ownerships: { include: { user: true } },
    },
  });
  if (creators.length === 0) return jsonError("No matching creators found.", 404);

  const latestEngagement = (c: { engagements: { completedAt: Date | null; createdAt: Date; id: string; stage: { name: string } | null }[] }) =>
    [...c.engagements].sort(
      (a, b) =>
        (b.completedAt?.getTime() ?? b.createdAt.getTime()) -
        (a.completedAt?.getTime() ?? a.createdAt.getTime()),
    )[0];

  const { resolveOwnerships, replaceCreatorOwnerships } = await import("@/lib/creators");
  const requestedOwners =
    body.ownerIds !== undefined ? await resolveOwnerships(session, body.ownerIds as string[] | undefined, { defaultToSelf: false }) : null;

  let stagesMoved = 0;
  let ownersChanged = 0;
  let shopifyUpdated = 0;

  for (const creator of creators) {
    if (targetStage) {
      const engagement = latestEngagement(creator);
      if (engagement) {
        const fromName = engagement.stage?.name ?? "No stage";
        await prisma.engagement.update({
          where: { id: engagement.id },
          data: { stageId: targetStage.id, completedAt: targetStage.isCompleted ? new Date() : null },
        });
        await logActivity({
          creatorId: creator.id,
          kind: "SYSTEM",
          type: "STAGE_CHANGED",
          summary: `Stage moved: ${fromName} to ${targetStage.name}`,
          description: "Bulk edit",
          authorId: session.id,
        });
        stagesMoved += 1;
      }
    }
    if (requestedOwners) {
      const before = creator.ownerships.map((o) => o.user.displayName);
      await replaceCreatorOwnerships(creator.id, requestedOwners);
      await logActivity({
        creatorId: creator.id,
        kind: "SYSTEM",
        type: "OWNERSHIP_CHANGED",
        summary: `Owners changed: ${before.length ? before.join(", ") : "none"} → ${requestedOwners.length ? "updated set" : "none"}`,
        description: "Bulk edit",
        authorId: session.id,
      });
      ownersChanged += 1;
    }
    if (body.shopifyRegistered !== undefined) {
      await prisma.creator.update({
        where: { id: creator.id },
        data: { shopifyRegistered: body.shopifyRegistered === true },
      });
      shopifyUpdated += 1;
    }
  }

  await logTransaction({
    userId: session.id,
    action: "creator.bulkEdit",
    entityType: "Creator",
    detail: `Bulk edited ${creators.length} creators (stages ${stagesMoved}, owners ${ownersChanged}, shopify ${shopifyUpdated})`,
  });

  return NextResponse.json({
    ok: true,
    total: creators.length,
    stagesMoved,
    ownersChanged,
    shopifyUpdated,
    skippedNoEngagement: targetStage ? creators.length - stagesMoved : 0,
  });
}