import { matchesSearch as matchWorkspaceSearch } from '@/lib/workspace-search';
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
  User,
  Users,
  Wallet,
  X,
  XCircle,
} from "lucide-react";

import { RoleSidebar } from "@/components/dashboard/RoleSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/landlord/trust-profiles")({
  component: LandlordTrustProfiles,
});

type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  bio: string | null;
  verification: string;
  trust_score: number;
  created_at: string;
  updated_at: string;
};

type Property = {
  id: string;
  title: string;
  suburb: string;
  city: string;
  rent_usd: number;
  deposit_usd: number;
  beds: number;
  baths: number;
  property_type: string;
  image_url: string | null;
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
  created_at: string;
  updated_at: string;
};

type LeaseRequest = {
  id: string;
  property_id: string;
  tenant_id: string;
  move_in: string | null;
  message: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  decision_at: string | null;
  rejection_reason: string | null;
  landlord_message: string | null;
  lease_id: string | null;
  withdrawn_at: string | null;
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
  moderation_status: string;
  landlord_response: string | null;
  landlord_responded_at: string | null;
};

type Payment = {
  id: string;
  lease_id: string;
  payer_id: string;
  payee_id: string | null;
  payment_type: string;
  amount_usd: number;
  status: string;
  reference: string | null;
  paid_at: string | null;
  released_at: string | null;
  created_at: string;
};

type Dispute = {
  id: string;
  lease_id: string | null;
  property_id: string | null;
  opened_by: string;
  against_user: string | null;
  category: string;
  priority: string;
  status: string;
  title: string;
  description: string;
  created_at: string;
  resolved_at: string | null;
};

