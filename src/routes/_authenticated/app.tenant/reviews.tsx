import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Edit3,
  Eye,
  Flag,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Star,
  ThumbsUp,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { errorMessage } from "@/lib/error-message";
import { isReviewableLease } from "@/lib/review-eligibility";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/tenant/reviews")({
  component: TenantReviews,
});

/* ============================================================
   TYPES
============================================================ */

type ModerationStatus = "pending" | "approved" | "rejected" | "flagged" | string;

type Review = {
  id: string;
  author_id: string;
  subject_id: string;
  property_id: string;
  rating: number;
  body: string;
  lease_confirmed: boolean;
  created_at: string;
  moderation_status: ModerationStatus;
  admin_note: string | null;
  reviewed_at: string | null;
  landlord_response: string | null;
  landlord_responded_at: string | null;
  landlord_response_by: string | null;

  property?: Property | null;
  landlord?: Person | null;
  author?: Person | null;
  isOwn?: boolean;
};

type Property = {
  id: string;
  owner_id?: string | null;
  title: string | null;
  suburb: string | null;
  city: string | null;
  rent_usd: number | null;
  deposit_usd: number | null;
  beds: number | null;
  baths: number | null;
  property_type: string | null;
  image_url: string | null;
  verified: boolean | null;
};

type Person = {
  id: string;
  full_name: string | null;
  phone?: string | null;
  verification?: string | null;
  trust_score?: number | null;
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
  created_at: string;
  payment_frequency?: string | null;
  property?: Property | null;
  landlord?: Person | null;
  author?: Person | null;
  isOwn?: boolean;
};

type ReviewEvent = {
  id: string;
  review_id: string;
  actor_id: string | null;
  event_type: string;
  old_status: string | null;
  new_status: string | null;
  note: string | null;
  created_at: string;
};

type ReportReason =
  "false_information" | "fraudulent" | "abusive" | "harassment" | "spam" | "privacy" | "other";

type ReviewFormState = {
  propertyId: string;
  landlordId: string;
  rating: number;
  body: string;
};

/* ============================================================
   ROUTE
============================================================ */

