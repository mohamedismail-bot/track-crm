import "server-only";
import { prisma } from "./prisma";
import { getSettings } from "./settings";
import { logActivity, logTransaction } from "./activity";
import { notify } from "./notify";
import { requiredForGiftingMissing, REQUIRED_FOR_GIFTING_LABELS, GIFT_STATUS_KEYS } from "./constants";
import { giftStatusId, giftProductName } from "./gift-status";
import type { SessionUser } from "./auth";
import { DealType, DeliverableStatus } from "@prisma/client";

export interface GiftRequestResult {
  ok: boolean;
  needsException: boolean;
  message: string;
  gift?: { id: string };
}

/**
 * Gifts already requested this calendar month, counted across all engagements/teams
 * for a creator. Drafts and rejections never count toward the cap.
 */
export async function countCreatorGiftsThisMonth(creatorId: string, when = new Date()) {
  const start = new Date(when.getFullYear(), when.getMonth(), 1);
  const end = new Date(when.getFullYear(), when.getMonth() + 1, 1);
  return prisma.gift.count({
    where: {
      engagement: { creatorId },
      requestedAt: { gte: start, lt: end },
      status: { is: { isDraft: false, isRejection: false } },
    },
  });
}

/**
 * Hard stop: a new gift cannot be requested until the deliverable required by the
 * most recent previous gift is Approved.
 */
export async function getLastGiftLockingDeliverable(creatorId: string): Promise<{
  blockedBy: { gift: string; deliverables: string[] } | null;
}> {
  const incidents = await prisma.gift.findMany({
    where: {
      engagement: { creatorId },
      status: { is: { isDraft: false, isRejection: false } },
    },
    orderBy: { requestedAt: "desc" },
    include: {
      lines: { orderBy: { id: "asc" } },
      engagement: { include: { deliverables: true, creator: true } },
    },
  });
  const last = incidents[0];
  if (!last) return { blockedBy: null };

  const dels = last.engagement.deliverables;
  if (dels.length === 0) return { blockedBy: null };

  const required =
    last.engagement.dealType === DealType.COMMISSION || last.engagement.dealType === DealType.BARTER
      ? dels.filter((d) => d.type.toLowerCase().includes("video") || d.type.toLowerCase().includes("tiktok") || d.type.toLowerCase().includes("reel"))
      : dels;

  const pending = required.filter((d) => d.status !== DeliverableStatus.APPROVED);
  if (pending.length === 0) return { blockedBy: null };

  return {
    blockedBy: {
      gift: giftProductName(last),
      deliverables: pending.map((d) => d.title),
    },
  };
}

export async function canRequestGift(user: SessionUser, engagementId: string) {
  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    include: { team: true, creator: { include: { ownerships: true } } },
  });
  if (!engagement || engagement.teamId !== user.teamId) {
    return { ok: false as const, message: "You can only request gifts for your team's engagements." };
  }

  const owns = engagement.creator.ownerships.some((o) => o.userId === user.id);
  const isManager = user.roleSlug === "team-manager";
  if (!owns && !isManager) {
    return { ok: false as const, message: "Only the assigned owner or team manager can request a gift." };
  }

  // Required for Gifting hard stop: Country, City, Creator Type and Phone must
  // be populated before a gift may be requested. No override.
  const missingGifting = requiredForGiftingMissing({
    countryId: engagement.creator.countryId,
    cityId: engagement.creator.cityId,
    creatorTypeId: engagement.creator.creatorTypeId,
    phone: engagement.creator.phone,
  });
  if (missingGifting.length > 0) {
    const missingLabels = missingGifting.map((k) => REQUIRED_FOR_GIFTING_LABELS[k]).join(", ");
    return {
      ok: false as const,
      blocked: true as const,
      message: `This creator is missing required data for gifting: ${missingLabels}. Complete the record first.`,
      missingFields: missingGifting,
    };
  }

  const settings = await getSettings();

  // Minimum stage gate
  if (settings.giftMinStageId) {
    const pipelineEntry = engagement.stageId;
    const minStage = await prisma.pipelineConfig.findFirst({
      where: { teamId: user.teamId, stageId: settings.giftMinStageId },
    });
    if (minStage) {
      const minOrder = minStage.order;
      const current = await prisma.pipelineConfig.findFirst({
        where: { teamId: user.teamId, stageId: pipelineEntry },
      });
      if (current && current.order < minOrder) {
        return { ok: false as const, message: "Engagement must be at or beyond the minimum stage to request a gift." };
      }
    }
  }

  // Hard stop lock (no override, evaluated before the monthly cap so an
  // exception can never bypass a still-unfulfilled previous gift).
  if (settings.giftRequirePreviousDeliverable) {
    const lock = await getLastGiftLockingDeliverable(engagement.creatorId);
    if (lock.blockedBy) {
      return {
        ok: false as const,
        blocked: true as const,
        message: `Previous gift "${lock.blockedBy.gift}" requires the following deliverable(s) to be received first: ${lock.blockedBy.deliverables.join(", ")}`,
      };
    }
  }

  // Monthly cap
  if (settings.giftMonthlyCapEnabled) {
    const count = await countCreatorGiftsThisMonth(engagement.creatorId);
    if (count >= 1) {
      return { ok: false as const, needsException: true as const, message: "A gift was already requested this month." };
    }
  }

  return { ok: true as const };
}

