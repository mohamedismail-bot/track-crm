import "server-only";
import { prisma } from "./prisma";
import { getSettings } from "./settings";
import { logActivity, logTransaction } from "./activity";
import { notify } from "./notify";
import { requiredForGiftingMissing, REQUIRED_FOR_GIFTING_LABELS, GIFT_STATUS_KEYS } from "./constants";
import { giftStatusId, giftProductName } from "./gift-status";
import type { SessionUser } from "./auth";
import { DealType, DeliverableStatus, GiftApprovalRole, CreditTransactionType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export interface GiftRequestResult {
  ok: boolean;
  needsException: boolean;
  message: string;
  gift?: { id: string };
}

export interface GiftOrderLineInput {
  productId?: string | null;
  productName?: string;
  productDescription?: string;
  unitCost?: number;
  quantity: number;
}

export interface GiftOrderDeliverableInput {
  title: string;
  type: string;
  dueDate: string;
}

export interface GiftOrderInput {
  engagementId: string;
  action?: "draft" | "submit";
  agreedBudget?: number | null;
  commissionRate?: number | null;
  couponCode?: string | null;
  shippingAddress?: string | null;
  lines: GiftOrderLineInput[];
  /** Agreement deliverables; materialized on the engagement when the order
   *  reaches a status flagged spawnDeliverables (tagged giftId). */
  deliverables: GiftOrderDeliverableInput[];
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

/** Deliverables that count as "required" toward a gift order, by deal type:
 *  Commission/Barter count only video-style deliverables; Fixed Budget counts all. */
function requiredGiftDeliverables<T extends { type: string; status: DeliverableStatus }>(
  dealType: DealType,
  deliverables: T[],
): T[] {
  if (dealType === DealType.COMMISSION || dealType === DealType.BARTER) {
    const wanted = ["video", "tiktok", "reel"];
    return deliverables.filter((d) => wanted.some((k) => d.type.toLowerCase().includes(k)));
  }
  return deliverables;
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

  const required = requiredGiftDeliverables(last.engagement.dealType, last.engagement.deliverables);
  if (required.length === 0) return { blockedBy: null };

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
 * Snapshot the catalog/custom picks into GiftLine data. Catalog lines read the
 * live unit cost (read-only to everyone; set by the Admin) exactly once, so
 * later catalog edits never change historical orders.
 */
async function resolveOrderLines(lines: GiftOrderLineInput[]): Promise<{
  lines: {
    productId: string | null;
    productName: string;
    productDescription?: string | null;
    unitCost: number;
    quantity: number;
    lineTotal: number;
  }[];
  orderTotal: number;
}> {
  if (lines.length === 0) return { lines: [], orderTotal: 0 };
  const resolved: Awaited<ReturnType<typeof resolveOrderLines>>["lines"] = [];
  let orderTotal = 0;

  for (const raw of lines) {
    const quantity = Math.max(1, Math.floor(Number(raw.quantity) || 1));
    let productId: string | null = null;
    let productName = "";
    let unitCost = 0;
    let productDescription: string | undefined;

    if (raw.productId) {
      const product = await prisma.product.findUnique({ where: { id: raw.productId } });
      if (!product) throw new Error("A product on this order no longer exists in the catalog.");
      productId = product.id;
      productName = product.name;
      unitCost = product.unitCost;
    } else {
      productName = String(raw.productName ?? "").trim();
      if (!productName) throw new Error("Every order line needs a product.");
      const cost = Number(raw.unitCost);
      if (!Number.isFinite(cost) || cost < 0) throw new Error(`"${productName}" needs a valid unit cost.`);
      unitCost = Math.round(cost * 100) / 100;
      productDescription = raw.productDescription?.trim() || undefined;
    }

    const lineTotal = Math.round(unitCost * quantity * 100) / 100;
    orderTotal = Math.round((orderTotal + lineTotal) * 100) / 100;
    resolved.push({ productId, productName, productDescription, unitCost, quantity, lineTotal });
  }

  return { lines: resolved, orderTotal };
}

/** The status a submitted order is created in: the first approval-bearing step,
 *  else the first spawnDeliverables step, else the first active step. */
async function submitTargetStatusId(): Promise<string> {
  const statuses = await prisma.giftStatus.findMany({ orderBy: { position: "asc" } });
  const active = statuses.filter((s) => !s.isDraft && !s.isRejection);
  const pending = active.find((s) => s.approvalRole !== GiftApprovalRole.NONE);
  if (pending) return pending.id;
  const spawn = active.find((s) => s.spawnDeliverables);
  if (spawn) return spawn.id;
  return active[0]?.id ?? (await giftStatusId(GIFT_STATUS_KEYS.PENDING_MANAGER));
}

/**
 * Create a Gift Order from the full order form. `action: "submit"` runs the
 * gating hard-stops and lands the order on the first approval step; a second
 * order in the same month is flagged isException. `action: "draft"` saves a
 * resumable draft (isDraft status) with no gating beyond team/ownership.
 */
export async function requestGift(
  user: SessionUser,
  input: GiftOrderInput,
): Promise<
  | { ok: true; status: string; message: string; giftId: string }
  | { ok: false; message: string; needsException?: boolean; blocked?: boolean; missingFields?: string[] }
> {
  const action = input.action === "draft" ? "draft" : "submit";

  const engagement = await prisma.engagement.findUnique({
    where: { id: input.engagementId },
    include: { creator: true, team: true },
  });
  if (!engagement) return { ok: false, message: "Engagement not found." };
  if (engagement.teamId !== user.teamId) {
    return { ok: false, message: "You can only request a gift for your team's engagements." };
  }

  const { agreedBudget, commissionRate, couponCode } = input;
  const deliverables = (input.deliverables ?? [])
    .filter((d) => d.title?.trim())
    .map((d) => ({ title: d.title.trim(), type: d.type?.trim() || "Video", dueDate: d.dueDate }));

  if (action === "submit") {
    const check = await canRequestGift(user, input.engagementId);
    if (check.ok === false && (check.blocked || !check.needsException)) {
      return { ok: false, message: check.message, needsException: check.needsException, blocked: check.blocked, missingFields: check.missingFields };
    }
    if (input.lines.length === 0) return { ok: false, message: "Add at least one product line." };
    if (!input.shippingAddress?.trim()) return { ok: false, message: "A shipping address is required." };
  }

  let isException = false;
  if (action === "submit") {
    const settings = await getSettings();
    isException =
      settings.giftMonthlyCapEnabled && (await countCreatorGiftsThisMonth(engagement.creatorId)) >= 1;
  }

  let orderLines: Awaited<ReturnType<typeof resolveOrderLines>>["lines"] = [];
  let orderTotal = 0;
  try {
    const resolved = await resolveOrderLines(input.lines);
    orderLines = resolved.lines;
    orderTotal = resolved.orderTotal;
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Invalid order lines." };
  }

  const statusId = action === "draft" ? await giftStatusId(GIFT_STATUS_KEYS.DRAFT) : await submitTargetStatusId();
  const name = giftProductName({
    lines: orderLines.map((l) => ({ productName: l.productName })),
    engagement: { creator: engagement.creator },
  });

  const gift = await prisma.$transaction(async (tx) => {
    const created = await tx.gift.create({
      data: {
        engagementId: input.engagementId,
        requestedById: user.id,
        isException,
        statusId,
        currency: engagement.currency,
        shippingAddress: input.shippingAddress?.trim() || undefined,
        agreedBudget: agreedBudget != null ? Math.round(Number(agreedBudget) * 100) / 100 : undefined,
        commissionRate: commissionRate != null ? Math.round(Number(commissionRate) * 100) / 100 : undefined,
        couponCode: action === "submit" ? couponCode?.trim() || undefined : undefined,
        orderTotal,
        agreement: deliverables.length > 0 ? deliverables : undefined,
        lines: { create: orderLines.map((l) => ({ ...l })) },
      },
    });
    await tx.activityLog.create({
      data: {
        creatorId: engagement.creatorId,
        kind: "SYSTEM",
        type: "GIFT_REQUESTED",
        summary:
          action === "draft"
            ? "Gift order saved as draft"
            : isException
              ? "Gift order requested with exception approval"
              : "Gift order submitted for approval",
        description: `${name} - order #${created.orderNumber}${isException ? " (exception: second gift this month)" : ""}`,
        authorId: user.id,
      },
    });
    return created;
  }, { timeout: 30000 });

  await logTransaction({
    userId: user.id,
    action: "gift.request",
    entityType: "Gift",
    entityId: gift.id,
    detail: `${action === "draft" ? "Drafted" : "Requested"} ${name} for ${engagement.creator.name} (order #${gift.orderNumber})`,
  });

  if (action === "submit") {
    const managers = await prisma.user.findMany({
      where: { teamId: user.teamId, role: { is: { slug: "team-manager" } }, archivedAt: null },
    });
    await Promise.all(
      managers.map((m) =>
        notify({
          userId: m.id,
          type: isException ? "GIFT_EXCEPTION_REQUESTED" : "GIFT_REQUESTED",
          title: isException ? "Gift exception approval requested" : "Gift order submitted for approval",
          body: `${name} for ${engagement.creator.name}`,
          link: "/gifting",
        }),
      ),
    );
  }

  if (action === "draft") {
    return { ok: true, status: GIFT_STATUS_KEYS.DRAFT, message: "Draft saved. You can continue it from the Gifting page.", giftId: gift.id };
  }
  return { ok: true, status: (await prisma.giftStatus.findUnique({ where: { id: gift.statusId } }))?.key ?? "", message: isException ? "Gift order sent for exception approval." : "Gift order submitted for approval.", giftId: gift.id };
}

/** The status row one position after `current`, or null when it is the last row. */
async function nextStatusAfter(current: { id: string }) {
  const all = await prisma.giftStatus.findMany({ orderBy: { position: "asc" } });
  const idx = all.findIndex((s) => s.id === current.id);
  if (idx < 0) return null;
  return all[idx + 1] ?? null;
}

/**
 * Phase 6 — post the single +credit for a delivered order to its requester's
 * CreditAccount, inside the caller's transaction. Idempotent per order: never
 * posts twice, guarded by an existing CREDIT row with the same Gift ref.
 */
async function postGiftCredit(
  tx: Prisma.TransactionClient,
  gift: {
    id: string;
    orderNumber: number;
    orderTotal: number;
    currency: string;
    requestedById: string;
    creatorId: string;
  },
): Promise<number> {
  const account = await tx.creditAccount.upsert({
    where: { userId: gift.requestedById },
    update: {},
    create: { userId: gift.requestedById },
  });
  const prior = await tx.creditTransaction.findFirst({
    where: { accountId: account.id, refType: "Gift", refId: gift.id, type: CreditTransactionType.CREDIT },
  });
  if (prior) return 0;
  await tx.creditTransaction.create({
    data: {
      accountId: account.id,
      amount: gift.orderTotal,
      type: CreditTransactionType.CREDIT,
      reason: `Gift order #${gift.orderNumber} delivered`,
      refType: "Gift",
      refId: gift.id,
    },
  });
  await tx.creditAccount.update({
    where: { id: account.id },
    data: { balance: { increment: gift.orderTotal } },
  });
  return 1;
}

/**
 * Phase 7 — post the single −debit when ALL required deliverables of a gift
 * order are Approved, into the caller's transaction (so it sees the just-made
 * approval). Idempotent per order: never posts twice, guarded by an existing
 * DEBIT row referencing any of the order's spawned deliverables. Called from
 * the deliverable flow only when credit is enabled; a workspace with credit
 * disabled never writes the ledger.
 */
export async function postGiftDebit(
  tx: Prisma.TransactionClient,
  giftId: string,
  actorId: string,
  creatorId: string,
): Promise<number> {
  const gift = await tx.gift.findUnique({ where: { id: giftId } });
  if (!gift || !gift.requestedById) return 0;
  const engagement = await tx.engagement.findUnique({
    where: { id: gift.engagementId },
    select: { dealType: true },
  });
  if (!engagement) return 0;

  const dels = await tx.deliverable.findMany({ where: { giftId: gift.id }, orderBy: { createdAt: "asc" } });
  if (dels.length === 0) return 0;
  const required = requiredGiftDeliverables(engagement.dealType, dels);
  if (required.length === 0 || required.some((d) => d.status !== DeliverableStatus.APPROVED)) return 0;

  const account = await tx.creditAccount.upsert({
    where: { userId: gift.requestedById },
    update: {},
    create: { userId: gift.requestedById },
  });
  const prior = await tx.creditTransaction.findFirst({
    where: {
      accountId: account.id,
      type: CreditTransactionType.DEBIT,
      refType: "Deliverable",
      refId: { in: dels.map((d) => d.id) },
    },
  });
  if (prior) return 0;

  const finalDeliverable = required[required.length - 1];
  await tx.creditTransaction.create({
    data: {
      accountId: account.id,
      amount: gift.orderTotal,
      type: CreditTransactionType.DEBIT,
      reason: `Deliverables approved for gift order #${gift.orderNumber}`,
      refType: "Deliverable",
      refId: finalDeliverable.id,
    },
  });
  await tx.creditAccount.update({
    where: { id: account.id },
    data: { balance: { decrement: gift.orderTotal } },
  });
  await tx.activityLog.create({
    data: {
      creatorId,
      kind: "SYSTEM",
      type: "GIFT_DEBIT_POSTED",
      summary: "Gift credit account settled",
      description: `Gift order #${gift.orderNumber} — all required deliverables received, ${gift.orderTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${gift.currency} debited`,
      authorId: actorId,
    },
  });
  return 1;
}

/** The status flagged isDraft (reject target), else null. */
async function draftStatusRow() {
  return prisma.giftStatus.findFirst({ where: { isDraft: true }, orderBy: { position: "asc" } });
}

/**
 * Phase 5 — enter a status with spawnDeliverables: materialize the order's
 * Agreement deliverables as real Deliverable records (tagged giftId, PENDING),
 * in the caller's transaction. Idempotent per order (never posts twice).
 */
async function spawnGiftDeliverables(
  tx: Prisma.TransactionClient,
  gift: {
    id: string;
    orderNumber: number;
    engagementId: string;
    creatorId: string;
    agreement: unknown;
  },
  actorId: string,
): Promise<number> {
  const agreement = Array.isArray(gift.agreement) ? (gift.agreement as { title?: string; type?: string; dueDate?: string }[]) : [];
  if (agreement.length === 0) return 0;
  const alreadySpawned = await tx.deliverable.count({ where: { giftId: gift.id } });
  if (alreadySpawned > 0) return 0;

  const rows = agreement
    .filter((d): d is { title: string; type?: string; dueDate: string } => !!d.title?.trim() && !!d.dueDate)
    .map((d) => ({
      engagementId: gift.engagementId,
      giftId: gift.id,
      title: d.title!.trim(),
      type: d.type?.trim() || "Video",
      dueDate: new Date(d.dueDate),
    }));
  if (rows.length === 0) return 0;

  const { count } = await tx.deliverable.createMany({ data: rows });
  if (count > 0) {
    await tx.activityLog.create({
      data: {
        creatorId: gift.creatorId,
        kind: "SYSTEM",
        type: "GIFT_APPROVED",
        summary: `Deliverables created for gift order #${gift.orderNumber}`,
        description: `${count} deliverable${count === 1 ? "" : "s"} added to the engagement from the order agreement`,
        authorId: actorId,
      },
    });
  }
  return count;
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

  const name = giftProductName(gift);

  if (gift.status.approvalRole === GiftApprovalRole.NONE) {
    return { ok: false, message: "Gift is not pending approval." };
  }
  if (gift.status.approvalRole === GiftApprovalRole.ADMIN && user.roleSlug !== "admin") {
    return { ok: false, message: "This step requires admin approval." };
  }

  if (decision === "approve") {
    const next = await nextStatusAfter(gift.status);
    if (!next) return { ok: false, message: "This order is already at its final status." };

    let spawned = 0;
    await prisma.$transaction(async (tx) => {
      await tx.gift.update({
        where: { id: giftId },
        data: { statusId: next.id, approvedById: user.id, approvedAt: new Date() },
      });
      spawned = await spawnGiftDeliverables(
        tx,
        {
          id: gift.id,
          orderNumber: gift.orderNumber,
          engagementId: gift.engagementId,
          creatorId: gift.engagement.creatorId,
          agreement: gift.agreement,
        },
        user.id,
      );
      await tx.activityLog.create({
        data: {
          creatorId: gift.engagement.creatorId,
          kind: "SYSTEM",
          type: "GIFT_APPROVED",
          summary: "Gift approved",
          description: name,
          authorId: user.id,
        },
      });
    }, { timeout: 30000 });

    await notify({
      userId: gift.requestedById,
      type: "GIFT_APPROVED",
      title: "Gift approved",
      body: `${name} for ${gift.engagement.creator.name}`,
      link: "/gifting",
    });
    await logTransaction({
      userId: user.id,
      action: "gift.approve",
      entityType: "Gift",
      entityId: giftId,
      detail: `Approved ${name} — moved to "${next.label}"`,
    });
    return { ok: true, message: spawned > 0 ? `Gift approved and ${spawned} deliverable(s) created.` : "Gift approved." };
  }

  // Reject: return the order to the configured Draft status (resumable).
  const draftRow = await draftStatusRow();
  if (!draftRow) return { ok: false, message: "No draft status is configured for this workspace." };

  await prisma.$transaction(async (tx) => {
    await tx.gift.update({
      where: { id: giftId },
      data: { statusId: draftRow.id, exceptionReason: reason ?? null },
    });
    await tx.activityLog.create({
      data: {
        creatorId: gift.engagement.creatorId,
        kind: "SYSTEM",
        type: "GIFT_REJECTED",
        summary: "Gift order sent back to draft",
        description: `${reason ? `Reason: ${reason} · ` : ""}${name}`,
        authorId: user.id,
      },
    });
  }, { timeout: 30000 });

  await notify({
    userId: gift.requestedById,
    type: "GIFT_REJECTED",
    title: "Gift order sent back to draft",
    body: reason ?? name,
    link: "/gifting",
  });
  await logTransaction({
    userId: user.id,
    action: "gift.reject",
    entityType: "Gift",
    entityId: giftId,
    detail: `Rejected ${name} — returned to "${draftRow.label}"`,
  });

  return { ok: true, message: "Gift order returned to draft." };
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
      requestedBy: true,
    },
  });
  if (!gift) return { ok: false, message: "Gift not found." };

  const name = giftProductName(gift);

  if (input.action === "dispatch") {
    if (!input.trackingNumber?.trim()) return { ok: false, message: "Tracking number required." };
    const next = await nextStatusAfter(gift.status);
    if (!next || !next.warehouseStep) return { ok: false, message: "This order is not ready to be dispatched." };
    await prisma.gift.update({
      where: { id: giftId },
      data: {
        statusId: next.id,
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
    // Deliver: from a dispatched warehouse step into the next position.
    if (!gift.status.warehouseStep || !gift.trackingNumber) {
      return { ok: false, message: "Order must be dispatched before marking delivered." };
    }
    const next = await nextStatusAfter(gift.status);
    if (!next) return { ok: false, message: "This order is already at its final status." };
    const settings = await getSettings();

    await prisma.$transaction(async (tx) => {
      await tx.gift.update({
        where: { id: giftId },
        data: { statusId: next.id, deliveredAt: new Date() },
      });
      await tx.activityLog.create({
        data: {
          creatorId: gift.engagement.creatorId,
          kind: "SYSTEM",
          type: "GIFT_DELIVERED",
          summary: "Gift delivered",
          description: name,
          authorId: user.id,
        },
      });
      // Entering a grantCredit status posts the +credit for this order (once).
      if (next.grantCredit && settings.creditEnabled) {
        const posted = await postGiftCredit(
          tx,
          {
            id: gift.id,
            orderNumber: gift.orderNumber,
            orderTotal: gift.orderTotal,
            currency: gift.currency,
            requestedById: gift.requestedById,
            creatorId: gift.engagement.creatorId,
          },
        );
        if (posted > 0) {
          await tx.activityLog.create({
            data: {
              creatorId: gift.engagement.creatorId,
              kind: "SYSTEM",
              type: "GIFT_CREDIT_POSTED",
              summary: "Credit posted to credit account",
              description: `Gift order #${gift.orderNumber} delivered — ${gift.orderTotal.toLocaleString()} ${gift.currency} credited to ${gift.requestedBy?.displayName ?? "requester"}`,
              authorId: user.id,
            },
          });
        }
      }
    }, { timeout: 30000 });
    const credited = next.grantCredit && settings.creditEnabled;
    await notify({
      userId: gift.requestedById,
      type: "GIFT_DELIVERED",
      title: "Gift delivered",
      body: credited
        ? `${name} — ${gift.orderTotal.toLocaleString()} ${gift.currency} credited to your credit account`
        : name,
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