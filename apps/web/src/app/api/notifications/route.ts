import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import type { SessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;

  const unreadOnly = req.nextUrl.searchParams.get("unread") === "true";
  const notifications = await prisma.notification.findMany({
    where: { userId: session.id, ...(unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(notifications);
}

export async function POST(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;

  const body = await req.json();
  if (body.all === true) {
    await prisma.notification.updateMany({
      where: { userId: session.id, readAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }
  const id = body.id;
  if (!id) return jsonError("Missing notification id.", 400);
  await prisma.notification.update({
    where: { id, userId: session.id },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}