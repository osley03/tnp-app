import { leaseGroup } from "@/lib/lease-group";
import { isSettledPayment } from "@/modules/payments/ledger";
import { nextRentDate } from "@/lib/rent-schedule";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Home,
  Loader2,
  Mail,
  MessageSquareWarning,
  RefreshCw,
  ShieldCheck,
  Wallet,
  X,
  Building2,
  UserRound,
  Banknote,
  CircleDollarSign,
  History,
  CircleAlert,
  Send,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/tenant/leases")({
  component: TenantLeases,
});

type Lease = {
  id: string;
  lease_request_id?: string | null;
  property_id: string;
  tenant_id: string;
  landlord_id: string;
  status: string;
  rent_usd: number;
  deposit_usd: number;
  start_date?: string | null;
  end_date?: string | null;
  signed_at?: string | null;
  terms?: string | null;
  admin_notes?: string | null;
  created_at: string;
  updated_at: string;

  payment_frequency?: string | null;
  payment_due_day?: number | null;
  escrow_status?: string | null;
  document_url?: string | null;
  renewal_status?: string | null;
  renewal_requested_at?: string | null;
  renewal_notice_days?: number | null;
  termination_reason?: string | null;
};

type Property = {
  id: string;
  title?: string | null;
  name?: string | null;
  address?: string | null;
  city?: string | null;
  location?: string | null;
  description?: string | null;
  image_url?: string | null;
  cover_image?: string | null;
  images?: unknown;
};

type Profile = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  bio?: string | null;
  verification?: string | null;
  trust_score?: number | null;
};

type LeaseDocument = {
  id: string;
  lease_id: string;
  name: string;
  document_type: string;
  status: string;
  document_url?: string | null;
  notes?: string | null;
  uploaded_by?: string | null;
  created_at: string;
  updated_at: string;
};

type LeaseEvent = {
  id: string;
  lease_id: string;
  actor_id?: string | null;
  event_type?: string | null;
  from_status?: string | null;
  to_status?: string | null;
  detail?: string | null;
  created_at: string;
};

type LeasePayment = {
  id: string;
  lease_id: string;
  amount?: number | string | null;
  amount_usd?: number | string | null;
  status?: string | null;
  payment_status?: string | null;
  payment_date?: string | null;
  due_date?: string | null;
  created_at?: string | null;
  reference?: string | null;
};

type DisputeForm = {
  title: string;
  description: string;
  category: string;
  priority: string;
};

const formatCurrency = (value: number | string | null | undefined) => {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
};

