import "server-only";
import { prisma } from "./prisma";
import { ActivityKind, ActivityType } from "@prisma/client";

export async function logActivity(input: {
  creatorId: string;
  kind: ActivityKind;
  type: ActivityType;
  summary: string;
  description?: string;
  authorId?: string;
  loggedAt?: Date;
  attachments?: { filename: string; mimeType: string; size: number; path: string }[];
}) {
  return prisma.activityLog.create({
    data: {
      creatorId: input.creatorId,
      kind: input.kind,
      type: input.type,
      summary: input.summary,
      description: input.description,
      authorId: input.authorId,
      loggedAt: input.loggedAt ?? new Date(),
      attachments: input.attachments?.length
        ? { create: input.attachments }
        : undefined,
    },
  });
}

export async function logTransaction(input: {
  userId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  detail?: string;
}) {
  return prisma.transactionLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      detail: input.detail,
    },
  });
}

export async function logAutoActivity(input: {
  creatorId: string;
  type: ActivityType;
  summary: string;
  description?: string;
}) {
  return logActivity({
    creatorId: input.creatorId,
    kind: "SYSTEM",
    type: input.type,
    summary: input.summary,
    description: input.description,
  });
}