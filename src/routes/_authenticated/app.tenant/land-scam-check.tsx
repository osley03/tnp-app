import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  FileCheck2,
  FileSearch,
  Flag,
  Home,
  Info,
  LandPlot,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  UserCheck,
  WalletCards,
  XCircle,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/tenant/land-scam-check")({
  component: LandScamCheckPage,
});

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type PropertyRecord = {
  id: string;
  owner_id: string | null;
  title: string | null;
  suburb: string | null;
  city: string | null;
  rent_usd: number | null;
  deposit_usd: number | null;
  beds: number | null;
  baths: number | null;
  property_type: string | null;
  description: string | null;
  image_url: string | null;
  verified: boolean | null;
  available: boolean | null;
  fraud_flags: string[] | null;
  size: number | null;
  trust_score: number | null;
  landlord_name: string | null;
  landlord_verified: boolean | null;
  landlord_rating: number | null;
  has_360_tour: boolean | null;
  listing_type: string | null;
  property_category: string | null;
  size_unit: string | null;
  price_usd: number | null;
  price_unit: string | null;
  rooms: number | null;
  land_use: string | null;
  water_available: boolean | null;
  electricity_available: boolean | null;
  road_access: boolean | null;
  zoning: string | null;
  title_status: string | null;
  created_at: string | null;
};

type OwnerProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  verification: string | null;
  trust_score: number | null;
  bio?: string | null;
};

type FindingStatus = "clear" | "warning" | "danger" | "unknown";

type Finding = {
  category: string;
  status: FindingStatus;
  title: string;
  detail: string;
  points?: number;
};

type SafetyResult = {
  success: boolean;
  check_id?: string | null;
  property_id: string;
  property_found: boolean;
  owner_found: boolean;
  property: {
    id: string;
    title: string;
    suburb: string | null;
    city: string | null;
    property_type: string | null;
    property_category: string | null;
    listing_type: string | null;
    verified: boolean | null;
    title_status: string | null;
    zoning: string | null;
    land_use: string | null;
    water_available: boolean | null;
    electricity_available: boolean | null;
    road_access: boolean | null;
  };
  owner: OwnerProfile | null;
  checks: {
    owner_found: boolean;
    listing_verified: boolean;
    title_information_available: boolean;
    zoning_available: boolean;
    fraud_indicators: boolean;
    owner_verified: boolean;
  };
  risk_score: number;
  risk_level: "low" | "caution" | "high" | "insufficient_data";
  findings: Finding[];
  recommendations: string[];
  disclaimer: string;
};

type ManualData = {
  sellerName: string;
  sellerPhone: string;
  propertyName: string;
  propertyReference: string;
  location: string;
  address: string;
  askingPrice: string;
  titleStatus: string;
  sellerIdentity: string;
  documentsAvailable: string;
  paymentBeforeViewing: boolean;
  paymentBeforeDocuments: boolean;
  urgentPayment: boolean;
  unusualPayment: boolean;
  thirdPartyAccount: boolean;
  reservationFee: boolean;
  cashOnly: boolean;
  cryptoRequested: boolean;
  notes: string;
};

const initialManualData: ManualData = {
  sellerName: "",
  sellerPhone: "",
  propertyName: "",
  propertyReference: "",
  location: "",
  address: "",
  askingPrice: "",
  titleStatus: "",
  sellerIdentity: "",
  documentsAvailable: "",
  paymentBeforeViewing: false,
  paymentBeforeDocuments: false,
  urgentPayment: false,
  unusualPayment: false,
  thirdPartyAccount: false,
  reservationFee: false,
  cashOnly: false,
  cryptoRequested: false,
  notes: "",
};

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "Not provided";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function riskLabel(level: SafetyResult["risk_level"]) {
  switch (level) {
    case "low":
      return "LOW RISK";
    case "caution":
      return "CAUTION";
    case "high":
      return "HIGH RISK";
    default:
      return "INSUFFICIENT DATA";
  }
}

function riskDescription(level: SafetyResult["risk_level"]) {
  switch (level) {
    case "low":
      return "TNP found relatively few risk indicators in the information currently available.";
    case "caution":
      return "Some warning signs require further verification before you proceed.";
    case "high":
      return "TNP detected significant warning signs. Do not proceed with payment until the concerns are resolved.";
    default:
      return "There is not enough verified TNP information to make a reliable risk assessment.";
  }
}

function findingStatus(
  severity: string | null | undefined,
  passed: boolean | null | undefined,
): FindingStatus {
  if (severity === "critical" || severity === "high") {
    return "danger";
  }

  if (severity === "medium") {
    return "warning";
  }

  if (passed === true) {
    return "clear";
  }

  if (passed === false) {
    return "warning";
  }

  return "unknown";
}

function findingIcon(status: FindingStatus) {
  if (status === "clear") {
    return CheckCircle2;
  }

  if (status === "warning") {
    return AlertCircle;
  }

  if (status === "danger") {
    return ShieldAlert;
  }

  return Info;
}

function statusClasses(status: FindingStatus) {
  if (status === "clear") {
    return {
      wrapper: "border-emerald-200 bg-emerald-50",
      icon: "border-emerald-200 bg-white text-emerald-600",
      title: "text-emerald-900",
      text: "text-emerald-700",
    };
  }

  if (status === "warning") {
    return {
      wrapper: "border-amber-200 bg-amber-50",
      icon: "border-amber-200 bg-white text-amber-600",
      title: "text-amber-900",
      text: "text-amber-700",
    };
  }

  if (status === "danger") {
    return {
      wrapper: "border-red-200 bg-red-50",
      icon: "border-red-200 bg-white text-red-600",
      title: "text-red-900",
      text: "text-red-700",
    };
  }

  return {
    wrapper: "border-slate-200 bg-slate-50",
    icon: "border-slate-200 bg-white text-slate-500",
    title: "text-slate-900",
    text: "text-slate-600",
  };
}

