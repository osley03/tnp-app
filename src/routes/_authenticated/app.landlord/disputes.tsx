import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Download,
  ChevronRight,
  Clock3,
  FileText,
  Flag,
  Gavel,
  Loader2,
  MessageSquare,
  Search,
  ShieldAlert,
  ShieldCheck,
  User,
  Wallet,
  X,
} from "lucide-react";

import { RoleSidebar } from "@/components/dashboard/RoleSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";

type DisputeQueryResult = {
  data: unknown;
  error: { message: string } | null;
};

type DisputeQuery = PromiseLike<DisputeQueryResult> & {
  select: (columns?: string) => DisputeQuery;
  single: () => DisputeQuery;
  order: (column: string, options?: { ascending?: boolean }) => DisputeQuery;
  eq: (column: string, value: unknown) => DisputeQuery;
  update: (values: Record<string, unknown>) => DisputeQuery;
  insert: (values: Record<string, unknown> | Record<string, unknown>[]) => DisputeQuery;
};

const db = supabase as unknown as {
  from: (table: string) => DisputeQuery;
};

export const Route = createFileRoute("/_authenticated/app/landlord/disputes")({
  component: LandlordDisputes,
});

type DisputeStatus = "open" | "under_review" | "awaiting_response" | "escalated" | "resolved" | "closed";
type DisputePriority = "low" | "medium" | "high" | "critical";

type Profile = {
  id: string;
  full_name: string | null;

  phone: string | null;
  verification: string | null;
  trust_score: number | null;
};

type Property = {
  id: string;
  title: string | null;
  suburb: string | null;
  city: string | null;
  rent_usd: number | null;
  image_url: string | null;
  verified: boolean | null;
};

