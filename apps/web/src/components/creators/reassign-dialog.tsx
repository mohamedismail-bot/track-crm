"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { toast } from "@/components/ui/toast";

interface OwnerOption {
  id: string;
  displayName: string;
  teamId: string | null;
  roleSlug: string;
}

/**
 * Reassign a creator to other user(s), reachable from every creators view.
 * Admins and the team's Team Manager(s) are always owners and stay assigned —
 * this dialog changes the working owners only.
 */
export function ReassignCreatorDialog({
  open,
  onOpenChange,
  creatorId,
  creatorName,
  currentOwnerIds,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorId: string;
  creatorName: string;
  currentOwnerIds?: string[];
  onDone?: () => void;
}) {
  const [owners, setOwners] = React.useState<OwnerOption[]>([]);
  const [me, setMe] = React.useState<{ id: string; teamId: string | null; roleSlug: string | null } | null>(null);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSelected(Array.isArray(currentOwnerIds) ? currentOwnerIds.filter(Boolean) : []);
    (async () => {
      const [meRes, optsRes] = await Promise.all([
        fetch("/api/me"),
        fetch("/api/creators/options"),
      ]);
      if (cancelled) return;
      const m = meRes.ok ? await meRes.json() : null;
      const opts = optsRes.ok ? await optsRes.json() : null;
      setMe(m ? { id: m.id, teamId: m.teamId ?? null, roleSlug: m.roleSlug ?? null } : null);
      setOwners((opts?.owners ?? []).map((o: OwnerOption) => ({
        id: o.id,
        displayName: o.displayName,
        teamId: o.teamId ?? null,
        roleSlug: o.roleSlug ?? "",
      })));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, currentOwnerIds]);

  const mayAssignCrossTeam = me?.roleSlug === "admin" || me?.roleSlug === "team-manager";

  const hardIds = React.useMemo(() => {
    const hard = owners.filter(
      (o) =>
        o.roleSlug === "admin" ||
        (o.roleSlug === "team-manager" && o.teamId === (me?.teamId ?? null)),
    );
    return new Set(hard.map((o) => o.id));
  }, [owners, me]);

  const assignable: MultiSelectOption[] = React.useMemo(() => {
    return owners
      .filter((o) => {
        if (hardIds.has(o.id)) return false;
        if (mayAssignCrossTeam) return true;
        // Same-team only (unless admin/team-manager).
        return o.teamId != null && o.teamId === me?.teamId;
      })
      .map((o) => ({ value: o.id, label: o.displayName }));
  }, [owners, hardIds, me, mayAssignCrossTeam]);

  // Prune any pre-selected owners who are not assignable (e.g. team changed).
  const selectedInScope = React.useMemo(() => {
    const allowed = new Set(assignable.map((a) => a.value));
    return selected.filter((id) => allowed.has(id) || hardIds.has(id));
  }, [selected, assignable, hardIds]);

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/creators/${creatorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerIds: selectedInScope }),
      });
      const j = await res.json();
      if (!res.ok) return toast({ title: j.error ?? "Could not reassign", variant: "destructive" });
      toast({ title: "Owners updated" });
      onOpenChange(false);
      onDone?.();
    } catch {
      toast({ title: "Could not reassign", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reassign {creatorName}</DialogTitle>
          <DialogDescription>
            {mayAssignCrossTeam
              ? "Choose who should work this creator. Admins and managers stay assigned automatically."
              : "Choose a member of your team to work this creator. Admins and your team's managers stay assigned automatically."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Assigned to</Label>
          <MultiSelect
            options={assignable}
            value={selectedInScope}
            onChange={setSelected}
            placeholder={mayAssignCrossTeam ? "Select team members…" : "Select your team members…"}
          />
          <p className="text-xs text-muted-foreground">
            Clear the selection to leave only the automatic admin / manager owners.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}