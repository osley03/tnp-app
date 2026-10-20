import { TenantPaymentShortcut } from "@/modules/payments/TenantPaymentShortcut";
import { applicationStatus } from '@/lib/application-status';
import { useSession as useTenantSession } from '@/lib/session';
import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Compass,
  CreditCard,
  FileText,
  Heart,
  Home,
  KeyRound,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { RoleSidebar } from "@/components/dashboard/RoleSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

import adminHeroBg from "@/assets/admin-hero-bg.png";
import adminPropertiesBg from "@/assets/admin-properties-bg.png";
import adminLeasesBg from "@/assets/admin-leases-bg.png";
import adminPaymentsBg from "@/assets/admin-payments-bg.png";
import adminReviewsBg from "@/assets/admin-reviews-bg.png";
import adminCasesBg from "@/assets/admin-cases-bg.png";
import adminAiBg from "@/assets/admin-ai-bg.png";

/* =============================================================
   ROLE HOME
============================================================= */

const roleHome = (role: string) => {
  if (role === "admin") return "/app/admin" as const;
  if (role === "landlord") return "/app/landlord" as const;

  return "/app/tenant" as const;
};

/* =============================================================
   ROUTE
============================================================= */

export const Route = createFileRoute("/_authenticated/app/tenant")({
  component: TenantLayout,
});

/* =============================================================
   TYPES
============================================================= */

type TenantModule = {
  title: string;
  description: string;
  eyebrow: string;
  icon: ElementType;
  image: string;
  href: string;
};

type PropertyCardData = Database["public"]["Tables"]["properties"]["Row"] & {
  name?: string;
  location?: string;
  address?: string;
  price?: number;
};

type LeaseRequest = Database["public"]["Tables"]["lease_requests"]["Row"];

/* =============================================================
   SESSION
============================================================= */



/* =============================================================
   TENANT LAYOUT
   IMPORTANT:
   This is the parent shell for all Tenant modules.
============================================================= */

function TenantLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, role, loading } = useTenantSession();

  /* ===========================================================
     ROLE PROTECTION
  =========================================================== */

  useEffect(() => {
    if (!loading && role && role !== "tenant") {
      navigate({
        to: roleHome(role),
      });
    }
  }, [loading, role, navigate]);

  /* ===========================================================
     PROFILE
  =========================================================== */

  const profileQuery = useQuery({
    queryKey: ["tenant-profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, verification, trust_score")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },
  });

  /* ===========================================================
     DASHBOARD PROPERTY DATA
  =========================================================== */

  const propertiesQuery = useQuery({
    queryKey: ["tenant-properties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*").limit(6);

      if (error) {
        throw error;
      }

      return data ?? [];
    },
  });

  /* ===========================================================
     APPLICATION DATA
  =========================================================== */

  const applicationsQuery = useQuery({
    queryKey: ["tenant-applications", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("lease_requests")
        .select("*")
        .eq("tenant_id", user.id)
        .order("created_at", {
          ascending: false,
        })
        .limit(5);

      if (error) {
        throw error;
      }

      return data ?? [];
    },
  });

  /* ===========================================================
     PROFILE VALUES
  =========================================================== */

  const fullName = profileQuery.data?.full_name || user?.user_metadata?.["full_name"] || "Tenant";

  const firstName = fullName.split(" ")[0] || "Tenant";

  const trustScore = profileQuery.data?.trust_score ?? 50;

  const verification = profileQuery.data?.verification || "Email";

  const propertyCount = propertiesQuery.data?.length ?? 0;

  const applicationCount = applicationsQuery.data?.length ?? 0;

  const pendingApplications =
    applicationsQuery.data?.filter(
      (application) => applicationStatus(application.status) === "Pending review",
    ).length ?? 0;

  /* ===========================================================
     TENANT MODULES
  =========================================================== */

  const modules: TenantModule[] = useMemo(
    () => [
      {
        title: "Find Properties",
        description:
          "Discover verified homes, apartments and rental opportunities across the TNP network.",
        eyebrow: "PROPERTY DISCOVERY",
        icon: Home,
        image: adminPropertiesBg,
        href: "/app/tenant/properties",
      },
      {
        title: "My Applications",
        description:
          "Track applications, landlord decisions and your next steps from one secure workspace.",
        eyebrow: "APPLICATIONS",
        icon: FileText,
        image: adminLeasesBg,
        href: "/app/tenant/applications",
      },
      {
        title: "My Leases",
        description:
          "View active leases, rental information, important dates and your tenancy documents.",
        eyebrow: "LEASE MANAGEMENT",
        icon: KeyRound,
        image: adminLeasesBg,
        href: "/app/tenant/leases",
      },
      {
        title: "Pay Rent & Receipts",
        description:
          "Pay your landlord directly, submit proof and track confirmations and dated receipts.",
        eyebrow: "FINANCIAL SECURITY",
        icon: Wallet,
        image: adminPaymentsBg,
        href: "/app/tenant/payments",
      },
      {
        title: "Landlords",
        description: "Explore landlord profiles, trust information, ratings and rental history.",
        eyebrow: "TRUST NETWORK",
        icon: ShieldCheck,
        image: adminReviewsBg,
        href: "/app/tenant/landlords",
      },
      {
        title: "Reviews",
        description: "Share your rental experience and help strengthen the TNP trust network.",
        eyebrow: "COMMUNITY TRUST",
        icon: Star,
        image: adminReviewsBg,
        href: "/app/tenant/reviews",
      },
      {
        title: "Report a Scam",
        description: "Report suspicious rental activity and securely provide information to TNP.",
        eyebrow: "SAFETY & REPORTING",
        icon: AlertTriangle,
        image: adminCasesBg,
        href: "/app/tenant/report-scam",
      },
      {
        title: "Land Scam Check",
        description:
          "Request assistance when dealing with suspicious or disputed land transactions.",
        eyebrow: "LAND VERIFICATION",
        icon: MapPin,
        image: adminCasesBg,
        href: "/app/tenant/land-scam-check",
      },
      {
        title: "AI Property Match",
        description:
          "Discover rental opportunities that better match your needs, preferences and budget.",
        eyebrow: "SMART MATCHING",
        icon: Sparkles,
        image: adminAiBg,
        href: "/app/tenant/ai-match",
      },
    ],
    [],
  );

  /* ===========================================================
     LOADING
  =========================================================== */

  if (loading) {
    return (
      <div className="tnp-module tnp-module-dark flex min-h-screen items-center justify-center bg-[#080909] text-white">
        <div className="flex items-center gap-3 text-sm text-white/50">
          <div className="size-5 animate-spin rounded-full border-2 border-white/10 border-t-[#d9ad68]" />
          Loading your tenant workspace...
        </div>
      </div>
    );
  }

  /* ===========================================================
     CHILD ROUTE DETECTION
     
     The parent owns the sidebar.
     The dashboard itself is only shown at /app/tenant.
     Child modules render through Outlet.
  =========================================================== */

  const isTenantDashboard =
    location.pathname === "/app/tenant" || location.pathname === "/app/tenant/";

  /* ===========================================================
     SHELL
  =========================================================== */

  return (
    <SidebarProvider>
      <RoleSidebar
        role="tenant"
        userName={fullName}
        {...(user?.email ? { userEmail: user.email } : {})}
      />

      <SidebarInset className="min-w-0 bg-[#080909] text-white">
        <div className="min-h-screen w-full">
          {/* =================================================
              TOP BAR
          ================================================== */}

          <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#080909]/70 backdrop-blur-2xl">
            <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <SidebarTrigger className="shrink-0 rounded-lg text-white/60 hover:bg-white/[0.08] hover:text-white" />

                <div className="hidden h-5 w-px bg-white/10 sm:block" />

                <div className="min-w-0">
                  <p className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-[#d9ad68]/70">
                    Tenant Workspace
                  </p>

                  <p className="truncate text-sm font-semibold text-white">
                    Property & Trust Management
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Link
                  to="/app/tenant/properties"
                  className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-white/80 backdrop-blur-xl transition hover:border-[#d9ad68]/30 hover:bg-white/[0.1] hover:text-white sm:flex"
                >
                  <Search className="size-4" />
                  Find a property
                </Link>

                <div className="flex size-9 items-center justify-center rounded-full border border-[#d9ad68]/40 bg-[#d9ad68]/15 text-xs font-bold text-[#e5bd7d] shadow-lg shadow-[#d9ad68]/5">
                  {firstName.charAt(0).toUpperCase()}
                </div>
              </div>
            </div>
          </header>

          {/* =================================================
              CHILD MODULES
              
              The dashboard is not rendered here when a child
              route is active. The child appears inside the
              existing Tenant sidebar shell.
          ================================================== */}

          {!isTenantDashboard ? (
            <main className="min-h-[calc(100vh-4rem)] w-full">
              <Outlet />
            </main>
          ) : (
            /* =================================================
               TENANT DASHBOARD
            ================================================== */

            <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              <TenantPaymentShortcut />
              {/* =================================================
                  HERO
              ================================================== */}

              <section className="relative isolate overflow-hidden rounded-[30px] border border-white/15 shadow-2xl shadow-black/40">
                <img
        data-dashboard-art="true"
                  src={adminHeroBg}
                  alt=""
                  className="absolute inset-0 h-full w-full scale-[1.02] object-cover object-center"
                />

                <div className="absolute inset-0 bg-black/35" />

                <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/35 to-black/10" />

                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />

                <div className="relative grid min-h-[390px] items-center gap-8 p-6 sm:p-9 lg:grid-cols-[1.3fr_0.7fr] lg:p-12">
                  <div className="max-w-3xl">
                    <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#f0ce94] shadow-lg backdrop-blur-xl">
                      <ShieldCheck className="size-3.5" />
                      Mutual Trust Ledger
                    </div>

                    <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-6xl">
                      Find a home
                      <span className="block text-[#e1b875]">you can trust.</span>
                    </h1>

                    <p className="mt-5 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
                      Welcome back, <span className="font-semibold text-white">{firstName}</span>.
                      Discover verified properties, connect with trusted landlords and manage your
                      rental journey securely from one place.
                    </p>

                    <div className="mt-7 flex flex-wrap gap-3">
                      <Link
                        to="/app/tenant/properties"
                        className="inline-flex items-center gap-2 rounded-xl bg-[#d1a25e] px-5 py-3 text-sm font-bold text-[#111] shadow-xl shadow-[#c99552]/20 transition hover:-translate-y-0.5 hover:bg-[#e0b875]"
                      >
                        Explore properties
                        <ArrowRight className="size-4" />
                      </Link>

                      <Link
                        to="/app/tenant/ai-match"
                        className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white shadow-lg backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/15"
                      >
                        <Sparkles className="size-4 text-[#e2b875]" />
                        AI property match
                      </Link>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-white/50">
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/30" />
                        Verified listings
                      </span>

                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-[#d9ad68]" />
                        Recorded payment evidence
                      </span>

                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-blue-400" />
                        Trusted relationships
                      </span>
                    </div>
                  </div>

                  {/* TRUST PANEL */}

                  <div className="hidden lg:flex lg:justify-end">
                    <div className="w-full max-w-sm rounded-[24px] border border-white/20 bg-black/30 p-6 shadow-2xl backdrop-blur-2xl">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
                            Your trust profile
                          </p>

                          <div className="mt-2 flex items-baseline gap-1">
                            <span className="text-4xl font-bold text-white">{trustScore}</span>

                            <span className="text-sm text-white/35">/100</span>
                          </div>
                        </div>

                        <div className="flex size-12 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 backdrop-blur-xl">
                          <ShieldCheck className="size-6 text-emerald-300" />
                        </div>
                      </div>

                      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#8b5e2b] via-[#c99552] to-[#efd08f]"
                          style={{
                            width: `${Math.min(Math.max(trustScore, 0), 100)}%`,
                          }}
                        />
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-xl">
                          <p className="text-[9px] uppercase tracking-wider text-white/35">
                            Verification
                          </p>

                          <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                            <CheckCircle2 className="size-3.5" />
                            {verification}
                          </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-xl">
                          <p className="text-[9px] uppercase tracking-wider text-white/35">
                            Applications
                          </p>

                          <p className="mt-1 text-xs font-semibold text-white">
                            {applicationCount} active
                          </p>
                        </div>
                      </div>

                      <Link
                        to="/app/settings"
                        className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                      >
                        Strengthen your profile
                        <ChevronRight className="size-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </section>

              {/* =================================================
                  QUICK STATUS
              ================================================== */}

              <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  icon={Home}
                  label="Available properties"
                  value={String(propertyCount)}
                  detail="Homes currently visible"
                  image={adminPropertiesBg}
                />

                <MetricCard
                  icon={FileText}
                  label="My applications"
                  value={String(applicationCount)}
                  detail={
                    pendingApplications > 0
                      ? `${pendingApplications} awaiting review`
                      : "Recent requests"
                  }
                  image={adminLeasesBg}
                />

                <MetricCard
                  icon={ShieldCheck}
                  label="Trust score"
                  value={String(trustScore)}
                  detail="Your TNP profile strength"
                  image={adminReviewsBg}
                />

                <MetricCard
                  icon={CreditCard}
                  label="Escrow protection"
                  value="Protected"
                  detail="TNP transaction layer"
                  image={adminPaymentsBg}
                />
              </section>

              {/* =================================================
                  RENTAL JOURNEY
              ================================================== */}

              <section className="mt-12">
                <SectionHeading
                  eyebrow="YOUR RENTAL JOURNEY"
                  title="From search to secure tenancy"
                  description="TNP connects every stage of your property journey through one trusted workspace."
                />

                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <JourneyCard
                    number="01"
                    icon={Compass}
                    title="Discover"
                    description="Find verified homes that fit your needs."
                    href="/app/tenant/properties"
                    image={adminPropertiesBg}
                  />

                  <JourneyCard
                    number="02"
                    icon={FileText}
                    title="Apply"
                    description="Send applications and track decisions."
                    href="/app/tenant/applications"
                    image={adminLeasesBg}
                  />

                  <JourneyCard
                    number="03"
                    icon={KeyRound}
                    title="Lease"
                    description="Manage your tenancy and documents."
                    href="/app/tenant/leases"
                    image={adminLeasesBg}
                  />

                  <JourneyCard
                    number="04"
                    icon={Wallet}
                    title="Pay securely"
                    description="Pay rent or deposits and view your receipts."
                    href="/app/tenant/payments"
                    image={adminPaymentsBg}
                  />
                </div>
              </section>

              {/* =================================================
                  FEATURED PROPERTY DISCOVERY
              ================================================== */}

              <section className="mt-12">
                <div className="flex items-end justify-between gap-4">
                  <SectionHeading
                    eyebrow="DISCOVER"
                    title="Find your next home"
                    description="Explore properties currently available through the TNP network."
                  />

                  <Link
                    to="/app/tenant/properties"
                    className="hidden items-center gap-1 text-xs font-semibold text-[#d9ad68] transition hover:text-white sm:flex"
                  >
                    View all properties
                    <ChevronRight className="size-4" />
                  </Link>
                </div>

                {propertiesQuery.isLoading ? (
                  <PropertyLoadingGrid />
                ) : propertiesQuery.isError ? (
                  <ErrorState
                    title="Unable to load properties"
                    description="There was a problem retrieving available properties."
                  />
                ) : propertiesQuery.data?.length === 0 ? (
                  <EmptyState
                    icon={Home}
                    title="No properties available"
                    description="There are currently no property listings to display. Check again later or try AI Property Match."
                    action={
                      <Link
                        to="/app/tenant/ai-match"
                        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#d9ad68]/20 bg-[#d9ad68]/10 px-4 py-2.5 text-xs font-bold text-[#e2bb7c] transition hover:bg-[#d9ad68]/15"
                      >
                        <Sparkles className="size-3.5" />
                        Try AI Property Match
                      </Link>
                    }
                  />
                ) : (
                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {propertiesQuery.data?.slice(0, 6).map((property: PropertyCardData) => (
                      <PropertyCard key={property.id} property={property} />
                    ))}
                  </div>
                )}
              </section>

              {/* =================================================
                  AI MATCH
              ================================================== */}

              <section className="mt-12">
                <div className="relative overflow-hidden rounded-[26px] border border-[#d9ad68]/20 shadow-2xl shadow-black/30">
                  <img
        data-dashboard-art="true"
                    src={adminAiBg}
                    alt=""
                    className="tnp-dashboard-image absolute inset-0 h-full w-full object-cover"
                  />

                  <div className="absolute inset-0 bg-black/45" />

                  <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/35 to-black/10" />

                  <div className="relative flex min-h-[250px] flex-col justify-center gap-7 p-7 sm:p-9 lg:flex-row lg:items-center lg:justify-between lg:p-12">
                    <div className="max-w-2xl">
                      <div className="inline-flex items-center gap-2 rounded-full border border-[#e0bd7d]/20 bg-[#d9ad68]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#e7c88e] backdrop-blur-xl">
                        <Sparkles className="size-3.5" />
                        Smart matching
                      </div>

                      <h2 className="mt-4 text-2xl font-bold text-white sm:text-3xl">
                        Let TNP help you find the right property.
                      </h2>

                      <p className="mt-3 max-w-xl text-sm leading-6 text-white/60">
                        Tell us what matters to you — location, budget, property type and
                        preferences — and explore properties that better match your needs.
                      </p>
                    </div>

                    <Link
                      to="/app/tenant/ai-match"
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#d1a25e] px-5 py-3 text-sm font-bold text-black shadow-xl transition hover:-translate-y-0.5 hover:bg-[#e0b875]"
                    >
                      Start matching
                      <ArrowRight className="size-4" />
                    </Link>
                  </div>
                </div>
              </section>

              {/* =================================================
                  TENANT SERVICES
              ================================================== */}

              <section className="mt-12">
                <SectionHeading
                  eyebrow="TENANT SERVICES"
                  title="Everything you need in one workspace"
                  description="Search, manage, protect and build trusted rental relationships through TNP."
                />

                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {modules.map((module) => (
                    <ModuleCard key={module.title} module={module} />
                  ))}
                </div>
              </section>

              {/* =================================================
                  APPLICATIONS + SAFETY
              ================================================== */}

              <section className="mt-12 grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
                {/* APPLICATIONS */}

                <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.045] p-5 shadow-xl backdrop-blur-xl sm:p-6">
                  <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-[#d9ad68]/10 blur-3xl" />

                  <div className="relative flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#d9ad68]">
                        ACTIVITY
                      </p>

                      <h2 className="mt-1 text-lg font-bold text-white">Recent applications</h2>
                    </div>

                    <Link
                      to="/app/tenant/applications"
                      className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/50 transition hover:bg-white/[0.1] hover:text-white"
                    >
                      <ChevronRight className="size-4" />
                    </Link>
                  </div>

                  <div className="relative mt-5 space-y-2">
                    {applicationsQuery.isLoading ? (
                      <div className="flex items-center justify-center py-10">
                        <div className="size-5 animate-spin rounded-full border-2 border-white/10 border-t-[#d9ad68]" />
                      </div>
                    ) : applicationsQuery.isError ? (
                      <ErrorState
                        title="Unable to load applications"
                        description="Please try again later."
                      />
                    ) : (applicationsQuery.data ?? []).length === 0 ? (
                      <EmptyState
                        icon={FileText}
                        title="No applications yet"
                        description="Your property applications will appear here once you apply for a property."
                        action={
                          <Link
                            to="/app/tenant/properties"
                            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#d1a25e] px-4 py-2.5 text-xs font-bold text-black transition hover:bg-[#e0b875]"
                          >
                            Find a property
                            <ArrowRight className="size-3.5" />
                          </Link>
                        }
                      />
                    ) : (
                      applicationsQuery.data?.map((application: LeaseRequest) => (
                        <div
                          key={application.id}
                          className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-black/20 p-4 backdrop-blur-md transition hover:bg-white/[0.05]"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#d9ad68]/15 bg-[#d9ad68]/10">
                              <FileText className="size-4 text-[#d9ad68]" />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">
                                Application #{String(application.id).slice(0, 8)}
                              </p>

                              <p className="mt-1 flex items-center gap-1.5 text-xs text-white/35">
                                <Clock3 className="size-3.5" />

                                {application.created_at
                                  ? new Date(application.created_at).toLocaleDateString()
                                  : "Recently submitted"}
                              </p>
                            </div>
                          </div>

                          <span className="shrink-0 rounded-full border border-[#d9ad68]/20 bg-[#d9ad68]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#d9ad68]">
                            {application.status || "Pending"}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* SAFETY */}

                <div className="relative overflow-hidden rounded-[24px] border border-red-300/15 bg-red-300/[0.045] p-6 shadow-xl backdrop-blur-xl">
                  <img
        data-dashboard-art="true"
                    src={adminCasesBg}
                    alt=""
                    className="tnp-dashboard-image absolute inset-0 h-full w-full object-cover opacity-65"
                  />

                  <div className="absolute inset-0 bg-gradient-to-br from-black/60 to-red-950/30" />

                  <div className="relative">
                    <div className="flex size-12 items-center justify-center rounded-2xl border border-red-300/15 bg-red-300/10 backdrop-blur-xl">
                      <AlertTriangle className="size-6 text-red-300" />
                    </div>

                    <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-red-300/80">
                      SAFETY CENTER
                    </p>

                    <h2 className="mt-1 text-lg font-bold text-white">Stay protected</h2>

                    <p className="mt-2 text-sm leading-6 text-white/55">
                      Never send money before verifying the property, landlord and transaction
                      details. TNP gives you tools to report suspicious activity and seek help.
                    </p>

                    <div className="mt-5 grid gap-2">
                      <Link
                        to="/app/tenant/report-scam"
                        className="flex items-center justify-between rounded-xl border border-red-300/15 bg-red-300/[0.06] px-4 py-3 text-xs font-bold text-red-100 transition hover:bg-red-300/10"
                      >
                        Report suspicious activity
                        <ArrowRight className="size-3.5" />
                      </Link>

                      <Link
                        to="/app/tenant/land-scam-check"
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                      >
                        Check a land transaction
                        <ChevronRight className="size-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              </section>

              {/* =================================================
                  TRUST FOOTER
              ================================================== */}

              <section className="mt-12 overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.035] backdrop-blur-xl">
                <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <Heart className="size-4 text-[#d9ad68]" />

                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#d9ad68]">
                        BUILT AROUND TRUST
                      </p>
                    </div>

                    <h2 className="mt-2 text-xl font-bold text-white">
                      Your rental journey should feel secure.
                    </h2>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-white/40">
                      TNP brings property discovery, landlord trust, applications, leases, payments
                      and safety tools together in one tenant workspace.
                    </p>
                  </div>

                  <Link
                    to="/app/settings"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-5 py-3 text-xs font-bold text-white/75 transition hover:bg-white/[0.1] hover:text-white"
                  >
                    Manage my profile
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </section>

              {/* =================================================
                  FOOTER
              ================================================== */}

              <footer className="mt-14 border-t border-white/[0.07] py-7">
                <div className="flex flex-col gap-3 text-xs text-white/30 sm:flex-row sm:items-center sm:justify-between">
                  <p>TNP · Mutual Trust Ledger · Secure property relationships</p>

                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/30" />
                      Platform operational
                    </span>

                    <span>© 2026 TNP</span>
                  </div>
                </div>
              </footer>
            </main>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

/* =============================================================
   METRIC CARD
============================================================= */

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  image,
}: {
  icon: ElementType;
  label: string;
  value: string;
  detail: string;
  image: string;
}) {
  return (
    <div className="tnp-dashboard-tile group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-5 shadow-xl backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.07]">
      <img
        data-dashboard-art="true"
        src={image}
        alt=""
        className="tnp-dashboard-image absolute inset-0 h-full w-full object-cover opacity-[0.58] transition duration-500 group-hover:scale-105 group-hover:opacity-[0.72]"
      />

      <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-black/60" />

      <div className="relative">
        <div className="flex items-start justify-between">
          <div className="flex size-10 items-center justify-center rounded-xl border border-[#d9ad68]/15 bg-[#d9ad68]/10 text-[#d9ad68] backdrop-blur-xl">
            <Icon className="size-5" />
          </div>

          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white/30">
            TNP
          </span>
        </div>

        <p className="mt-5 text-2xl font-bold text-white">{value}</p>

        <p className="mt-1 text-sm font-medium text-white/75">{label}</p>

        <p className="mt-1 text-xs text-white/35">{detail}</p>
      </div>
    </div>
  );
}

/* =============================================================
   SECTION HEADING
============================================================= */

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
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d9ad68]">{eyebrow}</p>

      <h2 className="mt-1.5 text-xl font-bold tracking-tight text-white sm:text-2xl">{title}</h2>

      <p className="mt-1.5 max-w-2xl text-sm leading-6 text-white/40">{description}</p>
    </div>
  );
}

/* =============================================================
   RENTAL JOURNEY CARD
============================================================= */

function JourneyCard({
  number,
  icon: Icon,
  title,
  description,
  href,
  image,
}: {
  number: string;
  icon: ElementType;
  title: string;
  description: string;
  href: string;
  image: string;
}) {
  return (
    <Link
      to={href as never}
      className="tnp-dashboard-tile group relative min-h-[170px] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-xl transition duration-300 hover:-translate-y-1 hover:border-[#d9ad68]/25"
    >
      <img
        data-dashboard-art="true"
        src={image}
        alt=""
        className="tnp-dashboard-image absolute inset-0 h-full w-full object-cover opacity-75 transition duration-500 group-hover:scale-105 group-hover:opacity-90"
      />

      <div className="absolute inset-0 bg-gradient-to-br from-black/45 via-black/30 to-black/65" />

      <div className="relative flex h-full flex-col justify-between p-5">
        <div className="flex items-start justify-between">
          <span className="text-[10px] font-bold tracking-[0.15em] text-[#d9ad68]/70">
            {number}
          </span>

          <div className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] backdrop-blur-xl">
            <Icon className="size-4 text-[#d9ad68]" />
          </div>
        </div>

        <div>
          <h3 className="text-base font-bold text-white">{title}</h3>

          <p className="mt-1 text-xs leading-5 text-white/40">{description}</p>
        </div>
      </div>
    </Link>
  );
}

/* =============================================================
   MODULE CARD
============================================================= */

function ModuleCard({ module }: { module: TenantModule }) {
  const Icon = module.icon;

  return (
    <Link
      to={module.href as never}
      className="tnp-dashboard-tile group relative min-h-[235px] overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.035] shadow-xl transition duration-300 hover:-translate-y-1 hover:border-[#d9ad68]/25 hover:shadow-2xl hover:shadow-black/40"
    >
      <img
        data-dashboard-art="true"
        src={module.image}
        alt=""
        className="tnp-dashboard-image absolute inset-0 h-full w-full object-cover opacity-75 transition duration-700 group-hover:scale-105 group-hover:opacity-90"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />

      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent" />

      <div className="relative flex h-full flex-col justify-between p-5">
        <div className="flex items-start justify-between">
          <span className="flex size-11 items-center justify-center rounded-xl border border-white/15 bg-black/25 shadow-lg backdrop-blur-xl">
            <Icon className="size-5 text-[#e2b875]" />
          </span>

          <span className="flex size-8 items-center justify-center rounded-full border border-white/10 bg-black/20 backdrop-blur-md">
            <ArrowRight className="size-3.5 text-white/35 transition duration-300 group-hover:translate-x-0.5 group-hover:text-[#d9ad68]" />
          </span>
        </div>

        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#e2b875]">
            {module.eyebrow}
          </p>

          <h3 className="mt-1.5 text-lg font-bold text-white">{module.title}</h3>

          <p className="mt-2 max-w-sm text-xs leading-5 text-white/55">{module.description}</p>
        </div>
      </div>
    </Link>
  );
}

/* =============================================================
   PROPERTY CARD
============================================================= */

function PropertyCard({ property }: { property: PropertyCardData }) {
  return (
    <div className="group overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.04] shadow-xl backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/15 hover:shadow-2xl">
      <div className="relative h-52 overflow-hidden bg-[#121313]">
        {property.image_url ? (
          <img
        data-dashboard-art="true"
            src={property.image_url}
            alt={property.title || "Property"}
            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          />
        ) : (
          <img
        data-dashboard-art="true"
            src={adminPropertiesBg}
            alt=""
            className="h-full w-full object-cover opacity-65 transition duration-700 group-hover:scale-105 group-hover:opacity-80"
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />

        <div className="absolute left-3 top-3 flex items-center gap-2">
          <span className="rounded-full border border-emerald-300/25 bg-emerald-300/15 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-emerald-200 backdrop-blur-xl">
            Available
          </span>

          <span className="rounded-full border border-white/15 bg-black/30 px-2.5 py-1.5 text-[9px] font-semibold text-white/75 backdrop-blur-xl">
            Verified
          </span>
        </div>

        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-lg font-bold text-white">
            {property.price ? `$${Number(property.price).toLocaleString()}` : "Contact landlord"}
          </p>

          {property.location || property.address ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-white/60">
              <MapPin className="size-3.5" />
              {property.location || property.address}
            </p>
          ) : null}
        </div>
      </div>

      <div className="p-4">
        <h3 className="truncate text-sm font-bold text-white">
          {property.title || property.name || "Property listing"}
        </h3>

        <div className="mt-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-white/35">
            <ShieldCheck className="size-3.5 text-emerald-300/70" />
            TNP listing
          </span>

          <Link
            to={`/app/property/${property.id}` as never}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-bold text-white/60 transition hover:bg-white/[0.08] hover:text-white"
          >
            View property
            <ChevronRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

/* =============================================================
   EMPTY STATE
============================================================= */

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: ElementType;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mt-5 flex flex-col items-center justify-center rounded-[22px] border border-dashed border-white/10 bg-white/[0.025] px-6 py-12 text-center backdrop-blur-xl">
      <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
        <Icon className="size-5 text-white/30" />
      </div>

      <p className="mt-4 text-sm font-semibold text-white/75">{title}</p>

      <p className="mt-1 max-w-sm text-xs leading-5 text-white/35">{description}</p>

      {action}
    </div>
  );
}

/* =============================================================
   ERROR STATE
============================================================= */

function ErrorState({ title, description }: { title: string; description: string }) {
  return (
    <div className="mt-5 rounded-[20px] border border-red-400/10 bg-red-400/[0.035] px-6 py-9 text-center backdrop-blur-xl">
      <AlertTriangle className="mx-auto size-5 text-red-300/70" />

      <p className="mt-3 text-sm font-semibold text-white/70">{title}</p>

      <p className="mt-1 text-xs text-white/30">{description}</p>
    </div>
  );
}

/* =============================================================
   PROPERTY LOADING GRID
============================================================= */

function PropertyLoadingGrid() {
  return (
    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-[330px] animate-pulse rounded-[22px] border border-white/[0.07] bg-white/[0.035]"
        />
      ))}
    </div>
  );
}
