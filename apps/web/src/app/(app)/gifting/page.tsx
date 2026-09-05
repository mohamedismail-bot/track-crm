"use client";

import * as React from "react";
import {
  Package,
  Check,
  X,
  Truck,
  ClipboardCheck,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { GiftStatusBadge, formatDateTime } from "@/lib/display";

interface QueueGift {
  id: string;
  productName: string;
  productDescription: string | null;
  status: string;
  isException: boolean;
  exceptionReason: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  requestedAt: string;
  creatorId: string;
  creatorName: string;
  engagementId: string;
  engagementTitle: string;
  teamName: string;
  requestedByName: string;
  requestedByRole: string;
  deliverables: { id: string; status: string }[];
}

export default function GiftingPage() {
  const [gifts, setGifts] = React.useState<QueueGift[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [me, setMe] = React.useState<{
    canApprove: boolean;
    canFulfill: boolean;
  } | null>(null);

  const load = React.useCallback(async (scope = "") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/gifts/queue${scope ? `?scope=${scope}` : ""}`);
      setGifts(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((m) =>
        setMe({
          canApprove: m.permissions?.includes("gift.approve") ?? false,
          canFulfill: m.permissions?.includes("gift.fulfill") ?? false,
        }),
      )
      .catch(() => {});
    load();
  }, [load]);

  const pending = gifts.filter((g) => g.status === "REQUESTED");
  const queued = gifts.filter((g) => g.status === "APPROVED_QUEUED");
  const dispatched = gifts.filter((g) => g.status === "DISPATCHED");
  const delivered = gifts.filter((g) => g.status === "DELIVERED" || g.status === "REJECTED");

  const patch = async (id: string, body: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/gifts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) return toast({ title: data.error ?? "Request failed", variant: "destructive" });
      toast({ title: data.message ?? "Done" });
      load();
    } catch {
      toast({ title: "Request failed", variant: "destructive" });
    }
  };

  const canApprove = me?.canApprove ?? false;
  const canFulfill = me?.canFulfill ?? false;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Gifting</h1>
        <p className="text-sm text-muted-foreground">
          Approvals for team managers, tracking for the warehouse.
        </p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pending approval
            {pending.length > 0 ? (
              <Badge variant="secondary" className="ml-1.5">{pending.length}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="warehouse">Warehouse ({queued.length + dispatched.length})</TabsTrigger>
          <TabsTrigger value="history">History ({delivered.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {canApprove
              ? "Approve gifts for your team. Exception requests are flagged."
              : "You can view pending requests in your team."}
          </p>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : pending.length === 0 ? (
            <EmptyState text="No gifts waiting for approval." />
          ) : (
            pending.map((g) => (
              <Card key={g.id}>
                <CardContent className="pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{g.productName}</p>
                        {g.isException ? (
                          <Badge variant="secondary">
                            <AlertTriangle className="mr-1 h-3 w-3" /> Exception
                          </Badge>
                        ) : null}
                        <GiftStatusBadge status={g.status} />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {g.creatorName} · {g.engagementTitle} · {g.teamName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Requested by {g.requestedByName} · {formatDateTime(g.requestedAt)}
                      </p>
                      {g.exceptionReason ? (
                        <p className="mt-1 text-xs text-muted-foreground">Reason: {g.exceptionReason}</p>
                      ) : null}
                      {g.productDescription ? (
                        <p className="mt-1 text-xs text-muted-foreground">{g.productDescription}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {canApprove ? (
                        <>
                          <Button size="sm" onClick={() => patch(g.id, { action: "approve" })}>
                            <Check className="mr-1 h-4 w-4" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => patch(g.id, { action: "reject", reason: prompt("Rejection reason (optional)") ?? undefined })}
                          >
                            <X className="mr-1 h-4 w-4" /> Reject
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="warehouse" className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {canFulfill
              ? "Log the carrier and tracking number to dispatch, then mark delivered once the creator receives it."
              : "View gifts queued for dispatch."}
          </p>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : queued.length + dispatched.length === 0 ? (
            <EmptyState text="No gifts in the warehouse queue." />
          ) : (
            [...queued, ...dispatched].map((g) => (
              <DispatchCard
                key={g.id}
                gift={g}
                canFulfill={canFulfill}
                onDispatch={(tracking, carrier) =>
                  patch(g.id, { action: "dispatch", trackingNumber: tracking, carrier })
                }
                onDeliver={() => patch(g.id, { action: "deliver" })}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          {delivered.length === 0 ? (
            <EmptyState text="No gift history yet." />
          ) : (
            delivered.map((g) => (
              <Card key={g.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-5">
                  <div>
                    <p className="font-medium">{g.productName}</p>
                    <p className="text-sm text-muted-foreground">
                      {g.creatorName} · {g.teamName}
                    </p>
                    {g.trackingNumber ? (
                      <p className="text-xs text-muted-foreground">
                        {g.carrier} · {g.trackingNumber}
                      </p>
                    ) : null}
                  </div>
                  <GiftStatusBadge status={g.status} />
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DispatchCard({
  gift,
  canFulfill,
  onDispatch,
  onDeliver,
}: {
  gift: QueueGift;
  canFulfill: boolean;
  onDispatch: (tracking: string, carrier: string) => void;
  onDeliver: () => void;
}) {
  const [tracking, setTracking] = React.useState(gift.trackingNumber ?? "");
  const [carrier, setCarrier] = React.useState(gift.carrier ?? "");
  const dispatched = gift.status === "DISPATCHED";

  return (
    <Card key={gift.id}>
      <CardContent className="pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{gift.productName}</p>
              {gift.isException ? <Badge variant="secondary">Exception</Badge> : null}
              <GiftStatusBadge status={gift.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {gift.creatorName} · {gift.engagementTitle} · {gift.teamName}
            </p>
          </div>
        </div>
        {canFulfill ? (
          dispatched ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm">
                <ClipboardCheck className="mr-1 inline h-4 w-4 text-emerald-600" />
                Dispatched
              </span>
              <span className="text-sm text-muted-foreground">
                {gift.carrier} · {gift.trackingNumber}
              </span>
              <Button size="sm" variant="secondary" className="ml-auto" onClick={onDeliver}>
                <Check className="mr-1 h-4 w-4" /> Mark delivered
              </Button>
            </div>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-1">
                <Label htmlFor={`carrier-${gift.id}`}>Carrier</Label>
                <Input
                  id={`carrier-${gift.id}`}
                  placeholder="DHL, Aramex…"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`tracking-${gift.id}`}>Tracking number</Label>
                <Input
                  id={`tracking-${gift.id}`}
                  placeholder="Tracking number"
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => onDispatch(tracking.trim(), carrier.trim())}
                  disabled={!tracking.trim() || !carrier.trim()}
                >
                  <Truck className="mr-1 h-4 w-4" /> Dispatch
                </Button>
              </div>
            </div>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border p-10 text-center text-muted-foreground">
      <Package className="h-6 w-6" />
      <p className="text-sm">{text}</p>
    </div>
  );
}