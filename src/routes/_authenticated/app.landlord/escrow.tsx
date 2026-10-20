import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  DollarSign,
  FileText,
  Filter,
  History,
  Landmark,
  MapPin,
  Search,
  ShieldCheck,
  User,
  Wallet,
  X,
  XCircle,
} from "lucide-react";

import { RoleSidebar } from "@/components/dashboard/RoleSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/landlord/escrow")({
  component: LandlordEscrowLedger,
});

type Payment = {
  id: string;
  lease_id: string;
  payer_id: string;
  payee_id: string | null;
  payment_type: string | null;
  amount_usd: number | string | null;
  status: string | null;
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
  rent_usd: number | string;
  deposit_usd: number | string;
  start_date: string | null;
  end_date: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  trust_score: number | null;
};

type Property = {
  id: string;
  title: string;
  suburb: string;
  city: string;
  rent_usd: number | string;
  image_url: string | null;
};

function money(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normalizeStatus(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function statusLabel(value: string | null | undefined) {
  if (!value) return "Unknown";

  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(value: string | null | undefined) {
  const status = normalizeStatus(value);

  if (status.includes("released") || status.includes("completed") || status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status.includes("pending") || status.includes("held") || status.includes("escrow")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status.includes("failed") || status.includes("cancel") || status.includes("rejected")) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function isReleased(value: string | null | undefined) {
  const status = normalizeStatus(value);

  return status.includes("released") || status.includes("completed") || status === "paid";
}

function isHeld(value: string | null | undefined) {
  const status = normalizeStatus(value);

  return status.includes("held") || status.includes("escrow") || status.includes("pending");
}

function isFailed(value: string | null | undefined) {
  const status = normalizeStatus(value);

  return status.includes("failed") || status.includes("cancel") || status.includes("rejected");
}

function LandlordEscrowLedger() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  const landlordQuery = useQuery({
    queryKey: ["landlord-escrow-current-user"],
    queryFn: async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) throw error;

      return user;
    },
  });

  const landlordId = landlordQuery.data?.id;

  const leasesQuery = useQuery({
    queryKey: ["landlord-escrow-leases", landlordId],
    enabled: Boolean(landlordId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leases" as never)
        .select(
          `
            id,
            property_id,
            tenant_id,
            landlord_id,
            status,
            rent_usd,
            deposit_usd,
            start_date,
            end_date
          `,
        )
        .eq("landlord_id" as never, landlordId!);

      if (error) throw error;

      return (data ?? []) as unknown as Lease[];
    },
  });

  const leaseIds = useMemo(
    () => (leasesQuery.data ?? []).map((lease) => lease.id),
    [leasesQuery.data],
  );

  const paymentsQuery = useQuery({
    queryKey: ["landlord-escrow-payments", leaseIds],
    enabled: Boolean(landlordId) && leasesQuery.isSuccess,
    queryFn: async () => {
      if (leaseIds.length === 0) return [];

      const paymentsClient = supabase as unknown as {
        from: (table: "lease_payments") => {
          select: (columns: string) => {
            in: (
              column: "lease_id",
              values: string[],
            ) => {
              order: (
                column: "created_at",
                options: { ascending: boolean },
              ) => PromiseLike<{ data: unknown; error: unknown }>;
            };
          };
        };
      };

      const { data, error } = await paymentsClient
        .from("lease_payments")
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
        .in("lease_id", leaseIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []) as unknown as Payment[];
    },
  });

  const payments = paymentsQuery.data ?? [];
  const leases = leasesQuery.data ?? [];

  const tenantIds = useMemo(
    () => [...new Set(payments.map((payment) => payment.payer_id))],
    [payments],
  );

  const propertyIds = useMemo(
    () => [...new Set(leases.map((lease) => lease.property_id))],
    [leases],
  );

  const profilesQuery = useQuery({
    queryKey: ["landlord-escrow-profiles", tenantIds],
    enabled: tenantIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, trust_score")
        .in("id", tenantIds);

      if (error) throw error;

      return (data ?? []) as Profile[];
    },
  });

  const propertiesQuery = useQuery({
    queryKey: ["landlord-escrow-properties", propertyIds],
    enabled: propertyIds.length > 0,
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
            image_url
          `,
        )
        .in("id", propertyIds);

      if (error) throw error;

      return (data ?? []) as Property[];
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

    for (const property of propertiesQuery.data ?? []) {
      map.set(property.id, property);
    }

    return map;
  }, [propertiesQuery.data]);

  const leaseMap = useMemo(() => {
    const map = new Map<string, Lease>();

    for (const lease of leases) {
      map.set(lease.id, lease);
    }

    return map;
  }, [leases]);

  const paymentTypes = useMemo(() => {
    return [
      ...new Set(
        payments.map((payment) => payment.payment_type?.trim()).filter(Boolean) as string[],
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [payments]);

  const statusOptions = useMemo(() => {
    return [...new Set(payments.map((payment) => payment.status).filter(Boolean) as string[])].sort(
      (a, b) => a.localeCompare(b),
    );
  }, [payments]);

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return payments.filter((payment) => {
      const lease = leaseMap.get(payment.lease_id);
      const property = lease ? propertyMap.get(lease.property_id) : undefined;
      const tenant = profileMap.get(payment.payer_id);

      const searchable = [
        tenant?.full_name,
        tenant?.phone,
        property?.title,
        property?.suburb,
        property?.city,
        payment.reference,
        payment.payment_type,
        payment.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchable.includes(query);

      const matchesStatus =
        statusFilter === "all" || normalizeStatus(payment.status) === normalizeStatus(statusFilter);

      const matchesType =
        typeFilter === "all" ||
        normalizeStatus(payment.payment_type) === normalizeStatus(typeFilter);

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [payments, leaseMap, propertyMap, profileMap, search, statusFilter, typeFilter]);

  const metrics = useMemo(() => {
    const validPayments = payments.filter((payment) => !isFailed(payment.status));

    const totalRecorded = validPayments.reduce(
      (sum, payment) => sum + Number(payment.amount_usd ?? 0),
      0,
    );

    const pendingHeld = validPayments
      .filter((payment) => isHeld(payment.status) && !isReleased(payment.status))
      .reduce((sum, payment) => sum + Number(payment.amount_usd ?? 0), 0);

    const released = validPayments
      .filter((payment) => isReleased(payment.status))
      .reduce((sum, payment) => sum + Number(payment.amount_usd ?? 0), 0);

    const failedValue = payments
      .filter((payment) => isFailed(payment.status))
      .reduce((sum, payment) => sum + Number(payment.amount_usd ?? 0), 0);

    return {
      totalRecorded,
      pendingHeld,
      released,
      failedValue,
      transactions: payments.length,
    };
  }, [payments]);

  const selectedLease = selectedPayment ? leaseMap.get(selectedPayment.lease_id) : undefined;

  const selectedProperty = selectedLease ? propertyMap.get(selectedLease.property_id) : undefined;

  const selectedTenant = selectedPayment ? profileMap.get(selectedPayment.payer_id) : undefined;

  const loading = landlordQuery.isLoading || leasesQuery.isLoading || paymentsQuery.isLoading;

  const error =
    landlordQuery.error ||
    leasesQuery.error ||
    paymentsQuery.error ||
    profilesQuery.error ||
    propertiesQuery.error;

  return (
    <SidebarProvider>
      <RoleSidebar role="landlord" />

      <SidebarInset className="tnp-module tnp-module-light min-h-screen bg-slate-50 text-slate-900">
        <div className="tnp-module tnp-module-light min-h-screen bg-slate-50">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-5 backdrop-blur-xl">
            <SidebarTrigger className="text-slate-500 hover:bg-slate-100 hover:text-slate-900" />

            <div className="h-5 w-px bg-slate-200" />

            <div>
              <p className="text-sm font-semibold text-slate-900">Escrow Ledger</p>

              <p className="text-xs text-slate-500">Financial records and payment history</p>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1600px] px-5 py-7 lg:px-8">
            <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#b7892f]">
                  <Wallet className="h-3.5 w-3.5" />
                  Landlord Finance
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Escrow Ledger</h1>

                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  Review payment activity, escrow status, release history and the financial trail
                  connected to your leases.
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 shadow-sm">
                <ShieldCheck className="h-4 w-4 text-[#b7892f]" />
                Landlord financial view
              </div>
            </div>

            {error ? (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />

                <div>
                  <p className="text-sm font-semibold text-red-700">
                    Unable to load escrow records
                  </p>

                  <p className="mt-1 text-xs text-red-600/80">
                    {error instanceof Error
                      ? error.message
                      : "An unexpected database error occurred."}
                  </p>
                </div>
              </div>
            ) : null}

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                icon={DollarSign}
                label="Total Recorded"
                value={money(metrics.totalRecorded)}
                description="Non-failed payments"
              />

              <MetricCard
                icon={Clock3}
                label="Pending / Held"
                value={money(metrics.pendingHeld)}
                description="Funds not yet released"
              />

              <MetricCard
                icon={CheckCircle2}
                label="Released"
                value={money(metrics.released)}
                description="Completed releases"
              />

              <MetricCard
                icon={XCircle}
                label="Failed / Cancelled"
                value={money(metrics.failedValue)}
                description="Excluded from active funds"
              />

              <MetricCard
                icon={History}
                label="Transactions"
                value={String(metrics.transactions)}
                description="Recorded payment events"
              />
            </section>

            <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Payment Ledger</h2>

                    <p className="mt-1 text-xs text-slate-500">
                      Every payment connected to your landlord leases.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Landmark className="h-4 w-4" />
                    {filteredPayments.length} visible record
                    {filteredPayments.length === 1 ? "" : "s"}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_190px_190px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search tenant, property, reference..."
                      className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#b7892f]/50 focus:bg-white focus:ring-2 focus:ring-[#b7892f]/10"
                    />
                  </div>

                  <div className="relative">
                    <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />

                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-[#b7892f]/50 focus:bg-white"
                    >
                      <option value="all">All statuses</option>

                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {statusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <select
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-[#b7892f]/50 focus:bg-white"
                  >
                    <option value="all">All payment types</option>

                    {paymentTypes.map((type) => (
                      <option key={type} value={type}>
                        {statusLabel(type)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="divide-y divide-slate-100">
                  {[1, 2, 3, 4].map((item) => (
                    <div key={item} className="flex animate-pulse items-center gap-4 p-5">
                      <div className="h-10 w-10 rounded-lg bg-slate-100" />

                      <div className="flex-1">
                        <div className="h-3 w-40 rounded bg-slate-100" />

                        <div className="mt-2 h-2.5 w-64 rounded bg-slate-100" />
                      </div>

                      <div className="h-4 w-20 rounded bg-slate-100" />
                    </div>
                  ))}
                </div>
              ) : filteredPayments.length === 0 ? (
                <EmptyState
                  hasFilters={Boolean(search) || statusFilter !== "all" || typeFilter !== "all"}
                  onClear={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setTypeFilter("all");
                  }}
                />
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredPayments.map((payment) => {
                    const lease = leaseMap.get(payment.lease_id);
                    const property = lease ? propertyMap.get(lease.property_id) : undefined;
                    const tenant = profileMap.get(payment.payer_id);

                    return (
                      <button
                        key={payment.id}
                        type="button"
                        onClick={() => setSelectedPayment(payment)}
                        className="group flex w-full items-center gap-4 p-5 text-left transition hover:bg-slate-50"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                          <Wallet className="h-4 w-4 text-[#b7892f]" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {tenant?.full_name || "Unknown tenant"}
                            </p>

                            <span className="text-slate-300">•</span>

                            <p className="truncate text-xs text-slate-500">
                              {property?.title || "Property unavailable"}
                            </p>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                            <span>{statusLabel(payment.payment_type || "Payment")}</span>

                            <span>
                              {payment.reference ? `Ref ${payment.reference}` : "No reference"}
                            </span>

                            <span>{formatDate(payment.paid_at || payment.created_at)}</span>
                          </div>
                        </div>

                        <div className="hidden text-right sm:block">
                          <p className="text-sm font-bold text-slate-900">
                            {money(payment.amount_usd)}
                          </p>

                          <span
                            className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass(
                              payment.status,
                            )}`}
                          >
                            {statusLabel(payment.status)}
                          </span>
                        </div>

                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="mt-6 grid gap-4 lg:grid-cols-3">
              <InfoCard
                icon={ShieldCheck}
                title="Financial Audit Trail"
                text="Payment records remain connected to the underlying lease so activity can be reviewed in its tenancy context."
              />

              <InfoCard
                icon={FileText}
                title="Payment References"
                text="References, payment types, timestamps and release dates are displayed where recorded."
              />

              <InfoCard
                icon={History}
                title="Lease Context"
                text="Each transaction can be traced back to the lease, property and tenant involved."
              />
            </section>
          </main>
        </div>

        {selectedPayment ? (
          <PaymentDetail
            payment={selectedPayment}
            lease={selectedLease}
            property={selectedProperty}
            tenant={selectedTenant}
            onClose={() => setSelectedPayment(null)}
          />
        ) : null}
      </SidebarInset>
    </SidebarProvider>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#b7892f]/15 bg-[#b7892f]/[0.06]">
          <Icon className="h-4 w-4 text-[#b7892f]" />
        </div>

        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-300">
          Ledger
        </span>
      </div>

      <p className="mt-4 text-xs font-medium text-slate-500">{label}</p>

      <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">{value}</p>

      <p className="mt-1 text-[11px] text-slate-400">{description}</p>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof ShieldCheck;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#b7892f]/15 bg-[#b7892f]/[0.06]">
        <Icon className="h-4 w-4 text-[#b7892f]" />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-slate-900">{title}</h3>

      <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
    </div>
  );
}

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
        <Wallet className="h-6 w-6 text-slate-400" />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-slate-900">
        {hasFilters ? "No matching payment records" : "No escrow records yet"}
      </h3>

      <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
        {hasFilters
          ? "Try changing your search or filters to see other payment records."
          : "Payment activity will appear here once payments are recorded against your landlord leases."}
      </p>

      {hasFilters ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}

