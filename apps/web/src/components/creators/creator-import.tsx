"use client";

import * as React from "react";
import { Upload, CheckCircle2, MinusCircle, XCircle, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";

export interface ImportRowResult {
  name: string;
  status: "created" | "skipped" | "failed";
  message: string;
}

export interface ImportResult {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  rows: ImportRowResult[];
}

export function ImportCreatorsDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<ImportResult | null>(null);

  const reset = React.useCallback(() => {
    setResult(null);
    setFile(null);
  }, []);

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/creators/import", { method: "POST", body: fd });
      const j = (await res.json()) as ImportResult & { error?: string };
      if (!res.ok) {
        toast({ title: j.error ?? "Import failed", variant: "destructive" });
        return;
      }
      setResult(j);
      if (j.created > 0) onDone();
      toast({ title: `Imported ${j.created} creator${j.created === 1 ? "" : "s"}` });
    } catch {
      toast({ title: "Import failed", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import creators from Excel</DialogTitle>
          <DialogDescription>
            Upload an .xlsx workbook; the header row maps columns to fields. Duplicate creators are
            skipped and problem rows are reported so you can fix and re-import them.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-3">
            <Label htmlFor="import-file" className="flex items-center gap-2">
              <Upload className="h-4 w-4" /> Excel file (.xlsx)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="import-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <a
                href="/api/creators/import/template"
                download="creators-import-template.xlsx"
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-accent"
              >
                <FileDown className="h-4 w-4" /> Template
              </a>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Recognized columns</p>
              <p className="mt-1">
                Name* · Gender* · Country · City · Creator Type · Niche · Phone · Email. A Platform
                Handles column accepts full links, bare handles, or <code>platform:handle</code>{" "}
                entries, and dedicated platform columns work too (Instagram, TikTok, YouTube, X,
                Facebook, LinkedIn, Snapchat, Twitch).
              </p>
              <p className="mt-1">
                Country dial codes build the phone number. Creates skip when a handle, email, or
                phone already exists. New creators are assigned to you (the Admin).
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              {result.created} created · {result.skipped} skipped · {result.failed} failed
            </p>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {result.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">The sheet had no data rows.</p>
              ) : (
                result.rows.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-xs">
                    {r.status === "created" ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    ) : r.status === "skipped" ? (
                      <MinusCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                    ) : (
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium">{r.name || "(no name)"}</p>
                      {r.message ? <p className="text-muted-foreground">{r.message}</p> : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <Button onClick={() => void submit()} disabled={!file || busy}>
              {busy ? "Importing…" : "Import"}
            </Button>
          ) : (
            <Button
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}