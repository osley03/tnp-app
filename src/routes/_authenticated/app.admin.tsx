import { useSession as useSession } from '@/lib/session';
import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileSearch,
  Gavel,
  LayoutDashboard,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useState, type ElementType } from "react";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { RoleSidebar } from "@/components/dashboard/RoleSidebar";
import { supabase } from "@/integrations/supabase/client";

import adminHeroBg from "@/assets/admin-hero-bg.png";
import profilesBg from "@/assets/admin-profiles-bg.png";
import propertiesBg from "@/assets/admin-properties-bg.png";
import leasesBg from "@/assets/admin-leases-bg.png";
import paymentsBg from "@/assets/admin-payments-bg.png";
import reviewsBg from "@/assets/admin-reviews-bg.png";
import disputesBg from "@/assets/admin-disputes-bg.png";
import casesBg from "@/assets/admin-cases-bg.png";
import aiBg from "@/assets/admin-ai-bg.png";
import accessibilityBg from "@/assets/admin-accessibility-bg.png";

type AdminSession = {
  user: {
    id: string;
    email?: string;
    user_metadata?: {
      full_name?: string;
    };
  } | null;
  role: string | null;
  loading: boolean;
};



function roleHome(role: string) {
  if (role === "landlord") return "/app/landlord";
  if (role === "tenant") return "/app/tenant";

  return "/app/admin";
}

