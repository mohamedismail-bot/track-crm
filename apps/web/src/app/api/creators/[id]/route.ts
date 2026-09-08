import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { addDays, isBefore } from "date-fns";
import { requiredForGiftingMissing } from "@/lib/constants";
import { jsonError, requireApiUser } from "@/lib/api-utils";
import type { SessionUser } from "@/lib/auth";
import { logActivity, logTransaction } from "@/lib/activity";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;
  const { id } = await params;

  const creator = await prisma.creator.findUnique({
    where: { id, deletedAt: null },
    include: {
      primaryProfile: true,
      profiles: true,
      ownerships: { include: { user: true, team: true } },
      engagements: {
        include: {
          stage: true,
          team: true,
          deliverables: { orderBy: { createdAt: "asc" } },
          gifts: {
            include: { status: true, lines: { orderBy: { id: "asc" } } },
            orderBy: { requestedAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      activityLogs: {
        include: { author: true, attachments: true },
        orderBy: { loggedAt: "desc" },
      },
      countryRef: true,
      cityRef: true,
      creatorTypeRef: true,
      createdBy: { include: { team: true } },
      reviewedBy: { include: { team: true } },
    },
  });
  if (!creator) return jsonError("Creator not found.", 404);

  const settings = await getSettings();
  const owns = creator.ownerships.some((o) => o.userId === session.id);
  const isManager = session.roleSlug === "team-manager";
  const sameTeam = creator.ownerships.some((o) => o.teamId === session.teamId);
  const otherTeamOnly = creator.ownerships.length > 0 && !sameTeam;

  // Pending approval: only the requester, their team manager and the admin may see.
  if (creator.approvalStatus !== null) {
    const { canSeePendingCreator } = await import("@/lib/creators");
    if (!canSeePendingCreator(session, creator)) {
      return jsonError("Creator not found.", 404);
    }
  }

  // Limited view: unassigned teams only get status, stage and activity logs —
  // never another team's deal, deliverable or gifting details.
  const canViewFull = sameTeam || owns || !otherTeamOnly;

  const redactedEngagements = creator.engagements.map((e) => {
    // Gift serialization: expose the status key and a display product name
    // (snapshotted first order line), since the old scalar fields are gone.
    const gifts = canViewFull
      ? e.gifts.map((g) => ({
          ...g,
          status: g.status.key,
          statusLabel: g.status.label,
          productName: g.lines[0]?.productName ?? `${creator.name} gift`,
          productDescription: g.lines[0]?.productDescription,
        }))
      : [];
    return canViewFull ? { ...e, gifts } : { ...e, deliverables: [], gifts };
  });

  let poolStatus: "none" | "same_team" | "company" = "none";
  const lastActivity = creator.activityLogs[0]?.loggedAt;
  if (!owns && !sameTeam && lastActivity && creator.ownerships.length > 0) {
    if (isBefore(lastActivity, addDays(new Date(), -settings.inactivityCompanyDays))) poolStatus = "company";
    else if (isBefore(lastActivity, addDays(new Date(), -settings.inactivitySameTeamDays))) poolStatus = "same_team";
  }

  const missingGifting = requiredForGiftingMissing({
    countryId: creator.countryId,
    cityId: creator.cityId,
    creatorTypeId: creator.creatorTypeId,
    phone: creator.phone,
  });

  return NextResponse.json({
    ...creator,
    country: creator.countryRef?.name ?? creator.country,
    city: creator.cityRef?.name ?? creator.city,
    creatorType: creator.creatorTypeRef?.name ?? creator.creatorType,
    engagements: redactedEngagements,
    canViewFull,
    missingRequiredForGifting: missingGifting,
    incompleteData: missingGifting.length > 0,
    relationship: owns
      ? "owned"
      : sameTeam
        ? isManager
          ? "same_team_manager"
          : "same_team"
        : otherTeamOnly
          ? "other_team"
          : creator.ownerships.length === 0
            ? "available"
            : "none",
    poolStatus,
    isOwnedByMe: owns,
    canMove: ((owns || isManager || session.roleSlug === "admin") && sameTeam) || (session.roleSlug === "admin" && owns),
    canLog: sameTeam,
    unassignedVisibleFields:
      settings.unassignedVisibleFields.length > 0
        ? settings.unassignedVisibleFields
        : ["platformLink", "creatorName"],
    canReviewApproval:
      (session.roleSlug === "admin" ||
        (creator.approvalStatus !== null &&
          isManager &&
          creator.createdBy?.teamId === session.teamId)),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;

  const { id } = await params;
  if (!session.permissions.includes("creator.edit")) {
    return jsonError("No permission to edit creators.", 403);
  }

  // Only the assigned owner, the team's manager, or the admin may edit a creator.
  const creatorBefore = await prisma.creator.findUnique({
    where: { id, deletedAt: null },
    include: { ownerships: true, countryRef: true, profiles: true },
  });
  if (!creatorBefore) return jsonError("Creator not found.", 404);
  const isManager = session.roleSlug === "team-manager";
  const owns = creatorBefore.ownerships.some((o) => o.userId === session.id);
  const managesTeam = isManager && creatorBefore.ownerships.some((o) => o.teamId === session.teamId);
  const isRequester = creatorBefore.createdById === session.id;
  const pendingActive = creatorBefore.approvalStatus !== null;

  if (session.roleSlug !== "admin") {
    if (pendingActive) {
      if (isRequester) {
        // OK — the requester edits (and resubmits) their own pending creator.
      } else if (!isManager) {
        return jsonError("Only the requester may edit a creator awaiting approval.", 403);
      }
    } else if (!owns && !managesTeam) {
      return jsonError("You can only edit creators you own.", 403);
    }
  }

  try {
    const body = await req.json();

    // Protected identity fields — only the Admin may change these.
    if (session.roleSlug !== "admin") {
      const existingProfiles = creatorBefore.profiles?.map((p) => p.url) ?? [];
      const submittedProfiles = (body.profiles ?? []) as { url?: string; input?: string }[];
      // Non-admins may add NEW profiles but not remove or change existing URLs.
      if (body.profiles !== undefined) {
        const removed = existingProfiles.some((url) => !submittedProfiles.some((p) => (p.url ?? "") === url));
        if (removed) {
          return jsonError("You can add platform profiles but cannot remove existing ones.", 403);
        }
      }
      for (const field of ["name"] as const) {
        if (
          body[field] !== undefined &&
          (body[field] as string | null) !== creatorBefore[field] &&
          (body[field] as string | undefined)?.trim().toLowerCase() !==
            (creatorBefore[field] ?? "")?.toString().toLowerCase()
        ) {
          return jsonError(`Only the Admin can change the ${field} of a creator.`, 403);
        }
      }
      // Email is editable only by the admin unless it is currently empty.
      if (
        body.email !== undefined &&
        creatorBefore.email &&
        (body.email as string | null)?.trim().toLowerCase() !== creatorBefore.email.toLowerCase()
      ) {
        return jsonError("Only the Admin can change the email of a creator once it is set.", 403);
      }
    }

    // UAT (per-field edit grants): a non-admin may only change the Creator
    // fields the Admin has listed in Workspace Settings -> Creator editing
    // permissions. Owner assignment is governed separately by resolveOwnerships.
    if (session.roleSlug !== "admin") {
      const { getSettings } = await import("@/lib/settings");
      const settings = await getSettings();
      const allowed = new Set(settings.creatorEditAllowedFields);

      const fieldValueFor: Record<string, () => unknown> = {
        name: () => creatorBefore.name,
        countryId: () => creatorBefore.countryId,
        cityId: () => creatorBefore.cityId,
        creatorTypeId: () => creatorBefore.creatorTypeId,
        gender: () => creatorBefore.gender,
        shopifyRegistered: () => creatorBefore.shopifyRegistered,
        niche: () => creatorBefore.niche,
        followers: () => creatorBefore.followers,
        engagementRate: () => creatorBefore.engagementRate,
        notes: () => creatorBefore.notes,
        customFields: () => creatorBefore.customFields,
        profiles: () => creatorBefore.profiles?.map((p) => p.url),
      };
      const fieldKeyFor: Record<string, string> = {
        name: "name",
        countryId: "country",
        cityId: "city",
        creatorTypeId: "creatorType",
        gender: "gender",
        shopifyRegistered: "shopify",
        niche: "niche",
        followers: "followers",
        engagementRate: "engagementRate",
        notes: "notes",
        customFields: "customFields",
        profiles: "profiles",
      };

      for (const k of Object.keys(fieldKeyFor)) {
        if (body[k] === undefined) continue;
        const after: unknown = body[k];
        const before = fieldValueFor[k]?.();
        let changed: boolean;
        if (k === "profiles") {
          // Profiles are always governed by the protected-identity rules above.
          continue;
        }
        if (Array.isArray(before) || (before !== null && typeof before === "object")) {
          changed = JSON.stringify(before) !== JSON.stringify(after);
        } else {
          changed = before !== after;
        }
        if (changed && !allowed.has(fieldKeyFor[k])) {
          return jsonError(`You do not have permission to change this creator field.`, 403);
        }
      }
    }

    // Merge the submitted subset onto the current values so mandatory-field
    // and cross-field validation always runs against the final state.
    const merged: Record<string, unknown> = {
      name: body.name !== undefined ? body.name : creatorBefore.name,
      email: body.email !== undefined ? body.email : creatorBefore.email,
      phoneNumber: body.phoneNumber !== undefined ? body.phoneNumber : undefined,
      phoneCountryId: body.phoneCountryId !== undefined ? body.phoneCountryId : undefined,
      countryId: body.countryId !== undefined ? body.countryId : creatorBefore.countryId,
      cityId: body.cityId !== undefined ? body.cityId : creatorBefore.cityId,
      creatorTypeId: body.creatorTypeId !== undefined ? body.creatorTypeId : creatorBefore.creatorTypeId,
      gender: body.gender !== undefined ? body.gender : creatorBefore.gender,
      shopifyRegistered: body.shopifyRegistered !== undefined ? body.shopifyRegistered : creatorBefore.shopifyRegistered,
      niche: body.niche !== undefined ? body.niche : creatorBefore.niche,
      followers: body.followers !== undefined ? body.followers : creatorBefore.followers,
      engagementRate: body.engagementRate !== undefined ? body.engagementRate : creatorBefore.engagementRate,
      notes: body.notes !== undefined ? body.notes : creatorBefore.notes,
      customFields: body.customFields !== undefined ? body.customFields : (creatorBefore.customFields ?? {}),
    };
    const existingCustom = (creatorBefore.customFields ?? {}) as Record<string, unknown>;
    merged.customFields =
      body.customFields !== undefined
        ? { ...existingCustom, ...(body.customFields as Record<string, unknown>) }
        : existingCustom;

    // Capture prior owner names so an ownership change can be logged.
    const oldOwners = await prisma.user.findMany({
      where: { id: { in: creatorBefore.ownerships.map((o) => o.userId) } },
      select: { id: true, displayName: true },
    });
    const oldOwnerNames = oldOwners.map((o) => o.displayName);

    const { validateCreatorInput, phoneFromInput } = await import("@/lib/creators");
    const validation = await validateCreatorInput(merged as never, { isCreate: false });

    const phone =
      body.phoneNumber !== undefined || body.phoneCountryId !== undefined
        ? await phoneFromInput(
            body.phoneCountryId as string | undefined,
            body.phoneNumber as string | undefined,
          )
        : creatorBefore.phone;

    if (validation.data.email) {
      const dupEmail = await prisma.creator.findUnique({
        where: { email: validation.data.email },
      });
      if (dupEmail && dupEmail.id !== id) {
        return jsonError(`A creator with the email ${validation.data.email} already exists.`, 409);
      }
    }
    if (phone) {
      const { findDuplicatePhone } = await import("@/lib/creators");
      const dupPhone = await findDuplicatePhone(phone, id);
      if (dupPhone) {
        return jsonError(`A creator with this phone number already exists (${dupPhone.name}).`, 409);
      }
    }

    const creator = await prisma.$transaction(async (tx) => {
      let nextApprovalStatus = creatorBefore.approvalStatus;
      if (creatorBefore.approvalStatus === "REJECTED" && (isRequester || session.roleSlug === "admin")) {
        nextApprovalStatus = "PENDING";
      }
      const updated = await tx.creator.update({
        where: { id },
        data: {
          name: validation.data.name || creatorBefore.name,
          email: validation.data.email,
          phone,
          niche: validation.data.niche?.length ? validation.data.niche : [],
          countryId: validation.data.countryId ?? undefined,
          cityId: validation.data.cityId ?? undefined,
          creatorTypeId: validation.data.creatorTypeId ?? undefined,
          gender: validation.data.gender ?? undefined,
          shopifyRegistered: validation.data.shopifyRegistered ?? undefined,
          followers: validation.data.followers ?? undefined,
          engagementRate: validation.data.engagementRate ?? undefined,
          notes: validation.data.notes ?? undefined,
          customFields: Object.keys(validation.data.customFields).length ? validation.data.customFields : undefined,
          ...(nextApprovalStatus !== creatorBefore.approvalStatus
            ? {
                approvalStatus: nextApprovalStatus,
                reviewComment: nextApprovalStatus === "PENDING" ? null : creatorBefore.reviewComment,
                reviewedById: nextApprovalStatus === "PENDING" ? null : creatorBefore.reviewedById,
                reviewedAt: nextApprovalStatus === "PENDING" ? null : creatorBefore.reviewedAt,
              }
            : {}),
        },
      });

      if (body.profiles !== undefined) {
        const { replaceCreatorProfiles, addCreatorProfiles } = await import("@/lib/creators");
        try {
          if (session.roleSlug === "admin") {
            await replaceCreatorProfiles(id, body.profiles, tx);
          } else {
            // Non-admin: only append new profiles; keep existing untouched.
            const existingUrls = new Set((creatorBefore.profiles ?? []).map((p) => p.url));
            const newOnes = (body.profiles as { platform: string; input: string; isPrimary?: boolean }[]).filter(
              (p) => !existingUrls.has(p.input ?? ""),
            );
            if (newOnes.length > 0) {
              await addCreatorProfiles(id, newOnes, tx);
            }
          }
        } catch (e) {
          const dupMsg = e instanceof Error ? e.message : "";
          if (dupMsg.includes("already linked") || dupMsg.includes("Duplicate profile")) {
            throw new Error(dupMsg);
          }
          throw e;
        }
      }
      return updated;
    });

    let ownershipChangedAfter: string[] | null = null;
    if (body.ownerIds !== undefined) {
      const { resolveOwnerships, replaceCreatorOwnerships } = await import("@/lib/creators");
      const ownerships = await resolveOwnerships(session, body.ownerIds as string[] | undefined, {
        defaultToSelf: false,
      });
      await replaceCreatorOwnerships(id, ownerships);
      const newOwners = await prisma.user.findMany({
        where: { id: { in: ownerships.map((o) => o.userId) } },
        select: { displayName: true },
      });
      ownershipChangedAfter = newOwners.map((o) => o.displayName);
    }

    await logActivity({
      creatorId: id,
      kind: "SYSTEM",
      type: "CREATOR_UPDATED",
      summary:
        creatorBefore.approvalStatus === "REJECTED" && creator.approvalStatus === "PENDING"
          ? "Creator edited and resubmitted for approval"
          : "Creator details updated",
      authorId: session.id,
    });
    if (ownershipChangedAfter) {
      await logActivity({
        creatorId: id,
        kind: "SYSTEM",
        type: "OWNERSHIP_CHANGED",
        summary: `Owners changed: ${oldOwnerNames.length ? oldOwnerNames.join(", ") : "none"} → ${ownershipChangedAfter.length ? ownershipChangedAfter.join(", ") : "none"}`,
        authorId: session.id,
      });
    }
    await logTransaction({
      userId: session.id,
      action: "creator.update",
      entityType: "Creator",
      entityId: id,
      detail: `Updated ${creator.name}`,
    });

    if (creatorBefore.approvalStatus === "REJECTED" && creator.approvalStatus === "PENDING") {
      const { notifyTeamManagerOfTeam } = await import("@/lib/notify");
      await notifyTeamManagerOfTeam(session.teamId, {
        type: "SYSTEM",
        title: "Creator resubmitted for approval",
        body: `${creator.name} was edited and resubmitted by ${session.displayName}.`,
        link: `/creators?pending=1`,
      });
    }

    return NextResponse.json({ id: creator.id });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed to update creator", 400);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const session = user as SessionUser;

  const { id } = await params;
  if (!session.permissions.includes("creator.delete")) {
    return jsonError("No permission to delete creators.", 403);
  }

  const creator = await prisma.creator.findUnique({
    where: { id, deletedAt: null },
    include: { ownerships: true },
  });
  if (!creator) return jsonError("Creator not found.", 404);
  const isManager = session.roleSlug === "team-manager";
  const owns = creator.ownerships.some((o) => o.userId === session.id);
  const managesTeam = isManager && creator.ownerships.some((o) => o.teamId === session.teamId);
  if (session.roleSlug !== "admin" && !owns && !managesTeam) {
    return jsonError("You can only delete creators you own.", 403);
  }

  await prisma.creator.update({ where: { id }, data: { deletedAt: new Date() } });
  await logTransaction({
    userId: session.id,
    action: "creator.delete",
    entityType: "Creator",
    entityId: id,
    detail: "Soft-deleted creator",
  });
  return NextResponse.json({ ok: true });
}