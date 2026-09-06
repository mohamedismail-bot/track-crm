"use client";

import Link from "next/link";
import { ArrowUpDown } from "lucide-react";
import {
  useLegacyTable as useTable,
  getCoreRowModel,
  getSortedRowModel,
  type LegacyColumnDef,
} from "@tanstack/react-table/legacy";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  PlatformBadge,
  initials,
  formatFollowerCount,
  formatDate,
  timeAgo,
} from "@/lib/display";
import { CreatorListItem, relationshipLabel, approvalBadge, incompleteBadge } from "./creator-card";

type TableRow = CreatorListItem;

type CellCtx = { getValue: () => unknown; row: { original: TableRow } };

function columns(): LegacyColumnDef<TableRow>[] {
  return [
    {
      accessorKey: "name",
      header: "Creator",
      cell: ({ row }: CellCtx) => {
        const c = row.original;
        return (
          <Link href={`/creators/${c.id}`} className="flex items-center gap-2.5 font-medium hover:underline">
            <Avatar className="h-8 w-8">
              <AvatarImage src={c.avatarUrl ?? undefined} alt={c.name} />
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
      header: "Platform",
      cell: ({ getValue }: CellCtx) => {
        const v = getValue() as TableRow["platform"];
        return v ? <PlatformBadge platform={v} /> : null;
      },
    },
    {
      accessorKey: "handle",
      header: "Handle",
      cell: ({ getValue }: CellCtx) => (
        <span className="text-muted-foreground">@{(getValue() as string | null) ?? "—"}</span>
      ),
    },
    {
      accessorKey: "followers",
      header: "Followers",
      cell: ({ getValue }: CellCtx) =>
        formatFollowerCount(Number(getValue())),
    },
    {
      accessorKey: "niche",
      header: "Niche",
      cell: ({ getValue }: CellCtx) => (
        <span className="text-muted-foreground">{(getValue() as string | null) ?? "—"}</span>
      ),
    },
    {
      accessorKey: "stage",
      header: "Stage",
      cell: ({ getValue }: CellCtx) => {
        const v = getValue() as TableRow["stage"];
        return v ? <Badge variant="outline">{v.name}</Badge> : null;
      },
    },
    {
      accessorKey: "relationship",
      header: "Access",
      cell: ({ getValue }: CellCtx) =>
        relationshipLabel(getValue() as TableRow["relationship"]),
    },
    {
      accessorKey: "owners",
      header: "Owner",
      cell: ({ getValue }: CellCtx) => {
        const v = getValue() as TableRow["owners"];
        if (!v.length) return "—";
        return (
          <div className="flex -space-x-2">
            {v.slice(0, 3).map((o) => (
              <div
                key={o.id}
                title={`${o.name} · ${o.teamName}`}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[10px] font-medium ring-2 ring-background"
              >
                {initials(o.name).slice(0, 2)}
              </div>
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: "lastActivityAt",
      header: "Last activity",
      cell: ({ getValue }: CellCtx) => {
        const v = getValue() as string | null;
        return v ? timeAgo(v) : "—";
      },
    },
    {
      accessorKey: "nextDeliverable",
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

export function CreatorsTable({ creators }: { creators: CreatorListItem[] }) {
  const table = useTable({
    data: creators,
    columns: columns(),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      sorting: [{ id: "lastActivityAt", desc: true }],
    },
  });

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.column.getCanSort() ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-7 px-2 text-xs font-medium"
                      onClick={() => header.column.toggleSorting()}
                    >
                      {String(header.column.columnDef.header ?? header.id).replace(/\(\)/g, "")}
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  ) : (
                    String(header.column.columnDef.header ?? header.id)
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                No creators match the current filters.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => {
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
  );
}