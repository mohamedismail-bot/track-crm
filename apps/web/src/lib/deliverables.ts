import "server-only";
import { prisma } from "./prisma";
import { getSettings } from "./settings";
import { logActivity, logTransaction } from "./activity";
import { notify } from "./notify";
import { postGiftDebit } from "./gifts";
import { type SessionUser } from "./auth";
import { DeliverableStatus } from "@prisma/client";

export async function submitDeliverable(
  user: SessionUser,
  deliverableId: string,
  input: { postedUrl: string; postedDate: string },
): Promise<{ ok: boolean; message: string }> {
  const del = await prisma.deliverable.findUnique({
    where: { id: deliverableId },
    include: { engagement: { include: { creator: true, team: true } } },
  });
  if (!del) return { ok: false, message: "Deliverable not found." };
  if (del.engagement.teamId !== user.teamId) return { ok: false, message: "Not your team's deliverable." };
  if (!user.permissions.includes("deliverable.submit")) return { ok: false, message: "No permission to submit." };

  const creator = await prisma.creator.findUnique({ where: { id: del.engagement.creatorId } });
  const owns =
    creator &&
    (await prisma.creatorOwnership.findFirst({
      where: { creatorId: creator.id, userId: user.id },
    }));
  if (!owns && user.roleSlug !== "team-manager") {
    return { ok: false, message: "Only the assigned owner or team manager can submit." };
  }

  const url = input.postedUrl.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return { ok: false, message: "Enter a valid link (must start with http:// or https://)." };
  }

  const settings = await getSettings();

  // When the workspace requires manager verification, submission lands the
  // deliverable in UNDER_REVIEW and pings the managers. When it doesn't,
  // posting the video IS the fulfillment point: it approves directly (and may
  // settle a Gift ledger), with no manager notification.
  const autoApprove = !settings.deliverableApprovalRequired;

  if (autoApprove) {
    await prisma.$transaction(async (tx) => {
      await tx.deliverable.update({
        where: { id: deliverableId },
        data: {
          status: DeliverableStatus.APPROVED,
          postedUrl: url,
          postedDate: new Date(input.postedDate),
          submittedById: user.id,
          submittedAt: new Date(),
          reviewedById: user.id,
        },
      });
      await tx.activityLog.create({
        data: {
          creatorId: del.engagement.creatorId,
          kind: "SYSTEM",
          type: "DELIVERABLE_SUBMITTED",
          summary: `Deliverable submitted: ${del.title}`,
          description: url,
          authorId: user.id,
        },
      });
      if (del.giftId && settings.creditEnabled) {
        await postGiftDebit(tx, del.giftId, user.id, del.engagement.creatorId);
      }
    }, { timeout: 30000 });
    await checkEngagementCompletion(del.engagementId, del.engagement.creatorId);
    await logTransaction({
      userId: user.id,
      action: "deliverable.submit",
      entityType: "Deliverable",
      entityId: deliverableId,
      detail: `Submitted ${del.title}`,
    });
    return { ok: true, message: "Deliverable marked as delivered." };
  }

  await prisma.deliverable.update({
    where: { id: deliverableId },
    data: {
      status: DeliverableStatus.UNDER_REVIEW,
      postedUrl: url,
      postedDate: new Date(input.postedDate),
      submittedById: user.id,
      submittedAt: new Date(),
    },
  });

  await logActivity({
    creatorId: del.engagement.creatorId,
    kind: "SYSTEM",
    type: "DELIVERABLE_SUBMITTED",
    summary: `Deliverable submitted: ${del.title}`,
    description: url,
    authorId: user.id,
  });
  await logTransaction({
    userId: user.id,
    action: "deliverable.submit",
    entityType: "Deliverable",
    entityId: deliverableId,
    detail: `Submitted ${del.title}`,
  });

  const managers = await prisma.user.findMany({
    where: { teamId: user.teamId, role: { is: { slug: "team-manager" } }, archivedAt: null },
  });
  await Promise.all(
    managers.map((m) =>
      notify({
        userId: m.id,
        type: "DELIVERABLE_SUBMITTED",
        title: "Deliverable submitted",
        body: `${del.title} for ${del.engagement.creator.name}`,
        link: `/creators/${del.engagement.creatorId}`,
      }),
    ),
  );

  return { ok: true, message: "Deliverable submitted for manager verification." };
}

export async function reviewDeliverable(
  user: SessionUser,
  deliverableId: string,
  decision: "approve" | "revision",
  comment?: string,
): Promise<{ ok: boolean; message: string }> {
  if (!user.permissions.includes("deliverable.approve")) {
    return { ok: false, message: "Only a Team Manager can verify deliverables." };
  }
  const del = await prisma.deliverable.findUnique({
    where: { id: deliverableId },
    include: { engagement: { include: { creator: true, team: true } }, submittedBy: true },
  });
  if (!del) return { ok: false, message: "Deliverable not found." };
  if (del.engagement.teamId !== user.teamId) return { ok: false, message: "Not your team's deliverable." };
  if (del.status !== DeliverableStatus.UNDER_REVIEW && decision === "approve") {
    return { ok: false, message: "Deliverable is not under review." };
  }

  if (decision === "approve") {
    const settings = await getSettings();
    await prisma.$transaction(async (tx) => {
      await tx.deliverable.update({
        where: { id: deliverableId },
        data: { status: DeliverableStatus.APPROVED, reviewedById: user.id, reviewComment: comment },
      });
      await tx.activityLog.create({
        data: {
          creatorId: del.engagement.creatorId,
          kind: "SYSTEM",
          type: "DELIVERABLE_APPROVED",
          summary: `Deliverable approved: ${del.title}`,
          description: comment,
          authorId: user.id,
        },
      });
      // Approving the final required deliverable of a gift order settles the
      // ledger: a single −debit equal to the order total (credit must be on).
      if (del.giftId && settings.creditEnabled) {
        await postGiftDebit(tx, del.giftId, user.id, del.engagement.creatorId);
      }
    }, { timeout: 30000 });
    if (del.submittedById) {
      await notify({
        userId: del.submittedById,
        type: "DELIVERABLE_APPROVED",
        title: "Deliverable approved",
        body: `${del.title} for ${del.engagement.creator.name}`,
        link: `/creators/${del.engagement.creatorId}`,
      });
    }
    await checkEngagementCompletion(del.engagementId, del.engagement.creatorId);
  } else {
    await prisma.deliverable.update({
      where: { id: deliverableId },
      data: { status: DeliverableStatus.REVISION_REQUESTED, reviewedById: user.id, reviewComment: comment },
    });
    await logActivity({
      creatorId: del.engagement.creatorId,
      kind: "SYSTEM",
      type: "DELIVERABLE_REVISION_REQUESTED",
      summary: `Deliverable revision requested: ${del.title}`,
      description: comment,
      authorId: user.id,
    });
    if (del.submittedById) {
      await notify({
        userId: del.submittedById,
        type: "DELIVERABLE_REVISION_REQUESTED",
        title: "Deliverable needs revision",
        body: comment ?? `${del.title} for ${del.engagement.creator.name}`,
        link: `/creators/${del.engagement.creatorId}`,
      });
    }
  }

  await logTransaction({
    userId: user.id,
    action: decision === "approve" ? "deliverable.approve" : "deliverable.revision",
    entityType: "Deliverable",
    entityId: deliverableId,
    detail: `${decision === "approve" ? "Approved" : "Revision requested for"} ${del.title}`,
  });

  return { ok: true, message: decision === "approve" ? "Deliverable approved." : "Revision requested." };
}

export async function checkEngagementCompletion(engagementId: string, creatorId: string) {
  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    include: { deliverables: true, stage: true },
  });
  if (!engagement || engagement.completedAt) return;

  const allApproved =
    engagement.deliverables.length > 0 &&
    engagement.deliverables.every((d) => d.status === DeliverableStatus.APPROVED);

  if (allApproved) {
    const completedStage = await prisma.pipelineConfig.findFirst({
      where: { teamId: engagement.teamId, isCompleted: true },
      include: { stage: true },
    });
    if (completedStage) {
      await prisma.engagement.update({
        where: { id: engagementId },
        data: { stageId: completedStage.stageId, completedAt: new Date() },
      });
      await logActivity({
        creatorId,
        kind: "SYSTEM",
        type: "ENGAGEMENT_COMPLETED",
        summary: `Engagement completed: ${engagement.title}`,
        description: "All deliverables approved, moved to the Completed stage.",
      });
    }
  }
}