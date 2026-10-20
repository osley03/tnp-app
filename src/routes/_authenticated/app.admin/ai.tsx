import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BrainCircuit,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  DollarSign,
  FileWarning,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  WalletCards,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type QueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

type DatabaseClient = {
  from: (table: string) => {
    select: (columns: string) => Promise<QueryResult>;
  };
};

const db = supabase as unknown as DatabaseClient;

type Profile = {
  id: string;
  full_name: string;
  trust_score: number;
  verification: string;
};

type Property = {
  id: string;
  title: string;
  city: string;
  suburb: string;
  rent_usd: number;
  verified: boolean;
  available: boolean;
  fraud_flags: string[];
};

type Lease = {
  id: string;
  status: string;
  rent_usd: number;
  deposit_usd: number;
  created_at: string;
};

type Payment = {
  id: string;
  amount_usd: number;
  status: string;
  payment_type: string;
  created_at: string;
};

type Review = {
  id: string;
  rating: number;
  moderation_status: string;
  lease_confirmed: boolean;
  created_at: string;
};

type Dispute = {
  id: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
};

type ScamCase = {
  id: string;
  status: string;
  priority: string;
  amount_lost_usd: number;
  case_type: string;
  created_at: string;
};

type IntelligenceData = {
  profiles: Profile[];
  properties: Property[];
  leases: Lease[];
  payments: Payment[];
  reviews: Review[];
  disputes: Dispute[];
  scamCases: ScamCase[];
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentage(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function daysAgo(date: string) {
  const timestamp = new Date(date).getTime();
  if (!Number.isFinite(timestamp)) return 0;

  return Math.max(0, Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24)));
}

