"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Grid2X2, Table2, KanbanSquare, Plus, Search, Upload, SlidersHorizontal, Check, ArrowUpDown, RotateCcw, X, Layers, ShieldAlert } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { toast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CreatorCard, type CreatorListItem } from "@/components/creators/creator-card";
import { CreatorsTable } from "@/components/creators/creators-table";
import { KanbanBoard, type KanbanStage } from "@/components/creators/kanban-board";
import { CreatorFormDialog } from "@/components/creators/creator-form";
import { ImportCreatorsDialog } from "@/components/creators/creator-import";
import { groupCreators, GROUP_BY_OPTIONS, type GroupByKey } from "@/lib/grouping";

type View = "card" | "table" | "kanban";

function GroupedCreatorCards({
  creators,
  groupBy,
  onStageChanged,
  onReassigned,
}: {
  creators: CreatorListItem[];
  groupBy: GroupByKey;
  onStageChanged?: (id: string, stage: { id: string; name: string } | null) => void;
  onReassigned?: () => void;
}) {
  if (creators.length === 0) {
    return (
      <div className="rounded-xl border p-10 text-center text-muted-foreground">
        No creators found. Try adjusting your filters or add a creator.
      </div>
    );
  }

  const renderGrid = (items: CreatorListItem[]) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((c) => (
        <CreatorCard
          key={c.id}
          creator={c}
          onStageChanged={onStageChanged}
          onReassigned={onReassigned}
        />
      ))}
    </div>
  );

  if (groupBy === "none") return renderGrid(creators);

  const groups = groupCreators(creators, groupBy);
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.label}>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            {g.label}
            <span className="rounded-full border px-2 py-0.5 text-xs font-normal">
              {g.items.length}
            </span>
          </h3>
          {renderGrid(g.items)}
        </section>
      ))}
    </div>
  );
}

interface FilterOption {
  value: string;
  label: string;
}

interface ReferenceData {
  countries: { id: string; name: string; dialCode: string; cities: { id: string; name: string }[] }[];
  creatorTypes: { id: string; name: string }[];
  fields: { id: string | null; key: string | null; label: string; type: string; options: string[] }[];
  genderOptions: string[];
  nicheOptions: string[];
  approvalEnabled: boolean;
}

