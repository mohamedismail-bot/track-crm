import {
  LayoutDashboard,
  Users,
  Package,
  BarChart3,
  Settings,
  ClipboardList,
  Bell,
  UserCog,
  Inbox,
  Wallet,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

export function buildNavItems(opts: {
  isAdmin: boolean;
  canViewReports: boolean;
  canViewTransactions: boolean;
  canManageUsers: boolean;
  canApproveRequests: boolean;
  canViewCredit: boolean;
}): NavItem[] {
  const items: NavItem[] = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      href: "/creators",
      label: "Creators",
      icon: <Users className="h-4 w-4" />,
    },
    {
      href: "/gifting",
      label: "Gifting",
      icon: <Package className="h-4 w-4" />,
    },
    {
      href: "/notifications",
      label: "Notifications",
      icon: <Bell className="h-4 w-4" />,
    },
  ];
  if (opts.canViewCredit) {
    items.push({
      href: "/credit",
      label: "Credit",
      icon: <Wallet className="h-4 w-4" />,
    });
  }
  if (opts.canApproveRequests) {
    items.push({
      href: "/requests",
      label: "Availability Requests",
      icon: <Inbox className="h-4 w-4" />,
    });
  }
  if (opts.canViewReports) {
    items.push({
      href: "/reports",
      label: "Reports",
      icon: <BarChart3 className="h-4 w-4" />,
    });
  }
  if (opts.canViewTransactions) {
    items.push({
      href: "/transactions",
      label: "Transaction Log",
      icon: <ClipboardList className="h-4 w-4" />,
    });
  }
  if (opts.isAdmin) {
    items.push({
      href: "/settings",
      label: "Settings",
      icon: <Settings className="h-4 w-4" />,
    });
  }
  if (opts.canManageUsers) {
    items.push({
      href: "/users",
      label: "Users & Roles",
      icon: <UserCog className="h-4 w-4" />,
    });
  }
  return items;
}