import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Eye,
  Filter,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Users,
  X,
  Send,
  Flag,
  MapPin,
  Home,
  BadgeCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { LandlordPropertyHistory } from "@/modules/landlords/LandlordPropertyHistory";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/tenant/landlords")({
  component: TenantLandlords,
});

type Landlord = {
  landlord_id: string;
  full_name: string | null;
  bio: string | null;
  verification: string | null;
  trust_score: number | null;
  member_since: string | null;

  property_count: number;
  active_property_count: number;
  verified_property_count: number;
  properties_with_360_tour_count: number;

  review_count: number;
  average_rating: number;
  five_star_count: number;
  four_star_count: number;
  three_star_count: number;
  two_star_count: number;
  one_star_count: number;
  verified_review_count: number;
  responded_review_count: number;
};

type LandlordProperty = {
  property_id: string;
  landlord_id: string;
  title: string | null;
  suburb: string | null;
  city: string | null;
  rent_usd: number | null;
  deposit_usd: number | null;
  beds: number | null;
  baths: number | null;
  rooms: number | null;
  property_type: string | null;
  property_category: string | null;
  description: string | null;
  amenities: string[] | null;
  image_url: string | null;
  image_urls: string[] | null;
  verified: boolean | null;
  available: boolean | null;
  trust_score: number | null;
  landlord_name: string | null;
  landlord_verified: boolean | null;
  landlord_rating: number | null;
  has_360_tour: boolean | null;
  listing_type: string | null;
  created_at: string | null;
};

type Review = {
  id: string;
  author_id: string;
  subject_id: string;
  property_id: string | null;
  rating: number;
  body: string | null;
  lease_confirmed: boolean | null;
  created_at: string;
  moderation_status: string | null;
  landlord_response: string | null;
  landlord_responded_at: string | null;
};

const verificationIsStrong = (value: string | null) => {
  if (!value) return false;

  const normalized = value.trim().toLowerCase();
  if (["unverified", "not verified", "pending", "email only"].some(item => normalized.includes(item))) return false;

  return (
    normalized.includes("verified") ||
    normalized.includes("identity") ||
    normalized.includes("phone")
  );
};

const trustLabel = (score: number) => {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Good";
  if (score >= 40) return "Developing";
  return "Needs attention";
};

const trustTone = (score: number) => {
  if (score >= 80) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (score >= 60) {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }

  if (score >= 40) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  return "bg-red-50 text-red-700 border-red-200";
};

const formatDate = (value: string | null) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-ZW", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

const formatMoney = (value: number | null) => {
  if (value === null || value === undefined) return "Price on request";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
};

