"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Plus, UserPlus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { initials, formatFollowerCount } from "@/lib/display";
import { Button } from "@/components/ui/button";

interface SearchResult {
  id: string;
  name: string;
  platform: string | null;
  handle: string | null;
  followers: number | null;
  stageName: string | null;
  ownerName: string | null;
  teamName: string | null;
  relationship: "owned" | "same_team" | "other_team" | "available" | "none";
}

function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function SearchBox() {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const debounced = useDebounced(query);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (debounced.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    fetch(`/api/search?q=${encodeURIComponent(debounced.trim())}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data: SearchResult[]) => {
        setResults(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => controller.abort();
  }, [debounced]);

  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const menuActive = open && query.trim().length >= 2;

  return (
    <div
      ref={containerRef}
      className="pointer-events-auto relative z-50 w-full max-w-md"
    >
      <Search className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        className="pl-8 pr-8"
        placeholder="Search name, link, @handle, email or phone..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (e.target.value.trim().length >= 2) setOpen(true);
        }}
        onFocus={() => {
          if (query.trim().length >= 2) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {query.trim().length >= 2 ? (
        <button
          type="button"
          aria-label="Clear search"
          tabIndex={-1}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setQuery("");
            setResults([]);
            setOpen(false);
            inputRef.current?.focus();
          }}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
      {menuActive ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          {loading ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : results.length === 0 ? (
            <div className="p-1">
              <Link
                href="/creators?new=1"
                className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <Plus className="h-4 w-4" />
                + Add Creator &amp; Assign to Me
              </Link>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto p-1">
              {results.map((r) => (
                <Link
                  key={r.id}
                  href={`/creators/${r.id}`}
                  onClick={() => setOpen(false)}
                  className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent"
                >
                  <Avatar className="mt-0.5 h-8 w-8">
                    <AvatarFallback className="text-xs">{initials(r.name)}</AvatarFallback>
                  </Avatar>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-foreground">{r.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {r.handle ? `@${r.handle}` : ""} {r.stageName ? `· ${r.stageName}` : ""}{" "}
                      {formatFollowerCount(r.followers) !== "—" ? `· ${formatFollowerCount(r.followers)}` : ""}
                    </span>
                  </span>
                  {r.relationship === "other_team" && (
                    <span className="ml-auto mt-0.5 inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      <UserPlus className="h-3 w-3" /> Other team
                    </span>
                  )}
                  {r.relationship === "available" && (
                    <span className="ml-auto mt-0.5 inline-flex shrink-0 items-center rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      Available
                    </span>
                  )}
                  {r.relationship === "owned" && (
                    <span className="ml-auto mt-0.5 inline-flex shrink-0 items-center rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      You own
                    </span>
                  )}
                </Link>
              ))}
              <Link
                href="/creators?new=1"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-accent"
              >
                <Plus className="h-3.5 w-3.5" />
                Add new creator
              </Link>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function SearchTrigger() {
  return (
    <Button variant="outline" size="sm" className="text-muted-foreground">
      <Search className="h-4 w-4" />
      Search...
    </Button>
  );
}