"use client";

import Link from "next/link";
import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { ArrowDown01, ArrowUp01, ArrowUpDown, Check, Columns3 } from "lucide-react";
import {
  useLegacyTable as useTable,
  getCoreRowModel,
  type LegacyColumnDef,
} from "@tanstack/react-table/legacy";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  PlatformLogoBadge,
  initials,
  formatFollowerCount,
  formatDate,
  timeAgo,
} from "@/lib/display";
import {
  CreatorListItem,
  relationshipLabel,
  approvalBadge,
  incompleteBadge,
  StageDropdown,
} from "./creator-card";

type TableRow = CreatorListItem;

type CellCtx = { getValue: () => unknown; row: { original: TableRow } };

function columns(onStageChanged?: (id: string, stage: { id: string; name: string }) => void): LegacyColumnDef<TableRow>[] {
  return [
    {
      accessorKey: "name",
      id: "name",
      header: "Creator",
      cell: ({ row }: CellCtx) => {
        const c = row.original;
        return (
          <Link href={`/creators/${c.id}`} className="flex items-center gap-2.5 font-medium hover:underline">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials(c.name)}</AvatarFallback>
            </Avatar>
            <span className="inline-flex flex-wrap items-center gap-1.5">
              {c.name}
              {approvalBadge(c)}
              {incompleteBadge(c)}
            </span>
          </Link>
        );
      },
    },
    {
      accessorKey: "platform",
      id: "platform",
      header: "Platforms",
      cell: ({ row }: CellCtx) => {
        const c = row.original;
        if (!c.profiles.length) return null;
        return (
          <span className="inline-flex flex-wrap gap-1">
            {c.profiles.map((p) => (
              <PlatformLogoBadge key={`${p.platform}-${p.handle}`} platform={p.platform} url={p.url} handle={p.handle} />
            ))}
          </span>
        );
      },
    },
    {
      accessorKey: "handle",
      id: "handle",
      header: "Handle",
      cell: ({ getValue }: CellCtx) => (
        <span className="text-muted-foreground">@{(getValue() as string | null) ?? "—"}</span>
      ),
    },
    {
      accessorKey: "followers",
      id: "followers",
      header: "Followers",
      cell: ({ getValue }: CellCtx) =>
        formatFollowerCount(Number(getValue())),
    },
    {
      accessorKey: "niche",
      id: "niche",
      header: "Niche",
      cell: ({ getValue }: CellCtx) => {
        const v = getValue() as string[] | null | undefined;
        return <span className="text-muted-foreground">{v?.length ? v.join(", ") : "—"}</span>;
      },
    },
    {
      accessorKey: "shopifyRegistered",
      id: "shopify",
      header: "Shopify",
      cell: ({ getValue }: CellCtx) => {
        const v = getValue() as boolean | null;
        return v ? <span className="font-medium text-emerald-600">Yes</span> : "—";
      },
    },
    {
      accessorKey: "stage",
      id: "stage",
      header: "Stage",
      cell: ({ row }: CellCtx) => {
        const c = row.original;
        if (!c.stage) return null;
        if (c.canMove && c.currentEngagementId && onStageChanged) {
          return (
            <StageDropdown
              creator={c}
              onStageChanged={(name) =>
                onStageChanged(c.id, { id: c.stage!.id, name })
              }
            />
          );
        }
        return <Badge variant="outline">{c.stage.name}</Badge>;
      },
    },
    {
      accessorKey: "overdue",
      id: "overdue",
      header: "Overdue",
      cell: ({ row }: CellCtx) => {
        const c = row.original;
        const isOverdue = c.nextDeliverable && new Date(c.nextDeliverable.dueDate) < new Date();
        return isOverdue ? (
          <span className="font-medium text-destructive">Yes</span>
        ) : (
          "—"
        );
      },
    },
    {
      accessorKey: "location",
      id: "location",
      header: "Location",
      cell: ({ row }: CellCtx) => {
        const c = row.original;
        if (c.city && c.country) return `${c.city}, ${c.country}`;
        if (c.country) return c.country;
        return "—";
      },
    },
    {
      accessorKey: "relationship",
      id: "relationship",
      header: "Access",
      cell: ({ getValue }: CellCtx) =>
        relationshipLabel(getValue() as TableRow["relationship"]),
    },
    {
      accessorKey: "owners",
      id: "owners",
      header: "Owner",
      cell: ({ getValue }: CellCtx) => {
        const v = getValue() as TableRow["owners"];
        if (!v.length) return "—";
        return (
          <div className="flex -space-x-2">
            {v.slice(0, 3).map((o) => (
              <Tooltip key={o.id}>
                <TooltipTrigger asChild>
                  <Link
                    href={`/creators?owner=${o.id}`}
                    title={`${o.name} · ${o.teamName}`}
                    aria-label={`Filter by owner ${o.name}`}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-secondary-foreground ring-2 ring-background transition-colors hover:bg-primary hover:text-primary-foreground"
                  >
                    {initials(o.name).slice(0, 2)}
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  {o.name} · {o.teamName}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: "createdAt",
      id: "created",
      header: "Created",
      cell: ({ getValue }: CellCtx) =>
        formatDate(String(getValue() ?? "")),
    },
    {
      accessorKey: "lastActivityAt",
      id: "lastActivityAt",
      header: "Last activity",
      cell: ({ getValue }: CellCtx) => {
        const v = getValue() as string | null;
        return v ? timeAgo(v) : "—";
      },
    },
    {
      accessorKey: "nextDeliverable",
      id: "nextDeliverable",
      header: "Next deliverable",
      cell: ({ getValue }: CellCtx) => {
        const v = getValue() as { dueDate: string } | null;
        return v ? (
          <span className={new Date(v.dueDate) < new Date() ? "text-destructive" : ""}>
            {formatDate(v.dueDate)}
          </span>
        ) : (
          "—"
        );
      },
    },
  ];
}

const ALL_COLUMNS = [
  { id: "name", label: "Creator" },
  { id: "platform", label: "Platforms" },
  { id: "handle", label: "Handle" },
  { id: "followers", label: "Followers" },
  { id: "niche", label: "Niche" },
  { id: "shopify", label: "Shopify" },
  { id: "stage", label: "Stage" },
  { id: "overdue", label: "Overdue" },
  { id: "location", label: "Location" },
  { id: "relationship", label: "Access" },
  { id: "owners", label: "Owner" },
  { id: "created", label: "Created" },
  { id: "lastActivityAt", label: "Last activity" },
  { id: "nextDeliverable", label: "Next deliverable" },
];

const DEFAULT_VISIBLE = [
  "name",
  "platform",
  "handle",
  "followers",
  "stage",
  "overdue",
  "relationship",
  "owners",
  "lastActivityAt",
];

type SortState = { id: string; desc: boolean };

function sortValue(c: CreatorListItem, id: string): string | number {
  switch (id) {
    case "name":
      return c.name.toLowerCase();
    case "handle":
      return (c.handle ?? "").toLowerCase();
    case "followers":
      return c.followers ?? 0;
    case "created":
      return c.createdAt ? new Date(c.createdAt).getTime() : 0;
    case "location":
      return (c.country ?? "").toLowerCase();
    case "lastActivityAt":
      return c.lastActivityAt ? new Date(c.lastActivityAt).getTime() : 0;
    default:
      return 0;
  }
}

const STORAGE_KEY = "trackcrm-table-columns";

export function CreatorsTable({
  creators,
  onStageChanged,
}: {
  creators: CreatorListItem[];
  onStageChanged?: (id: string, stage: { id: string; name: string }) => void;
}) {
  const [hidden, setHidden] = React.useState<Set<string>>(() => {
    if (typeof window === "undefined") {
      const h = new Set<string>();
      for (const c of ALL_COLUMNS) {
        if (!DEFAULT_VISIBLE.includes(c.id)) h.add(c.id);
      }
      return h;
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const arr: string[] = JSON.parse(saved);
        if (Array.isArray(arr)) return new Set(arr);
      }
    } catch {}
    const h = new Set<string>();
    for (const c of ALL_COLUMNS) {
      if (!DEFAULT_VISIBLE.includes(c.id)) h.add(c.id);
    }
    return h;
  });
  const [sortBy, setSortBy] = React.useState<SortState>({ id: "lastActivityAt", desc: true });

  const sortedCreators = React.useMemo(() => {
    const arr = [...creators];
    const { id, desc } = sortBy;
    arr.sort((a, b) => {
      const va = sortValue(a, id);
      const vb = sortValue(b, id);
      let cmp = 0;
      if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb));
      return desc ? -cmp : cmp;
    });
    return arr;
  }, [creators, sortBy]);

  const onSortClick = (id: string) =>
    setSortBy((prev) => (prev.id === id ? { id, desc: !prev.desc } : { id, desc: false }));

  const table = useTable({
    data: sortedCreators,
    columns: columns(onStageChanged),
    getCoreRowModel: getCoreRowModel(),
  });

  const visibleColumns = ALL_COLUMNS.filter((c) => !hidden.has(c.id));
  const visibleCount = visibleColumns.length;

  const toggle = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (typeof window !== "undefined") {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch {}
      }
      return next;
    });

  return (
    <TooltipProvider delayDuration={200}>
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-end border-b border-border/60 px-3 py-2">
          <Popover.Root>
            <Popover.Trigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs font-medium">
                <Columns3 className="h-3.5 w-3.5" />
                Columns ({visibleCount}/{ALL_COLUMNS.length})
              </Button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="end"
                sideOffset={4}
                onOpenAutoFocus={(e) => e.preventDefault()}
                className="z-50 max-h-80 w-52 overflow-y-auto rounded-md border bg-popover p-1.5 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
              >
                <p className="px-2 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Columns
                </p>
                {ALL_COLUMNS.map((col) => {
                  const visible = !hidden.has(col.id);
                  return (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => toggle(col.id)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                    >
                      <span
                        className={
                          visible
                            ? "flex h-4 w-4 shrink-0 items-center justify-center rounded border border-primary bg-primary text-primary-foreground"
                            : "flex h-4 w-4 shrink-0 items-center justify-center rounded border border-input"
                        }
                      >
                        {visible ? <Check className="h-3 w-3" /> : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{col.label}</span>
                    </button>
                  );
                })}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers
                  .filter((header) => !hidden.has(String(header.column.id)))
                  .map((header) => (
                    <TableHead key={header.id} className="p-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-full w-full justify-start gap-1.5 rounded-none px-3 text-xs font-medium"
                        onClick={() => onSortClick(String(header.column.id))}
                      >
                        {String(header.column.columnDef.header ?? header.id).replace(/\(\)/g, "")}
                        {sortBy.id === String(header.column.id) ? (
                          sortBy.desc ? (
                            <ArrowDown01 className="h-3 w-3" />
                          ) : (
                            <ArrowUp01 className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </Button>
                    </TableHead>
                  ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleCount} className="h-24 text-center text-muted-foreground">
                  No creators match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells()
                    .filter((cell) => !hidden.has(String(cell.column.id)))
                    .map((cell) => {
                      const render = cell.column.columnDef.cell;
                      return (
                        <TableCell key={cell.id}>
                          {typeof render === "function" ? render(cell.getContext()) : String(cell.getValue?.() ?? "")}
                        </TableCell>
                      );
                    })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}