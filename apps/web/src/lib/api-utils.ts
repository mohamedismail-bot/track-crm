import { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "@/lib/auth";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireApiUser(): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);
  return user;
}

export function hasPerm(user: SessionUser, permission: string): boolean {
  return user.permissions.includes(permission);
}