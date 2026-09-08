import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/constants";
import { canExportCreators, canBulkEditCreators } from "@/lib/creators";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json(null, { status: 401 });
  return NextResponse.json({
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    email: user.email,
    roleName: user.roleName,
    teamName: user.teamName,
    teamId: user.teamId,
    isAdmin: user.isAdmin,
    roleSlug: user.roleSlug,
    permissions: user.permissions,
    canCreate: user.permissions.includes(PERMISSIONS.CREATOR_CREATE),
    canExport: await canExportCreators(user),
    canBulkEdit: await canBulkEditCreators(user),
  });
}