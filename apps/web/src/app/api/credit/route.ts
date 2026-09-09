import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { requireApiUser } from "@/lib/api-utils";

export async function GET() {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const settings = await getSettings();
  const account = await prisma.creditAccount.findUnique({
    where: { userId: user.id },
    include: { transactions: { orderBy: { createdAt: "desc" }, take: 200 } },
  });

  return NextResponse.json({
    enabled: settings.creditEnabled,
    currencyCode: settings.currencyCode,
    currencySymbol: settings.currencySymbol,
    balance: account?.balance ?? 0,
    transactions:
      account?.transactions.map((t) => ({
        id: t.id,
        amount: t.amount,
        type: t.type,
        reason: t.reason,
        refType: t.refType,
        refId: t.refId,
        createdAt: t.createdAt.toISOString(),
      })) ?? [],
  });
}