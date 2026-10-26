import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertTriangle,
  Building2,
  ClipboardCheck,
  CreditCard,
  FileText,
  Gavel,
  Home,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MapPinned,
  MessageSquare,
  Scale,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import type { ElementType } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";

type Role = "tenant" | "landlord" | "admin";

interface RoleSidebarProps {
  role: Role;
  userName?: string;
  userEmail?: string;
}

type NavItem = {
  title: string;
  href: string;
  icon: ElementType;
};

export const roleNavigation: Record<Role, NavItem[]> = {
  tenant: [
    { title: "Enquiries", href: "/app/tenant/enquiries", icon: MessageSquare },
    { title: "Dashboard", href: "/app/tenant", icon: LayoutDashboard },
    { title: "Find Properties", href: "/app/tenant/properties", icon: Home },
    { title: "My Applications", href: "/app/tenant/applications", icon: ClipboardCheck },
    { title: "My Leases", href: "/app/tenant/leases", icon: FileText },
    { title: "Payments & Receipts", href: "/app/tenant/payments", icon: Wallet },
    { title: "Landlords", href: "/app/tenant/landlords", icon: Users },
    { title: "Reviews", href: "/app/tenant/reviews", icon: MessageSquare },
    { title: "Report a Scam", href: "/app/tenant/report-scam", icon: AlertTriangle },
    { title: "Land Scam Check", href: "/app/tenant/land-scam-check", icon: MapPinned },
    { title: "AI Property Match", href: "/app/tenant/ai-match", icon: Sparkles },
  ],
  landlord: [
    { title: "Payments received", href: "/app/landlord/payments", icon: CreditCard },
    { title: "Enquiries", href: "/app/landlord/enquiries", icon: MessageSquare },
    { title: "Dashboard", href: "/app/landlord", icon: LayoutDashboard },
    { title: "My Properties", href: "/app/landlord/properties", icon: Building2 },
    { title: "Portfolio", href: "/app/landlord/portfolio", icon: LayoutDashboard },
    { title: "360° Tour Manager", href: "/app/landlord/tours", icon: MapPinned },
    { title: "Lease Requests", href: "/app/landlord/requests", icon: ClipboardCheck },
    { title: "Applicants", href: "/app/landlord/applicants", icon: Users },
    { title: "Trust Profiles", href: "/app/landlord/trust-profiles", icon: UserCheck },
    { title: "Legacy escrow records", href: "/app/landlord/escrow", icon: Wallet },
    { title: "Reviews", href: "/app/landlord/reviews", icon: MessageSquare },
    { title: "Disputes", href: "/app/landlord/disputes", icon: Scale },
    { title: "Listing Integrity", href: "/app/landlord/integrity", icon: ShieldCheck },
  ],
  admin: [
    { title: "Dashboard", href: "/app/admin", icon: LayoutDashboard },
    { title: "Profiles", href: "/app/admin/profiles", icon: Users },
    { title: "Properties", href: "/app/admin/properties", icon: Building2 },
    { title: "Leases", href: "/app/admin/leases", icon: FileText },
    { title: "Payments", href: "/app/admin/payments", icon: CreditCard },
    { title: "Reviews", href: "/app/admin/reviews", icon: MessageSquare },
    { title: "Disputes", href: "/app/admin/disputes", icon: Scale },
    { title: "Scam Cases", href: "/app/admin/scam-cases", icon: Gavel },
    { title: "AI & Insights", href: "/app/admin/ai", icon: Sparkles },
    { title: "Accessibility", href: "/app/admin/accessibility", icon: LifeBuoy },
  ],
};

/* =========================================================
   ROLE SIDEBAR
========================================================= */

export function RoleSidebar({ role, userName = "TNP User", userEmail }: RoleSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const items = roleNavigation[role];
  const qc = useQueryClient();
  const [logoutError, setLogoutError] = useState("");

  const handleLogout = async () => {
    await qc.cancelQueries();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setLogoutError("Unable to sign out. Please retry.");
      return;
    }
    qc.clear();
    navigate({ to: "/auth", replace: true });
  };

  const isActive = (href: string) => {
    if (href === `/app/${role}`) {
      return location.pathname === href;
    }
    return location.pathname === href || location.pathname.startsWith(`${href}/`);
  };

  const initials =
    userName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((name) => name[0]?.toUpperCase())
      .join("") || "TN";

  return (
    <Sidebar collapsible="icon" variant="floating" className="border-slate-200 bg-white">
      {/* =====================================================
          BRAND + TOGGLE
      ===================================================== */}

      <SidebarHeader className="border-b border-slate-200 px-3 py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-1">
              <SidebarMenuButton
                size="lg"
                className="hover:bg-slate-100"
                onClick={() => navigate({ to: `/app/${role}` as never })}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#c99552] to-[#8b5e2b] text-black shadow-lg">
                  <ShieldCheck className="size-5" />
                </div>

                <div className="grid flex-1 text-left text-sm leading-tight group-data">
                  <span className="truncate font-bold tracking-wide text-slate-900">TNP</span>
                  <span className="truncate text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                    Mutual Trust Ledger
                  </span>
                </div>
              </SidebarMenuButton>

              <SidebarTrigger className="shrink-0 text-slate-500 hover:bg-slate-100 hover:text-slate-900 group-data-[collapsible=icon]:hidden" />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* =====================================================
          NAVIGATION — scrolls on its own if a role has more
          items than fit the viewport, instead of being crushed
      ===================================================== */}

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {role === "admin"
              ? "Administration"
              : role === "landlord"
                ? "Property Management"
                : "Tenant Workspace"}
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {items.map((item) => {
                const active = isActive(item.href);

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={active}
                      className={[
                        "h-10 rounded-xl transition-all duration-200",
                        active
                          ? "bg-[#c99552]/15 text-[#8b5e2b] shadow-sm hover:bg-[#c99552]/25 hover:text-[#6e4a2b]"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                      ].join(" ")}
                    >
                      <a href={item.href}>
                        <item.icon className="size-[17px] shrink-0" />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ===================================================
            SYSTEM
        =================================================== */}

        <SidebarGroup className="mt-auto pt-4">
          <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            System
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Settings"
                  className="h-10 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  <a href="/app/settings">
                    <Settings className="size-[17px]" />
                    <span>Settings</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* =====================================================
          USER FOOTER — stays pinned, outside the scroll area
      ===================================================== */}

      {logoutError && (
        <p role="alert" className="px-4 text-xs text-red-700">
          {logoutError}
        </p>
      )}
      <SidebarFooter className="border-t border-white/[0.07] p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={userName}
              className="rounded-xl hover:bg-slate-100"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#c99552]/40 bg-[#c99552]/10 text-xs font-bold text-[#8b5e2b] shadow-sm">
                {initials}
              </div>

              <div className="grid flex-1 text-left text-xs leading-tight group-data">
                <span className="truncate font-semibold text-slate-900">{userName}</span>
                <span className="truncate text-[10px] text-slate-500">{userEmail || role}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              onClick={handleLogout}
              className="h-9 rounded-xl text-slate-500 hover:bg-red-500/10 hover:text-red-600"
            >
              <LogOut className="size-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
