import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { PrintLabelButton } from "@/components/gifts/print-label-button";

export const metadata: Metadata = { title: "Shipping label · Parishia Smart" };

export default async function GiftLabelPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  const { id } = await params;

  const gift = await prisma.gift.findUnique({
    where: { id },
    include: {
      status: true,
      lines: { orderBy: { id: "asc" } },
      engagement: {
        include: {
          creator: { include: { cityRef: true } },
          team: true,
        },
      },
    },
  });

  if (!gift) redirect("/gifting");
  // Warehouse/fullfillment users may view all teams' labels; everyone else only
  // their own team's orders.
  if (!user.permissions.includes("gift.fulfill") && user.roleSlug !== "admin" && gift.engagement.teamId !== user.teamId) {
    redirect("/gifting");
  }

  const creator = gift.engagement.creator;
  const city = creator.cityRef?.name ?? creator.city;
  const lines = gift.lines;

  return (
    <main className="min-h-full bg-muted/40 py-8 print:bg-white print:py-0">
      <div className="mx-auto w-full max-w-2xl px-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Shipping label</h1>
            <p className="text-sm text-muted-foreground">
              Gift order #{gift.orderNumber} · {gift.status.label}
            </p>
          </div>
          <PrintLabelButton />
        </div>

        <LabelCard
          orderNumber={gift.orderNumber}
          creatorName={creator.name}
          phone={creator.phone}
          city={city}
          shippingAddress={gift.shippingAddress}
          lines={lines.map((l) => ({
            productName: l.productName,
            quantity: l.quantity,
            unitCost: l.unitCost,
            lineTotal: l.lineTotal,
          }))}
          orderTotal={gift.orderTotal}
          currency={gift.currency}
          carrier={gift.carrier}
          trackingNumber={gift.trackingNumber}
        />
      </div>
    </main>
  );
}

function LabelCard({
  orderNumber,
  creatorName,
  phone,
  city,
  shippingAddress,
  lines,
  orderTotal,
  currency,
  carrier,
  trackingNumber,
}: {
  orderNumber: number;
  creatorName: string;
  phone: string | null;
  city: string | null;
  shippingAddress: string | null;
  lines: { productName: string; quantity: number; unitCost: number; lineTotal: number }[];
  orderTotal: number;
  currency: string;
  carrier: string | null;
  trackingNumber: string | null;
}) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="border-b pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">To</p>
            <p className="mt-1 text-lg font-semibold">{creatorName}</p>
            <p className="text-sm text-muted-foreground">
              {phone ?? "No phone"} · {city ?? "No city"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Order</p>
            <p className="mt-1 text-lg font-semibold">#{orderNumber}</p>
          </div>
        </div>
        <div className="mt-3 rounded-lg bg-muted/50 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Shipping address</p>
          <p className="mt-1 text-sm font-medium">{shippingAddress ?? "No shipping address on file"}</p>
        </div>
      </div>

      <div className="py-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="pb-2">Item</th>
              <th className="pb-2 text-right">Qty</th>
              <th className="pb-2 text-right">Unit</th>
              <th className="pb-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-t">
                <td className="py-1.5 font-medium">{l.productName}</td>
                <td className="py-1.5 text-right">× {l.quantity}</td>
                <td className="py-1.5 text-right">{formatMoney(l.unitCost)}</td>
                <td className="py-1.5 text-right">{formatMoney(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2">
              <td colSpan={3} className="py-2 text-right font-semibold">
                Order total
              </td>
              <td className="py-2 text-right font-semibold">
                {formatMoney(orderTotal)} {currency}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {trackingNumber ? (
        <div className="flex flex-wrap gap-4 border-t pt-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Carrier</p>
            <p className="font-medium">{carrier ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Tracking</p>
            <p className="font-mono font-medium">{trackingNumber}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}