import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import { GIFT_STATUS_KEYS } from "@/lib/constants";
import { GiftApprovalRole } from "@prisma/client";

const PROTECTED_KEYS = new Set<string>(Object.values(GIFT_STATUS_KEYS));

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "status"
  );
}

export async function GET() {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (user.roleSlug !== "admin") return jsonError("Only the Admin can manage gift statuses.", 403);

  const statuses = await prisma.giftStatus.findMany({ orderBy: { position: "asc" } });
  return NextResponse.json({
    statuses: statuses.map((s) => ({
      id: s.id,
      key: s.key,
      label: s.label,
      position: s.position,
      approvalRole: s.approvalRole,
      isDraft: s.isDraft,
      isRejection: s.isRejection,
      grantCredit: s.grantCredit,
      spawnDeliverables: s.spawnDeliverables,
      warehouseStep: s.warehouseStep,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (user.roleSlug !== "admin") return jsonError("Only the Admin can manage gift statuses.", 403);

  const body = await req.json().catch(() => ({}));
  const label = String(body.label ?? "").trim();
  if (!label) return jsonError("A status label is required.", 400);

  let key = slugify(label);
  const collides = await prisma.giftStatus.findUnique({ where: { key } });
  if (collides) {
    key = `${key}-${Date.now().toString(36)}`;
  }

  const max = await prisma.giftStatus.aggregate({ _max: { position: true } });
  const created = await prisma.giftStatus.create({
    data: {
      key,
      label,
      position: (max._max.position ?? -1) + 1,
      approvalRole: GiftApprovalRole.NONE,
    },
  });

  return NextResponse.json(
    { id: created.id, key: created.key, label: created.label, position: created.position },
    { status: 201 },
  );
}

export async function PATCH(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (user.roleSlug !== "admin") return jsonError("Only the Admin can manage gift statuses.", 403);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");
  const id = String(body.id ?? "");
  if (!id) return jsonError("A status id is required.", 400);
  const status = await prisma.giftStatus.findUnique({ where: { id } });
  if (!status) return jsonError("Status not found.", 404);

  if (action === "rename") {
    const label = String(body.label ?? "").trim();
    if (!label) return jsonError("A status label is required.", 400);
    const updated = await prisma.giftStatus.update({ where: { id }, data: { label } });
    return NextResponse.json({ id: updated.id, label: updated.label });
  }

  if (action === "update") {
    const patch: {
      approvalRole?: GiftApprovalRole;
      isDraft?: boolean;
      isRejection?: boolean;
      grantCredit?: boolean;
      spawnDeliverables?: boolean;
      warehouseStep?: boolean;
    } = {};
    if (body.approvalRole !== undefined) {
      const role = String(body.approvalRole);
      if (!Object.values(GiftApprovalRole).includes(role as GiftApprovalRole)) {
        return jsonError("Invalid approval role.", 400);
      }
      patch.approvalRole = role as GiftApprovalRole;
    }
    for (const flag of ["isDraft", "isRejection", "grantCredit", "spawnDeliverables", "warehouseStep"] as const) {
      if (body[flag] !== undefined) patch[flag] = body[flag] === true;
    }
    const updated = await prisma.giftStatus.update({ where: { id }, data: patch });
    return NextResponse.json({ ok: true, id: updated.id });
  }

  if (action === "move") {
    const dir = Number(body.dir);
    if (dir !== 1 && dir !== -1) return jsonError("dir must be 1 or -1.", 400);
    const all = await prisma.giftStatus.findMany({ orderBy: { position: "asc" } });
    const idx = all.findIndex((s) => s.id === id);
    if (idx < 0) return jsonError("Status not found.", 400);
    const target = all[idx + dir];
    if (!target) return jsonError("Already at the edge of the list.", 400);
    const a = all[idx];
    const b = target;
    await prisma.$transaction([
      prisma.giftStatus.update({ where: { id: a.id }, data: { position: b.position } }),
      prisma.giftStatus.update({ where: { id: b.id }, data: { position: a.position } }),
    ]);
    return NextResponse.json({ ok: true });
  }

  return jsonError("Unknown action.", 400);
}

export async function DELETE(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (user.roleSlug !== "admin") return jsonError("Only the Admin can manage gift statuses.", 403);

  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  if (!id) return jsonError("A status id is required.", 400);

  const status = await prisma.giftStatus.findUnique({ where: { id } });
  if (!status) return jsonError("Status not found.", 404);
  if (PROTECTED_KEYS.has(status.key)) {
    return jsonError("This is a core gift status and cannot be deleted. You can rename or reconfigure it.", 400);
  }
  const inUse = await prisma.gift.count({ where: { statusId: id } });
  if (inUse > 0) {
    return jsonError("This status is used by existing gifts — move them to another status before deleting it.", 400);
  }
  await prisma.giftStatus.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}