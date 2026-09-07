"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Grid2X2, Table2, KanbanSquare, Plus, Search, Upload, SlidersHorizontal, Check, ArrowUpDown } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CreatorCard, type CreatorListItem } from "@/components/creators/creator-card";
import { CreatorsTable } from "@/components/creators/creators-table";
import { KanbanBoard, type KanbanStage } from "@/components/creators/kanban-board";
import { CreatorFormDialog } from "@/components/creators/creator-form";
import { ImportCreatorsDialog } from "@/components/creators/creator-import";

type View = "card" | "table" | "kanban";

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
  const [creators, setCreators] = React.useState<CreatorListItem[]>([]);
  const [stages, setStages] = React.useState<KanbanStage[]>([]);
  const [teams, setTeams] = React.useState<FilterOption[]>([
    { value: "all-team", label: "All teams" },
    { value: "unassigned", label: "Unassigned" },
  ]);
  const [loading, setLoading] = React.useState(true);
  const [formOpen, setFormOpen] = React.useState(false);
  const [filters, setFilters] = React.useState({
    q: "",
    team: "all-team",
    stage: "all-stage",
    platform: "all-platform",
    pool: "all-pool",
    owner: "",
    gender: "all-gender",
    shopify: "all-shopify",
    niche: "all-niche",
    pending: params.get("pending") === "1",
    incomplete: params.get("incomplete") === "1",
    overdue: params.get("overdue") === "1",
    upcoming: params.get("upcoming") === "1",
  });
  const [sort, setSort] = React.useState("latest");
  const [me, setMe] = React.useState<{
    id: string;
    teamId: string;
    roleSlug: string;
    canCreate: boolean;
  } | null>(null);
  const [refData, setRefData] = React.useState<ReferenceData | null>(null);
  const [debouncedQ, setDebouncedQ] = React.useState("");
  const [importOpen, setImportOpen] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then(setMe)
      .catch(() => {});
    fetch("/api/reference")
      .then((r) => (r.ok ? r.json() : null))
      .then(setRefData)
      .catch(() => {});
  }, []);

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

  const load = React.useCallback(async () => {
    setLoading(true);
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
    if (filters.pending) params.set("pending", "1");
    if (filters.incomplete) params.set("incomplete", "1");
    if (filters.overdue) params.set("overdue", "1");
    if (filters.upcoming) params.set("upcoming", "1");
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
  }, [debouncedQ, filters, sort]);

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
      })
      .catch(() => {});
  }, [load]);

  const activeTrigger = (active: boolean) =>
    active ? "border-primary/60 bg-primary/5 font-medium text-primary" : "";
  const smartCount = [filters.incomplete, filters.overdue, filters.upcoming, filters.pending].filter(Boolean).length;

  const SORT_OPTIONS: { value: string; label: string }[] = [
    { value: "latest", label: "Recently updated" },
    { value: "oldest", label: "Least recently updated" },
    { value: "name-asc", label: "Name A–Z" },
    { value: "name-desc", label: "Name Z–A" },
    { value: "created-desc", label: "Newest added" },
    { value: "created-asc", label: "Oldest added" },
  ];

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
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="w-48 pl-8 sm:w-56"
              placeholder="Search name, link, @handle, email or phone…"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            />
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

      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          value={view}
          onValueChange={(v) => setView(v as View)}
          className="mr-2"
        >
          <TabsList>
            <TabsTrigger value="card">
              <Grid2X2 className="mr-1 h-4 w-4" data-lucide="grid2x2" /> Cards
            </TabsTrigger>
            <TabsTrigger value="table">
              <Table2 className="mr-1 h-4 w-4" data-lucide="table2" /> Table
            </TabsTrigger>
            <TabsTrigger value="kanban">
              <KanbanSquare className="mr-1 h-4 w-4" data-lucide="kanban-square" /> Board
            </TabsTrigger>
          </TabsList>
        </Tabs>
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
        <Select
          value={filters.gender}
          onValueChange={(v) => setFilters((f) => ({ ...f, gender: v }))}
        >
          <SelectTrigger className={cn("w-36", activeTrigger(filters.gender !== "all-gender"))}>
            <SelectValue placeholder="All genders" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-gender">All genders</SelectItem>
            {(refData?.genderOptions ?? []).map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.shopify}
          onValueChange={(v) => setFilters((f) => ({ ...f, shopify: v }))}
        >
          <SelectTrigger className={cn("w-36", activeTrigger(filters.shopify !== "all-shopify"))}>
            <SelectValue placeholder="Shopify" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-shopify">Any Shopify</SelectItem>
            <SelectItem value="yes">Shopify registered</SelectItem>
            <SelectItem value="no">Not registered</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.niche}
          onValueChange={(v) => setFilters((f) => ({ ...f, niche: v }))}
        >
          <SelectTrigger className={cn("w-40", activeTrigger(filters.niche !== "all-niche"))}>
            <SelectValue placeholder="All niches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-niche">All niches</SelectItem>
            {(refData?.nicheOptions ?? []).map((n) => (
              <SelectItem key={n} value={n}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <Popover.Root>
          <Popover.Trigger asChild>
            <Button
              variant={smartCount ? "secondary" : "outline"}
              size="sm"
              className={smartCount ? "gap-1.5 border-primary/50 bg-primary/5 text-primary" : "gap-1.5"}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Smart filters{smartCount ? ` (${smartCount})` : ""}
            </Button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={4}
              onOpenAutoFocus={(e) => e.preventDefault()}
              className="z-50 w-60 rounded-md border bg-popover p-1.5 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
            >
              <p className="px-2 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Smart filters
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

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : view === "card" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {creators.length === 0 ? (
            <div className="col-span-full rounded-xl border p-10 text-center text-muted-foreground">
              No creators found. Try adjusting your filters or add a creator.
            </div>
          ) : (
            creators.map((c) => <CreatorCard key={c.id} creator={c} />)
          )}
        </div>
      ) : view === "table" ? (
        <CreatorsTable creators={creators} />
      ) : (
        <KanbanBoard creators={creators} stages={stages} />
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
    </div>
  );
}