import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity, logTransaction } from "@/lib/activity";
import { notifyTeamManagerOfTeam } from "@/lib/notify";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import type { SessionUser } from "@/lib/auth";
import { DealType, Currency } from "@prisma/client";

export async function POST(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;

  if (!session.permissions.includes("engagement.create")) {
    return jsonError("No permission to create engagements.", 403);
  }

  try {
    const body = await req.json();
    const { creatorId, title, dealType, amount, couponCode, commissionPercent, currency, stageId } = body;

    if (!creatorId || !dealType || !currency || !stageId) {
      return jsonError("Missing required fields.", 400);
    }
    if (!Object.values(DealType).includes(dealType)) {
      return jsonError("Invalid deal type.", 400);
    }
    if (!Object.values(Currency).includes(currency)) {
      return jsonError("Invalid currency.", 400);
    }

    const creator = await prisma.creator.findUnique({
      where: { id: creatorId },
      include: { ownerships: { where: { teamId: session.teamId } } },
    });
    if (!creator) return jsonError("Creator not found.", 404);
    if (creator.ownerships.length === 0 && session.roleSlug !== "admin") {
      return jsonError("Your team does not work this creator.", 403);
    }

    const engagement = await prisma.engagement.create({
      data: {
        creatorId,
        teamId: session.teamId,
        title: String(title ?? "Collaboration").trim(),
        dealType,
        amount: amount != null ? Number(amount) : null,
        couponCode: couponCode || null,
        commissionPercent: commissionPercent != null ? Number(commissionPercent) : null,
        currency,
        stageId,
        createdById: session.id,
        deliverables: body.deliverables?.length
          ? {
              create: body.deliverables.map((d: { title?: string; type?: string; dueDate?: string }) => ({
                title: String(d.title ?? "").trim(),
                type: String(d.type ?? "Content"),
                dueDate: d.dueDate ? new Date(d.dueDate) : new Date(),
              })),
            }
          : undefined,
      },
    });

    await logActivity({
      creatorId,
      kind: "SYSTEM",
      type: "ENGAGEMENT_CREATED",
      summary: `Engagement created: ${engagement.title}`,
      description: `Deal type ${dealType}`,
      authorId: session.id,
    });
    await logTransaction({
      userId: session.id,
      action: "engagement.create",
      entityType: "Engagement",
      entityId: engagement.id,
      detail: `Created engagement ${engagement.title} for ${creator.name}`,
    });
    await notifyTeamManagerOfTeam(session.teamId, {
      type: "ACTIVITY_MENTION",
      title: "New engagement created",
      body: `${session.displayName} opened ${engagement.title} with ${creator.name}`,
      link: `/creators/${creatorId}`,
    });

    return NextResponse.json({ id: engagement.id }, { status: 201 });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed to create engagement", 400);
  }
}