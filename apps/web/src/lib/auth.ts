import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { PERMISSIONS } from "./constants";

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-only-change-me-0123456789abcdef0123456789abcdef",
);
const SESSION_COOKIE = "track_crm_session";
const SESSION_MS = 1000 * 60 * 60 * 24 * 7;

export interface SessionUser {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  avatarUrl: string | null;
  roleId: string;
  roleSlug: string;
  roleName: string;
  teamId: string;
  teamName: string;
  permissions: string[];
  isAdmin: boolean;
}

interface SessionPayload {
  sub: string;
  email: string | null;
  phone: string | null;
  name: string;
  avatar: string | null;
  roleId: string;
  roleSlug: string;
  roleName: string;
  teamId: string;
  teamName: string;
  perms: string[];
  iat: number;
  exp: number;
}

async function sign(payload: Omit<SessionPayload, "iat" | "exp">): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + SESSION_MS) / 1000))
    .sign(SECRET);
}

async function verify(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(user: {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  avatarUrl: string | null;
  roleId: string;
  teamId: string;
}) {
  const [role, team] = await Promise.all([
    prisma.role.findUnique({
      where: { id: user.roleId },
      include: { permissions: true },
    }),
    prisma.team.findUnique({ where: { id: user.teamId } }),
  ]);
  if (!role || !team) throw new Error("User role or team missing");

  const payload = {
    sub: user.id,
    email: user.email,
    phone: user.phone,
    name: user.displayName,
    avatar: user.avatarUrl,
    roleId: role.id,
    roleSlug: role.slug,
    roleName: role.name,
    teamId: team.id,
    teamName: team.name,
    perms: role.permissions.map((p) => p.action),
  };

  const token = await sign(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MS / 1000,
    path: "/",
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verify(token);
  if (!payload) return null;
  return {
    id: payload.sub,
    email: payload.email,
    phone: payload.phone,
    displayName: payload.name,
    avatarUrl: payload.avatar,
    roleId: payload.roleId,
    roleSlug: payload.roleSlug,
    roleName: payload.roleName,
    teamId: payload.teamId,
    teamName: payload.teamName,
    permissions: payload.perms,
    isAdmin: payload.roleSlug === "admin",
  };
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export function requirePermission(user: SessionUser, permission: string) {
  if (!user.permissions.includes(permission)) {
    throw new Error("You do not have permission to perform this action.");
  }
}

export async function verifyCredentials(identifier: string, password: string) {
  const user = await prisma.user.findFirst({
    where: {
      archivedAt: null,
      OR: [{ email: identifier.toLowerCase().trim() }, { phone: identifier.trim() }],
    },
    include: { role: { include: { permissions: true } }, team: true },
  });
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return user;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function isAdminRole(roleSlug: string): boolean {
  return roleSlug === "admin";
}

export const AUTH_PERMISSIONS = PERMISSIONS;