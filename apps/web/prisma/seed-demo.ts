import {
  PrismaClient,
  ActivityKind,
  ActivityType,
  DealType,
  DeliverableStatus,
  GiftStatus,
  NotificationType,
  Platform,
} from "@prisma/client";

// Idempotent demo-data seeder. Populates records that make the interactive
// dashboard and list pages meaningful:
//   - "Owned by me" creators across every pipeline stage
//   - Overdue / upcoming deliverables
//   - Gifts in every lifecycle stage (REQUESTED, APPROVED_QUEUED, DISPATCHED,
//     DELIVERED, REJECTED) plus one exception request
// Also mirrors each write into the Activity Log, Transaction Log, and (where
// relevant) Notifications so every audit surface shows the same history.
//
// Run with the Neon DATABASE_URL (NOT the local sqlite one):
//   DATABASE_URL="postgres://..." npx tsx prisma/seed-demo.ts

const prisma = new PrismaClient();

const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000);
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);

const GIFT_ACTIVITY_TYPE: Record<GiftStatus, ActivityType> = {
  REQUESTED: ActivityType.GIFT_REQUESTED,
  APPROVED_QUEUED: ActivityType.GIFT_APPROVED,
  DISPATCHED: ActivityType.GIFT_DISPATCHED,
  DELIVERED: ActivityType.GIFT_DELIVERED,
  REJECTED: ActivityType.GIFT_REJECTED,
};

const GIFT_TRANSACTION_ACTION: Record<GiftStatus, string> = {
  REQUESTED: "gift.request",
  APPROVED_QUEUED: "gift.approve",
  DISPATCHED: "gift.dispatch",
  DELIVERED: "gift.deliver",
  REJECTED: "gift.reject",
};

