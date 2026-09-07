import { NextRequest, NextResponse } from "next/server";
import { createCreator, listCreators } from "@/lib/creators";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import type { SessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;

  const params = req.nextUrl.searchParams;
  const custom: Record<string, string> = {};
  for (const key of params.keys()) {
    if (key.startsWith("cf_")) custom[key.slice(3)] = params.get(key) ?? "";
  }

  const shopifyParam = params.get("shopify");
  const shopify = shopifyParam === "yes" || shopifyParam === "no" ? shopifyParam : undefined;

  const items = await listCreators(session, {
    team: params.get("team") ?? "",
    stage: params.get("stage") ?? "",
    platform: params.get("platform") ?? "",
    niche: params.get("niche") ?? "",
    owner: params.get("owner") ?? "",
    q: params.get("q") ?? "",
    pool: params.get("pool") ?? "",
    overdue: params.get("overdue") === "1",
    upcoming: params.get("upcoming") === "1",
    pending: params.get("pending") === "1",
    incomplete: params.get("incomplete") === "1",
    gender: params.get("gender") ?? "",
    shopify,
    country: params.get("country") ?? "",
    city: params.get("city") ?? "",
    creatorType: params.get("creatorType") ?? "",
    custom,
  });

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