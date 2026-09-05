"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";

interface CreatorFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (creator: { id: string; name: string }) => void;
}

export function CreatorFormDialog({ open, onOpenChange, onCreated }: CreatorFormProps) {
  const [submitting, setSubmitting] = React.useState(false);
  const [urls, setUrls] = React.useState<string[]>([""]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const profiles = urls
      .map((u) => u.trim())
      .filter(Boolean)
      .map((url) => ({ url }));

    if (!name) return toast({ title: "Name is required", variant: "destructive" });
    if (profiles.length === 0)
      return toast({ title: "Add at least one platform profile", variant: "destructive" });

    setSubmitting(true);
    try {
      const res = await fetch("/api/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: form.get("email") || undefined,
          phone: form.get("phone") || undefined,
          niche: form.get("niche") || undefined,
          city: form.get("city") || undefined,
          country: form.get("country") || undefined,
          creatorType: form.get("creatorType") || undefined,
          followers: form.get("followers") || undefined,
          engagementRate: form.get("engagementRate") || undefined,
          notes: form.get("notes") || undefined,
          avatarUrl: form.get("avatarUrl") || undefined,
          profiles,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return toast({ title: data.error ?? "Could not create creator", variant: "destructive" });
      }
      toast({ title: "Creator created", description: data.name });
      onOpenChange(false);
      setUrls([""]);
      onCreated?.(data);
    } catch {
      toast({ title: "Could not create creator", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add creator</DialogTitle>
          <DialogDescription>
            Track the person, not the profile. Add one or more platform profile links.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" placeholder="Creator name" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="name@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" type="tel" placeholder="+20 …" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="niche">Niche</Label>
              <Input id="niche" name="niche" placeholder="Fashion, tech, food…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" placeholder="Cairo" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="country">Country</Label>
              <Input id="country" name="country" placeholder="Egypt" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="followers">Followers</Label>
              <Input id="followers" name="followers" type="number" placeholder="120000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="engagementRate">Engagement rate (%)</Label>
              <Input id="engagementRate" name="engagementRate" type="number" step="0.1" placeholder="3.5" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="creatorType">Type</Label>
              <Input id="creatorType" name="creatorType" placeholder="Blogger / Podcaster / YouTuber" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="avatarUrl">Avatar URL</Label>
              <Input id="avatarUrl" name="avatarUrl" placeholder="https://…" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Platform profiles *</Label>
            {urls.map((u, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={u}
                  onChange={(e) => setUrls((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))}
                  placeholder="https://instagram.com/handle"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground"
                  onClick={() => setUrls((prev) => prev.filter((_, j) => j !== i))}
                  disabled={urls.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1"
              onClick={() => setUrls((prev) => [...prev, ""])}
            >
              <Plus className="mr-1 h-4 w-4" /> Add another profile
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" placeholder="Anything relevant about this creator" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create creator"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}