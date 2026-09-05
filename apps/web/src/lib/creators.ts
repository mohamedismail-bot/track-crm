import "server-only";
import { prisma } from "./prisma";
import { detectPlatformFromUrl, normalizeHandleFromUrl } from "./constants";
import type { Platform, Prisma } from "@prisma/client";
import { logActivity, logTransaction } from "./activity";
import type { SessionUser } from "./auth";

export interface NewProfileInput {
  url: string;
  platform?: string;
  isPrimary?: boolean;
}

export interface CreateCreatorInput {
  name: string;
  email?: string;
  phone?: string;
  niche?: string;
  city?: string;
  country?: string;
  creatorType?: string;
  followers?: string | number;
  engagementRate?: string | number;
  notes?: string;
  avatarUrl?: string;
  profiles: NewProfileInput[];
}

export function parseNumeric(value: string | number | undefined): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Validate that a profile URL does not already belong to another creator. */
export async function findDuplicateProfile(url: string, platform?: string, excludeCreatorId?: string) {
  const handle = normalizeHandleFromUrl(url);
  const detected: Platform = platform ? (platform as Platform) : detectPlatformFromUrl(url);
  return prisma.platformProfile.findFirst({
    where: {
      platform: detected,
      normalizedHandle: handle,
      creator: { isNot: excludeCreatorId ? { id: excludeCreatorId } : undefined },
    },
    include: { creator: { include: { ownerships: { include: { team: true }, take: 1 } } } },
  });
}

export async function createCreator(input: CreateCreatorInput, user: SessionUser) {
  if (!input.name.trim()) throw new Error("Creator name is required.");
  if (input.profiles.length === 0) throw new Error("At least one platform profile is required.");

  // Validate no duplicate handles in input
  const seen = new Set<string>();
  for (const p of input.profiles) {
    const handle = normalizeHandleFromUrl(p.url);
    const key = `${p.platform ?? detectPlatformFromUrl(p.url)}:${handle}`;
    if (seen.has(key)) {
      throw new Error(`Duplicate platform profile: ${p.url}`);
    }
    seen.add(key);
  }

  // The first profile is primary unless one is marked primary.
  const profiles = input.profiles.map((p, i) => ({
    url: p.url,
    platform: p.platform ?? detectPlatformFromUrl(p.url),
    isPrimary: p.isPrimary ?? i === 0,
  }));

  const created = await prisma.$transaction(async (tx) => {
    const creator = await tx.creator.create({
      data: {
        name: input.name.trim(),
        email: input.email || null,
        phone: input.phone || null,
        niche: input.niche || null,
        city: input.city || null,
        country: input.country || null,
        creatorType: input.creatorType || null,
        followers: parseNumeric(input.followers),
        engagementRate: parseNumeric(input.engagementRate),
        notes: input.notes || null,
        avatarUrl: input.avatarUrl || null,
        createdById: user.id,
        ownerships: {
          create: { userId: user.id, teamId: user.teamId },
        },
      },
    });

    const createdProfiles: { url: string; platform: string; isPrimary: boolean; handle: string; normalizedHandle: string }[] = [];
    for (const p of profiles) {
      const handle = normalizeHandleFromUrl(p.url);
      createdProfiles.push({
        ...p,
        handle,
        normalizedHandle: handle,
        url: p.url.trim(),
      });
    }
    await tx.platformProfile.createMany({
      data: createdProfiles.map((p) => ({
        creatorId: creator.id,
        url: p.url,
        platform: p.platform as Platform,
        isPrimary: p.isPrimary,
        handle: p.handle,
        normalizedHandle: p.normalizedHandle,
      })),
    });
    const primary = await tx.platformProfile.findFirst({
      where: { creatorId: creator.id, isPrimary: true },
    });
    if (primary) {
      await tx.creator.update({ where: { id: creator.id }, data: { primaryProfileId: primary.id } });
    }
    return { creator, profiles: createdProfiles };
  });

  const profileSummary = created.profiles.map((p) => `@${p.handle}`).join(", ");
  await logActivity({
    creatorId: created.creator.id,
    kind: "SYSTEM",
    type: "CREATOR_CREATED",
    summary: "Creator created and assigned to me",
    description: `Platform profiles: ${profileSummary}`,
    authorId: user.id,
  });
  await logTransaction({
    userId: user.id,
    action: "creator.create",
    entityType: "Creator",
    entityId: created.creator.id,
    detail: `Created ${created.creator.name}`,
  });

  return created.creator;
}

export interface CreatorListFilters {
  team?: string;
  stage?: string;
  platform?: string;
  niche?: string;
  owner?: string;
  q?: string;
  pool?: string;
}

