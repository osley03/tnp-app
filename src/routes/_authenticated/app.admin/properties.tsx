import { matchesSearch as matchWorkspaceSearch } from "@/lib/workspace-search";
import { AdminAddProperty } from "@/components/properties/AdminAddProperty";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Flag,
  History,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Star,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/admin/properties")({
  component: AdminPropertiesPage,
});

type Property = {
  id: string;
  title: string;
  property_type: string;
  city: string;
  suburb: string;
  rent_usd: number;
  deposit_usd: number;
  baths: number;
  amenities: string[];
  available: boolean;
  verified: boolean;
  image_url: string | null;
  description: string | null;
  fraud_flags: string[];
  owner_id: string;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  bio: string | null;
  verification: string;
  trust_score: number;
};

type Review = {
  id: string;
  author_id: string;
  subject_id: string;
  property_id: string | null;
  rating: number;
  body: string;
  lease_confirmed: boolean;
  created_at: string;
};

type LeaseRequest = {
  id: string;
  tenant_id: string;
  property_id: string;
  status: string;
  message: string | null;
  move_in: string | null;
  created_at: string;
};

type PropertyHistory = {
  id: string;
  property_id: string;
  event: string;
  detail: string | null;
  entry_hash: string;
  occurred_at: string;
};

type PropertyReport = {
  id: string;
  property_id: string;
  reporter_id: string | null;
  category: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type PropertyAdminAction = {
  id: string;
  property_id: string;
  admin_id: string;
  action: string;
  reason: string | null;
  created_at: string;
};

type VerificationEvent = {
  id: string;
  property_id: string;
  admin_id: string;
  previous_status: string;
  new_status: string;
  reason: string | null;
  created_at: string;
};

type PropertiesData = {
  properties: Property[];
  profiles: Profile[];
  reviews: Review[];
  leaseRequests: LeaseRequest[];
  history: PropertyHistory[];
  reports: PropertyReport[];
  actions: PropertyAdminAction[];
  verificationEvents: VerificationEvent[];
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function shortHash(value: string) {
  if (!value) return "—";
  if (value.length <= 18) return value;
  return value.slice(0, 10) + "…" + value.slice(-6);
}

function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "green" | "amber" | "red" | "blue" | "neutral";
}) {
  const styles = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    neutral: "bg-slate-50 text-slate-700 border-slate-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

function MetricCard({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>

        <div className="rounded-xl bg-slate-100 p-3 text-slate-700">{icon}</div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-bold text-slate-950">{title}</h2>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {action}
      </div>

      <div className="p-5">{children}</div>
    </section>
  );
}

function AdminPropertiesPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [integrityFilter, setIntegrityFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const propertiesQuery = useQuery({
    queryKey: ["admin-properties-centre"],
    queryFn: async (): Promise<PropertiesData> => {
      const [
        propertiesResult,
        profilesResult,
        reviewsResult,
        leaseRequestsResult,
        historyResult,
        reportsResult,
        actionsResult,
        verificationEventsResult,
      ] = await Promise.all([
        supabase.from("properties").select("*").order("created_at", { ascending: false }),

        supabase.from("profiles").select("*"),

        supabase.from("reviews").select("*").order("created_at", { ascending: false }),

        supabase.from("lease_requests").select("*").order("created_at", { ascending: false }),

        supabase.from("property_history").select("*").order("occurred_at", { ascending: false }),

        supabase
          .from("property_reports" as never)
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("property_admin_actions" as never)
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("property_verification_events" as never)
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      const firstError =
        propertiesResult.error ||
        profilesResult.error ||
        reviewsResult.error ||
        leaseRequestsResult.error ||
        historyResult.error;

      if (firstError) {
        throw new Error(firstError.message);
      }

      return {
        properties: (propertiesResult.data ?? []) as Property[],
        profiles: (profilesResult.data ?? []) as Profile[],
        reviews: (reviewsResult.data ?? []) as Review[],
        leaseRequests: (leaseRequestsResult.data ?? []) as LeaseRequest[],
        history: (historyResult.data ?? []) as PropertyHistory[],
        reports: (reportsResult.data ?? []) as PropertyReport[],
        actions: (actionsResult.data ?? []) as PropertyAdminAction[],
        verificationEvents: (verificationEventsResult.data ?? []) as VerificationEvent[],
      };
    },
  });

  const data = propertiesQuery.data;

  const properties = data?.properties ?? [];
  const profiles = data?.profiles ?? [];
  const reviews = data?.reviews ?? [];
  const leaseRequests = data?.leaseRequests ?? [];
  const history = data?.history ?? [];
  const reports = data?.reports ?? [];
  const actions = data?.actions ?? [];
  const verificationEvents = data?.verificationEvents ?? [];

  const metrics = useMemo(() => {
    const integrityFlags = properties.filter((property) => property.fraud_flags?.length > 0).length;

    return {
      total: properties.length,
      verified: properties.filter((property) => property.verified).length,
      pending: properties.filter((property) => !property.verified).length,
      flagged: integrityFlags,
      available: properties.filter((property) => property.available).length,
    };
  }, [properties]);

  const filteredProperties = useMemo(() => {
    const query = search.trim().toLowerCase();

    return properties.filter((property) => {
      const matchesSearch = matchWorkspaceSearch(
        query,
        property.title,
        property.city,
        property.suburb,
        property.property_type,
        property.id,
      );

      const matchesVerification =
        verificationFilter === "all" ||
        (verificationFilter === "verified" && property.verified) ||
        (verificationFilter === "pending" && !property.verified);

      const matchesIntegrity =
        integrityFilter === "all" ||
        (integrityFilter === "flagged" && property.fraud_flags?.length > 0) ||
        (integrityFilter === "clear" &&
          (!property.fraud_flags || property.fraud_flags.length === 0));

      const matchesAvailability =
        availabilityFilter === "all" ||
        (availabilityFilter === "available" && property.available) ||
        (availabilityFilter === "unavailable" && !property.available);

      return matchesSearch && matchesVerification && matchesIntegrity && matchesAvailability;
    });
  }, [properties, search, verificationFilter, integrityFilter, availabilityFilter]);

  const selectedProperty =
    properties.find((property) => property.id === selectedId) ?? filteredProperties[0] ?? null;

  const owner = selectedProperty
    ? profiles.find((profile) => profile.id === selectedProperty.owner_id)
    : null;

  const selectedReviews = selectedProperty
    ? reviews.filter(
        (review) =>
          review.property_id === selectedProperty.id ||
          review.subject_id === selectedProperty.owner_id,
      )
    : [];

  const selectedLeaseRequests = selectedProperty
    ? leaseRequests.filter((request) => request.property_id === selectedProperty.id)
    : [];

  const selectedReports = selectedProperty
    ? reports.filter((report) => report.property_id === selectedProperty.id)
    : [];

  const selectedHistory = selectedProperty
    ? history.filter((entry) => entry.property_id === selectedProperty.id)
    : [];

  const selectedActions = selectedProperty
    ? actions.filter((action) => action.property_id === selectedProperty.id)
    : [];

  const selectedVerificationEvents = selectedProperty
    ? verificationEvents.filter((event) => event.property_id === selectedProperty.id)
    : [];

  const averageRating =
    selectedReviews.length > 0
      ? selectedReviews.reduce((sum, review) => sum + review.rating, 0) / selectedReviews.length
      : 0;

  async function recordAction(propertyId: string, action: string, reason: string) {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    const { error } = await supabase.from("property_admin_actions" as never).insert({
      property_id: propertyId,
      admin_id: userData.user.id,
      action,
      reason,
    } as never);

    if (error) {
      throw new Error(error.message);
    }
  }

  async function toggleVerification() {
    if (!selectedProperty) return;

    const actionKey = "verification";
    setBusyAction(actionKey);
    setNotice(null);

    try {
      const nextVerified = !selectedProperty.verified;

      const { error: updateError } = await supabase
        .from("properties")
        .update({ verified: nextVerified })
        .eq("id", selectedProperty.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      await recordAction(
        selectedProperty.id,
        nextVerified ? "verified" : "verification_removed",
        nextVerified
          ? "Property verified by TNP administrator."
          : "Property verification removed by TNP administrator.",
      );

      const { data: userData } = await supabase.auth.getUser();

      if (userData.user) {
        const { error: eventError } = await supabase
          .from("property_verification_events" as never)
          .insert({
            property_id: selectedProperty.id,
            admin_id: userData.user.id,
            previous_status: selectedProperty.verified ? "verified" : "pending",
            new_status: nextVerified ? "verified" : "pending",
            reason: nextVerified
              ? "Property verification approved."
              : "Property verification removed.",
          } as never);

        if (eventError) {
          throw new Error(eventError.message);
        }
      }

      setNotice(
        nextVerified
          ? "Property has been verified successfully."
          : "Property verification has been removed.",
      );

      await queryClient.invalidateQueries({
        queryKey: ["admin-properties-centre"],
      });
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "The verification action could not be completed.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function toggleIntegrityFlag() {
    if (!selectedProperty) return;

    const actionKey = "integrity";
    setBusyAction(actionKey);
    setNotice(null);

    try {
      const existingFlags = selectedProperty.fraud_flags ?? [];
      const hasFlag = existingFlags.length > 0;

      const nextFlags = hasFlag
        ? existingFlags.filter((flag) => flag !== "Admin review required")
        : [...existingFlags, "Admin review required"];

      const { error } = await supabase
        .from("properties")
        .update({ fraud_flags: nextFlags })
        .eq("id", selectedProperty.id);

      if (error) {
        throw new Error(error.message);
      }

      await recordAction(
        selectedProperty.id,
        hasFlag ? "integrity_flag_removed" : "integrity_flag_added",
        hasFlag
          ? "Administrative integrity flag cleared."
          : "Property requires administrative integrity review.",
      );

      setNotice(hasFlag ? "Integrity flag cleared." : "Property marked for integrity review.");

      await queryClient.invalidateQueries({
        queryKey: ["admin-properties-centre"],
      });
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "The integrity action could not be completed.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  if (propertiesQuery.isLoading) {
    return (
      <div className="tnp-module tnp-module-light min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-40 rounded-3xl bg-slate-200" />
            <div className="grid gap-4 md:grid-cols-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-32 rounded-2xl bg-slate-200" />
              ))}
            </div>
            <div className="h-96 rounded-2xl bg-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  if (propertiesQuery.isError) {
    return (
      <div className="tnp-module tnp-module-light min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-red-50 p-3 text-red-600">
              <ShieldAlert size={24} />
            </div>

            <div>
              <h1 className="text-xl font-bold text-slate-950">
                Properties administration could not load
              </h1>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                {propertiesQuery.error instanceof Error
                  ? propertiesQuery.error.message
                  : "An unexpected error occurred while loading the property registry."}
              </p>

              <button
                type="button"
                onClick={() => propertiesQuery.refetch()}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <RefreshCw size={16} />
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tnp-module tnp-module-light min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
        {/* HEADER */}
        <div className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-lg sm:px-8">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950" />

          <div className="relative">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-300">
                  <Building2 size={17} />
                  TNP TRUST & OPERATIONS CENTRE
                </div>

                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Property Administration
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  Verify listings, monitor property integrity, inspect landlord context, review
                  reports and maintain a complete administrative record for every property on TNP.
                </p>
              </div>

              <button
                type="button"
                onClick={() => propertiesQuery.refetch()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur hover:bg-white/15"
              >
                <RefreshCw size={16} />
                Refresh registry
              </button>
              <AdminAddProperty profiles={profiles} />
            </div>
          </div>
        </div>

        {/* METRICS */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard
            icon={<Building2 size={21} />}
            label="Total listings"
            value={metrics.total}
            description="Properties registered on TNP"
          />

          <MetricCard
            icon={<ShieldCheck size={21} />}
            label="Verified"
            value={metrics.verified}
            description="Listings with verified status"
          />

          <MetricCard
            icon={<Clock3 size={21} />}
            label="Pending"
            value={metrics.pending}
            description="Listings awaiting verification"
          />

          <MetricCard
            icon={<ShieldAlert size={21} />}
            label="Integrity flags"
            value={metrics.flagged}
            description="Listings requiring attention"
          />

          <MetricCard
            icon={<CheckCircle2 size={21} />}
            label="Available"
            value={metrics.available}
            description="Currently marked available"
          />
        </div>

        {/* FILTER BAR */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, city, suburb, property type or ID..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </div>

            <select
              value={verificationFilter}
              onChange={(event) => setVerificationFilter(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none"
            >
              <option value="all">All verification</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
            </select>

            <select
              value={integrityFilter}
              onChange={(event) => setIntegrityFilter(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none"
            >
              <option value="all">All integrity</option>
              <option value="flagged">Flagged</option>
              <option value="clear">Clear</option>
            </select>

            <select
              value={availabilityFilter}
              onChange={(event) => setAvailabilityFilter(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none"
            >
              <option value="all">All availability</option>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </div>
        </div>

        {notice && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
            {notice}
          </div>
        )}

        {/* MAIN CONTENT */}
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
          {/* PROPERTY REGISTRY */}
          <SectionCard
            title="Property Registry"
            description={`${filteredProperties.length} of ${properties.length} listings shown`}
            action={
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                <Search size={14} />
                Filtered registry
              </div>
            }
          >
            {filteredProperties.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
                <Building2 className="mx-auto text-slate-400" size={32} />
                <h3 className="mt-3 font-bold text-slate-900">No properties found</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Adjust your search or filters to see more listings.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredProperties.map((property) => {
                  const propertyOwner = profiles.find(
                    (profile) => profile.id === property.owner_id,
                  );

                  const flagged = property.fraud_flags?.length > 0;

                  return (
                    <button
                      type="button"
                      key={property.id}
                      onClick={() => setSelectedId(property.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selectedProperty?.id === property.id
                          ? "border-slate-950 bg-slate-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex gap-4">
                        <div className="hidden h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:block">
                          {property.image_url ? (
                            <img
                              src={property.image_url}
                              alt={property.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-slate-400">
                              <Building2 size={24} />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <h3 className="truncate font-bold text-slate-950">
                                {property.title}
                              </h3>

                              <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                                <MapPin size={13} />
                                {property.suburb}, {property.city}
                              </p>
                            </div>

                            <div className="flex shrink-0 flex-wrap gap-2">
                              {property.verified ? (
                                <StatusBadge tone="green">Verified</StatusBadge>
                              ) : (
                                <StatusBadge tone="amber">Pending</StatusBadge>
                              )}

                              {flagged && <StatusBadge tone="red">Integrity flag</StatusBadge>}
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
                            <span className="font-semibold text-slate-900">
                              {formatMoney(property.rent_usd)}/month
                            </span>

                            <span>{property.property_type}</span>

                            <span>{property.baths} bath</span>

                            <span>{property.available ? "Available" : "Unavailable"}</span>

                            <span>{propertyOwner?.full_name ?? "Unknown landlord"}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* INSPECTION PANEL */}
          <div className="space-y-6">
            {selectedProperty ? (
              <>
                <SectionCard
                  title="Property Inspection"
                  description="Administrative view of the selected listing"
                  action={
                    <Link
                      to="/app/property/$id"
                      params={{ id: selectedProperty.id }}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-900"
                    >
                      Open listing
                      <ExternalLink size={14} />
                    </Link>
                  }
                >
                  <div className="space-y-5">
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                      <div className="aspect-[16/8]">
                        {selectedProperty.image_url ? (
                          <img
                            src={selectedProperty.image_url}
                            alt={selectedProperty.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-slate-400">
                            <Building2 size={42} />
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="flex flex-wrap gap-2">
                        {selectedProperty.verified ? (
                          <StatusBadge tone="green">
                            <span className="inline-flex items-center gap-1">
                              <ShieldCheck size={13} />
                              Verified listing
                            </span>
                          </StatusBadge>
                        ) : (
                          <StatusBadge tone="amber">
                            <span className="inline-flex items-center gap-1">
                              <Clock3 size={13} />
                              Verification pending
                            </span>
                          </StatusBadge>
                        )}

                        {selectedProperty.available ? (
                          <StatusBadge tone="blue">Available</StatusBadge>
                        ) : (
                          <StatusBadge tone="neutral">Unavailable</StatusBadge>
                        )}
                      </div>

                      <h2 className="mt-3 text-2xl font-bold tracking-tight">
                        {selectedProperty.title}
                      </h2>

                      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                        <MapPin size={15} />
                        {selectedProperty.suburb}, {selectedProperty.city}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Rent
                        </p>
                        <p className="mt-1 font-bold text-slate-950">
                          {formatMoney(selectedProperty.rent_usd)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Deposit
                        </p>
                        <p className="mt-1 font-bold text-slate-950">
                          {formatMoney(selectedProperty.deposit_usd)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Type
                        </p>
                        <p className="mt-1 font-bold text-slate-950">
                          {selectedProperty.property_type}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Bathrooms
                        </p>
                        <p className="mt-1 font-bold text-slate-950">{selectedProperty.baths}</p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        disabled={busyAction !== null}
                        onClick={toggleVerification}
                        className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          selectedProperty.verified
                            ? "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                            : "bg-emerald-600 text-white hover:bg-emerald-700"
                        }`}
                      >
                        {selectedProperty.verified ? (
                          <>
                            <XCircle size={17} />
                            Remove verification
                          </>
                        ) : (
                          <>
                            <ShieldCheck size={17} />
                            Verify property
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={busyAction !== null}
                        onClick={toggleIntegrityFlag}
                        className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          selectedProperty.fraud_flags?.length > 0
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                            : "border border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
                        }`}
                      >
                        {selectedProperty.fraud_flags?.length > 0 ? (
                          <>
                            <CheckCircle2 size={17} />
                            Clear integrity flag
                          </>
                        ) : (
                          <>
                            <Flag size={17} />
                            Flag for review
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </SectionCard>

                {/* LANDLORD */}
                <SectionCard
                  title="Landlord Context"
                  description="Identity and trust information connected to this property"
                >
                  {owner ? (
                    <div className="space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                          <UserRound size={22} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-slate-950">{owner.full_name}</h3>

                            <StatusBadge
                              tone={
                                owner.verification?.toLowerCase().includes("verified")
                                  ? "green"
                                  : "amber"
                              }
                            >
                              {owner.verification || "Unverified"}
                            </StatusBadge>
                          </div>

                          <p className="mt-1 text-sm text-slate-500">
                            {owner.phone || "No phone number recorded"}
                          </p>
                        </div>

                        <Link
                          to="/app/admin/profiles"
                          className="text-sm font-semibold text-blue-700 hover:text-blue-900"
                        >
                          Profile
                        </Link>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-slate-200 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Trust score
                          </p>
                          <p className="mt-1 text-2xl font-bold">{owner.trust_score}</p>
                        </div>

                        <div className="rounded-xl border border-slate-200 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Connected reviews
                          </p>
                          <p className="mt-1 text-2xl font-bold">{selectedReviews.length}</p>
                        </div>
                      </div>

                      {owner.bio && (
                        <div className="rounded-xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Bio
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-700">{owner.bio}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
                      <UserRound className="mx-auto text-slate-400" size={28} />
                      <p className="mt-2 text-sm font-medium text-slate-600">
                        Landlord profile unavailable
                      </p>
                    </div>
                  )}
                </SectionCard>

                {/* INTEGRITY */}
                <SectionCard
                  title="Listing Integrity"
                  description="Signals that may require administrative review"
                >
                  {selectedProperty.fraud_flags?.length > 0 ? (
                    <div className="space-y-2">
                      {selectedProperty.fraud_flags.map((flag) => (
                        <div
                          key={flag}
                          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
                        >
                          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" />
                          <div>
                            <p className="font-semibold text-red-900">{flag}</p>
                            <p className="mt-1 text-xs leading-5 text-red-700">
                              This listing should remain visible to administrators for further
                              investigation.
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <ShieldCheck size={20} className="text-emerald-600" />
                      <div>
                        <p className="font-semibold text-emerald-900">No active integrity flags</p>
                        <p className="mt-1 text-xs text-emerald-700">
                          No property-level integrity signals are currently recorded.
                        </p>
                      </div>
                    </div>
                  )}
                </SectionCard>

                {/* DESCRIPTION */}
                <SectionCard
                  title="Property Information"
                  description="Listing content currently stored in TNP"
                >
                  <div className="space-y-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Description
                      </p>

                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {selectedProperty.description || "No description has been provided."}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Amenities
                      </p>

                      {selectedProperty.amenities?.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedProperty.amenities.map((amenity) => (
                            <span
                              key={amenity}
                              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
                            >
                              {amenity}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">No amenities recorded.</p>
                      )}
                    </div>
                  </div>
                </SectionCard>

                {/* REVIEWS */}
                <SectionCard
                  title="Connected Reviews"
                  description="Reviews linked to the property or its landlord"
                  action={
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                      <Star size={15} />
                      {averageRating ? averageRating.toFixed(1) : "No rating"}
                    </div>
                  }
                >
                  {selectedReviews.length ? (
                    <div className="space-y-3">
                      {selectedReviews.slice(0, 8).map((review) => (
                        <div key={review.id} className="rounded-xl border border-slate-200 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <Star size={14} className="fill-current text-amber-500" />
                                <span className="text-sm font-bold">{review.rating}/5</span>
                              </div>

                              {review.lease_confirmed && (
                                <StatusBadge tone="green">Lease confirmed</StatusBadge>
                              )}
                            </div>

                            <span className="text-xs text-slate-400">
                              {formatDate(review.created_at)}
                            </span>
                          </div>

                          <p className="mt-3 text-sm leading-6 text-slate-700">{review.body}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No connected reviews have been recorded.
                    </p>
                  )}
                </SectionCard>

                {/* LEASE ACTIVITY */}
                <SectionCard
                  title="Lease Request Activity"
                  description="Tenant applications connected to this property"
                  action={
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                      <Users size={15} />
                      {selectedLeaseRequests.length}
                    </div>
                  }
                >
                  {selectedLeaseRequests.length ? (
                    <div className="space-y-3">
                      {selectedLeaseRequests.slice(0, 8).map((request) => (
                        <div key={request.id} className="rounded-xl border border-slate-200 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <StatusBadge
                              tone={
                                request.status.toLowerCase() === "approved"
                                  ? "green"
                                  : request.status.toLowerCase() === "rejected"
                                    ? "red"
                                    : "amber"
                              }
                            >
                              {request.status}
                            </StatusBadge>

                            <span className="text-xs text-slate-400">
                              {formatDate(request.created_at)}
                            </span>
                          </div>

                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div>
                              <p className="text-xs font-semibold text-slate-500">Tenant</p>
                              <p className="mt-1 text-sm font-medium">
                                {profiles.find((profile) => profile.id === request.tenant_id)
                                  ?.full_name ?? "Unknown tenant"}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs font-semibold text-slate-500">Move-in</p>
                              <p className="mt-1 text-sm font-medium">
                                {request.move_in || "Not specified"}
                              </p>
                            </div>
                          </div>

                          {request.message && (
                            <p className="mt-3 text-sm leading-6 text-slate-600">
                              {request.message}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No lease requests have been recorded for this property.
                    </p>
                  )}
                </SectionCard>

                {/* REPORTS */}
                <SectionCard
                  title="Property Reports"
                  description="Reports submitted about this listing"
                  action={
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                      <Flag size={15} />
                      {selectedReports.length}
                    </div>
                  }
                >
                  {selectedReports.length ? (
                    <div className="space-y-3">
                      {selectedReports.map((report) => (
                        <div key={report.id} className="rounded-xl border border-slate-200 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-wrap gap-2">
                              <StatusBadge tone="red">{report.category}</StatusBadge>

                              <StatusBadge
                                tone={
                                  report.status === "resolved"
                                    ? "green"
                                    : report.status === "dismissed"
                                      ? "neutral"
                                      : "amber"
                                }
                              >
                                {report.status}
                              </StatusBadge>
                            </div>

                            <span className="text-xs text-slate-400">
                              {formatDate(report.created_at)}
                            </span>
                          </div>

                          <p className="mt-3 text-sm leading-6 text-slate-700">
                            {report.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-sm font-semibold text-emerald-900">No property reports</p>
                      <p className="mt-1 text-xs text-emerald-700">
                        No reports are currently linked to this listing.
                      </p>
                    </div>
                  )}
                </SectionCard>

                {/* HISTORY */}
                <SectionCard
                  title="Tamper-Evident Property History"
                  description="Historical events and integrity hashes recorded for the property"
                >
                  {selectedHistory.length ? (
                    <div className="space-y-4">
                      {selectedHistory.slice(0, 12).map((entry) => (
                        <div
                          key={entry.id}
                          className="relative pl-8 before:absolute before:left-2 before:top-2 before:h-full before:w-px before:bg-slate-200 last:before:hidden"
                        >
                          <div className="absolute left-0 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-950 text-white">
                            <History size={9} />
                          </div>

                          <div className="rounded-xl border border-slate-200 p-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <p className="font-semibold text-slate-900">{entry.event}</p>

                              <span className="text-xs text-slate-400">
                                {formatDate(entry.occurred_at)}
                              </span>
                            </div>

                            {entry.detail && (
                              <p className="mt-2 text-sm leading-6 text-slate-600">
                                {entry.detail}
                              </p>
                            )}

                            <div className="mt-3 rounded-lg bg-slate-950 px-3 py-2">
                              <p className="break-all font-mono text-[11px] text-slate-300">
                                {shortHash(entry.entry_hash)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No property history entries have been recorded.
                    </p>
                  )}
                </SectionCard>

                {/* ADMIN AUDIT */}
                <SectionCard
                  title="Administrative Audit Trail"
                  description="Actions performed by TNP administrators on this property"
                >
                  {selectedActions.length || selectedVerificationEvents.length ? (
                    <div className="space-y-3">
                      {selectedActions.slice(0, 10).map((action) => (
                        <div
                          key={`action-${action.id}`}
                          className="rounded-xl border border-slate-200 p-4"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2">
                              <ShieldCheck size={16} className="text-blue-600" />
                              <span className="font-semibold text-slate-900">
                                {action.action.replaceAll("_", " ")}
                              </span>
                            </div>

                            <span className="text-xs text-slate-400">
                              {formatDate(action.created_at)}
                            </span>
                          </div>

                          {action.reason && (
                            <p className="mt-2 text-sm text-slate-600">{action.reason}</p>
                          )}

                          <p className="mt-2 font-mono text-[11px] text-slate-400">
                            Admin: {action.admin_id}
                          </p>
                        </div>
                      ))}

                      {selectedVerificationEvents.slice(0, 10).map((event) => (
                        <div
                          key={`verification-${event.id}`}
                          className="rounded-xl border border-slate-200 p-4"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 size={16} className="text-emerald-600" />
                              <span className="font-semibold text-slate-900">
                                Verification status changed
                              </span>
                            </div>

                            <span className="text-xs text-slate-400">
                              {formatDate(event.created_at)}
                            </span>
                          </div>

                          <p className="mt-2 text-sm text-slate-600">
                            {event.previous_status} → {event.new_status}
                          </p>

                          {event.reason && (
                            <p className="mt-1 text-sm text-slate-500">{event.reason}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No administrative actions have been recorded for this property.
                    </p>
                  )}
                </SectionCard>

                {/* IDENTIFIERS */}
                <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={17} />
                    <h3 className="font-bold">Registry identifiers</h3>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-slate-400">Property ID</p>
                      <p className="mt-1 break-all font-mono text-xs text-slate-200">
                        {selectedProperty.id}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">Owner ID</p>
                      <p className="mt-1 break-all font-mono text-xs text-slate-200">
                        {selectedProperty.owner_id}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">Created</p>
                      <p className="mt-1 text-xs text-slate-200">
                        {formatDate(selectedProperty.created_at)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">Status</p>
                      <p className="mt-1 text-xs text-slate-200">
                        {selectedProperty.verified ? "Verified" : "Pending verification"}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <Building2 className="mx-auto text-slate-400" size={40} />
                <h2 className="mt-4 text-lg font-bold text-slate-950">Select a property</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  Select a listing from the registry to inspect its ownership, integrity, reports,
                  reviews, lease activity and audit history.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
