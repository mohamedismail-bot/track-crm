"use client";

import * as React from "react";
import Link from "next/link";
import { Check, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/display";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export default function NotificationsPage() {
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      setItems(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const notifyUpdated = () => window.dispatchEvent(new Event("notifications-updated"));

  const markRead = async (id: string) => {
    const res = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) return toast({ title: "Could not update notification", variant: "destructive" });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    notifyUpdated();
  };

  const markAllRead = async () => {
    const res = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    if (!res.ok) return toast({ title: "Could not update notifications", variant: "destructive" });
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    toast({ title: "All notifications marked read" });
    notifyUpdated();
  };

  const unread = items.filter((n) => !n.readAt).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unread > 0 ? `${unread} unread` : "All caught up"}
          </p>
        </div>
        {unread > 0 ? (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <Check className="mr-1 h-4 w-4" /> Mark all read
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border p-12 text-center text-muted-foreground">
          <BellOff className="h-6 w-6" />
          <p className="text-sm">No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((n) => (
            <Card
              key={n.id}
              className={n.readAt ? "opacity-70" : "border-primary/30 bg-primary/[0.03]"}
            >
              <CardContent className="flex items-start gap-3 pt-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm font-medium ${n.readAt ? "" : "text-primary"}`}>
                      {n.title}
                    </span>
                    {!n.readAt ? <Badge variant="secondary" className="px-1.5 text-[10px]">new</Badge> : null}
                  </div>
                  {n.body ? <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p> : null}
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {n.link ? (
                    <Button asChild size="sm" variant="ghost">
                      <Link href={n.link}>Open</Link>
                    </Button>
                  ) : null}
                  {!n.readAt ? (
                    <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}