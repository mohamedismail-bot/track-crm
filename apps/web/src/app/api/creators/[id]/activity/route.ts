import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity, logTransaction } from "@/lib/activity";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import { storeUpload } from "@/lib/blob";
import type { SessionUser } from "@/lib/auth";
import type { ActivityType } from "@prisma/client";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;

  const { id } = await params;
  const creator = await prisma.creator.findUnique({
    where: { id },
    include: { ownerships: { where: { teamId: session.teamId } } },
  });
  if (!creator) return jsonError("Creator not found.", 404);
  if (!session.permissions.includes("activity.log")) {
    return jsonError("No permission to log activity.", 403);
  }
  if (creator.ownerships.length === 0 && session.roleSlug !== "admin") {
    return jsonError("You can only log activity on creators you have access to.", 403);
  }

  const contentType = req.headers.get("content-type") ?? "";

  let type: string;
  let summary: string;
  let description: string | null;
  let loggedAt: Date;
  let attachment: { filename: string; mimeType: string; size: number; path: string } | undefined;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    type = String(form.get("type") ?? "NOTE");
    summary = String(form.get("summary") ?? "").trim();
    description = (form.get("description") as string | null) || null;
    const loggedAtRaw = form.get("loggedAt");
    loggedAt = loggedAtRaw ? new Date(String(loggedAtRaw)) : new Date();
    const file = form.get("file") as File | null;
    if (file && file.size > 0) {
      if (file.size > 10 * 1024 * 1024) {
        return jsonError("Attachments must be smaller than 10 MB.", 400);
      }
      const stored = await storeUpload(file, "attachments");
      attachment = {
        filename: stored.filename,
        mimeType: stored.mimeType,
        size: stored.size,
        path: stored.url,
      };
    }
  } else {
    const body = await req.json();
    type = String(body.type ?? "NOTE");
    summary = String(body.summary ?? "").trim();
    description = body.description ?? null;
    loggedAt = body.loggedAt ? new Date(body.loggedAt) : new Date();
  }

  if (!summary) return jsonError("A summary is required.", 400);
  const validTypes = ["CALL", "DM", "EMAIL", "MEETING", "NOTE"];
  if (!validTypes.includes(type)) return jsonError("Invalid activity type.", 400);

  const entry = await logActivity({
    creatorId: id,
    kind: "MANUAL",
    type: type as ActivityType,
    summary,
    description: description ?? undefined,
    authorId: session.id,
    loggedAt,
    attachments: attachment ? [attachment] : undefined,
  });
  await logTransaction({
    userId: session.id,
    action: "activity.log",
    entityType: "Creator",
    entityId: id,
    detail: `${type}: ${summary}`,
  });

  return NextResponse.json({ id: entry.id }, { status: 201 });
}