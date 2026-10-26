import { ManualPaymentTrail } from "@/modules/payments/manual/ManualPayments";
import { PaymentEvidence } from "@/modules/payments/PaymentEvidence";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  DollarSign,
  Eye,
  FileText,
  Filter,
  Lock,
  RefreshCw,
  Search,
  ShieldAlert,
  Unlock,
  Wallet,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ElementType } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/admin/payments")({
  component: AdminPayments,
});

type PaymentStatus =
  "paid" | "processing" | "pending" | "held" | "released" | "refunded" | "failed" | "disputed";

type PaymentType = "deposit" | "rent" | "admin_fee" | "utility" | "late_fee" | "other" | "refund";

type Payment = {
  id: string;
  lease_id: string;
  payer_id: string;
  payee_id: string | null;
  payment_type: PaymentType;
  amount_usd: number;
  status: PaymentStatus;
  reference: string | null;
  paid_at: string | null;
  released_at: string | null;
  created_at: string;
};

type Lease = {
  id: string;
  property_id: string;
  tenant_id: string;
  landlord_id: string;
  status: string;
  rent_usd: number;
  deposit_usd: number;
  start_date: string | null;
  end_date: string | null;
};

type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
};

type Property = {
  id: string;
  title: string;
  city: string;
  suburb: string;
};

type PaymentAction = {
  id: string;
  payment_id: string;
  admin_id: string;
  action: string;
  reason: string | null;
  created_at: string;
};

const STATUS_CONFIG: Record<
  PaymentStatus,
  {
    label: string;
    className: string;
  }