function TenantReviews() {
  const [userId, setUserId] = useState<string | null>(null);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reviewTab, setReviewTab] = useState<"all" | "mine" | "about">("all");

  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<ReviewEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [reviewEventsError, setReviewEventsError] = useState<string | null>(null);

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewLeaseId, setReviewLeaseId] = useState("");
  const [editingReview, setEditingReview] = useState<Review | null>(null);

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReviewTarget, setReportReviewTarget] = useState<Review | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      setUserId(user.id);

      const [reviewsResult, leasesResult] = await Promise.all([
        supabase
          .from("reviews" as never)
          .select("*")
          .eq("author_id", user.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("leases" as never)
          .select(
            "id,property_id,tenant_id,landlord_id,status,rent_usd,deposit_usd,start_date,end_date,created_at,payment_frequency",
          )
          .eq("tenant_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (reviewsResult.error) {
        throw reviewsResult.error;
      }

      if (leasesResult.error) {
        throw leasesResult.error;
      }

      const rawOwnReviews = (reviewsResult.data ?? []) as Review[];
      const rawLeases = (leasesResult.data ?? []) as Lease[];

      const landlordIdsForAbout = Array.from(
        new Set(rawLeases.map((lease) => lease.landlord_id).filter(Boolean)),
      );

      let rawAboutReviews: Review[] = [];

      if (landlordIdsForAbout.length > 0) {
        const aboutResult = await supabase
          .from("reviews" as never)
          .select("*")
          .in("subject_id", landlordIdsForAbout)
          .eq("moderation_status", "approved")
          .neq("author_id", user.id)
          .order("created_at", { ascending: false });

        if (aboutResult.error) throw aboutResult.error;

        rawAboutReviews = (aboutResult.data ?? []) as Review[];
      }

      const rawReviews = [
        ...rawOwnReviews.map((review) => ({ ...review, isOwn: true })),
        ...rawAboutReviews.map((review) => ({ ...review, isOwn: false })),
      ];

      const propertyIds = Array.from(
        new Set([
          ...rawReviews.map((review) => review.property_id),
          ...rawLeases.map((lease) => lease.property_id),
        ]),
      ).filter(Boolean);

      const landlordIds = Array.from(
        new Set([
          ...rawReviews.map((review) => review.subject_id),
          ...rawLeases.map((lease) => lease.landlord_id),
        ]),
      ).filter(Boolean);

      const authorIds = Array.from(
        new Set(rawAboutReviews.map((review) => review.author_id).filter(Boolean)),
      );

      const profileIds = Array.from(new Set([...landlordIds, ...authorIds]));

      const [propertiesResult, landlordsResult] = await Promise.all([
        propertyIds.length
          ? supabase
              .from("properties" as never)
              .select(
                "id,owner_id,title,suburb,city,rent_usd,deposit_usd,beds,baths,property_type,image_url,verified",
              )
              .in("id", propertyIds)
          : Promise.resolve({ data: [], error: null }),

        landlordIds.length
          ? supabase
              .from("profiles" as never)
              .select("id,full_name,phone,verification,trust_score")
              .in("id", profileIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (propertiesResult.error) {
        throw propertiesResult.error;
      }

      if (landlordsResult.error) {
        throw landlordsResult.error;
      }

      const properties = (propertiesResult.data ?? []) as Property[];
      const landlords = (landlordsResult.data ?? []) as Person[];

      const propertyMap = new Map(properties.map((property) => [property.id, property]));

      const landlordMap = new Map(landlords.map((landlord) => [landlord.id, landlord]));

      const hydratedReviews = rawReviews.map((review) => ({
        ...review,
        property: propertyMap.get(review.property_id) ?? null,
        landlord: landlordMap.get(review.subject_id) ?? null,
        author: landlordMap.get(review.author_id) ?? null,
      }));

      const hydratedLeases = rawLeases.map((lease) => ({
        ...lease,
        property: propertyMap.get(lease.property_id) ?? null,
        landlord: landlordMap.get(lease.landlord_id) ?? null,
      }));

      setReviews(hydratedReviews);
      setLeases(hydratedLeases);
    } catch (err) {
      console.error("Tenant reviews load error:", err);

      setError(errorMessage(err, "Unable to load your reviews right now."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadReviewEvents = useCallback(async (reviewId: string) => {
    setEventsLoading(true);
    setReviewEventsError(null);

    try {
      const { data, error: eventsError } = await supabase
        .from("review_events" as never)
        .select("*")
        .eq("review_id", reviewId)
        .order("created_at", { ascending: false });

      if (eventsError) throw eventsError;

      setSelectedEvents((data ?? []) as ReviewEvent[]);
    } catch (err) {
      console.error("Review events error:", err);
      setSelectedEvents([]);
      setReviewEventsError(errorMessage(err, "Unable to load review activity."));
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const openReview = async (review: Review) => {
    setSelectedReview(review);
    setSelectedEvents([]);
    await loadReviewEvents(review.id);
  };

  const eligibleLeases = useMemo(() => {

    return leases.filter(
      (lease) =>
        isReviewableLease(lease.status) &&
        lease.property_id &&
        lease.landlord_id &&
        !reviews.some(
          (review) =>
            review.isOwn &&
            review.property_id === lease.property_id &&
            review.subject_id === lease.landlord_id,
        ),
    );
  }, [leases, reviews]);

  const filteredReviews = useMemo(() => {
    const query = search.trim().toLowerCase();

    return reviews.filter((review) => {
      const propertyName = review.property?.title?.toLowerCase() ?? "";
      const landlordName = review.landlord?.full_name?.toLowerCase() ?? "";
      const authorName = review.author?.full_name?.toLowerCase() ?? "";

      const matchesTab =
        reviewTab === "all" ||
        (reviewTab === "mine" && review.isOwn) ||
        (reviewTab === "about" && !review.isOwn);

      const matchesSearch =
        !query ||
        review.body.toLowerCase().includes(query) ||
        propertyName.includes(query) ||
        landlordName.includes(query) ||
        authorName.includes(query);

      const matchesRating = ratingFilter === "all" || String(review.rating) === ratingFilter;

      const matchesStatus = statusFilter === "all" || review.moderation_status === statusFilter;

      return matchesTab && matchesSearch && matchesRating && matchesStatus;
    });
  }, [reviews, search, ratingFilter, statusFilter, reviewTab]);

  const metrics = useMemo(() => {
    const ownReviews = reviews.filter((review) => review.isOwn);
    const total = ownReviews.length;

    const average =
      total > 0 ? ownReviews.reduce((sum, review) => sum + review.rating, 0) / total : 0;

    const approved = ownReviews.filter((review) => review.moderation_status === "approved").length;

    const pending = ownReviews.filter((review) => review.moderation_status === "pending").length;

    const responded = ownReviews.filter((review) =>
      Boolean(review.landlord_response?.trim()),
    ).length;

    return {
      total,
      average,
      approved,
      pending,
      responded,
    };
  }, [reviews]);

  const handleEdit = (review: Review) => {
    setSelectedReview(null);
    setEditingReview(review);
    setReviewModalOpen(true);
  };

  const handleReviewSubmit = async (form: ReviewFormState) => {
    setActionLoading(true);
    setActionMessage(null);

    try {
      if (!userId) {
        throw new Error("Your session has expired.");
      }

      if (editingReview) {
        const { error: updateError } = await supabase.rpc(
          "update_tenant_review" as never,
          {
            p_review_id: editingReview.id,
            p_rating: form.rating,
            p_body: form.body.trim(),
          } as never,
        );

        if (updateError) throw updateError;

        setActionMessage("Your review has been updated and returned to moderation.");
      } else {
        const { error: submitError } = await supabase.rpc(
          "submit_tenant_review" as never,
          {
            p_property_id: form.propertyId,
            p_landlord_id: form.landlordId,
            p_rating: form.rating,
            p_body: form.body.trim(),
          } as never,
        );

        if (submitError) throw submitError;

        setActionMessage("Your review has been submitted for moderation.");
      }

      setReviewModalOpen(false);
      setEditingReview(null);

      await loadData(true);
    } catch (err) {
      console.error("Review submission error:", err);

      throw new Error(errorMessage(err, "Unable to save your review."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReportSubmit = async (reviewId: string, reason: ReportReason, details: string) => {
    setActionLoading(true);

    try {
      const { error: reportError } = await supabase.rpc(
        "report_review" as never,
        {
          p_review_id: reviewId,
          p_reason: reason,
          p_details: details.trim() || null,
        } as never,
      );

      if (reportError) throw reportError;

      setReportModalOpen(false);
      setReportReviewTarget(null);
      setActionMessage("Thank you. Your report has been submitted to TNP moderation.");

      if (selectedReview?.id === reviewId) {
        await loadReviewEvents(reviewId);
      }
    } catch (err) {
      throw new Error(errorMessage(err, "Unable to submit the report."));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="tnp-module tnp-module-light min-h-screen bg-slate-50 text-slate-900">
      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <Link
                to="/app/tenant"
                className="mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                title="Back to Tenant Dashboard"
              >
                <ArrowLeft className="size-4" />
              </Link>

              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  <span>Tenant Workspace</span>
                  <span className="text-slate-300">/</span>
                  <span>Community Trust</span>
                </div>

                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Reviews</h1>

                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  Share genuine rental experiences and help strengthen the TNP trust network.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadData(true)}
              disabled={refreshing}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {actionMessage && (
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
            <div className="flex-1">{actionMessage}</div>

            <button
              type="button"
              onClick={() => setActionMessage(null)}
              className="text-emerald-700/70 hover:text-emerald-900"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-600" />

              <div className="flex-1">
                <h2 className="font-semibold text-red-900">Reviews could not be loaded</h2>

                <p className="mt-1 text-sm text-red-700">{error}</p>

                <button
                  type="button"
                  onClick={() => void loadData()}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                >
                  <RefreshCw className="size-3.5" />
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================
            TRUST HERO
        ==================================================== */}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="relative overflow-hidden px-6 py-7 sm:px-8">
            <div className="absolute -right-20 -top-28 size-72 rounded-full bg-slate-100/80 blur-3xl" />

            <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  <ShieldCheck className="size-3.5" />
                  Mutual Trust Ledger
                </div>

                <h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                  Your rental experience matters.
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
                  Reviews on TNP are designed around verified rental relationships. Genuine
                  experiences help tenants make better decisions and help responsible landlords
                  build stronger reputations.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <TrustPill icon={<BadgeCheck />} label="Lease verified" />
                  <TrustPill icon={<ShieldCheck />} label="Moderated" />
                  <TrustPill icon={<ThumbsUp />} label="Trust focused" />
                </div>
              </div>

              <div className="min-w-[190px] rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Your average rating
                </p>

                <div className="mt-2 flex items-end gap-2">
                  <span className="text-4xl font-bold text-slate-950">
                    {metrics.average.toFixed(1)}
                  </span>

                  <span className="mb-1 text-sm text-slate-500">/ 5</span>
                </div>

                <div className="mt-2">
                  <StarRating rating={metrics.average} />
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  Based on {metrics.total} review
                  {metrics.total === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ====================================================
            METRICS
        ==================================================== */}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Reviews written"
            value={metrics.total}
            icon={<MessageSquare />}
            description="Your submitted reviews"
          />

          <MetricCard
            label="Average rating"
            value={metrics.average.toFixed(1)}
            icon={<Star />}
            description="Average experience rating"
          />

          <MetricCard
            label="Published"
            value={metrics.approved}
            icon={<CheckCircle2 />}
            description="Approved by TNP"
          />

          <MetricCard
            label="Pending"
            value={metrics.pending}
            icon={<Clock3 />}
            description="Awaiting moderation"
          />

          <MetricCard
            label="Responses"
            value={metrics.responded}
            icon={<MessageSquare />}
            description="Landlord responses"
          />
        </section>

        {/* ====================================================
            ELIGIBLE REVIEWS
        ==================================================== */}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Rental history
              </p>

              <h2 className="mt-1 text-xl font-bold text-slate-950">Share your experience</h2>

              <p className="mt-1 text-sm text-slate-500">
                Review your active or past confirmed tenancy. Each review goes to the administrator for moderation.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingReview(null);
                setReviewModalOpen(true);
              }}
              disabled={eligibleLeases.length === 0}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Edit3 className="size-4" />
              Write a Review
            </button>
          </div>

          {loading ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <SkeletonBox />
              <SkeletonBox />
            </div>
          ) : eligibleLeases.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
              <Building2 className="mx-auto size-8 text-slate-300" />

              <h3 className="mt-3 font-semibold text-slate-800">No eligible rental reviews</h3>

              <p className="mx-auto mt-1 max-w-lg text-sm text-slate-500">
                You can review an active, completed or terminated lease once per property and landlord.
                An application or a draft lease is not yet a confirmed rental. Ask your landlord or
                TNP administrator to confirm your lease; you can edit reviews you already submitted.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {eligibleLeases.map((lease) => (
                <EligibleLeaseCard
                  key={lease.id}
                  lease={lease}
                  onWrite={() => {
                    setReviewLeaseId(lease.id);
                    setEditingReview(null);
                    setReviewModalOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </section>

        {/* ====================================================
            REVIEW DIRECTORY
        ==================================================== */}

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Community trust
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-950">My Reviews</h2>

                <p className="mt-1 text-sm text-slate-500">
                  Manage the rental experiences you have shared with TNP.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReviewTab("all")}
                  className={`h-10 rounded-xl px-3 text-xs font-semibold transition ${reviewTab === "all" ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                >
                  All Reviews
                </button>
                <button
                  type="button"
                  onClick={() => setReviewTab("mine")}
                  className={`h-10 rounded-xl px-3 text-xs font-semibold transition ${reviewTab === "mine" ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                >
                  My Reviews
                </button>
                <button
                  type="button"
                  onClick={() => setReviewTab("about")}
                  className={`h-10 rounded-xl px-3 text-xs font-semibold transition ${reviewTab === "about" ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                >
                  About My Landlords
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <FilterSelect
                  value={ratingFilter}
                  onChange={setRatingFilter}
                  options={[
                    { value: "all", label: "All ratings" },
                    { value: "5", label: "5 stars" },
                    { value: "4", label: "4 stars" },
                    { value: "3", label: "3 stars" },
                    { value: "2", label: "2 stars" },
                    { value: "1", label: "1 star" },
                  ]}
                />

                <FilterSelect
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: "all", label: "All statuses" },
                    { value: "approved", label: "Published" },
                    { value: "pending", label: "Pending" },
                    { value: "rejected", label: "Rejected" },
                    { value: "flagged", label: "Flagged" },
                  ]}
                />
              </div>
            </div>

            <div className="relative mt-5">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search reviews, properties, landlords or reviewers..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
              />
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4 p-6 lg:grid-cols-2">
              <ReviewSkeleton />
              <ReviewSkeleton />
              <ReviewSkeleton />
              <ReviewSkeleton />
            </div>
          ) : filteredReviews.length === 0 ? (
            <EmptyReviews
              hasFilters={
                Boolean(search) ||
                ratingFilter !== "all" ||
                statusFilter !== "all" ||
                reviewTab !== "all"
              }
              onClear={() => {
                setSearch("");
                setRatingFilter("all");
                setStatusFilter("all");
                setReviewTab("all");
              }}
              onWrite={() => {
                setEditingReview(null);
                setReviewModalOpen(true);
              }}
              canWrite={eligibleLeases.length > 0}
            />
          ) : (
            <div className="grid gap-4 p-6 lg:grid-cols-2">
              {filteredReviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onView={() => void openReview(review)}
                  onEdit={() => handleEdit(review)}
                  onReport={() => {
                    setReportReviewTarget(review);
                    setReportModalOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ======================================================
          REVIEW DETAILS DRAWER
      ====================================================== */}

      {selectedReview && (
        <ReviewDetailsDrawer
          review={selectedReview}
          events={selectedEvents}
          eventsLoading={eventsLoading}
          reviewEventsError={reviewEventsError}
          onClose={() => setSelectedReview(null)}
          onEdit={() => handleEdit(selectedReview)}
          onReport={() => {
            setReportReviewTarget(selectedReview);
            setReportModalOpen(true);
          }}
        />
      )}

      {/* ======================================================
          WRITE / EDIT REVIEW
      ====================================================== */}

      {reviewModalOpen && (
        <ReviewComposer
          initialLeaseId={reviewLeaseId}
          leases={leases}
          eligibleLeases={eligibleLeases}
          editingReview={editingReview}
          submitting={actionLoading}
          onClose={() => {
            if (!actionLoading) {
              setReviewModalOpen(false);
              setEditingReview(null);
            }
          }}
          onSubmit={handleReviewSubmit}
        />
      )}

      {/* ======================================================
          REPORT REVIEW
      ====================================================== */}

      {reportModalOpen && reportReviewTarget && (
        <ReportReviewModal
          review={reportReviewTarget}
          submitting={actionLoading}
          onClose={() => {
            if (!actionLoading) {
              setReportModalOpen(false);
              setReportReviewTarget(null);
            }
          }}
          onSubmit={handleReportSubmit}
        />
      )}
    </div>
  );
}

/* ============================================================
   TRUST PILL
============================================================ */

function TrustPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
      <span className="size-3.5 text-slate-500">{icon}</span>
      {label}
    </div>
  );
}

/* ============================================================
   METRIC CARD
============================================================ */

function MetricCard({
  label,
  value,
  icon,
  description,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            {label}
          </p>

          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</p>

          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>

        <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          {icon}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   STAR RATING
============================================================ */

function StarRating({
  rating,
  interactive = false,
  onChange,
  size = "sm",
}: {
  rating: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass = size === "lg" ? "size-7" : size === "md" ? "size-5" : "size-4";

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(rating);

        if (interactive) {
          return (
            <button
              key={star}
              type="button"
              onClick={() => onChange?.(star)}
              className="rounded-md p-0.5 transition hover:scale-110"
              aria-label={`${star} star${star > 1 ? "s" : ""}`}
            >
              <Star
                className={`${sizeClass} ${
                  filled ? "fill-amber-400 text-amber-400" : "text-slate-300"
                }`}
              />
            </button>
          );
        }

        return (
          <Star
            key={star}
            className={`${sizeClass} ${
              filled ? "fill-amber-400 text-amber-400" : "text-slate-200"
            }`}
          />
        );
      })}
    </div>
  );
}

/* ============================================================
   REVIEW CARD
============================================================ */

function ReviewCard({
  review,
  onView,
  onEdit,
  onReport,
}: {
  review: Review;
  onView: () => void;
  onEdit: () => void;
  onReport: () => void;
}) {
  const canEdit =
    Boolean(review.isOwn) &&
    ["pending", "rejected", "flagged"].includes(review.moderation_status.toLowerCase());

  return (
    <article className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-md">
      <div className="mb-4 flex items-center gap-3">
        {review.property?.image_url ? (
          <img src={review.property.image_url} alt="" className="size-14 rounded-xl object-cover" />
        ) : (
          <div className="flex size-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
            <Building2 className="size-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {review.isOwn ? "Your review" : "About your landlord"}
          </p>
          {!review.isOwn && review.author?.full_name && (
            <p className="mt-1 truncate text-xs text-slate-500">
              Reviewer: {review.author.full_name}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={review.moderation_status} />

            {review.lease_confirmed && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                <BadgeCheck className="size-3" />
                Lease confirmed
              </span>
            )}
          </div>

          <h3 className="mt-3 truncate font-semibold text-slate-900">
            {review.property?.title || "Rental property"}
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            {review.landlord?.full_name || "Landlord profile"}
            {review.property?.city ? ` · ${review.property.city}` : ""}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <StarRating rating={review.rating} />
          <p className="mt-1 text-[11px] text-slate-400">{formatDate(review.created_at)}</p>
        </div>
      </div>

      <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{review.body}</p>

      {review.landlord_response && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <MessageSquare className="size-3.5" />
            Landlord response
          </div>

          <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
            {review.landlord_response}
          </p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onView}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-950"
        >
          <Eye className="size-3.5" />
          View details
        </button>

        <div className="flex items-center gap-1">
          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <Edit3 className="size-3.5" />
              Edit
            </button>
          )}

          <button
            type="button"
            onClick={onReport}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-500 hover:bg-red-50 hover:text-red-700"
          >
            <Flag className="size-3.5" />
            Report
          </button>
        </div>
      </div>
    </article>
  );
}

/* ============================================================
   ELIGIBLE LEASE CARD
============================================================ */

function EligibleLeaseCard({ lease, onWrite }: { lease: Lease; onWrite: () => void }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
        <Building2 className="size-5" />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate font-semibold text-slate-900">
          {lease.property?.title || "Rental property"}
        </h3>

        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>{lease.landlord?.full_name || "Landlord"}</span>

          {lease.property?.city && <span>{lease.property.city}</span>}

          {lease.start_date && <span>Lease started {formatDate(lease.start_date)}</span>}
        </div>
      </div>

      <button
        type="button"
        onClick={onWrite}
        className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3.5 text-xs font-semibold text-white hover:bg-slate-800"
      >
        <Star className="size-3.5" />
        Write Review
      </button>
    </div>
  );
}

/* ============================================================
   REVIEW DETAILS DRAWER
============================================================ */

function ReviewDetailsDrawer({
  review,
  events,
  eventsLoading,
  reviewEventsError,
  onClose,
  onEdit,
  onReport,
}: {
  review: Review;
  events: ReviewEvent[];
  eventsLoading: boolean;
  reviewEventsError: string | null;
  onClose: () => void;
  onEdit: () => void;
  onReport: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        aria-label="Close review details"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]"
      />

      <aside className="relative ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Review details
            </p>
            <h2 className="mt-1 font-bold text-slate-950">Rental experience</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="mb-4 flex items-center gap-3">
              {review.property?.image_url ? (
                <img
                  src={review.property.image_url}
                  alt=""
                  className="size-16 rounded-xl object-cover"
                />
              ) : (
                <div className="flex size-16 items-center justify-center rounded-xl bg-white text-slate-400">
                  <Building2 className="size-5" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {review.isOwn ? "Your review" : "About your landlord"}
                </p>
                {!review.isOwn && review.author?.full_name && (
                  <p className="mt-1 text-xs text-slate-500">Reviewer: {review.author.full_name}</p>
                )}
              </div>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div>
                <StatusBadge status={review.moderation_status} />

                <h3 className="mt-3 text-lg font-bold text-slate-950">
                  {review.property?.title || "Rental property"}
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  {review.landlord?.full_name || "Landlord"}
                </p>
              </div>

              <StarRating rating={review.rating} size="md" />
            </div>

            {review.lease_confirmed && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                <BadgeCheck className="size-4" />
                This review is linked to a verified lease relationship.
              </div>
            )}

            <div className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {review.body}
            </div>

            <div className="mt-5 flex items-center gap-2 text-xs text-slate-400">
              <CalendarDays className="size-3.5" />
              Submitted {formatDate(review.created_at)}
            </div>
          </div>

          {review.landlord_response && (
            <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-slate-500" />
                <h3 className="font-semibold text-slate-900">Landlord response</h3>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {review.landlord_response}
              </p>

              {review.landlord_responded_at && (
                <p className="mt-3 text-xs text-slate-400">
                  Responded {formatDate(review.landlord_responded_at)}
                </p>
              )}
            </section>
          )}

          {review.admin_note && (
            <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertCircle className="size-4" />
                <h3 className="font-semibold">TNP moderation note</h3>
              </div>

              <p className="mt-2 text-sm leading-6 text-amber-700">{review.admin_note}</p>
            </section>
          )}

          <section className="mt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Trust ledger
                </p>

                <h3 className="mt-1 font-semibold text-slate-900">Review activity</h3>
              </div>
            </div>

            {eventsLoading ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="size-4 animate-spin" />
                Loading activity...
              </div>
            ) : reviewEventsError ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700">
                <p className="font-semibold">Review activity could not be loaded.</p>
                <p className="mt-1">{reviewEventsError}</p>
              </div>
            ) : events.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">No activity recorded yet.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {events.map((event) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="relative flex flex-col items-center">
                      <span className="mt-1 size-2.5 rounded-full bg-slate-400" />
                      <span className="mt-1 h-full w-px bg-slate-200" />
                    </div>

                    <div className="pb-2">
                      <p className="text-sm font-semibold text-slate-800">
                        {formatEventType(event.event_type)}
                      </p>

                      {event.note && (
                        <p className="mt-1 text-xs leading-5 text-slate-500">{event.note}</p>
                      )}

                      <p className="mt-1 text-[11px] text-slate-400">
                        {formatDate(event.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="border-t border-slate-200 bg-white p-4">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onReport}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              <Flag className="size-4" />
              Report
            </button>

            {Boolean(review.isOwn) &&
              ["pending", "rejected", "flagged"].includes(
                review.moderation_status.toLowerCase(),
              ) && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <Edit3 className="size-4" />
                  Edit Review
                </button>
              )}
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ============================================================
   REVIEW COMPOSER
============================================================ */

function ReviewComposer({
  initialLeaseId,
  leases,
  eligibleLeases,
  editingReview,
  submitting,
  onClose,
  onSubmit,
}: {
  initialLeaseId: string;
  leases: Lease[];
  eligibleLeases: Lease[];
  editingReview: Review | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (form: ReviewFormState) => Promise<void>;
}) {
  const [selectedLeaseId, setSelectedLeaseId] = useState(() => eligibleLeases.some(lease => lease.id === initialLeaseId) ? initialLeaseId : "");
  const [rating, setRating] = useState(editingReview?.rating ?? 5);
  const [body, setBody] = useState(editingReview?.body ?? "");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (editingReview) return;

    if (eligibleLeases.length === 1) {
      setSelectedLeaseId(eligibleLeases[0]?.id ?? "");
    }
  }, [editingReview, eligibleLeases]);

  const selectedLease = useMemo(() => {
    if (editingReview) {
      return leases.find(
        (lease) =>
          lease.property_id === editingReview.property_id &&
          lease.landlord_id === editingReview.subject_id,
      );
    }

    return leases.find((lease) => lease.id === selectedLeaseId);
  }, [editingReview, leases, selectedLeaseId]);

  const canSubmit =
    Boolean(selectedLease) &&
    rating >= 1 &&
    rating <= 5 &&
    body.trim().length >= 10 &&
    body.trim().length <= 10000;

  const submit = async () => {
    setSubmitError(null);

    if (!canSubmit || !selectedLease) {
      setSubmitError("Select a rental relationship and write at least 10 characters.");
      return;
    }

    try {
      await onSubmit({
        propertyId: selectedLease.property_id,
        landlordId: selectedLease.landlord_id,
        rating,
        body,
      });
    } catch (err) {
      setSubmitError(errorMessage(err, "Unable to save your review."));
    }
  };

  return (
    <ModalShell
      title={editingReview ? "Edit Review" : "Write a Review"}
      eyebrow="Community Trust"
      onClose={onClose}
      wide
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
              <ShieldCheck className="size-5" />
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-900">
                Reviews are part of the TNP trust ledger
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                TNP verifies the authenticated tenant's genuine rental relationship on the server
                before accepting the review.
              </p>
            </div>
          </div>
        </div>

        {!editingReview && (
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-800">
              Rental relationship
            </label>

            {eligibleLeases.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                You currently have no rental relationship eligible for a new review.
              </div>
            ) : (
              <select
                value={selectedLeaseId}
                onChange={(event) => setSelectedLeaseId(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              >
                <option value="">Select property and landlord</option>

                {eligibleLeases.map((lease) => (
                  <option key={lease.id} value={lease.id}>
                    {(lease.property?.title || "Property") +
                      " · " +
                      (lease.landlord?.full_name || "Landlord")}
                  </option>
                ))}
              </select>
            )}

            <p className="mt-2 text-xs text-slate-400">
              The lease relationship is re-checked server-side when you submit.
            </p>
          </div>
        )}

        {editingReview && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Reviewing
            </p>

            <p className="mt-1 font-semibold text-slate-900">
              {editingReview.property?.title || "Rental property"}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {editingReview.landlord?.full_name || "Landlord"}
            </p>
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-800">Your rating</label>

          <div className="flex items-center gap-3">
            <StarRating rating={rating} interactive onChange={setRating} size="lg" />

            <span className="text-sm font-semibold text-slate-600">{rating}/5</span>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label className="text-sm font-semibold text-slate-800">Your experience</label>

            <span
              className={`text-xs ${
                body.length > 10000 ? "font-semibold text-red-600" : "text-slate-400"
              }`}
            >
              {body.length}/10000
            </span>
          </div>

          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={8}
            maxLength={10000}
            placeholder="Describe your genuine rental experience. Consider communication, property condition, payments, maintenance and overall professionalism."
            className="w-full resize-none rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />

          <p
            className={`mt-1.5 text-xs ${
              body.trim().length > 0 && body.trim().length < 10
                ? "text-amber-600"
                : "text-slate-400"
            }`}
          >
            Minimum 10 characters.
          </p>
        </div>

        {submitError && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {submitError}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit || submitting}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}

            {editingReview ? "Update Review" : "Submit for Review"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ============================================================
   REPORT MODAL
============================================================ */

function ReportReviewModal({
  review,
  submitting,
  onClose,
  onSubmit,
}: {
  review: Review;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (reviewId: string, reason: ReportReason, details: string) => Promise<void>;
}) {
  const [reason, setReason] = useState<ReportReason>("false_information");

  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);

    try {
      await onSubmit(review.id, reason, details);
    } catch (err) {
      setError(errorMessage(err, "Unable to submit report."));
    }
  };

  return (
    <ModalShell title="Report Review" eyebrow="Safety & Moderation" onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <Flag className="mt-0.5 size-5 shrink-0 text-red-600" />

            <div>
              <p className="text-sm font-semibold text-red-900">Report this review to TNP</p>

              <p className="mt-1 text-xs leading-5 text-red-700">
                Only report content that you believe violates TNP's trust and safety standards.
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-800">Reason</label>

          <select
            value={reason}
            onChange={(event) => setReason(event.target.value as ReportReason)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          >
            <option value="false_information">False or misleading information</option>
            <option value="fraudulent">Fraudulent content</option>
            <option value="abusive">Abusive content</option>
            <option value="harassment">Harassment</option>
            <option value="spam">Spam</option>
            <option value="privacy">Privacy concern</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-800">
            Additional details
          </label>

          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            rows={5}
            maxLength={2000}
            placeholder="Explain why you believe this review should be investigated..."
            className="w-full resize-none rounded-xl border border-slate-200 p-3 text-sm leading-6 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Flag className="size-4" />}
            Submit Report
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ============================================================
   MODAL SHELL
============================================================ */

function ModalShell({
  title,
  eyebrow,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm"
      />

      <div
        className={`relative my-auto max-h-[calc(100vh-2rem)] w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl ${
          wide ? "max-w-2xl" : "max-w-lg"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              {eyebrow}
            </p>

            <h2 className="mt-1 text-lg font-bold text-slate-950">{title}</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="max-h-[calc(100vh-7rem)] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

/* ============================================================
   STATUS BADGE
============================================================ */

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();

  const config =
    normalized === "approved"
      ? {
          label: "Published",
          className: "border-emerald-200 bg-emerald-50 text-emerald-700",
        }
      : normalized === "rejected"
        ? {
            label: "Rejected",
            className: "border-red-200 bg-red-50 text-red-700",
          }
        : normalized === "flagged"
          ? {
              label: "Flagged",
              className: "border-amber-200 bg-amber-50 text-amber-700",
            }
          : {
              label: "Pending",
              className: "border-blue-200 bg-blue-50 text-blue-700",
            };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  );
}

/* ============================================================
   FILTER SELECT
============================================================ */

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/* ============================================================
   EMPTY STATE
============================================================ */

function EmptyReviews({
  hasFilters,
  onClear,
  onWrite,
  canWrite,
}: {
  hasFilters: boolean;
  onClear: () => void;
  onWrite: () => void;
  canWrite: boolean;
}) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        {hasFilters ? <Search className="size-6" /> : <MessageSquare className="size-6" />}
      </div>

      <h3 className="mt-4 text-lg font-bold text-slate-900">
        {hasFilters ? "No matching reviews" : "No reviews yet"}
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        {hasFilters
          ? "Try changing your search or filters to find another review."
          : "Your genuine rental experiences can help other tenants make safer property decisions."}
      </p>

      <div className="mt-5 flex justify-center gap-2">
        {hasFilters && (
          <button
            type="button"
            onClick={onClear}
            className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Clear filters
          </button>
        )}

        {!hasFilters && canWrite && (
          <button
            type="button"
            onClick={onWrite}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Star className="size-4" />
            Write your first review
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   SKELETONS
============================================================ */

function SkeletonBox() {
  return <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />;
}

function ReviewSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 p-5">
      <div className="flex justify-between">
        <div className="space-y-2">
          <div className="h-5 w-20 rounded bg-slate-100" />
          <div className="h-5 w-48 rounded bg-slate-100" />
          <div className="h-3 w-32 rounded bg-slate-100" />
        </div>

        <div className="h-4 w-20 rounded bg-slate-100" />
      </div>

      <div className="mt-5 space-y-2">
        <div className="h-3 w-full rounded bg-slate-100" />
        <div className="h-3 w-5/6 rounded bg-slate-100" />
        <div className="h-3 w-2/3 rounded bg-slate-100" />
      </div>
    </div>
  );
}

/* ============================================================
   HELPERS
============================================================ */

function formatDate(value: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatEventType(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
