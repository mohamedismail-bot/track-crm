import { NextRequest, NextResponse } from "next/server";
import { requestGift, type GiftOrderInput } from "@/lib/gifts";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import type { SessionUser } from "@/lib/auth";

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v.trim() : undefined;
}

function num(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

export async function POST(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;

  if (!session.permissions.includes("gift.request")) {
    return jsonError("No permission to request gifts.", 403);
  }

  const body = await req.json();
  const engagementId = asString(body.engagementId);
  if (!engagementId) return jsonError("An engagement is required.", 400);

  const rawLines = Array.isArray(body.lines) ? body.lines : [];
  // Legacy single-product shape (productName only) → one custom line, qty 1.
  const lines =
    rawLines.length > 0
      ? rawLines
      : asString(body.productName)
        ? [{ productName: asString(body.productName), productDescription: asString(body.productDescription), unitCost: 0, quantity: 1 }]
        : [];

  if (lines.length === 0) return jsonError("Add at least one product line.", 400);

  const input: GiftOrderInput = {
    engagementId,
    action: body.action === "draft" ? "draft" : "submit",
    agreedBudget: num(body.agreedBudget),
    commissionRate: num(body.commissionRate),
    couponCode: asString(body.couponCode),
    shippingAddress: asString(body.shippingAddress),
    lines: lines.map((l: Record<string, unknown>) => ({
      productId: asString(l.productId),
      productName: asString(l.productName),
      productDescription: asString(l.productDescription),
      unitCost: num(l.unitCost),
      quantity: Math.max(1, Math.floor(Number(l.quantity) || 1)),
    })),
    deliverables: Array.isArray(body.deliverables)
      ? body.deliverables
          .filter((d: Record<string, unknown>) => asString(d.title))
          .map((d: Record<string, unknown>) => ({
            title: asString(d.title) ?? "",
            type: asString(d.type) ?? "Video",
            dueDate: asString(d.dueDate) ?? "",
          }))
      : [],
  };

  const result = await requestGift(session, input);
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.message,
        needsException: result.needsException,
        blocked: result.blocked,
        missingFields: result.missingFields,
      },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, message: result.message, status: result.status }, { status: 201 });
}