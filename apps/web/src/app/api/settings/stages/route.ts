import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, requireApiUser } from "@/lib/api-utils";

export async function GET() {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (user.roleSlug !== "admin") return jsonError("Only the Admin can manage stages.", 403);

  const [stages, pipeline] = await Promise.all([
    prisma.stage.findMany({ orderBy: { order: "asc" } }),
    prisma.pipelineConfig.findMany({
      where: { teamId: user.teamId },
      include: { stage: true },
      orderBy: { order: "asc" },
    }),
  ]);

  return NextResponse.json({
    stages: stages.map((s) => ({ id: s.id, name: s.name, order: s.order, isCompleted: s.isCompleted })),
    pipeline: pipeline.map((p) => ({
      stageId: p.stageId,
      name: p.stage.name,
      order: p.order,
      isCompleted: p.isCompleted,
    })),
  });
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "stage"
  );
}

export async function POST(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (user.roleSlug !== "admin") return jsonError("Only the Admin can manage stages.", 403);

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) return jsonError("A stage name is required.", 400);

  // A new global stage is added to every team's pipeline at the end, so teams
  // pick it up and their managers can remove or reorder it afterwards.
  const stage = await prisma.$transaction(async (tx) => {
    const maxOrder = await tx.stage.aggregate({ _max: { order: true } });
    const next = (maxOrder._max.order ?? -1) + 1;
    const created = await tx.stage.create({
      data: { name, slug: `${slugify(name)}-${Date.now().toString(36)}`, order: next },
    });
    const teams = await tx.team.findMany({ select: { id: true } });
    if (teams.length) {
      await tx.pipelineConfig.createMany({
        data: teams.map((t) => ({ teamId: t.id, stageId: created.id, order: 0 })),
        skipDuplicates: true,
      });
      const configs = await tx.pipelineConfig.findMany({
        where: { teamId: { in: teams.map((t) => t.id) } },
        orderBy: { order: "asc" },
      });
      let i = 0;
      for (const cfg of configs) {
        await tx.pipelineConfig.update({ where: { id: cfg.id }, data: { order: i++ } });
      }
    }
    return created;
  }, { timeout: 30000 });

  return NextResponse.json({ id: stage.id, name: stage.name, order: stage.order }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (user.roleSlug !== "admin") return jsonError("Only the Admin can manage stages.", 403);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");
  const id = String(body.id ?? "");
  if (!id) return jsonError("A stage id is required.", 400);
  const stage = await prisma.stage.findUnique({ where: { id } });
  if (!stage) return jsonError("Stage not found.", 404);

  if (action === "rename") {
    const name = String(body.name ?? "").trim();
    if (!name) return jsonError("A stage name is required.", 400);
    const updated = await prisma.stage.update({ where: { id }, data: { name } });
    return NextResponse.json({ id: updated.id, name: updated.name });
  }

  if (action === "move") {
    const dir = Number(body.dir);
    if (dir !== 1 && dir !== -1) return jsonError("dir must be 1 or -1.", 400);
    // Reorder the admin team's pipeline and mirror it onto the global Stage order.
    const pipeline = await prisma.pipelineConfig.findMany({
      where: { teamId: user.teamId },
      orderBy: { order: "asc" },
      include: { stage: true },
    });
    const idx = pipeline.findIndex((p) => p.stageId === id);
    if (idx < 0) return jsonError("This stage is not in your team's pipeline.", 400);
    const target = pipeline[idx + dir];
    if (!target) return jsonError("Already at the edge of the pipeline.", 400);
    const a = pipeline[idx];
    const b = target;
    await prisma.$transaction([
      prisma.pipelineConfig.update({ where: { id: a.id }, data: { order: b.order } }),
      prisma.pipelineConfig.update({ where: { id: b.id }, data: { order: a.order } }),
      prisma.stage.update({ where: { id: a.stageId }, data: { order: b.stage.order } }),
      prisma.stage.update({ where: { id: b.stageId }, data: { order: a.stage.order } }),
    ]);
    return NextResponse.json({ ok: true });
  }

  if (action === "toggle-completed") {
    const completed = body.completed === true;
    const configs = await prisma.pipelineConfig.findMany({ where: { stageId: id } });
    for (const cfg of configs) {
      await prisma.pipelineConfig.update({ where: { id: cfg.id }, data: { isCompleted: completed } });
    }
    await prisma.stage.update({ where: { id }, data: { isCompleted: completed } });
    return NextResponse.json({ ok: true });
  }

  return jsonError("Unknown action.", 400);
}

export async function DELETE(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (user.roleSlug !== "admin") return jsonError("Only the Admin can manage stages.", 403);

  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  if (!id) return jsonError("A stage id is required.", 400);

  const inUse = await prisma.engagement.count({ where: { stageId: id } });
  if (inUse > 0) {
    return jsonError("This stage has engagements — move them first before deleting it.", 400);
  }
  await prisma.stage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}