/**
 * Create a gift request. Returns { needsException } to trigger the manager approval
 * flow for a second gift in the month. A first gift in the month is created directly
 * in the "approved" (warehouse ready) status, preserving pre-order behavior.
 */
export async function requestGift(
  user: SessionUser,
  engagementId: string,
  input: { productName: string; productDescription?: string },
): Promise<
  | { ok: true; status: string; message: string; giftId: string }
  | { ok: false; message: string; needsException?: boolean; blocked?: boolean; missingFields?: string[] }
> {
  const check = await canRequestGift(user, engagementId);
  if (check.ok === false) {
    // A second gift in the same month needs manager approval: it is NOT a dead
    // end — proceed in exception mode so the gift gets created as pending manager.
    if (check.blocked || !check.needsException) {
      return { ok: false, message: check.message, needsException: check.needsException, blocked: check.blocked, missingFields: check.missingFields };
    }
  }

  // Recompute exception: a second gift in the same month needs manager approval.
  const settings = await getSettings();
  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    include: { creator: true, team: true },
  });
  if (!engagement) return { ok: false, message: "Engagement not found." };
  const isException =
    settings.giftMonthlyCapEnabled && (await countCreatorGiftsThisMonth(engagement.creatorId)) >= 1;

  const targetKey = isException ? GIFT_STATUS_KEYS.PENDING_MANAGER : GIFT_STATUS_KEYS.APPROVED;
  const statusId = await giftStatusId(targetKey);
  const name = input.productName.trim();

  const gift = await prisma.gift.create({
    data: {
      engagementId,
      requestedById: user.id,
      isException,
      statusId,
      currency: engagement.currency,
      approvedById: isException ? undefined : user.id,
      approvedAt: isException ? undefined : new Date(),
      lines: {
        create: {
          productName: name,
          productDescription: input.productDescription,
          unitCost: 0,
          quantity: 1,
          lineTotal: 0,
        },
      },
    },
  });

  await logActivity({
    creatorId: engagement.creatorId,
    kind: "SYSTEM",
    type: "GIFT_REQUESTED",
    summary: isException
      ? `Gift requested with exception approval`
      : `Gift requested and queued`,
    description: `${name}${isException ? " (exception: second gift this month)" : ""}`,
    authorId: user.id,
  });
  await logTransaction({
    userId: user.id,
    action: "gift.request",
    entityType: "Gift",
    entityId: gift.id,
    detail: `Requested ${name} for ${engagement.creator.name}`,
  });

  if (isException) {
    const managers = await prisma.user.findMany({
      where: { teamId: user.teamId, role: { is: { slug: "team-manager" } }, archivedAt: null },
    });
    await Promise.all(
      managers.map((m) =>
        notify({
          userId: m.id,
          type: "GIFT_EXCEPTION_REQUESTED",
          title: "Gift exception approval requested",
          body: `${name} for ${engagement.creator.name}`,
          link: `/gifting`,
        }),
      ),
    );
    return { ok: true, status: GIFT_STATUS_KEYS.PENDING_MANAGER, message: "Exception gift request sent for manager approval.", giftId: gift.id };
  }

  return { ok: true, status: GIFT_STATUS_KEYS.APPROVED, message: "Gift approved and queued for warehouse.", giftId: gift.id };
}

