import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveGiftRequest, warehouseUpdateGift } from "@/lib/gifts";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import type { SessionUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;

  const { id } = await params;
  const body = await req.json();
  const action: string = body.action;

  if (action === "approve" || action === "reject") {
    const result = await resolveGiftRequest(session, id, action, body.reason);
    if (!result.ok) return jsonError(result.message, 403);
    return NextResponse.json({ ok: true, message: result.message });
  }

  if (action === "dispatch") {
    const result = await warehouseUpdateGift(session, id, {
      action: "dispatch",
      trackingNumber: body.trackingNumber,
      carrier: body.carrier,
    });
    if (!result.ok) return jsonError(result.message, 400);
    return NextResponse.json({ ok: true, message: result.message });
  }

  if (action === "deliver") {
    const result = await warehouseUpdateGift(session, id, { action: "deliver" });
    if (!result.ok) return jsonError(result.message, 400);
    return NextResponse.json({ ok: true, message: result.message });
  }

  return jsonError("Unknown action.", 400);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;
  const { id } = await params;
  const gift = await prisma.gift.findUnique({
    where: { id },
    include: { engagement: { include: { creator: true, team: true } }, requestedBy: true, approvedBy: true },
  });
  if (!gift) return jsonError("Gift not found.", 404);
  // Warehouse/fullfillment users serve all teams; everyone else only their own team.
  const isWarehouse = session.permissions.includes("gift.fulfill");
  if (!isWarehouse && session.roleSlug !== "admin" && gift.engagement.teamId !== session.teamId) {
    return jsonError("Gift not found.", 404);
  }
  return NextResponse.json(gift);
}