function PaymentDetail({
  payment,
  lease,
  property,
  tenant,
  onClose,
}: {
  payment: Payment;
  lease: Lease | undefined;
  property: Property | undefined;
  tenant: Profile | undefined;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close payment details"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      <aside className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b7892f]">
              Payment Record
            </p>

            <h2 className="mt-1 text-lg font-bold text-slate-900">Transaction details</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="border-b border-slate-200 bg-slate-50 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500">Recorded amount</p>

                <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                  {money(payment.amount_usd)}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {statusLabel(payment.payment_type || "Payment")}
                </p>
              </div>

              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(
                  payment.status,
                )}`}
              >
                {statusLabel(payment.status)}
              </span>
            </div>
          </div>

          <DetailSection title="Payment information">
            <DetailRow
              icon={FileText}
              label="Payment type"
              value={statusLabel(payment.payment_type || "Not specified")}
            />

            <DetailRow
              icon={FileText}
              label="Reference"
              value={payment.reference || "No reference recorded"}
            />

            <DetailRow icon={CalendarDays} label="Created" value={formatDate(payment.created_at)} />

            <DetailRow icon={CalendarDays} label="Paid" value={formatDate(payment.paid_at)} />

            <DetailRow
              icon={ArrowDownToLine}
              label="Released"
              value={formatDate(payment.released_at)}
            />
          </DetailSection>

          <DetailSection title="Tenant / payer">
            <DetailRow
              icon={User}
              label="Tenant"
              value={tenant?.full_name || "Profile unavailable"}
            />

            <DetailRow
              icon={User}
              label="Trust score"
              value={tenant?.trust_score != null ? `${tenant.trust_score}/100` : "Not available"}
            />

            <DetailRow icon={User} label="Phone" value={tenant?.phone || "Not provided"} />
          </DetailSection>

          <DetailSection title="Property">
            <DetailRow
              icon={Building2}
              label="Property"
              value={property?.title || "Property unavailable"}
            />

            <DetailRow
              icon={MapPin}
              label="Location"
              value={property ? `${property.suburb}, ${property.city}` : "Not available"}
            />

            <DetailRow
              icon={DollarSign}
              label="Listed rent"
              value={property ? money(property.rent_usd) : "Not available"}
            />
          </DetailSection>

          <DetailSection title="Lease context">
            <DetailRow
              icon={FileText}
              label="Lease status"
              value={lease ? statusLabel(lease.status) : "Lease unavailable"}
            />

            <DetailRow
              icon={CalendarDays}
              label="Start date"
              value={formatDate(lease?.start_date)}
            />

            <DetailRow icon={CalendarDays} label="End date" value={formatDate(lease?.end_date)} />

            <DetailRow
              icon={DollarSign}
              label="Lease rent"
              value={lease ? money(lease.rent_usd) : "Not available"}
            />

            <DetailRow
              icon={DollarSign}
              label="Deposit"
              value={lease ? money(lease.deposit_usd) : "Not available"}
            />
          </DetailSection>

          <div className="m-5 rounded-lg border border-[#b7892f]/15 bg-[#b7892f]/[0.04] p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#b7892f]" />

              <div>
                <p className="text-xs font-semibold text-[#9a7428]">Ledger integrity</p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  This record is displayed from the payment ledger associated with the
                  landlord&apos;s lease records. No payment amount or release state is changed from
                  this view.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-white p-4">
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to ledger
          </button>
        </div>
      </aside>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-slate-100 p-5">
      <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {title}
      </h3>

      <div className="space-y-1">{children}</div>
    </section>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg px-2 py-2.5 transition hover:bg-slate-50">
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />

        <span className="text-xs text-slate-500">{label}</span>
      </div>

      <span className="max-w-[60%] truncate text-right text-xs font-semibold text-slate-800">
        {value}
      </span>
    </div>
  );
}
