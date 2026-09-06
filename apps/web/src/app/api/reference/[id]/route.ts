import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import { parseFieldOptions, serializeFieldOptions } from "@/lib/reference";
import { CUSTOM_FIELD_TYPES } from "@/lib/constants";

type Kind = "country" | "city" | "creatorType" | "field";

const KINDS: Kind[] = ["country", "city", "creatorType", "field"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (!user.permissions.includes("settings.manage")) {
    return jsonError("No permission to manage reference data.", 403);
  }

  const { id } = await params;
  const kind = (req.nextUrl.searchParams.get("kind") ?? "") as Kind;
  if (!KINDS.includes(kind)) return jsonError("Unknown reference data kind.", 400);

  const body = await req.json();

  try {
    if (kind === "country") {
      const name = body.name !== undefined ? String(body.name).trim() : undefined;
      const dialCode = body.dialCode !== undefined ? String(body.dialCode).trim().replace(/^\+/, "") : undefined;
      if (name !== undefined && !name) return jsonError("Country name is required.", 400);
      if (dialCode !== undefined && !/^\d{1,4}$/.test(dialCode)) {
        return jsonError("Dial code must be 1–4 digits (e.g. 20).", 400);
      }
      const row = await prisma.country.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(dialCode !== undefined ? { dialCode: `+${dialCode}` } : {}),
        },
      });
      return NextResponse.json(row);
    }

    if (kind === "city") {
      const name = body.name !== undefined ? String(body.name).trim() : undefined;
      const countryId = body.countryId !== undefined ? String(body.countryId) : undefined;
      if (name !== undefined && !name) return jsonError("City name is required.", 400);
      if (countryId !== undefined) {
        const country = await prisma.country.findUnique({ where: { id: countryId } });
        if (!country) return jsonError("Invalid country.", 400);
      }
      const row = await prisma.city.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(countryId !== undefined ? { countryId } : {}),
        },
      });
      return NextResponse.json(row);
    }

    if (kind === "creatorType") {
      const name = body.name !== undefined ? String(body.name).trim() : undefined;
      if (name !== undefined && !name) return jsonError("Creator type name is required.", 400);
      const row = await prisma.creatorType.update({ where: { id }, data: { ...(name !== undefined ? { name } : {}) } });
      return NextResponse.json(row);
    }

    if (kind === "field") {
      const row = await prisma.creatorField.findUnique({ where: { id } });
      if (!row) return jsonError("Field not found.", 404);

      const data: Record<string, unknown> = {};
      if (body.label !== undefined) {
        const label = String(body.label).trim();
        if (!label) return jsonError("Label cannot be empty.", 400);
        data.label = label;
      }
      if (body.type !== undefined) {
        const type = String(body.type);
        if (row.isSystem) return jsonError("Built-in field types cannot be changed.", 400);
        if (!(CUSTOM_FIELD_TYPES as readonly string[]).includes(type)) return jsonError("Unknown field type.", 400);
        data.type = type;
      }
      if (body.required !== undefined) {
        if (row.key === "gender") return jsonError("Gender is always required.", 400);
        data.required = body.required === true;
      }
      if (body.order !== undefined) {
        const n = Number(body.order);
        if (!Number.isFinite(n) || n < 0) return jsonError("Invalid order.", 400);
        data.order = Math.round(n);
      }
      if (body.options !== undefined) {
        const options = parseFieldOptions({ options: body.options ?? null });
        if ((String(data.type ?? row.type) === "select") && options.length === 0) {
          return jsonError("Single-select fields need at least one option.", 400);
        }
        data.options = serializeFieldOptions(options);
      }
      const updated = await prisma.creatorField.update({ where: { id }, data });
      return NextResponse.json(updated);
    }

    return jsonError("Unknown reference data kind.", 400);
  } catch (e) {
    if (String(e).includes("Unique constraint")) {
      return jsonError("A row with that name already exists.", 409);
    }
    return jsonError(e instanceof Error ? e.message : "Failed to update reference data.", 400);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (!user.permissions.includes("settings.manage")) {
    return jsonError("No permission to manage reference data.", 403);
  }

  const { id } = await params;
  const kind = (_req.nextUrl.searchParams.get("kind") ?? "") as Kind;
  if (!KINDS.includes(kind)) return jsonError("Unknown reference data kind.", 400);

  if (kind === "country") {
    const inUse = await prisma.creator.count({ where: { countryId: id, deletedAt: null } });
    if (inUse > 0) {
      return jsonError(
        `This country is used by ${inUse} creator${inUse > 1 ? "s" : ""}. Reassign them or delete the creators first.`,
        409,
      );
    }
    await prisma.country.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  if (kind === "city") {
    const inUse = await prisma.creator.count({ where: { cityId: id, deletedAt: null } });
    if (inUse > 0) {
      return jsonError(
        `This city is used by ${inUse} creator${inUse > 1 ? "s" : ""}. Reassign them or delete the creators first.`,
        409,
      );
    }
    await prisma.city.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  if (kind === "creatorType") {
    const inUse = await prisma.creator.count({ where: { creatorTypeId: id, deletedAt: null } });
    if (inUse > 0) {
      return jsonError(
        `This creator type is used by ${inUse} creator${inUse > 1 ? "s" : ""}. Reassign them or delete the creators first.`,
        409,
      );
    }
    await prisma.creatorType.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  if (kind === "field") {
    const row = await prisma.creatorField.findUnique({ where: { id } });
    if (!row) return jsonError("Field not found.", 404);
    if (row.isSystem) return jsonError("Built-in fields cannot be deleted.", 400);
    const inUse = await prisma.creator.count({
      where: { customFields: { path: [id], not: Prisma.DbNull } },
    });
    if (inUse > 0) {
      return jsonError("This field still has values on creator records. Remove the values first.", 409);
    }
    await prisma.creatorField.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  return jsonError("Unknown reference data kind.", 400);
}