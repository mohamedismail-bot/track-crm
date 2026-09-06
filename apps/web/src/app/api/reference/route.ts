import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getReferencePayload, parseFieldOptions, serializeFieldOptions } from "@/lib/reference";
import { CUSTOM_FIELD_TYPES } from "@/lib/constants";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import type { SessionUser } from "@/lib/auth";

export async function GET() {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const payload = await getReferencePayload();
  return NextResponse.json(payload);
}

export async function POST(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;
  if (!session.permissions.includes("settings.manage")) {
    return jsonError("No permission to manage reference data.", 403);
  }

  try {
    const body = await req.json();
    const kind = body.kind as string;

    if (kind === "country") {
      const name = String(body.name ?? "").trim();
      const dialCode = String(body.dialCode ?? "").trim().replace(/^\+/, "");
      if (!name) return jsonError("Country name is required.", 400);
      if (!/^\d{1,4}$/.test(dialCode)) return jsonError("Dial code must be 1–4 digits (e.g. 20).", 400);
      try {
        const row = await prisma.country.create({
          data: { name, dialCode: `+${dialCode}` },
        });
        return NextResponse.json(row, { status: 201 });
      } catch (e) {
        if (String(e).includes("Unique constraint")) return jsonError("A country with that name already exists.", 409);
        throw e;
      }
    }

    if (kind === "city") {
      const name = String(body.name ?? "").trim();
      const countryId = String(body.countryId ?? "");
      if (!name) return jsonError("City name is required.", 400);
      const country = await prisma.country.findUnique({ where: { id: countryId } });
      if (!country) return jsonError("Country is required and must be valid.", 400);
      try {
        const row = await prisma.city.create({ data: { name, countryId } });
        return NextResponse.json(row, { status: 201 });
      } catch (e) {
        if (String(e).includes("Unique constraint"))
          return jsonError("A city with that name already exists in that country.", 409);
        throw e;
      }
    }

    if (kind === "creatorType") {
      const name = String(body.name ?? "").trim();
      if (!name) return jsonError("Creator type name is required.", 400);
      try {
        const row = await prisma.creatorType.create({ data: { name } });
        return NextResponse.json(row, { status: 201 });
      } catch (e) {
        if (String(e).includes("Unique constraint")) return jsonError("A creator type with that name already exists.", 409);
        throw e;
      }
    }

    if (kind === "field") {
      const label = String(body.label ?? "").trim();
      const type = String(body.type ?? "");
      if (!label) return jsonError("Field label is required.", 400);
      if (!(CUSTOM_FIELD_TYPES as readonly string[]).includes(type)) {
        return jsonError("Unknown field type.", 400);
      }
      const options = parseFieldOptions({ options: body.options ?? null });
      if (type === "select" && options.length === 0) {
        return jsonError("Single-select fields need at least one option.", 400);
      }
      const nextOrder = await prisma.creatorField.aggregate({ _max: { order: true } });
      const row = await prisma.creatorField.create({
        data: {
          label,
          type,
          required: body.required === true,
          order: (nextOrder._max.order ?? 0) + 1,
          options: serializeFieldOptions(options),
          isSystem: false,
        },
      });
      return NextResponse.json(row, { status: 201 });
    }

    return jsonError("Unknown reference data kind.", 400);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed to create reference data.", 400);
  }
}