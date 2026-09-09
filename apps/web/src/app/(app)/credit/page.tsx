"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Wallet, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/display";

interface Transaction {
  id: string;
  amount: number;
  type: "CREDIT" | "DEBIT";
  reason: string;
  refType: string;
  refId: string;
  createdAt: string;
}

interface CreditResponse {
  enabled: boolean;
  currencyCode: string;
  currencySymbol: string;
  balance: number;
  transactions: Transaction[];
}

interface UserCreditRow {
  userId: string;
  name: string;
  email: string;
  team: string;
  balance: number;
  transactionCount: number;
}

export default function CreditPage() {
  const [credit, setCredit] = React.useState<CreditResponse | null>(null);
  const [users, setUsers] = React.useState<UserCreditRow[]>([]);

  React.useEffect(() => {
    fetch("/api/credit")
      .then((r) => (r.ok ? r.json() : null))
      .then(setCredit)
      .catch(() => setCredit(null));
    fetch("/api/credit/users")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setUsers(d?.users ?? []))
      .catch(() => setUsers([]));
  }, []);

  if (!credit) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading credit account…
      </div>
    );
  }

  const fmt = (n: number) =>
    `${credit.currencySymbol} ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Credit account</h1>
        <p className="text-sm text-muted-foreground">
          Your ledger of gifting spend: a credit when an order is delivered, cleared once its
          deliverables are received.
        </p>
      </div>

      {!credit.enabled ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Credit accounts are disabled in this workspace.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardDescription>Running balance — delivered but not yet fulfilled</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <div className="text-3xl font-semibold tracking-tight">{fmt(credit.balance)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Transactions</CardTitle>
              <CardDescription>
                <Link href="/gifting" className="underline underline-offset-2">
                  View gifting orders
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {credit.transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No transactions yet.</p>
              ) : (
                <div className="divide-y">
                  {credit.transactions.map((t) => {
                    const isCredit = t.type === "CREDIT";
                    return (
                      <div key={t.id} className="flex items-center justify-between gap-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                            {isCredit ? (
                              <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4 text-rose-600" />
                            )}
                          </span>
                          <div>
                            <p className="text-sm font-medium">{t.reason}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(t.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={isCredit ? "default" : "outline"}>
                            {isCredit ? "+" : "−"}
                            {fmt(t.amount)}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {users.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Team credit balances</CardTitle>
                <CardDescription>Delivered-but-unfulfilled gifting spend per user.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Transactions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.userId}>
                        <TableCell>
                          <div className="font-medium">{u.name}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </TableCell>
                        <TableCell>{u.team}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(u.balance)}</TableCell>
                        <TableCell className="text-right">{u.transactionCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}