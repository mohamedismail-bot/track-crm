import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkPlatformHandle } from "@/lib/creators";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import type { Platform } from "@prisma/client";

const PLATFORMS = ["INSTAGRAM", "TIKTOK", "YOUTUBE", "X", "SNAPCHAT", "FACEBOOK", "LINKEDIN", "TWITCH", "OTHER"];

export async function GET(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const platform = (req.nextUrl.searchParams.get("platform") ?? "").toUpperCase();
  const handle = (req.nextUrl.searchParams.get("handle") ?? "").trim().toLowerCase();
  const exclude = req.nextUrl.searchParams.get("exclude") ?? "";
  if (!platform || !handle) return jsonError("platform and handle are required.", 400);

  // Email / phone are one-per-creator values (unique columns).
  if (platform === "EMAIL") {
    const existing = await prisma.creator.findUnique({ where: { email: handle } });
    if (!existing || existing.deletedAt) return NextResponse.json({ exists: false });
    if (existing.deletedAt) return NextResponse.json({ exists: false });
    return NextResponse.json({
      exists: true,
      creatorId: existing.id,
      name: existing.name,
      isSelf: existing.id === exclude,
    });
  }
  if (platform === "PHONE") {
    const normalized = handle.startsWith("+") ? handle : `+${handle.replace(/^\+/, "")}`;
    const { findDuplicatePhone } = await import("@/lib/creators");
    const existing = await findDuplicatePhone(normalized, exclude || undefined);
    if (!existing) return NextResponse.json({ exists: false });
    return NextResponse.json({
      exists: true,
      creatorId: existing.id,
      name: existing.name,
      isSelf: existing.id === exclude,
    });
  }

  if (!PLATFORMS.includes(platform)) {
    return jsonError("Unknown platform.", 400);
  }

  const dup = await checkPlatformHandle(platform as Platform, handle, exclude || undefined);
  if (!dup) return NextResponse.json({ exists: false });

  const owner = dup.creator.ownerships[0];
  return NextResponse.json({
    exists: true,
    creatorId: dup.creator.id,
    name: dup.creator.name,
    isSelf: dup.creator.id === exclude,
    ownerName: owner?.user.displayName ?? null,
    teamName: owner?.team.name ?? null,
    handle: dup.handle,
    url: dup.url,
  });
}