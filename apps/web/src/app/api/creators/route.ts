import { NextRequest, NextResponse } from "next/server";
import { createCreator, findDuplicateProfile, listCreators } from "@/lib/creators";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import type { SessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;

  const params = req.nextUrl.searchParams;
  const items = await listCreators(session, {
    team: params.get("team") ?? "",
    stage: params.get("stage") ?? "",
    platform: params.get("platform") ?? "",
    niche: params.get("niche") ?? "",
    owner: params.get("owner") ?? "",
    q: params.get("q") ?? "",
    pool: params.get("pool") ?? "",
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
    for (const p of body.profiles ?? []) {
      const dup = await findDuplicateProfile(p.url, p.platform);
      if (dup) {
        const owner = dup.creator.ownerships[0];
        return NextResponse.json(
          {
            error: `This profile already exists - assigned to ${dup.creator.name}${
              owner ? ` from ${owner.team.name}` : ""
            }`,
          },
          { status: 409 },
        );
      }
    }
    const creator = await createCreator(body, session);
    return NextResponse.json({ id: creator.id, name: creator.name }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create creator";
    return jsonError(msg, 400);
  }
}