> = {
  paid: {
    label: "Provider-confirmed paid",
    className: "bg-emerald-500/10 text-emerald-300 border-emerald-400/20",
  },
  processing: {
    label: "Processing — awaiting confirmation",
    className: "bg-amber-500/10 text-amber-300 border-amber-400/20",
  },
  pending: {
    label: "Pending",
    className: "bg-amber-500/10 text-amber-300 border-amber-400/20",
  },
  held: {
    label: "Held in Escrow",
    className: "bg-blue-500/10 text-blue-300 border-blue-400/20",
  },
  released: {
    label: "Released",
    className: "bg-emerald-500/10 text-emerald-300 border-emerald-400/20",
  },
  refunded: {
    label: "Refunded",
    className: "bg-violet-500/10 text-violet-300 border-violet-400/20",
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/10 text-red-300 border-red-400/20",
  },
  disputed: {
    label: "Disputed",
    className: "bg-orange-500/10 text-orange-300 border-orange-400/20",
  },
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function paymentTypeLabel(type: PaymentType) {
  switch (type) {
    case "deposit":
      return "Security Deposit";
    case "rent":
      return "Rent";
    case "admin_fee":
      return "Admin Fee";
    case "utility":
      return "Utility";
    case "late_fee":
      return "Late fee";
    case "refund":
      return "Refund";
    default:
      return "Other";
  }
}

function statusIcon(status: PaymentStatus) {
  switch (status) {
    case "paid":
    case "released":
      return CheckCircle2;
    case "held":
      return Lock;
    case "pending":
    case "processing":
      return Clock3;
    case "refunded":
      return RefreshCw;
    case "failed":
      return XCircle;
    case "disputed":
      return ShieldAlert;
    default:
      return CreditCard;
  }
}

function AdminPayments() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PaymentStatus>("all");
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const db = supabase;

  /* ============================================================
     PAYMENTS
  ============================================================ */

  const paymentsQuery = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const { data, error } = await db
        .from("lease_payments" as never)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []) as Payment[];
    },
  });

  /* ============================================================
     LEASES
  ============================================================ */

  const leasesQuery = useQuery({
    queryKey: ["admin-payment-leases"],
    queryFn: async () => {
      const { data, error } = await db
        .from("leases" as never)
        .select(
          "id, property_id, tenant_id, landlord_id, status, rent_usd, deposit_usd, start_date, end_date",
        );

      if (error) throw error;

      return (data ?? []) as Lease[];
    },
  });

  /* ============================================================
     PROFILES
  ============================================================ */

  const profilesQuery = useQuery({
    queryKey: ["admin-payment-profiles"],
    queryFn: async () => {
      const { data, error } = await db.from("profiles").select("id, full_name, phone");

      if (error) throw error;

      return (data ?? []) as Profile[];
    },
  });

  /* ============================================================
     PROPERTIES
  ============================================================ */

  const propertiesQuery = useQuery({
    queryKey: ["admin-payment-properties"],
    queryFn: async () => {
      const { data, error } = await db.from("properties").select("id, title, city, suburb");

      if (error) throw error;

      return (data ?? []) as Property[];
    },
  });

  /* ============================================================
     AUDIT ACTIONS
  ============================================================ */

  const actionsQuery = useQuery({
    queryKey: ["admin-payment-actions"],
    queryFn: async () => {
      const { data, error } = await db
        .from("payment_admin_actions" as never)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []) as PaymentAction[];
    },
  });

  const payments = useMemo(() => paymentsQuery.data ?? [], [paymentsQuery.data]);
  const leases = useMemo(() => leasesQuery.data ?? [], [leasesQuery.data]);
  const profiles = useMemo(() => profilesQuery.data ?? [], [profilesQuery.data]);
  const properties = useMemo(() => propertiesQuery.data ?? [], [propertiesQuery.data]);
  const actions = actionsQuery.data ?? [];

  /* ============================================================
     LOOKUPS
  ============================================================ */

  const leaseMap = useMemo(() => new Map(leases.map((lease) => [lease.id, lease])), [leases]);

  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  const propertyMap = useMemo(
    () => new Map(properties.map((property) => [property.id, property])),
    [properties],
  );

  /* ============================================================
     ENRICHED PAYMENTS
  ============================================================ */

  const enrichedPayments = useMemo(() => {
    return payments.map((payment) => {
      const lease = leaseMap.get(payment.lease_id);
      const tenant = profileMap.get(payment.payer_id);
      const landlord = payment.payee_id ? profileMap.get(payment.payee_id) : undefined;
      const property = lease ? propertyMap.get(lease.property_id) : undefined;

      return {
        ...payment,
        lease,
        tenant,
        landlord,
        property,
      };
    });
  }, [payments, leaseMap, profileMap, propertyMap]);

  /* ============================================================
     FILTER
  ============================================================ */

  const filteredPayments = useMemo(() => {
    const term = search.trim().toLowerCase();

    return enrichedPayments.filter((payment) => {
      const matchesStatus = statusFilter === "all" || payment.status === statusFilter;

      if (!matchesStatus) return false;

      if (!term) return true;

      return [
        payment.id,
        payment.reference,
        payment.lease_id,
        payment.tenant?.full_name,
        payment.landlord?.full_name,
        payment.property?.title,
        payment.property?.city,
        payment.property?.suburb,
        paymentTypeLabel(payment.payment_type),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [enrichedPayments, search, statusFilter]);

  /* ============================================================
     STATS
  ============================================================ */

  const stats = useMemo(() => {
    const total = payments.reduce((sum, payment) => sum + Number(payment.amount_usd || 0), 0);

    const held = payments
      .filter((payment) => payment.status === "held")
      .reduce((sum, payment) => sum + Number(payment.amount_usd || 0), 0);

    const released = payments
      .filter((payment) => payment.status === "released")
      .reduce((sum, payment) => sum + Number(payment.amount_usd || 0), 0);

    const disputed = payments
      .filter((payment) => payment.status === "disputed")
      .reduce((sum, payment) => sum + Number(payment.amount_usd || 0), 0);

    return {
      count: payments.length,
      total,
      held,
      released,
      disputed,
      pending: payments.filter((p) => ["pending", "processing"].includes(p.status)).length,
      failed: payments.filter((p) => p.status === "failed").length,
    };
  }, [payments]);

  /* ============================================================
     SELECTED PAYMENT
  ============================================================ */

  const selectedPayment = enrichedPayments.find((payment) => payment.id === selectedPaymentId);

  const selectedActions = selectedPayment
    ? actions.filter((action) => action.payment_id === selectedPayment.id)
    : [];

  /* ============================================================
     ACTION HANDLER
  ============================================================ */

  async function updatePaymentStatus(payment: Payment, newStatus: PaymentStatus, action: string) {
    setActionLoading(true);
    setActionMessage(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Your admin session has expired.");
      }

      const { error } = await supabase.rpc(
        "tnp_record_payment_status" as never,
        { p_payment_id: payment.id, p_status: newStatus, p_action: action } as never,
      );
      if (error) throw new Error(error.message);

      setActionMessage(`Payment successfully moved to ${STATUS_CONFIG[newStatus].label}.`);

      await queryClient.invalidateQueries({
        queryKey: ["admin-payments"],
      });

      await queryClient.invalidateQueries({
        queryKey: ["admin-payment-actions"],
      });
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Unable to update the payment.");
    } finally {
      setActionLoading(false);
    }
  }

  /* ============================================================
     LOADING
  ============================================================ */

  if (
    paymentsQuery.isLoading ||
    leasesQuery.isLoading ||
    profilesQuery.isLoading ||
    propertiesQuery.isLoading
  ) {
    return (
      <div className="tnp-module tnp-module-dark min-h-screen bg-[#090a0a] p-6 text-white">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex items-center gap-3 text-white/50">
            <RefreshCw className="size-5 animate-spin" />
            Loading payment ledger...
          </div>
        </div>
      </div>
    );
  }

  /* ============================================================
     ERROR
  ============================================================ */

  if (paymentsQuery.error) {
    return (
      <div className="tnp-module tnp-module-dark min-h-screen bg-[#090a0a] p-6 text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 text-red-300" />

            <div>
              <h2 className="font-semibold text-white">Payment ledger could not be loaded</h2>

              <p className="mt-2 text-sm text-white/50">
                {paymentsQuery.error instanceof Error
                  ? paymentsQuery.error.message
                  : "An unexpected database error occurred."}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ============================================================
     MAIN
  ============================================================ */

  return (
    <div className="tnp-module tnp-module-dark min-h-screen bg-[#090a0a] text-white">
      <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
        <ManualPaymentTrail role="admin" />
        <PaymentEvidence />
        {/* ======================================================
            HEADER
        ====================================================== */}

        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#c99552]">
              <ShieldAlert className="size-4" />
              Financial Control
            </div>

            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Payments & Receipts</h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
              Monitor payment activity, escrow balances, releases, refunds, failed transactions and
              disputed funds across the TNP network.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              paymentsQuery.refetch();
              leasesQuery.refetch();
              profilesQuery.refetch();
              propertiesQuery.refetch();
              actionsQuery.refetch();
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-sm font-medium text-white/70 transition hover:bg-white/[0.06] hover:text-white"
          >
            <RefreshCw className="size-4" />
            Refresh Ledger
          </button>
        </div>

        {/* ======================================================
            STAT CARDS
        ====================================================== */}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            title="Total Volume"
            value={formatMoney(stats.total)}
            subtitle={`${stats.count} recorded payments`}
            icon={DollarSign}
          />

          <StatCard
            title="Held in Escrow"
            value={formatMoney(stats.held)}
            subtitle="Funds currently protected"
            icon={Lock}
          />

          <StatCard
            title="Released"
            value={formatMoney(stats.released)}
            subtitle="Funds released to recipients"
            icon={Unlock}
          />

          <StatCard
            title="Pending"
            value={String(stats.pending)}
            subtitle="Awaiting processing"
            icon={Clock3}
          />

          <StatCard
            title="Disputed"
            value={formatMoney(stats.disputed)}
            subtitle={`${stats.failed} failed transactions`}
            icon={ShieldAlert}
          />
        </div>

        {/* ======================================================
            WORKSPACE
        ====================================================== */}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          {/* ====================================================
              PAYMENT LIST
          ==================================================== */}

          <section className="min-w-0 rounded-2xl border border-white/[0.07] bg-white/[0.02]">
            <div className="border-b border-white/[0.07] p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="font-semibold text-white">Payment Ledger</h2>
                  <p className="mt-1 text-xs text-white/35">
                    {filteredPayments.length} payment
                    {filteredPayments.length === 1 ? "" : "s"} displayed
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/25" />

                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search payments..."
                      className="h-10 w-full rounded-xl border border-white/[0.08] bg-black/20 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#c99552]/40 sm:w-64"
                    />
                  </div>

                  <div className="relative">
                    <Filter className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/25" />

                    <select
                      value={statusFilter}
                      onChange={(event) =>
                        setStatusFilter(event.target.value as "all" | PaymentStatus)
                      }
                      className="h-10 w-full appearance-none rounded-xl border border-white/[0.08] bg-[#111313] pl-9 pr-8 text-sm text-white/70 outline-none focus:border-[#c99552]/40 sm:w-44"
                    >
                      <option value="all">All statuses</option>
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="paid">Provider-confirmed paid</option>
                      <option value="held">Held</option>
                      <option value="released">Released</option>
                      <option value="refunded">Refunded</option>
                      <option value="failed">Failed</option>
                      <option value="disputed">Disputed</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {filteredPayments.length === 0 ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.03]">
                  <Wallet className="size-6 text-white/25" />
                </div>

                <h3 className="mt-4 font-semibold text-white">No payments found</h3>

                <p className="mt-2 max-w-sm text-sm leading-6 text-white/35">
                  There are currently no payments matching the selected filters.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {filteredPayments.map((payment) => {
                  const StatusIcon = statusIcon(payment.status);
                  const selected = payment.id === selectedPaymentId;

                  return (
                    <button
                      key={payment.id}
                      type="button"
                      onClick={() => setSelectedPaymentId(payment.id)}
                      className={[
                        "group flex w-full items-center gap-4 px-4 py-4 text-left transition sm:px-5",
                        selected ? "bg-[#c99552]/[0.06]" : "hover:bg-white/[0.025]",
                      ].join(" ")}
                    >
                      <div className="hidden size-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] sm:flex">
                        <CreditCard className="size-4 text-[#d4a15d]" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-white">
                            {paymentTypeLabel(payment.payment_type)}
                          </span>

                          <span
                            className={[
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              STATUS_CONFIG[payment.status].className,
                            ].join(" ")}
                          >
                            <StatusIcon className="size-3" />
                            {STATUS_CONFIG[payment.status].label}
                          </span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/35">
                          <span>{payment.tenant?.full_name || "Unknown payer"}</span>

                          <span>•</span>

                          <span>{payment.property?.title || "Unknown property"}</span>

                          {payment.reference && (
                            <>
                              <span>•</span>
                              <span>{payment.reference}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="font-semibold text-white">
                          {formatMoney(Number(payment.amount_usd))}
                        </div>

                        <div className="mt-1 text-[11px] text-white/30">
                          {formatDate(payment.created_at)}
                        </div>
                      </div>

                      <ChevronRight
                        className={[
                          "size-4 shrink-0 transition",
                          selected ? "text-[#c99552]" : "text-white/15 group-hover:text-white/40",
                        ].join(" ")}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* ====================================================
              INSPECTION PANEL
          ==================================================== */}

          <aside className="rounded-2xl border border-white/[0.07] bg-white/[0.02]">
            {!selectedPayment ? (
              <div className="flex min-h-[500px] flex-col items-center justify-center px-6 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.03]">
                  <Eye className="size-6 text-white/25" />
                </div>

                <h3 className="mt-4 font-semibold text-white">Payment inspection</h3>

                <p className="mt-2 max-w-xs text-sm leading-6 text-white/35">
                  Select a payment from the ledger to inspect its escrow state, parties, property
                  and audit history.
                </p>
              </div>
            ) : (
              <div>
                <div className="border-b border-white/[0.07] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c99552]">
                        Payment inspection
                      </p>

                      <h2 className="mt-2 text-lg font-semibold text-white">
                        {formatMoney(Number(selectedPayment.amount_usd))}
                      </h2>

                      <p className="mt-1 text-xs text-white/35">
                        {paymentTypeLabel(selectedPayment.payment_type)}
                      </p>
                    </div>

                    <span
                      className={[
                        "rounded-full border px-2.5 py-1 text-[10px] font-semibold",
                        STATUS_CONFIG[selectedPayment.status].className,
                      ].join(" ")}
                    >
                      {STATUS_CONFIG[selectedPayment.status].label}
                    </span>
                  </div>
                </div>

                <div className="space-y-6 p-5">
                  {/* Payment identity */}

                  <InfoSection title="Payment">
                    <InfoRow label="Payment ID" value={selectedPayment.id} mono />
                    <InfoRow
                      label="Reference"
                      value={selectedPayment.reference || "No reference"}
                    />
                    <InfoRow label="Created" value={formatDateTime(selectedPayment.created_at)} />
                    <InfoRow label="Paid" value={formatDateTime(selectedPayment.paid_at)} />
                    <InfoRow label="Released" value={formatDateTime(selectedPayment.released_at)} />
                  </InfoSection>

                  {/* Parties */}

                  <InfoSection title="Parties">
                    <InfoRow label="Payer" value={selectedPayment.tenant?.full_name || "Unknown"} />

                    <InfoRow label="Payer phone" value={selectedPayment.tenant?.phone || "—"} />

                    <InfoRow
                      label="Recipient"
                      value={selectedPayment.landlord?.full_name || "Not assigned"}
                    />
                  </InfoSection>

                  {/* Property */}

                  <InfoSection title="Lease & Property">
                    <InfoRow label="Lease" value={selectedPayment.lease_id} mono />

                    <InfoRow
                      label="Property"
                      value={selectedPayment.property?.title || "Unknown"}
                    />

                    <InfoRow
                      label="Location"
                      value={
                        selectedPayment.property
                          ? `${selectedPayment.property.suburb}, ${selectedPayment.property.city}`
                          : "—"
                      }
                    />

                    <InfoRow
                      label="Lease status"
                      value={selectedPayment.lease?.status || "Unknown"}
                    />
                  </InfoSection>

                  {/* Financial context */}

                  <InfoSection title="Financial Context">
                    <InfoRow
                      label="Payment amount"
                      value={formatMoney(Number(selectedPayment.amount_usd))}
                    />

                    <InfoRow
                      label="Monthly rent"
                      value={
                        selectedPayment.lease
                          ? formatMoney(Number(selectedPayment.lease.rent_usd))
                          : "—"
                      }
                    />

                    <InfoRow
                      label="Deposit"
                      value={
                        selectedPayment.lease
                          ? formatMoney(Number(selectedPayment.lease.deposit_usd))
                          : "—"
                      }
                    />
                  </InfoSection>

                  {/* Actions */}

                  <InfoSection title="Administrative Actions">
                    <div className="grid gap-2">
                      {selectedPayment.status === "pending" && (
                        <ActionButton
                          icon={Lock}
                          label="Hold in Escrow"
                          disabled={actionLoading}
                          onClick={() => updatePaymentStatus(selectedPayment, "held", "held")}
                        />
                      )}

                      {selectedPayment.status === "held" && (
                        <ActionButton
                          icon={Unlock}
                          label="Release Funds"
                          disabled={actionLoading}
                          onClick={() =>
                            updatePaymentStatus(selectedPayment, "released", "released")
                          }
                        />
                      )}

                      {(selectedPayment.status === "pending" ||
                        selectedPayment.status === "held") && (
                        <ActionButton
                          icon={ShieldAlert}
                          label="Mark as Disputed"
                          disabled={actionLoading}
                          danger
                          onClick={() =>
                            updatePaymentStatus(selectedPayment, "disputed", "disputed")
                          }
                        />
                      )}

                      {selectedPayment.status === "released" && (
                        <ActionButton
                          icon={RefreshCw}
                          label="Refund Payment"
                          disabled={actionLoading}
                          onClick={() =>
                            updatePaymentStatus(selectedPayment, "refunded", "refunded")
                          }
                        />
                      )}

                      {selectedPayment.status === "disputed" && (
                        <ActionButton
                          icon={Unlock}
                          label="Release After Review"
                          disabled={actionLoading}
                          onClick={() =>
                            updatePaymentStatus(selectedPayment, "released", "released")
                          }
                        />
                      )}

                      {actionMessage && (
                        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 text-xs leading-5 text-white/55">
                          {actionMessage}
                        </div>
                      )}
                    </div>
                  </InfoSection>

                  {/* Audit */}

                  <InfoSection title="Audit Trail">
                    {selectedActions.length === 0 ? (
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-white/30">
                        No administrative actions recorded yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedActions.map((action) => (
                          <div key={action.id} className="border-l border-[#c99552]/30 pl-3">
                            <div className="text-xs font-medium text-white/70">
                              {action.action.replaceAll("_", " ")}
                            </div>

                            <div className="mt-1 text-[11px] text-white/30">
                              {formatDateTime(action.created_at)}
                            </div>

                            {action.reason && (
                              <p className="mt-1 text-xs leading-5 text-white/35">
                                {action.reason}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </InfoSection>
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* ======================================================
            FOOTER STATUS
        ====================================================== */}

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10">
              <CheckCircle2 className="size-4 text-emerald-300" />
            </div>

            <div>
              <p className="text-sm font-medium text-white">Ledger monitoring active</p>

              <p className="text-xs text-white/30">
                Administrative payment actions are recorded for auditability.
              </p>
            </div>
          </div>

          <div className="text-xs text-white/25">TNP Financial Control</div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   COMPONENTS
============================================================ */

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: ElementType;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-white/40">{title}</span>

        <div className="flex size-9 items-center justify-center rounded-xl bg-[#c99552]/10 text-[#dcae68]">
          <Icon className="size-4" />
        </div>
      </div>

      <div className="mt-4 text-xl font-bold tracking-tight text-white">{value}</div>

      <p className="mt-1 text-[11px] text-white/30">{subtitle}</p>
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
        {title}
      </h3>

      <div className="space-y-1 rounded-xl border border-white/[0.06] bg-black/10 p-3">
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="shrink-0 text-xs text-white/30">{label}</span>

      <span
        className={[
          "max-w-[65%] break-all text-right text-xs text-white/65",
          mono ? "font-mono text-[10px]" : "",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger = false,
}: {
  icon: ElementType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
        danger
          ? "border-red-500/20 bg-red-500/5 text-red-300 hover:bg-red-500/10"
          : "border-white/[0.08] bg-white/[0.03] text-white/65 hover:bg-white/[0.06] hover:text-white",
      ].join(" ")}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}
