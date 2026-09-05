import { NextRequest, NextResponse } from "next/server";
import { requestGift } from "@/lib/gifts";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import type { SessionUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;

  if (!session.permissions.includes("gift.request")) {
    return jsonError("No permission to request gifts.", 403);
  }

  const body = await req.json();
  const { engagementId, productName, productDescription } = body;
  if (!engagementId || !productName?.trim()) {
    return jsonError("Engagement and product name are required.", 400);
  }

  const result = await requestGift(session, engagementId, { productName, productDescription });
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.message,
        needsException: result.needsException,
        blocked: result.blocked,
      },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, message: result.message, status: result.status }, { status: 201 });
}