export async function listCreators(user: SessionUser, filters: CreatorListFilters = {}) {
  const { addDays, isBefore } = await import("date-fns");
  const now = new Date();
  const s = await import("./settings").then((m) => m.getSettings());

  const where: Prisma.CreatorWhereInput = {
    deletedAt: null,
    ...(filters.q ? { name: { contains: filters.q } } : {}),
    ...(filters.niche ? { niche: { contains: filters.niche } } : {}),
    ...(filters.platform ? { profiles: { some: { platform: filters.platform as Platform } } } : {}),
    ...(filters.owner ? { ownerships: { some: { userId: filters.owner } } } : {}),
    ...(filters.stage ? { engagements: { some: { stageId: filters.stage } } } : {}),
  };

  const creators = await prisma.creator.findMany({
    where,
    include: {
      primaryProfile: true,
      profiles: true,
      ownerships: { include: { user: true, team: true } },
      engagements: { include: { stage: true, deliverables: true }, orderBy: { createdAt: "desc" } },
      activityLogs: { orderBy: { loggedAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  return creators
    .filter((c) => {
      if (filters.team === "unassigned") return c.ownerships.length === 0;
      if (!filters.team) return true;
      return c.ownerships.some((o) => o.teamId === filters.team);
    })
    .map((c) => {
      const owns = c.ownerships.some((o) => o.userId === user.id);
      const sameTeamOther = c.ownerships.some(
        (o) => o.teamId === user.teamId && o.userId !== user.id,
      );
      const unassigned = c.ownerships.length === 0;

      const nextDeliverable = c.engagements
        .flatMap((e) => e.deliverables)
        .filter((d) => d.status !== "APPROVED")
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];

      const lastActivity = c.activityLogs[0]?.loggedAt;

      let poolStatus: "none" | "same_team" | "company" = "none";
      if (!owns && !sameTeamOther && lastActivity && c.ownerships.length > 0) {
        if (isBefore(lastActivity, addDays(now, -s.inactivityCompanyDays))) poolStatus = "company";
        else if (isBefore(lastActivity, addDays(now, -s.inactivitySameTeamDays))) poolStatus = "same_team";
      }

      const latestEngagement = [...c.engagements].sort(
        (a, b) => (b.completedAt?.getTime() ?? b.createdAt.getTime()) - (a.completedAt?.getTime() ?? a.createdAt.getTime()),
      )[0];
      const currentStage = latestEngagement?.stage ?? null;
      const isOtherTeam =
        !owns && !sameTeamOther && !unassigned && c.ownerships.some((o) => o.teamId !== user.teamId);

      return {
        id: c.id,
        name: c.name,
        niche: c.niche,
        avatarUrl: c.avatarUrl,
        followers: c.followers,
        engagementRate: c.engagementRate,
        platform: c.primaryProfile?.platform ?? c.profiles[0]?.platform ?? null,
        handle: c.primaryProfile?.handle ?? c.profiles[0]?.handle ?? null,
        profileUrl: c.primaryProfile?.url ?? c.profiles[0]?.url ?? null,
        owners: c.ownerships.map((o) => ({
          id: o.userId,
          name: o.user.displayName,
          teamId: o.teamId,
          teamName: o.team.name,
        })),
        teams: [...new Map(c.ownerships.map((o) => [o.teamId, { id: o.teamId, name: o.team.name }])).values()],
        stage: currentStage ? { id: currentStage.id, name: currentStage.name } : null,
        currentEngagementId: latestEngagement?.id ?? null,
        completedAt: c.engagements.find((e) => e.completedAt)?.completedAt ?? null,
        nextDeliverable: isOtherTeam
          ? null
          : nextDeliverable
            ? { id: nextDeliverable.id, title: nextDeliverable.title, dueDate: nextDeliverable.dueDate }
            : null,
        lastActivityAt: lastActivity ?? null,
        relationship: owns
          ? "owned"
          : unassigned
            ? "available"
            : sameTeamOther
              ? "same_team"
              : c.ownerships.length
                ? "other_team"
                : "none",
        poolStatus,
        createdAt: c.createdAt,
      };
    })
    .filter((i) => {
      if (filters.pool === "same_team") return i.poolStatus === "same_team";
      if (filters.pool === "company") return i.poolStatus === "company";
      return true;
    });
}

export async function listTeamPipeline(user: SessionUser) {
  const configs = await prisma.pipelineConfig.findMany({
    where: { teamId: user.teamId },
    include: { stage: true },
    orderBy: { order: "asc" },
  });
  return configs.map((c) => ({
    id: c.stage.id,
    name: c.stage.name,
    order: c.order,
    isCompleted: c.isCompleted,
  }));
}

export async function listTeams() {
  return prisma.team.findMany({ orderBy: { name: "asc" } });
}

export async function listUsersForFilter() {
  return prisma.user.findMany({ select: { id: true, displayName: true, teamId: true } });
}

export function canMoveStage(user: SessionUser, owns: boolean, isTeamManager: boolean): boolean {
  if (isTeamManager) return user.permissions.includes("creator.moveStage");
  return owns && user.permissions.includes("creator.moveStage");
}