"use client";

import * as React from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";

type CreditState = {
  enabled: boolean;
  currencySymbol: string;
  balance: number;
  transactions: unknown[];
} | null;

/** Compact balance chip in the topbar, linking to the Credit page. Hidden when
 *  credit is disabled or the account has no activity yet (e.g. warehouse). */
export function CreditChip({ creditEnabled }: { creditEnabled: boolean }) {
  const [credit, setCredit] = React.useState<CreditState>(null);

  React.useEffect(() => {
    if (!creditEnabled) return;
    fetch("/api/credit")
      .then((r) => (r.ok ? r.json() : null))
      .then(setCredit)
      .catch(() => setCredit(null));
  }, [creditEnabled]);

  if (!creditEnabled || !credit) return null;
  if (credit.balance === 0 && credit.transactions.length === 0) return null;

  return (
    <Link
      href="/credit"
      className="inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium hover:bg-accent"
      aria-label="Credit account"
    >
      <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
      <span>
        {credit.currencySymbol}{" "}
        {credit.balance.toLocaleString("en-US", { maximumFractionDigits: 2 })}
      </span>
    </Link>
  );
}