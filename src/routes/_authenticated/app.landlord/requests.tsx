import { matchesSearch as matchWorkspaceSearch } from '@/lib/workspace-search';
import { applicationStatus } from '@/lib/application-status';
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Filter,
  Home,
  Loader2,
  Mail,
  MessageSquare,
  Pencil,
  Search,
  Send,
  ShieldCheck,
  User,
  Users,
  X,
  XCircle,
} from "lucide-react";

import { RoleSidebar } from "@/components/dashboard/RoleSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/landlord/requests")({
  component: LandlordLeaseRequests,
});

type RequestStatus = "Pending review" | "Approved" | "Rejected" | "Withdrawn" | string;

type LeaseRequest = {
  id: string;
  property_id: string;
  tenant_id: string;
  move_in: string | null;
  message: string | null;
  status: RequestStatus;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  decision_at: string | null;
  rejection_reason: string | null;
  landlord_message: string | null;
  lease_id: string | null;
  updated_at: string | null;
  withdrawn_at: string | null;
};

type Property = {
  rent_usd?: number | null;
  id: string;
  landlord_id?: string | null;
  owner_id?: string | null;
  title?: string | null;
  name?: string | null;
  address?: string | null;
  location?: string | null;
  city?: string | null;
  suburb?: string | null;
  rent?: number | null;
  monthly_rent?: number | null;
  available?: boolean | null;
  property_type?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  image_url?: string | null;
};

type Profile = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  bio?: string | null;
  verification?: string | null;
  trust_score?: number | null;
  avatar_url?: string | null;
};

type RequestBundle = {
  request: LeaseRequest;
  property: Property | null;
  tenant: Profile | null;
};

const STATUS_OPTIONS = ["All", "Pending review", "Approved", "Rejected", "Withdrawn"] as const;

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-ZW", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-ZW", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "Not specified";
  }

  return `USD ${Number(value).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}/month`;
}

function getStatusClass(status: string) {
  switch (status) {
    case "Approved":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";

    case "Rejected":
      return "border-red-400/20 bg-red-400/10 text-red-300";

    case "Withdrawn":
      return "border-zinc-500/30 bg-zinc-500/10 text-zinc-300";

    case "Pending review":
    default:
      return "border-amber-400/20 bg-amber-400/10 text-amber-300";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "Approved":
      return <CheckCircle2 className="h-3.5 w-3.5" />;

    case "Rejected":
      return <XCircle className="h-3.5 w-3.5" />;

    case "Withdrawn":
      return <X className="h-3.5 w-3.5" />;

    case "Pending review":
    default:
      return <Clock3 className="h-3.5 w-3.5" />;
  }
}

function getPropertyTitle(property: Property | null) {
  if (!property) return "Property unavailable";

  return property.title || property.name || "Untitled property";
}

function getPropertyLocation(property: Property | null) {
  if (!property) return "Location unavailable";

  return property.location || property.address || property.city || "Location not provided";
}

function getPropertyRent(property: Property | null) {
  if (!property) return null;

  return property.rent_usd ?? property.rent ?? property.monthly_rent ?? null;
}

