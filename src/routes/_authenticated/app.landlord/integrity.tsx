import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Copy,
  FileWarning,
  Image as ImageIcon,
  Info,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import { RoleSidebar } from "@/components/dashboard/RoleSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/landlord/integrity")({
  component: ListingIntegrityPage,
});

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type Property = {
  id: string;
  owner_id: string;

  title: string | null;
  suburb: string | null;
  city: string | null;

  rent_usd: number | null;
  deposit_usd: number | null;

  beds: number | null;
  baths: number | null;

  property_type: string | null;
  description: string | null;
  amenities: string[] | null;

  image_url: string | null;

  verified: boolean | null;
  available: boolean | null;

  fraud_flags: string[] | null;

  created_at: string | null;
};

type IntegrityStatus = "healthy" | "attention" | "critical";

type IssueSeverity = "low" | "medium" | "high" | "critical";

type IntegrityIssue = {
  id: string;
  title: string;
  description: string;
  recommendation: string;
  severity: IssueSeverity;
};

type IntegrityResult = {
  status: IntegrityStatus;
  score: number;
  issues: IntegrityIssue[];
  completeness: number;
  verification: number;
  risk: number;
};

type AnalysedProperty = Property & {
  integrity: IntegrityResult;
};

type StatusFilter = "all" | IntegrityStatus;

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function formatCurrency(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "Not provided";
  }

  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(status: IntegrityStatus) {
  switch (status) {
    case "healthy":
      return "Healthy";

    case "attention":
      return "Needs Attention";

    case "critical":
      return "Critical";
  }
}

function severityLabel(severity: IssueSeverity) {
  switch (severity) {
    case "low":
      return "Low";

    case "medium":
      return "Medium";

    case "high":
      return "High";

    case "critical":
      return "Critical";
  }
}

/* -------------------------------------------------------------------------- */
/* INTEGRITY ENGINE                                                           */
/* -------------------------------------------------------------------------- */