async function main() {
  const admin = await prisma.user.findFirst({ where: { email: "admin@trackcrm.com" } });
  const lina = await prisma.user.findFirst({ where: { email: "leader@budget.com" } });
  const omar = await prisma.user.findFirst({ where: { email: "manager@budget.com" } });
  const maya = await prisma.user.findFirst({ where: { email: "leader@commission.com" } });
  const karim = await prisma.user.findFirst({ where: { email: "warehouse@trackcrm.com" } });
  if (!admin || !lina || !omar || !maya || !karim) {
    throw new Error("Required seed users missing. Run `prisma db seed` first.");
  }
  const adminId = admin.id;
  const linaId = lina.id;
  const omarId = omar.id;
  const mayaId = maya.id;
  const karimId = karim.id;

  // -------------------------------------------------------------------------
  // Reference data (countries → cities, creator types)
  // -------------------------------------------------------------------------

  const REF_COUNTRIES: { name: string; dialCode: string; cities: string[] }[] = [
    { name: "Egypt", dialCode: "+20", cities: ["Cairo", "Alexandria", "Giza", "Mansoura"] },
    { name: "Saudi Arabia", dialCode: "+966", cities: ["Riyadh", "Jeddah"] },
    { name: "United Arab Emirates", dialCode: "+971", cities: ["Dubai", "Abu Dhabi"] },
  ];

  const countryIdByCity = new Map<string, string>();
  const countryIdByName = new Map<string, string>();
  const cityIdByName = new Map<string, string>();
  for (const ref of REF_COUNTRIES) {
    const country = await prisma.country.upsert({
      where: { name: ref.name },
      update: { dialCode: ref.dialCode },
      create: { name: ref.name, dialCode: ref.dialCode },
    });
    countryIdByName.set(ref.name, country.id);
    for (const cityName of ref.cities) {
      const city = await prisma.city.upsert({
        where: { countryId_name: { countryId: country.id, name: cityName } },
        update: {},
        create: { name: cityName, countryId: country.id },
      });
      countryIdByCity.set(cityName, country.id);
      cityIdByName.set(cityName, city.id);
    }
  }

  const creatorTypeIdByName = new Map<string, string>();
  for (const name of ["Blogger", "Podcaster", "YouTuber", "Micro-influencer", "Fashion blogger"]) {
    const t = await prisma.creatorType.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    creatorTypeIdByName.set(name, t.id);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  async function ensureCreator(
    owner: { id: string; teamId: string },
    creator: {
      name: string;
      niche: string;
      platform: Platform;
      handle: string;
      followers?: number;
      engRate?: number;
      city?: string;
      country?: string;
      gender?: string;
      phone?: string;
      creatorType?: string;
    },
  ): Promise<{ id: string; name: string } | null> {
    const existing = await prisma.platformProfile.findUnique({
      where: { platform_normalizedHandle: { platform: creator.platform, normalizedHandle: creator.handle.toLowerCase() } },
      include: { creator: true },
    });
    if (existing) return { id: existing.creatorId, name: creator.name };
    const c = await prisma.creator.create({
      data: {
        name: creator.name,
        niche: creator.niche ? [creator.niche] : [],
        followers: creator.followers,
        engagementRate: creator.engRate,
        city: creator.city,
        country: creator.country,
        gender: creator.gender,
        phone: creator.phone,
        countryId:
          (creator.city ? countryIdByCity.get(creator.city) : null) ??
          (creator.country ? countryIdByName.get(creator.country) ?? null : null),
        cityId: creator.city ? (cityIdByName.get(creator.city) ?? null) : null,
        creatorTypeId: creator.creatorType ? (creatorTypeIdByName.get(creator.creatorType) ?? null) : null,
        createdById: adminId,
        profiles: {
          create: {
            platform: creator.platform,
            handle: creator.handle,
            normalizedHandle: creator.handle.toLowerCase(),
            url: `https://${creator.platform === Platform.INSTAGRAM ? "instagram.com" : creator.platform === Platform.TIKTOK ? "tiktok.com" : "youtube.com"}/${creator.handle}`,
            isPrimary: true,
          },
        },
        ownerships: { create: { userId: owner.id, teamId: owner.teamId } },
      },
    });
    const profile = await prisma.platformProfile.findFirst({
      where: { creatorId: c.id, isPrimary: true },
    });
    await prisma.creator.update({ where: { id: c.id }, data: { primaryProfileId: profile!.id } });
    await prisma.activityLog.create({
      data: {
        creatorId: c.id,
        kind: ActivityKind.SYSTEM,
        type: ActivityType.CREATOR_CREATED,
        summary: "Creator created",
        authorId: adminId,
      },
    });
    await prisma.transactionLog.create({
      data: { userId: adminId, action: "creator.create", entityType: "Creator", entityId: c.id, detail: `Demo creator "${creator.name}" created` },
    });
    return { id: c.id, name: creator.name };
  }

  interface EngagementOpts {
    stageSlug: string;
    dealType: DealType;
    title?: string;
    amount?: number;
    couponCode?: string;
    commissionPercent?: number;
    currency?: "USD" | "EGP" | "EUR";
    completed?: boolean;
  }

  async function ensureEngagement(
    creatorId: string,
    teamId: string,
    opts: EngagementOpts,
  ): Promise<{ id: string; title: string } | null> {
    const title = opts.title ?? `${opts.dealType} collaboration`;
    const existing = await prisma.engagement.findFirst({ where: { creatorId, teamId, title } });
    if (existing) return { id: existing.id, title };
    const stage = await prisma.stage.findUniqueOrThrow({ where: { slug: opts.stageSlug } });
    const e = await prisma.engagement.create({
      data: {
        creatorId,
        teamId,
        title,
        dealType: opts.dealType,
        amount: opts.amount,
        couponCode: opts.couponCode,
        commissionPercent: opts.commissionPercent,
        currency: opts.currency ?? "USD",
        stageId: stage.id,
        createdById: adminId,
        completedAt: opts.completed ? daysAgo(18) : null,
      },
    });
    await prisma.activityLog.create({
      data: {
        creatorId,
        kind: ActivityKind.SYSTEM,
        type: ActivityType.ENGAGEMENT_CREATED,
        summary: `Engagement created (${opts.dealType})`,
        authorId: adminId,
      },
    });
    await prisma.transactionLog.create({
      data: { userId: adminId, action: "engagement.create", entityType: "Engagement", entityId: e.id, detail: `Demo engagement "${title}" created` },
    });
    return { id: e.id, title };
  }

  interface DeliverableOpts {
    title: string;
    type: string;
    dueOffsetDays: number;
    status?: DeliverableStatus;
    posted?: boolean;
  }

  async function ensureDeliverable(
    engagementId: string,
    opts: DeliverableOpts,
  ): Promise<void> {
    const existing = await prisma.deliverable.findFirst({ where: { engagementId, title: opts.title } });
    if (existing) return;
    const d = await prisma.deliverable.create({
      data: {
        engagementId,
        title: opts.title,
        type: opts.type,
        dueDate: daysFromNow(opts.dueOffsetDays),
        status: opts.status ?? DeliverableStatus.PENDING,
        postedUrl: opts.posted ? `https://www.instagram.com/reel/${opts.title.replace(/\W+/g, "").toLowerCase()}` : null,
        postedDate: opts.posted ? daysAgo(1) : null,
      },
    });
    if (opts.status === DeliverableStatus.APPROVED || opts.posted) {
      await prisma.deliverable.update({
        where: { id: d.id },
        data: {
          status: DeliverableStatus.APPROVED,
          reviewedById: omarId,
          reviewComment: "Looks great — approved.",
        },
      });
    }
  }

  interface GiftOpts {
    productName: string;
    productDescription?: string;
    status: GiftStatus;
    requesterId?: string;
    isException?: boolean;
    exceptionReason?: string;
    trackingNumber?: string;
    carrier?: string;
    requestedAt?: Date;
    approvedAt?: Date;
    dispatchedAt?: Date;
    deliveredAt?: Date;
  }

  async function ensureGift(
    engagementId: string,
    creatorId: string,
    opts: GiftOpts,
  ): Promise<void> {
    const existing = await prisma.gift.findFirst({ where: { engagementId, productName: opts.productName } });
    if (existing) return;
    const requesterId = opts.requesterId ?? linaId;
    const g = await prisma.gift.create({
      data: {
        engagementId,
        productName: opts.productName,
        productDescription: opts.productDescription,
        requestedById: requesterId,
        requestedAt: opts.requestedAt ?? hoursAgo(1),
        isException: opts.isException ?? false,
        exceptionReason: opts.exceptionReason,
        status: opts.status,
        approvedById: opts.status === GiftStatus.REQUESTED ? null : omarId,
        approvedAt: opts.approvedAt,
        trackingNumber: opts.trackingNumber,
        carrier: opts.carrier,
        dispatchedAt: opts.dispatchedAt,
        deliveredAt: opts.deliveredAt,
      },
    });
    const verb = opts.status === GiftStatus.REQUESTED || opts.status === GiftStatus.APPROVED_QUEUED ? requesterId : karimId;
    await prisma.activityLog.create({
      data: {
        creatorId,
        kind: ActivityKind.SYSTEM,
        type: GIFT_ACTIVITY_TYPE[opts.status],
        summary: `Gift ${opts.status.toLowerCase().replace("_", " ")} — ${opts.productName}`,
        authorId: verb,
      },
    });
    await prisma.transactionLog.create({
      data: {
        userId: verb,
        action: GIFT_TRANSACTION_ACTION[opts.status],
        entityType: "Gift",
        entityId: g.id,
        detail: `Gift "${opts.productName}" ${opts.status.toLowerCase().replace("_", " ")}`,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Budget team creators across the whole pipeline (owned by Lina)
  // -------------------------------------------------------------------------
  const budgetTeam = await prisma.team.findUnique({ where: { slug: "budget" } });
  const commissionTeam = await prisma.team.findUnique({ where: { slug: "commission" } });
  if (!budgetTeam || !commissionTeam) throw new Error("Teams missing — run `prisma db seed` first.");

  const cLayla = await ensureCreator(lina, { name: "Layla Mansour", niche: "Fitness", platform: Platform.INSTAGRAM, handle: "layla.mansour", followers: 128000, engRate: 5.8, city: "Cairo", country: "Egypt", gender: "Female", phone: "+201001234001", creatorType: "Blogger" });
  const cOmar = await ensureCreator(lina, { name: "Omar Hakim", niche: "Gaming", platform: Platform.TIKTOK, handle: "omarhakim", followers: 640000, engRate: 4.6, city: "Alexandria", country: "Egypt", gender: "Male", phone: "+201001234002", creatorType: "Micro-influencer" });
  const cFarida = await ensureCreator(lina, { name: "Farida Adel", niche: "Fashion", platform: Platform.INSTAGRAM, handle: "farida.adel", followers: 415000, engRate: 6.7, city: "Cairo", country: "Egypt", gender: "Female", phone: "+201001234003", creatorType: "Fashion blogger" });
  const cHana = await ensureCreator(lina, { name: "Hana Khatib", niche: "Family", platform: Platform.INSTAGRAM, handle: "hana.khatib", followers: 223000, engRate: 4.9, city: "Giza", country: "Egypt", gender: "Female", phone: "+201001234004", creatorType: "Blogger" });
  const cDina = await ensureCreator(lina, { name: "Dina Fawzy", niche: "Beauty", platform: Platform.INSTAGRAM, handle: "dina.fawzy", followers: 531000, engRate: 8.2, city: "Cairo", country: "Egypt", gender: "Female", phone: "+201001234005", creatorType: "Micro-influencer" });
  const cTarek = await ensureCreator(lina, { name: "Tarek Omar", niche: "Automotive", platform: Platform.YOUTUBE, handle: "tarek.omar", followers: 178000, engRate: 3.2, city: "Mansoura", country: "Egypt", gender: "Male", phone: "+201001234006", creatorType: "YouTuber" });
  const cSalma = await ensureCreator(maya, { name: "Salma Yehia", niche: "Fashion", platform: Platform.INSTAGRAM, handle: "salma.yehia", followers: 684000, engRate: 6.1, city: "Cairo", country: "Egypt", gender: "Female", phone: "+201001234007", creatorType: "Fashion blogger" });

  const eLayla = await ensureEngagement(cLayla!.id, budgetTeam.id, { stageSlug: "prospecting", dealType: DealType.FIXED_BUDGET, title: "Fitness campaign", amount: 800 });
  const eOmar = await ensureEngagement(cOmar!.id, budgetTeam.id, { stageSlug: "initial-contact", dealType: DealType.COMMISSION, title: "Gaming affiliate", couponCode: "GAME10", commissionPercent: 15 });
  await ensureEngagement(cFarida!.id, budgetTeam.id, { stageSlug: "negotiation", dealType: DealType.FIXED_BUDGET, title: "Fashion shoot", amount: 1200 });
  const eHana = await ensureEngagement(cHana!.id, budgetTeam.id, { stageSlug: "agreed", dealType: DealType.BARTER, title: "Family products" });
  const eDina = await ensureEngagement(cDina!.id, budgetTeam.id, { stageSlug: "completed", dealType: DealType.BARTER, title: "Beauty routine series", completed: true });
  await ensureEngagement(cTarek!.id, budgetTeam.id, { stageSlug: "declined", dealType: DealType.FIXED_BUDGET, title: "Car accessories", amount: 600 });
  const eSalma = await ensureEngagement(cSalma!.id, commissionTeam.id, { stageSlug: "agreed", dealType: DealType.BARTER, title: "Fashion haul" });

  // Khaled Samir (existing budget creator) gets an agreed engagement
  const khaled = await prisma.creator.findFirst({ where: { name: "Khaled Samir" } });
  const eKhaled = khaled ? await ensureEngagement(khaled.id, budgetTeam.id, { stageSlug: "agreed", dealType: DealType.BARTER, title: "Fitness starter series" }) : null;

  // -------------------------------------------------------------------------
  // Overdue + upcoming deliverables
  // -------------------------------------------------------------------------
  const sara = await prisma.creator.findFirst({ where: { name: "Sara Mostafa" } });
  const ahmed = await prisma.creator.findFirst({ where: { name: "Ahmed Zaki" } });
  const nour = await prisma.creator.findFirst({ where: { name: "Nour El-Gendy" } });
  const sarahEng = sara ? await prisma.engagement.findFirst({ where: { creatorId: sara.id }, orderBy: { createdAt: "desc" } }) : null;
  const ahmedEng = ahmed ? await prisma.engagement.findFirst({ where: { creatorId: ahmed.id }, orderBy: { createdAt: "desc" } }) : null;
  const nourEng = nour ? await prisma.engagement.findFirst({ where: { creatorId: nour.id }, orderBy: { createdAt: "desc" } }) : null;

  if (sarahEng) {
    await ensureDeliverable(sarahEng.id, { title: "1 Reel — overdue", type: "Reel", dueOffsetDays: -1, status: DeliverableStatus.PENDING });
    await ensureDeliverable(sarahEng.id, { title: "1 Story — due soon", type: "Story", dueOffsetDays: 3 });
  }
  if (ahmedEng) {
    await ensureDeliverable(ahmedEng.id, { title: "1 TikTok — overdue", type: "TikTok", dueOffsetDays: -2, status: DeliverableStatus.PENDING });
    await ensureDeliverable(ahmedEng.id, { title: "1 Reel — posted", type: "Reel", dueOffsetDays: -6, posted: true });
  }
  if (nourEng) {
    await ensureDeliverable(nourEng.id, { title: "1 Reel — overdue", type: "Reel", dueOffsetDays: -3, status: DeliverableStatus.PENDING });
  }
  if (eHana) await ensureDeliverable(eHana.id, { title: "1 Reel", type: "Reel", dueOffsetDays: -2, status: DeliverableStatus.PENDING });
  if (eKhaled) await ensureDeliverable(eKhaled.id, { title: "1 Reel", type: "Reel", dueOffsetDays: 5 });
  if (eDina) {
    await ensureDeliverable(eDina.id, { title: "1 Reel — posted", type: "Reel", dueOffsetDays: -6, posted: true });
    await ensureDeliverable(eDina.id, { title: "1 Story — posted", type: "Story", dueOffsetDays: -4, posted: true });
  }
  if (eLayla) await ensureDeliverable(eLayla.id, { title: "1 Reel", type: "Reel", dueOffsetDays: 14 });
  if (eOmar) await ensureDeliverable(eOmar.id, { title: "1 TikTok", type: "TikTok", dueOffsetDays: 10 });
  if (eSalma) await ensureDeliverable(eSalma.id, { title: "1 Reel — due soon", type: "Reel", dueOffsetDays: 2 });

  // -------------------------------------------------------------------------
  // Gifts across every lifecycle stage (this month)
  // -------------------------------------------------------------------------
  if (sarahEng) await ensureGift(sarahEng.id, sara!.id, { productName: "Velvet Duo Set", productDescription: "Perfume + body care", status: GiftStatus.REQUESTED, requestedAt: hoursAgo(2) });
  if (khaled && eKhaled) await ensureGift(eKhaled.id, khaled.id, { productName: "Fitness Starter Kit", productDescription: "Resistance bands + mat", status: GiftStatus.DELIVERED, trackingNumber: "EG1002", carrier: "Aramex", requestedAt: daysAgo(6), approvedAt: daysAgo(5), dispatchedAt: daysAgo(4), deliveredAt: daysAgo(2) });
  if (nourEng) await ensureGift(nourEng.id, nour!.id, { productName: "Ceramic Cookware Set", productDescription: "9-piece cookware", status: GiftStatus.APPROVED_QUEUED, requestedAt: daysAgo(1), approvedAt: hoursAgo(20) });
  if (eDina) await ensureGift(eDina.id, cDina!.id, { productName: "Skincare Gift Box", productDescription: "Routine essentials", status: GiftStatus.DISPATCHED, trackingNumber: "EG1007", carrier: "DHL", requestedAt: daysAgo(3), approvedAt: daysAgo(2), dispatchedAt: hoursAgo(18) });
  if (ahmedEng) {
    await ensureGift(ahmedEng.id, ahmed!.id, { productName: "Affiliate Welcome Kit", productDescription: "Brand merch", status: GiftStatus.DELIVERED, trackingNumber: "EG1001", carrier: "Aramex", requestedAt: daysAgo(5), approvedAt: daysAgo(4), dispatchedAt: daysAgo(3), deliveredAt: daysAgo(1) });
    await ensureGift(ahmedEng.id, ahmed!.id, { productName: "Ramadan Campaign Box", productDescription: "Second gift for the Ramadan activation", status: GiftStatus.REQUESTED, isException: true, exceptionReason: "Special Ramadan campaign needs an early second drop", requestedAt: hoursAgo(1) });
  }
  if (eSalma) await ensureGift(eSalma.id, cSalma!.id, { productName: "Satin Lounge Set", productDescription: "Pajama set", status: GiftStatus.REQUESTED, requesterId: mayaId, requestedAt: hoursAgo(4) });

  // One rejected gift for history context
  const rejectedExists = await prisma.gift.count({ where: { status: GiftStatus.REJECTED } });
  if (!rejectedExists && nourEng) {
    await prisma.gift.create({
      data: {
        engagementId: nourEng.id,
        productName: "Premium Blend Coffee Kit",
        productDescription: "Rejected demo — over budget for the engagement",
        requestedById: linaId,
        requestedAt: daysAgo(8),
        status: GiftStatus.REJECTED,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Backfill: enrich creators created before reference data existed so the
  // gifting hard stop (country, city, creator type, phone required) passes.
  // -------------------------------------------------------------------------
  const fallbackCountryId = countryIdByName.get("Egypt") ?? null;
  const fallbackCityId = cityIdByName.get("Cairo") ?? null;
  const fallbackTypeId = creatorTypeIdByName.get("Blogger") ?? null;
  const genders = ["Female", "Male", "Other", "Prefer not to say"];
  const allCreators = await prisma.creator.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
  });
  let phoneSeq = 101;
  const usedPhones = new Set<string>(
    (await prisma.creator.findMany({ where: { phone: { not: null } }, select: { phone: true } })).map(
      (c) => c.phone as string,
    ),
  );
  const validCountryIds = new Set<string>(
    (await prisma.country.findMany({ select: { id: true } })).map((c) => c.id),
  );
  const validCityIds = new Set<string>(
    (await prisma.city.findMany({ select: { id: true } })).map((c) => c.id),
  );
  for (let i = 0; i < allCreators.length; i++) {
    const row = allCreators[i];
    const cityId =
      (row.city ? cityIdByName.get(row.city) ?? null : null) ??
      (row.cityId && validCityIds.has(row.cityId) ? row.cityId : null) ??
      fallbackCityId;
    const countryId =
      (row.city ? countryIdByCity.get(row.city) ?? null : null) ??
      (row.country ? countryIdByName.get(row.country) ?? null : null) ??
      (row.countryId && validCountryIds.has(row.countryId) ? row.countryId : null) ??
      fallbackCountryId;
    const creatorTypeId = row.creatorTypeId ?? fallbackTypeId;
    const gender = row.gender ?? genders[i % genders.length];
    let phone = row.phone;
    if (!phone) {
      do {
        phone = `+20${String(phoneSeq++).padStart(9, "0")}`;
      } while (usedPhones.has(phone));
      usedPhones.add(phone);
    }
    const needs =
      row.phone !== phone ||
      row.gender !== gender ||
      row.creatorTypeId !== creatorTypeId ||
      row.countryId !== countryId ||
      row.cityId !== cityId;
    if (needs) {
      try {
        await prisma.creator.update({
          where: { id: row.id },
          data: { phone, gender, creatorTypeId, countryId, cityId },
        });
      } catch (e) {
        console.error(`Backfill failed for ${row.name}:`, { countryId, cityId, phone, gender, creatorTypeId });
        throw e;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Notifications mirroring the demo state
  // -------------------------------------------------------------------------
  const notifTypes: [NotificationType, string, string, string, string][] = [
    ["GIFT_EXCEPTION_REQUESTED", "Exception gift request", "Ahmed Zaki — Ramadan Campaign Box needs approval", "/requests", omar.id],
    ["GIFT_APPROVED", "Gift approved", "Nour El-Gendy — Ceramic Cookware Set is queued for dispatch", "/gifting?tab=warehouse", lina.id],
    ["GIFT_DISPATCHED", "Gift dispatched", "Dina Fawzy — Skincare Gift Box is on its way (EG1007)", "/gifting?tab=history", lina.id],
  ];
  for (const [type, title, body, link, userId] of notifTypes) {
    const exists = await prisma.notification.findFirst({ where: { userId, title } });
    if (exists) continue;
    await prisma.notification.create({ data: { userId, type, title, body, link } });
  }

  const creators = await prisma.creator.count({ where: { deletedAt: null } });
  const ownedByMe = await prisma.creatorOwnership.count({ where: { userId: linaId } });
  const deliverables = await prisma.deliverable.count();
  const overdue = await prisma.deliverable.count({
    where: { status: { not: DeliverableStatus.APPROVED }, dueDate: { lt: new Date() } },
  });
  const gifts = await prisma.gift.count();
  const transactions = await prisma.transactionLog.count();
  console.log("Demo data seeded.");
  console.log(`Creators: ${creators} | Owned by Lina: ${ownedByMe} | Deliverables: ${deliverables} (${overdue} overdue) | Gifts: ${gifts} | Transactions: ${transactions}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });