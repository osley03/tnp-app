import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  History,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Search,
  ShieldCheck,
  Star,
  User,
  Users,
  Wallet,
  X,
  XCircle,
} from "lucide-react";

import { RoleSidebar } from "@/components/dashboard/RoleSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/landlord/applicants")({
  component: LandlordApplicants,
});

type LeaseRequest = {
  id: string;
  property_id: string;
  tenant_id: string;
  move_in: string | null;
  message: string | null;
  status: string;
  created_at: string;
  rejection_reason: string | null;
  landlord_message: string | null;
  lease_id: string | null;
  updated_at: string | null;
  withdrawn_at: string | null;
};

type Property = {
  id: string;
  owner_id: string;
  title: string;
  suburb: string;
  city: string;
  rent_usd: number;
  deposit_usd: number;
  beds: number;
  baths: number;
  property_type: string;
  description: string | null;
  image_url: string | null;
  verified: boolean;
  available: boolean;
};

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  bio: string | null;
  verification: string | null;
  trust_score: number | null;
};

type Lease = {
  id: string;
  lease_request_id: string | null;
  property_id: string;
  tenant_id: string;
  landlord_id: string;
  status: string;
  rent_usd: number;
  deposit_usd: number;
  start_date: string | null;
  end_date: string | null;
  signed_at: string | null;
  terms: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

type LeaseQueryResult = {
  data: unknown;
  error: { message: string } | null;
};

type LeaseQueryBuilder = {
  select: (columns: string) => LeaseQueryBuilder;
  eq: (column: string, value: string) => LeaseQueryBuilder;
  order: (column: string, options: { ascending: boolean }) => PromiseLike<LeaseQueryResult>;
};

type Applicant = {
  request: LeaseRequest;
  tenant: Profile | null;
  property: Property | null;
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
};

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "USD 0";

  return `USD ${Number(value).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
};

const normalizeStatus = (status: string | null | undefined) => {
  return String(status || "")
    .trim()
    .toLowerCase();
};

const isPending = (status: string) =>
  ["pending", "pending review", "pending_review", "submitted", "under review", "under_review"].includes(normalizeStatus(status));

const isApproved = (status: string) => ["approved", "accepted"].includes(normalizeStatus(status));

const isRejected = (status: string) => ["rejected", "declined"].includes(normalizeStatus(status));

const isWithdrawn = (status: string) => normalizeStatus(status) === "withdrawn";

function StatusBadge({ status }: { status: string }) {
  const normalized = normalizeStatus(status);

  if (isApproved(status)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Approved
      </span>
    );
  }

  if (isRejected(status)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/20 bg-red-400/10 px-2.5 py-1 text-xs font-medium text-red-300">
        <XCircle className="h-3.5 w-3.5" />
        Rejected
      </span>
    );
  }

  if (isWithdrawn(status)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-500/20 bg-zinc-500/10 px-2.5 py-1 text-xs font-medium text-zinc-300">
        Withdrawn
      </span>
    );
  }

  if (normalized === "draft") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-500/20 bg-zinc-500/10 px-2.5 py-1 text-xs font-medium text-zinc-300">
        Draft
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d6a84f]/20 bg-[#d6a84f]/10 px-2.5 py-1 text-xs font-medium text-[#e2bb68]">
      <Clock3 className="h-3.5 w-3.5" />
      {status || "Pending review"}
    </span>
  );
}

function TrustBadge({ score }: { score: number | null | undefined }) {
  const value = Number(score ?? 0);

  let text = "Low";
  let className = "border-red-400/20 bg-red-400/10 text-red-300";

  if (value >= 70) {
    text = "Strong";
    className = "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
  } else if (value >= 40) {
    text = "Moderate";
    className = "border-[#d6a84f]/20 bg-[#d6a84f]/10 text-[#e2bb68]";
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${className}`}
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      {value}/100 · {text}
    </span>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  description,
}: {
  label: string;
  value: string | number;
  icon: typeof Users;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p>
        </div>

        <div className="rounded-xl border border-[#d6a84f]/15 bg-[#d6a84f]/10 p-2.5">
          <Icon className="h-5 w-5 text-[#d6a84f]" />
        </div>
      </div>

      <p className="mt-3 text-xs text-zinc-600">{description}</p>
    </div>
  );
}

