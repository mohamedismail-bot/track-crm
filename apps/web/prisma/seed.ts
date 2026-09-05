import { PrismaClient, ActivityKind, ActivityType } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_SETTINGS,
} from "../src/lib/constants";

const prisma = new PrismaClient();

async function main() {
  // Permissions
  for (const action of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { action },
      update: {},
      create: { action },
    });
  }
  console.log("Permissions seeded:", ALL_PERMISSIONS.length);

  // Roles
  const roleDefs: { slug: string; name: string; immutable?: boolean }[] = [
    { slug: "admin", name: "Admin", immutable: true },
    { slug: "team-manager", name: "Team Manager" },
    { slug: "team-leader", name: "Team Leader" },
    { slug: "warehouse", name: "Warehouse" },
  ];
  const roleIds: Record<string, string> = {};
  for (const def of roleDefs) {
    const perms = DEFAULT_ROLE_PERMISSIONS[def.slug] ?? [];
    const role = await prisma.role.upsert({
      where: { slug: def.slug },
      update: { immutable: def.immutable ?? false },
      create: { slug: def.slug, name: def.name, immutable: def.immutable ?? false },
    });
    await prisma.role.update({
      where: { id: role.id },
      data: {
        permissions: {
          set: await prisma.permission.findMany({
            where: { action: { in: perms } },
            select: { id: true },
          }),
        },
      },
    });
    roleIds[def.slug] = role.id;
  }
  console.log("Roles seeded");

  // Teams
  const teamDefs = [
    { name: "Budget Team", slug: "budget" },
    { name: "Commission Team", slug: "commission" },
  ];
  const teamIds: Record<string, string> = {};
  for (const def of teamDefs) {
    const team = await prisma.team.upsert({
      where: { slug: def.slug },
      update: {},
      create: { name: def.name, slug: def.slug },
    });
    teamIds[def.slug] = team.id;
  }
  console.log("Teams seeded");

  // Admin user
  const adminEmail = "admin@trackcrm.com";
  const adminPassword = "Admin@1234";
  const existingAdmin = await prisma.user.findFirst({
    where: { email: adminEmail },
  });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        displayName: "System Admin",
        passwordHash: await bcrypt.hash(adminPassword, 10),
        roleId: roleIds["admin"],
        teamId: teamIds["budget"],
      },
    });
    console.log("Admin user created: admin@trackcrm.com / " + adminPassword);
  } else {
    console.log("Admin user already exists");
  }

  // Sample team users (team leader + manager + warehouse)
  const sampleUsers: {
    email: string;
    name: string;
    roleSlug: string;
    teamSlug: string;
    password: string;
  }[] = [
    { email: "leader@budget.com", name: "Lina Haddad", roleSlug: "team-leader", teamSlug: "budget", password: "Password1" },
    { email: "manager@budget.com", name: "Omar El-Rashidi", roleSlug: "team-manager", teamSlug: "budget", password: "Password1" },
    { email: "leader@commission.com", name: "Maya Nour", roleSlug: "team-leader", teamSlug: "commission", password: "Password1" },
    { email: "warehouse@trackcrm.com", name: "Karim Fathy", roleSlug: "warehouse", teamSlug: "budget", password: "Password1" },
  ];
  for (const u of sampleUsers) {
    const exists = await prisma.user.findFirst({ where: { email: u.email } });
    if (exists) continue;
    await prisma.user.create({
      data: {
        email: u.email,
        displayName: u.name,
        passwordHash: await bcrypt.hash(u.password, 10),
        roleId: roleIds[u.roleSlug],
        teamId: teamIds[u.teamSlug],
      },
    });
  }
  console.log("Sample users seeded (password: Password1)");

  // Stages
  const stageDefs: { name: string; slug: string; order: number; isCompleted?: boolean }[] = [
    { name: "Prospecting", slug: "prospecting", order: 1 },
    { name: "Initial Contact", slug: "initial-contact", order: 2 },
    { name: "Negotiation", slug: "negotiation", order: 3 },
    { name: "Agreed", slug: "agreed", order: 4 },
    { name: "Completed", slug: "completed", order: 5, isCompleted: true },
    { name: "Declined", slug: "declined", order: 6 },
  ];
  const stageIds: Record<string, string> = {};
  for (const def of stageDefs) {
    const stage = await prisma.stage.upsert({
      where: { slug: def.slug },
      update: { isCompleted: def.isCompleted ?? false },
      create: { name: def.name, slug: def.slug, order: def.order, isCompleted: def.isCompleted ?? false },
    });
    stageIds[def.slug] = stage.id;
  }
  console.log("Stages seeded");

  // Per-team pipeline (budget: all; commission: omit Declined, add own ordering)
  const budgetPipeline = ["prospecting", "initial-contact", "negotiation", "agreed", "completed"];
  const commissionPipeline = ["initial-contact", "negotiation", "agreed", "completed"];
  for (const [teamSlug, slugs] of [
    ["budget", budgetPipeline],
    ["commission", commissionPipeline],
  ] as const) {
    for (const [idx, slug] of slugs.entries()) {
      await prisma.pipelineConfig.upsert({
        where: { teamId_stageId: { teamId: teamIds[teamSlug], stageId: stageIds[slug] } },
        update: { order: idx + 1, isCompleted: slug === "completed" },
        create: {
          teamId: teamIds[teamSlug],
          stageId: stageIds[slug],
          order: idx + 1,
          isCompleted: slug === "completed",
        },
      });
    }
  }
  console.log("Pipelines seeded");

  // Workspace settings
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.workspaceSetting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }
  // Set gift minimum stage to "Agreed" by default
  await prisma.workspaceSetting.upsert({
    where: { key: "gift.minStageId" },
    update: { value: stageIds["agreed"] },
    create: { key: "gift.minStageId", value: stageIds["agreed"] },
  });
  console.log("Workspace settings seeded");

  // Sample creators with profiles so the app isn't empty
  const admin = await prisma.user.findFirst({ where: { email: adminEmail } });
  const leader = await prisma.user.findFirst({ where: { email: "leader@budget.com" } });
  const leader2 = await prisma.user.findFirst({ where: { email: "leader@commission.com" } });

  if (admin && leader && leader2) {
    const creatorCount = await prisma.creator.count();
    if (creatorCount === 0) {
      const creators = [
        { name: "Sara Mostafa", niche: "Lifestyle", platform: "INSTAGRAM" as const, handle: "sara.mostafa", followers: 182000, engRate: 4.2, owner: leader },
        { name: "Ahmed Zaki", niche: "Tech", platform: "TIKTOK" as const, handle: "ahmedzaki", followers: 940000, engRate: 6.1, owner: leader },
        { name: "Nour El-Gendy", niche: "Food", platform: "INSTAGRAM" as const, handle: "nour.gendy", followers: 312000, engRate: 5.4, owner: leader },
        { name: "Youssef Tariq", niche: "Travel", platform: "YOUTUBE" as const, handle: "yousseftariq", followers: 450000, engRate: 3.8, owner: leader2 },
        { name: "Mariam Adel", niche: "Beauty", platform: "INSTAGRAM" as const, handle: "mariam.adel", followers: 720000, engRate: 7.9, owner: leader2 },
        { name: "Khaled Samir", niche: "Fitness", platform: "TIKTOK" as const, handle: "khaled.samir", followers: 210000, engRate: 5.0, owner: leader },
      ];
      for (const c of creators) {
        const creator = await prisma.creator.create({
          data: {
            name: c.name,
            niche: c.niche,
            followers: c.followers,
            engagementRate: c.engRate,
            createdById: admin.id,
            profiles: {
              create: {
                platform: c.platform,
                handle: c.handle,
                normalizedHandle: c.handle.toLowerCase(),
                url: `https://${c.platform.toLowerCase() === "instagram" ? "instagram.com" : "tiktok.com"}/${c.handle}`,
                isPrimary: true,
              },
            },
            ownerships: {
              create: { userId: c.owner.id, teamId: c.owner.teamId },
            },
          },
        });
        await prisma.creator.update({
          where: { id: creator.id },
          data: { primaryProfileId: (await prisma.platformProfile.findFirst({ where: { creatorId: creator.id, isPrimary: true } }))?.id },
        });
        await prisma.activityLog.create({
          data: {
            creatorId: creator.id,
            kind: ActivityKind.SYSTEM,
            type: ActivityType.CREATOR_CREATED,
            summary: "Creator created",
            authorId: admin.id,
          },
        });
        // Engagement on agreed stage for the first few
        if (c.name !== "Khaled Samir") {
          await prisma.engagement.create({
            data: {
              creatorId: creator.id,
              teamId: c.owner.teamId,
              title: `${c.niche} collaboration`,
              dealType: "BARTER",
              currency: "USD",
              stageId: stageIds["agreed"],
              createdById: admin.id,
              deliverables: {
                create: [
                  { title: "1 Reel", type: "Reel", dueDate: new Date(Date.now() + 86400000 * 7) },
                  { title: "1 Story", type: "Story", dueDate: new Date(Date.now() + 86400000 * 10) },
                ],
              },
            },
          });
        }
      }
      console.log("Sample creators seeded");
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });