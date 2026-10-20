import { isSettledPayment } from "@/modules/payments/ledger";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileCheck2,
  FileText,
  Filter,
  Gavel,
  History,
  Loader2,
  MessageSquareWarning,
  MoreHorizontal,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Wallet,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/admin/leases")({
  component: AdminLeasesPage,
});

type LeaseStatus =
  "draft" | "requested" | "pending_approval" | "active" | "completed" | "terminated" | "disputed";

type DisplayStatus = LeaseStatus | "expiring_soon";

type LeaseRow = {
  id: string;
  lease_request_id: string | null;
  property_id: string;
  tenant_id: string;
  landlord_id: string;
  status: LeaseStatus;
  rent_usd: number;
  deposit_usd: number;
  start_date: string | null;
  end_date: string | null;
  signed_at: string | null;
  admin_notes: string | null;
  terms: string | null;
  created_at: string;
  updated_at: string;
  source: "lease" | "request";
  property_title: string;
  property_city: string;
  property_suburb: string;
  tenant_name: string;
  landlord_name: string;
  request_status?: string | null;
  move_in?: string | null;
};

type LeaseRecord = {
  id: string;
  lease_request_id?: string | null;
  property_id: string;
  tenant_id: string;
  landlord_id: string;
  status: string;
  rent_usd?: number | null;
  deposit_usd?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  signed_at?: string | null;
  admin_notes?: string | null;
  terms?: string | null;
  created_at: string;
  updated_at: string;
};

type PaymentRow = {
  id: string;
  lease_id: string;
  payer_id: string;
  payee_id: string;
  payment_type: string;
  amount_usd: number;
  status: string;
  reference: string | null;
  paid_at: string | null;
  released_at: string | null;
  created_at: string;
};

type EventRow = {
  id: string;
  lease_id: string;
  actor_id: string | null;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  detail: string | null;
  event_hash: string | null;
  created_at: string;
};

type DisputeRow = {
  id: string;
  lease_id: string;
  opened_by: string;
  category: string;
  description: string;
  status: string;
  resolution: string | null;
  created_at: string;
  updated_at: string;
};

type AdminActionRow = {
  id: string;
  lease_id: string;
  admin_id: string;
  action: string;
  reason: string | null;
  created_at: string;
};

const db = supabase;

const STATUS_OPTIONS: Array<{
  value: "all" | DisplayStatus;
  label: string;
}> = [
  { value: "all", label: "All leases" },
  { value: "draft", label: "Draft" },
  { value: "requested", label: "Requested" },
  { value: "pending_approval", label: "Pending approval" },
  { value: "active", label: "Active" },
  { value: "expiring_soon", label: "Expiring soon" },
  { value: "completed", label: "Completed" },
  { value: "terminated", label: "Terminated" },
  { value: "disputed", label: "Disputed" },
];

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));

const shortDate = (value: string | null | undefined) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const dateTime = (value: string | null | undefined) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const normaliseRequestStatus = (status: string | null | undefined): LeaseStatus => {
  const value = String(status ?? "")
    .toLowerCase()
    .replace(/[\s-]/g, "_");

  if (["draft"].includes(value)) return "draft";
  if (["approved", "accepted", "approval"].includes(value)) {
    return "pending_approval";
  }
  if (["active", "ongoing"].includes(value)) return "active";
  if (["completed", "complete", "closed"].includes(value)) return "completed";
  if (["terminated", "cancelled", "canceled"].includes(value)) {
    return "terminated";
  }
  if (["disputed", "dispute"].includes(value)) return "disputed";

  return "requested";
};

const statusLabel = (status: DisplayStatus) => {
  const labels: Record<DisplayStatus, string> = {
    draft: "Draft",
    requested: "Requested",
    pending_approval: "Pending Approval",
    active: "Active",
    expiring_soon: "Expiring Soon",
    completed: "Completed",
    terminated: "Terminated",
    disputed: "Disputed",
  };

  return labels[status];
};

const statusClasses = (status: DisplayStatus) => {
  const classes: Record<DisplayStatus, string> = {
    draft: "bg-slate-100 text-slate-700 border-slate-200",
    requested: "bg-blue-50 text-blue-700 border-blue-200",
    pending_approval: "bg-amber-50 text-amber-700 border-amber-200",
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    expiring_soon: "bg-orange-50 text-orange-700 border-orange-200",
    completed: "bg-violet-50 text-violet-700 border-violet-200",
    terminated: "bg-rose-50 text-rose-700 border-rose-200",
    disputed: "bg-red-50 text-red-700 border-red-200",
  };

  return classes[status];
};

const isExpiringSoon = (lease: LeaseRow) => {
  if (lease.status !== "active" || !lease.end_date) return false;

  const end = new Date(lease.end_date).getTime();
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  return end >= now && end <= now + thirtyDays;
};

const displayStatus = (lease: LeaseRow): DisplayStatus =>
  isExpiringSoon(lease) ? "expiring_soon" : lease.status;

function AdminLeasesPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | DisplayStatus>("all");
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const leasesQuery = useQuery({
    queryKey: ["admin-leases"],
    queryFn: async () => {
      const [
        { data: leases, error: leasesError },
        { data: requests, error: requestsError },
        { data: properties, error: propertiesError },
        { data: profiles, error: profilesError },
      ] = await Promise.all([
        db
          .from("leases" as never)
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("lease_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("properties").select("id,title,city,suburb,owner_id,rent_usd,deposit_usd"),
        supabase.from("profiles").select("id,full_name"),
      ]);

      if (leasesError) throw leasesError;
      if (requestsError) throw requestsError;
      if (propertiesError) throw propertiesError;
      if (profilesError) throw profilesError;

      const propertyMap = new Map((properties ?? []).map((property) => [property.id, property]));

      const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

      const actualLeases: LeaseRow[] = ((leases as unknown as Array<LeaseRecord> | null) ?? []).map(
        (lease) => {
          const property = propertyMap.get(lease.property_id);
          const tenant = profileMap.get(lease.tenant_id);
          const landlord = profileMap.get(lease.landlord_id);

          return {
            id: lease.id,
            lease_request_id: lease.lease_request_id ?? null,
            property_id: lease.property_id,
            tenant_id: lease.tenant_id,
            landlord_id: lease.landlord_id,
            status: lease.status as LeaseStatus,
            rent_usd: Number(lease.rent_usd ?? property?.rent_usd ?? 0),
            deposit_usd: Number(lease.deposit_usd ?? property?.deposit_usd ?? 0),
            start_date: lease.start_date ?? null,
            end_date: lease.end_date ?? null,
            signed_at: lease.signed_at ?? null,
            admin_notes: lease.admin_notes ?? null,
            terms: lease.terms ?? null,
            created_at: lease.created_at,
            updated_at: lease.updated_at,
            source: "lease",
            property_title: property?.title ?? "Unknown property",
            property_city: property?.city ?? "",
            property_suburb: property?.suburb ?? "",
            tenant_name: tenant?.full_name ?? "Unknown tenant",
            landlord_name: landlord?.full_name ?? "Unknown landlord",
          };
        },
      );

      const leaseRequestIds = new Set(
        actualLeases.map((lease) => lease.lease_request_id).filter(Boolean),
      );

      const requestRows: LeaseRow[] = (requests ?? [])
        .filter((request) => !leaseRequestIds.has(request.id))
        .map((request) => {
          const property = propertyMap.get(request.property_id);
          const tenant = profileMap.get(request.tenant_id);
          const landlord = property ? profileMap.get(property.owner_id) : undefined;

          return {
            id: `request-${request.id}`,
            lease_request_id: request.id,
            property_id: request.property_id,
            tenant_id: request.tenant_id,
            landlord_id: property?.owner_id ?? "",
            status: normaliseRequestStatus(request.status),
            rent_usd: Number(property?.rent_usd ?? 0),
            deposit_usd: Number(property?.deposit_usd ?? 0),
            start_date: request.move_in ?? null,
            end_date: null,
            signed_at: null,
            admin_notes: null,
            terms: null,
            created_at: request.created_at,
            updated_at: request.created_at,
            source: "request",
            property_title: property?.title ?? "Unknown property",
            property_city: property?.city ?? "",
            property_suburb: property?.suburb ?? "",
            tenant_name: tenant?.full_name ?? "Unknown tenant",
            landlord_name: landlord?.full_name ?? "Unknown landlord",
            request_status: request.status ?? null,
            move_in: request.move_in ?? null,
          };
        });

      return [...actualLeases, ...requestRows];
    },
  });

  const paymentsQuery = useQuery({
    queryKey: ["admin-lease-payments", selectedLeaseId],
    enabled: Boolean(selectedLeaseId && !selectedLeaseId.startsWith("request-")),
    queryFn: async () => {
      const { data, error } = await db
        .from("lease_payments" as never)
        .select("*")
        .eq("lease_id", selectedLeaseId!.replace("request-", ""))
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []) as PaymentRow[];
    },
  });

  const eventsQuery = useQuery({
    queryKey: ["admin-lease-events", selectedLeaseId],
    enabled: Boolean(selectedLeaseId && !selectedLeaseId.startsWith("request-")),
    queryFn: async () => {
      const { data, error } = await db
        .from("lease_events" as never)
        .select("*")
        .eq("lease_id", selectedLeaseId!.replace("request-", ""))
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []) as unknown as EventRow[];
    },
  });

  const disputesQuery = useQuery({
    queryKey: ["admin-lease-disputes", selectedLeaseId],
    enabled: Boolean(selectedLeaseId && !selectedLeaseId.startsWith("request-")),
    queryFn: async () => {
      const { data, error } = await db
        .from("lease_disputes" as never)
        .select("*")
        .eq("lease_id", selectedLeaseId!.replace("request-", ""))
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []) as unknown as DisputeRow[];
    },
  });

  const actionsQuery = useQuery({
    queryKey: ["admin-lease-actions", selectedLeaseId],
    enabled: Boolean(selectedLeaseId && !selectedLeaseId.startsWith("request-")),
    queryFn: async () => {
      const { data, error } = await db
        .from("lease_admin_actions" as never)
        .select("*")
        .eq("lease_id", selectedLeaseId!.replace("request-", ""))
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []) as AdminActionRow[];
    },
  });

  const leases = useMemo(() => leasesQuery.data ?? [], [leasesQuery.data]);

  const filteredLeases = useMemo(() => {
    const term = search.trim().toLowerCase();

    return leases.filter((lease) => {
      const currentStatus = displayStatus(lease);

      const matchesStatus = statusFilter === "all" || currentStatus === statusFilter;

      if (!matchesStatus) return false;

      if (!term) return true;

      return [
        lease.property_title,
        lease.property_city,
        lease.property_suburb,
        lease.tenant_name,
        lease.landlord_name,
        lease.id,
        lease.lease_request_id,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [leases, search, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: leases.length,
      requested: leases.filter((l) => l.status === "requested").length,
      pending: leases.filter((l) => l.status === "pending_approval").length,
      active: leases.filter((l) => l.status === "active").length,
      expiring: leases.filter(isExpiringSoon).length,
      completed: leases.filter((l) => l.status === "completed").length,
      terminated: leases.filter((l) => l.status === "terminated").length,
      disputed: leases.filter((l) => l.status === "disputed").length,
    };
  }, [leases]);

  const selectedLease = leases.find((lease) => lease.id === selectedLeaseId);

  const setSuccess = (text: string) => {
    setMessage({ type: "success", text });
  };

  const setError = (error: unknown) => {
    setMessage({
      type: "error",
      text: error instanceof Error ? error.message : String(error),
    });
  };

  const invalidateLeaseData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-leases"] }),
      queryClient.invalidateQueries({
        queryKey: ["admin-lease-payments"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["admin-lease-events"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["admin-lease-disputes"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["admin-lease-actions"],
      }),
    ]);
  };

  const createLeaseFromRequest = async (lease: LeaseRow) => {
    const {error}=await supabase.rpc('tnp_create_lease_from_request' as never,{p_request_id:lease.lease_request_id??lease.id} as never);
    if(error)throw new Error(error.message);
  };
  const changeLeaseStatus = async (lease: LeaseRow, nextStatus: LeaseStatus) => {
    if(lease.source==='request'){
      if(nextStatus!=='pending_approval')throw new Error('Create the lease before changing its status.');
      await createLeaseFromRequest(lease);return;
    }
    const {error}=await supabase.rpc('tnp_change_lease_status' as never,{p_lease_id:lease.id,p_status:nextStatus} as never);
    if(error)throw new Error(error.message);
  };

  const handleStatusChange = async (lease: LeaseRow, nextStatus: LeaseStatus) => {
    setBusyId(lease.id);
    setMessage(null);

    try {
      await changeLeaseStatus(lease, nextStatus);

      await invalidateLeaseData();

      setSuccess(
        lease.source === "request"
          ? "Lease request approved and a lease record was created."
          : `Lease moved to ${statusLabel(nextStatus)}.`,
      );
    } catch (error) {
      setError(error);
    } finally {
      setBusyId(null);
    }
  };

  const handleRefresh = async () => {
    setMessage(null);
    await invalidateLeaseData();
  };

  const selectedPayments = paymentsQuery.data ?? [];
  const selectedEvents = eventsQuery.data ?? [];
  const selectedDisputes = disputesQuery.data ?? [];
  const selectedActions = actionsQuery.data ?? [];

  const heldAmount = selectedPayments
    .filter((payment) => String(payment.status).toLowerCase() === "held")
    .reduce((sum, payment) => sum + Number(payment.amount_usd ?? 0), 0);

  const receivedAmount = selectedPayments
    .filter((payment) => isSettledPayment(String(payment.status).toLowerCase()))
    .reduce((sum, payment) => sum + Number(payment.amount_usd ?? 0), 0);

  return (
    <div className="tnp-module tnp-module-light min-h-full bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="px-6 py-6 lg:px-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <ShieldCheck className="h-4 w-4" />
                TNP Trust & Operations Centre
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Lease Management</h1>

              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Monitor lease requests, approvals, active agreements, payments, disputes and the
                complete administrative audit trail.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <main className="space-y-6 p-6 lg:p-8">
        {message && (
          <div
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <StatCard label="Total" value={stats.total} icon={<FileText className="h-4 w-4" />} />
          <StatCard
            label="Requested"
            value={stats.requested}
            icon={<Clock3 className="h-4 w-4" />}
          />
          <StatCard
            label="Pending"
            value={stats.pending}
            icon={<FileCheck2 className="h-4 w-4" />}
          />
          <StatCard
            label="Active"
            value={stats.active}
            icon={<ShieldCheck className="h-4 w-4" />}
          />
          <StatCard
            label="Expiring"
            value={stats.expiring}
            icon={<CalendarDays className="h-4 w-4" />}
          />
          <StatCard
            label="Completed"
            value={stats.completed}
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
          <StatCard
            label="Terminated"
            value={stats.terminated}
            icon={<XCircle className="h-4 w-4" />}
          />
          <StatCard label="Disputed" value={stats.disputed} icon={<Gavel className="h-4 w-4" />} />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search property, tenant, landlord or lease ID..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />

              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as "all" | DisplayStatus)}
                  className="h-10 appearance-none rounded-lg border border-slate-200 bg-white py-0 pl-3 pr-9 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          </div>

          {leasesQuery.isLoading ? (
            <div className="flex min-h-[360px] items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading lease records...
              </div>
            </div>
          ) : leasesQuery.isError ? (
            <div className="p-8">
              <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-5 w-5" />
                  Could not load leases
                </div>

                <p className="mt-2">
                  {leasesQuery.error instanceof Error
                    ? leasesQuery.error.message
                    : "An unexpected database error occurred."}
                </p>

                <button
                  type="button"
                  onClick={() => leasesQuery.refetch()}
                  className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : filteredLeases.length === 0 ? (
            <EmptyState search={search} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3">Lease / Property</th>
                    <th className="px-5 py-3">Tenant</th>
                    <th className="px-5 py-3">Landlord</th>
                    <th className="px-5 py-3">Term</th>
                    <th className="px-5 py-3">Financials</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredLeases.map((lease) => {
                    const currentStatus = displayStatus(lease);
                    const busy = busyId === lease.id;

                    return (
                      <tr
                        key={lease.id}
                        className={`cursor-pointer transition hover:bg-slate-50 ${
                          selectedLeaseId === lease.id ? "bg-slate-50" : ""
                        }`}
                        onClick={() => setSelectedLeaseId(lease.id)}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                              <Building2 className="h-4 w-4" />
                            </div>

                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900">
                                {lease.property_title}
                              </div>

                              <div className="mt-0.5 text-xs text-slate-500">
                                {lease.property_suburb ? `${lease.property_suburb}, ` : ""}
                                {lease.property_city || "Location unavailable"}
                              </div>

                              <div className="mt-1 font-mono text-[10px] text-slate-400">
                                {lease.source === "request"
                                  ? `REQ ${lease.lease_request_id?.slice(0, 8)}`
                                  : `LEASE ${lease.id.slice(0, 8)}`}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <UserRound className="h-4 w-4 text-slate-400" />
                            <span className="text-sm font-medium text-slate-700">
                              {lease.tenant_name}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-sm font-medium text-slate-700">
                            {lease.landlord_name}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-xs text-slate-500">
                            <div>
                              Start:{" "}
                              <span className="font-medium text-slate-700">
                                {shortDate(lease.start_date)}
                              </span>
                            </div>

                            <div className="mt-1">
                              End:{" "}
                              <span className="font-medium text-slate-700">
                                {shortDate(lease.end_date)}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-sm font-semibold text-slate-800">
                            {money(lease.rent_usd)}
                            <span className="ml-1 text-xs font-normal text-slate-400">/mo</span>
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            Deposit {money(lease.deposit_usd)}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClasses(
                              currentStatus,
                            )}`}
                          >
                            {statusLabel(currentStatus)}
                          </span>
                        </td>

                        <td
                          className="px-5 py-4 text-right"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="flex justify-end gap-2">
                            {lease.source === "request" && lease.status === "requested" && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleStatusChange(lease, "pending_approval")}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                              >
                                {busy ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                )}
                                Approve
                              </button>
                            )}

                            {lease.source === "lease" && lease.status === "pending_approval" && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleStatusChange(lease, "active")}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                {busy ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                )}
                                Activate
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setSelectedLeaseId(lease.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Inspect
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {selectedLease && (
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClasses(
                          displayStatus(selectedLease),
                        )}`}
                      >
                        {statusLabel(displayStatus(selectedLease))}
                      </span>

                      {selectedLease.source === "request" && (
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                          REQUEST
                        </span>
                      )}
                    </div>

                    <h2 className="text-lg font-bold text-slate-900">
                      {selectedLease.property_title}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {selectedLease.property_suburb ? `${selectedLease.property_suburb}, ` : ""}
                      {selectedLease.property_city}
                    </p>
                  </div>

                  <div className="text-left md:text-right">
                    <div className="font-mono text-xs text-slate-400">
                      {selectedLease.source === "request"
                        ? selectedLease.lease_request_id
                        : selectedLease.id}
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      Created {shortDate(selectedLease.created_at)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
                <InfoCell
                  icon={<UserRound className="h-4 w-4" />}
                  label="Tenant"
                  value={selectedLease.tenant_name}
                />

                <InfoCell
                  icon={<UserRound className="h-4 w-4" />}
                  label="Landlord"
                  value={selectedLease.landlord_name}
                />

                <InfoCell
                  icon={<Wallet className="h-4 w-4" />}
                  label="Monthly rent"
                  value={money(selectedLease.rent_usd)}
                />

                <InfoCell
                  icon={<Wallet className="h-4 w-4" />}
                  label="Deposit"
                  value={money(selectedLease.deposit_usd)}
                />

                <InfoCell
                  icon={<CalendarDays className="h-4 w-4" />}
                  label="Start date"
                  value={shortDate(selectedLease.start_date)}
                />

                <InfoCell
                  icon={<CalendarDays className="h-4 w-4" />}
                  label="End date"
                  value={shortDate(selectedLease.end_date)}
                />

                <InfoCell
                  icon={<FileCheck2 className="h-4 w-4" />}
                  label="Signed"
                  value={shortDate(selectedLease.signed_at)}
                />

                <InfoCell
                  icon={<Clock3 className="h-4 w-4" />}
                  label="Last updated"
                  value={dateTime(selectedLease.updated_at)}
                />
              </div>

              {selectedLease.source === "request" ? (
                <div className="border-t border-slate-200 p-5">
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-start gap-3">
                      <Clock3 className="mt-0.5 h-5 w-5 text-blue-600" />

                      <div>
                        <h3 className="text-sm font-bold text-blue-900">
                          Lease request awaiting administration
                        </h3>

                        <p className="mt-1 text-sm leading-6 text-blue-800">
                          This record currently exists as a lease request. Use
                          <strong> Approve</strong> to create its formal lease record and move it
                          into the pending approval stage.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="border-t border-slate-200 p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900">Lease lifecycle</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Administrative status controls for this agreement.
                        </p>
                      </div>

                      <MoreHorizontal className="h-5 w-5 text-slate-400" />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {selectedLease.status === "draft" && (
                        <ActionButton
                          label="Move to Requested"
                          icon={<ArrowRight className="h-4 w-4" />}
                          onClick={() => handleStatusChange(selectedLease, "requested")}
                          busy={busyId === selectedLease.id}
                        />
                      )}

                      {selectedLease.status === "requested" && (
                        <ActionButton
                          label="Approve"
                          icon={<CheckCircle2 className="h-4 w-4" />}
                          onClick={() => handleStatusChange(selectedLease, "pending_approval")}
                          busy={busyId === selectedLease.id}
                        />
                      )}

                      {selectedLease.status === "pending_approval" && (
                        <ActionButton
                          label="Activate Lease"
                          icon={<ShieldCheck className="h-4 w-4" />}
                          onClick={() => handleStatusChange(selectedLease, "active")}
                          busy={busyId === selectedLease.id}
                        />
                      )}

                      {selectedLease.status === "active" && (
                        <>
                          <ActionButton
                            label="Mark Completed"
                            icon={<CheckCircle2 className="h-4 w-4" />}
                            onClick={() => handleStatusChange(selectedLease, "completed")}
                            busy={busyId === selectedLease.id}
                          />

                          <ActionButton
                            label="Open Dispute"
                            icon={<Gavel className="h-4 w-4" />}
                            onClick={() => handleStatusChange(selectedLease, "disputed")}
                            busy={busyId === selectedLease.id}
                          />

                          <ActionButton
                            label="Terminate"
                            icon={<Ban className="h-4 w-4" />}
                            onClick={() => handleStatusChange(selectedLease, "terminated")}
                            busy={busyId === selectedLease.id}
                          />
                        </>
                      )}

                      {selectedLease.status === "disputed" && (
                        <>
                          <ActionButton
                            label="Resolve → Active"
                            icon={<ShieldCheck className="h-4 w-4" />}
                            onClick={() => handleStatusChange(selectedLease, "active")}
                            busy={busyId === selectedLease.id}
                          />

                          <ActionButton
                            label="Resolve → Completed"
                            icon={<CheckCircle2 className="h-4 w-4" />}
                            onClick={() => handleStatusChange(selectedLease, "completed")}
                            busy={busyId === selectedLease.id}
                          />
                        </>
                      )}

                      {(selectedLease.status === "completed" ||
                        selectedLease.status === "terminated") && (
                        <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                          <LockIcon />
                          Lifecycle closed
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-6 border-t border-slate-200 p-5 lg:grid-cols-2">
                    <Timeline events={selectedEvents} actions={selectedActions} />

                    <PaymentSummary
                      payments={selectedPayments}
                      heldAmount={heldAmount}
                      receivedAmount={receivedAmount}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 p-5">
                  <div className="flex items-center gap-2">
                    <MessageSquareWarning className="h-5 w-5 text-slate-600" />
                    <h3 className="font-bold text-slate-900">Disputes</h3>
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    Current and historical dispute records.
                  </p>
                </div>

                <div className="p-5">
                  {selectedLease.source === "request" ? (
                    <p className="text-sm text-slate-500">
                      Dispute history becomes available after the request is converted into a lease.
                    </p>
                  ) : disputesQuery.isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                  ) : selectedDisputes.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center">
                      <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-500" />
                      <p className="mt-2 text-sm font-semibold text-slate-700">
                        No disputes recorded
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        There are currently no dispute records attached to this lease.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedDisputes.map((dispute) => (
                        <div
                          key={dispute.id}
                          className="rounded-xl border border-red-100 bg-red-50/50 p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-bold uppercase tracking-wide text-red-700">
                              {dispute.category}
                            </span>

                            <span className="rounded-full border border-red-200 bg-white px-2 py-1 text-[10px] font-bold text-red-700">
                              {dispute.status}
                            </span>
                          </div>

                          <p className="mt-2 text-sm leading-6 text-slate-700">
                            {dispute.description}
                          </p>

                          {dispute.resolution && (
                            <p className="mt-2 text-xs text-slate-500">
                              Resolution: {dispute.resolution}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 p-5">
                  <div className="flex items-center gap-2">
                    <Gavel className="h-5 w-5 text-slate-600" />
                    <h3 className="font-bold text-slate-900">Administrative record</h3>
                  </div>
                </div>

                <div className="p-5">
                  {selectedLease.source === "request" ? (
                    <p className="text-sm text-slate-500">
                      Administrative actions will appear here after lease creation.
                    </p>
                  ) : actionsQuery.isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                  ) : selectedActions.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No administrative actions have been recorded yet.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {selectedActions.slice(0, 8).map((action) => (
                        <div key={action.id} className="border-l-2 border-slate-200 pl-3">
                          <div className="text-xs font-bold text-slate-700">{action.action}</div>

                          <div className="mt-1 text-xs leading-5 text-slate-500">
                            {action.reason || "No reason recorded."}
                          </div>

                          <div className="mt-1 text-[10px] text-slate-400">
                            {dateTime(action.created_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 p-5">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-slate-600" />
                    <h3 className="font-bold text-slate-900">Property</h3>
                  </div>
                </div>

                <div className="p-5">
                  <div className="text-sm font-bold text-slate-900">
                    {selectedLease.property_title}
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    {selectedLease.property_suburb ? `${selectedLease.property_suburb}, ` : ""}
                    {selectedLease.property_city}
                  </div>

                  <Link
                    to="/app/property/$id"
                    params={{ id: selectedLease.property_id }}
                    className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-slate-900"
                  >
                    Open property record
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </section>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </div>

        <span className="text-2xl font-bold tracking-tight text-slate-900">{value}</span>
      </div>

      <div className="mt-3 text-xs font-semibold text-slate-500">{label}</div>
    </div>
  );
}

function InfoCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white p-4">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
        {icon}
        {label}
      </div>

      <div className="mt-2 truncate text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  busy,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  busy: boolean;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}

function Timeline({ events, actions }: { events: EventRow[]; actions: AdminActionRow[] }) {
  const combined = [
    ...events.map((event) => ({
      id: `event-${event.id}`,
      type: "event" as const,
      title: event.event_type,
      detail: event.detail || `${event.from_status ?? "—"} → ${event.to_status ?? "—"}`,
      created_at: event.created_at,
    })),
    ...actions.map((action) => ({
      id: `action-${action.id}`,
      type: "action" as const,
      title: `Admin: ${action.action}`,
      detail: action.reason || "Administrative action recorded.",
      created_at: action.created_at,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <History className="h-4 w-4 text-slate-500" />
        <h3 className="font-bold text-slate-900">Audit timeline</h3>
      </div>

      {combined.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center">
          <History className="mx-auto h-7 w-7 text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-600">No events recorded</p>
        </div>
      ) : (
        <div className="space-y-4">
          {combined.slice(0, 10).map((item) => (
            <div key={item.id} className="flex gap-3">
              <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-slate-400" />

              <div className="min-w-0">
                <div className="text-xs font-bold capitalize text-slate-800">
                  {item.title.replace(/_/g, " ")}
                </div>

                <div className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</div>

                <div className="mt-1 text-[10px] text-slate-400">{dateTime(item.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PaymentSummary({
  payments,
  heldAmount,
  receivedAmount,
}: {
  payments: PaymentRow[];
  heldAmount: number;
  receivedAmount: number;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Wallet className="h-4 w-4 text-slate-500" />
        <h3 className="font-bold text-slate-900">Payment summary</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Legacy held
          </div>
          <div className="mt-1 text-lg font-bold text-slate-900">{money(heldAmount)}</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Paid / released
          </div>
          <div className="mt-1 text-lg font-bold text-slate-900">{money(receivedAmount)}</div>
        </div>
      </div>

      <div className="mt-4">
        {payments.length === 0 ? (
          <p className="text-sm text-slate-500">
            No payment records have been attached to this lease yet.
          </p>
        ) : (
          <div className="space-y-2">
            {payments.slice(0, 5).map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 p-3"
              >
                <div>
                  <div className="text-xs font-bold capitalize text-slate-700">
                    {payment.payment_type.replace(/_/g, " ")}
                  </div>

                  <div className="mt-0.5 text-[10px] text-slate-400">
                    {payment.reference || "No reference"}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-slate-800">
                    {money(payment.amount_usd)}
                  </div>

                  <div className="mt-0.5 text-[10px] font-semibold capitalize text-slate-500">
                    {payment.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <FileText className="h-7 w-7" />
      </div>

      <h3 className="mt-4 text-sm font-bold text-slate-800">
        {search ? "No matching leases" : "No lease records yet"}
      </h3>

      <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
        {search
          ? "Try a different property, tenant, landlord or lease identifier."
          : "Lease requests and formal lease agreements will appear here as the TNP platform is used."}
      </p>
    </div>
  );
}

function LockIcon() {
  return <Ban className="h-4 w-4" />;
}
