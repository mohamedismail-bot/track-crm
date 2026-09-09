"use client";

import * as React from "react";
import { Plus, Save, Send, Trash2, PackagePlus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/display";
import type { DealType } from "@prisma/client";

export interface OrderEngagement {
  id: string;
  title: string;
  dealType: DealType;
  currency: string;
  team: { name: string };
}

export interface OrderProduct {
  id: string;
  name: string;
  unitCost: number;
  categoryId: string;
}

export interface OrderLine {
  id: string;
  productId: string | null;
  productName: string;
  unitCost: number;
  quantity: number;
  lineTotal: number;
}

export interface DraftOrder {
  id: string;
  engagementId: string;
  shippingAddress: string | null;
  agreedBudget: number | null;
  commissionRate: number | null;
  couponCode: string | null;
  currency: string;
  lines: OrderLine[];
  agreement: { title: string; type: string; dueDate: string }[] | null;
}

interface LineDraft {
  key: string;
  categoryId: string;
  productId: string | null;
  productName: string;
  unitCost: string;
  quantity: string;
}

interface DeliverableRow {
  key: string;
  title: string;
  type: string;
  dueDate: string;
}

let uid = 0;
const nextKey = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++uid}`;

function lineFromDraft(l: OrderLine): LineDraft {
  return {
    key: nextKey("line"),
    categoryId: l.productId ? "" : "",
    productId: l.productId,
    productName: l.productName,
    unitCost: String(l.unitCost ?? 0),
    quantity: String(l.quantity ?? 1),
  };
}

export function GiftOrderDialog({
  open,
  onOpenChange,
  creatorName,
  engagements,
  draft,
  previousAddresses,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  creatorName: string;
  engagements: OrderEngagement[];
  draft: DraftOrder | null;
  previousAddresses: string[];
  onSubmitted: () => void;
}) {
  const available = engagements.length > 0;

  const [engagementId, setEngagementId] = React.useState("");
  const [agreedBudget, setAgreedBudget] = React.useState("");
  const [commissionRate, setCommissionRate] = React.useState("");
  const [couponCode, setCouponCode] = React.useState("");
  const [shipping, setShipping] = React.useState("");
  const [lines, setLines] = React.useState<LineDraft[]>([
    { key: nextKey("line"), categoryId: "", productId: null, productName: "", unitCost: "", quantity: "1" },
  ]);
  const [deliverables, setDeliverables] = React.useState<DeliverableRow[]>([
    { key: nextKey("deliverable"), title: "", type: "Video", dueDate: "" },
  ]);
  const [categories, setCategories] = React.useState<
    { id: string; name: string; products: OrderProduct[] }[]
  >([]);
  const [busy, setBusy] = React.useState(false);

  const loadCatalog = React.useCallback(async () => {
    try {
      const res = await fetch("/api/catalog");
      if (!res.ok) return;
      const j = await res.json();
      setCategories(j.categories ?? []);
    } catch {
      /* catalog optional; custom lines still work */
    }
  }, []);

  const applyDraft = React.useCallback((d: DraftOrder | null) => {
    setEngagementId(d?.engagementId ?? "");
    setAgreedBudget(d?.agreedBudget != null ? String(d.agreedBudget) : "");
    setCommissionRate(d?.commissionRate != null ? String(d.commissionRate) : "");
    setCouponCode(d?.couponCode ?? "");
    setShipping(d?.shippingAddress ?? "");
    setLines(d?.lines?.length ? d.lines.map(lineFromDraft) : [{ key: nextKey("line"), categoryId: "", productId: null, productName: "", unitCost: "", quantity: "1" }]);
    setDeliverables(
      d?.agreement?.length
        ? d.agreement.map((a) => ({ key: nextKey("deliverable"), title: a.title, type: a.type, dueDate: a.dueDate }))
        : [{ key: nextKey("deliverable"), title: "", type: "Video", dueDate: "" }],
    );
  }, []);

  // Reset the form whenever the dialog opens: fresh row or from a draft.
  React.useEffect(() => {
    if (!open) return;
    loadCatalog();
    applyDraft(draft);
  }, [open, draft, loadCatalog, applyDraft]);

  const engagement = engagements.find((e) => e.id === engagementId);

  const setLine = (key: string, patch: Partial<LineDraft>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const refreshProductInfo = (line: LineDraft, productId: string) => {
    for (const c of categories) {
      const p = c.products.find((pp) => pp.id === productId);
      if (p) {
        setLines((ls) =>
          ls.map((l) =>
            l.key === line.key
              ? { ...l, productId: p.id, categoryId: p.categoryId, productName: p.name, unitCost: String(p.unitCost) }
              : l,
          ),
        );
        return;
      }
    }
  };

  const orderTotal = React.useMemo(() => {
    return lines.reduce((sum, l) => {
      const cost = Number(l.unitCost) || 0;
      const qty = Math.max(1, Number(l.quantity) || 1);
      return sum + cost * qty;
    }, 0);
  }, [lines]);

  const submit = async (action: "draft" | "submit") => {
    if (!engagementId) return toast({ title: "Pick an engagement first.", variant: "destructive" });
    const validLines = lines.filter((l) => l.productId || l.productName.trim());
    if (action === "submit" && validLines.length === 0) {
      return toast({ title: "Add at least one product line.", variant: "destructive" });
    }
    if (action === "submit" && !shipping.trim()) {
      return toast({ title: "A shipping address is required.", variant: "destructive" });
    }
    setBusy(true);
    try {
      const res = await fetch("/api/gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engagementId,
          action,
          agreedBudget: agreedBudget.trim() ? Number(agreedBudget) : undefined,
          commissionRate: commissionRate.trim() ? Number(commissionRate) : undefined,
          couponCode: couponCode.trim() || undefined,
          shippingAddress: shipping.trim() || undefined,
          lines: validLines.map((l) => ({
            productId: l.productId ?? undefined,
            productName: l.productName.trim() || undefined,
            unitCost: l.unitCost.trim() ? Number(l.unitCost) : 0,
            quantity: Number(l.quantity) || 1,
          })),
          deliverables: deliverables
            .filter((d) => d.title.trim())
            .map((d) => ({ title: d.title.trim(), type: d.type.trim() || "Video", dueDate: d.dueDate })),
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        if (j.missingFields?.length) {
          return toast({
            title: "This creator is missing data required for gifting",
            description: `Missing: ${j.missingFields.join(", ")}`,
            variant: "destructive",
          });
        }
        return toast({ title: j.error ?? "Could not save the gift order", variant: "destructive" });
      }
      toast({ title: j.message ?? (action === "draft" ? "Draft saved" : "Gift order submitted") });
      onOpenChange(false);
      onSubmitted();
    } catch {
      toast({ title: "Could not save the gift order", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const productsIn = (categoryId: string) =>
    categories.find((c) => c.id === categoryId)?.products ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5" /> {draft ? "Continue gift order draft" : "New gift order"}
          </DialogTitle>
          <DialogDescription>
            {draft ? "Finish the draft for" : "Send products to"} {creatorName}. Every order is sent for approval.
          </DialogDescription>
        </DialogHeader>

        {!available ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            This creator has no engagement you can order against.
          </p>
        ) : (
          <div className="space-y-5">
            {/* Engagement + agreement */}
            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm font-semibold">Engagement &amp; agreement</p>
              <div>
                <Label htmlFor="order-engagement">Engagement</Label>
                <Select value={engagementId} onValueChange={setEngagementId}>
                  <SelectTrigger id="order-engagement" className="mt-1 w-full">
                    <SelectValue placeholder="Pick an engagement" />
                  </SelectTrigger>
                  <SelectContent>
                    {engagements.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.title} · {e.team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {engagement?.dealType === "FIXED_BUDGET" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="order-budget">Agreed budget ({engagement.currency})</Label>
                    <Input
                      id="order-budget"
                      type="number"
                      min="0"
                      className="mt-1"
                      placeholder="0"
                      value={agreedBudget}
                      onChange={(e) => setAgreedBudget(e.target.value)}
                    />
                  </div>
                </div>
              ) : null}
              {engagement?.dealType === "COMMISSION" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="order-commission">Commission rate (%)</Label>
                    <Input
                      id="order-commission"
                      type="number"
                      min="0"
                      step="0.1"
                      className="mt-1"
                      placeholder="10"
                      value={commissionRate}
                      onChange={(e) => setCommissionRate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="order-coupon">Coupon code (optional)</Label>
                    <Input
                      id="order-coupon"
                      className="mt-1"
                      placeholder="CODE10"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                    />
                  </div>
                </div>
              ) : null}
              {engagement && engagement.dealType !== "FIXED_BUDGET" && engagement.dealType !== "COMMISSION" ? (
                <p className="text-xs text-muted-foreground">
                  Barter engagement — no budget terms captured.
                </p>
              ) : null}
            </div>

            {/* Product lines */}
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Products</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setLines((ls) => [...ls, { key: nextKey("line"), categoryId: "", productId: null, productName: "", unitCost: "", quantity: "1" }])
                  }
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add line
                </Button>
              </div>
              {lines.map((l, i) => (
                <div key={l.key} className="grid gap-2 rounded-md border bg-muted/40 p-3 sm:grid-cols-[1fr_1fr_52px_72px_32px] sm:items-end">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">{i === 0 ? "Product" : `Product ${i + 1}`}</Label>
                    {categories.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        <Select value={l.categoryId} onValueChange={(v) => setLine(l.key, { categoryId: v, productId: null, productName: "", unitCost: "" })}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={l.productId ?? undefined}
                          onValueChange={(v) => refreshProductInfo(l, v)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder={l.categoryId ? "Product" : "Pick category first"} />
                          </SelectTrigger>
                          <SelectContent>
                            {productsIn(l.categoryId).map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <Input
                        className="mt-1 h-9"
                        placeholder="e.g. Moisturizing cream"
                        value={l.productName}
                        onChange={(e) => setLine(l.key, { productName: e.target.value, productId: null })}
                      />
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Unit cost</Label>
                    <Input
                      className="h-9"
                      type="number"
                      min="0"
                      value={l.unitCost}
                      readOnly={!!l.productId}
                      onChange={(e) => setLine(l.key, { unitCost: e.target.value, productId: null })}
                      onFocus={(e) => categories.length > 0 && l.productId && e.target.select()}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Qty</Label>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setLine(l.key, { quantity: String(Math.max(1, (Number(l.quantity) || 1) - 1)) })}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        className="h-9 px-1 text-center"
                        type="number"
                        min="1"
                        value={l.quantity}
                        onChange={(e) => setLine(l.key, { quantity: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setLine(l.key, { quantity: String((Number(l.quantity) || 1) + 1) })}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-8" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <p className="text-right text-sm font-semibold">
                Order total: {formatMoney(orderTotal, engagement?.currency ?? "EGP")}
              </p>
            </div>

            {/* Deliverables */}
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Content expected in return</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDeliverables((ds) => [...ds, { key: nextKey("deliverable"), title: "", type: "Video", dueDate: "" }])}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add deliverable
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Written to the engagement deliverables when the order is approved.
              </p>
              {deliverables.map((d) => (
                <div key={d.key} className="grid gap-2 sm:grid-cols-[1fr_120px_150px_32px] sm:items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Title</Label>
                    <Input className="mt-0 h-9" placeholder="e.g. Lifestlye reel" value={d.title} onChange={(e) => setDeliverables((ds) => ds.map((x) => (x.key === d.key ? { ...x, title: e.target.value } : x)))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Input className="mt-0 h-9" placeholder="Reel" value={d.type} onChange={(e) => setDeliverables((ds) => ds.map((x) => (x.key === d.key ? { ...x, type: e.target.value } : x)))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Due date</Label>
                    <Input className="mt-0 h-9" type="date" value={d.dueDate} onChange={(e) => setDeliverables((ds) => ds.map((x) => (x.key === d.key ? { ...x, dueDate: e.target.value } : x)))} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-8" disabled={deliverables.length === 1} onClick={() => setDeliverables((ds) => ds.filter((x) => x.key !== d.key))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Shipping */}
            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm font-semibold">Shipping address</p>
              <Input
                id="order-shipping"
                list="previous-addresses"
                placeholder="Full street address, area, city"
                value={shipping}
                onChange={(e) => setShipping(e.target.value)}
              />
              <datalist id="previous-addresses">
                {previousAddresses.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
              {previousAddresses.length > 0 ? (
                <p className="text-xs text-muted-foreground">Previously used addresses are offered as suggestions.</p>
              ) : null}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {available ? (
            <>
              <Button variant="secondary" disabled={busy} onClick={() => submit("draft")}>
                <Save className="mr-1 h-4 w-4" /> {busy ? "Saving…" : "Save draft"}
              </Button>
              <Button disabled={busy || !available} onClick={() => submit("submit")}>
                <Send className="mr-1 h-4 w-4" /> {busy ? "Submitting…" : "Submit for approval"}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}