function LandlordApplicants() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);

  const [responseText, setResponseText] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const landlordQuery = useQuery({
    queryKey: ["landlord-applicants-current-user"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();

      if (error) throw error;
      if (!data.user) throw new Error("You are not signed in.");

      return data.user;
    },
  });

  const landlordId = landlordQuery.data?.id ?? null;

  const propertiesQuery = useQuery({
    queryKey: ["landlord-applicant-properties", landlordId],
    enabled: Boolean(landlordId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select(
          `
            id,
            owner_id,
            title,
            suburb,
            city,
            rent_usd,
            deposit_usd,
            beds,
            baths,
            property_type,
            description,
            image_url,
            verified,
            available
          `,
        )
        .eq("owner_id", landlordId!);

      if (error) throw error;

      return (data ?? []) as Property[];
    },
  });

  const properties = propertiesQuery.data ?? [];
  const propertyIds = properties.map((property) => property.id);

  const requestsQuery = useQuery({
    queryKey: ["landlord-applicants-requests", landlordId, propertyIds],
    enabled: Boolean(landlordId) && propertyIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lease_requests")
        .select(
          `
            id,
            property_id,
            tenant_id,
            move_in,
            message,
            status,
            created_at,
            rejection_reason,
            landlord_message,
            lease_id,
            updated_at,
            withdrawn_at
          `,
        )
        .in("property_id", propertyIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []) as unknown as LeaseRequest[];
    },
  });

  const requests = requestsQuery.data ?? [];

  const tenantIds = useMemo(
    () => [...new Set(requests.map((request) => request.tenant_id))],
    [requests],
  );

  const profilesQuery = useQuery({
    queryKey: ["landlord-applicant-profiles", tenantIds],
    enabled: tenantIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          `
            id,
            full_name,
            phone,
            bio,
            verification,
            trust_score
          `,
        )
        .in("id", tenantIds);

      if (error) throw error;

      return (data ?? []) as Profile[];
    },
  });

  const profileMap = useMemo(() => {
    const map = new Map<string, Profile>();

    for (const profile of profilesQuery.data ?? []) {
      map.set(profile.id, profile);
    }

    return map;
  }, [profilesQuery.data]);

  const propertyMap = useMemo(() => {
    const map = new Map<string, Property>();

    for (const property of properties) {
      map.set(property.id, property);
    }

    return map;
  }, [properties]);

  const applicants = useMemo<Applicant[]>(
    () =>
      requests.map((request) => ({
        request,
        tenant: profileMap.get(request.tenant_id) ?? null,
        property: propertyMap.get(request.property_id) ?? null,
      })),
    [requests, profileMap, propertyMap],
  );

  const filteredApplicants = useMemo(() => {
    const query = search.trim().toLowerCase();

    return applicants.filter((applicant) => {
      const tenant = applicant.tenant;
      const property = applicant.property;
      const request = applicant.request;

      const searchable = [
        tenant?.full_name,
        tenant?.phone,
        property?.title,
        property?.suburb,
        property?.city,
        request.message,
        request.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchable.includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "pending" && isPending(request.status)) ||
        (statusFilter === "approved" && isApproved(request.status)) ||
        (statusFilter === "rejected" && isRejected(request.status)) ||
        (statusFilter === "withdrawn" && isWithdrawn(request.status));

      const matchesVerification =
        verificationFilter === "all" ||
        normalizeStatus(tenant?.verification) === normalizeStatus(verificationFilter);

      return matchesSearch && matchesStatus && matchesVerification;
    });
  }, [applicants, search, statusFilter, verificationFilter]);

  const metrics = useMemo(() => {
    const total = applicants.length;
    const pending = applicants.filter((item) => isPending(item.request.status)).length;
    const approved = applicants.filter((item) => isApproved(item.request.status)).length;
    const rejected = applicants.filter((item) => isRejected(item.request.status)).length;
    const withdrawn = applicants.filter((item) => isWithdrawn(item.request.status)).length;

    const scores = applicants
      .map((item) => item.tenant?.trust_score)
      .filter((value): value is number => typeof value === "number");

    const averageTrust =
      scores.length > 0
        ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
        : 0;

    return {
      total,
      pending,
      approved,
      rejected,
      withdrawn,
      averageTrust,
    };
  }, [applicants]);

  const selectedApplicant = useMemo(
    () => applicants.find((applicant) => applicant.request.id === selectedApplicantId) ?? null,
    [applicants, selectedApplicantId],
  );

  const selectedTenantId = selectedApplicant?.request.tenant_id ?? null;

  const historyLeasesQuery = useQuery({
    queryKey: ["landlord-applicant-history-leases", selectedTenantId],
    enabled: Boolean(selectedTenantId),
    queryFn: async () => {
      const { data, error } = await (
        supabase as unknown as {
          from: (table: "leases") => LeaseQueryBuilder;
        }
      )
        .from("leases")
        .select(
          `
            id,
            lease_request_id,
            property_id,
            tenant_id,
            landlord_id,
            status,
            rent_usd,
            deposit_usd,
            start_date,
            end_date,
            signed_at,
            terms,
            admin_notes,
            created_at,
            updated_at
          `,
        )
        .eq("tenant_id", selectedTenantId!)
        .order("start_date", { ascending: false });

      if (error) throw error;

      return (data ?? []) as Lease[];
    },
  });

  const historicalLeases = historyLeasesQuery.data ?? [];

  const historicalPropertyIds = useMemo(
    () => [...new Set(historicalLeases.map((lease) => lease.property_id))],
    [historicalLeases],
  );

  const historicalLandlordIds = useMemo(
    () => [...new Set(historicalLeases.map((lease) => lease.landlord_id))],
    [historicalLeases],
  );

  const historicalPropertiesQuery = useQuery({
    queryKey: ["landlord-applicant-history-properties", historicalPropertyIds],
    enabled: historicalPropertyIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select(
          `
            id,
            owner_id,
            title,
            suburb,
            city,
            rent_usd,
            deposit_usd,
            beds,
            baths,
            property_type,
            description,
            image_url,
            verified,
            available
          `,
        )
        .in("id", historicalPropertyIds);

      if (error) throw error;

      return (data ?? []) as Property[];
    },
  });

  const historicalLandlordsQuery = useQuery({
    queryKey: ["landlord-applicant-history-landlords", historicalLandlordIds],
    enabled: historicalLandlordIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          `
            id,
            full_name,
            phone,
            bio,
            verification,
            trust_score
          `,
        )
        .in("id", historicalLandlordIds);

      if (error) throw error;

      return (data ?? []) as Profile[];
    },
  });

  const historicalPropertyMap = useMemo(() => {
    const map = new Map<string, Property>();

    for (const property of historicalPropertiesQuery.data ?? []) {
      map.set(property.id, property);
    }

    return map;
  }, [historicalPropertiesQuery.data]);

  const historicalLandlordMap = useMemo(() => {
    const map = new Map<string, Profile>();

    for (const landlord of historicalLandlordsQuery.data ?? []) {
      map.set(landlord.id, landlord);
    }

    return map;
  }, [historicalLandlordsQuery.data]);

  const openApplicant = (applicant: Applicant) => {
    setSelectedApplicantId(applicant.request.id);
    setResponseText(applicant.request.landlord_message ?? "");
    setErrorMessage(null);
  };

  const closeApplicant = () => {
    setSelectedApplicantId(null);
    setResponseText("");
    setErrorMessage(null);
    setShowRejectModal(false);
    setRejectionReason("");
  };

  const saveResponse = async () => {
    if (!selectedApplicant) return;

    setActionLoading(true);
    setErrorMessage(null);

    try {
      const trimmedResponse = responseText.trim();

      const { error } = await supabase
        .from("lease_requests")
        .update({
          landlord_message: trimmedResponse || null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", selectedApplicant.request.id)
        .eq("property_id", selectedApplicant.request.property_id).select("id").single();

      if (error) throw error;

      await queryClient.invalidateQueries({
        queryKey: ["landlord-applicants-requests"],
      });
      await queryClient.invalidateQueries({ queryKey: ["landlord-lease-requests"] });

      setResponseText(trimmedResponse);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save your response.");
    } finally {
      setActionLoading(false);
    }
  };

  const acceptApplicant = async () => {
    if (!selectedApplicant || !landlordId) return;

    setActionLoading(true);
    setErrorMessage(null);

    try {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("lease_requests")
        .update({
          status: "Approved",
          reviewed_at: now,
          rejection_reason: null,
          updated_at: now,
        } as never)
        .eq("id", selectedApplicant.request.id)
        .eq("property_id", selectedApplicant.request.property_id).select("id").single();

      if (error) throw error;

      await queryClient.invalidateQueries({
        queryKey: ["landlord-applicants-requests"],
      });
      await queryClient.invalidateQueries({ queryKey: ["landlord-lease-requests"] });

      closeApplicant();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to approve this applicant.");
    } finally {
      setActionLoading(false);
    }
  };

  const declineApplicant = async () => {
    if (!selectedApplicant || !landlordId) return;

    const reason = rejectionReason.trim();

    if (!reason) {
      setErrorMessage("A rejection reason is required.");
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);

    try {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("lease_requests")
        .update({
          status: "Rejected",
          reviewed_at: now,
          rejection_reason: reason,
          updated_at: now,
        } as never)
        .eq("id", selectedApplicant.request.id)
        .eq("property_id", selectedApplicant.request.property_id).select("id").single();

      if (error) throw error;

      await queryClient.invalidateQueries({
        queryKey: ["landlord-applicants-requests"],
      });
      await queryClient.invalidateQueries({ queryKey: ["landlord-lease-requests"] });

      closeApplicant();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to decline this applicant.");
    } finally {
      setActionLoading(false);
    }
  };

  const loading =
    landlordQuery.isLoading ||
    propertiesQuery.isLoading ||
    requestsQuery.isLoading ||
    profilesQuery.isLoading;

  return (
    <SidebarProvider>
      <RoleSidebar role="landlord" />

      <SidebarInset className="tnp-module tnp-module-dark min-h-screen bg-[#080909] text-white">
        <div className="tnp-module tnp-module-dark min-h-screen bg-[#080909]">
          {/* Header */}
          <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#080909]/95 backdrop-blur-xl">
            <div className="flex h-16 items-center gap-4 px-6">
              <SidebarTrigger className="text-zinc-400 hover:bg-white/[0.05] hover:text-white" />

              <div className="h-5 w-px bg-white/[0.08]" />

              <div>
                <p className="text-sm font-medium text-white">Applicants</p>
                <p className="text-xs text-zinc-600">
                  Review tenant applications and rental history
                </p>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-[1600px] px-6 py-7">
            {/* Page heading */}
            <div className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-[#d6a84f]">
                  <Users className="h-3.5 w-3.5" />
                  Tenant Selection
                </div>

                <h1 className="text-3xl font-semibold tracking-tight text-white">Applicants</h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                  Review applications, verify tenant information, inspect rental history and make
                  your leasing decision.
                </p>
              </div>

              <div className="rounded-xl border border-[#d6a84f]/15 bg-[#d6a84f]/[0.06] px-4 py-3">
                <p className="text-xs text-zinc-500">Average applicant trust</p>
                <div className="mt-1 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#d6a84f]" />
                  <span className="text-lg font-semibold text-white">
                    {metrics.averageTrust}/100
                  </span>
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                label="Total applicants"
                value={metrics.total}
                icon={Users}
                description="Applications across your properties"
              />

              <MetricCard
                label="Pending review"
                value={metrics.pending}
                icon={Clock3}
                description="Awaiting your decision"
              />

              <MetricCard
                label="Approved"
                value={metrics.approved}
                icon={CheckCircle2}
                description="Applications you accepted"
              />

              <MetricCard
                label="Rejected"
                value={metrics.rejected}
                icon={XCircle}
                description="Applications declined"
              />

              <MetricCard
                label="Withdrawn"
                value={metrics.withdrawn}
                icon={ArrowLeft}
                description="Applications withdrawn"
              />
            </div>

            {/* Filters */}
            <div className="mt-7 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search applicants, properties, phone numbers..."
                    className="h-11 w-full rounded-xl border border-white/[0.07] bg-[#080909] pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-[#d6a84f]/40"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-11 rounded-xl border border-white/[0.07] bg-[#080909] px-4 text-sm text-zinc-300 outline-none focus:border-[#d6a84f]/40"
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>

                <select
                  value={verificationFilter}
                  onChange={(event) => setVerificationFilter(event.target.value)}
                  className="h-11 rounded-xl border border-white/[0.07] bg-[#080909] px-4 text-sm text-zinc-300 outline-none focus:border-[#d6a84f]/40"
                >
                  <option value="all">All verification levels</option>
                  <option value="email only">Email only</option>
                  <option value="verified">Verified</option>
                  <option value="fully verified">Fully verified</option>
                </select>
              </div>
            </div>

            {/* Main table */}
            <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025]">
              <div className="border-b border-white/[0.07] px-5 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-medium text-white">Applicant pipeline</h2>
                    <p className="mt-1 text-xs text-zinc-600">
                      {filteredApplicants.length} applicant
                      {filteredApplicants.length === 1 ? "" : "s"} shown
                    </p>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="flex min-h-[300px] items-center justify-center">
                  <div className="flex items-center gap-3 text-sm text-zinc-500">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-[#d6a84f]" />
                    Loading applicants...
                  </div>
                </div>
              ) : filteredApplicants.length === 0 ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                    <Users className="h-7 w-7 text-zinc-600" />
                  </div>

                  <h3 className="mt-4 font-medium text-white">No applicants found</h3>

                  <p className="mt-2 max-w-md text-sm text-zinc-600">
                    Applications submitted against your properties will appear here for review.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[950px]">
                    <thead>
                      <tr className="border-b border-white/[0.06] text-left">
                        <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-600">
                          Applicant
                        </th>
                        <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-600">
                          Property
                        </th>
                        <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-600">
                          Trust
                        </th>
                        <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-600">
                          Verification
                        </th>
                        <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-600">
                          Applied
                        </th>
                        <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-600">
                          Status
                        </th>
                        <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-600">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredApplicants.map((applicant) => {
                        const tenant = applicant.tenant;
                        const property = applicant.property;

                        return (
                          <tr
                            key={applicant.request.id}
                            className="border-b border-white/[0.05] transition hover:bg-white/[0.025]"
                          >
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04]">
                                  <User className="h-4 w-4 text-zinc-500" />
                                </div>

                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-white">
                                    {tenant?.full_name || "Unnamed tenant"}
                                  </p>
                                  <p className="mt-0.5 truncate text-xs text-zinc-600">
                                    {tenant?.phone || "No phone provided"}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 shrink-0 text-zinc-600" />

                                <div className="min-w-0">
                                  <p className="max-w-[210px] truncate text-sm text-zinc-300">
                                    {property?.title || "Property unavailable"}
                                  </p>
                                  <p className="mt-0.5 text-xs text-zinc-600">
                                    {property ? `${property.suburb}, ${property.city}` : "—"}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <TrustBadge score={tenant?.trust_score} />
                            </td>

                            <td className="px-5 py-4">
                              <span className="text-xs capitalize text-zinc-400">
                                {tenant?.verification || "Email only"}
                              </span>
                            </td>

                            <td className="px-5 py-4 text-sm text-zinc-500">
                              {formatDate(applicant.request.created_at)}
                            </td>

                            <td className="px-5 py-4">
                              <StatusBadge status={applicant.request.status} />
                            </td>

                            <td className="px-5 py-4 text-right">
                              <button
                                onClick={() => openApplicant(applicant)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-[#d6a84f]/20 hover:bg-[#d6a84f]/[0.06] hover:text-[#e2bb68]"
                              >
                                Review
                                <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </main>
        </div>

        {/* Applicant detail drawer */}
        {selectedApplicant && (
          <div className="fixed inset-0 z-50">
            <button
              aria-label="Close applicant details"
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={closeApplicant}
            />

            <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col border-l border-white/[0.07] bg-[#080909] shadow-2xl">
              {/* Drawer header */}
              <div className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-6 py-5">
                <div className="flex items-center gap-3">
                  <button
                    onClick={closeApplicant}
                    className="rounded-lg p-2 text-zinc-500 transition hover:bg-white/[0.05] hover:text-white"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>

                  <div>
                    <p className="text-xs uppercase tracking-wider text-[#d6a84f]">
                      Applicant review
                    </p>

                    <h2 className="mt-1 text-lg font-semibold text-white">
                      {selectedApplicant.tenant?.full_name || "Unnamed tenant"}
                    </h2>
                  </div>
                </div>

                <button
                  onClick={closeApplicant}
                  className="rounded-lg p-2 text-zinc-500 transition hover:bg-white/[0.05] hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer body */}
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="space-y-5 p-6">
                  {/* Profile */}
                  <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#d6a84f]/15 bg-[#d6a84f]/[0.08]">
                          <User className="h-6 w-6 text-[#d6a84f]" />
                        </div>

                        <div>
                          <h3 className="font-semibold text-white">
                            {selectedApplicant.tenant?.full_name || "Unnamed tenant"}
                          </h3>

                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-600">
                            {selectedApplicant.tenant?.phone && (
                              <span className="flex items-center gap-1.5">
                                <Phone className="h-3.5 w-3.5" />
                                {selectedApplicant.tenant.phone}
                              </span>
                            )}

                            <span className="flex items-center gap-1.5">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              {selectedApplicant.tenant?.verification || "Email only"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <TrustBadge score={selectedApplicant.tenant?.trust_score} />
                    </div>

                    {selectedApplicant.tenant?.bio && (
                      <div className="mt-5 border-t border-white/[0.06] pt-4">
                        <p className="text-xs uppercase tracking-wider text-zinc-600">Profile</p>
                        <p className="mt-2 text-sm leading-6 text-zinc-400">
                          {selectedApplicant.tenant.bio}
                        </p>
                      </div>
                    )}
                  </section>

                  {/* Current application */}
                  <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[#d6a84f]" />
                        <h3 className="font-medium text-white">Current application</h3>
                      </div>

                      <StatusBadge status={selectedApplicant.request.status} />
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-zinc-600">Property</p>
                        <p className="mt-1 text-sm text-zinc-300">
                          {selectedApplicant.property?.title || "—"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-zinc-600">Monthly rent</p>
                        <p className="mt-1 text-sm text-zinc-300">
                          {formatCurrency(selectedApplicant.property?.rent_usd)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-zinc-600">Move-in date</p>
                        <p className="mt-1 text-sm text-zinc-300">
                          {formatDate(selectedApplicant.request.move_in)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-zinc-600">Applied</p>
                        <p className="mt-1 text-sm text-zinc-300">
                          {formatDate(selectedApplicant.request.created_at)}
                        </p>
                      </div>
                    </div>

                    {selectedApplicant.property && (
                      <div className="mt-5 rounded-xl border border-white/[0.06] bg-[#080909] p-4">
                        <div className="flex items-start gap-3">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#d6a84f]" />

                          <div>
                            <p className="text-sm font-medium text-white">
                              {selectedApplicant.property.suburb}, {selectedApplicant.property.city}
                            </p>

                            <p className="mt-1 text-xs text-zinc-600">
                              {selectedApplicant.property.beds} beds ·{" "}
                              {selectedApplicant.property.baths} baths ·{" "}
                              {selectedApplicant.property.property_type}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedApplicant.request.message && (
                      <div className="mt-5">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-zinc-600" />
                          <p className="text-xs uppercase tracking-wider text-zinc-600">
                            Tenant message
                          </p>
                        </div>

                        <div className="mt-2 rounded-xl border border-white/[0.06] bg-[#080909] p-4">
                          <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-400">
                            {selectedApplicant.request.message}
                          </p>
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Rental history */}
                  <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-[#d6a84f]" />
                      <div>
                        <h3 className="font-medium text-white">Previous rental history</h3>
                        <p className="mt-1 text-xs text-zinc-600">
                          Historical leases recorded on TNP
                        </p>
                      </div>
                    </div>

                    {historyLeasesQuery.isLoading ? (
                      <div className="mt-5 flex items-center gap-2 text-sm text-zinc-600">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-[#d6a84f]" />
                        Loading rental history...
                      </div>
                    ) : historicalLeases.length === 0 ? (
                      <div className="mt-5 rounded-xl border border-white/[0.06] bg-[#080909] p-5 text-center">
                        <History className="mx-auto h-5 w-5 text-zinc-700" />
                        <p className="mt-2 text-sm text-zinc-500">No previous leases found.</p>
                        <p className="mt-1 text-xs text-zinc-700">
                          This applicant may have no completed rental history recorded in TNP.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-5 space-y-3">
                        {historicalLeases.map((lease) => {
                          const property = historicalPropertyMap.get(lease.property_id);
                          const landlord = historicalLandlordMap.get(lease.landlord_id);

                          return (
                            <div
                              key={lease.id}
                              className="rounded-xl border border-white/[0.06] bg-[#080909] p-4"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-white">
                                    {property?.title || "Previous property"}
                                  </p>

                                  <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-600">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {property
                                      ? `${property.suburb}, ${property.city}`
                                      : "Property details unavailable"}
                                  </p>
                                </div>

                                <span className="shrink-0 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-400">
                                  {lease.status || "Unknown"}
                                </span>
                              </div>

                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div>
                                  <p className="text-xs text-zinc-600">Rent</p>
                                  <p className="mt-1 text-sm text-zinc-300">
                                    {formatCurrency(lease.rent_usd)}
                                  </p>
                                </div>

                                <div>
                                  <p className="text-xs text-zinc-600">Deposit</p>
                                  <p className="mt-1 text-sm text-zinc-300">
                                    {formatCurrency(lease.deposit_usd)}
                                  </p>
                                </div>

                                <div>
                                  <p className="text-xs text-zinc-600">Start</p>
                                  <p className="mt-1 text-sm text-zinc-300">
                                    {formatDate(lease.start_date)}
                                  </p>
                                </div>

                                <div>
                                  <p className="text-xs text-zinc-600">End</p>
                                  <p className="mt-1 text-sm text-zinc-300">
                                    {formatDate(lease.end_date)}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-4 border-t border-white/[0.06] pt-4">
                                <p className="text-xs text-zinc-600">Previous landlord</p>

                                <div className="mt-2 flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.03]">
                                      <User className="h-3.5 w-3.5 text-zinc-600" />
                                    </div>

                                    <div>
                                      <p className="text-sm text-zinc-300">
                                        {landlord?.full_name || "Landlord profile unavailable"}
                                      </p>

                                      {landlord?.phone && (
                                        <p className="mt-0.5 text-xs text-zinc-600">
                                          {landlord.phone}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {landlord?.trust_score !== null &&
                                    landlord?.trust_score !== undefined && (
                                      <TrustBadge score={landlord.trust_score} />
                                    )}
                                </div>
                              </div>

                              {lease.signed_at && (
                                <div className="mt-4 flex items-center gap-2 text-xs text-zinc-600">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/70" />
                                  Signed {formatDate(lease.signed_at)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {/* Timeline */}
                  <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-[#d6a84f]" />
                      <h3 className="font-medium text-white">Application timeline</h3>
                    </div>

                    <div className="mt-5 space-y-4">
                      <div className="flex gap-3">
                        <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#d6a84f]" />

                        <div>
                          <p className="text-sm text-zinc-300">Application submitted</p>
                          <p className="mt-1 text-xs text-zinc-600">
                            {formatDate(selectedApplicant.request.created_at)}
                          </p>
                        </div>
                      </div>

                      {selectedApplicant.request.updated_at && (
                        <div className="flex gap-3">
                          <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />

                          <div>
                            <p className="text-sm text-zinc-300">Application reviewed</p>
                            <p className="mt-1 text-xs text-zinc-600">
                              {formatDate(selectedApplicant.request.updated_at)}
                            </p>
                          </div>
                        </div>
                      )}

                      {selectedApplicant.request.updated_at && (
                        <div className="flex gap-3">
                          <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#d6a84f]" />

                          <div>
                            <p className="text-sm text-zinc-300">Decision recorded</p>
                            <p className="mt-1 text-xs text-zinc-600">
                              {formatDate(selectedApplicant.request.updated_at)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Landlord response */}
                  <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-[#d6a84f]" />
                      <div>
                        <h3 className="font-medium text-white">Landlord response</h3>
                        <p className="mt-1 text-xs text-zinc-600">Message visible to the tenant</p>
                      </div>
                    </div>

                    <textarea
                      value={responseText}
                      onChange={(event) => setResponseText(event.target.value)}
                      rows={5}
                      placeholder="Write a response to the applicant..."
                      className="mt-4 w-full resize-none rounded-xl border border-white/[0.07] bg-[#080909] p-4 text-sm leading-6 text-white outline-none placeholder:text-zinc-700 focus:border-[#d6a84f]/40"
                    />

                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={saveResponse}
                        disabled={actionLoading}
                        className="rounded-lg border border-white/[0.07] bg-white/[0.04] px-4 py-2 text-xs font-medium text-zinc-300 transition hover:border-[#d6a84f]/20 hover:bg-[#d6a84f]/[0.06] hover:text-[#e2bb68] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {actionLoading ? "Saving..." : "Save response"}
                      </button>
                    </div>
                  </section>

                  {/* Existing rejection reason */}
                  {selectedApplicant.request.rejection_reason && (
                    <section className="rounded-2xl border border-red-400/10 bg-red-400/[0.03] p-5">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-400" />
                        <h3 className="font-medium text-red-300">Rejection reason</h3>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-zinc-400">
                        {selectedApplicant.request.rejection_reason}
                      </p>
                    </section>
                  )}
                </div>
              </div>

              {/* Decision footer */}
              {isPending(selectedApplicant.request.status) && (
                <div className="shrink-0 border-t border-white/[0.07] bg-[#080909] p-5">
                  {errorMessage && (
                    <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-400/15 bg-red-400/[0.05] p-3 text-sm text-red-300">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowRejectModal(true)}
                      disabled={actionLoading}
                      className="flex-1 rounded-xl border border-red-400/15 bg-red-400/[0.05] px-4 py-3 text-sm font-medium text-red-300 transition hover:bg-red-400/[0.09] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <XCircle className="h-4 w-4" />
                        Decline
                      </span>
                    </button>

                    <button
                      onClick={acceptApplicant}
                      disabled={actionLoading}
                      className="flex-1 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-4 py-3 text-sm font-medium text-emerald-300 transition hover:bg-emerald-400/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        {actionLoading ? "Processing..." : "Accept applicant"}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}

        {/* Decline modal */}
        {showRejectModal && selectedApplicant && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#080909] shadow-2xl">
              <div className="flex items-start justify-between border-b border-white/[0.07] px-6 py-5">
                <div>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-400" />
                    <h3 className="font-semibold text-white">Decline applicant</h3>
                  </div>

                  <p className="mt-2 text-sm text-zinc-600">
                    A reason is required and will be recorded with the application.
                  </p>
                </div>

                <button
                  onClick={() => setShowRejectModal(false)}
                  className="rounded-lg p-2 text-zinc-600 hover:bg-white/[0.05] hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6">
                <label className="text-xs font-medium uppercase tracking-wider text-zinc-600">
                  Rejection reason
                </label>

                <textarea
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  rows={5}
                  autoFocus
                  placeholder="Provide a clear reason for declining this application..."
                  className="mt-3 w-full resize-none rounded-xl border border-white/[0.07] bg-[#080909] p-4 text-sm leading-6 text-white outline-none placeholder:text-zinc-700 focus:border-red-400/30"
                />

                {errorMessage && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-400/15 bg-red-400/[0.05] p-3 text-sm text-red-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 border-t border-white/[0.07] px-6 py-5">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectionReason("");
                    setErrorMessage(null);
                  }}
                  disabled={actionLoading}
                  className="flex-1 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-sm font-medium text-zinc-400 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  onClick={declineApplicant}
                  disabled={actionLoading || !rejectionReason.trim()}
                  className="flex-1 rounded-xl border border-red-400/15 bg-red-400/[0.07] px-4 py-3 text-sm font-medium text-red-300 transition hover:bg-red-400/[0.11] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {actionLoading ? "Declining..." : "Confirm decline"}
                </button>
              </div>
            </div>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
