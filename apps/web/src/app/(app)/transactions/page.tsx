"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/display";

interface Transaction {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  detail: string | null;
  createdAt: string;
  user: { id: string; displayName: string; teamId: string };
}

export default function TransactionsPage() {
  const [logs, setLogs] = React.useState<Transaction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState("");

  React.useEffect(() => {
    fetch("/api/transactions")
      .then((r) => r.json())
      .then(setLogs)
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter
    ? logs.filter((l) =>
        [l.action, l.detail, l.user?.displayName, l.entityType]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(filter.toLowerCase()),
      )
    : logs;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Transaction log</h1>
        <p className="text-sm text-muted-foreground">
          A per-user audit trail of write operations across the system.
        </p>
      </div>
      <Input
        className="max-w-sm"
        placeholder="Filter by user, action, detail…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      {loading ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No transactions found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.slice(0, 200).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(l.createdAt)}
                    </TableCell>
                    <TableCell>{l.user?.displayName ?? "—"}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-mono">
                        {l.action}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.detail ?? l.entityType ?? ""}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}