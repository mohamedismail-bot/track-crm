"use client";

import * as React from "react";
import Link from "next/link";
import { Check, X, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/display";

interface RequestItem {
  id: string;
  creatorId: string;
  creatorName: string;
  requestingTeamName: string;
  owningTeamName: string;
  requesterName: string;
  note: string | null;
  status: string;
  createdAt: string;
  stage: string;
}

export default function RequestsPage() {
  const [items, setItems] = React.useState<RequestItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/availability-requests");
      setItems(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, decision: "approve" | "reject") => {
    const reason =
      decision === "reject"
        ? prompt("Rejection reason (optional)") ?? undefined
        : undefined;
    try {
      const res = await fetch(`/api/availability-requests/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason }),
      });
      const j = await res.json();
      if (!res.ok) return toast({ title: j.error ?? "Request failed", variant: "destructive" });
      toast({ title: "Done" });
      load();
    } catch {
      toast({ title: "Request failed", variant: "destructive" });
    }
  };

  const pending = items.filter((r) => r.status !== "APPROVED" && r.status !== "REJECTED");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Availability requests</h1>
        <p className="text-sm text-muted-foreground">
          Pre-approve your team&apos;s requests, then release creators owned by your team.
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : pending.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border p-12 text-center text-muted-foreground">
          <Inbox className="h-6 w-6" />
          <p className="text-sm">No pending availability requests.</p>
        </div>
      ) : (
        pending.map((r) => (
          <Card key={r.id}>
            <CardContent className="pt-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/creators/${r.creatorId}`} className="font-medium hover:underline">
                      {r.creatorName}
                    </Link>
                    <Badge variant={r.stage === "pre_approval" ? "secondary" : "outline"}>
                      {r.stage === "pre_approval"
                        ? "Your team's pre-approval"
                        : "Release by owning team"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {r.requesterName} ({r.requestingTeamName}) → {r.owningTeamName} ·{" "}
                    {formatDateTime(r.createdAt)}
                  </p>
                  {r.note ? <p className="mt-1 text-xs text-muted-foreground">Note: {r.note}</p> : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={() => act(r.id, "approve")}>
                    <Check className="mr-1 h-4 w-4" />
                    {r.stage === "release" ? "Release" : "Approve"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => act(r.id, "reject")}>
                    <X className="mr-1 h-4 w-4" /> Reject
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}