function evaluateProperty(property: Property): IntegrityResult {
  const issues: IntegrityIssue[] = [];

  const addIssue = (
    id: string,
    title: string,
    description: string,
    recommendation: string,
    severity: IssueSeverity,
  ) => {
    issues.push({
      id,
      title,
      description,
      recommendation,
      severity,
    });
  };

  /* ------------------------------------------------------------------------ */
  /* BASIC LISTING INFORMATION                                                */
  /* ------------------------------------------------------------------------ */

  if (!property.title?.trim()) {
    addIssue(
      "missing-title",
      "Listing title is missing",
      "Tenants need a clear property title to understand what they are viewing.",
      "Add a concise and descriptive title for the property.",
      "medium",
    );
  } else if (property.title.trim().length < 8) {
    addIssue(
      "short-title",
      "Listing title is too short",
      "Very short titles provide limited information to prospective tenants.",
      "Use a descriptive title such as '2 Bedroom Apartment in Avondale'.",
      "low",
    );
  }

  if (!property.suburb?.trim()) {
    addIssue(
      "missing-suburb",
      "Suburb is missing",
      "The listing does not identify the property's suburb.",
      "Add the correct suburb or neighbourhood.",
      "high",
    );
  }

  if (!property.city?.trim()) {
    addIssue(
      "missing-city",
      "City is missing",
      "The listing does not identify the property's city.",
      "Add the correct city.",
      "high",
    );
  }

  /* ------------------------------------------------------------------------ */
  /* FINANCIAL INFORMATION                                                     */
  /* ------------------------------------------------------------------------ */

  if (property.rent_usd === null || property.rent_usd <= 0) {
    addIssue(
      "missing-rent",
      "Rental price is missing",
      "Tenants cannot properly evaluate the property without a rental price.",
      "Add the current monthly rental price.",
      "high",
    );
  }

  if (property.deposit_usd === null || property.deposit_usd < 0) {
    addIssue(
      "missing-deposit",
      "Deposit information is missing",
      "The listing does not provide a valid deposit amount.",
      "Add the required deposit amount.",
      "medium",
    );
  }

  if (
    property.rent_usd !== null &&
    property.rent_usd > 0 &&
    property.deposit_usd !== null &&
    property.deposit_usd > property.rent_usd * 6
  ) {
    addIssue(
      "unusual-deposit",
      "Deposit appears unusually high",
      "The recorded deposit is significantly higher than the monthly rent.",
      "Confirm that the deposit amount is correct and consistent with the lease terms.",
      "medium",
    );
  }

  /* ------------------------------------------------------------------------ */
  /* PROPERTY DETAILS                                                          */
  /* ------------------------------------------------------------------------ */

  if (property.beds === null || property.beds < 0) {
    addIssue(
      "missing-beds",
      "Bedroom information is missing",
      "The number of bedrooms has not been provided.",
      "Add the correct number of bedrooms.",
      "medium",
    );
  }

  if (property.baths === null || property.baths < 0) {
    addIssue(
      "missing-baths",
      "Bathroom information is missing",
      "The number of bathrooms has not been provided.",
      "Add the correct number of bathrooms.",
      "medium",
    );
  }

  if (!property.property_type?.trim()) {
    addIssue(
      "missing-type",
      "Property type is missing",
      "Tenants cannot determine whether this is an apartment, house, cottage or another property type.",
      "Select the correct property type.",
      "medium",
    );
  }

  /* ------------------------------------------------------------------------ */
  /* DESCRIPTION                                                               */
  /* ------------------------------------------------------------------------ */

  if (!property.description?.trim()) {
    addIssue(
      "missing-description",
      "Property description is missing",
      "The listing does not provide meaningful information about the property.",
      "Add a detailed description covering the property, location and important conditions.",
      "high",
    );
  } else if (property.description.trim().length < 80) {
    addIssue(
      "short-description",
      "Property description is too brief",
      "The current description contains very little information for prospective tenants.",
      "Expand the description with useful property and location details.",
      "low",
    );
  }

  /* ------------------------------------------------------------------------ */
  /* IMAGES                                                                    */
  /* ------------------------------------------------------------------------ */

  if (!property.image_url?.trim()) {
    addIssue(
      "missing-image",
      "Listing image is missing",
      "Listings without photographs provide less confidence to prospective tenants.",
      "Add at least one clear photograph of the property.",
      "medium",
    );
  }

  /* ------------------------------------------------------------------------ */
  /* AMENITIES                                                                 */
  /* ------------------------------------------------------------------------ */

  if (!property.amenities || property.amenities.length === 0) {
    addIssue(
      "missing-amenities",
      "No amenities have been provided",
      "The listing does not identify available features or amenities.",
      "Add relevant amenities such as parking, borehole, security or internet.",
      "low",
    );
  }

  /* ------------------------------------------------------------------------ */
  /* VERIFICATION                                                              */
  /* ------------------------------------------------------------------------ */

  if (!property.verified) {
    addIssue(
      "not-verified",
      "Property has not been verified",
      "The property is currently not marked as verified within TNP.",
      "Complete the applicable property verification process.",
      "high",
    );
  }

  /* ------------------------------------------------------------------------ */
  /* FRAUD / INTEGRITY FLAGS                                                   */
  /* ------------------------------------------------------------------------ */

  if (property.fraud_flags && property.fraud_flags.length > 0) {
    property.fraud_flags.forEach((flag, index) => {
      addIssue(
        `fraud-${index}`,
        "Integrity flag detected",
        flag,
        "Review the flag and resolve the underlying issue before continuing to market the property.",
        "critical",
      );
    });
  }

  /* ------------------------------------------------------------------------ */
  /* SCORE                                                                     */
  /* ------------------------------------------------------------------------ */

  const completenessChecks = [
    Boolean(property.title?.trim()),
    Boolean(property.suburb?.trim()),
    Boolean(property.city?.trim()),
    property.rent_usd !== null && property.rent_usd > 0,
    property.deposit_usd !== null && property.deposit_usd >= 0,
    property.beds !== null && property.beds >= 0,
    property.baths !== null && property.baths >= 0,
    Boolean(property.property_type?.trim()),
    Boolean(property.description?.trim()),
    Boolean(property.image_url?.trim()),
    Boolean(property.amenities?.length),
  ];

  const completedChecks = completenessChecks.filter(Boolean).length;

  const completeness = Math.round((completedChecks / completenessChecks.length) * 100);

  const verification = property.verified ? 100 : 0;

  const fraudCount = property.fraud_flags?.length ?? 0;

  const risk = fraudCount > 0 ? Math.max(0, 100 - fraudCount * 30) : 100;

  let score = completeness * 0.6 + verification * 0.25 + risk * 0.15;

  score = Math.round(Math.max(0, Math.min(100, score)));

  let status: IntegrityStatus = "healthy";

  if (fraudCount > 0) {
    status = "critical";
  } else if (score < 85 || issues.length > 0) {
    status = "attention";
  }

  return {
    status,
    score,
    issues,
    completeness,
    verification,
    risk,
  };
}

