import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import type { SessionUser } from "@/lib/auth";

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "category"
  );
}

function parseCost(raw: unknown): number | null {
  if (raw === "" || raw === null || raw === undefined) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export async function GET() {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const categories = await prisma.productCategory.findMany({
    orderBy: { position: "asc" },
    include: { products: { orderBy: { name: "asc" } } },
  });
  return NextResponse.json({
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      position: c.position,
      products: c.products.map((p) => ({
        id: p.id,
        name: p.name,
        categoryId: p.categoryId,
        unitCost: p.unitCost,
        active: p.active,
      })),
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;
  if (!session.permissions.includes("settings.manage")) {
    return jsonError("Only the Admin can manage the product catalog.", 403);
  }

  const body = await req.json().catch(() => ({}));
  const kind = String(body.kind ?? "");

  if (kind === "category") {
    const name = String(body.name ?? "").trim();
    if (!name) return jsonError("A category name is required.", 400);
    const max = await prisma.productCategory.aggregate({ _max: { position: true } });
    let slug = slugify(name);
    const collides = await prisma.productCategory.findUnique({ where: { slug } });
    if (collides) slug = `${slug}-${Date.now().toString(36)}`;
    const row = await prisma.productCategory.create({
      data: { name, slug, position: (max._max.position ?? -1) + 1 },
    });
    return NextResponse.json(row, { status: 201 });
  }

  if (kind === "product") {
    const name = String(body.name ?? "").trim();
    const categoryId = String(body.categoryId ?? "");
    const unitCost = parseCost(body.unitCost);
    if (!name) return jsonError("A product name is required.", 400);
    const category = await prisma.productCategory.findUnique({ where: { id: categoryId } });
    if (!category) return jsonError("A valid category is required.", 400);
    if (unitCost === null) return jsonError("Unit cost must be a non-negative number.", 400);
    const row = await prisma.product.create({
      data: { name, categoryId, unitCost, active: body.active === false ? false : true },
    });
    return NextResponse.json(row, { status: 201 });
  }

  return jsonError("Unknown catalog kind.", 400);
}

type Kind = "category" | "product";

export async function PATCH(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;
  if (!session.permissions.includes("settings.manage")) {
    return jsonError("Only the Admin can manage the product catalog.", 403);
  }
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const kind = (req.nextUrl.searchParams.get("kind") ?? "") as Kind;
  if (kind !== "category" && kind !== "product") return jsonError("Unknown catalog kind.", 400);
  if (!id) return jsonError("A row id is required.", 400);
  const body = await req.json().catch(() => ({}));

  try {
    if (kind === "category") {
      if (body.name !== undefined) {
        const name = String(body.name).trim();
        if (!name) return jsonError("A category name is required.", 400);
        const updated = await prisma.productCategory.update({ where: { id }, data: { name } });
        return NextResponse.json(updated);
      }
      if (body.dir !== undefined) {
        const dir = Number(body.dir);
        if (dir !== 1 && dir !== -1) return jsonError("dir must be 1 or -1.", 400);
        const all = await prisma.productCategory.findMany({ orderBy: { position: "asc" } });
        const idx = all.findIndex((c) => c.id === id);
        if (idx < 0) return jsonError("Category not found.", 400);
        const target = all[idx + dir];
        if (!target) return jsonError("Already at the edge.", 400);
        const a = all[idx];
        const b = target;
        await prisma.$transaction([
          prisma.productCategory.update({ where: { id: a.id }, data: { position: b.position } }),
          prisma.productCategory.update({ where: { id: b.id }, data: { position: a.position } }),
        ]);
        return NextResponse.json({ ok: true });
      }
      return jsonError("Nothing to update.", 400);
    }

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return jsonError("Product not found.", 404);
    const data: { name?: string; categoryId?: string; unitCost?: number; active?: boolean } = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return jsonError("A product name is required.", 400);
      data.name = name;
    }
    if (body.categoryId !== undefined) {
      const category = await prisma.productCategory.findUnique({ where: { id: String(body.categoryId) } });
      if (!category) return jsonError("A valid category is required.", 400);
      data.categoryId = category.id;
    }
    if (body.unitCost !== undefined) {
      const cost = parseCost(body.unitCost);
      if (cost === null) return jsonError("Unit cost must be a non-negative number.", 400);
      data.unitCost = cost;
    }
    if (body.active !== undefined) data.active = body.active === true;
    const updated = await prisma.product.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (e) {
    if (String(e).includes("Unique constraint")) return jsonError("That name already exists.", 409);
    return jsonError(e instanceof Error ? e.message : "Failed to update catalog.", 400);
  }
}

export async function DELETE(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;
  if (!session.permissions.includes("settings.manage")) {
    return jsonError("Only the Admin can manage the product catalog.", 403);
  }
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const kind = (req.nextUrl.searchParams.get("kind") ?? "") as Kind;
  if (!id) return jsonError("A row id is required.", 400);

  if (kind === "category") {
    const count = await prisma.product.count({ where: { categoryId: id } });
    if (count > 0) {
      return jsonError(
        `This category still has ${count} product${count > 1 ? "s" : ""}. Move or delete them first.`,
        409,
      );
    }
    await prisma.productCategory.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  if (kind === "product") {
    const usedBy = await prisma.giftLine.count({ where: { productId: id } });
    if (usedBy > 0) {
      return jsonError("This product is used in historical gift orders and cannot be deleted.", 409);
    }
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  return jsonError("Unknown catalog kind.", 400);
}