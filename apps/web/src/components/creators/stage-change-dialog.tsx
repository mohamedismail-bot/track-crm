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

/**
 * PATCH an engagement to a new stage, optionally carrying a reason. The reason
 * is recorded on the creator's activity log so every stage change is audited.
 */
export async function moveStageWithReason(
  engagementId: string,
  stageId: string,
  reason: string,
): Promise<{ ok: boolean; stageName?: string; error?: string }> {
  try {
    const res = await fetch(`/api/engagements/${engagementId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "move-stage", stageId, reason }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? "Failed to move stage" };
    return { ok: true, stageName: data.stageName };
  } catch {
    return { ok: false, error: "Something went wrong" };
  }
}

interface StageChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. "Move to Agreed" */
  title: string;
  /** e.g. "Sales review agreed" */
  description?: string;
  /** Called with the entered reason when the user confirms. */
  onConfirm: (reason: string) => void;
  busy?: boolean;
}

/** Require a reason before any stage change, from every surface. */
export function StageChangeDialog({ open, onOpenChange, title, description, onConfirm, busy }: StageChangeDialogProps) {
  const [reason, setReason] = React.useState("");
  const canSubmit = reason.trim().length >= 3;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setReason("");
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ?? "Stage changes are recorded on the creator's activity log."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="stage-reason" className="inline-flex items-center gap-1">
            Reason <span className="text-destructive">*</span>
          </Label>
          <textarea
            id="stage-reason"
            autoFocus
            className="min-h-[84px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground"
            placeholder="Why is this creator moving to this stage?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Required — shown on the creator&apos;s timeline.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (canSubmit) onConfirm(reason.trim());
            }}
            disabled={!canSubmit || busy}
          >
            {busy ? "Moving…" : "Confirm move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}