/* -------------------------------------------------------------------------- */
/* UI COMPONENTS                                                              */
/* -------------------------------------------------------------------------- */

function StatusBadge({ status }: { status: IntegrityStatus }) {
  if (status === "healthy") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Healthy
      </span>
    );
  }

  if (status === "critical") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
        <ShieldAlert className="h-3.5 w-3.5" />
        Critical
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
      <AlertTriangle className="h-3.5 w-3.5" />
      Needs Attention
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const className =
    score >= 85
      ? "bg-emerald-50 text-emerald-700"
      : score >= 60
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-700";

  return (
    <span
      className={`inline-flex min-w-[62px] items-center justify-center rounded-full px-2.5 py-1 text-xs font-bold ${className}`}
    >
      {score}/100
    </span>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon,
  iconClassName,
}: {
  title: string;
  value: number | string;
  description: string;
  icon: ReactNode;
  iconClassName: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>

          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>

        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClassName}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-5 border-b border-slate-100 py-3 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>

      <span className="max-w-[60%] text-right text-sm font-medium text-slate-900">{value}</span>
    </div>
  );
}

function ProgressBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">{label}</span>

        <span className="text-xs font-bold text-slate-900">{value}%</span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${
            value >= 85 ? "bg-emerald-500" : value >= 60 ? "bg-amber-500" : "bg-red-500"
          }`}
          style={{
            width: `${value}%`,
          }}
        />
      </div>
    </div>
  );
}

function IssueSeverityBadge({ severity }: { severity: IssueSeverity }) {
  const classes =
    severity === "critical"
      ? "bg-red-100 text-red-700"
      : severity === "high"
        ? "bg-orange-100 text-orange-700"
        : severity === "medium"
          ? "bg-amber-100 text-amber-700"
          : "bg-slate-100 text-slate-600";

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${classes}`}
    >
      {severityLabel(severity)}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* PAGE                                                                       */
/* -------------------------------------------------------------------------- */

function ListingIntegrityPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [selectedProperty, setSelectedProperty] = useState<AnalysedProperty | null>(null);

  const [copiedId, setCopiedId] = useState(false);

  /* ------------------------------------------------------------------------ */
  /* PROPERTY QUERY                                                           */
  /* ------------------------------------------------------------------------ */

  const propertiesQuery = useQuery({
    queryKey: ["landlord-listing-integrity"],

    queryFn: async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("You must be signed in to view listing integrity.");
      }

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
            amenities,
            image_url,
            verified,
            available,
            fraud_flags,
            created_at
          `,
        )
        .eq("owner_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      return (data ?? []) as Property[];
    },
  });

  /* ------------------------------------------------------------------------ */
  /* ANALYSIS                                                                 */
  /* ------------------------------------------------------------------------ */

  const analysedProperties = useMemo<AnalysedProperty[]>(() => {
    return (propertiesQuery.data ?? []).map((property) => ({
      ...property,
      integrity: evaluateProperty(property),
    }));
  }, [propertiesQuery.data]);

  /* ------------------------------------------------------------------------ */
  /* FILTERING                                                                */
  /* ------------------------------------------------------------------------ */

  const filteredProperties = useMemo(() => {
    const query = search.trim().toLowerCase();

    return analysedProperties.filter((property) => {
      const matchesStatus = statusFilter === "all" || property.integrity.status === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchableText = [
        property.title,
        property.suburb,
        property.city,
        property.property_type,
        property.description,
        ...(property.amenities ?? []),
        ...(property.fraud_flags ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [analysedProperties, search, statusFilter]);

  /* ------------------------------------------------------------------------ */
  /* METRICS                                                                  */
  /* ------------------------------------------------------------------------ */

  const metrics = useMemo(() => {
    const total = analysedProperties.length;

    const healthy = analysedProperties.filter(
      (property) => property.integrity.status === "healthy",
    ).length;

    const attention = analysedProperties.filter(
      (property) => property.integrity.status === "attention",
    ).length;

    const critical = analysedProperties.filter(
      (property) => property.integrity.status === "critical",
    ).length;

    const verified = analysedProperties.filter((property) => property.verified).length;

    const listingsWithIssues = analysedProperties.filter(
      (property) => property.integrity.issues.length > 0,
    ).length;

    const averageScore =
      total > 0
        ? Math.round(
            analysedProperties.reduce((sum, property) => sum + property.integrity.score, 0) / total,
          )
        : 0;

    const totalIssues = analysedProperties.reduce(
      (sum, property) => sum + property.integrity.issues.length,
      0,
    );

    return {
      total,
      healthy,
      attention,
      critical,
      verified,
      listingsWithIssues,
      averageScore,
      totalIssues,
    };
  }, [analysedProperties]);

  /* ------------------------------------------------------------------------ */
  /* ACTIONS                                                                  */
  /* ------------------------------------------------------------------------ */

  const refresh = async () => {
    await propertiesQuery.refetch();
  };

  const openProperties = () => {
    navigate({
      to: "/app/landlord/properties",
    });
  };

  const copyPropertyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);

      setCopiedId(true);

      window.setTimeout(() => {
        setCopiedId(false);
      }, 1800);
    } catch {
      // Clipboard access may be unavailable in some browsers.
    }
  };

  return (
    <SidebarProvider>
      <RoleSidebar role="landlord" />

      <SidebarInset>
        <main className="min-w-0 flex-1 bg-slate-50 text-slate-900">
          <div className="relative min-h-screen">
            {/* ============================================================ */}
            {/* HEADER                                                       */}
            {/* ============================================================ */}

            <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
              <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                <div className="flex min-w-0 items-center gap-3">
                  <SidebarTrigger className="shrink-0" />

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                      <span>Landlord Portal</span>

                      <ChevronRight className="h-3.5 w-3.5" />

                      <span>Landlord Operations</span>
                    </div>

                    <h1 className="truncate text-lg font-bold text-slate-900">Listing Integrity</h1>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={refresh}
                  disabled={propertiesQuery.isFetching}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${propertiesQuery.isFetching ? "animate-spin" : ""}`}
                  />

                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </header>

            {/* ============================================================ */}
            {/* CONTENT                                                       */}
            {/* ============================================================ */}

            <section className="px-4 py-6 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-7xl">
                {/* INTRO */}

                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                      <ShieldCheck className="h-5 w-5" />
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                        Mutual Trust Ledger
                      </p>

                      <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                        Listing Integrity
                      </h2>

                      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                        Monitor listing quality, verification, completeness and potential integrity
                        risks before tenants rely on your properties.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={openProperties}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                  >
                    Manage Properties
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>

                {/* ======================================================== */}
                {/* LOADING                                                    */}
                {/* ======================================================== */}

                {propertiesQuery.isLoading && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                    <RefreshCw className="mx-auto h-7 w-7 animate-spin text-slate-400" />

                    <p className="mt-4 text-sm font-semibold text-slate-700">
                      Analysing your listings...
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Checking completeness, verification and integrity indicators.
                    </p>
                  </div>
                )}

                {/* ======================================================== */}
                {/* ERROR                                                      */}
                {/* ======================================================== */}

                {propertiesQuery.isError && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

                      <div>
                        <h3 className="font-semibold text-red-900">
                          Unable to load listing integrity
                        </h3>

                        <p className="mt-1 text-sm text-red-700">
                          {propertiesQuery.error instanceof Error
                            ? propertiesQuery.error.message
                            : "An unexpected error occurred while loading your properties."}
                        </p>

                        <button
                          type="button"
                          onClick={refresh}
                          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Try Again
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ======================================================== */}
                {/* MAIN                                                       */}
                {/* ======================================================== */}

                {!propertiesQuery.isLoading && !propertiesQuery.isError && (
                  <>
                    {/* METRICS */}

                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                      <MetricCard
                        title="Total Listings"
                        value={metrics.total}
                        description="Properties under your account"
                        icon={<Building2 className="h-5 w-5 text-slate-700" />}
                        iconClassName="bg-slate-100"
                      />

                      <MetricCard
                        title="Healthy"
                        value={metrics.healthy}
                        description="No issues detected"
                        icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                        iconClassName="bg-emerald-50"
                      />

                      <MetricCard
                        title="Attention"
                        value={metrics.attention}
                        description="Listings requiring work"
                        icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
                        iconClassName="bg-amber-50"
                      />

                      <MetricCard
                        title="Critical"
                        value={metrics.critical}
                        description="Potential integrity risks"
                        icon={<ShieldAlert className="h-5 w-5 text-red-600" />}
                        iconClassName="bg-red-50"
                      />

                      <MetricCard
                        title="Average Score"
                        value={`${metrics.averageScore}/100`}
                        description={`${metrics.totalIssues} total finding${metrics.totalIssues === 1 ? "" : "s"}`}
                        icon={<BadgeCheck className="h-5 w-5 text-blue-600" />}
                        iconClassName="bg-blue-50"
                      />
                    </div>

                    {/* ==================================================== */}
                    {/* HEALTH SUMMARY                                        */}
                    {/* ==================================================== */}

                    <div className="mt-6 grid gap-4 lg:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-bold text-slate-900">Integrity health</h3>

                            <p className="mt-1 text-sm text-slate-500">
                              A combined view of listing quality, verification and detected risk.
                            </p>
                          </div>

                          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
                            {metrics.averageScore}/100
                          </span>
                        </div>

                        <div className="mt-5 space-y-4">
                          <ProgressBar
                            label="Overall listing quality"
                            value={metrics.averageScore}
                          />

                          <ProgressBar
                            label="Verification coverage"
                            value={
                              metrics.total > 0
                                ? Math.round((metrics.verified / metrics.total) * 100)
                                : 0
                            }
                          />

                          <ProgressBar
                            label="Healthy listings"
                            value={
                              metrics.total > 0
                                ? Math.round((metrics.healthy / metrics.total) * 100)
                                : 0
                            }
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-2">
                          <Info className="h-4 w-4 text-slate-500" />

                          <h3 className="font-bold text-slate-900">What this checks</h3>
                        </div>

                        <div className="mt-4 space-y-3 text-sm">
                          <div className="flex gap-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            <span className="text-slate-600">Listing completeness</span>
                          </div>

                          <div className="flex gap-2">
                            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                            <span className="text-slate-600">Property verification</span>
                          </div>

                          <div className="flex gap-2">
                            <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                            <span className="text-slate-600">Listing media</span>
                          </div>

                          <div className="flex gap-2">
                            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                            <span className="text-slate-600">Integrity and fraud flags</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ==================================================== */}
                    {/* FILTERS                                                */}
                    {/* ==================================================== */}

                    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-3 lg:flex-row">
                        <div className="relative min-w-0 flex-1">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                          <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search listings, locations, property types..."
                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <SlidersHorizontal className="h-4 w-4 text-slate-400" />

                          <select
                            value={statusFilter}
                            onChange={(event) =>
                              setStatusFilter(event.target.value as StatusFilter)
                            }
                            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 outline-none focus:border-slate-400 focus:bg-white"
                          >
                            <option value="all">All statuses</option>

                            <option value="healthy">Healthy</option>

                            <option value="attention">Needs attention</option>

                            <option value="critical">Critical</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* ==================================================== */}
                    {/* TABLE                                                   */}
                    {/* ==================================================== */}

                    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="border-b border-slate-200 px-5 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-slate-900">Property integrity</h3>

                            <p className="mt-1 text-xs text-slate-500">
                              {filteredProperties.length} listing
                              {filteredProperties.length === 1 ? "" : "s"} shown
                            </p>
                          </div>

                          <FileWarning className="h-5 w-5 text-slate-400" />
                        </div>
                      </div>

                      {filteredProperties.length === 0 ? (
                        <div className="px-6 py-16 text-center">
                          <Building2 className="mx-auto h-10 w-10 text-slate-300" />

                          <h4 className="mt-4 font-semibold text-slate-800">No listings found</h4>

                          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                            {analysedProperties.length === 0
                              ? "You do not have any property listings yet."
                              : "Try changing your search or integrity status filter."}
                          </p>

                          {analysedProperties.length === 0 && (
                            <button
                              type="button"
                              onClick={openProperties}
                              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                            >
                              Add Property
                              <ArrowRight className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[950px]">
                            <thead>
                              <tr className="border-b border-slate-100 bg-slate-50">
                                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                  Property
                                </th>

                                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                  Location
                                </th>

                                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                  Verification
                                </th>

                                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                  Score
                                </th>

                                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                  Findings
                                </th>

                                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                  Status
                                </th>

                                <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                                  Action
                                </th>
                              </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100">
                              {filteredProperties.map((property) => (
                                <tr key={property.id} className="transition hover:bg-slate-50">
                                  <td className="px-5 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="h-12 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                                        {property.image_url ? (
                                          <img
                                            src={property.image_url}
                                            alt={property.title ?? "Property"}
                                            className="h-full w-full object-cover"
                                          />
                                        ) : (
                                          <div className="flex h-full w-full items-center justify-center">
                                            <ImageIcon className="h-5 w-5 text-slate-300" />
                                          </div>
                                        )}
                                      </div>

                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-slate-900">
                                          {property.title || "Untitled Property"}
                                        </p>

                                        <p className="mt-1 text-xs text-slate-500">
                                          {property.property_type || "Property type not set"}
                                        </p>
                                      </div>
                                    </div>
                                  </td>

                                  <td className="px-5 py-4">
                                    <div className="flex items-start gap-2">
                                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />

                                      <div>
                                        <p className="text-sm font-medium text-slate-800">
                                          {property.suburb || "Location not set"}
                                        </p>

                                        <p className="text-xs text-slate-500">
                                          {property.city || "—"}
                                        </p>
                                      </div>
                                    </div>
                                  </td>

                                  <td className="px-5 py-4">
                                    {property.verified ? (
                                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                                        <BadgeCheck className="h-4 w-4" />
                                        Verified
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                                        <AlertTriangle className="h-4 w-4" />
                                        Not verified
                                      </span>
                                    )}
                                  </td>

                                  <td className="px-5 py-4">
                                    <ScoreBadge score={property.integrity.score} />
                                  </td>

                                  <td className="px-5 py-4">
                                    <span
                                      className={`text-sm font-semibold ${
                                        property.integrity.issues.length === 0
                                          ? "text-emerald-700"
                                          : property.integrity.issues.length >= 4
                                            ? "text-red-700"
                                            : "text-amber-700"
                                      }`}
                                    >
                                      {property.integrity.issues.length}
                                    </span>

                                    <span className="ml-1 text-xs text-slate-500">
                                      finding
                                      {property.integrity.issues.length === 1 ? "" : "s"}
                                    </span>
                                  </td>

                                  <td className="px-5 py-4">
                                    <StatusBadge status={property.integrity.status} />
                                  </td>

                                  <td className="px-5 py-4 text-right">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedProperty(property)}
                                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                                    >
                                      Review
                                      <ArrowRight className="h-3.5 w-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* ==================================================== */}
                    {/* EXPLANATION                                            */}
                    {/* ==================================================== */}

                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />

                        <h4 className="mt-3 font-bold text-slate-900">Healthy</h4>

                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          The listing contains the required information, has no major integrity
                          findings and meets the current quality checks.
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />

                        <h4 className="mt-3 font-bold text-slate-900">Needs Attention</h4>

                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          Some listing information is incomplete, weak or requires verification.
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <ShieldAlert className="h-5 w-5 text-red-600" />

                        <h4 className="mt-3 font-bold text-slate-900">Critical</h4>

                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          Potential integrity or fraud indicators require immediate review.
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* ============================================================ */}
            {/* DETAIL DRAWER                                                 */}
            {/* ============================================================ */}

            {selectedProperty && (
              <div className="absolute inset-0 z-40">
                {/* BACKDROP */}

                <button
                  type="button"
                  aria-label="Close property details"
                  onClick={() => setSelectedProperty(null)}
                  className="absolute inset-0 h-full w-full bg-slate-900/20 backdrop-blur-[1px]"
                />

                {/* PANEL */}

                <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl">
                  {/* HEADER */}

                  <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                        Listing Integrity
                      </p>

                      <h2 className="mt-1 truncate text-lg font-bold text-slate-900">
                        {selectedProperty.title || "Untitled Property"}
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedProperty(null)}
                      className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* CONTENT */}

                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {/* IMAGE */}

                    <div className="relative h-56 bg-slate-100">
                      {selectedProperty.image_url ? (
                        <img
                          src={selectedProperty.image_url}
                          alt={selectedProperty.title ?? "Property"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <div className="text-center">
                            <ImageIcon className="mx-auto h-10 w-10 text-slate-300" />

                            <p className="mt-2 text-sm text-slate-400">No listing image</p>
                          </div>
                        </div>
                      )}

                      <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
                        <StatusBadge status={selectedProperty.integrity.status} />

                        {selectedProperty.verified && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-emerald-700 shadow-sm">
                            <BadgeCheck className="h-3.5 w-3.5" />
                            Verified
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-6 p-5">
                      {/* SCORE */}

                      <section>
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                              Integrity Score
                            </p>

                            <p className="mt-1 text-3xl font-bold text-slate-900">
                              {selectedProperty.integrity.score}

                              <span className="text-lg text-slate-400">/100</span>
                            </p>
                          </div>

                          <ScoreBadge score={selectedProperty.integrity.score} />
                        </div>

                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${
                              selectedProperty.integrity.score >= 85
                                ? "bg-emerald-500"
                                : selectedProperty.integrity.score >= 60
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                            }`}
                            style={{
                              width: `${selectedProperty.integrity.score}%`,
                            }}
                          />
                        </div>
                      </section>

                      {/* QUALITY BREAKDOWN */}

                      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-4 flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-slate-600" />

                          <h3 className="font-bold text-slate-900">Integrity breakdown</h3>
                        </div>

                        <div className="space-y-4">
                          <ProgressBar
                            label="Completeness"
                            value={selectedProperty.integrity.completeness}
                          />

                          <ProgressBar
                            label="Verification"
                            value={selectedProperty.integrity.verification}
                          />

                          <ProgressBar
                            label="Risk health"
                            value={selectedProperty.integrity.risk}
                          />
                        </div>
                      </section>

                      {/* FINDINGS */}

                      <section>
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CircleAlert className="h-4 w-4 text-slate-500" />

                            <h3 className="font-bold text-slate-900">Integrity findings</h3>
                          </div>

                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                            {selectedProperty.integrity.issues.length}
                          </span>
                        </div>

                        {selectedProperty.integrity.issues.length === 0 ? (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                            <div className="flex gap-3">
                              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

                              <div>
                                <p className="font-semibold text-emerald-900">No issues detected</p>

                                <p className="mt-1 text-sm text-emerald-700">
                                  This listing currently passes the available integrity checks.
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {selectedProperty.integrity.issues.map((issue) => (
                              <div
                                key={issue.id}
                                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-3">
                                    <AlertCircle
                                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                                        issue.severity === "critical"
                                          ? "text-red-600"
                                          : issue.severity === "high"
                                            ? "text-orange-600"
                                            : "text-amber-600"
                                      }`}
                                    />

                                    <div>
                                      <p className="text-sm font-bold text-slate-900">
                                        {issue.title}
                                      </p>

                                      <p className="mt-1 text-sm leading-5 text-slate-600">
                                        {issue.description}
                                      </p>
                                    </div>
                                  </div>

                                  <IssueSeverityBadge severity={issue.severity} />
                                </div>

                                <div className="mt-3 rounded-lg bg-slate-50 p-3">
                                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                                    Recommended action
                                  </p>

                                  <p className="mt-1 text-sm text-slate-700">
                                    {issue.recommendation}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>

                      {/* CRITICAL FLAGS */}

                      {selectedProperty.fraud_flags && selectedProperty.fraud_flags.length > 0 && (
                        <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
                          <div className="flex items-start gap-3">
                            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

                            <div>
                              <h3 className="font-bold text-red-900">Potential integrity flags</h3>

                              <p className="mt-1 text-sm text-red-700">
                                These flags require review before relying on the listing.
                              </p>

                              <div className="mt-3 space-y-2">
                                {selectedProperty.fraud_flags.map((flag, index) => (
                                  <div
                                    key={`${flag}-${index}`}
                                    className="rounded-lg border border-red-100 bg-white px-3 py-2 text-sm text-red-800"
                                  >
                                    {flag}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </section>
                      )}

                      {/* PROPERTY INFORMATION */}

                      <section>
                        <div className="mb-3 flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-slate-500" />

                          <h3 className="font-bold text-slate-900">Property information</h3>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white px-4">
                          <InfoRow
                            label="Property type"
                            value={selectedProperty.property_type || "Not provided"}
                          />

                          <InfoRow
                            label="Location"
                            value={
                              [selectedProperty.suburb, selectedProperty.city]
                                .filter(Boolean)
                                .join(", ") || "Not provided"
                            }
                          />

                          <InfoRow
                            label="Bedrooms"
                            value={selectedProperty.beds ?? "Not provided"}
                          />

                          <InfoRow
                            label="Bathrooms"
                            value={selectedProperty.baths ?? "Not provided"}
                          />

                          <InfoRow
                            label="Monthly rent"
                            value={formatCurrency(selectedProperty.rent_usd)}
                          />

                          <InfoRow
                            label="Deposit"
                            value={formatCurrency(selectedProperty.deposit_usd)}
                          />

                          <InfoRow
                            label="Availability"
                            value={selectedProperty.available ? "Available" : "Unavailable"}
                          />
                        </div>
                      </section>

                      {/* DESCRIPTION */}

                      <section>
                        <div className="mb-3 flex items-center gap-2">
                          <FileWarning className="h-4 w-4 text-slate-500" />

                          <h3 className="font-bold text-slate-900">Description</h3>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          {selectedProperty.description ? (
                            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                              {selectedProperty.description}
                            </p>
                          ) : (
                            <p className="text-sm italic text-slate-400">
                              No property description has been provided.
                            </p>
                          )}
                        </div>
                      </section>

                      {/* AMENITIES */}

                      <section>
                        <div className="mb-3 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-slate-500" />

                          <h3 className="font-bold text-slate-900">Amenities</h3>
                        </div>

                        {selectedProperty.amenities && selectedProperty.amenities.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {selectedProperty.amenities.map((amenity, index) => (
                              <span
                                key={`${amenity}-${index}`}
                                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                              >
                                {amenity}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                            No amenities have been added to this listing.
                          </div>
                        )}
                      </section>

                      {/* VERIFICATION */}

                      <section className="rounded-2xl border border-slate-200 bg-white">
                        <div className="border-b border-slate-100 px-4 py-3">
                          <div className="flex items-center gap-2">
                            <BadgeCheck className="h-4 w-4 text-slate-500" />

                            <h3 className="font-bold text-slate-900">Verification</h3>
                          </div>
                        </div>

                        <div className="px-4">
                          <InfoRow
                            label="Verification status"
                            value={
                              selectedProperty.verified ? (
                                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                                  <BadgeCheck className="h-4 w-4" />
                                  Verified
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-amber-700">
                                  <AlertTriangle className="h-4 w-4" />
                                  Not verified
                                </span>
                              )
                            }
                          />

                          <InfoRow
                            label="Created"
                            value={formatDate(selectedProperty.created_at)}
                          />

                          <InfoRow
                            label="Listing ID"
                            value={
                              <button
                                type="button"
                                onClick={() => copyPropertyId(selectedProperty.id)}
                                className="inline-flex max-w-full items-center gap-1.5 font-mono text-xs text-slate-700 hover:text-slate-900"
                              >
                                <span className="max-w-[190px] truncate">
                                  {selectedProperty.id}
                                </span>

                                {copiedId ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            }
                          />
                        </div>
                      </section>

                      {/* NEXT STEP */}

                      {selectedProperty.integrity.status !== "healthy" && (
                        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                          <div className="flex items-start gap-3">
                            <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

                            <div>
                              <h3 className="font-bold text-amber-900">Recommended next step</h3>

                              <p className="mt-1 text-sm leading-6 text-amber-800">
                                Correct the findings above and re-open this Integrity page to
                                recalculate the listing score.
                              </p>
                            </div>
                          </div>
                        </section>
                      )}
                    </div>
                  </div>

                  {/* ====================================================== */}
                  {/* FOOTER                                                   */}
                  {/* ====================================================== */}

                  <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4">
                    <button
                      type="button"
                      onClick={() => setSelectedProperty(null)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Close
                    </button>

                    <button
                      type="button"
                      onClick={openProperties}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Manage Property
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </aside>
              </div>
            )}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
