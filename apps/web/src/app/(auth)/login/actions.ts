"use server";

import { redirect } from "next/navigation";
import { verifyCredentials, createSession, destroySession } from "@/lib/auth";
import { logTransaction } from "@/lib/activity";

export async function loginAction(_prev: unknown, formData: FormData) {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!identifier || !password) {
    return { error: "Enter your email or phone and password." };
  }

  const user = await verifyCredentials(identifier, password);
  if (!user) {
    return { error: "Invalid credentials. Check your email/phone and password." };
  }

  await createSession({
    id: user.id,
    email: user.email,
    phone: user.phone,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    roleId: user.roleId,
    teamId: user.teamId,
  });
  await logTransaction({ userId: user.id, action: "login", entityType: "session" });

  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}