export default function CreatorsPage() {
  const params = useSearchParams();
  const [view, setView] = React.useState<View>("card");
  const [groupBy, setGroupBy] = React.useState<GroupByKey>("none");
  const [creators, setCreators] = React.useState<CreatorListItem[]>([]);
  const [stages, setStages] = React.useState<KanbanStage[]>([]);
  const [teams, setTeams] = React.useState<FilterOption[]>([
    { value: "all-team", label: "All teams" },
    { value: "unassigned", label: "Unassigned" },
  ]);
  const [loading, setLoading] = React.useState(true);
  const [formOpen, setFormOpen] = React.useState(false);
  const drillParam = !!(params.get("stage") || params.get("pool") || params.get("q") || (params.get("owner") && params.get("owner") !== "me") || params.get("pending") || params.get("overdue") || params.get("upcoming") || params.get("incomplete"));
  const [filters, setFilters] = React.useState({
    q: "",
    team: "all-team",
    stage: "all-stage",
    platform: "all-platform",
    pool: "all-pool",
    owner: params.get("owner") === "me" ? "" : (params.get("owner") ?? ""),
    gender: "all-gender",
    shopify: "all-shopify",
    niche: "all-niche",
    country: "all-country",
    city: "all-city",
    creatorType: "all-type",
    createdFrom: "",
    createdTo: "",
    pending: params.get("pending") === "1",
    incomplete: params.get("incomplete") === "1",
    overdue: params.get("overdue") === "1",
    upcoming: params.get("upcoming") === "1",
    myAssigned: !drillParam,
  });
  const [sort, setSort] = React.useState("latest");
  const [me, setMe] = React.useState<{
    id: string;
    teamId: string;
    roleSlug: string;
    canCreate: boolean;
    canExport: boolean;
    canBulkEdit: boolean;
  } | null>(null);
  const [refData, setRefData] = React.useState<ReferenceData | null>(null);
  const [debouncedQ, setDebouncedQ] = React.useState("");
  const [importOpen, setImportOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [owners, setOwners] = React.useState<FilterOption[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [bulkStageId, setBulkStageId] = React.useState("");
  const [bulkOwners, setBulkOwners] = React.useState<string[]>([]);
  const [bulkShopify, setBulkShopify] = React.useState("");
  const [bulkBusy, setBulkBusy] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((m) => {
        setMe(m);
        setFilters((f) => {
          if (f.myAssigned && !f.owner && m?.id) return { ...f, owner: m.id };
          if (!f.myAssigned && f.owner === (m?.id ?? "__none__") && !params.get("owner")) return { ...f, owner: "" };
          return f;
        });
      })
      .catch(() => {});
    fetch("/api/reference")
      .then((r) => (r.ok ? r.json() : null))
      .then(setRefData)
      .catch(() => {});
  }, [params]);

  // Seed filters from URL params (deep links from the dashboard).
  React.useEffect(() => {
    const stage = params.get("stage");
    const pool = params.get("pool");
    const q = params.get("q");
    const owner = params.get("owner");
    const pending = params.get("pending") === "1";
    const overdue = params.get("overdue") === "1";
    const upcoming = params.get("upcoming") === "1";
    const set = (patch: Partial<typeof filters>) => setFilters((f) => ({ ...f, ...patch }));

    if (q) set({ q });
    if (pool === "same_team" || pool === "company") set({ pool });
    if (pending) set({ pending: true });
    if (overdue) set({ overdue: true });
    if (upcoming) set({ upcoming: true });

    if (stage) {
      set({ stage });
    }

    if (owner === "me") {
      fetch("/api/me")
        .then((r) => r.json())
        .then((m) => set({ owner: m.id }))
        .catch(() => {});
    } else if (owner) {
      set({ owner });
    }
  }, [params]);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q), 300);
    return () => clearTimeout(t);
  }, [filters.q]);

  const buildParams = React.useCallback(() => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    if (filters.team && filters.team !== "all-team") params.set("team", filters.team);
    if (filters.stage && filters.stage !== "all-stage") params.set("stage", filters.stage);
    if (filters.platform) params.set("platform", filters.platform);
    if (filters.pool && filters.pool !== "all-pool") params.set("pool", filters.pool);
    if (filters.owner) params.set("owner", filters.owner);
    if (sort && sort !== "latest") params.set("sort", sort);
    if (filters.gender && filters.gender !== "all-gender") params.set("gender", filters.gender);
    if (filters.shopify && filters.shopify !== "all-shopify") params.set("shopify", filters.shopify);
    if (filters.niche && filters.niche !== "all-niche") params.set("niche", filters.niche);
    if (filters.country && filters.country !== "all-country") params.set("country", filters.country);
    if (filters.city && filters.city !== "all-city") params.set("city", filters.city);
    if (filters.creatorType && filters.creatorType !== "all-type") params.set("creatorType", filters.creatorType);
    if (filters.createdFrom) params.set("createdFrom", filters.createdFrom);
    if (filters.createdTo) params.set("createdTo", filters.createdTo);
    if (filters.pending) params.set("pending", "1");
    if (filters.incomplete) params.set("incomplete", "1");
    if (filters.overdue) params.set("overdue", "1");
    if (filters.upcoming) params.set("upcoming", "1");
    if (groupBy && groupBy !== "none") params.set("group", groupBy);
    return params;
  }, [debouncedQ, filters, groupBy, sort]);

  const load = React.useCallback(async () => {
    setLoading(true);
    const params = buildParams();
    try {
      const res = await fetch(`/api/creators?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setCreators(data);
    } catch {
      setCreators([]);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  const exportCsv = React.useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const params = buildParams();
      const res = await fetch(`/api/creators/export?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.error ?? "Export failed");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] ?? `creators-${Date.now()}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed");
    } finally {
      setExporting(false);
    }
  }, [buildParams, exporting]);

  React.useEffect(() => {
    load();
    fetch("/api/creators/options")
      .then((r) => r.json())
      .then((d) => {
        setStages(d.stages ?? []);
        const seen = new Set<string>();
        const teamOptions = [
          { value: "all-team", label: "All teams" },
          { value: "unassigned", label: "Unassigned" },
          ...(d.teams ?? []).map((t: { id: string; name: string }) => ({ value: t.id, label: t.name })),
        ].filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)));
        setTeams(teamOptions);
        setOwners((d.owners ?? []).map((o: { id: string; displayName: string }) => ({ value: o.id, label: o.displayName })));
      })
      .catch(() => {});
  }, [load]);

  const activeTrigger = (active: boolean) =>
    active ? "border-primary/60 bg-primary/5 font-medium text-primary" : "";
  const smartCount = [filters.incomplete, filters.overdue, filters.upcoming, filters.pending].filter(Boolean).length;
  const secondaryCount = [
    !!filters.owner,
    filters.country !== "all-country",
    filters.city !== "all-city",
    filters.creatorType !== "all-type",
    filters.gender !== "all-gender",
    filters.shopify !== "all-shopify",
    filters.niche !== "all-niche",
    !!filters.createdFrom,
    !!filters.createdTo,
  ].filter(Boolean).length;
  const filtersActive = smartCount + secondaryCount;

  const SORT_OPTIONS: { value: string; label: string }[] = [
    { value: "latest", label: "Recently updated" },
    { value: "oldest", label: "Least recently updated" },
    { value: "name-asc", label: "Name A–Z" },
    { value: "name-desc", label: "Name Z–A" },
    { value: "created-desc", label: "Newest added" },
    { value: "created-asc", label: "Oldest added" },
  ];

  const toggleSelect = (id: string, selected?: boolean) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected === true) next.add(id);
      else if (selected === false) next.delete(id);
      else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelectAll = () =>
    setSelectedIds((prev) =>
      prev.size === creators.length && creators.length > 0
        ? new Set()
        : new Set(creators.map((c) => c.id)),
    );

  const applyBulk = async () => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      const body: Record<string, unknown> = { ids: [...selectedIds] };
      if (bulkStageId) body.stageId = bulkStageId;
      if (bulkShopify === "yes") body.shopifyRegistered = true;
      else if (bulkShopify === "no") body.shopifyRegistered = false;
      if (bulkOwners.length > 0) body.ownerIds = bulkOwners;
      const res = await fetch("/api/creators/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) return toast({ title: data.error ?? "Bulk edit failed", variant: "destructive" });
      toast({ title: "Updated", description: `${data.total} creators updated` });
      setBulkOpen(false);
      setBulkStageId("");
      setBulkOwners([]);
      setBulkShopify("");
      setSelectedIds(new Set());
      load();
    } catch {
      toast({ title: "Bulk edit failed", variant: "destructive" });
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Creators</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading…" : `${creators.length} creators`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="w-48 pl-8 pr-8 sm:w-56"
              placeholder="Search name, link, @handle, email or phone…"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            />
            {filters.q ? (
              <button
                type="button"
                aria-label="Clear search"
                title="Clear search"
                tabIndex={-1}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                onClick={() => setFilters((f) => ({ ...f, q: "", }))}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          {me?.canCreate ? (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add creator
            </Button>
          ) : null}
          {me?.roleSlug === "admin" ? (
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-1 h-4 w-4" /> Import
            </Button>
          ) : null}
        </div>
      </div>

      {/* Scope: who the list shows (own creators in a dedicated area) */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-border/70 bg-muted/40 p-0.5">
          <button
            type="button"
            onClick={() => setFilters((f) => ({ ...f, myAssigned: false, owner: "" }))}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              !filters.myAssigned
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            All creators
          </button>
          <button
            type="button"
            onClick={() => setFilters((f) => ({ ...f, myAssigned: true, owner: me?.id ?? "" }))}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              filters.myAssigned
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Assigned to me
          </button>
        </div>
        {(filters.q || filters.team !== "all-team" || filters.stage !== "all-stage" || filters.platform !== "all-platform" || filters.pool !== "all-pool" || filters.owner || filters.gender !== "all-gender" || filters.shopify !== "all-shopify" || filters.niche !== "all-niche" || filters.country !== "all-country" || filters.city !== "all-city" || filters.creatorType !== "all-type" || filters.createdFrom || filters.createdTo || filters.pending || filters.incomplete || filters.overdue || filters.upcoming || filters.myAssigned || sort !== "latest") ? (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => {
              setFilters({
                q: "",
                team: "all-team",
                stage: "all-stage",
                platform: "all-platform",
                pool: "all-pool",
                owner: "",
                gender: "all-gender",
                shopify: "all-shopify",
                niche: "all-niche",
                country: "all-country",
                city: "all-city",
                creatorType: "all-type",
                createdFrom: "",
                createdTo: "",
                pending: false,
                incomplete: false,
                overdue: false,
                upcoming: false,
                myAssigned: false,
              });
              setSort("latest");
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset all filters
          </Button>
        ) : null}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filters.team} onValueChange={(v) => setFilters((f) => ({ ...f, team: v }))}>
          <SelectTrigger className={cn("w-40", activeTrigger(filters.team !== "all-team"))}>
            <SelectValue placeholder="All teams" />
          </SelectTrigger>
          <SelectContent>
            {teams.map((t) => (
              <SelectItem key={t.value || "all-team"} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.stage} onValueChange={(v) => setFilters((f) => ({ ...f, stage: v }))}>
          <SelectTrigger className={cn("w-40", activeTrigger(filters.stage !== "all-stage"))}>
            <SelectValue placeholder="All stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-stage">All stages</SelectItem>
            {stages.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.platform}
          onValueChange={(v) => setFilters((f) => ({ ...f, platform: v }))}
        >
          <SelectTrigger className={cn("w-40", activeTrigger(filters.platform !== "all-platform"))}>
            <SelectValue placeholder="All platforms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-platform">All platforms</SelectItem>
            {["INSTAGRAM", "TIKTOK", "YOUTUBE", "X", "SNAPCHAT", "FACEBOOK", "LINKEDIN", "TWITCH"].map(
              (p) => (
                <SelectItem key={p} value={p}>
                  {p[0] + p.slice(1).toLowerCase()}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <Select value={filters.pool} onValueChange={(v) => setFilters((f) => ({ ...f, pool: v }))}>
          <SelectTrigger className={cn("w-40", activeTrigger(filters.pool !== "all-pool"))}>
            <SelectValue placeholder="All availability" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-pool">All availability</SelectItem>
            <SelectItem value="same_team">Same-team pool</SelectItem>
            <SelectItem value="company">Company pool</SelectItem>
          </SelectContent>
        </Select>
        <Popover.Root>
          <Popover.Trigger asChild>
            <Button
              variant={filtersActive ? "secondary" : "outline"}
              size="sm"
              className={filtersActive ? "gap-1.5 border-primary/50 bg-primary/5 text-primary" : "gap-1.5"}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters{filtersActive ? ` (${filtersActive})` : ""}
            </Button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={4}
              onOpenAutoFocus={(e) => e.preventDefault()}
              className="z-50 max-h-[80vh] w-72 overflow-y-auto rounded-md border bg-popover p-2 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
            >
              <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Filters
              </p>

              <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Assignment
              </p>
              <Select value={filters.owner} onValueChange={(v) => setFilters((f) => ({ ...f, owner: v, myAssigned: false }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All owners" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All owners</SelectItem>
                  {owners.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Location
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <Select
                  value={filters.country}
                  onValueChange={(v) => {
                    setFilters((f) => ({
                      ...f,
                      country: v,
                      city: v === "all-country" ? "all-city" : (filters.city),
                    }));
                    if (v !== "all-country" && filters.city !== "all-city") {
                      const hasCity = (refData?.countries ?? [])
                        .find((c) => c.id === v)?.cities.some((c) => c.id === filters.city);
                      if (!hasCity) setFilters((f) => ({ ...f, city: "all-city" }));
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Any country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-country">Any country</SelectItem>
                    {(refData?.countries ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={filters.city}
                  onValueChange={(v) => setFilters((f) => ({ ...f, city: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Any city" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-city">Any city</SelectItem>
                    {(refData?.countries ?? []).find((c) => c.id === filters.country)?.cities.map((ct) => (
                      <SelectItem key={ct.id} value={ct.id}>
                        {ct.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Classification
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <Select value={filters.creatorType} onValueChange={(v) => setFilters((f) => ({ ...f, creatorType: v }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Any type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-type">Any type</SelectItem>
                    {(refData?.creatorTypes ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filters.gender} onValueChange={(v) => setFilters((f) => ({ ...f, gender: v }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Any gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-gender">Any gender</SelectItem>
                    {(refData?.genderOptions ?? []).map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filters.shopify} onValueChange={(v) => setFilters((f) => ({ ...f, shopify: v }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Any Shopify" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-shopify">Any Shopify</SelectItem>
                    <SelectItem value="yes">Shopify registered</SelectItem>
                    <SelectItem value="no">Not registered</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filters.niche} onValueChange={(v) => setFilters((f) => ({ ...f, niche: v }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Any niche" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-niche">Any niche</SelectItem>
                    {(refData?.nicheOptions ?? []).map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Created
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <Input
                  type="date"
                  value={filters.createdFrom}
                  onChange={(e) => setFilters((f) => ({ ...f, createdFrom: e.target.value }))}
                  aria-label="Created from"
                />
                <Input
                  type="date"
                  value={filters.createdTo}
                  onChange={(e) => setFilters((f) => ({ ...f, createdTo: e.target.value }))}
                  aria-label="Created to"
                />
              </div>

              <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Status
              </p>
              {(
                [
                  { key: "incomplete", label: "Incomplete data" },
                  { key: "overdue", label: "Overdue" },
                  { key: "upcoming", label: "Upcoming deliverables" },
                  { key: "pending", label: "Pending approval" },
                ] as const
              ).map(({ key, label }) => {
                const active = filters[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, [key]: !f[key] }))}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <span
                      className={
                        active
                          ? "flex h-4 w-4 shrink-0 items-center justify-center rounded border border-primary bg-primary text-primary-foreground"
                          : "flex h-4 w-4 shrink-0 items-center justify-center rounded border border-input"
                      }
                    >
                      {active ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                  </button>
                );
              })}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>

      {/* View toolbar: which view + how it is arranged */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-0.5 rounded-lg border border-border/70 bg-muted/40 p-0.5">
            {[
              { key: "card" as View, label: "Cards", icon: Grid2X2, aria: "grid2x2" },
              { key: "table" as View, label: "Table", icon: Table2, aria: "table2" },
              { key: "kanban" as View, label: "Board", icon: KanbanSquare, aria: "kanban-square" },
            ].map(({ key, label, icon: Icon, aria }) => (
              <button
                key={key}
                type="button"
                aria-label={`View ${label}`}
                onClick={() => {
                  setView(key);
                  if (key !== "table") setSelectedIds(new Set());
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  view === key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" data-lucide={aria} />
                {label}
              </button>
            ))}
          </div>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupByKey)}>
            <SelectTrigger className="w-44">
              <Layers className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue placeholder="Group by" />
            </SelectTrigger>
            <SelectContent>
              {GROUP_BY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-44">
            <ArrowUpDown className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bulk edit bar: only available in the table view (issue 6) */}
      {me?.canBulkEdit && view === "table" && selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            <Check className="h-4 w-4" />
            {selectedIds.size} selected
          </span>
          <Select value={bulkStageId} onValueChange={setBulkStageId}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Move to stage…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Keep current stage</SelectItem>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={bulkShopify} onValueChange={setBulkShopify}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Shopify status…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Keep Shopify</SelectItem>
              <SelectItem value="yes">Mark Shopify registered</SelectItem>
              <SelectItem value="no">Mark not registered</SelectItem>
            </SelectContent>
          </Select>
          <MultiSelect
            options={owners.map((o) => ({ value: o.value, label: o.label }))}
            value={bulkOwners}
            onChange={setBulkOwners}
            placeholder="Change owners…"
            triggerClassName="w-48"
          />
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!bulkStageId && !bulkShopify && bulkOwners.length === 0}
              onClick={() => setBulkOpen(true)}
            >
              Apply to {selectedIds.size}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="mr-1 h-3.5 w-3.5" /> Clear
            </Button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : view === "card" ? (
        <GroupedCreatorCards
          creators={creators}
          groupBy={groupBy}
          onStageChanged={(id, stage) =>
            setCreators((prev) => prev.map((c) => (c.id === id ? { ...c, stage } : c)))
          }
          onReassigned={load}
        />
      ) : view === "table" ? (
        <CreatorsTable
          creators={creators}
          onStageChanged={(id, stage) =>
            setCreators((prev) => prev.map((c) => (c.id === id ? { ...c, stage } : c)))
          }
          exportable={!!me?.canExport}
          onExport={exportCsv}
          selectionEnabled={!!me?.canBulkEdit}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          groupBy={groupBy}
          onReassigned={load}
        />
      ) : (
        <KanbanBoard
          creators={creators}
          stages={stages}
          groupBy={groupBy}
          onReassigned={load}
        />
      )}

      <CreatorFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={() => {
          setFilters((f) => ({ ...f }));
          load();
        }}
      />

      <ImportCreatorsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onDone={() => load()}
      />

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Apply changes to {selectedIds.size} creators?</DialogTitle>
            <DialogDescription>
              This updates every selected creator at once. Each change is logged on the creator&apos;s
              activity feed.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {bulkStageId ? (
              <li className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 text-primary" />
                Stage → {stages.find((s) => s.id === bulkStageId)?.name}
              </li>
            ) : null}
            {bulkShopify ? (
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-primary" />
                Shopify → {bulkShopify === "yes" ? "registered" : "not registered"}
              </li>
            ) : null}
            {bulkOwners.length ? (
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-primary" />
                Owners → {owners.filter((o) => bulkOwners.includes(o.value)).map((o) => o.label).join(", ")}
              </li>
            ) : null}
            {!bulkStageId && !bulkShopify && bulkOwners.length === 0 ? (
              <li>Nothing selected to change.</li>
            ) : null}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkBusy}>
              Cancel
            </Button>
            <Button onClick={() => void applyBulk()} disabled={bulkBusy || (!bulkStageId && !bulkShopify && bulkOwners.length === 0)}>
              {bulkBusy ? "Applying…" : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}