function TenantLandlords() {
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [trustFilter, setTrustFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [sortBy, setSortBy] = useState("trust");

  const [selectedLandlord, setSelectedLandlord] = useState<Landlord | null>(null);

  const [selectedProperty, setSelectedProperty] = useState<LandlordProperty | null>(null);

  const [properties, setProperties] = useState<LandlordProperty[]>([]);

  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  const [contactOpen, setContactOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");

  const [reportCategory, setReportCategory] = useState("other");
  const [reportDescription, setReportDescription] = useState("");

  const [actionLoading, setActionLoading] = useState(false);

  const loadLandlords = useCallback(async (showRefreshState = false) => {
    if (showRefreshState) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from("tenant_landlord_profiles" as never)
        .select("*");

      if (queryError) {
        throw queryError;
      }

      const rows = ((data ?? []) as unknown as Landlord[]).map((row) => ({
        ...row,
        property_count: Number(row.property_count ?? 0),
        active_property_count: Number(row.active_property_count ?? 0),
        verified_property_count: Number(row.verified_property_count ?? 0),
        properties_with_360_tour_count: Number(row.properties_with_360_tour_count ?? 0),
        review_count: Number(row.review_count ?? 0),
        average_rating: Number(row.average_rating ?? 0),
        five_star_count: Number(row.five_star_count ?? 0),
        four_star_count: Number(row.four_star_count ?? 0),
        three_star_count: Number(row.three_star_count ?? 0),
        two_star_count: Number(row.two_star_count ?? 0),
        one_star_count: Number(row.one_star_count ?? 0),
        verified_review_count: Number(row.verified_review_count ?? 0),
        responded_review_count: Number(row.responded_review_count ?? 0),
      }));

      setLandlords(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load landlords.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadLandlordDetails = useCallback(async (landlord: Landlord) => {
    setDetailsError("");
    setSelectedLandlord(landlord);
    setSelectedProperty(null);
    setProperties([]);
    setReviews([]);

    setPropertiesLoading(true);
    setReviewsLoading(true);

    const [propertyResult, reviewResult] = await Promise.all([
      supabase
        .from("tenant_landlord_properties" as never)
        .select("*")
        .eq("landlord_id", landlord.landlord_id),

      supabase
        .from("reviews" as never)
        .select(
          "id, author_id, subject_id, property_id, rating, body, lease_confirmed, created_at, moderation_status, landlord_response, landlord_responded_at",
        )
        .eq("subject_id", landlord.landlord_id)
        .in("moderation_status", ["approved", "published"])
        .order("created_at", {
          ascending: false,
        }),
    ]);

    if (propertyResult.error || reviewResult.error) {
      setDetailsError(propertyResult.error?.message || reviewResult.error?.message || "Landlord details could not be loaded.");
    }

    if (!propertyResult.error) {
      setProperties((propertyResult.data ?? []) as unknown as LandlordProperty[]);
    }

    if (!reviewResult.error) {
      setReviews((reviewResult.data ?? []) as unknown as Review[]);
    }

    setPropertiesLoading(false);
    setReviewsLoading(false);
  }, []);

  useEffect(() => {
    void loadLandlords();
  }, [loadLandlords]);

  const filteredLandlords = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = landlords.filter((landlord) => {
      const matchesSearch =
        !query ||
        landlord.full_name?.toLowerCase().includes(query) ||
        landlord.bio?.toLowerCase().includes(query);

      const verified = verificationIsStrong(landlord.verification);

      const matchesVerification =
        verificationFilter === "all" ||
        (verificationFilter === "verified" && verified) ||
        (verificationFilter === "unverified" && !verified);

      const score = landlord.trust_score ?? 0;

      const matchesTrust =
        trustFilter === "all" ||
        (trustFilter === "strong" && score >= 80) ||
        (trustFilter === "good" && score >= 60 && score < 80) ||
        (trustFilter === "developing" && score >= 40 && score < 60) ||
        (trustFilter === "attention" && score < 40);

      const rating = landlord.average_rating ?? 0;

      const matchesRating =
        ratingFilter === "all" ||
        (ratingFilter === "4plus" && rating >= 4) ||
        (ratingFilter === "3plus" && rating >= 3);

      return Boolean(matchesSearch) && matchesVerification && matchesTrust && matchesRating;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "rating") {
        return (b.average_rating ?? 0) - (a.average_rating ?? 0);
      }

      if (sortBy === "properties") {
        return b.active_property_count - a.active_property_count;
      }

      if (sortBy === "reviews") {
        return b.review_count - a.review_count;
      }

      return (b.trust_score ?? 0) - (a.trust_score ?? 0);
    });
  }, [landlords, search, verificationFilter, trustFilter, ratingFilter, sortBy]);

  const metrics = useMemo(() => {
    const verified = landlords.filter((landlord) =>
      verificationIsStrong(landlord.verification),
    ).length;

    const trustTotal = landlords.reduce(
      (sum, landlord) => sum + Number(landlord.trust_score ?? 0),
      0,
    );

    const ratingValues = landlords
      .map((landlord) => Number(landlord.average_rating ?? 0))
      .filter((rating) => rating > 0);

    return {
      total: landlords.length,
      verified,
      averageTrust: landlords.length ? Math.round(trustTotal / landlords.length) : 0,
      averageRating: ratingValues.length
        ? (ratingValues.reduce((sum, rating) => sum + rating, 0) / ratingValues.length).toFixed(1)
        : "0.0",
    };
  }, [landlords]);

  const closeProfile = () => {
    setSelectedLandlord(null);
    setSelectedProperty(null);
    setProperties([]);
    setReviews([]);
  };

  const submitContact = async () => {
    if (!selectedLandlord || !contactMessage.trim()) {
      return;
    }

    setActionLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const { error: insertError } = await supabase
        .from("landlord_contact_requests" as never)
        .insert({
          tenant_id: user.id,
          landlord_id: selectedLandlord.landlord_id,
          subject: contactSubject.trim() || "Tenant enquiry",
          message: contactMessage.trim(),
          status: "open",
        } as never);

      if (insertError) {
        throw insertError;
      }

      setContactOpen(false);
      setContactSubject("");
      setContactMessage("");

      alert("Your message has been sent to the landlord.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unable to send your message.");
    } finally {
      setActionLoading(false);
    }
  };

  const submitReport = async () => {
    if (!selectedLandlord || !reportDescription.trim()) {
      return;
    }

    setActionLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const { error: insertError } = await supabase.from("landlord_reports" as never).insert({
        reporter_id: user.id,
        landlord_id: selectedLandlord.landlord_id,
        category: reportCategory,
        description: reportDescription.trim(),
        status: "submitted",
        priority: "medium",
      } as never);

      if (insertError) {
        throw insertError;
      }

      setReportOpen(false);
      setReportDescription("");
      setReportCategory("other");

      alert("Your concern has been submitted for review.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unable to submit the report.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="tnp-module tnp-module-light min-h-screen bg-[#f7f8fa] text-slate-900">
      {/* =====================================================
          HEADER
      ====================================================== */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-5 py-5 sm:px-7 lg:px-9">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400">
                <Link
                  to="/app/tenant"
                  className="inline-flex items-center gap-1.5 transition hover:text-slate-900"
                >
                  <ArrowLeft className="size-3.5" />
                  Tenant Dashboard
                </Link>

                <ChevronRight className="size-3.5" />

                <span className="text-slate-600">Landlords</span>
              </div>

              <div className="flex items-start gap-3">
                <div className="hidden rounded-2xl bg-slate-900 p-3 text-white sm:flex">
                  <Users className="size-5" />
                </div>

                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                    Landlords
                  </h1>

                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                    Evaluate property owners through verified identity, trust indicators, properties
                    and tenant reputation.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/app/tenant"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline">Back to Tenant</span>
                <span className="sm:hidden">Back</span>
              </Link>

              <button
                type="button"
                onClick={() => void loadLandlords(true)}
                disabled={refreshing}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refreshing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}

                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
        {/* ===================================================
            METRICS
        ==================================================== */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<Users className="size-5" />}
            label="Landlords available"
            value={metrics.total}
            description="Profiles in the TNP network"
          />

          <MetricCard
            icon={<ShieldCheck className="size-5" />}
            label="Verified landlords"
            value={metrics.verified}
            description="Profiles with stronger verification"
          />

          <MetricCard
            icon={<TrendingUp className="size-5" />}
            label="Average trust"
            value={`${metrics.averageTrust}/100`}
            description="Across available landlord profiles"
          />

          <MetricCard
            icon={<Star className="size-5" />}
            label="Average rating"
            value={metrics.averageRating}
            description="Tenant reputation across profiles"
            suffix={<Star className="size-4 fill-amber-400 text-amber-400" />}
          />
        </section>

        {/* ===================================================
            TRUST BANNER
        ==================================================== */}
        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="relative p-6 sm:p-7">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-slate-100 blur-3xl" />

            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
                  <Sparkles className="size-5" />
                </div>

                <div>
                  <p className="text-sm font-bold text-slate-950">Make informed rental decisions</p>

                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                    TNP combines verification, trust scores, property history and lease-confirmed
                    reviews so you can evaluate the person behind a property before engaging.
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                <ShieldCheck className="size-4" />
                Trust-led renting
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================
            SEARCH / FILTERS
        ==================================================== */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search landlords by name or profile..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:flex">
              <FilterSelect
                icon={<ShieldCheck className="size-3.5" />}
                value={verificationFilter}
                onChange={setVerificationFilter}
                options={[
                  ["all", "All verification"],
                  ["verified", "Verified"],
                  ["unverified", "Other"],
                ]}
              />

              <FilterSelect
                icon={<TrendingUp className="size-3.5" />}
                value={trustFilter}
                onChange={setTrustFilter}
                options={[
                  ["all", "All trust"],
                  ["strong", "Strong"],
                  ["good", "Good"],
                  ["developing", "Developing"],
                  ["attention", "Needs attention"],
                ]}
              />

              <FilterSelect
                icon={<Star className="size-3.5" />}
                value={ratingFilter}
                onChange={setRatingFilter}
                options={[
                  ["all", "All ratings"],
                  ["4plus", "4+ stars"],
                  ["3plus", "3+ stars"],
                ]}
              />

              <FilterSelect
                icon={<Filter className="size-3.5" />}
                value={sortBy}
                onChange={setSortBy}
                options={[
                  ["trust", "Highest trust"],
                  ["rating", "Highest rating"],
                  ["properties", "Most properties"],
                  ["reviews", "Most reviews"],
                ]}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
            <p className="text-xs font-medium text-slate-400">
              Showing <span className="font-bold text-slate-700">{filteredLandlords.length}</span>{" "}
              of <span className="font-bold text-slate-700">{landlords.length}</span> landlords
            </p>

            {(search ||
              verificationFilter !== "all" ||
              trustFilter !== "all" ||
              ratingFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setVerificationFilter("all");
                  setTrustFilter("all");
                  setRatingFilter("all");
                }}
                className="text-xs font-semibold text-slate-600 hover:text-slate-950"
              >
                Clear filters
              </button>
            )}
          </div>
        </section>

        {/* ===================================================
            ERROR
        ==================================================== */}
        {error && (
          <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-600" />

              <div>
                <p className="text-sm font-bold text-red-900">
                  We couldn't load the landlord directory
                </p>

                <p className="mt-1 text-sm text-red-700">{error}</p>

                <button
                  type="button"
                  onClick={() => void loadLandlords(true)}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-900 px-3 py-2 text-xs font-bold text-white hover:bg-red-800"
                >
                  <RefreshCw className="size-3.5" />
                  Try again
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ===================================================
            LOADING
        ==================================================== */}
        {loading && !error && (
          <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <LandlordSkeleton key={index} />
            ))}
          </section>
        )}

        {/* ===================================================
            EMPTY
        ==================================================== */}
        {!loading && !error && filteredLandlords.length === 0 && (
          <section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Users className="size-6" />
            </div>

            <h2 className="mt-5 text-lg font-bold text-slate-900">No landlords found</h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              {landlords.length === 0
                ? "There are currently no landlord profiles available in the TNP network."
                : "Try adjusting your search or filters to find another landlord."}
            </p>

            {landlords.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setVerificationFilter("all");
                  setTrustFilter("all");
                  setRatingFilter("all");
                }}
                className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Reset filters
              </button>
            )}
          </section>
        )}

        {/* ===================================================
            DIRECTORY
        ==================================================== */}
        {!loading && !error && filteredLandlords.length > 0 && (
          <section className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-950">Landlord directory</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Review trust and reputation before you engage.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredLandlords.map((landlord) => (
                <LandlordCard
                  key={landlord.landlord_id}
                  landlord={landlord}
                  onOpen={() => void loadLandlordDetails(landlord)}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* =====================================================
          PROFILE DRAWER
      ====================================================== */}
      {selectedLandlord && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close landlord profile"
            onClick={closeProfile}
            className="absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]"
          />

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Landlord profile
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-900">TNP Trust Profile</p>
              </div>

              <button
                type="button"
                onClick={closeProfile}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="border-b border-slate-100 bg-slate-50 px-5 py-7 sm:px-7">
                <div className="flex gap-4">
                  <Avatar name={selectedLandlord.full_name || "Landlord"} large />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold text-slate-950">
                        {selectedLandlord.full_name || "Unnamed landlord"}
                      </h2>

                      {verificationIsStrong(selectedLandlord.verification) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">
                          <BadgeCheck className="size-3.5" />
                          Verified
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-slate-400">
                      Member since {formatDate(selectedLandlord.member_since)}
                    </p>

                    {selectedLandlord.bio && (
                      <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">
                        {selectedLandlord.bio}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <ProfileMetric
                    label="Trust"
                    value={`${Math.round(selectedLandlord.trust_score ?? 0)}/100`}
                  />

                  <ProfileMetric
                    label="Rating"
                    value={
                      selectedLandlord.average_rating
                        ? `${selectedLandlord.average_rating.toFixed(1)}/5`
                        : "—"
                    }
                  />

                  <ProfileMetric
                    label="Properties"
                    value={selectedLandlord.active_property_count}
                  />

                  <ProfileMetric
                    label="Verified reviews"
                    value={selectedLandlord.verified_review_count}
                  />
                </div>
              </div>

              <div className="space-y-7 p-5 sm:p-7">
                {detailsError && <div role="alert" className="rounded-xl border border-red-200 p-4 text-sm text-red-700">{detailsError}<button type="button" className="ml-3 underline" onClick={() => void loadLandlordDetails(selectedLandlord)}>Retry profile details</button></div>}
                {/* Trust */}
                <section>
                  <SectionHeading
                    icon={<ShieldCheck className="size-4" />}
                    title="Trust & verification"
                  />

                  <div className="mt-4 rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-900">Trust assessment</p>
                        <p className="mt-1 text-xs text-slate-400">
                          Based on the TNP trust profile.
                        </p>
                      </div>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-bold ${trustTone(
                          selectedLandlord.trust_score ?? 0,
                        )}`}
                      >
                        {trustLabel(selectedLandlord.trust_score ?? 0)}
                      </span>
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-900 transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, selectedLandlord.trust_score ?? 0),
                          )}%`,
                        }}
                      />
                    </div>

                    <div className="mt-2 flex justify-between text-[11px] text-slate-400">
                      <span>0</span>
                      <span>
                        {Math.round(selectedLandlord.trust_score ?? 0)}
                        /100
                      </span>
                      <span>100</span>
                    </div>
                  </div>
                </section>

                {/* Properties */}
                <section>
                  <div className="flex items-end justify-between">
                    <SectionHeading
                      icon={<Building2 className="size-4" />}
                      title="Properties managed"
                    />

                    <span className="text-xs font-semibold text-slate-400">
                      {selectedLandlord.active_property_count} active
                    </span>
                  </div>

                  {propertiesLoading ? (
                    <div className="mt-4 flex items-center justify-center rounded-2xl border border-slate-200 py-10">
                      <Loader2 className="size-5 animate-spin text-slate-400" />
                    </div>
                  ) : properties.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                      <Building2 className="mx-auto size-6 text-slate-300" />
                      <p className="mt-3 text-sm font-semibold text-slate-700">
                        No properties available
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {properties.map((property) => (
                        <button
                          type="button"
                          key={property.property_id}
                          onClick={() => setSelectedProperty(property)}
                          className="group flex w-full gap-3 rounded-2xl border border-slate-200 p-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                            {property.image_url ? (
                              <img
                                src={property.image_url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-slate-300">
                                <Home className="size-6" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-slate-900">
                                  {property.title || "Untitled property"}
                                </p>

                                <p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-400">
                                  <MapPin className="size-3" />
                                  {[property.suburb, property.city].filter(Boolean).join(", ") ||
                                    "Location unavailable"}
                                </p>
                              </div>

                              {property.verified && (
                                <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                              )}
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                              <span className="font-bold text-slate-900">
                                {formatMoney(property.rent_usd)}
                              </span>

                              {property.beds !== null && <span>{property.beds} bed</span>}

                              {property.baths !== null && <span>{property.baths} bath</span>}

                              {property.has_360_tour && (
                                <span className="inline-flex items-center gap-1 font-semibold text-blue-600">
                                  <Eye className="size-3" />
                                  360°
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                {!propertiesLoading && <LandlordPropertyHistory landlordId={selectedLandlord.landlord_id} properties={properties} />}

                {/* Reputation */}
                <section>
                  <SectionHeading icon={<Star className="size-4" />} title="Reputation" />

                  <div className="mt-4 grid gap-4 sm:grid-cols-[160px_1fr]">
                    <div className="rounded-2xl border border-slate-200 p-5 text-center">
                      <p className="text-3xl font-bold text-slate-950">
                        {selectedLandlord.average_rating
                          ? selectedLandlord.average_rating.toFixed(1)
                          : "—"}
                      </p>

                      <div className="mt-2 flex justify-center gap-0.5">
                        {Array.from({
                          length: 5,
                        }).map((_, index) => (
                          <Star
                            key={index}
                            className={`size-3.5 ${
                              index < Math.round(selectedLandlord.average_rating ?? 0)
                                ? "fill-amber-400 text-amber-400"
                                : "text-slate-200"
                            }`}
                          />
                        ))}
                      </div>

                      <p className="mt-2 text-xs text-slate-400">
                        {selectedLandlord.review_count} reviews
                      </p>
                    </div>

                    <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                      <RatingBar
                        label="5"
                        count={selectedLandlord.five_star_count}
                        total={selectedLandlord.review_count}
                      />

                      <RatingBar
                        label="4"
                        count={selectedLandlord.four_star_count}
                        total={selectedLandlord.review_count}
                      />

                      <RatingBar
                        label="3"
                        count={selectedLandlord.three_star_count}
                        total={selectedLandlord.review_count}
                      />

                      <RatingBar
                        label="2"
                        count={selectedLandlord.two_star_count}
                        total={selectedLandlord.review_count}
                      />

                      <RatingBar
                        label="1"
                        count={selectedLandlord.one_star_count}
                        total={selectedLandlord.review_count}
                      />
                    </div>
                  </div>
                </section>

                {/* Reviews */}
                <section>
                  <div className="flex items-end justify-between">
                    <SectionHeading
                      icon={<MessageSquare className="size-4" />}
                      title="Tenant reviews"
                    />

                    {selectedLandlord.responded_review_count > 0 && (
                      <span className="text-xs font-semibold text-emerald-600">
                        {selectedLandlord.responded_review_count} responded
                      </span>
                    )}
                  </div>

                  {reviewsLoading ? (
                    <div className="mt-4 flex justify-center py-8">
                      <Loader2 className="size-5 animate-spin text-slate-400" />
                    </div>
                  ) : reviews.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                      <MessageSquare className="mx-auto size-6 text-slate-300" />
                      <p className="mt-3 text-sm font-semibold text-slate-700">
                        No published reviews yet
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {reviews.slice(0, 5).map((review) => (
                        <div key={review.id} className="rounded-2xl border border-slate-200 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-1">
                                {Array.from({
                                  length: 5,
                                }).map((_, index) => (
                                  <Star
                                    key={index}
                                    className={`size-3 ${
                                      index < review.rating
                                        ? "fill-amber-400 text-amber-400"
                                        : "text-slate-200"
                                    }`}
                                  />
                                ))}
                              </div>

                              <p className="mt-1 text-[11px] text-slate-400">
                                {formatDate(review.created_at)}
                              </p>
                            </div>

                            {review.lease_confirmed && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                                <CheckCircle2 className="size-3" />
                                Lease confirmed
                              </span>
                            )}
                          </div>

                          {review.body && (
                            <p className="mt-3 text-sm leading-6 text-slate-600">{review.body}</p>
                          )}

                          {review.landlord_response && (
                            <div className="mt-3 rounded-xl bg-slate-50 p-3">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Landlord response
                              </p>

                              <p className="mt-1 text-xs leading-5 text-slate-600">
                                {review.landlord_response}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>

            {/* Profile actions */}
            <div className="border-t border-slate-200 bg-white p-4 sm:p-5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setContactOpen(true)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  <Mail className="size-4" />
                  Contact
                </button>

                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  <Flag className="size-4" />
                  Report concern
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* =====================================================
          PROPERTY DETAIL MODAL
      ====================================================== */}
      {selectedProperty && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="relative h-48 bg-slate-100">
              {selectedProperty.image_url ? (
                <img
                  src={selectedProperty.image_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-300">
                  <Building2 className="size-12" />
                </div>
              )}

              <button
                type="button"
                onClick={() => setSelectedProperty(null)}
                className="absolute right-3 top-3 rounded-xl bg-white/90 p-2 text-slate-600 shadow-sm backdrop-blur transition hover:bg-white"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="max-h-[calc(90vh-12rem)] overflow-y-auto p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-950">
                    {selectedProperty.title || "Property"}
                  </h3>

                  <p className="mt-1 flex items-center gap-1 text-sm text-slate-400">
                    <MapPin className="size-3.5" />
                    {[selectedProperty.suburb, selectedProperty.city].filter(Boolean).join(", ") ||
                      "Location unavailable"}
                  </p>
                </div>

                {selectedProperty.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="size-3.5" />
                    Verified
                  </span>
                )}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniPropertyStat label="Rent" value={formatMoney(selectedProperty.rent_usd)} />

                <MiniPropertyStat
                  label="Beds"
                  value={selectedProperty.beds !== null ? String(selectedProperty.beds) : "—"}
                />

                <MiniPropertyStat
                  label="Baths"
                  value={selectedProperty.baths !== null ? String(selectedProperty.baths) : "—"}
                />

                <MiniPropertyStat
                  label="360°"
                  value={selectedProperty.has_360_tour ? "Available" : "No"}
                />
              </div>

              {selectedProperty.description && (
                <div className="mt-6">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Description
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {selectedProperty.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          CONTACT MODAL
      ====================================================== */}
      {contactOpen && selectedLandlord && (
        <ModalShell
          title="Contact landlord"
          subtitle={`Send a secure enquiry to ${selectedLandlord.full_name || "this landlord"}.`}
          onClose={() => setContactOpen(false)}
        >
          <div className="space-y-4">
            <FieldLabel label="Subject" />

            <input
              value={contactSubject}
              onChange={(event) => setContactSubject(event.target.value)}
              placeholder="e.g. Enquiry about available property"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
            />

            <FieldLabel label="Message" />

            <textarea
              value={contactMessage}
              onChange={(event) => setContactMessage(event.target.value)}
              rows={5}
              placeholder="Write your enquiry..."
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
            />

            <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
              Your enquiry will be recorded in the TNP communication history.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setContactOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={actionLoading || !contactMessage.trim()}
                onClick={() => void submitContact()}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Send message
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* =====================================================
          REPORT MODAL
      ====================================================== */}
      {reportOpen && selectedLandlord && (
        <ModalShell
          title="Report a concern"
          subtitle="Submit a concern for TNP review. This does not directly change the landlord's trust score."
          onClose={() => setReportOpen(false)}
        >
          <div className="space-y-4">
            <FieldLabel label="Concern category" />

            <select
              value={reportCategory}
              onChange={(event) => setReportCategory(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm outline-none focus:border-slate-400 focus:bg-white"
            >
              <option value="suspected_scam">Suspected scam</option>
              <option value="misleading_information">Misleading information</option>
              <option value="payment_concern">Payment concern</option>
              <option value="identity_concern">Identity concern</option>
              <option value="harassment">Harassment</option>
              <option value="misconduct">Misconduct</option>
              <option value="other">Other</option>
            </select>

            <FieldLabel label="Describe the concern" />

            <textarea
              value={reportDescription}
              onChange={(event) => setReportDescription(event.target.value)}
              rows={6}
              placeholder="Provide enough detail for the TNP team to investigate..."
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
            />

            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              Please only submit information you believe is accurate. Reports are reviewed through
              the TNP trust and safety process.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={actionLoading || !reportDescription.trim()}
                onClick={() => void submitReport()}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Flag className="size-4" />
                )}
                Submit concern
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

/* ============================================================
   COMPONENTS
============================================================ */

function MetricCard({
  icon,
  label,
  value,
  description,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  description: string;
  suffix?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          {icon}
        </div>

        {suffix}
      </div>

      <p className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>

      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{value}</p>

      <p className="mt-1 text-xs text-slate-400">{description}</p>
    </div>
  );
}

function FilterSelect({
  icon,
  value,
  onChange,
  options,
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400">
        {icon}
      </div>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 min-w-0 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-8 pr-7 text-xs font-semibold text-slate-600 outline-none transition hover:border-slate-300 focus:border-slate-400 sm:min-w-[140px]"
      >
        {options.map(([optionValue, label]) => (
          <option key={optionValue} value={optionValue}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

function LandlordCard({ landlord, onOpen }: { landlord: Landlord; onOpen: () => void }) {
  const trustScore = Math.round(landlord.trust_score ?? 0);

  const verified = verificationIsStrong(landlord.verification);

  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <div className="border-b border-slate-100 p-5">
        <div className="flex items-start gap-4">
          <Avatar name={landlord.full_name || "Landlord"} />

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-slate-950">
                  {landlord.full_name || "Unnamed landlord"}
                </h3>

                <p className="mt-1 text-xs text-slate-400">
                  {landlord.active_property_count} active{" "}
                  {landlord.active_property_count === 1 ? "property" : "properties"}
                </p>
              </div>

              {verified && (
                <span className="shrink-0 rounded-full bg-blue-50 p-1.5 text-blue-600">
                  <BadgeCheck className="size-4" />
                </span>
              )}
            </div>
          </div>
        </div>

        {landlord.bio && (
          <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-500">{landlord.bio}</p>
        )}
      </div>

      <div className="p-5">
        <div className="grid grid-cols-3 gap-2">
          <CardStat label="Trust" value={`${trustScore}`} sub="/100" />

          <CardStat
            label="Rating"
            value={landlord.average_rating ? landlord.average_rating.toFixed(1) : "—"}
            icon={<Star className="size-3 fill-amber-400 text-amber-400" />}
          />

          <CardStat label="Reviews" value={landlord.review_count} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${trustTone(
              trustScore,
            )}`}
          >
            {trustLabel(trustScore)} trust
          </span>

          {landlord.verified_review_count > 0 && (
            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
              {landlord.verified_review_count} verified{" "}
              {landlord.verified_review_count === 1 ? "review" : "reviews"}
            </span>
          )}

          {landlord.properties_with_360_tour_count > 0 && (
            <span className="rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">
              360° available
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-bold text-white transition hover:bg-slate-800"
        >
          View trust profile
          <ChevronRight className="size-4" />
        </button>
      </div>
    </article>
  );
}

function CardStat({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>

      <div className="mt-1 flex items-center gap-1">
        {icon}
        <span className="text-base font-bold text-slate-900">{value}</span>
        {sub && <span className="text-[10px] text-slate-400">{sub}</span>}
      </div>
    </div>
  );
}

function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-2xl bg-slate-900 font-bold text-white ${
        large ? "size-16 text-lg" : "size-12 text-sm"
      }`}
    >
      {initials || "L"}
    </div>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>

      <p className="mt-1 text-sm font-bold text-slate-950">{value}</p>
    </div>
  );
}

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex size-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
        {icon}
      </div>

      <h3 className="text-sm font-bold text-slate-950">{title}</h3>
    </div>
  );
}

function RatingBar({ label, count, total }: { label: string; count: number; total: number }) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-3 font-semibold text-slate-500">{label}</span>

      <Star className="size-3 fill-amber-400 text-amber-400" />

      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-amber-400" style={{ width: `${percentage}%` }} />
      </div>

      <span className="w-8 text-right text-[11px] text-slate-400">{count}</span>
    </div>
  );
}

function MiniPropertyStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>

      <p className="mt-1 truncate text-xs font-bold text-slate-900">{value}</p>
    </div>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <label className="block text-xs font-bold text-slate-700">{label}</label>;
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-bold text-slate-950">{title}</h2>

            <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">{subtitle}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

function LandlordSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="p-5">
        <div className="flex gap-4">
          <div className="size-12 rounded-2xl bg-slate-200" />

          <div className="flex-1">
            <div className="h-4 w-32 rounded bg-slate-200" />
            <div className="mt-2 h-3 w-24 rounded bg-slate-100" />
          </div>
        </div>

        <div className="mt-5 h-10 rounded bg-slate-100" />

        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="h-16 rounded-xl bg-slate-100" />
          <div className="h-16 rounded-xl bg-slate-100" />
          <div className="h-16 rounded-xl bg-slate-100" />
        </div>

        <div className="mt-5 h-10 rounded-xl bg-slate-200" />
      </div>
    </div>
  );
}