function severityClass(level: "low" | "medium" | "high" | "critical") {
  switch (level) {
    case "critical":
      return "border-red-400/20 bg-red-400/10 text-red-300";
    case "high":
      return "border-orange-400/20 bg-orange-400/10 text-orange-300";
    case "medium":
      return "border-yellow-400/20 bg-yellow-400/10 text-yellow-300";
    default:
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
  }
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconClass = "bg-[#d4af37]/10 text-[#d4af37]",
  trend,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  iconClass?: string;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111318] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconClass}`}>
          <Icon className="h-5 w-5" />
        </div>

        {trend === "up" && <ArrowUpRight className="h-4 w-4 text-emerald-400" />}

        {trend === "down" && <ArrowDownRight className="h-4 w-4 text-orange-400" />}
      </div>

      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
        {title}
      </p>

      <p className="mt-2 text-2xl font-bold tracking-tight text-white">{value}</p>

      <p className="mt-1 text-sm text-white/45">{subtitle}</p>
    </div>
  );
}

function InsightCard({
  level,
  title,
  description,
  action,
  onClick,
}: {
  level: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  action?: string | undefined;
  onClick?: (() => void) | undefined;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111318] p-5">
      <div className="flex items-start gap-4">
        <div
          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${severityClass(level)}`}
        >
          {level === "critical" || level === "high" ? (
            <AlertTriangle className="h-5 w-5" />
          ) : level === "medium" ? (
            <CircleAlert className="h-5 w-5" />
          ) : (
            <CheckCircle2 className="h-5 w-5" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-white">{title}</h3>

            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${severityClass(level)}`}
            >
              {level}
            </span>
          </div>

          <p className="mt-2 text-sm leading-6 text-white/55">{description}</p>

          {action && onClick && (
            <button
              type="button"
              onClick={onClick}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#d4af37] transition hover:text-[#f0cf63]"
            >
              {action}
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ProgressBar({
  label,
  value,
  total,
  description,
}: {
  label: string;
  value: number;
  total: number;
  description: string;
}) {
  const percent = percentage(value, total);

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white">{label}</p>
          <p className="mt-1 text-xs text-white/40">{description}</p>
        </div>

        <span className="text-sm font-semibold text-white">{percent}%</span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-[#d4af37] transition-all"
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  );
}

function AdminAIPage() {
  const navigate = useNavigate();

  const intelligenceQuery = useQuery({
    queryKey: ["admin-ai-intelligence"],
    queryFn: async (): Promise<IntelligenceData> => {
      const [
        profilesResult,
        propertiesResult,
        leasesResult,
        paymentsResult,
        reviewsResult,
        disputesResult,
        scamCasesResult,
      ] = await Promise.all([
        db.from("profiles").select("id, full_name, trust_score, verification"),

        db
          .from("properties")
          .select("id, title, city, suburb, rent_usd, verified, available, fraud_flags"),

        db.from("leases").select("id, status, rent_usd, deposit_usd, created_at"),

        db.from("lease_payments").select("id, amount_usd, status, payment_type, created_at"),

        db.from("reviews").select("id, rating, moderation_status, lease_confirmed, created_at"),

        db.from("disputes").select("id, status, priority, category, created_at"),

        db
          .from("scam_cases")
          .select("id, status, priority, amount_lost_usd, case_type, created_at"),
      ]);

      const results = [
        profilesResult,
        propertiesResult,
        leasesResult,
        paymentsResult,
        reviewsResult,
        disputesResult,
        scamCasesResult,
      ];

      const failed = results.find((result) => result.error);

      if (failed?.error) {
        throw new Error(failed.error.message);
      }

      return {
        profiles: (profilesResult.data || []) as Profile[],
        properties: (propertiesResult.data || []) as Property[],
        leases: (leasesResult.data || []) as Lease[],
        payments: (paymentsResult.data || []) as Payment[],
        reviews: (reviewsResult.data || []) as Review[],
        disputes: (disputesResult.data || []) as Dispute[],
        scamCases: (scamCasesResult.data || []) as ScamCase[],
      };
    },
  });

  const data = intelligenceQuery.data;

  const profiles = data?.profiles || [];
  const properties = data?.properties || [];
  const leases = data?.leases || [];
  const payments = data?.payments || [];
  const reviews = data?.reviews || [];
  const disputes = data?.disputes || [];
  const scamCases = data?.scamCases || [];

  const averageTrust = Math.round(
    average(profiles.map((profile) => Number(profile.trust_score) || 0)),
  );

  const lowTrustUsers = profiles.filter((profile) => Number(profile.trust_score) < 40);

  const highTrustUsers = profiles.filter((profile) => Number(profile.trust_score) >= 70);

  const verifiedProfiles = profiles.filter(
    (profile) => profile.verification && profile.verification.toLowerCase() !== "email only",
  );

  const verifiedProperties = properties.filter((property) => property.verified);

  const flaggedProperties = properties.filter(
    (property) => Array.isArray(property.fraud_flags) && property.fraud_flags.length > 0,
  );

  const activeLeases = leases.filter((lease) =>
    ["active", "pending", "requested", "draft"].includes(String(lease.status).toLowerCase()),
  );

  const pendingPayments = payments.filter((payment) =>
    ["pending", "held", "disputed"].includes(String(payment.status).toLowerCase()),
  );

  const disputedPayments = payments.filter((payment) => payment.status === "disputed");

  const paymentVolume = payments.reduce((sum, payment) => sum + Number(payment.amount_usd || 0), 0);

  const heldPaymentValue = payments
    .filter((payment) => payment.status === "held")
    .reduce((sum, payment) => sum + Number(payment.amount_usd || 0), 0);

  const disputedPaymentValue = disputedPayments.reduce(
    (sum, payment) => sum + Number(payment.amount_usd || 0),
    0,
  );

  const averageRating = average(reviews.map((review) => Number(review.rating) || 0));

  const pendingReviews = reviews.filter((review) => review.moderation_status === "pending");

  const flaggedReviews = reviews.filter((review) => review.moderation_status === "flagged");

  const activeDisputes = disputes.filter(
    (dispute) => !["resolved", "closed"].includes(dispute.status),
  );

  const criticalDisputes = disputes.filter((dispute) => dispute.priority === "critical");

  const escalatedDisputes = disputes.filter((dispute) => dispute.status === "escalated");

  const activeScams = scamCases.filter(
    (item) => !["resolved", "closed", "dismissed"].includes(item.status),
  );

  const criticalScams = scamCases.filter((item) => item.priority === "critical");

  const reportedLoss = scamCases.reduce((sum, item) => sum + Number(item.amount_lost_usd || 0), 0);

  const recentScams = scamCases.filter((item) => daysAgo(item.created_at) <= 30);

  const riskScore = Math.min(
    100,
    Math.round(
      activeScams.length * 8 +
        criticalScams.length * 15 +
        criticalDisputes.length * 10 +
        flaggedProperties.length * 5 +
        lowTrustUsers.length * 2 +
        disputedPayments.length * 5,
    ),
  );

  let overallRisk: "low" | "medium" | "high" | "critical" = "low";

  if (riskScore >= 75) {
    overallRisk = "critical";
  } else if (riskScore >= 50) {
    overallRisk = "high";
  } else if (riskScore >= 25) {
    overallRisk = "medium";
  }

  const insights = [
    lowTrustUsers.length > 0
      ? {
          level: lowTrustUsers.length >= 10 ? ("high" as const) : ("medium" as const),
          title: `${lowTrustUsers.length} low-trust profile${lowTrustUsers.length === 1 ? "" : "s"} detected`,
          description:
            "Profiles with trust scores below 40 should receive additional verification or review before sensitive transactions are approved.",
          action: "Review Profiles",
          onClick: () => navigate({ to: "/app/admin/profiles" }),
        }
      : {
          level: "low" as const,
          title: "No low-trust profile cluster detected",
          description: "No current profiles fall below the TNP low-trust threshold of 40.",
        },

    flaggedProperties.length > 0
      ? {
          level: flaggedProperties.length >= 5 ? ("high" as const) : ("medium" as const),
          title: `${flaggedProperties.length} property listing${flaggedProperties.length === 1 ? "" : "s"} carry fraud flags`,
          description:
            "Listings with recorded fraud flags should be inspected before being promoted or treated as trusted inventory.",
          action: "Review Properties",
          onClick: () => navigate({ to: "/app/admin/properties" }),
        }
      : {
          level: "low" as const,
          title: "No flagged property inventory",
          description: "No property records currently contain fraud flags.",
        },

    criticalDisputes.length > 0
      ? {
          level: "critical" as const,
          title: `${criticalDisputes.length} critical dispute${criticalDisputes.length === 1 ? "" : "s"} require attention`,
          description:
            "Critical disputes should be investigated promptly and reviewed against their linked lease, payment and evidence records.",
          action: "Open Disputes",
          onClick: () => navigate({ to: "/app/admin/disputes" }),
        }
      : {
          level: "low" as const,
          title: "No critical disputes",
          description: "There are currently no disputes carrying the critical priority level.",
        },

    criticalScams.length > 0
      ? {
          level: "critical" as const,
          title: `${criticalScams.length} critical scam case${criticalScams.length === 1 ? "" : "s"} detected`,
          description:
            "Critical scam cases should remain in the investigation queue until evidence, financial impact and resolution actions are fully documented.",
          action: "Investigate Scam Cases",
          onClick: () => navigate({ to: "/app/admin/scam-cases" }),
        }
      : {
          level: "low" as const,
          title: "No critical scam cases",
          description: "There are currently no scam cases carrying the critical priority level.",
        },

    disputedPayments.length > 0
      ? {
          level: disputedPayments.length >= 5 ? ("high" as const) : ("medium" as const),
          title: `${disputedPayments.length} disputed payment${disputedPayments.length === 1 ? "" : "s"}`,
          description: `${formatCurrency(disputedPaymentValue)} is currently associated with disputed payment records and should be reconciled against lease and dispute evidence.`,
          action: "Review Payments",
          onClick: () => navigate({ to: "/app/admin/payments" }),
        }
      : {
          level: "low" as const,
          title: "No disputed payments",
          description: "No payment records currently have the disputed status.",
        },
  ];

  if (intelligenceQuery.isLoading) {
    return (
      <div className="tnp-module tnp-module-dark min-h-full bg-[#0b0c0f] p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex min-h-[70vh] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d4af37]/20 bg-[#d4af37]/10">
                <BrainCircuit className="h-7 w-7 animate-pulse text-[#d4af37]" />
              </div>
              <h2 className="mt-5 text-lg font-semibold text-white">Building Intelligence View</h2>
              <p className="mt-2 text-sm text-white/45">Analysing current TNP platform data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (intelligenceQuery.isError) {
    return (
      <div className="tnp-module tnp-module-dark min-h-full bg-[#0b0c0f] p-6 lg:p-8">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-400/10 text-red-300">
              <XCircle className="h-7 w-7" />
            </div>

            <h2 className="mt-5 text-lg font-semibold text-white">Intelligence data unavailable</h2>

            <p className="mt-2 text-sm leading-6 text-white/50">
              {(intelligenceQuery.error as Error)?.message ||
                "The dashboard could not load the required platform data."}
            </p>

            <button
              type="button"
              onClick={() => intelligenceQuery.refetch()}
              className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tnp-module tnp-module-dark min-h-full bg-[#0b0c0f] text-white">
      <div className="mx-auto max-w-7xl p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
              <Sparkles className="h-4 w-4" />
              Trust Intelligence
            </div>

            <h1 className="mt-2 text-3xl font-bold tracking-tight">AI &amp; Insights</h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
              A unified intelligence view of trust, safety, property, payments, disputes and scam
              activity across the TNP platform.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold ${severityClass(
                overallRisk,
              )}`}
            >
              <Activity className="h-4 w-4" />
              Platform Risk: {overallRisk}
            </div>

            <button
              type="button"
              onClick={() => intelligenceQuery.refetch()}
              disabled={intelligenceQuery.isFetching}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${intelligenceQuery.isFetching ? "animate-spin" : ""}`}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => navigate({ to: "/app/admin" })}
              className="inline-flex items-center gap-2 rounded-xl border border-[#d4af37]/20 bg-[#d4af37]/10 px-4 py-2.5 text-sm font-semibold text-[#e6c85c] transition hover:bg-[#d4af37]/15"
            >
              Back to Admin Dashboard
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* AI summary */}
        <div className="mt-8 overflow-hidden rounded-3xl border border-[#d4af37]/15 bg-gradient-to-br from-[#17140b] via-[#111318] to-[#0e1014]">
          <div className="p-6 lg:p-7">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#d4af37]/20 bg-[#d4af37]/10 text-[#d4af37]">
                  <BrainCircuit className="h-6 w-6" />
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d4af37]">
                    Intelligence Summary
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-white">
                    TNP Trust &amp; Safety Intelligence
                  </h2>

                  <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">
                    Current risk indicators are calculated from live platform records. This view
                    highlights signals that may deserve administrator investigation; it does not
                    replace evidence-led case review.
                  </p>
                </div>
              </div>

              <div className="shrink-0 rounded-2xl border border-white/10 bg-black/20 px-5 py-4">
                <p className="text-xs uppercase tracking-wider text-white/35">Risk Index</p>
                <div className="mt-1 flex items-end gap-2">
                  <span className="text-3xl font-bold text-white">{riskScore}</span>
                  <span className="pb-1 text-sm text-white/35">/100</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Core metrics */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Average Trust"
            value={`${averageTrust}/100`}
            subtitle={`${formatNumber(profiles.length)} profiles analysed`}
            icon={ShieldCheck}
            trend={averageTrust >= 60 ? "up" : "down"}
          />

          <MetricCard
            title="Property Risk"
            value={formatNumber(flaggedProperties.length)}
            subtitle={`${formatNumber(verifiedProperties.length)} verified listings`}
            icon={Building2}
            iconClass="bg-orange-400/10 text-orange-300"
            trend={flaggedProperties.length ? "down" : "up"}
          />

          <MetricCard
            title="Active Safety Cases"
            value={formatNumber(activeScams.length + activeDisputes.length)}
            subtitle={`${formatNumber(activeScams.length)} scams · ${formatNumber(activeDisputes.length)} disputes`}
            icon={ShieldAlert}
            iconClass="bg-red-400/10 text-red-300"
            trend={activeScams.length || activeDisputes.length ? "down" : "up"}
          />

          <MetricCard
            title="Payment Exposure"
            value={formatCurrency(heldPaymentValue + disputedPaymentValue)}
            subtitle={`${formatNumber(pendingPayments.length)} payments requiring attention`}
            icon={WalletCards}
            iconClass="bg-emerald-400/10 text-emerald-300"
          />
        </div>

        {/* Intelligence cards */}
        <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <section className="rounded-2xl border border-white/10 bg-[#111318] p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d4af37]">
                  Automated Signals
                </p>
                <h2 className="mt-1 text-xl font-bold">Risk &amp; Intelligence Findings</h2>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d4af37]/10 text-[#d4af37]">
                <FileWarning className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {insights.map((insight, index) => (
                <InsightCard
                  key={`${insight.title}-${index}`}
                  level={insight.level}
                  title={insight.title}
                  description={insight.description}
                  action={insight.action}
                  onClick={insight.onClick}
                />
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#111318] p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d4af37]/10 text-[#d4af37]">
                <ShieldCheck className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d4af37]">
                  Trust Health
                </p>
                <h2 className="mt-1 text-xl font-bold">Platform Trust Profile</h2>
              </div>
            </div>

            <div className="mt-7 space-y-7">
              <ProgressBar
                label="High Trust Users"
                value={highTrustUsers.length}
                total={profiles.length}
                description="Trust score 70 or above"
              />

              <ProgressBar
                label="Verified Profiles"
                value={verifiedProfiles.length}
                total={profiles.length}
                description="Verification beyond email-only status"
              />

              <ProgressBar
                label="Verified Properties"
                value={verifiedProperties.length}
                total={properties.length}
                description="Listings currently marked verified"
              />

              <ProgressBar
                label="Lease-Confirmed Reviews"
                value={reviews.filter((review) => review.lease_confirmed).length}
                total={reviews.length}
                description="Reviews connected to confirmed leases"
              />
            </div>

            <div className="mt-8 rounded-2xl border border-white/8 bg-white/[0.025] p-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-white/50" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    {formatNumber(lowTrustUsers.length)} low-trust profiles
                  </p>
                  <p className="mt-1 text-xs text-white/40">
                    Below the TNP review threshold of 40.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Platform intelligence */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Safety */}
          <section className="rounded-2xl border border-white/10 bg-[#111318] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
                  Safety
                </p>
                <h2 className="mt-1 text-lg font-bold">Scam Intelligence</h2>
              </div>

              <ShieldAlert className="h-5 w-5 text-red-300" />
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between border-b border-white/8 pb-4">
                <span className="text-sm text-white/50">Total cases</span>
                <span className="font-semibold">{scamCases.length}</span>
              </div>

              <div className="flex items-center justify-between border-b border-white/8 pb-4">
                <span className="text-sm text-white/50">Active</span>
                <span className="font-semibold">{activeScams.length}</span>
              </div>

              <div className="flex items-center justify-between border-b border-white/8 pb-4">
                <span className="text-sm text-white/50">Critical</span>
                <span className="font-semibold text-red-300">{criticalScams.length}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-white/50">Reported loss</span>
                <span className="font-semibold">{formatCurrency(reportedLoss)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate({ to: "/app/admin/scam-cases" })}
              className="mt-6 flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Open Scam Cases
              <ChevronRight className="h-4 w-4" />
            </button>
          </section>

          {/* Disputes */}
          <section className="rounded-2xl border border-white/10 bg-[#111318] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
                  Governance
                </p>
                <h2 className="mt-1 text-lg font-bold">Dispute Intelligence</h2>
              </div>

              <CircleAlert className="h-5 w-5 text-orange-300" />
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between border-b border-white/8 pb-4">
                <span className="text-sm text-white/50">Total disputes</span>
                <span className="font-semibold">{disputes.length}</span>
              </div>

              <div className="flex items-center justify-between border-b border-white/8 pb-4">
                <span className="text-sm text-white/50">Active</span>
                <span className="font-semibold">{activeDisputes.length}</span>
              </div>

              <div className="flex items-center justify-between border-b border-white/8 pb-4">
                <span className="text-sm text-white/50">Escalated</span>
                <span className="font-semibold text-orange-300">{escalatedDisputes.length}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-white/50">Critical</span>
                <span className="font-semibold text-red-300">{criticalDisputes.length}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate({ to: "/app/admin/disputes" })}
              className="mt-6 flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Open Disputes
              <ChevronRight className="h-4 w-4" />
            </button>
          </section>

          {/* Payments */}
          <section className="rounded-2xl border border-white/10 bg-[#111318] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  Financial
                </p>
                <h2 className="mt-1 text-lg font-bold">Payment Intelligence</h2>
              </div>

              <DollarSign className="h-5 w-5 text-emerald-300" />
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between border-b border-white/8 pb-4">
                <span className="text-sm text-white/50">Total volume</span>
                <span className="font-semibold">{formatCurrency(paymentVolume)}</span>
              </div>

              <div className="flex items-center justify-between border-b border-white/8 pb-4">
                <span className="text-sm text-white/50">Held</span>
                <span className="font-semibold">{formatCurrency(heldPaymentValue)}</span>
              </div>

              <div className="flex items-center justify-between border-b border-white/8 pb-4">
                <span className="text-sm text-white/50">Disputed</span>
                <span className="font-semibold text-orange-300">
                  {formatCurrency(disputedPaymentValue)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-white/50">Needs attention</span>
                <span className="font-semibold">{pendingPayments.length}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate({ to: "/app/admin/payments" })}
              className="mt-6 flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Open Payments
              <ChevronRight className="h-4 w-4" />
            </button>
          </section>
        </div>

        {/* Secondary analytics */}
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-[#111318] p-6">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-[#d4af37]" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d4af37]">
                  Operations
                </p>
                <h2 className="mt-1 text-lg font-bold">Platform Activity</h2>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-white/45" />
                  <div>
                    <p className="text-xs text-white/35">Profiles</p>
                    <p className="mt-1 text-xl font-bold">{formatNumber(profiles.length)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-white/45" />
                  <div>
                    <p className="text-xs text-white/35">Properties</p>
                    <p className="mt-1 text-xl font-bold">{formatNumber(properties.length)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                <div className="flex items-center gap-3">
                  <Clock3 className="h-5 w-5 text-white/45" />
                  <div>
                    <p className="text-xs text-white/35">Active Leases</p>
                    <p className="mt-1 text-xl font-bold">{formatNumber(activeLeases.length)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                <div className="flex items-center gap-3">
                  <Star className="h-5 w-5 text-white/45" />
                  <div>
                    <p className="text-xs text-white/35">Average Rating</p>
                    <p className="mt-1 text-xl font-bold">
                      {averageRating.toFixed(1)}
                      <span className="ml-1 text-sm text-white/30">/5</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#111318] p-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-[#d4af37]" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d4af37]">
                  Review Intelligence
                </p>
                <h2 className="mt-1 text-lg font-bold">Reputation Signals</h2>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.025] p-4">
                <div className="flex items-center gap-3">
                  <Star className="h-5 w-5 text-[#d4af37]" />
                  <div>
                    <p className="text-sm font-semibold">Average rating</p>
                    <p className="mt-1 text-xs text-white/40">Across recorded reviews</p>
                  </div>
                </div>

                <span className="text-lg font-bold">{averageRating.toFixed(1)}</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.025] p-4">
                <div>
                  <p className="text-sm font-semibold">Pending moderation</p>
                  <p className="mt-1 text-xs text-white/40">Reviews awaiting admin review</p>
                </div>

                <span className="font-bold text-yellow-300">{pendingReviews.length}</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.025] p-4">
                <div>
                  <p className="text-sm font-semibold">Flagged reviews</p>
                  <p className="mt-1 text-xs text-white/40">
                    Reviews requiring moderation attention
                  </p>
                </div>

                <span className="font-bold text-red-300">{flaggedReviews.length}</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.025] p-4">
                <div>
                  <p className="text-sm font-semibold">Recent scam reports</p>
                  <p className="mt-1 text-xs text-white/40">Cases created in the last 30 days</p>
                </div>

                <span className="font-bold">{recentScams.length}</span>
              </div>
            </div>
          </section>
        </div>

        {/* Intelligence methodology */}
        <section className="mt-6 rounded-2xl border border-white/10 bg-[#111318] p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <BrainCircuit className="h-5 w-5 text-[#d4af37]" />
                <h2 className="text-lg font-bold">Evidence-Led Intelligence</h2>
              </div>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/45">
                TNP intelligence combines current trust, property, lease, payment, review, dispute
                and scam records into operational signals. Administrators should verify the
                underlying records before taking enforcement or resolution actions.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/55">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              Audit-aware workflow
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/app/admin/ai")({
  component: AdminAIPage,
});
