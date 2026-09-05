import type { Contact, Deal, Activity, DashboardStats } from "@track-crm/shared";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(
      body?.error ? JSON.stringify(body.error) : `Request failed: ${res.status}`,
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  stats: () => request<DashboardStats>("/api/stats"),
  contacts: {
    list: (q?: string, status?: string) =>
      request<Contact[]>(
        `/api/contacts${q || status ? `?${new URLSearchParams(
          Object.entries({
            ...(q ? { q } : {}),
            ...(status ? { status } : {}),
          }),
        )}` : ""}`,
      ),
    create: (body: Partial<Contact>) =>
      request<Contact>("/api/contacts", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<Contact>) =>
      request<Contact>(`/api/contacts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id: string) =>
      request<void>(`/api/contacts/${id}`, { method: "DELETE" }),
  },
  deals: {
    list: () => request<Deal[]>(`/api/deals`),
    create: (body: Partial<Deal>) =>
      request<Deal>("/api/deals", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<Deal>) =>
      request<Deal>(`/api/deals/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id: string) => request<void>(`/api/deals/${id}`, { method: "DELETE" }),
  },
  activities: {
    list: () => request<Activity[]>(`/api/activities`),
    create: (body: Partial<Activity>) =>
      request<Activity>("/api/activities", { method: "POST", body: JSON.stringify(body) }),
    remove: (id: string) => request<void>(`/api/activities/${id}`, { method: "DELETE" }),
  },
};