import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { addDays, isAfter } from "date-fns";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json([]);

  const settings = await getSettings();
  const sameTeamThreshold = addDays(new Date(), -settings.inactivitySameTeamDays);
  const companyThreshold = addDays(new Date(), -settings.inactivityCompanyDays);

  const creators = await prisma.creator.findMany({
    where: {
      deletedAt: null,
      OR: [
        { name: { contains: q } },
        { profiles: { some: { handle: { contains: q } } } },
        { profiles: { some: { normalizedHandle: { contains: q.toLowerCase() } } } },
      ],
    },
    include: {
      primaryProfile: true,
      profiles: true,
      ownerships: { include: { user: true, team: true } },
      engagements: { include: { stage: true }, take: 1 },
      activityLogs: { orderBy: { loggedAt: "desc" }, take: 1 },
    },
    take: 8,
  });

  const results = creators.map((c) => {
    const ownsHere = c.ownerships.some((o) => o.userId === user.id);
    const sameTeam = c.ownerships.some((o) => o.teamId === user.teamId && o.userId !== user.id);
    const otherTeam = c.ownerships.some((o) => o.teamId !== user.teamId);
    const anyTeam = c.ownerships.some((o) => o.teamId === user.teamId);
    const lastActivity = c.activityLogs[0]?.loggedAt;

    let relationship: "owned" | "same_team" | "other_team" | "available" | "none" = "none";
    if (ownsHere) relationship = "owned";
    else if (sameTeam) relationship = "same_team";
    else if (otherTeam) relationship = "other_team";
    else if (anyTeam) relationship = "same_team";
    else if (lastActivity) relationship = "available";
    else relationship = "available";

    const inSameTeamPool = !!lastActivity &&
      isAfter(lastActivity, sameTeamThreshold) &&
      !isAfter(lastActivity, companyThreshold);
    const inCompanyPool = !!lastActivity && !isAfter(lastActivity, companyThreshold);

    return {
      id: c.id,
      name: c.name,
      avatarUrl: c.avatarUrl,
      platform: c.primaryProfile?.platform ?? c.profiles[0]?.platform ?? null,
      handle: c.primaryProfile?.handle ?? c.profiles[0]?.handle ?? null,
      followers: c.followers,
      stageName: c.engagements[0]?.stage.name ?? null,
      ownerName: c.ownerships[0]?.user.displayName ?? null,
      teamName: c.ownerships[0]?.team.name ?? null,
      relationship,
      inSameTeamPool,
      inCompanyPool,
    };
  });

  return NextResponse.json(results);
}