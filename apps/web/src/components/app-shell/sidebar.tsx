"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavItem } from "./nav-items";

export function Sidebar({
  navItems,
  workspaceName,
  logoUrl,
  roleName,
  teamName,
}: {
  navItems: NavItem[];
  workspaceName: string;
  logoUrl: string | null;
  roleName: string;
  teamName: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 flex-col border-r bg-card">
      <div className="flex items-center gap-2.5 px-3 py-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={workspaceName}
            className="h-7 w-7 shrink-0 rounded-lg object-contain"
          />
        ) : (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
            {workspaceName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <span className="truncate text-sm font-semibold tracking-tight">
          {workspaceName}
        </span>
      </div>
      <nav className="flex-1 space-y-1 px-2">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t px-3 py-3">
        <div>
          <p className="truncate text-xs font-medium">{roleName}</p>
          <p className="truncate text-xs text-muted-foreground">{teamName}</p>
        </div>
      </div>
    </aside>
  );
}