const formatDate = (value?: string | null, fallback = "Not provided") => {
  if (!value) return fallback;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "Not provided";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not provided";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const titleCase = (value?: string | null) => {
  if (!value) return "Unknown";

  return value.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const getPropertyName = (property?: Property | null) =>
  property?.title || property?.name || "TNP Property";

const getPropertyAddress = (property?: Property | null) =>
  property?.address || property?.location || property?.city || "Address not provided";

const getPropertyImage = (property?: Property | null) => {
  if (!property) return null;

  if (property.cover_image) return property.cover_image;
  if (property.image_url) return property.image_url;

  if (Array.isArray(property.images)) {
    const first = property.images[0];

    if (typeof first === "string") return first;

    if (first && typeof first === "object" && "url" in first && typeof first.url === "string") {
      return first.url;
    }
  }

  return null;
};

const normalizeStatus = (status?: string | null) =>
  (status || "").toLowerCase().replace(/\s+/g, "_");

function getLeaseGroup(lease: Lease) {
  return leaseGroup(lease);
}

function getDaysUntil(date?: string | null) {
  if (!date) return null;

  const target = new Date(date);
  const now = new Date();

  if (Number.isNaN(target.getTime())) return null;

  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getNextPaymentDate(lease: Lease) {
  return nextRentDate(lease.start_date, lease.payment_due_day, new Date(), lease.end_date);
}

function getPaymentAmount(payment: LeasePayment) {
  return Number(payment.amount_usd ?? payment.amount ?? 0);
}

function getPaymentStatus(payment: LeasePayment) {
  return normalizeStatus(payment.payment_status ?? payment.status);
}

function getDocumentStatusClasses(status: string) {
  switch (normalizeStatus(status)) {
    case "verified":
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "submitted":
    case "under_review":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "rejected":
      return "border-red-200 bg-red-50 text-red-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getLeaseStatusClasses(status: string) {
  switch (normalizeStatus(status)) {
    case "active":
    case "signed":
    case "running":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "upcoming":
    case "approved":
    case "pending_start":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "expired":
    case "terminated":
    case "cancelled":
    case "closed":
      return "border-slate-200 bg-slate-100 text-slate-600";

    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function TenantLeases() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"all" | "active" | "upcoming" | "past">("all");

  const [documentOpen, setDocumentOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);

  const [disputeLease, setDisputeLease] = useState<Lease | null>(null);

  const [disputeForm, setDisputeForm] = useState<DisputeForm>({
    title: "",
    description: "",
    category: "Lease issue",
    priority: "medium",
  });

  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const leasesQuery = useQuery({
    queryKey: ["tenant-leases"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be signed in to view your leases.");
      }

      const { data, error } = await supabase
        .from("leases" as never)
        .select("*")
        .eq("tenant_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (error) throw error;

      return (data || []) as unknown as Lease[];
    },
  });

  const leases = leasesQuery.data ?? [];

  const propertyIds = [...new Set(leases.map(lease => lease.property_id))].sort();
  const leaseProperties = useQuery({
    queryKey: ["tenant-lease-properties", propertyIds],
    enabled: propertyIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*").in("id", propertyIds);
      if (error) throw error;
      return (data ?? []) as Property[];
    },
  });

  const selectedLease = useMemo(
    () => leases.find((lease) => lease.id === selectedLeaseId) ?? null,
    [leases, selectedLeaseId],
  );

  const filteredLeases = useMemo(() => {
    if (activeTab === "all") return leases;

    return leases.filter((lease) => getLeaseGroup(lease) === activeTab);
  }, [leases, activeTab]);

  const activeCount = leases.filter((lease) => getLeaseGroup(lease) === "active").length;

  const upcomingCount = leases.filter((lease) => getLeaseGroup(lease) === "upcoming").length;

  const pastCount = leases.filter((lease) => getLeaseGroup(lease) === "past").length;

  const selectedPropertyQuery = useQuery({
    queryKey: ["tenant-lease-property", selectedLease?.property_id],
    enabled: Boolean(selectedLease?.property_id),
    queryFn: async () => {
      if (!selectedLease?.property_id) return null;

      const { data, error } = await supabase
        .from("properties" as never)
        .select("*")
        .eq("id", selectedLease.property_id)
        .maybeSingle();

      if (error) throw error;

      return (data as unknown as Property | null) ?? null;
    },
  });

  const selectedLandlordQuery = useQuery({
    queryKey: ["tenant-lease-landlord", selectedLease?.landlord_id],
    enabled: Boolean(selectedLease?.landlord_id),
    queryFn: async () => {
      if (!selectedLease?.landlord_id) return null;

      const { data, error } = await supabase
        .from("profiles" as never)
        .select("id, full_name, phone, bio, verification, trust_score")
        .eq("id", selectedLease.landlord_id)
        .maybeSingle();

      if (error) throw error;

      return (data as unknown as Profile | null) ?? null;
    },
  });

  const selectedDocumentsQuery = useQuery({
    queryKey: ["tenant-lease-documents", selectedLease?.id],
    enabled: Boolean(selectedLease?.id),
    queryFn: async () => {
      if (!selectedLease?.id) return [];

      const { data, error } = await supabase
        .from("lease_documents" as never)
        .select("*")
        .eq("lease_id", selectedLease.id)
        .order("created_at", {
          ascending: false,
        });

      if (error) throw error;

      return (data || []) as unknown as LeaseDocument[];
    },
  });

  const selectedEventsQuery = useQuery({
    queryKey: ["tenant-lease-events", selectedLease?.id],
    enabled: Boolean(selectedLease?.id),
    queryFn: async () => {
      if (!selectedLease?.id) return [];

      const { data, error } = await supabase
        .from("lease_events" as never)
        .select("*")
        .eq("lease_id", selectedLease.id)
        .order("created_at", {
          ascending: false,
        });

      if (error) throw error;

      return (data || []) as unknown as LeaseEvent[];
    },
  });

  const selectedPaymentsQuery = useQuery({
    queryKey: ["tenant-lease-payments", selectedLease?.id],
    enabled: Boolean(selectedLease?.id),
    queryFn: async () => {
      if (!selectedLease?.id) return [];

      const { data, error } = await supabase
        .from("lease_payments" as never)
        .select("*")
        .eq("lease_id", selectedLease.id)
        .order("created_at", {
          ascending: false,
        });

      if (error) throw error;

      return (data || []) as unknown as LeasePayment[];
    },
  });

  const renewalMutation = useMutation({
    mutationFn: async (leaseId: string) => {
      const { data, error } = await supabase.rpc(
        "request_lease_renewal" as never,
        {
          p_lease_id: leaseId,
        } as never,
      );

      if (error) throw error;

      return data;
    },

    onSuccess: async () => {
      setActionMessage("Renewal request submitted successfully.");

      await queryClient.invalidateQueries({
        queryKey: ["tenant-leases"],
      });

      await queryClient.invalidateQueries({
        queryKey: ["tenant-lease-events"],
      });
    },
  });

  const disputeMutation = useMutation({
    mutationFn: async ({ lease, form }: { lease: Lease; form: DisputeForm }) => {
      const { data: userData } = await supabase.auth.getUser();

      const user = userData.user;

      if (!user) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const reference = `TNP-DSP-${Date.now().toString().slice(-8)}`;

      const { data, error } = await supabase
        .from("disputes" as never)
        .insert({
          reference,
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category,
          status: "open",
          priority: form.priority,
          amount: 0,
          currency: "USD",
          opened_by: user.id,
          lease_id: lease.id,
          tenant_id: user.id,
          landlord_id: lease.landlord_id,
          property_id: lease.property_id,
          lease_request_id: lease.lease_request_id ?? null,
        } as never)
        .select()
        .single();

      if (error) throw error;

      return data;
    },

    onSuccess: async () => {
      setDisputeOpen(false);
      setDisputeLease(null);

      setDisputeForm({
        title: "",
        description: "",
        category: "Lease issue",
        priority: "medium",
      });

      setActionMessage("Your lease dispute has been submitted to TNP.");

      await queryClient.invalidateQueries({
        queryKey: ["tenant-leases"],
      });
    },
  });

  const openLease = (lease: Lease) => {
    setSelectedLeaseId(lease.id);
    setActionMessage(null);
    setDocumentOpen(false);
  };

  const closeLease = () => {
    setSelectedLeaseId(null);
    setDocumentOpen(false);
    setDisputeOpen(false);
  };

  const openDispute = (lease: Lease) => {
    setDisputeLease(lease);

    setDisputeForm({
      title: "",
      description: "",
      category: "Lease issue",
      priority: "medium",
    });

    setDisputeOpen(true);
  };

  if (leasesQuery.isLoading) {
    return <LeaseLoadingState />;
  }

  if (leasesQuery.isError) {
    return (
      <div className="tnp-module tnp-module-light min-h-screen bg-slate-50 p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <PageHeader />

          <div className="mt-8 rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-red-50 p-3 text-red-600">
                <AlertCircle className="size-6" />
              </div>

              <div className="flex-1">
                <h2 className="text-lg font-bold text-slate-900">We couldn't load your leases</h2>

                <p className="mt-1 text-sm text-slate-500">
                  Please refresh the page and try again.
                </p>

                <button
                  type="button"
                  onClick={() => leasesQuery.refetch()}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  <RefreshCw className="size-4" />
                  Try again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tnp-module tnp-module-light min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
        <PageHeader />

        {actionMessage && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="size-5 shrink-0" />
            <span className="flex-1">{actionMessage}</span>

            <button
              type="button"
              onClick={() => setActionMessage(null)}
              className="rounded-lg p-1 hover:bg-emerald-100"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<FileCheck2 className="size-5" />}
            label="Total Leases"
            value={leases.length}
            description="Your complete lease record"
          />

          <MetricCard
            icon={<ShieldCheck className="size-5" />}
            label="Active"
            value={activeCount}
            description="Currently active tenancies"
          />

          <MetricCard
            icon={<Clock3 className="size-5" />}
            label="Upcoming"
            value={upcomingCount}
            description="Approved leases not started"
          />

          <MetricCard
            icon={<History className="size-5" />}
            label="Past"
            value={pastCount}
            description="Completed lease records"
          />
        </section>

        <section className="mt-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a07838]">
                Tenancy records
              </p>

              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">My Leases</h2>

              <p className="mt-1 text-sm text-slate-500">
                Manage your verified TNP tenancy agreements, documents and renewal requests.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
              {[
                ["all", "All"],
                ["active", "Active"],
                ["upcoming", "Upcoming"],
                ["past", "Past"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setActiveTab(value as "all" | "active" | "upcoming" | "past")}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    activeTab === value
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {filteredLeases.length === 0 ? (
          <EmptyLeasesState />
        ) : (
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            {filteredLeases.map((lease) => (
              <LeaseCard key={lease.id} lease={lease} property={leaseProperties.data?.find(property => property.id === lease.property_id) ?? null} onOpen={() => openLease(lease)} />
            ))}
          </div>
        )}

        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#f8f1e5] text-[#9a7136]">
              <ShieldCheck className="size-6" />
            </div>

            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900">TNP Mutual Trust Ledger</p>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Your lease records connect verified tenants, landlords, properties, documents and
                payment activity into one trusted tenancy history.
              </p>
            </div>

            <Link
              to={"/app/tenant/payments" as never}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Payments & Receipts
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>

      {selectedLease && (
        <LeaseDetailsDrawer
          lease={selectedLease}
          property={selectedPropertyQuery.data ?? null}
          landlord={selectedLandlordQuery.data ?? null}
          documents={selectedDocumentsQuery.data ?? []}
          events={selectedEventsQuery.data ?? []}
          payments={selectedPaymentsQuery.data ?? []}
          documentsLoading={selectedDocumentsQuery.isLoading}
          eventsLoading={selectedEventsQuery.isLoading}
          paymentsLoading={selectedPaymentsQuery.isLoading}
          renewalLoading={renewalMutation.isPending}
          onClose={closeLease}
          onRenew={() => renewalMutation.mutate(selectedLease.id)}
          renewalError={
            renewalMutation.error instanceof Error ? renewalMutation.error.message : null
          }
          onOpenDocuments={() => setDocumentOpen(true)}
          onOpenDispute={() => openDispute(selectedLease)}
          onPayments={() =>
            navigate({
              to: "/app/tenant/payments" as never,
            })
          }
        />
      )}

      {documentOpen && selectedLease && (
        <DocumentsModal
          lease={selectedLease}
          documents={selectedDocumentsQuery.data ?? []}
          loading={selectedDocumentsQuery.isLoading}
          onClose={() => setDocumentOpen(false)}
        />
      )}

      {disputeOpen && disputeLease && (
        <DisputeModal
          lease={disputeLease}
          form={disputeForm}
          setForm={setDisputeForm}
          loading={disputeMutation.isPending}
          error={disputeMutation.error instanceof Error ? disputeMutation.error.message : null}
          onClose={() => {
            setDisputeOpen(false);
            setDisputeLease(null);
          }}
          onSubmit={() =>
            disputeMutation.mutate({
              lease: disputeLease,
              form: disputeForm,
            })
          }
        />
      )}
    </div>
  );
}

function PageHeader() {
  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
          <span>Tenant Portal</span>
          <ChevronRight className="size-3.5" />
          <span className="text-slate-900">My Leases</span>
        </div>

        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#a07838]">
          Mutual Trust Ledger
        </p>

        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
          My Leases
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Your complete tenancy record — agreements, documents, payments, renewal activity and TNP
          protection in one place.
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <ShieldCheck className="size-5 text-emerald-600" />

        <div>
          <p className="text-xs font-bold text-emerald-700">TNP Protected</p>
          <p className="text-xs text-emerald-600">Verified tenancy records</p>
        </div>
      </div>
    </div>
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
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
          {icon}
        </div>

        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">TNP</span>
      </div>

      <p className="mt-5 text-sm font-medium text-slate-500">{label}</p>

      <p className="mt-1 text-3xl font-black text-slate-950">{value}</p>

      <p className="mt-1 text-xs text-slate-400">{description}</p>
    </div>
  );
}

function LeaseCard({ lease, property, onOpen }: { lease: Lease; property: Property | null; onOpen: () => void }) {
  const group = getLeaseGroup(lease);
  const daysUntilEnd = getDaysUntil(lease.end_date);

  const nextPayment = getNextPaymentDate(lease);

  const renewalRequested = normalizeStatus(lease.renewal_status) === "requested";

  const propertyName = property ? getPropertyName(property) : `Property ${lease.property_id.slice(0, 8).toUpperCase()}`;

  return (
    <article className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="border-b border-slate-100 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#f8f1e5] text-[#9a7136]">
              <Home className="size-6" />
            </div>

            <div className="min-w-0">
              <h3 className="truncate text-lg font-bold text-slate-950">{propertyName}</h3>

              <p className="mt-1 truncate text-xs text-slate-500">
                Lease #{lease.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>

          <span
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${getLeaseStatusClasses(
              lease.status,
            )}`}
          >
            {titleCase(lease.status)}
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <LeaseMiniInfo
            icon={<Banknote className="size-4" />}
            label="Monthly Rent"
            value={formatCurrency(lease.rent_usd)}
          />

          <LeaseMiniInfo
            icon={<Wallet className="size-4" />}
            label="Deposit"
            value={formatCurrency(lease.deposit_usd)}
          />

          <LeaseMiniInfo
            icon={<CalendarDays className="size-4" />}
            label="Start Date"
            value={formatDate(lease.start_date)}
          />

          <LeaseMiniInfo
            icon={<CalendarDays className="size-4" />}
            label="End Date"
            value={formatDate(lease.end_date)}
          />
        </div>
      </div>

      <div className="grid divide-y border-b border-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <div className="p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Next scheduled rent</p>

          <p className="mt-1 text-sm font-bold text-slate-900">
            {nextPayment ? formatDate(nextPayment) : "Not scheduled"}
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Renewal</p>

          <p className="mt-1 text-sm font-bold text-slate-900">
            {renewalRequested
              ? "Request submitted"
              : daysUntilEnd !== null &&
                  daysUntilEnd >= 0 &&
                  daysUntilEnd <= (lease.renewal_notice_days ?? 60)
                ? `${daysUntilEnd} days remaining`
                : "No action required"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="size-4 text-emerald-600" />
          <span>
            Payment method:{" "}
            <strong className="text-slate-700">
              {["held", "released"].includes(lease.escrow_status ?? "") ? "Legacy escrow record" : "Direct to landlord"}
            </strong>
          </span>
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
        >
          View Lease
          <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
        </button>
      </div>
    </article>
  );
}

function LeaseMiniInfo({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
      <div className="text-slate-500">{icon}</div>

      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>

        <p className="mt-0.5 truncate text-sm font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function LeaseDetailsDrawer({
  lease,
  property,
  landlord,
  documents,
  events,
  payments,
  documentsLoading,
  eventsLoading,
  paymentsLoading,
  renewalLoading,
  renewalError,
  onClose,
  onRenew,
  onOpenDocuments,
  onOpenDispute,
  onPayments,
}: {
  lease: Lease;
  property: Property | null;
  landlord: Profile | null;
  documents: LeaseDocument[];
  events: LeaseEvent[];
  payments: LeasePayment[];
  documentsLoading: boolean;
  eventsLoading: boolean;
  paymentsLoading: boolean;
  renewalLoading: boolean;
  renewalError: string | null;
  onClose: () => void;
  onRenew: () => void;
  onOpenDocuments: () => void;
  onOpenDispute: () => void;
  onPayments: () => void;
}) {
  const propertyName = getPropertyName(property);

  const propertyAddress = getPropertyAddress(property);

  const image = getPropertyImage(property);

  const daysUntilEnd = getDaysUntil(lease.end_date);

  const renewalWindow = lease.renewal_notice_days ?? 60;

  const renewalRequested = normalizeStatus(lease.renewal_status) === "requested";

  const renewalApproved = normalizeStatus(lease.renewal_status) === "approved";

  const canRenew =
    normalizeStatus(lease.status) === "active" && !renewalRequested && !renewalApproved;

  const isRenewalWindow =
    daysUntilEnd !== null && daysUntilEnd >= 0 && daysUntilEnd <= renewalWindow;

  const totalPaid = payments.reduce((sum, payment) => {
    const status = getPaymentStatus(payment);

    if (isSettledPayment(status) || status === "completed" || status === "successful") {
      return sum + getPaymentAmount(payment);
    }

    return sum;
  }, 0);

  const pendingPayments = payments.filter((payment) => {
    const status = getPaymentStatus(payment);

    return status === "pending" || status === "processing" || status === "due" || status === "overdue";
  });

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close lease details"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
      />

      <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a07838]">
              Lease record
            </p>

            <h2 className="mt-1 text-xl font-black text-slate-950">{propertyName}</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 p-2.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="relative h-48 overflow-hidden bg-slate-100">
            {image ? (
              <img src={image} alt={propertyName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Building2 className="size-14 text-slate-300" />
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent" />

            <div className="absolute bottom-5 left-5 right-5">
              <p className="text-sm font-medium text-white/80">{propertyAddress}</p>

              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-bold ${getLeaseStatusClasses(
                    lease.status,
                  )}`}
                >
                  {titleCase(lease.status)}
                </span>

                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                  #{lease.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-7 p-5 sm:p-6">
            <section>
              <SectionTitle icon={<FileCheck2 className="size-4" />} title="Lease Overview" />

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <DetailItem label="Monthly Rent" value={formatCurrency(lease.rent_usd)} />

                <DetailItem label="Deposit" value={formatCurrency(lease.deposit_usd)} />

                <DetailItem
                  label="Payment Frequency"
                  value={titleCase(lease.payment_frequency ?? "monthly")}
                />

                <DetailItem
                  label="Payment Due Day"
                  value={lease.payment_due_day ? `Day ${lease.payment_due_day}` : "Not set"}
                />

                <DetailItem label="Start Date" value={formatDate(lease.start_date)} />

                <DetailItem label="End Date" value={formatDate(lease.end_date)} />

                <DetailItem label="Signed" value={formatDate(lease.signed_at, "Not signed")} />

                <DetailItem
                  label="Renewal Status"
                  value={titleCase(lease.renewal_status ?? "not_requested")}
                />
              </div>
            </section>

            <section>
              <SectionTitle icon={<UserRound className="size-4" />} title="Landlord" />

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
                    <UserRound className="size-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900">
                      {landlord?.full_name || "TNP Landlord"}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {landlord?.phone || "Contact details unavailable"}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        <ShieldCheck className="size-3.5" />
                        {landlord?.verification || "Verification pending"}
                      </span>

                      {typeof landlord?.trust_score === "number" && (
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600">
                          Trust {landlord.trust_score}
                        </span>
                      )}
                    </div>
                  </div>

                  {landlord?.phone && (
                    <a
                      href={`tel:${landlord.phone}`}
                      className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:bg-slate-100"
                      title="Call landlord"
                    >
                      <Mail className="size-4" />
                    </a>
                  )}
                </div>
              </div>
            </section>

            <section>
              <SectionTitle
                icon={<CircleDollarSign className="size-4" />}
                title="Financial Summary"
              />

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <FinancialCard
                  label="Rent"
                  value={formatCurrency(lease.rent_usd)}
                  icon={<Banknote className="size-4" />}
                />

                <FinancialCard
                  label="Paid"
                  value={formatCurrency(totalPaid)}
                  icon={<CheckCircle2 className="size-4" />}
                />

                <FinancialCard
                  label="Pending"
                  value={String(pendingPayments.length)}
                  icon={<Clock3 className="size-4" />}
                />
              </div>

              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />

                  <div>
                    <p className="text-sm font-bold text-emerald-800">Escrow Protection</p>

                    <p className="mt-1 text-xs leading-5 text-emerald-700">
                      Status: <strong>{titleCase(lease.escrow_status ?? "not_started")}</strong>
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onPayments}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Open Payments & Receipts
                <ArrowRight className="size-4" />
              </button>
            </section>

            <section>
              <SectionTitle icon={<FileText className="size-4" />} title="Lease Documents" />

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white">
                {documentsLoading ? (
                  <InlineLoading />
                ) : documents.length === 0 ? (
                  <div className="p-5 text-center">
                    <FileText className="mx-auto size-8 text-slate-300" />

                    <p className="mt-2 text-sm font-semibold text-slate-700">
                      No lease documents yet
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Documents submitted for this lease will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {documents.slice(0, 4).map((document) => (
                      <DocumentRow key={document.id} document={document} />
                    ))}
                  </div>
                )}

                <div className="border-t border-slate-100 p-3">
                  <button
                    type="button"
                    onClick={onOpenDocuments}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                  >
                    View All Documents
                    <ArrowRight className="size-4" />
                  </button>
                </div>
              </div>
            </section>

            <section>
              <SectionTitle icon={<History className="size-4" />} title="Lease Lifecycle" />

              <div className="mt-4">
                <Lifecycle lease={lease} events={events} loading={eventsLoading} />
              </div>
            </section>

            <section>
              <SectionTitle icon={<CalendarDays className="size-4" />} title="Renewal" />

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
                    <RefreshCw className="size-5" />
                  </div>

                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900">
                      {renewalRequested
                        ? "Renewal request submitted"
                        : renewalApproved
                          ? "Renewal approved"
                          : isRenewalWindow
                            ? "Your renewal window is open"
                            : "Renewal is not currently due"}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {daysUntilEnd !== null
                        ? `${Math.max(
                            daysUntilEnd,
                            0,
                          )} days until the lease end date. TNP uses a ${renewalWindow}-day renewal notice period.`
                        : "Your lease end date has not been set."}
                    </p>

                    {canRenew && (
                      <button
                        type="button"
                        disabled={renewalLoading}
                        onClick={onRenew}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {renewalLoading ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <RefreshCw className="size-4" />
                        )}
                        Request Renewal
                      </button>
                    )}

                    {renewalError && (
                      <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                        {renewalError}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <SectionTitle icon={<MessageSquareWarning className="size-4" />} title="Need Help?" />

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={onOpenDispute}
                  className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-left transition hover:bg-red-100"
                >
                  <CircleAlert className="size-5 text-red-600" />

                  <div>
                    <p className="text-sm font-bold text-red-800">Report a Problem</p>

                    <p className="mt-1 text-xs text-red-600">Open a lease dispute with TNP.</p>
                  </div>
                </button>

                {landlord?.phone ? (
                  <a
                    href={`tel:${landlord.phone}`}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:bg-slate-50"
                  >
                    <Mail className="size-5 text-slate-600" />

                    <div>
                      <p className="text-sm font-bold text-slate-800">Contact Landlord</p>

                      <p className="mt-1 text-xs text-slate-500">Call your registered landlord.</p>
                    </div>
                  </a>
                ) : (
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <Mail className="size-5 text-slate-400" />

                    <div>
                      <p className="text-sm font-bold text-slate-700">Contact Landlord</p>

                      <p className="mt-1 text-xs text-slate-400">No phone number available.</p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {lease.terms && (
              <section>
                <SectionTitle icon={<FileText className="size-4" />} title="Lease Terms" />

                <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  {lease.terms}
                </div>
              </section>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-[#a07838]">{icon}</div>

      <h3 className="text-sm font-black uppercase tracking-[0.08em] text-slate-900">{title}</h3>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>

      <p className="mt-1 text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}

function FinancialCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-bold">{label}</span>
      </div>

      <p className="mt-2 text-lg font-black text-slate-900">{value}</p>
    </div>
  );
}

function DocumentRow({ document }: { document: LeaseDocument }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
        <FileText className="size-5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-800">{document.name}</p>

        <p className="mt-0.5 text-xs text-slate-400">{titleCase(document.document_type)}</p>
      </div>

      <span
        className={`hidden rounded-full border px-2.5 py-1 text-[11px] font-bold sm:inline-flex ${getDocumentStatusClasses(
          document.status,
        )}`}
      >
        {titleCase(document.status)}
      </span>

      {document.document_url && (
        <a
          href={document.document_url}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
          title="View document"
        >
          <ExternalLink className="size-4" />
        </a>
      )}
    </div>
  );
}

function Lifecycle({
  lease,
  events,
  loading,
}: {
  lease: Lease;
  events: LeaseEvent[];
  loading: boolean;
}) {
  const milestones = [
    {
      key: "created",
      label: "Lease Created",
      date: lease.created_at,
      active: true,
    },
    {
      key: "signed",
      label: "Lease Signed",
      date: lease.signed_at,
      active: Boolean(lease.signed_at),
    },
    {
      key: "started",
      label: "Tenancy Started",
      date: lease.start_date,
      active: lease.start_date != null && new Date(lease.start_date) <= new Date(),
    },
    {
      key: "ending",
      label: "Lease End",
      date: lease.end_date,
      active: Boolean(lease.end_date),
    },
  ];

  return (
    <div className="space-y-4">
      {milestones.map((milestone, index) => (
        <div key={milestone.key} className="relative flex gap-3">
          {index < milestones.length - 1 && (
            <div className="absolute left-[9px] top-7 h-10 w-px bg-slate-200" />
          )}

          <div
            className={`relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full border ${
              milestone.active
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-slate-300 bg-white"
            }`}
          >
            {milestone.active && <CheckCircle2 className="size-3.5" />}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-800">{milestone.label}</p>

            <p className="mt-0.5 text-xs text-slate-400">{formatDate(milestone.date)}</p>
          </div>
        </div>
      ))}

      <div className="border-t border-slate-100 pt-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
          Recent Activity
        </p>

        {loading ? (
          <InlineLoading />
        ) : events.length === 0 ? (
          <p className="text-xs text-slate-400">No lease activity has been recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {events.slice(0, 5).map((event) => (
              <div key={event.id} className="rounded-xl bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-bold text-slate-700">
                    {titleCase(event.event_type ?? "lease_update")}
                  </p>

                  <span className="shrink-0 text-[10px] text-slate-400">
                    {formatDateTime(event.created_at)}
                  </span>
                </div>

                {event.detail && (
                  <p className="mt-1 text-xs leading-5 text-slate-500">{event.detail}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentsModal({
  lease,
  documents,
  loading,
  onClose,
}: {
  lease: Lease;
  documents: LeaseDocument[];
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#a07838]">
              Lease #{lease.id.slice(0, 8).toUpperCase()}
            </p>

            <h2 className="mt-1 text-xl font-black text-slate-950">Lease Documents</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-5 sm:p-6">
          {loading ? (
            <InlineLoading />
          ) : documents.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="mx-auto size-12 text-slate-300" />

              <p className="mt-3 text-sm font-bold text-slate-800">No documents available</p>

              <p className="mt-1 text-xs text-slate-400">
                Your lease documents will appear here once they are submitted.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((document) => (
                <div key={document.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      <FileText className="size-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900">{document.name}</p>

                      <p className="mt-1 text-xs text-slate-500">
                        {titleCase(document.document_type)} · Uploaded{" "}
                        {formatDate(document.created_at)}
                      </p>

                      <div className="mt-2">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${getDocumentStatusClasses(
                            document.status,
                          )}`}
                        >
                          {titleCase(document.status)}
                        </span>
                      </div>

                      {document.notes && (
                        <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                          {document.notes}
                        </p>
                      )}
                    </div>

                    {document.document_url && (
                      <div className="flex shrink-0 gap-2">
                        <a
                          href={document.document_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-slate-200 p-2.5 text-slate-600 transition hover:bg-slate-50"
                          title="View document"
                        >
                          <ExternalLink className="size-4" />
                        </a>

                        <a
                          href={document.document_url}
                          download
                          className="rounded-xl bg-slate-900 p-2.5 text-white transition hover:bg-slate-800"
                          title="Download document"
                        >
                          <Download className="size-4" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DisputeModal({
  lease,
  form,
  setForm,
  loading,
  error,
  onClose,
  onSubmit,
}: {
  lease: Lease;
  form: DisputeForm;
  setForm: React.Dispatch<React.SetStateAction<DisputeForm>>;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const canSubmit = form.title.trim().length >= 3 && form.description.trim().length >= 10;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-red-600">
                TNP Lease Support
              </p>

              <h2 className="mt-1 text-xl font-black text-slate-950">Report a Lease Problem</h2>

              <p className="mt-1 text-sm text-slate-500">
                Lease #{lease.id.slice(0, 8).toUpperCase()}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Problem title
            </label>

            <input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="e.g. Landlord has not honoured lease terms"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Category
            </label>

            <select
              value={form.category}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  category: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            >
              <option>Lease issue</option>
              <option>Payment issue</option>
              <option>Property issue</option>
              <option>Landlord issue</option>
              <option>Deposit issue</option>
              <option>Contract issue</option>
              <option>Other</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Priority
            </label>

            <select
              value={form.priority}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  priority: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Description
            </label>

            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              rows={5}
              placeholder="Explain what happened and include any relevant dates, amounts or evidence."
              className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={!canSubmit || loading}
              onClick={onSubmit}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Submit Dispute
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InlineLoading() {
  return (
    <div className="flex items-center justify-center gap-2 p-6 text-sm text-slate-400">
      <Loader2 className="size-4 animate-spin" />
      Loading...
    </div>
  );
}

function EmptyLeasesState() {
  return (
    <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
      <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400">
        <FileCheck2 className="size-8" />
      </div>

      <h3 className="mt-5 text-lg font-black text-slate-900">No leases in this view</h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Once a lease is created for one of your approved rental applications, it will appear here
        with its complete TNP tenancy record.
      </p>

      <Link
        to="/app/tenant/applications"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
      >
        View My Applications
        <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}

function LeaseLoadingState() {
  return (
    <div className="tnp-module tnp-module-light min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl animate-pulse">
        <div className="h-5 w-32 rounded bg-slate-200" />
        <div className="mt-3 h-10 w-56 rounded bg-slate-200" />
        <div className="mt-3 h-4 w-96 max-w-full rounded bg-slate-200" />

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-36 rounded-3xl bg-white" />
          ))}
        </div>

        <div className="mt-8 grid gap-5 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-80 rounded-3xl bg-white" />
          ))}
        </div>
      </div>
    </div>
  );
}