type UserRole = {
  user_id: string;
  role: string;
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (value: string | null) => {
  if (!value) return "Not recorded";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
};

const statusClass = (status: string) => {
  const value = status.toLowerCase();

  if (
    value.includes("approved") ||
    value.includes("active") ||
    value.includes("completed") ||
    value.includes("paid") ||
    value.includes("resolved")
  ) {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
  }

  if (value.includes("pending") || value.includes("draft") || value.includes("review")) {
    return "border-amber-400/20 bg-amber-400/10 text-amber-300";
  }

  if (
    value.includes("rejected") ||
    value.includes("declined") ||
    value.includes("failed") ||
    value.includes("open")
  ) {
    return "border-red-400/20 bg-red-400/10 text-red-300";
  }

  return "border-white/[0.08] bg-white/[0.035] text-zinc-300";
};

const verificationClass = (verification: string) => {
  const value = verification.toLowerCase();

  if (value.includes("verified") && !value.includes("email only")) {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
  }

  return "border-amber-400/20 bg-amber-400/10 text-amber-300";
};

function LandlordTrustProfiles() {
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("All");
  const [trustFilter, setTrustFilter] = useState("All");

  const landlordQuery = useQuery({
    queryKey: ["landlord-trust-profiles-current-user"],
    queryFn: async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) throw error;
      return user;
    },
  });

  const landlordId = landlordQuery.data?.id ?? null;

  const propertiesQuery = useQuery({
    queryKey: ["landlord-trust-profiles-properties", landlordId],
    enabled: !!landlordId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select(
          `
            id,
            title,
            suburb,
            city,
            rent_usd,
            deposit_usd,
            beds,
            baths,
            property_type,
            image_url
          `,
        )
        .eq("owner_id", landlordId!)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []) as Property[];
    },
  });

  const propertyIds = useMemo(
    () => (propertiesQuery.data ?? []).map((property) => property.id),
    [propertiesQuery.data],
  );

  const requestsQuery = useQuery({
    queryKey: ["landlord-trust-profiles-requests", propertyIds],
    enabled: propertyIds.length > 0,
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
            decision_at,
            rejection_reason,
            landlord_message,
            lease_id,
            withdrawn_at
          `,
        )
        .in("property_id", propertyIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []) as unknown as LeaseRequest[];
    },
  });

  const tenantIds = useMemo(
    () => Array.from(new Set((requestsQuery.data ?? []).map((request) => request.tenant_id))),
    [requestsQuery.data],
  );

  const profilesQuery = useQuery({
    queryKey: ["landlord-trust-profiles-tenants", tenantIds],
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
            trust_score,
            created_at,
            updated_at
          `,
        )
        .in("id", tenantIds);

      if (error) throw error;

      return (data ?? []) as Profile[];
    },
  });

  // Every profile here comes from a tenant application to this landlord's properties.
  const rolesQuery = { data: tenantIds.map(user_id => ({user_id, role: 'tenant'})) };

  const leasesQuery = useQuery({
    queryKey: ["landlord-trust-profiles-leases", tenantIds],
    enabled: tenantIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leases" as never)
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
            created_at,
            updated_at
          `,
        )
        .in("tenant_id", tenantIds)
        .order("start_date", { ascending: false });

      if (error) throw error;

      return (data ?? []) as unknown as Lease[];
    },
  });

  const reviewsQuery = useQuery({
    queryKey: ["landlord-trust-profiles-reviews", tenantIds],
    enabled: tenantIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select(
          `
            id,
            author_id,
            subject_id,
            property_id,
            rating,
            body,
            lease_confirmed,
            created_at,
            landlord_response,
            landlord_responded_at
          `,
        )
        .in("subject_id", tenantIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []) as unknown as Review[];
    },
  });

  const filteredProfiles = useMemo(() => {
    const profiles = profilesQuery.data ?? [];
    const roles = rolesQuery.data ?? [];

    return profiles.filter((profile) => {
      const role = roles.find((item) => item.user_id === profile.id);

      const searchMatch = matchWorkspaceSearch(search, profile.full_name, profile.phone);

      const verificationMatch =
        verificationFilter === "All" || profile.verification === verificationFilter;

      const trustMatch =
        trustFilter === "All" ||
        (trustFilter === "High" && profile.trust_score >= 70) ||
        (trustFilter === "Medium" && profile.trust_score >= 40 && profile.trust_score < 70) ||
        (trustFilter === "Low" && profile.trust_score < 40);

      return searchMatch && verificationMatch && trustMatch && (!role || role.role === "tenant");
    });
  }, [profilesQuery.data, rolesQuery.data, search, verificationFilter, trustFilter]);

  const selectedProfile = useMemo(
    () => (profilesQuery.data ?? []).find((profile) => profile.id === selectedTenantId) ?? null,
    [profilesQuery.data, selectedTenantId],
  );

  const selectedRequests = useMemo(
    () => (requestsQuery.data ?? []).filter((request) => request.tenant_id === selectedTenantId),
    [requestsQuery.data, selectedTenantId],
  );

  const selectedLeases = useMemo(
    () => (leasesQuery.data ?? []).filter((lease) => lease.tenant_id === selectedTenantId),
    [leasesQuery.data, selectedTenantId],
  );

  const selectedReviews = useMemo(
    () => (reviewsQuery.data ?? []).filter((review) => review.subject_id === selectedTenantId),
    [reviewsQuery.data, selectedTenantId],
  );

  const selectedLeaseIds = useMemo(() => selectedLeases.map((lease) => lease.id), [selectedLeases]);

  const selectedPaymentsQuery = useQuery({
    queryKey: ["trust-profile-payments", selectedTenantId, selectedLeaseIds],
    enabled: selectedLeaseIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lease_payments" as never)
        .select(
          `
            id,
            lease_id,
            payer_id,
            payee_id,
            payment_type,
            amount_usd,
            status,
            reference,
            paid_at,
            released_at,
            created_at
          `,
        )
        .in("lease_id", selectedLeaseIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []) as unknown as Payment[];
    },
  });

  const selectedDisputesQuery = useQuery({
    queryKey: ["trust-profile-disputes", selectedTenantId, selectedLeaseIds],
    enabled: !!selectedTenantId,
    queryFn: async () => {
      const leaseIds = selectedLeaseIds;

      if (leaseIds.length === 0) {
        return [] as Dispute[];
      }

      const { data, error } = await supabase
        .from("disputes" as never)
        .select(
          `
            id,
            lease_id,
            property_id,
            opened_by,
            against_user,
            category,
            priority,
            status,
            title,
            description,
            created_at,
            resolved_at
          `,
        )
        .in("lease_id", leaseIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []) as unknown as Dispute[];
    },
  });

  const historicalPropertyIds = useMemo(
    () => Array.from(new Set(selectedLeases.map((lease) => lease.property_id))),
    [selectedLeases],
  );

  const historicalPropertiesQuery = useQuery({
    queryKey: ["trust-profile-historical-properties", historicalPropertyIds],
    enabled: historicalPropertyIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select(
          `
            id,
            title,
            suburb,
            city,
            rent_usd,
            deposit_usd,
            beds,
            baths,
            property_type,
            image_url
          `,
        )
        .in("id", historicalPropertyIds);

      if (error) throw error;

      return (data ?? []) as Property[];
    },
  });

  const previousLandlordIds = useMemo(
    () =>
      Array.from(
        new Set(selectedLeases.map((lease) => lease.landlord_id).filter((id) => id !== landlordId)),
      ),
    [selectedLeases, landlordId],
  );

  const previousLandlordsQuery = useQuery({
    queryKey: ["trust-profile-previous-landlords", previousLandlordIds],
    enabled: previousLandlordIds.length > 0,
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
            trust_score,
            created_at,
            updated_at
          `,
        )
        .in("id", previousLandlordIds);

      if (error) throw error;

      return (data ?? []) as Profile[];
    },
  });

  const totalProfiles = profilesQuery.data?.length ?? 0;
  const highTrust = profilesQuery.data?.filter((profile) => profile.trust_score >= 70).length ?? 0;
  const verified =
    profilesQuery.data?.filter((profile) => profile.verification.toLowerCase() !== "email only")
      .length ?? 0;
  const reviewProfiles =
    profilesQuery.data?.filter((profile) =>
      (reviewsQuery.data ?? []).some((review) => review.subject_id === profile.id),
    ).length ?? 0;

  const averageTrust = profilesQuery.data?.length
    ? Math.round(
        profilesQuery.data.reduce((sum, profile) => sum + profile.trust_score, 0) /
          profilesQuery.data.length,
      )
    : 0;

  if (selectedProfile) {
    return (
      <SidebarProvider>
        <RoleSidebar role="landlord" />

        <SidebarInset className="tnp-module tnp-module-dark min-h-screen bg-[#080909] text-white">
          <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/[0.07] bg-[#080909]/95 px-6 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-zinc-400 hover:bg-white/[0.05] hover:text-white" />

              <button
                onClick={() => setSelectedTenantId(null)}
                className="flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
              >
                <ArrowLeft size={16} />
                Trust Profiles
              </button>

              <ChevronRight size={15} className="text-zinc-700" />

              <span className="text-sm font-medium text-white">
                {selectedProfile.full_name || "Tenant Profile"}
              </span>
            </div>
          </div>

          <main className="p-6">
            <div className="mx-auto max-w-7xl space-y-6">
              <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025]">
                <div className="relative border-b border-white/[0.07] p-6">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#d6a84f]/20 bg-[#d6a84f]/10 text-[#d6a84f]">
                        <User size={30} />
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h1 className="text-2xl font-semibold text-white">
                            {selectedProfile.full_name || "Unnamed Tenant"}
                          </h1>

                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${verificationClass(
                              selectedProfile.verification,
                            )}`}
                          >
                            {selectedProfile.verification}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-4 text-sm text-zinc-500">
                          {selectedProfile.phone && (
                            <span className="flex items-center gap-1.5">
                              <Phone size={14} />
                              {selectedProfile.phone}
                            </span>
                          )}

                          <span className="flex items-center gap-1.5">
                            <CalendarDays size={14} />
                            Joined {formatDate(selectedProfile.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#d6a84f]/20 bg-[#d6a84f]/[0.06] px-5 py-4">
                      <p className="text-xs uppercase tracking-wider text-zinc-500">Trust Score</p>

                      <div className="mt-1 flex items-end gap-2">
                        <span className="text-3xl font-semibold text-white">
                          {selectedProfile.trust_score}
                        </span>
                        <span className="mb-1 text-sm text-zinc-500">/ 100</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-px bg-white/[0.07] md:grid-cols-4">
                  <MetricBox
                    icon={<History size={17} />}
                    label="Previous leases"
                    value={selectedLeases.length}
                  />

                  <MetricBox
                    icon={<FileText size={17} />}
                    label="Applications"
                    value={selectedRequests.length}
                  />

                  <MetricBox
                    icon={<MessageSquare size={17} />}
                    label="Reviews"
                    value={selectedReviews.length}
                  />

                  <MetricBox
                    icon={<AlertCircle size={17} />}
                    label="Disputes"
                    value={selectedDisputesQuery.data?.length ?? 0}
                  />
                </div>
              </section>

              <div className="grid gap-6 lg:grid-cols-3">
                <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 lg:col-span-2">
                  <SectionHeader icon={<User size={17} />} title="Profile & Verification" />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <InfoItem
                      label="Full name"
                      value={selectedProfile.full_name || "Not provided"}
                    />

                    <InfoItem label="Phone" value={selectedProfile.phone || "Not provided"} />

                    <InfoItem label="Verification" value={selectedProfile.verification} />

                    <InfoItem
                      label="Account created"
                      value={formatDate(selectedProfile.created_at)}
                    />
                  </div>

                  {selectedProfile.bio && (
                    <div className="mt-5 border-t border-white/[0.07] pt-5">
                      <p className="mb-2 text-xs uppercase tracking-wider text-zinc-600">Bio</p>
                      <p className="text-sm leading-6 text-zinc-400">{selectedProfile.bio}</p>
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                  <SectionHeader icon={<ShieldCheck size={17} />} title="Trust Indicators" />

                  <div className="space-y-4">
                    <TrustIndicator
                      label="Trust score"
                      value={`${selectedProfile.trust_score}/100`}
                      good={selectedProfile.trust_score >= 70}
                    />

                    <TrustIndicator
                      label="Verification"
                      value={selectedProfile.verification}
                      good={selectedProfile.verification.toLowerCase() !== "email only"}
                    />

                    <TrustIndicator
                      label="Completed leases"
                      value={String(
                        selectedLeases.filter((lease) =>
                          ["active", "completed", "closed"].includes(lease.status.toLowerCase()),
                        ).length,
                      )}
                      good={selectedLeases.length > 0}
                    />

                    <TrustIndicator
                      label="Verified reviews"
                      value={String(
                        selectedReviews.filter((review) => review.lease_confirmed).length,
                      )}
                      good={selectedReviews.some((review) => review.lease_confirmed)}
                    />
                  </div>
                </section>
              </div>

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                <SectionHeader
                  icon={<History size={17} />}
                  title="Rental History"
                  subtitle="Previous and current leases recorded on TNP"
                />

                {selectedLeases.length === 0 ? (
                  <EmptyState
                    icon={<History size={20} />}
                    text="No previous lease history is recorded."
                  />
                ) : (
                  <div className="space-y-3">
                    {selectedLeases.map((lease) => {
                      const property = historicalPropertiesQuery.data?.find(
                        (item) => item.id === lease.property_id,
                      );

                      return (
                        <div
                          key={lease.id}
                          className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"
                        >
                          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <Building2 size={16} className="text-[#d6a84f]" />
                                <p className="font-medium text-white">
                                  {property?.title || "Property record unavailable"}
                                </p>

                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[10px] ${statusClass(
                                    lease.status,
                                  )}`}
                                >
                                  {lease.status}
                                </span>
                              </div>

                              <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-500">
                                <span>
                                  {property
                                    ? `${property.suburb}, ${property.city}`
                                    : "Location unavailable"}
                                </span>

                                <span>
                                  {formatDate(lease.start_date)} — {formatDate(lease.end_date)}
                                </span>
                              </div>
                            </div>

                            <div className="text-left md:text-right">
                              <p className="text-sm font-medium text-white">
                                {formatMoney(Number(lease.rent_usd))}/month
                              </p>

                              <p className="mt-1 text-xs text-zinc-600">
                                Deposit {formatMoney(Number(lease.deposit_usd))}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                <SectionHeader
                  icon={<Users size={17} />}
                  title="Previous Landlords"
                  subtitle="Landlords connected through recorded leases"
                />

                {previousLandlordsQuery.data?.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {previousLandlordsQuery.data.map((landlord) => {
                      const leaseCount = selectedLeases.filter(
                        (lease) => lease.landlord_id === landlord.id,
                      ).length;

                      return (
                        <div
                          key={landlord.id}
                          className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-white">
                                {landlord.full_name || "Unnamed landlord"}
                              </p>

                              <p className="mt-1 text-xs text-zinc-600">
                                {leaseCount} recorded lease
                                {leaseCount === 1 ? "" : "s"}
                              </p>
                            </div>

                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] text-zinc-400">
                              <User size={17} />
                            </div>
                          </div>

                          <div className="mt-4 flex items-center justify-between">
                            <span
                              className={`rounded-full border px-2 py-1 text-[10px] ${verificationClass(
                                landlord.verification,
                              )}`}
                            >
                              {landlord.verification}
                            </span>

                            <span className="text-xs text-zinc-500">
                              Trust {landlord.trust_score}/100
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Users size={20} />}
                    text="No previous landlord records are available."
                  />
                )}
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                <SectionHeader
                  icon={<MessageSquare size={17} />}
                  title="Verified Reviews"
                  subtitle="Reviews where TNP records the lease relationship"
                />

                {selectedReviews.length === 0 ? (
                  <EmptyState
                    icon={<MessageSquare size={20} />}
                    text="No reviews have been recorded for this tenant."
                  />
                ) : (
                  <div className="space-y-3">
                    {selectedReviews.map((review) => (
                      <div
                        key={review.id}
                        className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex gap-0.5">
                              {Array.from({ length: 5 }).map((_, index) => (
                                <span
                                  key={index}
                                  className={
                                    index < review.rating ? "text-[#d6a84f]" : "text-zinc-700"
                                  }
                                >
                                  ★
                                </span>
                              ))}
                            </div>

                            {review.lease_confirmed && (
                              <span className="flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-300">
                                <CheckCircle2 size={11} />
                                Lease confirmed
                              </span>
                            )}
                          </div>

                          <span
                            className={`rounded-full border px-2 py-1 text-[10px] ${statusClass(
                              review.moderation_status,
                            )}`}
                          >
                            {review.moderation_status}
                          </span>
                        </div>

                        <p className="mt-3 text-sm leading-6 text-zinc-400">{review.body}</p>

                        <p className="mt-3 text-xs text-zinc-600">
                          {formatDate(review.created_at)}
                        </p>

                        {review.landlord_response && (
                          <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                            <p className="text-[11px] uppercase tracking-wider text-zinc-600">
                              Landlord response
                            </p>
                            <p className="mt-1 text-sm text-zinc-400">{review.landlord_response}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                <SectionHeader
                  icon={<Wallet size={17} />}
                  title="Lease Payment History"
                  subtitle="Payments connected to recorded leases"
                />

                {selectedPaymentsQuery.data?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                      <thead>
                        <tr className="border-b border-white/[0.07] text-left">
                          <th className="pb-3 text-xs font-medium text-zinc-600">Type</th>
                          <th className="pb-3 text-xs font-medium text-zinc-600">Amount</th>
                          <th className="pb-3 text-xs font-medium text-zinc-600">Status</th>
                          <th className="pb-3 text-xs font-medium text-zinc-600">Paid</th>
                          <th className="pb-3 text-xs font-medium text-zinc-600">Reference</th>
                        </tr>
                      </thead>

                      <tbody>
                        {selectedPaymentsQuery.data.map((payment) => (
                          <tr
                            key={payment.id}
                            className="border-b border-white/[0.05] last:border-0"
                          >
                            <td className="py-3 text-sm text-white">{payment.payment_type}</td>
                            <td className="py-3 text-sm text-zinc-300">
                              {formatMoney(Number(payment.amount_usd))}
                            </td>
                            <td className="py-3">
                              <span
                                className={`rounded-full border px-2 py-1 text-[10px] ${statusClass(
                                  payment.status,
                                )}`}
                              >
                                {payment.status}
                              </span>
                            </td>
                            <td className="py-3 text-sm text-zinc-500">
                              {formatDate(payment.paid_at)}
                            </td>
                            <td className="py-3 text-sm text-zinc-600">
                              {payment.reference || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    icon={<Wallet size={20} />}
                    text="No payment records are available for this tenant's leases."
                  />
                )}
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                <SectionHeader
                  icon={<AlertCircle size={17} />}
                  title="Lease Disputes"
                  subtitle="Disputes linked to this tenant's recorded leases"
                />

                {selectedDisputesQuery.data?.length ? (
                  <div className="space-y-3">
                    {selectedDisputesQuery.data.map((dispute) => (
                      <div
                        key={dispute.id}
                        className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="font-medium text-white">{dispute.title}</p>
                            <p className="mt-1 text-sm text-zinc-500">{dispute.category}</p>
                          </div>

                          <div className="flex gap-2">
                            <span
                              className={`rounded-full border px-2 py-1 text-[10px] ${statusClass(
                                dispute.priority,
                              )}`}
                            >
                              {dispute.priority}
                            </span>

                            <span
                              className={`rounded-full border px-2 py-1 text-[10px] ${statusClass(
                                dispute.status,
                              )}`}
                            >
                              {dispute.status}
                            </span>
                          </div>
                        </div>

                        <p className="mt-3 text-sm leading-6 text-zinc-500">
                          {dispute.description}
                        </p>

                        <div className="mt-3 text-xs text-zinc-600">
                          Opened {formatDate(dispute.created_at)}
                          {dispute.resolved_at
                            ? ` · Resolved ${formatDate(dispute.resolved_at)}`
                            : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<CheckCircle2 size={20} />}
                    text="No lease disputes are recorded for this tenant."
                  />
                )}
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                <SectionHeader
                  icon={<FileText size={17} />}
                  title="Application History"
                  subtitle="Previous applications submitted to your properties"
                />

                {selectedRequests.length === 0 ? (
                  <EmptyState
                    icon={<FileText size={20} />}
                    text="No application history is available."
                  />
                ) : (
                  <div className="space-y-3">
                    {selectedRequests.map((request) => {
                      const property =
                        propertiesQuery.data?.find((item) => item.id === request.property_id) ??
                        historicalPropertiesQuery.data?.find(
                          (item) => item.id === request.property_id,
                        );

                      return (
                        <div
                          key={request.id}
                          className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="font-medium text-white">
                                {property?.title || "Property record unavailable"}
                              </p>

                              <p className="mt-1 text-xs text-zinc-600">
                                Submitted {formatDate(request.created_at)}
                              </p>
                            </div>

                            <span
                              className={`rounded-full border px-2.5 py-1 text-[10px] ${statusClass(
                                request.status,
                              )}`}
                            >
                              {request.status}
                            </span>
                          </div>

                          {request.message && (
                            <p className="mt-3 text-sm leading-6 text-zinc-500">
                              {request.message}
                            </p>
                          )}

                          {request.rejection_reason && (
                            <div className="mt-3 rounded-lg border border-red-400/10 bg-red-400/[0.04] p-3">
                              <p className="text-[10px] uppercase tracking-wider text-red-300/70">
                                Rejection reason
                              </p>
                              <p className="mt-1 text-sm text-zinc-400">
                                {request.rejection_reason}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <RoleSidebar role="landlord" />

      <SidebarInset className="tnp-module tnp-module-dark min-h-screen bg-[#080909] text-white">
        <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/[0.07] bg-[#080909]/95 px-6 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="text-zinc-400 hover:bg-white/[0.05] hover:text-white" />

            <div>
              <p className="text-sm font-semibold text-white">Trust Profiles</p>
              <p className="text-xs text-zinc-600">Tenant trust and rental history</p>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-lg border border-[#d6a84f]/15 bg-[#d6a84f]/[0.04] px-3 py-2 text-xs text-zinc-400 sm:flex">
            <ShieldCheck size={14} className="text-[#d6a84f]" />
            Evidence-based tenant information
          </div>
        </div>

        <main className="p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-white">Trust Profiles</h1>
              <p className="mt-1 text-sm text-zinc-500">
                Review tenant verification, rental history, applications, reviews and lease records.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={<Users size={18} />} label="Tenant profiles" value={totalProfiles} />

              <StatCard
                icon={<ShieldCheck size={18} />}
                label="Verified profiles"
                value={verified}
              />

              <StatCard icon={<CheckCircle2 size={18} />} label="High trust" value={highTrust} />

              <StatCard
                icon={<MessageSquare size={18} />}
                label="With reviews"
                value={reviewProfiles}
                footer={`Average trust ${averageTrust}/100`}
              />
            </div>

            <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
              <div className="flex flex-col gap-3 lg:flex-row">
                <div className="relative flex-1">
                  <Search
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                  />

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search tenant name or phone..."
                    className="h-11 w-full rounded-xl border border-white/[0.07] bg-[#080909] pl-10 pr-4 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-[#d6a84f]/30"
                  />
                </div>

                <select
                  value={verificationFilter}
                  onChange={(event) => setVerificationFilter(event.target.value)}
                  className="h-11 rounded-xl border border-white/[0.07] bg-[#080909] px-4 text-sm text-zinc-300 outline-none focus:border-[#d6a84f]/30"
                >
                  <option value="All">All verification</option>

                  {Array.from(
                    new Set((profilesQuery.data ?? []).map((profile) => profile.verification)),
                  ).map((verification) => (
                    <option key={verification} value={verification}>
                      {verification}
                    </option>
                  ))}
                </select>

                <select
                  value={trustFilter}
                  onChange={(event) => setTrustFilter(event.target.value)}
                  className="h-11 rounded-xl border border-white/[0.07] bg-[#080909] px-4 text-sm text-zinc-300 outline-none focus:border-[#d6a84f]/30"
                >
                  <option value="All">All trust levels</option>
                  <option value="High">High · 70+</option>
                  <option value="Medium">Medium · 40–69</option>
                  <option value="Low">Low · below 40</option>
                </select>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025]">
              <div className="border-b border-white/[0.07] px-5 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">Tenant Trust Profiles</p>
                    <p className="mt-1 text-xs text-zinc-600">
                      {filteredProfiles.length} profile
                      {filteredProfiles.length === 1 ? "" : "s"} available
                    </p>
                  </div>
                </div>
              </div>

              {profilesQuery.isLoading ? (
                <LoadingState />
              ) : filteredProfiles.length === 0 ? (
                <EmptyState
                  icon={<Users size={22} />}
                  text={
                    search
                      ? "No tenant profiles match your search."
                      : "No tenant profiles are available yet."
                  }
                />
              ) : (
                <div className="divide-y divide-white/[0.05]">
                  {filteredProfiles.map((profile) => {
                    const leases = (leasesQuery.data ?? []).filter(
                      (lease) => lease.tenant_id === profile.id,
                    );

                    const requests = (requestsQuery.data ?? []).filter(
                      (request) => request.tenant_id === profile.id,
                    );

                    const reviews = (reviewsQuery.data ?? []).filter(
                      (review) => review.subject_id === profile.id,
                    );

                    return (
                      <button
                        key={profile.id}
                        onClick={() => setSelectedTenantId(profile.id)}
                        className="flex w-full flex-col gap-4 px-5 py-4 text-left transition hover:bg-white/[0.03] md:flex-row md:items-center md:justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-zinc-400">
                            <User size={18} />
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-white">
                                {profile.full_name || "Unnamed Tenant"}
                              </p>

                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] ${verificationClass(
                                  profile.verification,
                                )}`}
                              >
                                {profile.verification}
                              </span>
                            </div>

                            <div className="mt-1 flex flex-wrap gap-3 text-xs text-zinc-600">
                              {profile.phone && <span>{profile.phone}</span>}

                              <span>
                                {leases.length} lease
                                {leases.length === 1 ? "" : "s"}
                              </span>

                              <span>
                                {requests.length} application
                                {requests.length === 1 ? "" : "s"}
                              </span>

                              <span>
                                {reviews.length} review
                                {reviews.length === 1 ? "" : "s"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-5">
                          <div className="text-right">
                            <p className="text-[10px] uppercase tracking-wider text-zinc-700">
                              Trust
                            </p>

                            <p
                              className={`mt-1 text-lg font-semibold ${
                                profile.trust_score >= 70
                                  ? "text-emerald-300"
                                  : profile.trust_score >= 40
                                    ? "text-amber-300"
                                    : "text-red-300"
                              }`}
                            >
                              {profile.trust_score}
                            </p>
                          </div>

                          <ChevronRight size={18} className="text-zinc-700" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function StatCard({
  icon,
  label,
  value,
  footer,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  footer?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="flex items-center justify-between">
        <span className="text-zinc-500">{icon}</span>
        <span className="text-2xl font-semibold text-white">{value}</span>
      </div>

      <p className="mt-4 text-sm text-zinc-500">{label}</p>

      {footer && <p className="mt-1 text-[11px] text-zinc-700">{footer}</p>}
    </div>
  );
}

function MetricBox({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-[#080909] p-4">
      <div className="flex items-center gap-2 text-zinc-600">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="mt-0.5 text-[#d6a84f]">{icon}</div>

      <div>
        <h2 className="font-medium text-white">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-zinc-600">{subtitle}</p>}
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <p className="text-[10px] uppercase tracking-wider text-zinc-700">{label}</p>
      <p className="mt-1 text-sm text-zinc-300">{value}</p>
    </div>
  );
}

function TrustIndicator({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.05] pb-3 last:border-0 last:pb-0">
      <div className="flex items-center gap-2">
        {good ? (
          <CheckCircle2 size={15} className="text-emerald-400" />
        ) : (
          <Clock3 size={15} className="text-amber-400" />
        )}
        <span className="text-sm text-zinc-400">{label}</span>
      </div>

      <span className="text-xs font-medium text-zinc-300">{value}</span>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex min-h-[140px] flex-col items-center justify-center gap-3 px-5 text-center">
      <div className="text-zinc-700">{icon}</div>
      <p className="text-sm text-zinc-600">{text}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[220px] items-center justify-center">
      <div className="text-sm text-zinc-600">Loading trust profiles...</div>
    </div>
  );
}
