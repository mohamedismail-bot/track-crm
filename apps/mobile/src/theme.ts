export const colors = {
  primary: "#4f46e5",
  primaryLight: "#eef2ff",
  text: "#111827",
  textMuted: "#6b7280",
  border: "#e5e7eb",
  background: "#f9fafb",
  card: "#ffffff",
  danger: "#dc2626",
  success: "#16a34a",
};

export function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}