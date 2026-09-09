import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { PERMISSIONS } from "@/lib/constants";
import { Sidebar } from "@/components/app-shell/sidebar";
import { buildNavItems } from "@/components/app-shell/nav-items";
import { Topbar } from "@/components/app-shell/topbar";
import { BrandAccent } from "@/components/brand-accent";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  const settings = await getSettings();

  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });

  const navItems = buildNavItems({
    isAdmin: user.isAdmin,
    canViewReports: user.permissions.includes(PERMISSIONS.REPORT_VIEW),
    canViewTransactions: user.permissions.includes(PERMISSIONS.TRANSACTION_LOG_VIEW),
    canManageUsers: user.permissions.includes(PERMISSIONS.USER_MANAGE),
    canApproveRequests: user.permissions.includes(PERMISSIONS.REQUEST_APPROVE),
    canViewCredit: user.permissions.includes(PERMISSIONS.CREDIT_VIEW),
  });

  return (
    <div className="flex min-h-[100dvh]">
      <BrandAccent primaryColor={settings.primaryColor} />
      <Sidebar
        navItems={navItems}
        workspaceName={settings.name}
        logoUrl={settings.logoUrl || null}
        roleName={user.roleName}
        teamName={user.teamName}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar unreadCount={unreadCount} creditEnabled={settings.creditEnabled} />
        <main className="flex-1 overflow-x-hidden p-6">{children}</main>
      </div>
    </div>
  );
}