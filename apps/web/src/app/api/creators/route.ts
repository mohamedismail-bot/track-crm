import { NextRequest, NextResponse } from "next/server";
import { createCreator, listCreators, parseCreatorListFilters } from "@/lib/creators";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import type { SessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;

  const filters = parseCreatorListFilters(req.nextUrl.searchParams);

  const items = await listCreators(session, filters);

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;

  if (!session.permissions.includes("creator.create")) {
    return jsonError("You do not have permission to create creators.", 403);
  }

  try {
    const body = await req.json();
    const result = await createCreator(body, session);
    return NextResponse.json(
      { id: result.creator.id, name: result.creator.name, pendingApproval: result.pendingApproval },
      { status: 201 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create creator";
    return jsonError(msg, 400);
  }
}