function getInitials(name: string | null | undefined) {
  if (!name) return "TN";

  const parts = name.trim().split(/\s+/);

  if (parts.length === 1) {
    return (parts[0] ?? "").slice(0, 2).toUpperCase();
  }

  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

function getTrustTone(score: number | null | undefined) {
  const value = Number(score ?? 0);

  if (value >= 80) {
    return "text-emerald-300";
  }

  if (value >= 60) {
    return "text-amber-300";
  }

  return "text-red-300";
}

function StatCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: number | string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/30">{label}</p>

          <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</p>

          <p className="mt-1 text-sm text-white/35">{description}</p>
        </div>

        <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-2.5 text-[#d6a84f]">
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClass(
        status,
      )}`}
    >
      {getStatusIcon(status)}
      {status}
    </span>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.07] bg-white/[0.025] px-6 text-center">
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 text-white/30">
        <FileText className="h-7 w-7" />
      </div>

      <h3 className="mt-5 text-base font-semibold text-white">{title}</h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-white/35">{description}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[420px] items-center justify-center bg-[#080909]">
      <div className="flex items-center gap-3 text-sm text-white/40">
        <Loader2 className="h-5 w-5 animate-spin text-[#d6a84f]" />
        Loading lease requests...
      </div>
    </div>
  );
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-[#080909] p-3.5">
      <div className="flex items-center gap-2 text-white/30">
        {icon}

        <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">{label}</span>
      </div>

      <p className="mt-2 truncate text-sm font-medium text-white/75">{value}</p>
    </div>
  );
}

function LandlordLeaseRequests() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>("All");

  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const [showRejectModal, setShowRejectModal] = useState(false);

  const [rejectionReason, setRejectionReason] = useState("");

  const [responseText, setResponseText] = useState("");

  const [responseMode, setResponseMode] = useState(false);

  const [responseLoading, setResponseLoading] = useState(false);

  const [responseError, setResponseError] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const userQuery = useQuery({
    queryKey: ["landlord-request-user"],

    queryFn: async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) throw error;

      return user;
    },
  });

  const landlordId = userQuery.data?.id ?? null;

  const propertiesQuery = useQuery({
    queryKey: ["landlord-request-properties", landlordId],

    enabled: Boolean(landlordId),

    queryFn: async () => {
      if (!landlordId) return [];

      /*
       * TNP landlord properties are owned through owner_id.
       */
      const result = await supabase.from("properties").select("*").eq("owner_id", landlordId);

      if (result.error) throw result.error;

      return (result.data ?? []) as Property[];
    },
  });

  const properties = propertiesQuery.data ?? [];

  const propertyIds = properties.map((property) => property.id);

  const requestsQuery = useQuery({
    queryKey: ["landlord-lease-requests", landlordId, propertyIds],

    enabled: Boolean(landlordId) && propertyIds.length > 0,

    queryFn: async () => {
      const { data, error } = await supabase
        .from("lease_requests")
        .select("*")
        .in("property_id", propertyIds)
        .order("created_at", {
          ascending: false,
        });

      if (error) throw error;

      return (data ?? []).map(row => ({...row, status: applicationStatus(row.status)})) as LeaseRequest[];
    },
  });

  const requests = requestsQuery.data ?? [];

  const tenantIds = useMemo(
    () => [...new Set(requests.map((request) => request.tenant_id).filter(Boolean))],
    [requests],
  );

  const tenantsQuery = useQuery({
    queryKey: ["landlord-request-tenants", tenantIds],

    enabled: tenantIds.length > 0,

    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").in("id", tenantIds);

      if (error) throw error;

      return (data ?? []) as Profile[];
    },
  });

  const tenants = tenantsQuery.data ?? [];

  const propertyMap = useMemo(() => {
    return new Map(properties.map((property) => [property.id, property]));
  }, [properties]);

  const tenantMap = useMemo(() => {
    return new Map(tenants.map((tenant) => [tenant.id, tenant]));
  }, [tenants]);

  const bundles = useMemo<RequestBundle[]>(() => {
    return requests.map((request) => ({
      request,
      property: propertyMap.get(request.property_id) ?? null,
      tenant: tenantMap.get(request.tenant_id) ?? null,
    }));
  }, [requests, propertyMap, tenantMap]);

  const filteredRequests = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return bundles.filter(({ request, property, tenant }) => {
      const matchesStatus = statusFilter === "All" || request.status === statusFilter;

      if (!matchesStatus) return false;

      if (!normalizedSearch) return true;

      const haystack = [
        tenant?.full_name,
        tenant?.phone,
        property?.title,
        property?.name,
        property?.location,
        property?.address,
        property?.city,
        property?.suburb,
        request.id,
        request.message,
        request.landlord_message,
        request.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchWorkspaceSearch(normalizedSearch, haystack);
    });
  }, [bundles, search, statusFilter]);

  const selectedBundle = useMemo(
    () => bundles.find(({ request }) => request.id === selectedRequestId) ?? null,
    [bundles, selectedRequestId],
  );

  const metrics = useMemo(() => {
    return {
      total: requests.length,

      pending: requests.filter((request) => request.status === "Pending review").length,

      approved: requests.filter((request) => request.status === "Approved").length,

      rejected: requests.filter((request) => request.status === "Rejected").length,

      withdrawn: requests.filter((request) => request.status === "Withdrawn").length,
    };
  }, [requests]);

  function openRequest(request: LeaseRequest) {
    setSelectedRequestId(request.id);

    /*
     * IMPORTANT:
     * responseText is populated from landlord_message,
     * NOT message.
     *
     * message = tenant's original message.
     * landlord_message = landlord's response.
     */
    setResponseText(request.landlord_message ?? "");

    setResponseMode(false);
    setResponseError(null);
    setErrorMessage(null);
    setShowRejectModal(false);
    setRejectionReason("");
  }

  function startResponse() {
    if (!selectedBundle) return;

    setResponseText(selectedBundle.request.landlord_message ?? "");

    setResponseMode(true);
    setResponseError(null);
    setErrorMessage(null);
  }

  function cancelResponse() {
    setResponseText(selectedBundle?.request.landlord_message ?? "");

    setResponseMode(false);
    setResponseError(null);
  }

  async function saveLandlordResponse() {
    if (!selectedBundle || !landlordId) return;

    const trimmedResponse = responseText.trim();

    if (!trimmedResponse) {
      setResponseError("Please enter a response before saving.");
      return;
    }

    setResponseLoading(true);
    setResponseError(null);
    setErrorMessage(null);

    try {
      const now = new Date().toISOString();

      /*
       * CRITICAL FIX:
       *
       * Save the landlord response into landlord_message.
       *
       * DO NOT update "message" here because message
       * belongs to the tenant's original request.
       */
      const { error } = await supabase
        .from("lease_requests")
        .update({
          landlord_message: trimmedResponse,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedBundle.request.id)
        .eq("property_id", selectedBundle.request.property_id).select("id").single();

      if (error) throw error;

      await queryClient.invalidateQueries({
        queryKey: ["landlord-lease-requests"],
      });
      await queryClient.invalidateQueries({ queryKey: ["landlord-applicants-requests"] });

      setResponseText(trimmedResponse);
      setResponseMode(false);
      setResponseError(null);
    } catch (error) {
      setResponseError(
        error instanceof Error ? error.message : "Unable to save landlord response.",
      );
    } finally {
      setResponseLoading(false);
    }
  }

  async function approveRequest() {
    if (!selectedBundle || !landlordId) return;

    setActionLoading(true);
    setErrorMessage(null);

    try {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("lease_requests")
        .update({
          status: "Approved",
          reviewed_at: now as never,
          reviewed_by: landlordId as never,
          decision_at: now as never,
          rejection_reason: null as never,
          updated_at: now as never,
        })
        .eq("id", selectedBundle.request.id)
        .eq("property_id", selectedBundle.request.property_id).select("id").single();

      if (error) throw error;

      await queryClient.invalidateQueries({
        queryKey: ["landlord-lease-requests"],
      });
      await queryClient.invalidateQueries({ queryKey: ["landlord-applicants-requests"] });

      setSelectedRequestId(null);
      setResponseMode(false);
      setResponseText("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to approve this request.");
    } finally {
      setActionLoading(false);
    }
  }

  async function rejectRequest() {
    if (!selectedBundle || !landlordId) return;

    if (!rejectionReason.trim()) {
      setErrorMessage("Please provide a rejection reason.");
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);

    try {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("lease_requests")
        .update({
          status: "Rejected" as never,
          reviewed_at: now as never,
          reviewed_by: landlordId as never,
          decision_at: now as never,
          rejection_reason: rejectionReason.trim() as never,
          updated_at: now as never,
        })
        .eq("id", selectedBundle.request.id)
        .eq("property_id", selectedBundle.request.property_id).select("id").single();

      if (error) throw error;

      await queryClient.invalidateQueries({
        queryKey: ["landlord-lease-requests"],
      });
      await queryClient.invalidateQueries({ queryKey: ["landlord-applicants-requests"] });

      setRejectionReason("");
      setShowRejectModal(false);
      setSelectedRequestId(null);
      setResponseMode(false);
      setResponseText("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to reject this request.");
    } finally {
      setActionLoading(false);
    }
  }

  function closeDetails() {
    setSelectedRequestId(null);
    setShowRejectModal(false);
    setRejectionReason("");
    setResponseText("");
    setResponseMode(false);
    setResponseError(null);
    setErrorMessage(null);
  }

  const isLoading =
    userQuery.isLoading ||
    propertiesQuery.isLoading ||
    requestsQuery.isLoading ||
    tenantsQuery.isLoading;

  if (isLoading) {
    return (
      <SidebarProvider>
        <RoleSidebar role="landlord" />

        <SidebarInset className="min-w-0 bg-[#080909] text-white">
          <LoadingState />
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <RoleSidebar role="landlord" />

      <SidebarInset className="min-w-0 bg-[#080909] text-white">
        <div className="tnp-module tnp-module-dark min-h-screen w-full bg-[#080909]">
          {/* HEADER */}
          <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#080909]/95 backdrop-blur-xl">
            <div className="flex h-16 items-center justify-between px-5 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <SidebarTrigger className="text-white/45 hover:bg-white/[0.05] hover:text-white" />

                <div className="hidden h-5 w-px bg-white/[0.08] sm:block" />

                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#d6a84f]">
                    Landlord Portal
                  </p>

                  <h1 className="truncate text-sm font-semibold text-white">Lease Requests</h1>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate({
                    to: "/app/landlord",
                  })
                }
                className="inline-flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-sm text-white/55 transition hover:bg-white/[0.05] hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />

                <span className="hidden sm:inline">Dashboard</span>
              </button>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1600px] px-5 py-8 lg:px-8">
            {/* INTRO */}
            <section className="mb-8">
              <div className="max-w-3xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">
                  Tenant Applications
                </p>

                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white lg:text-4xl">
                  Review lease requests.
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">
                  Review prospective tenants, examine available trust information, communicate with
                  applicants, and manage incoming requests across your properties.
                </p>
              </div>
            </section>

            {/* METRICS */}
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard
                label="Total"
                value={metrics.total}
                description="All requests"
                icon={<FileText className="h-5 w-5" />}
              />

              <StatCard
                label="Pending"
                value={metrics.pending}
                description="Awaiting review"
                icon={<Clock3 className="h-5 w-5" />}
              />

              <StatCard
                label="Approved"
                value={metrics.approved}
                description="Accepted requests"
                icon={<CheckCircle2 className="h-5 w-5" />}
              />

              <StatCard
                label="Rejected"
                value={metrics.rejected}
                description="Declined requests"
                icon={<XCircle className="h-5 w-5" />}
              />

              <StatCard
                label="Withdrawn"
                value={metrics.withdrawn}
                description="Tenant withdrawals"
                icon={<X className="h-5 w-5" />}
              />
            </section>

            {/* FILTERS */}
            <section className="mt-8">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />

                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search tenant, property, location..."
                      className="h-11 w-full rounded-lg border border-white/[0.07] bg-[#080909] pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/20 focus:border-[#d6a84f]/30"
                    />
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto">
                    <Filter className="h-4 w-4 shrink-0 text-white/25" />

                    {STATUS_OPTIONS.map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setStatusFilter(status)}
                        className={`whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-medium transition ${
                          statusFilter === status
                            ? "border-[#d6a84f]/25 bg-[#d6a84f]/[0.07] text-[#d6a84f]"
                            : "border-white/[0.07] bg-white/[0.025] text-white/35 hover:bg-white/[0.05] hover:text-white/65"
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* ERROR */}
            {errorMessage && (
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-400/15 bg-red-400/[0.05] p-4 text-sm text-red-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

                <span>{errorMessage}</span>
              </div>
            )}

            {/* REQUEST LIST */}
            <section className="mt-6">
              {filteredRequests.length === 0 ? (
                <EmptyState
                  title={requests.length === 0 ? "No lease requests yet" : "No matching requests"}
                  description={
                    requests.length === 0
                      ? "When tenants apply for one of your properties, their lease requests will appear here."
                      : "Try changing your search or status filter to find the request you are looking for."
                  }
                />
              ) : (
                <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.025]">
                  {/* TABLE HEADER */}
                  <div className="hidden border-b border-white/[0.07] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/25 lg:grid lg:grid-cols-[1.5fr_1.5fr_1fr_1fr_40px] lg:gap-4">
                    <span>Tenant</span>
                    <span>Property</span>
                    <span>Move-in</span>
                    <span>Status</span>
                    <span />
                  </div>

                  <div className="divide-y divide-white/[0.06]">
                    {filteredRequests.map(({ request, property, tenant }) => {
                      const trustScore = tenant?.trust_score ?? null;

                      return (
                        <button
                          key={request.id}
                          type="button"
                          onClick={() => openRequest(request)}
                          className="group grid w-full gap-4 px-5 py-5 text-left transition hover:bg-white/[0.035] lg:grid-cols-[1.5fr_1.5fr_1fr_1fr_40px] lg:items-center"
                        >
                          {/* TENANT */}
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035] text-xs font-semibold text-white/60">
                              {getInitials(tenant?.full_name)}
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">
                                {tenant?.full_name || "Unknown tenant"}
                              </p>

                              <div className="mt-1 flex items-center gap-2">
                                <span className={`text-xs font-medium ${getTrustTone(trustScore)}`}>
                                  Trust {trustScore ?? "—"}
                                </span>

                                {tenant?.verification && (
                                  <>
                                    <span className="text-white/15">•</span>

                                    <span className="truncate text-xs text-white/30">
                                      {tenant.verification}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* PROPERTY */}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white/70">
                              {getPropertyTitle(property)}
                            </p>

                            <p className="mt-1 truncate text-xs text-white/30">
                              {getPropertyLocation(property)}
                            </p>
                          </div>

                          {/* MOVE IN */}
                          <div>
                            <p className="text-sm text-white/55">{formatDate(request.move_in)}</p>

                            <p className="mt-1 text-xs text-white/25">
                              Submitted {formatDate(request.created_at)}
                            </p>
                          </div>

                          {/* STATUS */}
                          <div>
                            <StatusBadge status={request.status} />
                          </div>

                          <ChevronRight className="hidden h-4 w-4 text-white/15 transition group-hover:translate-x-0.5 group-hover:text-white/50 lg:block" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </main>
        </div>

        {/* DETAIL DRAWER */}
        {selectedBundle && (
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              aria-label="Close request details"
              onClick={closeDetails}
              className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            />

            <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col border-l border-white/[0.07] bg-[#080909] shadow-2xl">
              {/* DRAWER HEADER */}
              <div className="flex items-center justify-between border-b border-white/[0.07] bg-[#080909]/95 px-6 py-5 backdrop-blur-xl">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6a84f]">
                    Lease Request
                  </p>

                  <h2 className="mt-1 text-lg font-semibold text-white">Request details</h2>
                </div>

                <button
                  type="button"
                  onClick={closeDetails}
                  className="rounded-lg border border-white/[0.07] p-2 text-white/35 transition hover:bg-white/[0.05] hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* DRAWER CONTENT */}
              <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <StatusBadge status={selectedBundle.request.status} />

                  <span className="text-xs text-white/25">
                    Submitted {formatDateTime(selectedBundle.request.created_at)}
                  </span>
                </div>

                {/* TENANT */}
                <section className="mt-7 rounded-xl border border-white/[0.07] bg-white/[0.025] p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-sm font-semibold text-white/60">
                      {getInitials(selectedBundle.tenant?.full_name)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/25">
                        Prospective tenant
                      </p>

                      <h3 className="mt-1 text-lg font-semibold text-white">
                        {selectedBundle.tenant?.full_name || "Unknown tenant"}
                      </h3>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 text-sm font-medium ${getTrustTone(
                            selectedBundle.tenant?.trust_score,
                          )}`}
                        >
                          <ShieldCheck className="h-4 w-4" />
                          Trust score {selectedBundle.tenant?.trust_score ?? "—"}
                        </span>

                        {selectedBundle.tenant?.verification && (
                          <span className="rounded-full border border-white/[0.07] bg-white/[0.035] px-2.5 py-1 text-xs text-white/40">
                            {selectedBundle.tenant.verification}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <DetailItem
                      icon={<User className="h-4 w-4" />}
                      label="Tenant"
                      value={selectedBundle.tenant?.full_name || "Not available"}
                    />

                    <DetailItem
                      icon={<Mail className="h-4 w-4" />}
                      label="Phone"
                      value={selectedBundle.tenant?.phone || "Not provided"}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      window.location.assign("/app/landlord/applicants");
                    }}
                    className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-white/55 transition hover:text-white"
                  >
                    <Users className="h-4 w-4" />
                    View applicant workspace
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </section>

                {/* PROPERTY */}
                <section className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.035]">
                      <Home className="h-5 w-5 text-[#d6a84f]" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/25">
                        Property
                      </p>

                      <h3 className="mt-1 truncate text-base font-semibold text-white">
                        {getPropertyTitle(selectedBundle.property)}
                      </h3>

                      <p className="mt-1 text-sm text-white/35">
                        {getPropertyLocation(selectedBundle.property)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <DetailItem
                      icon={<Home className="h-4 w-4" />}
                      label="Monthly rent"
                      value={formatCurrency(getPropertyRent(selectedBundle.property))}
                    />

                    <DetailItem
                      icon={<CalendarDays className="h-4 w-4" />}
                      label="Requested move-in"
                      value={formatDate(selectedBundle.request.move_in)}
                    />
                  </div>
                </section>

                {/* TENANT MESSAGE */}
                <section className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-5">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-[#d6a84f]" />

                    <h3 className="text-sm font-semibold text-white">Tenant message</h3>
                  </div>

                  <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-white/45">
                    {selectedBundle.request.message ||
                      "The tenant did not include a message with this request."}
                  </p>
                </section>

                {/* LANDLORD RESPONSE */}
                <section className="mt-4 rounded-xl border border-[#d6a84f]/15 bg-[#d6a84f]/[0.035] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-[#d6a84f]" />

                        <h3 className="text-sm font-semibold text-white">Landlord Response</h3>
                      </div>

                      <p className="mt-1 text-xs leading-5 text-white/25">
                        Send a response directly to the tenant regarding this lease request.
                      </p>
                    </div>

                    {!responseMode && (
                      <button
                        type="button"
                        onClick={startResponse}
                        className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#d6a84f]/20 bg-[#d6a84f]/[0.07] px-3 py-2 text-xs font-medium text-[#d6a84f] transition hover:bg-[#d6a84f]/[0.12]"
                      >
                        {selectedBundle.request.landlord_message ? (
                          <>
                            <Pencil className="h-3.5 w-3.5" />
                            Edit Response
                          </>
                        ) : (
                          <>
                            <Send className="h-3.5 w-3.5" />
                            Reply to Tenant
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* RESPONSE EDITOR */}
                  {responseMode ? (
                    <div className="mt-4">
                      <textarea
                        autoFocus
                        value={responseText}
                        onChange={(event) => setResponseText(event.target.value)}
                        rows={5}
                        placeholder="Write your response to the tenant..."
                        className="w-full resize-none rounded-lg border border-white/[0.07] bg-[#080909] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/20 focus:border-[#d6a84f]/40"
                      />

                      {responseError && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-red-300">
                          <AlertCircle className="h-3.5 w-3.5" />

                          {responseError}
                        </div>
                      )}

                      <div className="mt-3 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={responseLoading}
                          onClick={cancelResponse}
                          className="rounded-lg border border-white/[0.07] px-4 py-2 text-xs font-medium text-white/40 transition hover:bg-white/[0.04] hover:text-white disabled:opacity-50"
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          disabled={responseLoading}
                          onClick={saveLandlordResponse}
                          className="inline-flex items-center gap-2 rounded-lg bg-[#d6a84f] px-4 py-2 text-xs font-semibold text-[#080909] transition hover:bg-[#e1b65d] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {responseLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}

                          {responseLoading ? "Saving..." : "Save Response"}
                        </button>
                      </div>
                    </div>
                  ) : selectedBundle.request.landlord_message ? (
                    /* SAVED RESPONSE */
                    <div className="mt-4 rounded-lg border border-white/[0.07] bg-[#080909] p-4">
                      <p className="whitespace-pre-wrap text-sm leading-6 text-white/55">
                        {selectedBundle.request.landlord_message}
                      </p>

                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
                        <div className="flex items-center gap-2 text-xs text-white/25">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          Response saved
                        </div>

                        <button
                          type="button"
                          onClick={startResponse}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#d6a84f] transition hover:text-[#e1b65d]"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit Response
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* NO RESPONSE */
                    <div className="mt-4 rounded-lg border border-white/[0.07] bg-[#080909] p-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-2">
                          <MessageSquare className="h-4 w-4 text-white/25" />
                        </div>

                        <div>
                          <p className="text-sm font-medium text-white/50">No response sent yet.</p>

                          <p className="mt-1 text-xs text-white/25">
                            Use Reply to Tenant to communicate about this request.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                {/* DECISION HISTORY */}
                {selectedBundle.request.status !== "Pending review" && (
                  <section className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/25">
                      Decision History
                    </p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <DetailItem
                        icon={<Clock3 className="h-4 w-4" />}
                        label="Reviewed"
                        value={formatDateTime(selectedBundle.request.reviewed_at)}
                      />

                      <DetailItem
                        icon={<CheckCircle2 className="h-4 w-4" />}
                        label="Decision"
                        value={formatDateTime(selectedBundle.request.decision_at)}
                      />
                    </div>

                    {selectedBundle.request.rejection_reason && (
                      <div className="mt-4 rounded-lg border border-red-400/15 bg-red-400/[0.05] p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-red-300">
                          Rejection reason
                        </p>

                        <p className="mt-2 text-sm leading-6 text-white/45">
                          {selectedBundle.request.rejection_reason}
                        </p>
                      </div>
                    )}

                    {selectedBundle.request.lease_id && (
                      <div className="mt-4 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.04] p-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />

                          <div>
                            <p className="text-sm font-semibold text-white">Lease connected</p>

                            <p className="mt-1 text-xs leading-5 text-white/30">
                              This request is linked to lease{" "}
                              <span className="text-white/50">
                                {selectedBundle.request.lease_id}
                              </span>
                              .
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                )}
              </div>

              {/* ACTION AREA */}
              {selectedBundle.request.status === "Pending review" && (
                <div className="border-t border-white/[0.07] bg-[#080909] p-5">
                  <div className="mb-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/25">
                      Lease request decision
                    </p>

                    <p className="mt-1 text-xs leading-5 text-white/25">
                      Approve the request to accept the tenant, or reject it with a required reason.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => setShowRejectModal(true)}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-red-400/20 bg-red-400/[0.06] text-sm font-medium text-red-300 transition hover:bg-red-400/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </button>

                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={approveRequest}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] text-sm font-medium text-emerald-300 transition hover:bg-emerald-400/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Approve
                    </button>
                  </div>
                </div>
              )}

              {/* APPROVED LEASE FOOTER */}
              {selectedBundle.request.status === "Approved" && selectedBundle.request.lease_id && (
                <div className="border-t border-white/[0.07] bg-[#080909] p-5">
                  <div className="rounded-lg border border-emerald-400/15 bg-emerald-400/[0.04] p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />

                      <div>
                        <p className="text-sm font-semibold text-white">Lease connected</p>

                        <p className="mt-1 text-xs leading-5 text-white/30">
                          This approved request is linked to a lease.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}

        {/* REJECTION MODAL */}
        {showRejectModal && selectedBundle && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-xl border border-white/[0.07] bg-[#080909] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
                <div>
                  <h3 className="text-base font-semibold text-white">Reject lease request</h3>

                  <p className="mt-1 text-xs text-white/25">
                    The tenant will see the recorded reason.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="rounded-lg p-2 text-white/30 hover:bg-white/[0.05] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5">
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/25">
                  Rejection reason
                </label>

                <textarea
                  autoFocus
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  rows={5}
                  placeholder="Explain why this request is being rejected..."
                  className="w-full resize-none rounded-lg border border-white/[0.07] bg-[#080909] px-4 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-red-400/30"
                />

                {errorMessage && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-400/15 bg-red-400/[0.05] p-3 text-xs text-red-200">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="mt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(false)}
                    className="rounded-lg border border-white/[0.07] px-4 py-2.5 text-sm text-white/40 transition hover:bg-white/[0.05] hover:text-white"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={rejectRequest}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/[0.07] px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-400/[0.12] disabled:opacity-50"
                  >
                    {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Reject request
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
