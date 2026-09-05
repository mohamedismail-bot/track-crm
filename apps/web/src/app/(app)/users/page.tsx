"use client";

import * as React from "react";
import { Plus, Archive, RotateCcw, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/display";

interface UserRow {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  roleSlug: string;
  roleName: string;
  teamId: string;
  teamName: string;
  archivedAt: string | null;
  createdAt: string;
}
interface TeamRow {
  id: string;
  name: string;
  slug: string;
}

export default function UsersPage() {
  const [users, setUsers] = React.useState<UserRow[]>([]);
  const [teams, setTeams] = React.useState<TeamRow[]>([]);
  const [roles, setRoles] = React.useState<{ id: string; name: string; slug: string; immutable: boolean }[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      const d = await res.json();
      if (res.ok) {
        setUsers(d.users);
        setTeams(d.teams);
        setRoles(d.roles);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: f.get("displayName"),
          email: f.get("email") || undefined,
          phone: f.get("phone") || undefined,
          roleSlug: f.get("roleSlug"),
          teamId: f.get("teamId"),
          password: f.get("password"),
        }),
      });
      const j = await res.json();
      if (!res.ok) return toast({ title: j.error ?? "Could not create user", variant: "destructive" });
      toast({ title: "User created" });
      setOpen(false);
      load();
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) return toast({ title: j.error ?? "Update failed", variant: "destructive" });
      toast({ title: "User updated" });
      load();
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage accounts, roles and teams.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Add user
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} className={u.archivedAt ? "opacity-50" : ""}>
                  <TableCell className="font-medium">
                    {u.displayName}
                    {u.archivedAt ? <Badge variant="secondary" className="ml-2">archived</Badge> : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.email ?? u.phone ?? "—"}
                  </TableCell>
                  <TableCell>
                    <RoleSelect
                      value={u.roleSlug}
                      roles={roles}
                      onChange={(v) => patch(u.id, { roleSlug: v })}
                    />
                  </TableCell>
                  <TableCell>
                    <TeamSelect
                      value={u.teamId}
                      teams={teams}
                      onChange={(v) => patch(u.id, { teamId: v })}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(u.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {u.archivedAt ? (
                      <Button size="icon" variant="ghost" title="Restore" onClick={() => patch(u.id, { archived: false })}>
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button size="icon" variant="ghost" title="Archive" onClick={() => patch(u.id, { archived: true })}>
                        <Archive className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Reset password"
                      onClick={() => {
                        const pw = prompt("New password (min 8 chars)");
                        if (pw) patch(u.id, { password: pw });
                      }}
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>The user will sign in with the email or phone and this password.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="u-display">Display name *</Label>
              <Input id="u-display" name="displayName" placeholder="Team Leader name" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="u-email">Email</Label>
                <Input id="u-email" name="email" type="email" placeholder="name@company.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-phone">Phone</Label>
                <Input id="u-phone" name="phone" type="tel" placeholder="+20 …" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select name="roleSlug" required defaultValue="team-leader">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.slug}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Team</Label>
                <Select name="teamId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-pw">Password *</Label>
              <Input id="u-pw" name="password" type="password" placeholder="Min 8 characters" required minLength={8} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Creating…" : "Create user"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoleSelect({
  value,
  roles,
  onChange,
}: {
  value: string;
  roles: { id: string; name: string; slug: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {roles.map((r) => (
          <SelectItem key={r.id} value={r.slug}>
            {r.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TeamSelect({
  value,
  teams,
  onChange,
}: {
  value: string;
  teams: TeamRow[];
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {teams.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}