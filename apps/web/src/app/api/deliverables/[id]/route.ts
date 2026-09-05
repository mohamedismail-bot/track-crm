import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reviewDeliverable, submitDeliverable } from "@/lib/deliverables";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import type { SessionUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;

  const { id } = await params;
  const body = await req.json();
  const action: string = body.action;

  const del = await prisma.deliverable.findUnique({ where: { id } });
  if (!del) return jsonError("Deliverable not found.", 404);

  if (action === "submit") {
    const result = await submitDeliverable(session, id, {
      postedUrl: body.postedUrl,
      postedDate: body.postedDate,
    });
    if (!result.ok) return jsonError(result.message, 400);
    return NextResponse.json({ ok: true, message: result.message });
  }

  if (action === "resubmit") {
    // Revision requested -> back to pending before a fresh submit.
    await prisma.deliverable.update({
      where: { id },
      data: { status: "PENDING", postedUrl: null, postedDate: null },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "approve" || action === "revision") {
    const result = await reviewDeliverable(session, id, action === "approve" ? "approve" : "revision", body.comment);
    if (!result.ok) return jsonError(result.message, 403);
    return NextResponse.json({ ok: true, message: result.message });
  }

  return jsonError("Unknown action.", 400);
}