type Dispute = {
  id: string;
  reference: string;
  title: string;
  description: string;
  category: string;
  status: DisputeStatus;
  priority: DisputePriority;
  amount: number | null;
  currency: string | null;
  tenant_id: string;
  landlord_id: string;
  property_id: string | null;
  lease_request_id: string | null;
  landlord_response: string | null;
  admin_note: string | null;
  resolution: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

type DisputeMessage = {
  id: string;
  dispute_id: string;
  sender_id: string;
  sender_role: "tenant" | "landlord" | "admin";
  message: string;
  internal_note: boolean;
  created_at: string;
};

type DisputeEvidence = {
  id: string;
  dispute_id: string;
  uploaded_by: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  description: string | null;
  created_at: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-ZW", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-ZW", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(amount: number | null | undefined, currency = "USD") {
  if (amount === null || amount === undefined) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

function statusLabel(status: DisputeStatus) {
  switch (status) {
    case "open":
      return "Open";
    case "under_review":
      return "Under review";
    case "awaiting_response":
      return "Awaiting response";
    case "escalated":
      return "Escalated to admin";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
  }
}

function priorityLabel(priority: DisputePriority) {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function StatusBadge({ status }: { status: DisputeStatus }) {
  const styles: Record<DisputeStatus, string> = {
    open: "bg-amber-50 text-amber-700 border-amber-200",
    under_review: "bg-blue-50 text-blue-700 border-blue-200",
    awaiting_response: "bg-amber-50 text-amber-700 border-amber-200",
    escalated: "bg-red-50 text-red-700 border-red-200",
    resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    closed: "bg-slate-100 text-slate-600 border-slate-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: DisputePriority }) {
  const styles: Record<DisputePriority, string> = {
    low: "bg-slate-50 text-slate-600 border-slate-200",
    medium: "bg-blue-50 text-blue-700 border-blue-200",
    high: "bg-orange-50 text-orange-700 border-orange-200",
    critical: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[priority]}`}
    >
      {priority === "critical" && <AlertTriangle size={12} />}
      {priorityLabel(priority)}
    </span>
  );
}

function MetricCard({
  title,
  value,
  icon,
  description,
}: {
  title: string;
  value: number;
  icon: ReactNode;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{description}</p>
        </div>

        <div className="rounded-xl bg-slate-100 p-3 text-slate-600">{icon}</div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-right text-sm font-medium text-slate-800">{value}</span>
    </div>
  );
}

function LandlordDisputes() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | DisputeStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | DisputePriority>("all");

  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);

  const [responseText, setResponseText] = useState("");
  const [savingResponse, setSavingResponse] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [postingMessage, setPostingMessage] = useState(false);
  const [messageText, setMessageText] = useState("");

  const disputesQuery = useQuery({
    queryKey: ["landlord-disputes"],
    queryFn: async () => {
      const { data, error } = await db
        .from("disputes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []) as Dispute[];
    },
  });

  const profilesQuery = useQuery({
    queryKey: ["landlord-dispute-profiles"],
    queryFn: async () => {
      const { data, error } = await db
        .from("profiles")
        .select("id, full_name, phone, verification, trust_score");

      if (error) throw error;

      return (data ?? []) as Profile[];
    },
  });

  const propertiesQuery = useQuery({
    queryKey: ["landlord-dispute-properties"],
    queryFn: async () => {
      const { data, error } = await db
        .from("properties")
        .select("id, title, suburb, city, rent_usd, image_url, verified");

      if (error) throw error;

      return (data ?? []) as Property[];
    },
  });

  const selectedDispute = useMemo(() => {
    return disputesQuery.data?.find((item) => item.id === selectedDisputeId) ?? null;
  }, [disputesQuery.data, selectedDisputeId]);

  const messagesQuery = useQuery({
    queryKey: ["landlord-dispute-messages", selectedDisputeId],
    enabled: Boolean(selectedDisputeId),
    queryFn: async () => {
      if (!selectedDisputeId) return [];

      const { data, error } = await db
        .from("dispute_messages")
        .select("*")
        .eq("dispute_id", selectedDisputeId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      return (data ?? []) as DisputeMessage[];
    },
  });

  const evidenceQuery = useQuery({
    queryKey: ["landlord-dispute-evidence", selectedDisputeId],
    enabled: Boolean(selectedDisputeId),
    queryFn: async () => {
      if (!selectedDisputeId) return [];

      const { data, error } = await db
        .from("dispute_evidence")
        .select("*")
        .eq("dispute_id", selectedDisputeId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []) as DisputeEvidence[];
    },
  });

  const profiles = profilesQuery.data ?? [];
  const properties = propertiesQuery.data ?? [];
  const disputes = disputesQuery.data ?? [];

  const profileMap = useMemo(() => {
    return new Map(profiles.map((profile) => [profile.id, profile]));
  }, [profiles]);

  const propertyMap = useMemo(() => {
    return new Map(properties.map((property) => [property.id, property]));
  }, [properties]);

  const metrics = useMemo(() => {
    return {
      total: disputes.length,
      open: disputes.filter((d) => d.status === "open").length,
      underReview: disputes.filter((d) => d.status === "under_review").length,
      resolved: disputes.filter((d) => d.status === "resolved").length,
      critical: disputes.filter((d) => d.priority === "critical").length,
    };
  }, [disputes]);

  const filteredDisputes = useMemo(() => {
    const query = search.trim().toLowerCase();

    return disputes.filter((dispute) => {
      const tenant = profileMap.get(dispute.tenant_id);

      const property = dispute.property_id ? propertyMap.get(dispute.property_id) : undefined;

      const searchable = [
        dispute.reference,
        dispute.title,
        dispute.description,
        dispute.category,
        tenant?.full_name,
        property?.title,
        property?.suburb,
        property?.city,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchable.includes(query);

      const matchesStatus = statusFilter === "all" || dispute.status === statusFilter;

      const matchesPriority = priorityFilter === "all" || dispute.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [disputes, search, statusFilter, priorityFilter, profileMap, propertyMap]);

  const openDispute = (dispute: Dispute) => {
    setSelectedDisputeId(dispute.id);
    setResponseText(dispute.landlord_response ?? "");
  };

  const closeDispute = () => {
    setSelectedDisputeId(null);
    setResponseText("");
  };

  const saveResponse = async () => {
    if (!selectedDispute) return;

    setSavingResponse(true);

    try {
      const { error } = await db
        .from("disputes")
        .update({
          landlord_response: responseText.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedDispute.id);

      if (error) throw error;

      await queryClient.invalidateQueries({
        queryKey: ["landlord-disputes"],
      });
    } catch (error) {
      console.error("Failed to save landlord response:", error);
      alert("Failed to save the response. Please try again.");
    } finally {
      setSavingResponse(false);
    }
  };

  const updateStatus = async (status: DisputeStatus) => {
    if (!selectedDispute) return;

    setUpdatingStatus(true);

    try {
      const payload: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };

      const { error } = await db.from("disputes").update(payload).eq("id", selectedDispute.id).select("id").single();

      if (error) throw error;

      await queryClient.invalidateQueries({
        queryKey: ["landlord-disputes"],
      });
    } catch (error) {
      console.error("Failed to update dispute:", error);
      alert("Failed to update dispute status.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const postLandlordMessage = async () => {
    if (!selectedDispute || !messageText.trim()) return;

    setPostingMessage(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const userId = userData.user?.id;
      if (!userId) throw new Error("Your session could not be verified.");

      const { error } = await db.from("dispute_messages").insert({
        dispute_id: selectedDispute.id,
        sender_id: userId,
        sender_role: "landlord",
        message: messageText.trim(),
        internal_note: false,
      });

      if (error) throw error;

      setMessageText("");
      await queryClient.invalidateQueries({
        queryKey: ["landlord-dispute-messages", selectedDispute.id],
      });
    } catch (error) {
      console.error("Failed to send dispute message:", error);
      alert("Failed to send the message. Please try again.");
    } finally {
      setPostingMessage(false);
    }
  };

  const acknowledgeDispute = async () => {
    if (!selectedDispute || selectedDispute.status !== "open") return;
    await updateStatus("under_review");
  };

  const requestAdminReview = async () => {
    if (!selectedDispute || ["resolved", "closed"].includes(selectedDispute.status)) return;
    await updateStatus("escalated");
  };

  const isLoading = disputesQuery.isLoading || profilesQuery.isLoading || propertiesQuery.isLoading;

  const hasError = disputesQuery.isError || profilesQuery.isError || propertiesQuery.isError;

  const errorMessage =
    disputesQuery.error instanceof Error
      ? disputesQuery.error.message
      : profilesQuery.error instanceof Error
        ? profilesQuery.error.message
        : propertiesQuery.error instanceof Error
          ? propertiesQuery.error.message
          : "Something went wrong while loading disputes.";

  const tenant = selectedDispute ? profileMap.get(selectedDispute.tenant_id) : undefined;

  const property = selectedDispute?.property_id
    ? propertyMap.get(selectedDispute.property_id)
    : undefined;

  /*
   * IMPORTANT:
   * The entire page is inside SidebarProvider.
   * RoleSidebar therefore always has access to the sidebar context.
   */
  return (
    <SidebarProvider>
      <RoleSidebar role="landlord" />

      <SidebarInset>
        <div className="tnp-module tnp-module-light min-h-screen bg-slate-50">
          {/* HEADER */}
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex h-16 items-center justify-between px-5 lg:px-8">
              <div className="flex items-center gap-3">
                <SidebarTrigger />

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    Landlord Portal
                  </p>

                  <h1 className="text-lg font-bold text-slate-900">Disputes</h1>
                </div>
              </div>

              <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 sm:flex">
                <ShieldCheck size={17} className="text-slate-600" />

                <div>
                  <p className="text-xs font-semibold text-slate-700">Mutual Trust Ledger</p>

                  <p className="text-[10px] text-slate-400">Dispute Management</p>
                </div>
              </div>
            </div>
          </header>

          <main className="relative min-h-[calc(100vh-4rem)]">
            {/* INTRO */}
            <section className="border-b border-slate-200 bg-white">
              <div className="px-5 py-7 lg:px-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      <Gavel size={14} />
                      Landlord Portal / Disputes
                    </div>

                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Disputes</h2>

                    <p className="mt-1 max-w-2xl text-sm text-slate-500">
                      Review tenant disputes, communicate with involved parties, and track case
                      resolution.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {isLoading ? (
              <div className="flex min-h-[500px] items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <Loader2 size={20} className="animate-spin" />
                  Loading disputes...
                </div>
              </div>
            ) : hasError ? (
              <div className="flex min-h-[500px] items-center justify-center p-6">
                <div className="max-w-lg rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
                    <AlertTriangle size={24} />
                  </div>

                  <h3 className="mt-4 text-lg font-bold text-slate-900">Unable to load disputes</h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">{errorMessage}</p>

                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="mt-5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-6 p-5 lg:p-8">
                  {/* METRICS */}
                  <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    <MetricCard
                      title="Total Disputes"
                      value={metrics.total}
                      description="All landlord cases"
                      icon={<Gavel size={20} />}
                    />

                    <MetricCard
                      title="Open"
                      value={metrics.open}
                      description="Awaiting action"
                      icon={<AlertTriangle size={20} />}
                    />

                    <MetricCard
                      title="Under Review"
                      value={metrics.underReview}
                      description="Currently being reviewed"
                      icon={<Clock3 size={20} />}
                    />

                    <MetricCard
                      title="Resolved"
                      value={metrics.resolved}
                      description="Successfully resolved"
                      icon={<CheckCircle2 size={20} />}
                    />

                    <MetricCard
                      title="Critical"
                      value={metrics.critical}
                      description="Requires priority attention"
                      icon={<ShieldAlert size={20} />}
                    />
                  </section>

                  {/* FILTERS */}
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 xl:flex-row">
                      <div className="relative flex-1">
                        <Search
                          size={17}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />

                        <input
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Search reference, title, tenant, property..."
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                        />
                      </div>

                      <select
                        value={statusFilter}
                        onChange={(event) =>
                          setStatusFilter(event.target.value as "all" | DisputeStatus)
                        }
                        className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
                      >
                        <option value="all">All statuses</option>
                        <option value="open">Open</option>
                        <option value="under_review">Under review</option>
                        <option value="awaiting_response">Awaiting response</option>
                        <option value="escalated">Escalated to admin</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>

                      <select
                        value={priorityFilter}
                        onChange={(event) =>
                          setPriorityFilter(event.target.value as "all" | DisputePriority)
                        }
                        className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
                      >
                        <option value="all">All priorities</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                  </section>

                  {/* DISPUTE TABLE */}
                  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-6 py-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-base font-bold text-slate-900">Dispute Cases</h2>

                          <p className="mt-1 text-sm text-slate-500">
                            {filteredDisputes.length} cases shown
                          </p>
                        </div>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          Filtered view
                        </span>
                      </div>
                    </div>

                    {filteredDisputes.length === 0 ? (
                      <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
                        <div className="rounded-2xl bg-slate-100 p-4 text-slate-400">
                          <Gavel size={28} />
                        </div>

                        <h3 className="mt-4 text-base font-semibold text-slate-800">
                          No disputes yet
                        </h3>

                        <p className="mt-1 max-w-md text-sm text-slate-500">
                          Disputes raised against your properties will appear here.
                        </p>
                        <p className="mt-3 max-w-lg text-xs leading-5 text-slate-400">
                          When a tenant opens a case, you will be able to review the claim,
                          communicate with the tenant, inspect evidence, respond, and move the case
                          through its resolution workflow.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[950px]">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/70">
                              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Case
                              </th>

                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Tenant
                              </th>

                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Property
                              </th>

                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Priority
                              </th>

                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Status
                              </th>

                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Amount
                              </th>

                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Created
                              </th>

                              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Action
                              </th>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-slate-100">
                            {filteredDisputes.map((dispute) => {
                              const disputeTenant = profileMap.get(dispute.tenant_id);

                              const disputeProperty = dispute.property_id
                                ? propertyMap.get(dispute.property_id)
                                : undefined;

                              return (
                                <tr key={dispute.id} className="transition hover:bg-slate-50">
                                  <td className="px-6 py-4">
                                    <div className="max-w-[230px]">
                                      <p className="text-xs font-semibold text-slate-400">
                                        {dispute.reference}
                                      </p>

                                      <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                                        {dispute.title}
                                      </p>

                                      <p className="mt-1 truncate text-xs text-slate-500">
                                        {dispute.category}
                                      </p>
                                    </div>
                                  </td>

                                  <td className="px-4 py-4">
                                    <div className="flex items-center gap-2">
                                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                                        <User size={15} />
                                      </div>

                                      <div>
                                        <p className="max-w-[150px] truncate text-sm font-medium text-slate-800">
                                          {disputeTenant?.full_name || "Unknown tenant"}
                                        </p>

                                        <p className="text-xs text-slate-400">
                                          Trust {disputeTenant?.trust_score ?? "—"}
                                        </p>
                                      </div>
                                    </div>
                                  </td>

                                  <td className="px-4 py-4">
                                    <div className="flex items-center gap-2">
                                      <Building2 size={16} className="text-slate-400" />

                                      <div>
                                        <p className="max-w-[160px] truncate text-sm font-medium text-slate-800">
                                          {disputeProperty?.title || "Property unavailable"}
                                        </p>

                                        <p className="text-xs text-slate-400">
                                          {[disputeProperty?.suburb, disputeProperty?.city]
                                            .filter(Boolean)
                                            .join(", ") || "—"}
                                        </p>
                                      </div>
                                    </div>
                                  </td>

                                  <td className="px-4 py-4">
                                    <PriorityBadge priority={dispute.priority} />
                                  </td>

                                  <td className="px-4 py-4">
                                    <StatusBadge status={dispute.status} />
                                  </td>

                                  <td className="px-4 py-4">
                                    <span className="text-sm font-semibold text-slate-800">
                                      {formatMoney(dispute.amount, dispute.currency || "USD")}
                                    </span>
                                  </td>

                                  <td className="px-4 py-4 text-sm text-slate-500">
                                    {formatDate(dispute.created_at)}
                                  </td>

                                  <td className="px-6 py-4 text-right">
                                    <button
                                      type="button"
                                      onClick={() => openDispute(dispute)}
                                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                                    >
                                      Review
                                      <ChevronRight size={14} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                </div>

                {/* DETAIL DRAWER */}
                {selectedDispute && (
                  <div className="absolute inset-0 z-40">
                    <button
                      type="button"
                      aria-label="Close dispute details"
                      onClick={closeDispute}
                      className="absolute inset-0 bg-slate-950/20 backdrop-blur-[1px]"
                    />

                    <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl">
                      {/* DRAWER HEADER */}
                      <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                              {selectedDispute.reference}
                            </span>

                            <PriorityBadge priority={selectedDispute.priority} />
                          </div>

                          <h2 className="mt-2 text-xl font-bold text-slate-900">
                            {selectedDispute.title}
                          </h2>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <p className="text-sm text-slate-500">
                              Created {formatDateTime(selectedDispute.created_at)}
                            </p>
                            {selectedDispute.status === "open" && (
                              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                                Awaiting landlord action
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={closeDispute}
                          className="ml-4 rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      {/* DRAWER CONTENT */}
                      <div className="flex-1 overflow-y-auto">
                        <div className="space-y-6 p-6">
                          {/* LANDLORD ACTIONS */}
                          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="mb-3">
                              <p className="text-sm font-bold text-slate-900">Landlord Actions</p>
                              <p className="mt-1 text-xs text-slate-500">
                                Keep the case moving while preserving the dispute record.
                              </p>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2">
                              {selectedDispute.status === "open" && (
                                <button
                                  type="button"
                                  disabled={updatingStatus}
                                  onClick={acknowledgeDispute}
                                  className="rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {updatingStatus ? "Updating..." : "Acknowledge & Review"}
                                </button>
                              )}

                              {selectedDispute.status !== "resolved" &&
                                selectedDispute.status !== "closed" && (
                                  <button
                                    type="button"
                                    disabled={updatingStatus}
                                    onClick={requestAdminReview}
                                    className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    Request Admin Review
                                  </button>
                                )}

                              {selectedDispute.status !== "closed" && (
                                <p className="text-xs text-slate-500">TNP administrators record the final resolution and close cases.</p>
                              )}

                              {selectedDispute.status === "resolved" && (
                                <p className="text-xs text-slate-500">TNP administrators record the final resolution and close cases.</p>
                              )}
                            </div>
                          </section>

                          {/* STATUS */}
                          <section>
                            <div className="mb-3 flex items-center justify-between">
                              <h3 className="text-sm font-bold text-slate-900">Case Status</h3>

                              <StatusBadge status={selectedDispute.status} />
                            </div>

                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                              {(
                                ["open", "under_review"] as DisputeStatus[]
                              ).map((status) => (
                                <button
                                  key={status}
                                  type="button"
                                  disabled={updatingStatus || ["resolved", "closed"].includes(selectedDispute.status) || selectedDispute.status === status}
                                  onClick={() => updateStatus(status)}
                                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                                    selectedDispute.status === status
                                      ? "border-slate-900 bg-slate-900 text-white"
                                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                  } disabled:cursor-not-allowed disabled:opacity-60`}
                                >
                                  {statusLabel(status)}
                                </button>
                              ))}
                            </div>
                          </section>

                          {/* CASE SUMMARY */}
                          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                            <div className="mb-3 flex items-center gap-2">
                              <FileText size={17} className="text-slate-500" />

                              <h3 className="text-sm font-bold text-slate-900">Case Summary</h3>
                            </div>

                            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">
                              {selectedDispute.description || "No description provided."}
                            </p>

                            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                    Financial dispute
                                  </p>
                                  <p className="mt-1 text-lg font-bold text-slate-900">
                                    {formatMoney(
                                      selectedDispute.amount,
                                      selectedDispute.currency || "USD",
                                    )}
                                  </p>
                                </div>
                                <Wallet size={20} className="text-slate-400" />
                              </div>
                            </div>

                            <div className="mt-4">
                              <InfoRow label="Category" value={selectedDispute.category || "—"} />

                              <InfoRow
                                label="Amount"
                                value={formatMoney(
                                  selectedDispute.amount,
                                  selectedDispute.currency || "USD",
                                )}
                              />

                              <InfoRow
                                label="Lease request"
                                value={
                                  selectedDispute.lease_request_id
                                    ? `${selectedDispute.lease_request_id.slice(0, 8)}...`
                                    : "—"
                                }
                              />
                            </div>
                          </section>

                          {/* TENANT */}
                          <section className="rounded-2xl border border-slate-200 bg-white">
                            <div className="border-b border-slate-200 px-5 py-4">
                              <div className="flex items-center gap-2">
                                <User size={17} className="text-slate-500" />

                                <h3 className="text-sm font-bold text-slate-900">
                                  Tenant Information
                                </h3>
                              </div>
                            </div>

                            <div className="p-5">
                              <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                                  <User size={22} />
                                </div>

                                <div>
                                  <p className="font-semibold text-slate-900">
                                    {tenant?.full_name || "Unknown tenant"}
                                  </p>

                                  <p className="text-sm text-slate-500">
                                    {tenant?.phone || "No phone number"}
                                  </p>
                                </div>

                                <div className="ml-auto text-right">
                                  <p className="text-xs text-slate-400">Trust score</p>

                                  <p className="text-xl font-bold text-slate-900">
                                    {tenant?.trust_score ?? "—"}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-4">
                                <InfoRow
                                  label="Verification"
                                  value={tenant?.verification || "Not available"}
                                />

                                <InfoRow
                                  label="Tenant ID"
                                  value={`${selectedDispute.tenant_id.slice(0, 8)}...`}
                                />
                              </div>
                            </div>
                          </section>

                          {/* PROPERTY */}
                          <section className="rounded-2xl border border-slate-200 bg-white">
                            <div className="border-b border-slate-200 px-5 py-4">
                              <div className="flex items-center gap-2">
                                <Building2 size={17} className="text-slate-500" />

                                <h3 className="text-sm font-bold text-slate-900">
                                  Property Information
                                </h3>
                              </div>
                            </div>

                            <div className="p-5">
                              {property?.image_url ? (
                                <img
                                  src={property.image_url}
                                  alt={property.title || "Property"}
                                  className="mb-4 h-40 w-full rounded-xl object-cover"
                                />
                              ) : (
                                <div className="mb-4 flex h-32 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                                  <Building2 size={30} />
                                </div>
                              )}

                              <h4 className="font-semibold text-slate-900">
                                {property?.title || "Property unavailable"}
                              </h4>

                              <p className="mt-1 text-sm text-slate-500">
                                {[property?.suburb, property?.city].filter(Boolean).join(", ") ||
                                  "Location unavailable"}
                              </p>

                              <div className="mt-4">
                                <InfoRow
                                  label="Monthly rent"
                                  value={formatMoney(property?.rent_usd, "USD")}
                                />

                                <InfoRow
                                  label="Verification"
                                  value={
                                    property?.verified ? (
                                      <span className="inline-flex items-center gap-1 text-emerald-600">
                                        <ShieldCheck size={14} />
                                        Verified
                                      </span>
                                    ) : (
                                      "Not verified"
                                    )
                                  }
                                />
                              </div>
                            </div>
                          </section>

                          {/* MESSAGES */}
                          <section className="rounded-2xl border border-slate-200 bg-white">
                            <div className="border-b border-slate-200 px-5 py-4">
                              <div className="flex items-center gap-2">
                                <MessageSquare size={17} className="text-slate-500" />

                                <h3 className="text-sm font-bold text-slate-900">
                                  Case Communication
                                </h3>
                              </div>
                            </div>

                            <div className="space-y-3 p-5">
                              {messagesQuery.isLoading ? (
                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                  <Loader2 size={16} className="animate-spin" />
                                  Loading messages...
                                </div>
                              ) : messagesQuery.data?.length ? (
                                messagesQuery.data.map((message) => {
                                  const sender = profileMap.get(message.sender_id);

                                  return (
                                    <div
                                      key={message.id}
                                      className={`rounded-xl border p-4 ${
                                        message.sender_role === "landlord"
                                          ? "ml-6 border-slate-200 bg-slate-50"
                                          : "mr-6 border-blue-100 bg-blue-50/50"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                          {message.sender_role}
                                        </span>

                                        <span className="text-[11px] text-slate-400">
                                          {formatDateTime(message.created_at)}
                                        </span>
                                      </div>

                                      <p className="mt-2 text-sm font-medium text-slate-700">
                                        {sender?.full_name || message.sender_role}
                                      </p>

                                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                                        {message.message}
                                      </p>
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">
                                  No messages have been recorded for this dispute.
                                </div>
                              )}
                            </div>

                            <div className="border-t border-slate-100 p-5">
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                Send landlord message
                              </p>
                              <textarea
                                value={messageText}
                                onChange={(event) => setMessageText(event.target.value)}
                                rows={4}
                                placeholder="Write a message for the tenant or case record..."
                                className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                              />
                              <div className="mt-2 flex justify-end">
                                <button
                                  type="button"
                                  disabled={postingMessage || !messageText.trim()}
                                  onClick={postLandlordMessage}
                                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {postingMessage ? (
                                    <>
                                      <Loader2 size={15} className="animate-spin" />
                                      Sending...
                                    </>
                                  ) : (
                                    <>
                                      <MessageSquare size={15} />
                                      Send Message
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </section>

                          {/* EVIDENCE */}
                          <section className="rounded-2xl border border-slate-200 bg-white">
                            <div className="border-b border-slate-200 px-5 py-4">
                              <div className="flex items-center gap-2">
                                <FileText size={17} className="text-slate-500" />

                                <h3 className="text-sm font-bold text-slate-900">Evidence</h3>
                              </div>
                            </div>

                            <div className="space-y-3 p-5">
                              {evidenceQuery.isLoading ? (
                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                  <Loader2 size={16} className="animate-spin" />
                                  Loading evidence...
                                </div>
                              ) : evidenceQuery.data?.length ? (
                                evidenceQuery.data.map((evidence) => (
                                  <div
                                    key={evidence.id}
                                    className="flex items-start gap-3 rounded-xl border border-slate-200 p-4"
                                  >
                                    <div className="rounded-lg bg-slate-100 p-2 text-slate-500">
                                      <FileText size={18} />
                                    </div>

                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-slate-800">
                                        {evidence.file_name}
                                      </p>

                                      <p className="mt-1 text-xs text-slate-500">
                                        {evidence.description || "No description"}
                                      </p>

                                      <p className="mt-1 text-[11px] text-slate-400">
                                        Added {formatDate(evidence.created_at)}
                                        {evidence.file_size
                                          ? ` · ${(evidence.file_size / 1024).toFixed(1)} KB`
                                          : ""}
                                      </p>

                                      {evidence.file_path && (
                                        <div className="mt-3">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              window.open(
                                                evidence.file_path,
                                                "_blank",
                                                "noopener,noreferrer",
                                              )
                                            }
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                                          >
                                            <Download size={13} />
                                            Open Evidence
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">
                                  No evidence has been submitted.
                                </div>
                              )}
                            </div>
                          </section>

                          {/* LANDLORD RESPONSE */}
                          <section className="rounded-2xl border border-slate-200 bg-white">
                            <div className="border-b border-slate-200 px-5 py-4">
                              <div className="flex items-center gap-2">
                                <MessageSquare size={17} className="text-slate-500" />

                                <h3 className="text-sm font-bold text-slate-900">
                                  Landlord Response
                                </h3>
                              </div>
                            </div>

                            <div className="p-5">
                              <textarea
                                value={responseText}
                                onChange={(event) => setResponseText(event.target.value)}
                                rows={6}
                                placeholder="Provide your response to this dispute..."
                                className="w-full resize-none rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                              />

                              <div className="mt-3 flex justify-end">
                                <button
                                  type="button"
                                  disabled={savingResponse || ["resolved", "closed"].includes(selectedDispute.status)}
                                  onClick={saveResponse}
                                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {savingResponse ? (
                                    <>
                                      <Loader2 size={16} className="animate-spin" />
                                      Saving...
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 size={16} />
                                      Save Response
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </section>

                          {/* ADMIN NOTE */}
                          <section className="rounded-2xl border border-amber-200 bg-amber-50/50">
                            <div className="border-b border-amber-200 px-5 py-4">
                              <div className="flex items-center gap-2">
                                <ShieldAlert size={17} className="text-amber-600" />

                                <h3 className="text-sm font-bold text-slate-900">Admin Note</h3>
                              </div>
                            </div>

                            <div className="p-5">
                              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">
                                {selectedDispute.admin_note ||
                                  "No administrative note has been added."}
                              </p>
                            </div>
                          </section>

                          {/* RESOLUTION */}
                          <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40">
                            <div className="border-b border-emerald-200 px-5 py-4">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 size={17} className="text-emerald-600" />

                                <h3 className="text-sm font-bold text-slate-900">Resolution</h3>
                              </div>
                            </div>

                            <div className="p-5">
                              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">
                                {selectedDispute.resolution ||
                                  "No resolution has been recorded yet."}
                              </p>

                              {selectedDispute.resolved_at && (
                                <p className="mt-3 text-xs text-slate-400">
                                  Resolved {formatDateTime(selectedDispute.resolved_at)}
                                </p>
                              )}
                            </div>
                          </section>

                          {/* CASE META */}
                          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="flex items-center gap-3">
                                <CalendarDays size={17} className="text-slate-400" />

                                <div>
                                  <p className="text-xs text-slate-400">Created</p>

                                  <p className="text-sm font-medium text-slate-700">
                                    {formatDateTime(selectedDispute.created_at)}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <Wallet size={17} className="text-slate-400" />

                                <div>
                                  <p className="text-xs text-slate-400">Disputed amount</p>

                                  <p className="text-sm font-medium text-slate-700">
                                    {formatMoney(
                                      selectedDispute.amount,
                                      selectedDispute.currency || "USD",
                                    )}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <Flag size={17} className="text-slate-400" />

                                <div>
                                  <p className="text-xs text-slate-400">Priority</p>

                                  <p className="text-sm font-medium text-slate-700">
                                    {priorityLabel(selectedDispute.priority)}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <ShieldCheck size={17} className="text-slate-400" />

                                <div>
                                  <p className="text-xs text-slate-400">Reference</p>

                                  <p className="text-sm font-medium text-slate-700">
                                    {selectedDispute.reference}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </section>
                        </div>
                      </div>

                      {/* DRAWER FOOTER */}
                      <div className="border-t border-slate-200 bg-white px-6 py-4">
                        <button
                          type="button"
                          onClick={closeDispute}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Close Details
                        </button>
                      </div>
                    </aside>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