function riskClasses(level: SafetyResult["risk_level"]) {
  switch (level) {
    case "low":
      return {
        badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
        panel: "border-emerald-200 bg-emerald-50/70",
        icon: "text-emerald-600",
        score: "text-emerald-700",
      };

    case "caution":
      return {
        badge: "border-amber-200 bg-amber-50 text-amber-700",
        panel: "border-amber-200 bg-amber-50/70",
        icon: "text-amber-600",
        score: "text-amber-700",
      };

    case "high":
      return {
        badge: "border-red-200 bg-red-50 text-red-700",
        panel: "border-red-50 bg-red-50/70",
        icon: "text-red-600",
        score: "text-red-700",
      };

    default:
      return {
        badge: "border-slate-200 bg-slate-100 text-slate-700",
        panel: "border-slate-200 bg-slate-50",
        icon: "text-slate-500",
        score: "text-slate-700",
      };
  }
}

/* -------------------------------------------------------------------------- */
/* PAGE                                                                       */
/* -------------------------------------------------------------------------- */

function LandScamCheckPage() {
  const navigate = useNavigate();

  const [properties, setProperties] = useState<PropertyRecord[]>([]);

  const [loadingProperties, setLoadingProperties] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");

  const [selectedProperty, setSelectedProperty] = useState<PropertyRecord | null>(null);

  const [checking, setChecking] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [safetyResult, setSafetyResult] = useState<SafetyResult | null>(null);

  const [mode, setMode] = useState<"property" | "manual">("property");

  const [manualData, setManualData] = useState<ManualData>(initialManualData);

  const [manualResult, setManualResult] = useState<SafetyResult | null>(null);

  /* ---------------------------------------------------------------------- */
  /* LOAD PROPERTIES                                                        */
  /* ---------------------------------------------------------------------- */

  const loadProperties = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoadingProperties(true);
    }

    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from("properties" as never)
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
                available,
                fraud_flags,
                size,
                trust_score,
                landlord_name,
                landlord_verified,
                landlord_rating,
                has_360_tour,
                listing_type,
                property_category,
                size_unit,
                price_usd,
                price_unit,
                rooms,
                land_use,
                water_available,
                electricity_available,
                road_access,
                zoning,
                title_status,
                created_at
              `,
        )
        .eq("available", true)
        .order("created_at", {
          ascending: false,
        });

      if (queryError) {
        throw new Error(queryError.message);
      }

      setProperties((data ?? []) as unknown as PropertyRecord[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load TNP properties.");
    } finally {
      setLoadingProperties(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  /* ---------------------------------------------------------------------- */
  /* FILTER                                                                  */
  /* ---------------------------------------------------------------------- */

  const filteredProperties = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return properties;

    return properties.filter((property) => {
      return [
        property.title,
        property.suburb,
        property.city,
        property.property_type,
        property.property_category,
        property.landlord_name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [properties, search]);

  /* ---------------------------------------------------------------------- */
  /* PROPERTY CHECK                                                          */
  /* ---------------------------------------------------------------------- */

  const runPropertyCheck = useCallback(async (property: PropertyRecord) => {
    setChecking(true);
    setError(null);
    setSafetyResult(null);
    setSelectedProperty(property);

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "run_land_scam_check" as never,
        {
          p_property_id: property.id,
          p_check_type: "property",
          p_property_reference: property.id,
          p_property_name: property.title ?? null,
          p_location: [property.suburb, property.city].filter(Boolean).join(", ") || null,
          p_address: [property.suburb, property.city].filter(Boolean).join(", ") || null,
          p_seller_name: property.landlord_name ?? null,
          p_seller_phone: null,
          p_seller_email: null,
          p_asking_price_usd: property.price_usd ?? property.rent_usd ?? null,
        } as never,
      );

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      if (!rpcData) {
        throw new Error("TNP returned no safety assessment.");
      }

      const raw = rpcData as Record<string, unknown>;

      const checkId =
        typeof raw["check_id"] === "string"
          ? raw["check_id"]
          : typeof raw["id"] === "string"
            ? raw["id"]
            : null;

      let findingRows: Array<{
        category?: string | null;
        title?: string | null;
        description?: string | null;
        severity?: string | null;
        passed?: boolean | null;
        points?: number | null;
      }> = [];

      if (checkId) {
        const { data: findingData, error: findingError } = await supabase
          .from("land_scam_check_findings" as never)
          .select("category,title,description,severity,passed,points")
          .eq("check_id", checkId)
          .order("created_at", {
            ascending: true,
          });

        if (findingError) {
          throw new Error(findingError.message);
        }

        findingRows = (findingData ?? []) as unknown as typeof findingRows;
      }

      let owner: OwnerProfile | null = null;

      if (property.owner_id) {
        const { data: ownerData, error: ownerError } = await supabase
          .from("profiles" as never)
          .select("id,full_name,phone,verification,trust_score,bio")
          .eq("id", property.owner_id)
          .maybeSingle();

        if (ownerError) {
          throw new Error(ownerError.message);
        }

        owner = (ownerData ?? null) as unknown as OwnerProfile | null;
      }

      const findings: Finding[] = findingRows.map((row) => ({
        category: row.category ?? "assessment",
        status: findingStatus(row.severity, row.passed),
        title: row.title ?? "TNP assessment finding",
        detail: row.description ?? "TNP returned an assessment finding.",
        ...(typeof row.points === "number" ? { points: row.points } : {}),
      }));

      const fraudIndicators =
        (property.fraud_flags?.length ?? 0) > 0 ||
        findings.some(
          (finding) =>
            finding.category === "fraud" &&
            (finding.status === "danger" || finding.status === "warning"),
        );

      const ownerVerified = Boolean(owner?.verification && owner.verification !== "Email only");

      const result: SafetyResult = {
        success: raw["success"] !== false,

        check_id: checkId,

        property_id: property.id,

        property_found: raw["property_found"] !== false,

        owner_found:
          raw["owner_found"] !== undefined ? Boolean(raw["owner_found"]) : Boolean(owner),

        property: {
          id: property.id,
          title: property.title ?? "Untitled property",
          suburb: property.suburb,
          city: property.city,
          property_type: property.property_type,
          property_category: property.property_category,
          listing_type: property.listing_type,
          verified: property.verified,
          title_status: property.title_status,
          zoning: property.zoning,
          land_use: property.land_use,
          water_available: property.water_available,
          electricity_available: property.electricity_available,
          road_access: property.road_access,
        },

        owner,

        checks: {
          owner_found: Boolean(owner),

          listing_verified: property.verified === true,

          title_information_available: Boolean(property.title_status),

          zoning_available: Boolean(property.zoning),

          fraud_indicators: fraudIndicators,

          owner_verified: ownerVerified,
        },

        risk_score: Math.min(100, Math.max(0, Number(raw["risk_score"] ?? 0))),

        risk_level:
          raw["risk_level"] === "low" ||
          raw["risk_level"] === "caution" ||
          raw["risk_level"] === "high" ||
          raw["risk_level"] === "insufficient_data"
            ? raw["risk_level"]
            : "insufficient_data",

        findings,

        recommendations: [
          "View the property physically before paying.",
          "Verify the seller's identity and contact details.",
          "Request ownership and property documentation.",
          "Independently verify documents before signing.",
          "Confirm the property address or stand reference.",
          "Do not transfer money because of pressure or urgency.",
          "Avoid payments to unrelated third-party accounts.",
          "Use TNP Escrow where available.",
          "Report suspicious activity to TNP.",
        ],

        disclaimer:
          "This assessment is an informational risk-screening tool. It does not constitute legal title verification, ownership certification, or a guarantee that a transaction is safe.",
      };

      setSafetyResult(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to complete the TNP safety assessment.",
      );
    } finally {
      setChecking(false);
    }
  }, []);

  /* ---------------------------------------------------------------------- */
  /* MANUAL CHECK                                                            */
  /* ---------------------------------------------------------------------- */

  const runManualCheck = useCallback(() => {
    setError(null);

    const redFlags: Finding[] = [];

    const warnings: Finding[] = [];

    const clear: Finding[] = [];

    if (!manualData.sellerName.trim()) {
      warnings.push({
        category: "identity",
        status: "warning",
        title: "Seller identity has not been supplied",
        detail:
          "TNP cannot assess the seller properly without a name or identifiable seller information.",
      });
    } else {
      clear.push({
        category: "identity",
        status: "clear",
        title: "Seller information supplied",
        detail: "A seller identity was supplied for pre-transaction screening.",
      });
    }

    if (manualData.sellerIdentity === "not_verified") {
      redFlags.push({
        category: "identity",
        status: "danger",
        title: "Seller identity is not verified",
        detail: "Do not rely on a seller's identity until it has been independently verified.",
      });
    }

    if (manualData.paymentBeforeViewing) {
      redFlags.push({
        category: "payment",
        status: "danger",
        title: "Payment requested before viewing",
        detail:
          "A request to pay before physically viewing or independently checking the property is a significant warning sign.",
      });
    }

    if (manualData.paymentBeforeDocuments) {
      redFlags.push({
        category: "payment",
        status: "danger",
        title: "Payment requested before documents",
        detail: "Do not pay simply to receive ownership or property documents.",
      });
    }

    if (manualData.urgentPayment) {
      redFlags.push({
        category: "payment",
        status: "danger",
        title: "Urgent payment pressure",
        detail: "Pressure to pay immediately can be used to prevent proper verification.",
      });
    }

    if (manualData.thirdPartyAccount) {
      redFlags.push({
        category: "payment",
        status: "danger",
        title: "Third-party payment account",
        detail:
          "Payment to an account that does not clearly belong to the seller is a major warning sign.",
      });
    }

    if (manualData.cryptoRequested) {
      redFlags.push({
        category: "payment",
        status: "danger",
        title: "Cryptocurrency requested",
        detail:
          "Cryptocurrency payments can be difficult to recover and should receive additional scrutiny.",
      });
    }

    if (manualData.cashOnly) {
      warnings.push({
        category: "payment",
        status: "warning",
        title: "Cash-only payment requested",
        detail:
          "Cash-only transactions provide less traceability. Require proper documentation and receipts.",
      });
    }

    if (manualData.reservationFee) {
      warnings.push({
        category: "payment",
        status: "warning",
        title: "Reservation fee requested",
        detail: "Confirm exactly what the fee is for and whether it is refundable before paying.",
      });
    }

    if (manualData.unusualPayment) {
      warnings.push({
        category: "payment",
        status: "warning",
        title: "Unusual payment method",
        detail:
          "Unusual payment methods should be independently verified before money is transferred.",
      });
    }

    if (manualData.documentsAvailable === "none") {
      redFlags.push({
        category: "document",
        status: "danger",
        title: "No supporting documents available",
        detail:
          "Proceeding without supporting documentation creates significant verification risk.",
      });
    } else if (manualData.documentsAvailable === "provided") {
      clear.push({
        category: "document",
        status: "clear",
        title: "Supporting documents supplied",
        detail:
          "Documents have been reported as available. They still require independent verification.",
      });
    }

    if (manualData.titleStatus === "missing") {
      warnings.push({
        category: "title",
        status: "warning",
        title: "Title information is unavailable",
        detail: "Ownership or title information should be obtained and independently verified.",
      });
    }

    if (manualData.titleStatus === "unclear") {
      warnings.push({
        category: "title",
        status: "warning",
        title: "Title information is unclear",
        detail: "Conflicting or unclear title information should be resolved before payment.",
      });
    }

    if (manualData.titleStatus === "provided") {
      clear.push({
        category: "title",
        status: "clear",
        title: "Title information has been supplied",
        detail:
          "The seller reports that title information is available. TNP does not independently certify legal ownership.",
      });
    }

    const score = redFlags.length * 22 + warnings.length * 8;

    let level: SafetyResult["risk_level"];

    if (
      !manualData.propertyName.trim() &&
      !manualData.location.trim() &&
      !manualData.sellerName.trim()
    ) {
      level = "insufficient_data";
    } else if (score >= 45) {
      level = "high";
    } else if (score >= 15) {
      level = "caution";
    } else {
      level = "low";
    }

    const findings = [...redFlags, ...warnings, ...clear];

    const recommendations = [
      "Physically view the property before making any payment.",
      "Verify the seller's identity using independent information.",
      "Request ownership/title documents and verify them independently.",
      "Confirm the property reference, location and boundaries.",
      "Do not pay because the seller says another buyer is waiting.",
      "Avoid third-party accounts and untraceable payment arrangements.",
      "Use a protected transaction mechanism such as TNP Escrow where available.",
      "If suspicious activity continues, stop the transaction and report it to TNP.",
    ];

    setManualResult({
      success: true,
      property_id: "",
      property_found: Boolean(manualData.propertyName || manualData.propertyReference),
      owner_found: Boolean(manualData.sellerName),
      property: {
        id: "",
        title: manualData.propertyName || "Manual property assessment",
        suburb: null,
        city: manualData.location || null,
        property_type: null,
        property_category: null,
        listing_type: null,
        verified: null,
        title_status: manualData.titleStatus || null,
        zoning: null,
        land_use: null,
        water_available: null,
        electricity_available: null,
        road_access: null,
      },
      owner: manualData.sellerName
        ? {
            id: "",
            full_name: manualData.sellerName,
            phone: manualData.sellerPhone || null,
            verification: manualData.sellerIdentity || null,
            trust_score: null,
          }
        : null,
      checks: {
        owner_found: Boolean(manualData.sellerName),
        listing_verified: false,
        title_information_available: Boolean(manualData.titleStatus),
        zoning_available: false,
        fraud_indicators: redFlags.length > 0,
        owner_verified: manualData.sellerIdentity === "verified",
      },
      risk_score: Math.min(100, Math.max(0, score)),
      risk_level: level,
      findings,
      recommendations,
      disclaimer:
        "This manual assessment is a pre-transaction screening tool. It does not verify legal title, ownership, land boundaries or the legitimacy of a transaction.",
    });
  }, [manualData]);

  /* ---------------------------------------------------------------------- */
  /* RESET                                                                   */
  /* ---------------------------------------------------------------------- */

  const resetCheck = () => {
    setSelectedProperty(null);
    setSafetyResult(null);
    setManualResult(null);
    setError(null);
  };

  /* ---------------------------------------------------------------------- */
  /* RENDER                                                                  */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="tnp-module tnp-module-light min-h-screen bg-slate-50 text-slate-900">
      {/* TOP HEADER */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() =>
                navigate({
                  to: "/app/tenant",
                })
              }
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Back</span>
            </button>

            <div className="hidden h-7 w-px bg-slate-200 sm:block" />

            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                <ShieldCheck className="size-5" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-black tracking-tight text-slate-950">
                    Land Scam Check
                  </p>
                  <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-700 sm:inline-flex">
                    TNP Safety
                  </span>
                </div>

                <p className="truncate text-xs text-slate-500">
                  Pre-transaction property & land risk assessment
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={refreshing || loadingProperties}
            onClick={() => void loadProperties(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(15,23,42,0.07),transparent_38%)]" />

          <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.35fr_0.65fr] lg:p-10">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                <Shield className="size-3.5" />
                MUTUAL TRUST LEDGER
              </div>

              <h1 className="max-w-3xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
                Check before you
                <span className="text-slate-500"> pay.</span>
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                Use TNP to identify warning signs around a property, land listing or seller before
                you transfer money or sign an agreement.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <TrustPill icon={UserCheck} title="Seller" text="Identity & trust" />
                <TrustPill icon={LandPlot} title="Property" text="Listing & land data" />
                <TrustPill icon={WalletCards} title="Payment" text="Transaction warnings" />
              </div>
            </div>

            <div className="flex items-center justify-center lg:justify-end">
              <div className="relative flex size-48 items-center justify-center rounded-full border border-slate-200 bg-slate-50 shadow-inner sm:size-56">
                <div className="absolute inset-5 rounded-full border border-slate-200" />
                <div className="absolute inset-10 rounded-full border border-slate-200" />

                <div className="relative flex size-24 flex-col items-center justify-center rounded-3xl bg-slate-900 text-white shadow-xl">
                  <ShieldCheck className="size-8" />
                  <span className="mt-1 text-[9px] font-black uppercase tracking-widest text-white/60">
                    TNP
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ERROR */}
        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-red-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Assessment error</p>
              <p className="mt-1 text-sm leading-6 text-red-700">{error}</p>
            </div>

            <button
              type="button"
              onClick={() => setError(null)}
              className="rounded-lg p-1 text-red-500 hover:bg-red-100"
            >
              <XCircle className="size-4" />
            </button>
          </div>
        )}

        {/* MODE SWITCH */}
        <section className="mt-6">
          <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-sm sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setMode("property");
                setManualResult(null);
                setError(null);
              }}
              className={`rounded-xl px-4 py-4 text-left transition ${
                mode === "property"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                    mode === "property" ? "bg-white/10" : "bg-slate-100"
                  }`}
                >
                  <Building2 className="size-5" />
                </div>

                <div>
                  <p className="text-sm font-black">Check a TNP property</p>
                  <p
                    className={`mt-1 text-xs leading-5 ${
                      mode === "property" ? "text-white/60" : "text-slate-500"
                    }`}
                  >
                    Assess a property already listed in TNP.
                  </p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("manual");
                setSafetyResult(null);
                setSelectedProperty(null);
                setError(null);
              }}
              className={`rounded-xl px-4 py-4 text-left transition ${
                mode === "manual"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                    mode === "manual" ? "bg-white/10" : "bg-slate-100"
                  }`}
                >
                  <FileSearch className="size-5" />
                </div>

                <div>
                  <p className="text-sm font-black">Check before dealing</p>
                  <p
                    className={`mt-1 text-xs leading-5 ${
                      mode === "manual" ? "text-white/60" : "text-slate-500"
                    }`}
                  >
                    Screen an external seller or land opportunity before payment.
                  </p>
                </div>
              </div>
            </button>
          </div>
        </section>

        {/* PROPERTY MODE */}
        {mode === "property" && (
          <section className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            {/* PROPERTY DIRECTORY */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-950">TNP Property Directory</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Select a listing to run a safety assessment.
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
                    {properties.length} listings
                  </div>
                </div>

                <div className="relative mt-5">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search property, suburb, city or landlord..."
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
                  />
                </div>
              </div>

              <div className="max-h-[720px] overflow-y-auto p-4">
                {loadingProperties ? (
                  <PropertySkeletons />
                ) : filteredProperties.length === 0 ? (
                  <EmptyProperties hasSearch={Boolean(search.trim())} />
                ) : (
                  <div className="space-y-3">
                    {filteredProperties.map((property) => (
                      <PropertyCard
                        key={property.id}
                        property={property}
                        selected={selectedProperty?.id === property.id}
                        onCheck={() => void runPropertyCheck(property)}
                        checking={checking && selectedProperty?.id === property.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RESULT PANEL */}
            <div className="min-w-0">
              {checking ? (
                <AssessmentLoading />
              ) : safetyResult ? (
                <SafetyResultPanel
                  result={safetyResult}
                  property={selectedProperty}
                  onReset={resetCheck}
                />
              ) : (
                <AssessmentIntro />
              )}
            </div>
          </section>
        )}

        {/* MANUAL MODE */}
        {mode === "manual" && (
          <section className="mt-6">
            {manualResult ? (
              <ManualResultPanel result={manualResult} onReset={() => setManualResult(null)} />
            ) : (
              <ManualCheckPanel
                data={manualData}
                setData={setManualData}
                onRun={runManualCheck}
                onCancel={resetCheck}
              />
            )}
          </section>
        )}

        {/* FOOTER SAFETY NOTE */}
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Info className="size-4" />
            </div>

            <div>
              <p className="text-sm font-bold text-slate-900">TNP safety principle</p>
              <p className="mt-1 text-xs leading-6 text-slate-500">
                A clean TNP assessment does not mean a transaction is guaranteed safe. Always
                inspect the property, verify the seller, independently verify documentation and use
                protected payment mechanisms where available.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SMALL COMPONENTS                                                           */
/* -------------------------------------------------------------------------- */

function TrustPill({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Shield;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Icon className="size-4" />
        </div>

        <div>
          <p className="text-xs font-black text-slate-900">{title}</p>
          <p className="text-[11px] text-slate-500">{text}</p>
        </div>
      </div>
    </div>
  );
}

function PropertyCard({
  property,
  selected,
  onCheck,
  checking,
}: {
  property: PropertyRecord;
  selected: boolean;
  onCheck: () => void;
  checking: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onCheck}
      disabled={checking}
      className={`group w-full rounded-2xl border p-3 text-left transition ${
        selected
          ? "border-slate-900 bg-slate-50 shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex gap-3">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
          {property.image_url ? (
            <img
              src={property.image_url}
              alt={property.title ?? "Property"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-400">
              <Home className="size-7" />
            </div>
          )}

          {property.verified && (
            <div className="absolute left-1.5 top-1.5 rounded-full bg-white/95 p-1 text-emerald-600 shadow-sm">
              <BadgeCheck className="size-3.5" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-950">
                {property.title || "Untitled property"}
              </p>

              <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                <MapPin className="size-3" />
                {[property.suburb, property.city].filter(Boolean).join(", ") ||
                  "Location unavailable"}
              </p>
            </div>

            <ChevronRight className="mt-1 size-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
              {property.property_category || property.property_type || "Property"}
            </span>

            {property.title_status && (
              <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                Title info
              </span>
            )}

            {property.fraud_flags && property.fraud_flags.length > 0 && (
              <span className="rounded-lg bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700">
                Risk flags
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function PropertySkeletons() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="animate-pulse rounded-2xl border border-slate-200 p-3">
          <div className="flex gap-3">
            <div className="size-20 rounded-xl bg-slate-200" />
            <div className="flex-1">
              <div className="h-4 w-2/3 rounded bg-slate-200" />
              <div className="mt-2 h-3 w-1/2 rounded bg-slate-200" />
              <div className="mt-4 h-5 w-1/3 rounded bg-slate-200" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyProperties({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
        <Search className="size-5" />
      </div>

      <p className="mt-4 text-sm font-black text-slate-900">
        {hasSearch ? "No matching properties" : "No available properties"}
      </p>

      <p className="mx-auto mt-2 max-w-sm text-xs leading-6 text-slate-500">
        {hasSearch
          ? "Try another property, suburb, city or landlord name."
          : "There are currently no available TNP properties to assess."}
      </p>
    </div>
  );
}

function AssessmentIntro() {
  return (
    <div className="flex min-h-[600px] flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="flex size-20 items-center justify-center rounded-3xl bg-slate-900 text-white shadow-xl">
        <ShieldCheck className="size-9" />
      </div>

      <p className="mt-6 text-xl font-black tracking-tight text-slate-950">
        Select a property to check
      </p>

      <p className="mt-2 max-w-md text-sm leading-7 text-slate-500">
        TNP will assess the available listing, owner, verification, title information, zoning and
        fraud indicators and give you a risk assessment.
      </p>

      <div className="mt-7 grid w-full max-w-xl gap-3 sm:grid-cols-2">
        <MiniCheck icon={UserCheck} title="Seller / Owner" text="Profile & trust signals" />
        <MiniCheck icon={FileCheck2} title="Documents" text="Title & listing information" />
        <MiniCheck icon={Flag} title="Fraud Indicators" text="Known TNP warning signals" />
        <MiniCheck icon={ShieldCheck} title="Risk Assessment" text="Low to high risk result" />
      </div>
    </div>
  );
}

function MiniCheck({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Shield;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
          <Icon className="size-4" />
        </div>

        <div>
          <p className="text-xs font-black text-slate-900">{title}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{text}</p>
        </div>
      </div>
    </div>
  );
}

function AssessmentLoading() {
  return (
    <div className="min-h-[600px] rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex h-full min-h-[520px] flex-col items-center justify-center text-center">
        <div className="flex size-20 items-center justify-center rounded-full border-4 border-slate-100 border-t-slate-900">
          <RefreshCw className="size-7 animate-spin text-slate-700" />
        </div>

        <p className="mt-6 text-lg font-black text-slate-950">Running TNP safety assessment</p>

        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
          Checking available property, owner, verification, title, zoning and fraud indicators.
        </p>

        <div className="mt-7 w-full max-w-sm space-y-2">
          {[
            "Checking listing information",
            "Checking owner profile",
            "Checking risk indicators",
          ].map((item) => (
            <div
              key={item}
              className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-left"
            >
              <div className="size-2 animate-pulse rounded-full bg-slate-400" />
              <span className="text-xs font-semibold text-slate-600">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* RESULT PANEL                                                               */
/* -------------------------------------------------------------------------- */

function SafetyResultPanel({
  result,
  property,
  onReset,
}: {
  result: SafetyResult;
  property: PropertyRecord | null;
  onReset: () => void;
}) {
  const classes = riskClasses(result.risk_level);

  return (
    <div className="space-y-5">
      {/* RISK HERO */}
      <section className={`overflow-hidden rounded-3xl border ${classes.panel} shadow-sm`}>
        <div className="border-b border-black/5 p-6 sm:p-7">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ${classes.icon}`}
              >
                {result.risk_level === "high" ? (
                  <ShieldAlert className="size-7" />
                ) : result.risk_level === "caution" ? (
                  <AlertCircle className="size-7" />
                ) : result.risk_level === "low" ? (
                  <ShieldCheck className="size-7" />
                ) : (
                  <Info className="size-7" />
                )}
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  TNP Assessment
                </p>

                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                  {riskLabel(result.risk_level)}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/80 bg-white px-5 py-3 text-center shadow-sm">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Risk score
                </p>
                <p className={`mt-0.5 text-2xl font-black ${classes.score}`}>
                  {result.risk_score}
                  <span className="text-sm text-slate-400">/100</span>
                </p>
              </div>
            </div>
          </div>

          <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-700">
            {riskDescription(result.risk_level)}
          </p>

          {property && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="rounded-xl bg-white/80 px-3 py-2 text-xs font-bold text-slate-700">
                {property.title || "Property"}
              </span>

              <span className="inline-flex items-center gap-1 rounded-xl bg-white/80 px-3 py-2 text-xs font-bold text-slate-600">
                <MapPin className="size-3.5" />
                {[property.suburb, property.city].filter(Boolean).join(", ") ||
                  "Location unavailable"}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 bg-white/50 p-4">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft className="size-3.5" />
            Check another
          </button>
        </div>
      </section>

      {/* CHECK MATRIX */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <p className="text-sm font-black text-slate-950">Verification snapshot</p>
          <p className="mt-1 text-xs text-slate-500">Signals currently available to TNP.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <CheckTile label="Owner found" passed={result.checks.owner_found} />
          <CheckTile label="Listing verified" passed={result.checks.listing_verified} />
          <CheckTile label="Owner verification" passed={result.checks.owner_verified} />
          <CheckTile label="Title information" passed={result.checks.title_information_available} />
          <CheckTile label="Zoning information" passed={result.checks.zoning_available} />
          <CheckTile label="No fraud indicators" passed={!result.checks.fraud_indicators} />
        </div>
      </section>

      {/* OWNER + PROPERTY */}
      <div className="grid gap-5 xl:grid-cols-2">
        <OwnerCard owner={result.owner} />

        <PropertyInformationCard result={result} />
      </div>

      {/* FINDINGS */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-slate-950">TNP findings</p>
            <p className="mt-1 text-xs text-slate-500">
              Evidence and signals contributing to this assessment.
            </p>
          </div>

          <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">
            {result.findings.length} findings
          </span>
        </div>

        {result.findings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-7 text-center">
            <Info className="mx-auto size-6 text-slate-400" />
            <p className="mt-3 text-sm font-bold text-slate-700">No detailed findings returned</p>
            <p className="mt-1 text-xs text-slate-500">
              The risk score is still based on the TNP assessment available for this property.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {result.findings.map((finding, index) => (
              <FindingCard
                key={`${finding.category}-${finding.title}-${index}`}
                finding={finding}
              />
            ))}
          </div>
        )}
      </section>

      {/* RECOMMENDATIONS */}
      <section className="rounded-3xl border border-slate-200 bg-slate-900 p-5 text-white shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <ShieldCheck className="size-5" />
          </div>

          <div>
            <p className="text-sm font-black">Recommended next steps</p>
            <p className="mt-1 text-xs leading-5 text-white/50">
              Do these before committing money or signing an agreement.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {result.recommendations.map((recommendation, index) => (
            <div
              key={recommendation}
              className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[10px] font-black text-white/70">
                {index + 1}
              </span>

              <p className="text-xs leading-5 text-white/75">{recommendation}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DISCLAIMER */}
      <Disclaimer text={result.disclaimer} />
    </div>
  );
}

function CheckTile({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <span className="text-xs font-bold text-slate-700">{label}</span>

      {passed ? (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">
          <CheckCircle2 className="size-3" />
          Clear
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700">
          <AlertCircle className="size-3" />
          Check
        </span>
      )}
    </div>
  );
}

function OwnerCard({ owner }: { owner: OwnerProfile | null }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <User className="size-5" />
        </div>

        <div>
          <p className="text-sm font-black text-slate-950">Seller / owner</p>
          <p className="text-xs text-slate-500">TNP identity and trust information</p>
        </div>
      </div>

      {owner ? (
        <div className="mt-5">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <UserCheck className="size-5" />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-950">
                {owner.full_name || "Unnamed owner"}
              </p>

              {owner.phone && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <Phone className="size-3" />
                  {owner.phone}
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                Verification
              </p>
              <p className="mt-1 text-xs font-bold text-slate-800">
                {owner.verification || "Not provided"}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                Trust score
              </p>
              <p className="mt-1 text-lg font-black text-slate-900">
                {owner.trust_score ?? "—"}
                {owner.trust_score !== null && owner.trust_score !== undefined && (
                  <span className="text-xs text-slate-400">/100</span>
                )}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex gap-3">
            <AlertCircle className="size-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-xs font-black text-amber-900">No matching TNP owner profile</p>
              <p className="mt-1 text-xs leading-5 text-amber-700">
                The property owner could not be matched to a TNP profile. Verify the seller
                independently before proceeding.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function PropertyInformationCard({ result }: { result: SafetyResult }) {
  const property = result.property;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <LandPlot className="size-5" />
        </div>

        <div>
          <p className="text-sm font-black text-slate-950">Property information</p>
          <p className="text-xs text-slate-500">
            Information currently associated with this listing
          </p>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-base font-black text-slate-950">{property.title}</p>

        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin className="size-3.5" />
          {[property.suburb, property.city].filter(Boolean).join(", ") || "Location unavailable"}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <InfoTile label="Property type" value={property.property_type || "Not provided"} />

          <InfoTile label="Category" value={property.property_category || "Not provided"} />

          <InfoTile label="Listing" value={property.listing_type || "Not provided"} />

          <InfoTile label="Land use" value={property.land_use || "Not provided"} />

          <InfoTile label="Title status" value={property.title_status || "Not provided"} />

          <InfoTile label="Zoning" value={property.zoning || "Not provided"} />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <UtilityTile label="Water" value={property.water_available} />
          <UtilityTile label="Electricity" value={property.electricity_available} />
          <UtilityTile label="Road" value={property.road_access} />
        </div>
      </div>
    </section>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 truncate text-xs font-bold text-slate-800">{value}</p>
    </div>
  );
}

function UtilityTile({ label, value }: { label: string; value: boolean | null }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
      {value ? (
        <CheckCircle2 className="mx-auto size-4 text-emerald-600" />
      ) : value === false ? (
        <XCircle className="mx-auto size-4 text-red-500" />
      ) : (
        <Info className="mx-auto size-4 text-slate-400" />
      )}

      <p className="mt-1 text-[9px] font-bold text-slate-500">{label}</p>
    </div>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const Icon = findingIcon(finding.status);

  const classes = statusClasses(finding.status);

  return (
    <div className={`rounded-2xl border p-4 ${classes.wrapper}`}>
      <div className="flex gap-3">
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-xl border ${classes.icon}`}
        >
          <Icon className="size-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={`text-xs font-black ${classes.title}`}>{finding.title}</p>

            <span className="rounded-lg bg-white/70 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-500">
              {finding.category}
            </span>
          </div>

          <p className={`mt-1 text-xs leading-6 ${classes.text}`}>{finding.detail}</p>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* MANUAL CHECK                                                               */
/* -------------------------------------------------------------------------- */

function ManualCheckPanel({
  data,
  setData,
  onRun,
  onCancel,
}: {
  data: ManualData;
  setData: React.Dispatch<React.SetStateAction<ManualData>>;
  onRun: () => void;
  onCancel: () => void;
}) {
  const update = <K extends keyof ManualData>(key: K, value: ManualData[K]) => {
    setData((current) => ({
      ...current,
      [key]: value,
    }));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <FileSearch className="size-5" />
            </div>

            <div>
              <p className="text-sm font-black text-slate-950">Pre-transaction screening</p>
              <p className="text-xs text-slate-500">
                Tell TNP what you already know about the deal.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-7">
          <FormSection
            title="Seller information"
            description="Use the information given to you by the person offering the property."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Seller name"
                value={data.sellerName}
                onChange={(value) => update("sellerName", value)}
                placeholder="Full name"
              />

              <Field
                label="Seller phone"
                value={data.sellerPhone}
                onChange={(value) => update("sellerPhone", value)}
                placeholder="+263..."
              />
            </div>

            <SelectField
              label="Seller identity"
              value={data.sellerIdentity}
              onChange={(value) => update("sellerIdentity", value)}
              options={[
                ["", "Select status"],
                ["verified", "Identity independently verified"],
                ["not_verified", "Identity not verified"],
                ["claimed", "Seller only claims identity"],
              ]}
            />
          </FormSection>

          <FormSection
            title="Property / land information"
            description="Capture the details you have before dealing with the seller."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Property / land name"
                value={data.propertyName}
                onChange={(value) => update("propertyName", value)}
                placeholder="e.g. Stand 123..."
              />

              <Field
                label="Property reference"
                value={data.propertyReference}
                onChange={(value) => update("propertyReference", value)}
                placeholder="Stand / plot / reference"
              />

              <Field
                label="Location"
                value={data.location}
                onChange={(value) => update("location", value)}
                placeholder="City / suburb"
              />

              <Field
                label="Address"
                value={data.address}
                onChange={(value) => update("address", value)}
                placeholder="Physical address"
              />

              <Field
                label="Asking price"
                value={data.askingPrice}
                onChange={(value) => update("askingPrice", value)}
                placeholder="USD amount"
                type="number"
              />
            </div>
          </FormSection>

          <FormSection
            title="Documents"
            description="Having a document does not mean the document is legally genuine. Verification is still required."
          >
            <SelectField
              label="Title / ownership information"
              value={data.titleStatus}
              onChange={(value) => update("titleStatus", value)}
              options={[
                ["", "Select status"],
                ["provided", "Information supplied"],
                ["unclear", "Information is unclear"],
                ["missing", "Information unavailable"],
              ]}
            />

            <SelectField
              label="Supporting documents"
              value={data.documentsAvailable}
              onChange={(value) => update("documentsAvailable", value)}
              options={[
                ["", "Select status"],
                ["provided", "Documents supplied"],
                ["none", "No documents supplied"],
              ]}
            />
          </FormSection>

          <FormSection
            title="Payment behaviour"
            description="Select every warning sign that applies."
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <CheckInput
                checked={data.paymentBeforeViewing}
                onChange={(value) => update("paymentBeforeViewing", value)}
                label="Payment requested before viewing"
              />

              <CheckInput
                checked={data.paymentBeforeDocuments}
                onChange={(value) => update("paymentBeforeDocuments", value)}
                label="Payment requested before documents"
              />

              <CheckInput
                checked={data.urgentPayment}
                onChange={(value) => update("urgentPayment", value)}
                label="Seller is creating payment urgency"
              />

              <CheckInput
                checked={data.unusualPayment}
                onChange={(value) => update("unusualPayment", value)}
                label="Unusual payment method"
              />

              <CheckInput
                checked={data.thirdPartyAccount}
                onChange={(value) => update("thirdPartyAccount", value)}
                label="Third-party account requested"
              />

              <CheckInput
                checked={data.reservationFee}
                onChange={(value) => update("reservationFee", value)}
                label="Reservation fee requested"
              />

              <CheckInput
                checked={data.cashOnly}
                onChange={(value) => update("cashOnly", value)}
                label="Cash-only payment"
              />

              <CheckInput
                checked={data.cryptoRequested}
                onChange={(value) => update("cryptoRequested", value)}
                label="Cryptocurrency requested"
              />
            </div>
          </FormSection>

          <FormSection
            title="Additional notes"
            description="Record anything unusual about the seller, property or transaction."
          >
            <textarea
              value={data.notes}
              onChange={(event) => update("notes", event.target.value)}
              rows={5}
              placeholder="Describe anything that concerns you..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
            />
          </FormSection>
        </div>

        <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onRun}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
          >
            <ShieldCheck className="size-4" />
            Run Safety Assessment
          </button>
        </div>
      </section>

      <section className="h-fit rounded-3xl border border-slate-200 bg-slate-900 p-6 text-white shadow-sm lg:sticky lg:top-24">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-white/10">
          <ShieldAlert className="size-6" />
        </div>

        <h2 className="mt-5 text-xl font-black">What TNP is looking for</h2>

        <p className="mt-2 text-sm leading-7 text-white/55">
          This check is designed to make you pause before money changes hands.
        </p>

        <div className="mt-6 space-y-3">
          {[
            ["Identity", "Can the seller be independently identified?"],
            ["Property", "Are the property details consistent?"],
            ["Documents", "Are supporting documents available?"],
            ["Payment", "Is the seller using suspicious payment behaviour?"],
            ["Pressure", "Are you being rushed into a decision?"],
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-black">{title}</p>
              <p className="mt-1 text-xs leading-5 text-white/50">{text}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
          <p className="text-xs font-bold text-amber-200">Important</p>
          <p className="mt-1 text-xs leading-5 text-white/55">
            TNP cannot certify legal ownership or guarantee that a seller is legitimate. Independent
            verification remains essential.
          </p>
        </div>
      </section>
    </div>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-sm font-black text-slate-950">{title}</p>

      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>

      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-slate-700">{label}</span>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-slate-700">{label}</span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckInput({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition ${
        checked ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50 hover:bg-white"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 rounded border-slate-300 accent-slate-900"
      />

      <span className="text-xs font-semibold leading-5 text-slate-700">{label}</span>
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* MANUAL RESULT                                                              */
/* -------------------------------------------------------------------------- */

function ManualResultPanel({ result, onReset }: { result: SafetyResult; onReset: () => void }) {
  const classes = riskClasses(result.risk_level);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <section className={`rounded-3xl border ${classes.panel} p-6 shadow-sm sm:p-8`}>
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`flex size-16 items-center justify-center rounded-2xl bg-white shadow-sm ${classes.icon}`}
            >
              {result.risk_level === "high" ? (
                <ShieldAlert className="size-8" />
              ) : result.risk_level === "caution" ? (
                <AlertCircle className="size-8" />
              ) : (
                <ShieldCheck className="size-8" />
              )}
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                Manual pre-deal assessment
              </p>

              <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
                {riskLabel(result.risk_level)}
              </h2>
            </div>
          </div>

          <div className="rounded-2xl border border-white/80 bg-white px-6 py-4 text-center shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Risk score
            </p>

            <p className={`text-3xl font-black ${classes.score}`}>
              {result.risk_score}
              <span className="text-sm text-slate-400">/100</span>
            </p>
          </div>
        </div>

        <p className="mt-6 max-w-3xl text-sm leading-7 text-slate-700">
          {riskDescription(result.risk_level)}
        </p>

        <button
          type="button"
          onClick={onReset}
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="size-3.5" />
          Run another check
        </button>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-black text-slate-950">Assessment findings</p>

          <div className="mt-5 space-y-3">
            {result.findings.map((finding, index) => (
              <FindingCard key={`${finding.title}-${index}`} finding={finding} />
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-slate-900 p-6 text-white shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-5" />
            <p className="text-sm font-black">Before you proceed</p>
          </div>

          <div className="mt-5 space-y-2">
            {result.recommendations.map((item, index) => (
              <div
                key={item}
                className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[10px] font-black">
                  {index + 1}
                </span>

                <p className="text-xs leading-5 text-white/70">{item}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Disclaimer text={result.disclaimer} />
    </div>
  );
}

function Disclaimer({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4">
      <div className="flex gap-3">
        <Info className="mt-0.5 size-4 shrink-0 text-slate-500" />

        <div>
          <p className="text-xs font-black text-slate-700">Important limitation</p>

          <p className="mt-1 text-xs leading-6 text-slate-500">{text}</p>
        </div>
      </div>
    </div>
  );
}
