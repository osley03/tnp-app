import { applicationStatus } from '@/lib/application-status';
import { useSession as useSession } from '@/lib/session';
import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileSearch,
  Gavel,
  LayoutDashboard,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

import { RoleSidebar } from "@/components/dashboard/RoleSidebar";
import { supabase } from "@/integrations/supabase/client";

import adminHeroBg from "@/assets/admin-hero-bg.png";
import propertiesBg from "@/assets/admin-properties-bg.png";
import leasesBg from "@/assets/admin-leases-bg.png";
import paymentsBg from "@/assets/admin-payments-bg.png";
import reviewsBg from "@/assets/admin-reviews-bg.png";
import disputesBg from "@/assets/admin-disputes-bg.png";
import profilesBg from "@/assets/admin-profiles-bg.png";
import casesBg from "@/assets/admin-cases-bg.png";

type DashboardRow = Record<string, unknown> & {
  id?: string;
  property_id?: string | null;
  property?: {
    title?: string | null;
    name?: string | null;
  } | null;
  title?: string | null;
  name?: string | null;
  status?: string | null;
  amount_usd?: number | string | null;
  rating?: number | string | null;
  created_at?: string | null;
};

const db = supabase;

export const Route = createFileRoute("/_authenticated/app/landlord")({
  component: LandlordDashboard,
});

/* ========================================================================== */
/* AUTH                                                                      */
/* ========================================================================== */



/* ========================================================================== */
/* DASHBOARD                                                                 */
/* ========================================================================== */

function LandlordDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, loading } = useSession();

  /* ------------------------------------------------------------------------ */
  /* ROLE GUARD                                                              */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!loading && role && role !== "landlord") {
      navigate({
        to: `/app/${role}` as never,
      });
    }
  }, [loading, role, navigate]);

  /* ------------------------------------------------------------------------ */
  /* PROFILE                                                                 */
  /* ------------------------------------------------------------------------ */

  const profileQuery = useQuery({
    queryKey: ["landlord-dashboard-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await db
        .from("profiles")
        .select("id, full_name, verification, trust_score")
        .eq("id", user!.id)
        .maybeSingle();

      if (error) throw error;

      return data;
    },
  });

  /* ------------------------------------------------------------------------ */
  /* PROPERTIES                                                              */
  /* ------------------------------------------------------------------------ */

  const propertiesQuery = useQuery({
    queryKey: ["landlord-dashboard-properties", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await db
        .from("properties")
        .select("*")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data ?? [];
    },
  });

  /* ------------------------------------------------------------------------ */
  /* LEASE REQUESTS                                                          */
  /* ------------------------------------------------------------------------ */

  const leaseRequestsQuery = useQuery({
    queryKey: ["landlord-dashboard-lease-requests", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: ownedProperties, error: propertiesError } = await db
        .from("properties")
        .select("id, title")
        .eq("owner_id", user!.id);

      if (propertiesError) throw propertiesError;

      const propertyIds = (ownedProperties ?? [])
        .map((property: DashboardRow) => property.id)
        .filter((id): id is string => typeof id === "string");

      if (propertyIds.length === 0) {
        return [];
      }

      const propertyMap = new Map(
        (ownedProperties ?? []).map((property: DashboardRow) => [property.id, property]),
      );

      const { data, error } = await db
        .from("lease_requests")
        .select("*")
        .in("property_id", propertyIds)
        .order("created_at", { ascending: false })
        .limit(8);

      if (error) throw error;

      return (data ?? []).map((request: DashboardRow) => ({
        ...request,
        property: propertyMap.get(request.property_id ?? undefined) ?? null,
      }));
    },
  });

  /* ------------------------------------------------------------------------ */
  /* LEASES                                                                  */
  /* ------------------------------------------------------------------------ */

  const leasesQuery = useQuery({
    queryKey: ["landlord-dashboard-leases", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: ownedProperties, error: propertiesError } = await db
        .from("properties")
        .select("id")
        .eq("owner_id", user!.id);

      if (propertiesError) throw propertiesError;

      const propertyIds = (ownedProperties ?? [])
        .map((property: DashboardRow) => property.id)
        .filter((id): id is string => id !== undefined);

      if (propertyIds.length === 0) {
        return [];
      }

      const { data, error } = await db
        // The generated Supabase schema does not currently include the leases table.
        .from("leases" as never)
        .select("*")
        .in("property_id", propertyIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data ?? [];
    },
  });

  /* ------------------------------------------------------------------------ */
  /* PAYMENTS                                                                */
  /* ------------------------------------------------------------------------ */

  const paymentsQuery = useQuery({
    queryKey: ["landlord-dashboard-payments", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: ownedProperties, error: propertiesError } = await db
        .from("properties")
        .select("id")
        .eq("owner_id", user!.id);

      if (propertiesError) throw propertiesError;

      const propertyIds = (ownedProperties ?? [])
        .map((property: DashboardRow) => property.id)
        .filter((id): id is string => id !== undefined);

      if (propertyIds.length === 0) {
        return [];
      }

      const { data: leases, error: leasesError } = await db
        .from("leases" as never)
        .select("id")
        .in("property_id", propertyIds);

      if (leasesError) throw leasesError;

      const leaseIds = (leases ?? []).map((lease: DashboardRow) => lease.id);

      if (leaseIds.length === 0) {
        return [];
      }

      const { data, error } = await db
        .from("lease_payments" as never)
        .select("*")
        .in("lease_id", leaseIds)
        .order("created_at", { ascending: false })
        .limit(8);

      if (error) throw error;

      return data ?? [];
    },
  });

  /* ------------------------------------------------------------------------ */
  /* DISPUTES                                                                */
  /* ------------------------------------------------------------------------ */

  const disputesQuery = useQuery({
    queryKey: ["landlord-dashboard-disputes", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: ownedProperties, error: propertiesError } = await db
        .from("properties")
        .select("id")
        .eq("owner_id", user!.id);

      if (propertiesError) throw propertiesError;

      const propertyIds = (ownedProperties ?? [])
        .map((property: DashboardRow) => property.id)
        .filter((id): id is string => id !== undefined);

      if (propertyIds.length === 0) {
        return [];
      }

      const { data, error } = await db
        // The generated Supabase schema does not currently include the disputes table.
        .from("disputes" as never)
        .select("*")
        .in("property_id", propertyIds)
        .order("created_at", { ascending: false })
        .limit(8);

      if (error) throw error;

      return data ?? [];
    },
  });

  /* ------------------------------------------------------------------------ */
  /* REVIEWS                                                                 */
  /* ------------------------------------------------------------------------ */

  const reviewsQuery = useQuery({
    queryKey: ["landlord-dashboard-reviews", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: ownedProperties, error: propertiesError } = await db
        .from("properties")
        .select("id")
        .eq("owner_id", user!.id);

      if (propertiesError) throw propertiesError;

      const propertyIds = (ownedProperties ?? [])
        .map((property: DashboardRow) => property.id)
        .filter((id): id is string => id !== undefined);

      if (propertyIds.length === 0) {
        return [];
      }

      const { data, error } = await db
        .from("reviews")
        .select("*")
        .in("property_id", propertyIds)
        .order("created_at", { ascending: false })
        .limit(8);

      if (error) throw error;

      return data ?? [];
    },
  });

  /* ------------------------------------------------------------------------ */
  /* DERIVED DATA                                                            */
  /* ------------------------------------------------------------------------ */

  const properties = propertiesQuery.data ?? [];
  const leaseRequests = leaseRequestsQuery.data ?? [];
  const leases = leasesQuery.data ?? [];
  const payments = paymentsQuery.data ?? [];
  const disputes = disputesQuery.data ?? [];
  const reviews = reviewsQuery.data ?? [];

  const fullName = profileQuery.data?.full_name || user?.email?.split("@")[0] || "Landlord";

  const firstName = fullName.trim().split(/\s+/)[0] || "Landlord";

  const activeLeases = useMemo(
    () =>
      leases.filter((lease: DashboardRow) =>
        ["active", "pending_approval"].includes(String(lease.status ?? "").toLowerCase()),
      ),
    [leases],
  );

  const openDisputes = useMemo(
    () =>
      disputes.filter((dispute: DashboardRow) =>
        ["open", "under_review", "awaiting_response", "escalated"].includes(
          String(dispute.status ?? "").toLowerCase(),
        ),
      ),
    [disputes],
  );

  const pendingRequests = useMemo(
    () =>
      leaseRequests.filter((request: DashboardRow) =>
        applicationStatus(request.status) === "Pending review",
      ),
    [leaseRequests],
  );

  const receivedPayments = useMemo(
    () =>
      payments.filter(
        (payment: DashboardRow) => ["paid", "released"].includes(String(payment.status ?? "").toLowerCase()),
      ),
    [payments],
  );

  const totalReceivedAmount = useMemo(
    () =>
      receivedPayments.reduce(
        (sum: number, payment: DashboardRow) => sum + Number(payment.amount_usd ?? 0),
        0,
      ),
    [receivedPayments],
  );

  const averageRating = useMemo(() => {
    const ratings = reviews
      .map((review: DashboardRow) => Number(review.rating))
      .filter((rating: number) => Number.isFinite(rating) && rating > 0);

    if (ratings.length === 0) return null;

    return ratings.reduce((sum: number, rating: number) => sum + rating, 0) / ratings.length;
  }, [reviews]);

  const isLoading =
    loading ||
    profileQuery.isLoading ||
    propertiesQuery.isLoading ||
    leaseRequestsQuery.isLoading ||
    leasesQuery.isLoading ||
    paymentsQuery.isLoading ||
    disputesQuery.isLoading ||
    reviewsQuery.isLoading;

  const hasError =
    profileQuery.error ||
    propertiesQuery.error ||
    leaseRequestsQuery.error ||
    leasesQuery.error ||
    paymentsQuery.error ||
    disputesQuery.error ||
    reviewsQuery.error;

  if (isLoading) {
    return <LandlordLoading />;
  }

  if (role && role !== "landlord") {
    return null;
  }

  if (location.pathname !== "/app/landlord") {
    return <Outlet />;
  }

  return (
    <SidebarProvider>
      <RoleSidebar
        role="landlord"
        userName={fullName}
        {...(user?.email ? { userEmail: user.email } : {})}
      />

      <SidebarInset className="min-w-0 bg-[#080909] text-white">
        <div className="tnp-module tnp-module-dark min-h-screen w-full bg-[#080909]">
          {/* ================================================================ */}
          {/* TOP BAR                                                          */}
          {/* ================================================================ */}

          <header className="sticky top-0 z-30 flex h-16 items-center border-b border-white/[0.07] bg-[#080909]/95 px-4 backdrop-blur-xl sm:px-6">
            <SidebarTrigger className="mr-4 text-white hover:bg-white/10 hover:text-[#d6a84f]" />

            <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium uppercase tracking-[0.18em] text-white/35">
                  TNP Landlord Portal
                </p>

                <p className="truncate text-sm font-semibold text-white">Property Management</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-1.5 sm:flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span className="text-xs font-medium text-emerald-300">Account Active</span>
                </div>

                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d6a84f]/30 bg-[#d6a84f]/10 text-sm font-bold text-[#d6a84f]">
                  {getInitials(fullName)}
                </div>
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {/* ============================================================ */}
            {/* DATA WARNING                                                   */}
            {/* ============================================================ */}

            {hasError && (
              <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />

                <div>
                  <p className="text-sm font-semibold text-amber-200">
                    Some dashboard information could not be loaded
                  </p>

                  <p className="mt-1 text-xs leading-5 text-amber-100/50">
                    Your account and available data remain accessible. Refresh the page or open the
                    relevant module to retry the affected information.
                  </p>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* HERO                                                           */}
            {/* ============================================================ */}

            <section
              className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#101111]"
              style={{
                backgroundImage: `linear-gradient(90deg, rgba(7,18,35,0.70) 0%, rgba(7,18,35,0.42) 48%, rgba(7,18,35,0.14) 100%), url(${adminHeroBg})`,
                backgroundPosition: "center",
                backgroundSize: "cover",
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#080909] via-transparent to-transparent" />

              <div className="relative px-6 py-10 sm:px-8 lg:px-10 lg:py-12">
                <div className="max-w-3xl">
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d6a84f]/20 bg-[#d6a84f]/10 px-3 py-1.5">
                    <Building2 className="h-3.5 w-3.5 text-[#d6a84f]" />

                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e4c27b]">
                      Landlord Workspace
                    </span>
                  </div>

                  <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                    Welcome back, {firstName}.
                  </h1>

                  <p className="mt-4 max-w-2xl text-sm leading-7 text-white/55 sm:text-base">
                    Manage your properties, review prospective tenants, monitor lease requests,
                    track recorded payments, and maintain trusted rental relationships through TNP.
                  </p>

                  <div className="mt-7 flex flex-wrap gap-3">
                    <DashboardButton
                      onClick={() =>
                        navigate({
                          to: "/app/landlord/properties" as never,
                        })
                      }
                      icon={Building2}
                    >
                      Manage Properties
                    </DashboardButton>

                    <DashboardButton
                      secondary
                      onClick={() =>
                        navigate({
                          to: "/app/landlord/requests" as never,
                        })
                      }
                      icon={FileSearch}
                    >
                      Lease Requests
                    </DashboardButton>
                  </div>
                </div>
              </div>
            </section>

            {/* ============================================================ */}
            {/* OVERVIEW                                                       */}
            {/* ============================================================ */}

            <div className="mt-8">
              <SectionHeading
                eyebrow="Portfolio Overview"
                title="Your rental network at a glance"
                description="Monitor the important activity across your properties and tenant relationships."
              />

              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  icon={Building2}
                  label="My Properties"
                  value={properties.length}
                  description="Properties under management"
                  accent="gold"
                  onClick={() =>
                    navigate({
                      to: "/app/landlord/properties" as never,
                    })
                  }
                />

                <MetricCard
                  icon={Clock3}
                  label="Lease Requests"
                  value={pendingRequests.length}
                  description="Requests requiring attention"
                  accent="blue"
                  onClick={() =>
                    navigate({
                      to: "/app/landlord/requests" as never,
                    })
                  }
                />

                <MetricCard
                  icon={Wallet}
                  label="Payments"
                  value={payments.length}
                  description="Payment requests and receipts"
                  accent="green"
                  onClick={() =>
                    navigate({
                      to: "/app/landlord/payments" as never,
                    })
                  }
                />

                <MetricCard
                  icon={Gavel}
                  label="Disputes"
                  value={openDisputes.length}
                  description="Open issues requiring attention"
                  accent="purple"
                  onClick={() =>
                    navigate({
                      to: "/app/landlord/disputes" as never,
                    })
                  }
                />
              </div>
            </div>

            {/* ============================================================ */}
            {/* MANAGEMENT MODULES                                             */}
            {/* ============================================================ */}

            <div className="mt-10">
              <SectionHeading
                eyebrow="Landlord Management"
                title="Manage your rental operations"
                description="Everything you need to manage properties and build trusted tenant relationships."
              />

              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <LandlordModuleCard
                  title="My Properties"
                  description="Create, manage, update, and monitor your property listings."
                  icon={Building2}
                  image={propertiesBg}
                  href="/app/landlord/properties"
                  badge={`${properties.length} ${
                    properties.length === 1 ? "property" : "properties"
                  }`}
                  navigate={navigate}
                  featured
                />

                <LandlordModuleCard
                  title="Lease Requests"
                  description="Review incoming tenant applications and manage lease requests."
                  icon={FileSearch}
                  image={leasesBg}
                  href="/app/landlord/requests"
                  badge={`${pendingRequests.length} pending`}
                  navigate={navigate}
                />

                <LandlordModuleCard
                  title="Applicants"
                  description="Review prospective tenants and examine their available trust information."
                  icon={Users}
                  image={profilesBg}
                  href="/app/landlord/applicants"
                  badge="Applicants"
                  navigate={navigate}
                />

                <LandlordModuleCard
                  title="Trust Profiles"
                  description="Review tenant references, verification information, and trust indicators."
                  icon={ShieldCheck}
                  image={profilesBg}
                  href="/app/landlord/trust-profiles"
                  badge="Trust"
                  navigate={navigate}
                />

                <LandlordModuleCard
                  title="Payments received"
                  description="View tenant payments, rent months, due dates and dated receipts for your properties."
                  icon={Wallet}
                  image={paymentsBg}
                  href="/app/landlord/payments"
                  badge={`${payments.length} records`}
                  navigate={navigate}
                />

                <LandlordModuleCard
                  title="Reviews"
                  description="Monitor tenant feedback and maintain transparent rental relationships."
                  icon={MessageSquare}
                  image={reviewsBg}
                  href="/app/landlord/reviews"
                  badge={averageRating ? `${averageRating.toFixed(1)} / 5` : "Feedback"}
                  navigate={navigate}
                />

                <LandlordModuleCard
                  title="Disputes"
                  description="Review reported issues and follow disputes through the resolution process."
                  icon={Gavel}
                  image={disputesBg}
                  href="/app/landlord/disputes"
                  badge={`${openDisputes.length} open`}
                  navigate={navigate}
                />

                <LandlordModuleCard
                  title="Listing Integrity"
                  description="Review listing-integrity indicators and help maintain reliable property information."
                  icon={ShieldAlert}
                  image={casesBg}
                  href="/app/landlord/integrity"
                  badge="Protection"
                  navigate={navigate}
                />

                <InsightCard
                  activeLeases={activeLeases.length}
                  receivedPayments={receivedPayments.length}
                  receivedAmount={totalReceivedAmount}
                  onClick={() =>
                    navigate({
                      to: "/app/landlord/properties" as never,
                    })
                  }
                />
              </div>
            </div>

            {/* ============================================================ */}
            {/* PROPERTY SNAPSHOT                                              */}
            {/* ============================================================ */}

            <div className="mt-10">
              <SectionHeading
                eyebrow="Portfolio"
                title="Recent properties"
                description="A quick view of the latest properties connected to your landlord account."
              />

              {properties.length > 0 ? (
                <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {properties.slice(0, 3).map((property: DashboardRow) => (
                    <PropertyCard
                      key={property.id}
                      property={property}
                      onClick={() =>
                        navigate({
                          to: `/app/property/${property.id}` as never,
                        })
                      }
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Building2}
                  title="No properties yet"
                  description="You have not added a property to your landlord portfolio yet."
                  action="Add a Property"
                  onClick={() =>
                    navigate({
                      to: "/app/landlord/properties" as never,
                    })
                  }
                />
              )}

              {properties.length > 3 && (
                <button
                  onClick={() =>
                    navigate({
                      to: "/app/landlord/properties" as never,
                    })
                  }
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#d6a84f] hover:text-[#e5c67f]"
                >
                  View all properties
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* ============================================================ */}
            {/* LEASE REQUESTS                                                 */}
            {/* ============================================================ */}

            <div className="mt-10">
              <div className="flex items-end justify-between gap-4">
                <SectionHeading
                  eyebrow="Tenant Activity"
                  title="Recent lease requests"
                  description="Keep track of the latest requests from prospective tenants."
                />

                <button
                  onClick={() =>
                    navigate({
                      to: "/app/landlord/requests" as never,
                    })
                  }
                  className="hidden items-center gap-1.5 text-xs font-semibold text-[#d6a84f] sm:flex"
                >
                  View all
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {leaseRequests.length > 0 ? (
                <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025]">
                  {leaseRequests.slice(0, 5).map((request: DashboardRow, index: number) => (
                    <button
                      key={request.id}
                      onClick={() =>
                        navigate({
                          to: "/app/landlord/requests" as never,
                        })
                      }
                      className={`flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-white/[0.04] ${
                        index !== 0 ? "border-t border-white/[0.06]" : ""
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#d6a84f]/10 text-[#d6a84f]">
                        <FileSearch className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">
                          {request["property"]?.title ||
                            request["property"]?.name ||
                            "Property request"}
                        </p>

                        <p className="mt-1 truncate text-xs text-white/35">
                          {request.status
                            ? `Status: ${formatStatus(request.status)}`
                            : "Request submitted"}
                        </p>
                      </div>

                      <div className="hidden text-xs text-white/25 sm:block">
                        {formatDate(request.created_at)}
                      </div>

                      <ChevronRight className="h-4 w-4 shrink-0 text-white/20" />
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={FileSearch}
                  title="No lease requests"
                  description="New tenant requests will appear here when they are submitted."
                  action="View Requests"
                  onClick={() =>
                    navigate({
                      to: "/app/landlord/requests" as never,
                    })
                  }
                />
              )}
            </div>

            {/* ============================================================ */}
            {/* TRUST & OPERATIONS                                             */}
            {/* ============================================================ */}

            <div className="mt-10">
              <SectionHeading
                eyebrow="Trust & Operations"
                title="Keep your rental network protected"
                description="Review tenant trust, recorded payments, and listing integrity from one workspace."
              />

              <div className="mt-5 grid gap-5 lg:grid-cols-3">
                <OperationalCard
                  icon={ShieldCheck}
                  title="Tenant Trust"
                  description="Review applicant trust information and references before entering rental agreements."
                  action="View Trust Profiles"
                  onClick={() =>
                    navigate({
                      to: "/app/landlord/trust-profiles" as never,
                    })
                  }
                />

                <OperationalCard
                  icon={Wallet}
                  title="Rent & deposit payments"
                  description={
                    receivedPayments.length > 0
                      ? `${receivedPayments.length} payment${
                          receivedPayments.length === 1 ? "" : "s"
                        } recorded as paid${
                          totalReceivedAmount > 0 ? ` · $${totalReceivedAmount.toLocaleString()}` : ""
                        }.`
                      : "Review incoming tenant payments and requests awaiting payment."
                  }
                  action="View payments received"
                  onClick={() =>
                    navigate({
                      to: "/app/landlord/payments" as never,
                    })
                  }
                />

                <OperationalCard
                  icon={ShieldAlert}
                  title="Listing Integrity"
                  description="Monitor listing-integrity indicators and address issues that could affect tenant trust."
                  action="Check Listings"
                  onClick={() =>
                    navigate({
                      to: "/app/landlord/integrity" as never,
                    })
                  }
                />
              </div>
            </div>

            {/* ============================================================ */}
            {/* QUICK ACTIONS                                                  */}
            {/* ============================================================ */}

            <section className="mt-10 rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d6a84f]">
                    Quick Actions
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-white">Manage your rental business</h2>

                  <p className="mt-1 text-sm text-white/40">
                    Jump directly into your most-used landlord tools.
                  </p>
                </div>

                <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-3">
                  <QuickAction
                    icon={Building2}
                    label="Properties"
                    onClick={() =>
                      navigate({
                        to: "/app/landlord/properties" as never,
                      })
                    }
                  />

                  <QuickAction
                    icon={Users}
                    label="Applicants"
                    onClick={() =>
                      navigate({
                        to: "/app/landlord/applicants" as never,
                      })
                    }
                  />

                  <QuickAction
                    icon={Wallet}
                    label="Payments"
                    onClick={() =>
                      navigate({
                        to: "/app/landlord/payments" as never,
                      })
                    }
                  />
                </div>
              </div>
            </section>

            {/* ============================================================ */}
            {/* FOOTER                                                        */}
            {/* ============================================================ */}

            <footer className="mt-10 border-t border-white/[0.06] py-6">
              <div className="flex flex-col gap-2 text-xs text-white/25 sm:flex-row sm:items-center sm:justify-between">
                <p>TNP · Mutual Trust Ledger · Harare</p>

                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Landlord account operational</span>
                </div>
              </div>
            </footer>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

/* ========================================================================== */
/* DASHBOARD BUTTON                                                           */
/* ========================================================================== */

function DashboardButton({
  children,
  icon: Icon,
  onClick,
  secondary = false,
}: {
  children: React.ReactNode;
  icon: typeof Building2;
  onClick: () => void;
  secondary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={
        secondary
          ? "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.09]"
          : "inline-flex items-center gap-2 rounded-xl bg-[#d6a84f] px-4 py-2.5 text-sm font-bold text-[#111] transition hover:bg-[#e1b963]"
      }
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

/* ========================================================================== */
/* SECTION HEADING                                                            */
/* ========================================================================== */

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
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d6a84f]">{eyebrow}</p>

      <h2 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h2>

      <p className="mt-2 max-w-2xl text-sm leading-6 text-white/40">{description}</p>
    </div>
  );
}

/* ========================================================================== */
/* METRIC CARD                                                                */
/* ========================================================================== */

function MetricCard({
  icon: Icon,
  label,
  value,
  description,
  accent,
  onClick,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
  description: string;
  accent: "gold" | "blue" | "green" | "purple";
  onClick: () => void;
}) {
  const accentClasses = {
    gold: "bg-[#d6a84f]/10 text-[#d6a84f] border-[#d6a84f]/15",
    blue: "bg-blue-400/10 text-blue-300 border-blue-400/15",
    green: "bg-emerald-400/10 text-emerald-300 border-emerald-400/15",
    purple: "bg-violet-400/10 text-violet-300 border-violet-400/15",
  };

  return (
    <button
      onClick={onClick}
      className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-white/[0.14] hover:bg-white/[0.045]"
    >
      <div className="flex items-start justify-between">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl border ${accentClasses[accent]}`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <ArrowRight className="h-4 w-4 text-white/20 transition group-hover:translate-x-1 group-hover:text-[#d6a84f]" />
      </div>

      <p className="mt-5 text-3xl font-bold tracking-tight text-white">{value.toLocaleString()}</p>

      <p className="mt-1 text-sm font-semibold text-white/75">{label}</p>

      <p className="mt-1 text-xs text-white/35">{description}</p>
    </button>
  );
}

/* ========================================================================== */
/* LANDLORD MODULE CARD                                                       */
/* ========================================================================== */

function LandlordModuleCard({
  title,
  description,
  icon: Icon,
  image,
  href,
  badge,
  navigate,
  featured = false,
}: {
  title: string;
  description: string;
  icon: typeof Building2;
  image: string;
  href: string;
  badge: string;
  navigate: ReturnType<typeof useNavigate>;
  featured?: boolean;
}) {
  return (
    <button
      onClick={() => navigate({ to: href as never })}
      className={`group relative min-h-[245px] overflow-hidden rounded-3xl border text-left transition duration-300 hover:-translate-y-1 ${
        featured ? "border-[#d6a84f]/25" : "border-white/[0.08]"
      }`}
    >
      <img
        data-dashboard-art="true"
        src={image}
        alt=""
        className="tnp-dashboard-image absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-[#080909] via-[#080909]/75 to-[#080909]/20" />

      <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-black/50" />

      <div className="relative flex h-full min-h-[245px] flex-col justify-between p-5 sm:p-6">
        <div className="flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/35 backdrop-blur-md">
            <Icon className="h-5 w-5 text-[#e1bd70]" />
          </div>

          <span className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55 backdrop-blur-md">
            {badge}
          </span>
        </div>

        <div>
          {featured && (
            <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-[#d6a84f] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#111]">
              <Building2 className="h-3 w-3" />
              Portfolio
            </div>
          )}

          <h3 className="text-xl font-bold text-white">{title}</h3>

          <p className="mt-2 max-w-md text-sm leading-6 text-white/55">{description}</p>

          <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#d6a84f]">
            Open module
            <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </button>
  );
}

/* ========================================================================== */
/* INSIGHT CARD                                                               */
/* ========================================================================== */

function InsightCard({
  activeLeases,
  receivedPayments,
  receivedAmount,
  onClick,
}: {
  activeLeases: number;
  receivedPayments: number;
  receivedAmount: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="tnp-dashboard-tile group relative min-h-[245px] overflow-hidden rounded-3xl border border-[#d6a84f]/15 bg-gradient-to-br from-[#15130e] via-[#0e0f0f] to-[#080909] p-5 text-left transition duration-300 hover:-translate-y-1 sm:p-6"
    >
      <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[#d6a84f]/10 blur-3xl" />

      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#d6a84f]/20 bg-[#d6a84f]/10">
            <Sparkles className="h-5 w-5 text-[#e1bd70]" />
          </div>

          <span className="rounded-full border border-[#d6a84f]/15 bg-[#d6a84f]/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#d6a84f]">
            Insights
          </span>
        </div>

        <div>
          <h3 className="text-xl font-bold text-white">Portfolio Insights</h3>

          <p className="mt-2 text-sm leading-6 text-white/45">
            A quick operational view of your current rental activity.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <InsightStat label="Active leases" value={activeLeases} />
            <InsightStat label="Paid records" value={receivedPayments} />
          </div>

          {receivedAmount > 0 && (
            <p className="mt-4 text-xs text-white/35">
              Recorded paid total:{" "}
              <span className="font-semibold text-[#d6a84f]">${receivedAmount.toLocaleString()}</span>
            </p>
          )}

          <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#d6a84f]">
            Review portfolio
            <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </button>
  );
}

function InsightStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-white/30">{label}</p>
    </div>
  );
}

/* ========================================================================== */
/* PROPERTY CARD                                                              */
/* ========================================================================== */

type PropertyCardData = {
  id?: string;
  image_url?: string | null;
  title?: string | null;
  name?: string | null;
  location?: string | null;
  address?: string | null;
  price?: number | string | null;
  rent?: number | string | null;
  status?: string | null;
};

function PropertyCard({ property, onClick }: { property: PropertyCardData; onClick: () => void }) {
  const image =
    property.image_url ||
    "https://images.unsplash.com/photo-1560185008-b033106af5c3?auto=format&fit=crop&w=900&q=80";

  const title = property.title || property.name || "Property";

  const location = property.location || property.address || "Location unavailable";

  const propertyPrice = property.price ?? property.rent;

  const price =
    propertyPrice !== null && propertyPrice !== undefined && propertyPrice !== ""
      ? `$${Number(propertyPrice).toLocaleString()}`
      : "Price unavailable";

  const status = property.status ? formatStatus(property.status) : "Active Listing";

  return (
    <button
      onClick={onClick}
      className="group overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] text-left transition duration-300 hover:-translate-y-1 hover:border-white/[0.14]"
    >
      <div className="relative h-48 overflow-hidden">
        <img
        data-dashboard-art="true"
          src={image}
          alt={title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />

        <div className="absolute bottom-3 left-3 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/70 backdrop-blur-md">
          {status}
        </div>
      </div>

      <div className="p-5">
        <h3 className="truncate text-base font-bold text-white">{title}</h3>

        <p className="mt-1 truncate text-xs text-white/35">{location}</p>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm font-bold text-[#d6a84f]">{price}</p>

          <span className="inline-flex items-center gap-1 text-xs font-semibold text-white/35">
            View
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </button>
  );
}

/* ========================================================================== */
/* OPERATIONAL CARD                                                           */
/* ========================================================================== */

function OperationalCard({
  icon: Icon,
  title,
  description,
  action,
  onClick,
}: {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#d6a84f]/15 bg-[#d6a84f]/10">
        <Icon className="h-5 w-5 text-[#d6a84f]" />
      </div>

      <h3 className="mt-5 text-lg font-bold text-white">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-white/40">{description}</p>

      <button
        onClick={onClick}
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#d6a84f] hover:text-[#e5c67f]"
      >
        {action}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ========================================================================== */
/* QUICK ACTION                                                               */
/* ========================================================================== */

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Building2;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-xs font-semibold text-white/65 transition hover:border-[#d6a84f]/20 hover:bg-[#d6a84f]/10 hover:text-[#e4c27b]"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

/* ========================================================================== */
/* EMPTY STATE                                                                */
/* ========================================================================== */

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  onClick,
}: {
  icon: typeof Building2;
  title: string;
  description: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="mt-5 rounded-3xl border border-dashed border-white/[0.1] bg-white/[0.02] px-6 py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d6a84f]/10">
        <Icon className="h-5 w-5 text-[#d6a84f]" />
      </div>

      <h3 className="mt-4 text-base font-bold text-white">{title}</h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/35">{description}</p>

      <button
        onClick={onClick}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#d6a84f] px-4 py-2.5 text-xs font-bold text-[#111]"
      >
        {action}
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ========================================================================== */
/* LOADING                                                                    */
/* ========================================================================== */

function LandlordLoading() {
  return (
    <div className="tnp-module tnp-module-dark flex min-h-screen items-center justify-center bg-[#080909] px-6 text-white">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-8 text-center">
          <div className="mx-auto flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-[#d6a84f]/10">
            <LayoutDashboard className="h-6 w-6 text-[#d6a84f]" />
          </div>

          <h2 className="mt-5 text-lg font-bold">Loading landlord workspace</h2>

          <p className="mt-2 text-sm text-white/35">
            Preparing your TNP property management dashboard...
          </p>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* HELPERS                                                                    */
/* ========================================================================== */

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);

  if (parts.length === 1) {
    return (parts[0]?.slice(0, 2) ?? "").toUpperCase();
  }

  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

function formatStatus(status: string) {
  return status.replace(/[_-]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