export async function resolveGiftRequest(
  user: SessionUser,
  giftId: string,
  decision: "approve" | "reject",
  reason?: string,
): Promise<{ ok: boolean; message: string }> {
  const gift = await prisma.gift.findUnique({
    where: { id: giftId },
    include: {
      status: true,
      lines: { orderBy: { id: "asc" } },
      engagement: { include: { team: true, creator: true } },
    },
  });
  if (!gift) return { ok: false, message: "Gift not found." };
  if (gift.engagement.teamId !== user.teamId) return { ok: false, message: "Not your team's gift." };
  if (!user.permissions.includes("gift.approve")) return { ok: false, message: "No permission to approve gifts." };
  if (gift.status.key !== GIFT_STATUS_KEYS.PENDING_MANAGER) return { ok: false, message: "Gift is not pending approval." };

  const name = giftProductName(gift);

  if (decision === "approve") {
    const statusId = await giftStatusId(GIFT_STATUS_KEYS.APPROVED);
    await prisma.gift.update({
      where: { id: giftId },
      data: {
        statusId,
        approvedById: user.id,
        approvedAt: new Date(),
      },
    });
    await logActivity({
      creatorId: gift.engagement.creatorId,
      kind: "SYSTEM",
      type: "GIFT_APPROVED",
      summary: "Gift exception approved",
      description: name,
      authorId: user.id,
    });
    await notify({
      userId: gift.requestedById,
      type: "GIFT_APPROVED",
      title: "Gift approved",
      body: `${name} for ${gift.engagement.creator.name}`,
      link: "/gifting",
    });
  } else {
    const statusId = await giftStatusId(GIFT_STATUS_KEYS.REJECTED);
    await prisma.gift.update({
      where: { id: giftId },
      data: { statusId, exceptionReason: reason },
    });
    await logActivity({
      creatorId: gift.engagement.creatorId,
      kind: "SYSTEM",
      type: "GIFT_REJECTED",
      summary: "Gift exception rejected",
      description: reason ?? name,
      authorId: user.id,
    });
    await notify({
      userId: gift.requestedById,
      type: "GIFT_REJECTED",
      title: "Gift exception rejected",
      body: reason ?? name,
      link: "/gifting",
    });
  }

  await logTransaction({
    userId: user.id,
    action: decision === "approve" ? "gift.approve" : "gift.reject",
    entityType: "Gift",
    entityId: giftId,
    detail: `Decision ${decision} for ${name}`,
  });

  return { ok: true, message: decision === "approve" ? "Gift approved." : "Gift rejected." };
}

export async function warehouseUpdateGift(
  user: SessionUser,
  giftId: string,
  input: { action: "dispatch" | "deliver"; trackingNumber?: string; carrier?: string },
): Promise<{ ok: boolean; message: string }> {
  if (!user.permissions.includes("gift.fulfill")) return { ok: false, message: "No warehouse permission." };
  const gift = await prisma.gift.findUnique({
    where: { id: giftId },
    include: {
      status: true,
      lines: { orderBy: { id: "asc" } },
      engagement: { include: { creator: true } },
    },
  });
  if (!gift) return { ok: false, message: "Gift not found." };

  const name = giftProductName(gift);

  if (input.action === "dispatch") {
    if (gift.status.key !== GIFT_STATUS_KEYS.APPROVED) return { ok: false, message: "Gift must be approved before dispatch." };
    if (!input.trackingNumber?.trim()) return { ok: false, message: "Tracking number required." };
    const statusId = await giftStatusId(GIFT_STATUS_KEYS.SHIPPED);
    await prisma.gift.update({
      where: { id: giftId },
      data: {
        statusId,
        trackingNumber: input.trackingNumber.trim(),
        carrier: input.carrier,
        dispatchedAt: new Date(),
      },
    });
    await logActivity({
      creatorId: gift.engagement.creatorId,
      kind: "SYSTEM",
      type: "GIFT_DISPATCHED",
      summary: "Gift dispatched",
      description: `${name} - tracking ${input.trackingNumber.trim()}`,
      authorId: user.id,
    });
    await notify({
      userId: gift.requestedById,
      type: "GIFT_DISPATCHED",
      title: "Gift dispatched",
      body: `${name} - tracking ${input.trackingNumber.trim()}`,
      link: "/gifting",
    });
  } else {
    if (gift.status.key !== GIFT_STATUS_KEYS.SHIPPED) return { ok: false, message: "Gift must be dispatched before delivery." };
    const statusId = await giftStatusId(GIFT_STATUS_KEYS.DELIVERED);
    await prisma.gift.update({
      where: { id: giftId },
      data: { statusId, deliveredAt: new Date() },
    });
    await logActivity({
      creatorId: gift.engagement.creatorId,
      kind: "SYSTEM",
      type: "GIFT_DELIVERED",
      summary: "Gift delivered",
      description: name,
      authorId: user.id,
    });
    await notify({
      userId: gift.requestedById,
      type: "GIFT_DELIVERED",
      title: "Gift delivered",
      body: name,
      link: "/gifting",
    });
  }

  await logTransaction({
    userId: user.id,
    action: input.action === "dispatch" ? "gift.dispatch" : "gift.deliver",
    entityType: "Gift",
    entityId: giftId,
    detail: `${name} for ${gift.engagement.creator.name}`,
  });

  return { ok: true, message: input.action === "dispatch" ? "Gift dispatched." : "Gift marked delivered." };
}

export type { DeliverableStatus, DealType };