export const Route = createFileRoute("/_authenticated/app/admin")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, role, loading } = useSession();

  const profileQuery = useQuery({
    queryKey: ["admin-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, verification, trust_score")
        .eq("id", user!.id)
        .maybeSingle();

      if (error) throw error;

      return data;
    },
  });

  const usersQuery = useQuery({
    queryKey: ["admin-users-count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("profiles").select("*", {
        count: "exact",
        head: true,
      });

      if (error) throw error;

      return count ?? 0;
    },
  });

  const propertiesQuery = useQuery({
    queryKey: ["admin-properties-count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("properties").select("*", {
        count: "exact",
        head: true,
      });

      if (error) throw error;

      return count ?? 0;
    },
  });

  const leasesQuery = useQuery({
    queryKey: ["admin-leases-count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("lease_requests").select("*", {
        count: "exact",
        head: true,
      });

      if (error) throw error;

      return count ?? 0;
    },
  });

  const scamCasesQuery = useQuery({
    queryKey: ["admin-scam-cases"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("scam_cases" as Parameters<typeof supabase.from>[0])
        .select("*", {
          count: "exact",
          head: true,
        });

      if (error) throw error;

      return count ?? 0;
    },
  });

  /*
   * IMPORTANT:
   * The Admin route is the parent route for:
   *
   * /app/admin
   * /app/admin/profiles
   * /app/admin/ai
   * /app/admin/accessibility
   *
   * Therefore, the parent keeps the sidebar/header,
   * while <Outlet /> renders the selected child module.
   */

  if (!loading && role && role !== "admin") {
    navigate({
      to: roleHome(role) as never,
    });

    return null;
  }

  const fullName =
    profileQuery.data?.full_name || user?.user_metadata?.["full_name"] || "Administrator";

  const firstName = fullName.split(" ")[0];

  const isAdminDashboard = location.pathname === "/app/admin";

  const stats = [
    {
      label: "Registered Users",
      value: usersQuery.data ?? 0,
      icon: Users,
      description: "Tenant and landlord profiles",
      href: "/app/admin/profiles",
    },
    {
      label: "Properties",
      value: propertiesQuery.data ?? 0,
      icon: Building2,
      description: "Listings currently in TNP",
      href: "/app/admin/properties",
    },
    {
      label: "Lease Requests",
      value: leasesQuery.data ?? 0,
      icon: FileSearch,
      description: "Applications requiring oversight",
      href: "/app/admin/leases",
    },
    {
      label: "Scam Reports",
      value: scamCasesQuery.data ?? 0,
      icon: ShieldAlert,
      description: "Reports submitted for review",
      href: "/app/admin/scam-cases",
    },
  ];

  return (
    <SidebarProvider>
      <RoleSidebar
        role="admin"
        userName={fullName}
        {...(user?.email ? { userEmail: user.email } : {})}
      />

      <SidebarInset className="min-w-0 bg-[#080909] text-white">
        <div className="min-h-screen w-full overflow-x-clip">
          {/* TOP BAR */}
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/[0.07] bg-[#080909]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger className="text-white hover:bg-white/10 hover:text-white" />

              <div className="hidden h-6 w-px bg-white/10 sm:block" />

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">Administration</p>

                <p className="hidden text-xs text-white/40 sm:block">TNP Management Console</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/6 px-3 py-1.5 sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />

                <span className="text-[11px] font-medium text-emerald-300">System Operational</span>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#c6a15b]/30 bg-[#c6a15b]/10 text-xs font-bold text-[#e4c47a]">
                {getInitials(fullName)}
              </div>
            </div>
          </header>

          {/*
           * DASHBOARD
           *
           * Only render the Admin Dashboard itself at:
           *
           * /app/admin
           *
           * When the URL is /app/admin/profiles,
           * /app/admin/ai, /app/admin/accessibility, etc.,
           * the child route is rendered through <Outlet />.
           */}
          {isAdminDashboard ? (
            <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              {/* HERO */}
              <section
                className="relative overflow-hidden rounded-3xl border border-white/8 bg-[#111313]"
                style={{
                  backgroundImage: `linear-gradient(90deg, rgba(7,18,35,0.70) 0%, rgba(7,18,35,0.45) 45%, rgba(7,18,35,0.18) 100%), url(${adminHeroBg})`,
                  backgroundPosition: "center",
                  backgroundSize: "cover",
                }}
              >
                <div className="absolute inset-0 bg-linear-to-r from-[#080909] via-transparent to-transparent" />

                <div className="relative px-6 py-10 sm:px-8 lg:px-10 lg:py-12">
                  <div className="max-w-3xl">
                    <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#c6a15b]/20 bg-[#c6a15b]/10 px-3 py-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-[#d8b76c]" />

                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#dfc27e]">
                        Administrator Access
                      </span>
                    </div>

                    <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
                      Welcome back, {firstName}.
                    </h1>

                    <p className="mt-4 max-w-2xl text-sm leading-7 text-white/55 sm:text-base">
                      Monitor the TNP ecosystem, review trust activity, manage property operations,
                      and investigate reports from one central control environment.
                    </p>

                    <div className="mt-7 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => navigate({ to: "/app/admin/scam-cases" })}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#c6a15b] px-4 py-2.5 text-sm font-semibold text-[#10100e] transition hover:bg-[#d6b56e]"
                      >
                        <ShieldAlert className="h-4 w-4" />
                        Review Cases
                        <ArrowRight className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          navigate({
                            to: "/app/admin/profiles" as never,
                          })
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/9"
                      >
                        <Users className="h-4 w-4" />
                        Manage Profiles
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* STATS */}
              <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((stat) => (
                  <StatCard
                    key={stat.label}
                    {...stat}
                    onClick={() =>
                      navigate({
                        to: stat.href as never,
                      })
                    }
                  />
                ))}
              </section>

              {/* OPERATIONS */}
              <section className="mt-10">
                <SectionHeading
                  eyebrow="CONTROL CENTRE"
                  title="Platform Operations"
                  description="Core administrative areas for managing the TNP ecosystem."
                />

                <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <AdminModuleCard
                    title="Profiles"
                    description="Review tenant and landlord accounts, verification information, and trust data."
                    icon={Users}
                    image={profilesBg}
                    href="/app/admin/profiles"
                    label="Manage profiles"
                    onClick={() =>
                      navigate({
                        to: "/app/admin/profiles" as never,
                      })
                    }
                  />

                  <AdminModuleCard
                    title="Properties"
                    description="Monitor property listings, ownership information, availability, and listing activity."
                    icon={Building2}
                    image={propertiesBg}
                    href="/app/admin/properties"
                    label="Manage properties"
                    onClick={() =>
                      navigate({
                        to: "/app/admin/properties" as never,
                      })
                    }
                  />

                  <AdminModuleCard
                    title="Leases"
                    description="Oversee lease requests, application activity, and tenant-landlord agreements."
                    icon={FileSearch}
                    image={leasesBg}
                    href="/app/admin/leases"
                    label="Review leases"
                    onClick={() =>
                      navigate({
                        to: "/app/admin/leases" as never,
                      })
                    }
                  />

                  <AdminModuleCard
                    title="Payments & Receipts"
                    description="Review landlord payments, provider confirmations and historical escrow records."
                    icon={Wallet}
                    image={paymentsBg}
                    href="/app/admin/payments"
                    label="View payments"
                    onClick={() =>
                      navigate({
                        to: "/app/admin/payments" as never,
                      })
                    }
                  />

                  <AdminModuleCard
                    title="Reviews"
                    description="Monitor reviews and reputation activity across the tenant and landlord network."
                    icon={CheckCircle2}
                    image={reviewsBg}
                    href="/app/admin/reviews"
                    label="Review activity"
                    onClick={() =>
                      navigate({
                        to: "/app/admin/reviews" as never,
                      })
                    }
                  />

                  <AdminModuleCard
                    title="Disputes"
                    description="Manage reported conflicts and track cases requiring administrative intervention."
                    icon={Gavel}
                    image={disputesBg}
                    href="/app/admin/disputes"
                    label="Manage disputes"
                    onClick={() =>
                      navigate({
                        to: "/app/admin/disputes" as never,
                      })
                    }
                  />

                  <AdminModuleCard
                    title="Scam Cases"
                    description="Investigate property and land scam reports using structured case information."
                    icon={ShieldAlert}
                    image={casesBg}
                    href="/app/admin/scam-cases"
                    label="Open case queue"
                    onClick={() =>
                      navigate({
                        to: "/app/admin/scam-cases" as never,
                      })
                    }
                  />

                  <AdminModuleCard
                    title="AI & Insights"
                    description="Access intelligent platform insights, trust signals, and operational analytics."
                    icon={BarChart3}
                    image={aiBg}
                    href="/app/admin/ai"
                    label="View insights"
                    onClick={() =>
                      navigate({
                        to: "/app/admin/ai" as never,
                      })
                    }
                  />

                  <AdminModuleCard
                    title="Accessibility"
                    description="Review accessibility-related settings and ensure the platform remains usable."
                    icon={ShieldCheck}
                    image={accessibilityBg}
                    href="/app/admin/accessibility"
                    label="Accessibility centre"
                    onClick={() =>
                      navigate({
                        to: "/app/admin/accessibility" as never,
                      })
                    }
                  />
                </div>
              </section>

              {/* ADMIN OVERVIEW */}
              <section className="mt-10 grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
                <div className="rounded-3xl border border-white/8 bg-[#101212] p-6 sm:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c6a15b]">
                        Administration Overview
                      </p>

                      <h2 className="mt-2 text-xl font-semibold text-white">
                        Keep the network trusted
                      </h2>

                      <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
                        Use the administrative modules to maintain account integrity, property
                        quality, transaction visibility, dispute resolution, and scam response.
                      </p>
                    </div>

                    <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#c6a15b]/15 bg-[#c6a15b]/10 sm:flex">
                      <ShieldCheck className="h-5 w-5 text-[#d7b66e]" />
                    </div>
                  </div>

                  <div className="mt-7 grid gap-3 sm:grid-cols-3">
                    <QuickAction
                      icon={Users}
                      title="Profiles"
                      text="Verify accounts"
                      onClick={() =>
                        navigate({
                          to: "/app/admin/profiles" as never,
                        })
                      }
                    />

                    <QuickAction
                      icon={Building2}
                      title="Properties"
                      text="Check listings"
                      onClick={() =>
                        navigate({
                          to: "/app/admin/properties" as never,
                        })
                      }
                    />

                    <QuickAction
                      icon={Gavel}
                      title="Cases"
                      text="Resolve reports"
                      onClick={() => navigate({ to: "/app/admin/scam-cases" })}
                    />
                  </div>
                </div>

                <div className="rounded-3xl border border-white/8 bg-linear-to-br from-[#15130f] to-[#101212] p-6 sm:p-7">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#c6a15b]/20 bg-[#c6a15b]/10">
                    <Clock3 className="h-5 w-5 text-[#d8b76c]" />
                  </div>

                  <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c6a15b]">
                    Trust Operations
                  </p>

                  <h3 className="mt-2 text-xl font-semibold text-white">
                    Administrative attention
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-white/45">
                    Scam reports, disputes, verification activity, and listing integrity should
                    remain visible from the central console.
                  </p>

                  <button
                    type="button"
                    onClick={() => navigate({ to: "/app/admin/scam-cases" })}
                    className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#d8b76c] transition hover:text-[#efd28b]"
                  >
                    Open case queue
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </section>

              {/* FOOTER */}
              <footer className="mt-10 border-t border-white/6 py-6">
                <div className="flex flex-col gap-2 text-xs text-white/30 sm:flex-row sm:items-center sm:justify-between">
                  <p>TNP · Tenant Network Profile · Harare</p>

                  <div className="flex items-center gap-2">
                    <LayoutDashboard className="h-3.5 w-3.5" />

                    <span>Administration Console</span>
                  </div>
                </div>
              </footer>
            </main>
          ) : (
            /*
             * CHILD ADMIN MODULES
             *
             * Example:
             * /app/admin/profiles
             *        ↓
             * <Outlet />
             *        ↓
             * AdminProfilesPage
             */
            <Outlet />
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

type StatCardProps = {
  label: string;
  value: number;
  icon: ElementType;
  description: string;
  href: string;
  onClick: () => void;
};

function StatCard({ label, value, icon: Icon, description, onClick }: StatCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border border-white/8 bg-[#101212] p-5 text-left transition duration-300 hover:-translate-y-0.5 hover:border-[#c6a15b]/25 hover:bg-[#131515]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.035]">
          <Icon className="h-5 w-5 text-[#d1ae65]" />
        </div>

        <ArrowRight className="h-4 w-4 text-white/20 transition group-hover:translate-x-0.5 group-hover:text-[#d1ae65]" />
      </div>

      <p className="mt-5 text-3xl font-semibold tracking-tight text-white">
        {value.toLocaleString()}
      </p>

      <p className="mt-1 text-sm font-medium text-white/75">{label}</p>

      <p className="mt-2 text-xs leading-5 text-white/35">{description}</p>
    </button>
  );
}

type AdminModuleCardProps = {
  title: string;
  description: string;
  icon: ElementType;
  image: string;
  href: string;
  label: string;
  onClick: () => void;
};

function AdminModuleCard({
  title,
  description,
  icon: Icon,
  image,
  label,
  onClick,
}: AdminModuleCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tnp-dashboard-tile group relative min-h-62.5 overflow-hidden rounded-3xl border border-white/8 bg-[#111313] text-left"
    >
      <img
        data-dashboard-art="true"
        src={image}
        alt=""
        aria-hidden="true"
        className="tnp-dashboard-image absolute inset-0 h-full w-full object-cover opacity-85 transition duration-700 group-hover:scale-105 group-hover:opacity-80"
      />

      <div className="absolute inset-0 bg-linear-to-t from-[#070808] via-[#070808]/80 to-[#070808]/20" />

      <div className="absolute inset-0 bg-linear-to-r from-black/50 to-transparent" />

      <div className="relative flex min-h-62.5 flex-col justify-end p-6">
        <div className="mb-auto">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/30 backdrop-blur-md">
            <Icon className="h-5 w-5 text-[#e0c078]" />
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold text-white">{title}</h3>

          <p className="mt-2 max-w-sm text-sm leading-6 text-white/55">{description}</p>

          <div className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#dfbf75]">
            {label}

            <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </button>
  );
}

function QuickAction({
  icon: Icon,
  title,
  text,
  onClick,
}: {
  icon: ElementType;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/2.5 p-4 text-left transition hover:border-[#c6a15b]/20 hover:bg-white/4.5"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#c6a15b]/10">
        <Icon className="h-4 w-4 text-[#d5b36b]" />
      </div>

      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{title}</p>

        <p className="mt-0.5 text-xs text-white/35">{text}</p>
      </div>
    </button>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c6a15b]">
        {eyebrow}
      </p>

      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{title}</h2>

      <p className="mt-2 text-sm text-white/40">{description}</p>
    </div>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);

  if (parts.length === 1) {
    return parts[0]?.slice(0, 2).toUpperCase() ?? "";
  }

  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}
