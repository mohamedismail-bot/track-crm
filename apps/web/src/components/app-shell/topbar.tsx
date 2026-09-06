"use client";

import * as React from "react";
import Link from "next/link";
import { Moon, Sun, Bell } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/display";
import { logoutAction } from "@/app/(auth)/login/actions";
import { SearchBox } from "./search";

export function Topbar({ unreadCount: initialUnread }: { unreadCount: number }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [unreadCount, setUnreadCount] = React.useState(initialUnread);
  const [user, setUser] = React.useState<{
    displayName: string;
    avatarUrl: string | null;
    roleName: string;
    teamName: string;
  } | null>(null);

  React.useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then(setUser)
      .catch(() => {});
  }, []);

  // Keep the notification badge in sync when notifications are read elsewhere.
  const refreshUnread = React.useCallback(() => {
    fetch("/api/notifications?unread=true")
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => setUnreadCount(Array.isArray(list) ? list.length : 0))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    refreshUnread();
    window.addEventListener("notifications-updated", refreshUnread);
    return () => window.removeEventListener("notifications-updated", refreshUnread);
  }, [refreshUnread]);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-sm">
      <SearchBox />
      <div className="ml-auto flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" asChild aria-label="Notifications" className="relative">
          <Link href="/notifications">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-7 w-7">
                {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.displayName} />}
                <AvatarFallback>{user ? initials(user.displayName) : "?"}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="font-semibold">{user?.displayName ?? "..."}</div>
              <div className="text-xs font-normal text-muted-foreground">
                {user?.roleName} · {user?.teamName}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logoutAction()}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}