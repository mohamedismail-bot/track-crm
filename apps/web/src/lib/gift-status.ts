import "server-only";
import { prisma } from "./prisma";
import { DEFAULT_GIFT_STATUSES } from "./constants";

/** Seeds the day-one gift statuses when the table is empty (Admin owns it afterwards). */
export async function ensureGiftStatuses() {
  const count = await prisma.giftStatus.count();
  if (count === 0) {
    await prisma.giftStatus.createMany({ data: DEFAULT_GIFT_STATUSES });
  }
}

export async function listGiftStatuses() {
  await ensureGiftStatuses();
  return prisma.giftStatus.findMany({ orderBy: { position: "asc" } });
}

export async function giftStatusId(key: string): Promise<string> {
  await ensureGiftStatuses();
  const row = await prisma.giftStatus.findUnique({ where: { key } });
  if (!row) throw new Error(`Gift status "${key}" does not exist.`);
  return row.id;
}

/** The order's display name: first line snapshot, else a fallback label. */
export function giftProductName(gift: {
  lines?: { productName?: string | null }[];
  engagement?: { creator?: { name?: string | null } | null } | null;
}): string {
  if (gift.lines && gift.lines.length > 0 && gift.lines[0]?.productName) {
    return gift.lines[0].productName;
  }
  if (gift.engagement?.creator?.name) return `Gift for ${gift.engagement.creator.name}`;
  return "Gift order";
}